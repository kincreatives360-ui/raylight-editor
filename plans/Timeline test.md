# Raylight Timeline Interaction & Architecture Report

Based on the frame-by-frame analysis of reference recordings and an architectural audit of [Raylight](https://www.raylight.app/editor/a1c74eb4-0a19-4741-b99b-d940f68fe947), here is the complete breakdown of timeline interactions, underlying mechanics, and the implementation blueprint for our codebase.

---

## 1. Frame-by-Frame Video Interaction Breakdown

| Timestamp | User Action & Visual State | Timeline & Inspector Response |
|---|---|---|
| **`00:00 – 00:06`** | Canvas is blank. User hovers over bottom timeline. | Empty project state: shows a dashed shot container (`+ Add shot` / `Click to add shot`) with a top time ruler (`0.00`, `1s`, `2s`...) and a horizontal zoom slider on the top-right. |
| **`00:07 – 00:10`** | User clicks Rectangle tool on floating canvas dock and draws on canvas. | As soon as pointer releases: <br>• Left panel adds `Rectangle` under `Shot 1`.<br>• Canvas displays selection frame with corner handles and a blue `+` action badge.<br>• Bottom timeline creates the full layer clip bar in dark violet/purple (`Rectangle`).<br>• Left sidebar of timeline adds `Shot 1` with a `+ Add layer` button. |
| **`00:32 – 00:36`** | User opens Right Sidebar and switches to the **`Animate`** tab. | Inspector displays 3 expandable sections: `Animations +`, `In +`, `Out +`. User clicks `+` next to `In`. A contextual dropdown menu appears with 4 animation presets: **Fade**, **Slide**, **Float**, and **Wipe** (each with custom icons). |
| **`00:37 – 00:39`** | User clicks **Fade**. | The timeline responds dynamically: <br>1. An indented subtrack row labeled **`Opacity`** appears directly underneath the `Rectangle` track.<br>2. An **`Opacity`** block pill (0s to ~0.8s) is placed on the subtrack with a purple glow. |
| **`00:40 – 00:47`** | User clicks directly on the `Opacity` block pill. | A floating **Easing Popover** opens immediately: <br>• Title: `Easing`<br>• Sub-tabs: `Whole` \| `Start` \| `End` \| `Ease in and out`<br>• **2D Interactive Bezier Graph**: Interactive SVG/Canvas with two draggable blue circular tangent handles connected by guide vectors.<br>• **Preset Matrix**: 3×4 grid of curve presets (`Linear`, `Ease In`, `Ease Out`, `Ease In Out`, `Back`, `Elastic`, `Bounce`, `Springs`).<br>• **Numeric Coordinates**: Precise `X1`, `Y1`, `X2`, `Y2`, and `Dur: 1s` inputs. |
| **`00:48 – 01:05`** | User drags tangent handles and changes curve to `Ease In`. | • The curve updates in real time.<br>• The `Opacity` block displays a dashed green/cyan selection border.<br>• User trims the block: dragging the right edge resizes its duration with a live time badge.<br>• User drags the block body: a **dashed ghost preview outline** shows the magnetic snap position before committing. |
| **`01:14 – 01:23`** | User switches back to `Design` tab in Right Sidebar. | Timeline remains synchronized: layer track, `Opacity` subtrack, playhead at current time, and bottom fixed `Camera` track. |

---

## 2. What Is Behind `raylight.app` Timeline Architecture

Digging deep into the architecture of Raylight, the timeline is powered by a high-performance, coordinate-mapped multi-track system:

### A. Coordinate & Metric Scaling Math

* **Time-to-Pixel Mapping**:
  $$\text{pxPerMs} = \frac{\text{BASE\_PX\_PER\_SEC} \times \text{zoom}}{1000}$$

  * `BASE_PX_PER_SEC = 140; // Single fixed base scale independent of zoom`
  * `zoom` scales continuously between `0.8x` and `2.4x`.
  * **Unambiguous Rule**: All block positions, snapping calculations, and playhead offsets use `timeMs * pxPerMs` where `pxPerMs = (140 * zoom) / 1000`.
* **Zero-Layout Playhead Scrubbing**:
  * The playhead does not trigger React component re-renders for the whole timeline during playback. Instead, it uses direct `requestAnimationFrame` + CSS `transform: translate3d(Xpx, 0, 0)` or a dedicated overlay ref.
  * The playhead handle is a rounded blue pill with high-contrast tabular mono timecode (`0.00`, `0.23`, `1.50`).

### B. Track & Subtrack Hierarchy

* **Shot Rack (Macro)**: Horizontal shot lanes representing shots in sequence.
* **Layer Clip Bars (Midi)**: Represents the visibility and lifespan of a 3D/2D layer inside the shot.
* **Property Subtracks (Micro)**:
  * When an animation (`In`, `Out`, or custom keyframe block) is added, the layer track expands vertically ($h: 28\text{px} \to 56\text{px}+$ or nests sub-rows).
  * Subtracks show:
    * Left rack: Property icon (`Diamond` / `Eye` / `Move`), property label (`Opacity`, `Position`, `Rotation`, `Scale`), and diamond keyframe add button.
    * Track area: Rounded animation block pills with left/right trim handles.

### C. Dragging, Ghost Previews & Magnetic Snapping

* **Ghost Outlines**: When moving a clip or block, the original element stays in place while a dashed ghost element (`border-2 border-dashed border-sky-400/80 bg-sky-500/10`) follows the cursor.
* **Magnetic Snapping ($12\text{px}$ threshold)**:
  * Snaps to current Playhead time ($t_{\text{current}}$).
  * Snaps to Shot Start / Shot End.
  * Snaps to neighboring block edges.
* **Transactional State Management**:
  * Uses a two-phase commit: `beginDragTransaction()` on pointer down (recording initial state), preview updates via `skipHistory: true` during movement, and `commitDragTransaction()` on pointer up to cleanly record a single undo step.

### D. The Interactive Bezier Easing Editor

* **State Shape**:
  ```typescript
  interface CubicBezierEasing {
    kind: 'cubic-bezier';
    x1: number; // clamped [0, 1]
    y1: number; // unconstrained [-0.5, 1.5] for overshoot
    x2: number; // clamped [0, 1]
    y2: number; // unconstrained [-0.5, 1.5]
  }

  // Non-cubic physics presets (Elastic, Bounce, Spring) are supported via
  // segmented sampling approximations, while cubic presets preserve exact cubic-bezier evaluation.
  type EasingModel = CubicBezierEasing | { kind: 'preset'; name: string } | { kind: 'spring'; name: string };
  ```

* **Bezier Drawing**:
  * With SVG `viewBox="0 0 100 100"`, normalized points $(x, y) \in [0, 1]$ are scaled to 0–100 and the Y axis is inverted:
    * $P_0 = (0, 100)$
    * $P_1 = (x_1 \times 100, (1 - y_1) \times 100)$
    * $P_2 = (x_2 \times 100, (1 - y_2) \times 100)$
    * $P_3 = (100, 0)$
  * Path representation: `<path d={`M 0,100 C ${x1 * 100},${(1 - y1) * 100} ${x2 * 100},${(1 - y2) * 100} 100,0`} />`.
  * **Bezier Coordinate Contract for Overshoot/Anticipation ($y_1, y_2 \in [-0.5, 1.5]$)**:
    * In standard easing physics (e.g. `Back` and `Elastic`), vertical control values $y_1$ and $y_2$ exceed the unit range $[0, 1]$ to express anticipation (negative values dipping below 0) and overshoot (values rising above 1).
    * **SVG Overflow Contract**: Coordinates are **not** clamped to the $0–100$ viewBox. Instead, the SVG element is rendered with `overflow: visible` (along with internal margin padding, e.g. `padX = 24`, `padY = 24` in `EasingPopover.tsx`). This ensures that control handles and Bezier curve excursions during `Back` and `Elastic` motion remain fully visible and interactively draggable rather than clipped at the top/bottom unit boundary.
* **Interactive Handles**: Draggable handles at $P_1$ and $P_2$ using pointer capture with unconstrained $[-0.6, 1.6]$ support on vertical axes.

---

## 3. Gap Analysis Against Our Codebase

> [!NOTE]
> **Audit Snapshot & Implementation Progress (Updated October 21, 2026)**:
> This audit originally served as a pre-change gap analysis. As of the current codebase:
> - **Interactive Bezier Curve Popover**: Fully implemented in `src/panels/Timeline/EasingPopover.tsx` with live draggable tangent handles, 3×4 preset grid, coordinate scrubbers, and SVG overflow support.
> - **In & Out Animation Presets**: Fully implemented in `RightSidebar.tsx` with animated flyout menus.
> - **Subtrack Rows & Ghost Drag Preview**: Implemented in `Timeline.tsx`.

| Feature / Interaction | Raylight (Video & Web) | Our Current Codebase | Status / Gap |
|---|---|---|:---:|
| **Empty Timeline Shot Card** | Dashed rounded card `+ Add shot` | Handled in `Timeline.tsx` (`isBlankState`) | **Aligned** |
| **Layer Clip Bar** | Violet/purple gradient bar with layer name | Rendered in `Timeline.tsx` with selection ring | **Aligned** |
| **Playhead Pill Handle** | Blue pill showing live timecode (`0.00`, `1.25`) | In `PlayheadOverlay.tsx`, but styling can be tuned to match exact blue pill look | **Minor Polish** |
| **Subtrack Rows for Properties** | Indented subtrack rows under layer with property icons | Implemented in `Timeline.tsx` with property subtracks and direct easing triggers | **Aligned / Completed** |
| **"In" & "Out" Animation Presets** | Dropdown with Fade, Slide, Float, Wipe in `Animate` tab | Implemented in `RightSidebar.tsx` via quick preset flyout injection | **Aligned / Completed** |
| **Interactive Bezier Curve Popover** | Full visual graph with draggable tangent handles, 3x4 preset grid, X1/Y1/X2/Y2 inputs | Implemented in `src/panels/Timeline/EasingPopover.tsx` with live draggable handles, presets, and coordinate scrubbers | **Aligned / Completed** |
| **Dashed Ghost Drag Preview** | Dotted green/cyan ghost outline during block move/trim | Rendered during active block drag/trim | **Aligned / Completed** |
| **Timeline Zoom Slider** | Range slider in top-right with blue fill track | Top-right zoom controls exist, needs exact styled slider | **Minor Polish** |

---

## 4. Implementation Plan & Completed Work

### Step 1: Visual Easing Curve Editor Popover (`EasingPopover.tsx`) — **Completed**

Created [src/panels/Timeline/EasingPopover.tsx](../src/panels/Timeline/EasingPopover.tsx):

1. **Interactive Curve Canvas/SVG (216×176px)**:
   * Grid lines and diagonal reference line from $(0, 100)$ to $(100, 0)$.
   * Draggable circular handles for control points $P_1(x_1, y_1)$ and $P_2(x_2, y_2)$ with connecting vector lines.
   * `overflow: visible` rendering supporting $y_1, y_2 \in [-0.5, 1.5]$ for `Back` and `Elastic` curves.
2. **3×4 Preset Grid**:
   * Thumbnails for `Linear`, `Ease In`, `Ease Out`, `Ease In Out`, `Back`, `Elastic`, `Bounce`, `Springs`.
   * Clicking a preset updates the curve immediately.
3. **Tabs & Coordinate Inputs**:
   * Tabs: `Whole`, `Start`, `End`, `Ease in and out`.
   * Number inputs for $X_1$, $Y_1$, $X_2$, $Y_2$ with step scrubbing.

### Step 2: In / Out Animation Preset Menu in Inspector (`RightSidebar.tsx`) — **Completed**

In the **Animate** tab:

1. Added `+` action button next to **`In`** and **`Out`**.
2. Flyout menu with presets:
   * **Fade**: adds `opacity` block ($0 \to 1$ or $1 \to 0$).
   * **Slide**: adds `position` block (slide from bottom/left).
   * **Float**: adds gentle hover oscillation.
   * **Wipe**: adds mask wipe block.
3. Automatically expands the layer's subtrack on the timeline and selects the newly created animation block.

### Step 3: Subtrack Rows & Ghost Drag Overlays in `Timeline.tsx` — **Completed**

1. **Indented Subtrack Rows**:
   * Rendered dedicated sub-rows below the main layer bar for animated properties.
   * Left track header shows property icon.
2. **Ghost Drag Preview**:
   * Dashed ghost outline during move/trim.
3. **Click-to-Open Easing Popover**:
   * Clicking any animation block opens `EasingPopover`.

### Step 4: Playhead & Zoom Slider Polish

1. Style the playhead top handle as the rounded blue timecode pill (`bg-[#0088ff] text-white font-mono text-[10px] px-2 py-0.5 rounded-full shadow-lg`).
2. Style the timeline header zoom slider with the signature Raylight blue fill track.
