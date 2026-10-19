# Raylight Editor — Stage Overlays & Custom Controls UI/Motion Audit

**Target Surfaces:** Stage Overlays & Precision Custom Controls  
**Governing Documents:** [`DESIGN.md`](file:///c:/Users/Sam%20Akinkunmi/Downloads/Ray_New/raylight-editor/DESIGN.md), [`PRODUCT.md`](file:///c:/Users/Sam%20Akinkunmi/Downloads/Ray_New/raylight-editor/PRODUCT.md), [`src/index.css`](file:///c:/Users/Sam%20Akinkunmi/Downloads/Ray_New/raylight-editor/src/index.css)  
**Guidelines & Methodologies:** `/improve-ui` • `/improve-animations` (Emil Kowalski Animation Philosophy) • `/component-canvas`  
**Primary Files Audited:**
1. `src/stage/Stage.tsx`
2. `src/stage/SelectionOverlay.tsx`
3. `src/stage/CameraFramingOverlay.tsx`
4. `src/stage/OrientationGizmo.tsx`
5. `src/stage/Guides.tsx`
6. `src/stage/CanvasToolbar.tsx`
7. `src/ui/ScrubInput.tsx`
8. `src/panels/Inspector/ColorPicker.tsx`

---

## Executive Summary

An exhaustive audit of Raylight Editor's 3D/2D stage overlays and custom input controls was conducted to identify:
1. **Design System & Token Violations:** Direct contradictions of `DESIGN.md` (e.g., hardcoded hex values, non-token surface elevations, arbitrary tailwind colors, sub-10px micro-text, and alignment guide color mismatches).
2. **Pointer Capture & Keyboard Isolation Bugs:** Critical keyboard event leaks where pressing `Spacebar`, `Backspace`, `Delete`, `Escape`, or single-key tool shortcuts (`C`, `V`, `H`, `Y`, `S`) during numeric scrub input, color hex entry, or spinbutton focus triggers unintended studio playback, layer deletion, or tool switching.
3. **Non-Composited Transitions & Canvas Motion Jank:** Non-composited layout transitions (e.g., `transition-[width,height]` on the stage frame, `transition: all` on transform handles and orientation gizmo, and DOM `left`/`top` mutation in snap guides) that trigger browser reflows and visual desynchronization during 60fps canvas pan, zoom, and camera orbit.

All findings are documented below with verified evidence, contract citations, runtime paths, and drop-in code fixes.

---

## Part 1: Comprehensive Audit Findings

### 1. Design Token, Spacing, Radius & Micro-Text Violations (`DESIGN.md`)

`DESIGN.md` establishes the **"Operate"** visual paradigm:
> *"Zero Arbitrary Values: Every surface, border, text color, and focus ring derives strictly from tokenized CSS custom properties defined in `src/index.css`."*  
> *"Zero Sub-10px Micro-Text: All labels, badges, and controls are enforced at a minimum of 10px–11px, eliminating unreadable sub-10px text."*  
> *"Snap Guides: Emerald alignment lines with pixel-distance readouts."*

| # | File & Line | Component | Defect Description | Contract & Token Violation | Proposed Fix |
| :- | :--- | :--- | :--- | :--- | :--- |
| **D1** | `src/stage/Stage.tsx:1085` | `Stage` viewport | Canvas backdrop hardcoded as `bg-[#242424]` (washed out gray) | Violates `--bg-canvas: #07080d` ("Deep space behind the viewport canvas") | Change to `bg-[var(--bg-canvas)]` |
| **D2** | `src/stage/Stage.tsx:1107` | `Stage` frame | Stage frame matte hardcoded as `bg-[#070707]` | Violates `--bg-canvas: #07080d` | Change to `bg-[var(--bg-canvas)]` |
| **D3** | `src/stage/Guides.tsx:85,88,100,103` | `Guides` | Snap guides rendered in magenta/fuchsia (`bg-fuchsia-500`, `#d946ef`, `bg-fuchsia-600`) | Direct violation of `DESIGN.md` §4.4: *"Snap Guides: Emerald alignment lines with pixel-distance readouts"* and `--accent-success: #10b981` | Replace with `--accent-success` (`#10b981` / `rgba(16, 185, 129, 0.35)`) |
| **D4** | `src/stage/OrientationGizmo.tsx:200` | `OrientationGizmo` | Axis SVG text labels styled with `fontSize="9"` | Direct violation of `DESIGN.md` §3.3 Craft Rule 1: *"Zero Sub-10px Micro-Text"* | Set `fontSize="10"` or `"10.5"` with `font-weight: 700` |
| **D5** | `src/stage/OrientationGizmo.tsx:270` | `OrientationGizmo` | Camera Euler readout pill styled with `text-[9px]` | Direct violation of `DESIGN.md` §3.3 Craft Rule 1: *"Zero Sub-10px Micro-Text"* | Upgrade to `text-[10px] font-mono tabular-nums` |
| **D6** | `src/stage/OrientationGizmo.tsx:114,128,154,214` | `OrientationGizmo` | Unit axes & ring use arbitrary Tailwind colors `#ef4444`, `#38bdf8`, `sky-400` | Violates semantic tokens `--accent-danger: #f43f5e` and `--accent-primary: #0088ff` | Unify with tokenized palette (`#f43f5e`, `--accent-primary`) |
| **D7** | `src/stage/CanvasToolbar.tsx:156,232` | `CanvasToolbar` | Dropdown menus styled with `bg-[#18181b]` | Violates `DESIGN.md` §2 Surface Elevations: `--bg-muted: #242428` (`"Dropdown menus, modal dialogs, and floating toolbars"`) | Change to `bg-[var(--bg-muted)] border-[var(--border-subtle)]` |
| **D8** | `src/stage/CanvasToolbar.tsx:79,101,129...` | `CanvasToolbar` | 11 buttons hardcode hex `#0088ff`, `text-[#a1a1aa]`, `text-[#d4d4d8]` | Violates token abstraction rule ("Zero arbitrary values") | Use `bg-[var(--accent-primary)]`, `text-[var(--text-muted)]`, `text-[var(--text-secondary)]` |
| **D9** | `src/ui/ScrubInput.tsx:155` | `ScrubInput` | Container uses `bg-[#1c1c1f] hover:bg-[#242429] rounded-lg` | `#242429` is an arbitrary non-token color; radius is 8px rather than standard input 6px (`rounded-md`) | Use `bg-[var(--bg-subtle)] hover:bg-[var(--bg-muted)] rounded-md border-[var(--border-subtle)]` |
| **D10** | `src/panels/Inspector/ColorPicker.tsx:222` | `ColorPicker` | Dialog popup container styled with `bg-[#111113]` | Violates `--bg-muted: #242428` ("modal dialogs, floating toolbars") | Change to `bg-[var(--bg-muted)] border-[var(--border-medium)]` |
| **D11** | `src/panels/Inspector/ColorPicker.tsx:225,342` | `ColorPicker` | Unselected tab text is `text-[#9ca3af]`; trash icon is `hover:text-red-300` | Arbitrary Tailwind colors; violates `--text-muted: #a1a1aa` and `--accent-danger: #f43f5e` | Use `text-[var(--text-muted)]` and `hover:text-[var(--accent-danger)]` |
| **D12** | `src/stage/SelectionOverlay.tsx:702,721,799` | `SelectionOverlay` | Lollipop knob uses `hover:bg-[#38bdf8]`; handles use `border-[#0088ff]`; tilt uses `hover:bg-purple-600` | Alien purple-600 and sky-400 hues not part of `DESIGN.md` | Align with `--accent-hover: #0077e6` and `--accent-primary: #0088ff` |

---

### 2. Pointer Capture & Keyboard Shortcut Isolation Deficiencies

`PRODUCT.md` and `DESIGN.md` require fluid tactile scrubbing and keyboard shortcuts (`Space` for play/pause, `S` for split clip, `Backspace` for delete layer, `C/V/H/Y` for tools, `?` for shortcuts). However, without strict isolation barriers, keystrokes inside inputs leak into global window handlers.

#### Critical Vulnerability 1: `ScrubInput.tsx` Keyboard Isolation & Deletion Leak
- **File:** `src/ui/ScrubInput.tsx:168-171`
- **Mechanism:**
  ```tsx
  onKeyDown={(e) => {
      if (e.key === 'Enter') commitTextInput();
      if (e.key === 'Escape') setIsEditing(false);
  }}
  ```
  `e.stopPropagation()` is **never called**.
  - When editing a value, pressing `Escape` clears inline edit mode, but the event bubbles up to `App.tsx:539`. `App.tsx` interprets `Escape` as:
    ```tsx
    setIsCropping(false);
    setActiveTool('select');
    clearLayerSelection(); // <-- DESELECTS THE CURRENT LAYER!
    setInspectorTab('shot'); // <-- RESETS INSPECTOR!
    ```
    Canceling a scrub edit unintentionally closes the layer inspector and deselects the layer.
- **Spinbutton Mode Shortcut Leak:**
  When `ScrubInput` is not in text-edit mode, it renders `<div role="spinbutton" tabIndex={0} onKeyDown={handleKeyDown}>`.
  When a user focuses the scrubber via Tab:
  `document.activeElement.tagName` is `'DIV'`.
  In `App.tsx:530` and `Stage.tsx:165`, the shortcut suppression check is strictly:
  ```tsx
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  ```
  Because `DIV` is not an input tag:
  1. Pressing `Spacebar` while focused on a ScrubInput triggers studio play/pause (`togglePlay()`).
  2. Pressing `Backspace` or `Delete` while focused on a ScrubInput triggers `deleteMultipleLayersFromShot()`—**instantly deleting the active layer!**
  3. Pressing `S` invokes clip splitting (`splitAtPlayhead`).
  4. Pressing `C`, `V`, `H`, or `Y` switches tools.

#### Critical Vulnerability 2: `ColorPicker.tsx` Escape & Space Isolation
- **File:** `src/panels/Inspector/ColorPicker.tsx:252-258`
- **Mechanism:** The HEX `<input>` does not call `event.stopPropagation()` on `Escape` or `Enter`. Pressing `Escape` to close the color picker bubbles to `App.tsx`, immediately deselecting the layer and flipping tabs to Shot inspector.
- **Fix:** Add `event.stopPropagation()` on all keydown events within the picker, and wire `Escape` to close the popup (`setOpen(false); onExitGradient?.();`).

#### Critical Vulnerability 3: Pointer Capture Release & Transaction Hangs
- **Files:** `src/ui/ScrubInput.tsx:55`, `src/stage/OrientationGizmo.tsx:41`, `src/panels/Inspector/ColorPicker.tsx:148,309`
- **Mechanism:** While `setPointerCapture(pointerId)` is invoked on pointer down, none of these components implement `onLostPointerCapture`. If an operating system alert, context menu, alt-tab, or touch gesture breaks capture, the drag state (`isDragging`, `activePointerIdRef`, `draggingSquare`) hangs indefinitely, and `commitDragTransaction()` in `useProjectStore` is never executed, corrupting the undo/redo history stack.
- **Stage Workspace Pan:** `Stage.tsx:514-622` relies on legacy `MouseEvent` and `window.addEventListener('mousemove', ...)` rather than container-level Pointer Capture (`setPointerCapture`), causing cursor drift and dropped mouseup events when panning outside the browser window.

---

### 3. Non-Composited CSS Transitions & Canvas Motion Jank

The motion bar follows Emil Kowalski’s animation philosophy: **Animations must never cause layout recalculations (reflows), interpolate during active interaction, or desynchronize coordinate math.**

#### Janky Issue 1: `transition-[width,height]` on Stage Frame
- **File:** `src/stage/Stage.tsx:1105`
- **Evidence:**
  ```tsx
  <div
      ref={stageFrameRef}
      className={`relative transition-[width,height] duration-150 overflow-visible ...`}
      style={{
          width: `${frameWidth}px`,
          height: `${frameHeight}px`,
          ...
      }}
  >
  ```
- **Performance Impact:** Animating CSS `width` and `height` forces full browser layout passes (reflow) on every animation frame for 150ms.
- **Visual Desynchronization:** When the aspect ratio toggles (`16:9` to `9:16`) or window resizes, `frameWidth` and `frameHeight` update immediately in React. `Guides`, `SelectionOverlay`, `CameraFramingOverlay`, and `ViewportCanvas` calculate their 3D/2D pixel positions based on the new dimensions instantaneously, while the parent DOM frame animates its width and height with a 150ms lag. This causes severe coordinate tearing and jitter.
- **Fix:** Remove `transition-[width,height] duration-150`. Frame dimensions must resize synchronously with the WebGL canvas and overlay coordinates.

#### Janky Issue 2: `transition-all duration-150` on `OrientationGizmo`
- **File:** `src/stage/OrientationGizmo.tsx:152`
- **Evidence:**
  ```tsx
  className={`... transition-all duration-150 touch-none ${
      isDragging
          ? 'cursor-grabbing border-sky-400 ring-2 ring-sky-400/50 shadow-sky-500/25 scale-105'
          : 'cursor-grab border-white/10 hover:border-white/30 hover:scale-102'
  }`}
  ```
- **Performance Impact:** `transition-all duration-150` interpolates all style mutations. When dragging to orbit the camera, continuous 60fps transform and rotation updates fight with CSS transition interpolation, resulting in sluggish visual response.
- **Fix:** Scope transitions strictly to GPU-composited properties (`transition-[transform,border-color,box-shadow] duration-100 ease-out`), and apply `transition-none` whenever `isDragging === true`.

#### Janky Issue 3: Unconstrained `transition` on `SelectionOverlay` Handles
- **File:** `src/stage/SelectionOverlay.tsx:702,726`
- **Evidence:**
  ```tsx
  // Top Rotation Knob
  className="... transition transform hover:scale-110"
  // 8 Resize Handles
  className={`... hover:scale-125 transition`}
  ```
- **Performance Impact:** Unscoped `transition` defaults to `transition: all 150ms`. Because handle positions (`left`, `top`, `transform: translate(-50%, -50%)`) update dynamically during canvas pan, zoom, or layer movement, the CSS transition interpolates the handle coordinates, causing them to visibly lag behind the object's 3D projected corners.
- **Fix:** Replace with `transition-transform duration-100 ease-out` so only the `:hover` scale micro-interaction transitions, leaving spatial coordinates un-interpolated.

#### Janky Issue 4: Layout Reflow in `Guides.tsx` via `style.left` and `style.top`
- **File:** `src/stage/Guides.tsx:86,101`
- **Evidence:**
  ```tsx
  <div className="absolute top-0 bottom-0 w-px ..." style={{ left: `${screenX}px` }} />
  <div className="absolute left-0 right-0 h-px ..." style={{ top: `${screenY}px` }} />
  ```
- **Performance Impact:** Setting `left` and `top` forces browser layout reflow on every guide update.
- **Fix:** Use GPU-accelerated composited translation:
  `style={{ transform: `translate3d(${screenX}px, 0, 0)` }}` and `style={{ transform: `translate3d(0, ${screenY}px, 0)` }}`.

---

## Part 2: Exact File-Level Fixes & Code Specifications

### 1. `src/ui/ScrubInput.tsx`

**Key Improvements:**
1. Stop propagation on all keydown events when typing inside `<input>`.
2. Handle `Escape` inside `<input>` with `e.stopPropagation()` so it cancels edit mode without bubbling to `App.tsx` (preventing layer deselection).
3. Stop propagation on spinbutton container `onKeyDown` when handling `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`, `Enter`, and block `Space`, `Backspace`, `Delete` from triggering global layer deletion or playback.
4. Add `onLostPointerCapture` to guarantee `commitDragTransaction()` always runs if pointer capture is lost.
5. Replace hardcoded `#1c1c1f`, `#242429`, `#a1a1aa`, `#0088ff`, and `text-white` with design tokens (`--bg-subtle`, `--bg-muted`, `--text-muted`, `--text-primary`, `--border-focus`).
6. Constrain CSS `transition` to `transition-colors duration-100` so scrubbing is instantaneous.

```diff
--- a/src/ui/ScrubInput.tsx
+++ b/src/ui/ScrubInput.tsx
@@ -76,6 +76,7 @@ export const ScrubInput: React.FC<ScrubInputProps> = ({
     const finishPointerDrag = (e: React.PointerEvent<HTMLDivElement>) => {
         if (activePointerIdRef.current !== e.pointerId) return false;
         activePointerIdRef.current = null;
+        movedRef.current = false;
         try {
             if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                 e.currentTarget.releasePointerCapture(e.pointerId);
@@ -98,6 +99,10 @@ export const ScrubInput: React.FC<ScrubInputProps> = ({
     const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
         finishPointerDrag(e);
     };
+
+    const handleLostPointerCapture = (e: React.PointerEvent<HTMLDivElement>) => {
+        finishPointerDrag(e);
+    };
 
     const commitTextInput = () => {
         setIsEditing(false);
@@ -109,7 +114,14 @@ export const ScrubInput: React.FC<ScrubInputProps> = ({
 
     const handleKeyDown = (e: React.KeyboardEvent) => {
-        if (isEditing) return;
+        if (isEditing) {
+            e.stopPropagation();
+            return;
+        }
+
+        // Prevent spinbutton focus from leaking hotkeys (Space, Backspace, Delete) to global stage
+        if (e.code === 'Space' || e.key === 'Backspace' || e.key === 'Delete') {
+            e.stopPropagation();
+            e.preventDefault();
+            if (e.code === 'Space') {
+                setInputText(value.toFixed(decimals));
+                setIsEditing(true);
+            }
+            return;
+        }
 
         const stepMultiplier = e.shiftKey ? 10 : e.altKey ? 0.1 : 1;
         const effectiveStep = step * stepMultiplier;
@@ -117,17 +129,20 @@ export const ScrubInput: React.FC<ScrubInputProps> = ({
         if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
             e.preventDefault();
+            e.stopPropagation();
             beginDragTransaction();
             onChange(clampAndRound(value + effectiveStep));
             commitDragTransaction();
         } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
             e.preventDefault();
+            e.stopPropagation();
             beginDragTransaction();
             onChange(clampAndRound(value - effectiveStep));
             commitDragTransaction();
         } else if (e.key === 'Enter') {
             e.preventDefault();
+            e.stopPropagation();
             setInputText(value.toFixed(decimals));
             setIsEditing(true);
         }
@@ -147,14 +162,15 @@ export const ScrubInput: React.FC<ScrubInputProps> = ({
             onPointerDown={handlePointerDown}
             onPointerMove={handlePointerMove}
             onPointerUp={handlePointerUp}
             onPointerCancel={handlePointerCancel}
+            onLostPointerCapture={handleLostPointerCapture}
             onKeyDown={handleKeyDown}
             onDoubleClick={() => {
                 setInputText(value.toFixed(decimals));
                 setIsEditing(true);
             }}
             title="Drag left/right to scrub, use arrow keys, or click/press Enter to type exact value"
             style={{ touchAction: 'none' }}
-            className="h-7 px-2.5 rounded-lg bg-[#1c1c1f] hover:bg-[#242429] border border-transparent focus-visible:outline-none focus-visible:border-[#0088ff] focus-visible:ring-1 focus-visible:ring-[#0088ff] flex items-center gap-2 cursor-ew-resize select-none transition"
+            className="h-7 px-2.5 rounded-md bg-[var(--bg-subtle,#1c1c1f)] hover:bg-[var(--bg-muted,#242428)] border border-[var(--border-subtle,rgba(255,255,255,0.07))] focus-visible:outline-none focus-visible:border-[var(--border-focus,#0088ff)] focus-visible:ring-1 focus-visible:ring-[var(--border-focus,#0088ff)] flex items-center gap-2 cursor-ew-resize select-none transition-colors duration-100"
         >
-            <span className="text-[11px] text-[#a1a1aa] font-medium tracking-tight shrink-0 select-none">
+            <span className="text-[11px] text-[var(--text-muted,#a1a1aa)] font-medium tracking-tight shrink-0 select-none">
                 {label}
             </span>
 
@@ -167,8 +183,11 @@ export const ScrubInput: React.FC<ScrubInputProps> = ({
                     onChange={(e) => setInputText(e.target.value)}
                     onBlur={commitTextInput}
                     onKeyDown={(e) => {
+                        e.stopPropagation();
                         if (e.key === 'Enter') commitTextInput();
-                        if (e.key === 'Escape') setIsEditing(false);
+                        if (e.key === 'Escape') {
+                            e.preventDefault();
+                            setIsEditing(false);
+                        }
                     }}
-                    className="w-full bg-transparent text-[11px] font-mono tabular-nums text-white outline-none tracking-tight"
+                    className="w-full bg-transparent text-[11px] font-mono tabular-nums text-[var(--text-primary,#f4f4f5)] outline-none tracking-tight caret-[var(--accent-primary,#0088ff)]"
                 />
             ) : (
-                <span className="text-[11px] font-mono tabular-nums text-[#f4f4f5] truncate tracking-tight">
+                <span className="text-[11px] font-mono tabular-nums text-[var(--text-primary,#f4f4f5)] truncate tracking-tight">
                     {value.toFixed(decimals)}
                     {unit}
                 </span>
```

---

### 2. `src/stage/Stage.tsx`

**Key Improvements:**
1. Fix stage background from washed-out `bg-[#242424]` to `--bg-canvas` (`#07080d`).
2. Remove non-composited `transition-[width,height] duration-150` on the Stage Frame (`stageFrameRef`) to eliminate 150ms layout reflow lag and overlay desynchronization.
3. Replace hardcoded `#070707` with `var(--bg-canvas)`.
4. Strengthen keyboard isolation check in `onKeyDown` to prevent Spacebar Hand tool pan and tool switching when focused on spinbuttons, contenteditable elements, or custom controls (`isContentEditable`, `[role="spinbutton"]`).
5. Replace hardcoded context menu colors with `--bg-muted: #242428`, `--border-subtle`, and semantic tokens.

```diff
--- a/src/stage/Stage.tsx
+++ b/src/stage/Stage.tsx
@@ -163,8 +163,15 @@ const StageComponent: React.FC<StageProps> = ({
     useEffect(() => {
         const onKeyDown = (e: KeyboardEvent) => {
-            const tag = document.activeElement?.tagName;
-            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
+            const el = document.activeElement as HTMLElement | null;
+            if (!el) return;
+            const tag = el.tagName;
+            if (
+                tag === 'INPUT' ||
+                tag === 'TEXTAREA' ||
+                tag === 'SELECT' ||
+                el.isContentEditable ||
+                el.getAttribute('role') === 'spinbutton' ||
+                el.getAttribute('role') === 'textbox'
+            ) {
+                return;
+            }
             if (e.code === 'Space') setIsSpaceHeld(true);
             if (!e.metaKey && !e.ctrlKey) {
                 if (e.key === 'c' || e.key === 'C') setActiveTool('camera');
@@ -1083,7 +1090,7 @@ const StageComponent: React.FC<StageProps> = ({
             onDragOver={handleCanvasDragOver}
             onDragLeave={handleCanvasDragLeave}
             onDrop={handleCanvasDrop}
-            className={`flex-1 bg-[#242424] relative flex items-center justify-center overflow-hidden select-none ${activeTool === 'hand' || isSpaceHeld
+            className={`flex-1 bg-[var(--bg-canvas,#07080d)] relative flex items-center justify-center overflow-hidden select-none ${activeTool === 'hand' || isSpaceHeld
                     ? 'cursor-grab active:cursor-grabbing'
                     : activeTool === 'camera'
                         ? 'cursor-move active:cursor-grabbing'
@@ -1103,9 +1110,9 @@ const StageComponent: React.FC<StageProps> = ({
                 {/* THE STAGE FRAME */}
                 <div
                     ref={stageFrameRef}
-                    className={`relative transition-[width,height] duration-150 overflow-visible ${isTransparentBg
+                    className={`relative overflow-visible ${isTransparentBg
                         ? 'bg-[repeating-conic-gradient(#1c1c21_0%_25%,#101014_0%_50%)] bg-[size:20px_20px]'
-                        : 'bg-[#070707]'
+                        : 'bg-[var(--bg-canvas,#07080d)]'
                         }`}
                     style={{
                         width: `${frameWidth}px`,
@@ -1367,7 +1374,7 @@ const StageComponent: React.FC<StageProps> = ({
                             window.innerHeight - (contextMenuLayer ? 390 : 220)
                         )}px`,
                     }}
-                    className="fixed z-50 w-56 bg-[#0c0d14]/95 backdrop-blur-xl border border-white/12 shadow-2xl rounded-xl p-1 text-xs text-gray-200 flex flex-col gap-0.5 select-none"
+                    className="fixed z-50 w-56 bg-[var(--bg-muted,#242428)]/98 backdrop-blur-xl border border-[var(--border-subtle,rgba(255,255,255,0.07))] shadow-2xl rounded-xl p-1 text-xs text-[var(--text-secondary,#d4d4d8)] flex flex-col gap-0.5 select-none"
                 >
```

---

### 3. `src/stage/OrientationGizmo.tsx`

**Key Improvements:**
1. Enforce Craft Rule 1: Increase micro-text from `fontSize="9"` to `10.5` in SVG and `text-[9px]` to `text-[10px]` in readout pill.
2. Replace `transition-all duration-150` on the sphere container with `transition-[transform,border-color,box-shadow] duration-100 ease-out`, and set `transition-none` during dragging (`isDragging`) to eliminate 150ms rotation lag.
3. Add `onLostPointerCapture` to safeguard drag transactions.
4. Replace hardcoded `#ef4444` and `#38bdf8` with `--accent-danger: #f43f5e` and `--accent-primary: #0088ff`.

```diff
--- a/src/stage/OrientationGizmo.tsx
+++ b/src/stage/OrientationGizmo.tsx
@@ -87,6 +87,14 @@ export const OrientationGizmo: React.FC<OrientationGizmoProps> = ({
         dragStartRef.current = null;
         onDragEnd?.();
     };
+
+    const handleLostPointerCapture = (e: React.PointerEvent<HTMLDivElement>) => {
+        if (!dragStartRef.current) return;
+        setIsDragging(false);
+        dragStartRef.current = null;
+        onDragEnd?.();
+    };
 
     // Compute projected 2D coordinates for the unit axes (X, Y, Z)
     const axes = useMemo(() => {
@@ -112,7 +120,7 @@ export const OrientationGizmo: React.FC<OrientationGizmoProps> = ({
                 py: -vX.y * radius,
                 depth: vX.z,
                 label: 'X',
-                color: '#ef4444',
+                color: 'var(--accent-danger, #f43f5e)',
             },
             y: {
                 px: vY.x * radius,
@@ -120,7 +128,7 @@ export const OrientationGizmo: React.FC<OrientationGizmoProps> = ({
                 py: -vY.y * radius,
                 depth: vY.z,
                 label: 'Y',
-                color: '#10b981',
+                color: 'var(--accent-success, #10b981)',
             },
             z: {
                 px: vZ.x * radius,
@@ -126,7 +134,7 @@ export const OrientationGizmo: React.FC<OrientationGizmoProps> = ({
                 py: -vZ.y * radius,
                 depth: vZ.z,
                 label: 'Z',
-                color: '#38bdf8',
+                color: 'var(--accent-primary, #0088ff)',
             },
         };
     }, [cameraRotation.x, cameraRotation.y, cameraRotation.z]);
@@ -148,12 +156,13 @@ export const OrientationGizmo: React.FC<OrientationGizmoProps> = ({
                 onPointerDown={handlePointerDown}
                 onPointerMove={handlePointerMove}
                 onPointerUp={handlePointerUp}
                 onPointerCancel={handlePointerUp}
+                onLostPointerCapture={handleLostPointerCapture}
                 title="Drag to orbit 3D camera (Yaw & Pitch) • Click axis to snap"
-                className={`relative group flex items-center justify-center w-14 h-14 rounded-2xl bg-[#141417]/85 backdrop-blur-md border shadow-xl transition-all duration-150 touch-none ${
+                className={`relative group flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--bg-surface,#161619)]/90 backdrop-blur-md border shadow-xl touch-none ${
                     isDragging
-                        ? 'cursor-grabbing border-sky-400 ring-2 ring-sky-400/50 shadow-sky-500/25 scale-105'
-                        : 'cursor-grab border-white/10 hover:border-white/30 hover:scale-102'
+                        ? 'cursor-grabbing border-[var(--border-focus,#0088ff)] ring-2 ring-[var(--accent-glow,rgba(0,136,255,0.25))] shadow-lg scale-105 transition-none'
+                        : 'cursor-grab border-[var(--border-subtle,rgba(255,255,255,0.07))] hover:border-[var(--border-medium,rgba(255,255,255,0.12))] hover:scale-102 transition-[transform,border-color,box-shadow] duration-100 ease-out'
                 }`}
             >
                 <svg
@@ -198,7 +207,7 @@ export const OrientationGizmo: React.FC<OrientationGizmoProps> = ({
                                         x={axis.px * 1.3}
                                         y={axis.py * 1.3 + 3}
                                         fill={axis.color}
-                                        fontSize="9"
+                                        fontSize="10.5"
                                         fontWeight="bold"
                                         textAnchor="middle"
                                         fontFamily="Inter, monospace"
@@ -268,7 +277,7 @@ export const OrientationGizmo: React.FC<OrientationGizmoProps> = ({
             {/* Readout pill */}
-            <div className="px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm border border-white/[0.06] text-[9px] font-mono text-[#a1a1aa] tracking-tight pointer-events-none">
+            <div className="px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm border border-[var(--border-subtle,rgba(255,255,255,0.07))] text-[10px] font-mono tabular-nums text-[var(--text-muted,#a1a1aa)] tracking-tight pointer-events-none">
                 {yawDeg}° / {pitchDeg}° • {Number(currentZoom.toFixed(2))}x
             </div>
```

---

### 4. `src/stage/SelectionOverlay.tsx`

**Key Improvements:**
1. Replace unconstrained `transition` on 8 resize handles and rotation knob with `transition-transform duration-100 ease-out` so handle coordinates do not interpolate or lag behind 3D projected corners during transform and camera movements.
2. Replace hardcoded `#0088ff`, `#38bdf8`, and `purple-600` with design tokens (`--accent-primary`, `--accent-hover`, `--bg-surface`, `--bg-subtle`).
3. Ensure inline text editor textarea has explicit `autoFocus` and prevents shortcut leakage.

```diff
--- a/src/stage/SelectionOverlay.tsx
+++ b/src/stage/SelectionOverlay.tsx
@@ -700,7 +700,7 @@ export const SelectionOverlay: React.FC<SelectionOverlayProps> = ({
                     onMouseDown={handleStartRotateZ}
                     title="Drag around object to Spin / Rotate (Roll Z)"
-                    className="absolute pointer-events-auto w-5 h-5 rounded-full bg-[#0088ff] hover:bg-[#38bdf8] border-2 border-white shadow-xl flex items-center justify-center cursor-grab active:cursor-grabbing transition transform hover:scale-110"
+                    className="absolute pointer-events-auto w-5 h-5 rounded-full bg-[var(--accent-primary,#0088ff)] hover:bg-[var(--accent-hover,#0077e6)] border-2 border-white shadow-xl flex items-center justify-center cursor-grab active:cursor-grabbing transition-transform duration-100 ease-out hover:scale-110"
                 >
                     <RotateCw className="w-2.5 h-2.5 text-white" />
                 </div>
@@ -723,7 +723,7 @@ export const SelectionOverlay: React.FC<SelectionOverlayProps> = ({
                                 : isAnimateMode
-                                    ? 'bg-rose-500 border-white'
-                                    : 'bg-white border-[#0088ff]'
-                            } hover:scale-125 transition`}
+                                    ? 'bg-[var(--accent-danger,#f43f5e)] border-white'
+                                    : 'bg-white border-[var(--accent-primary,#0088ff)]'
+                            } hover:scale-125 transition-transform duration-100 ease-out`}
                     />
                 ))}
@@ -789,7 +789,7 @@ export const SelectionOverlay: React.FC<SelectionOverlayProps> = ({
                         <div
                             onMouseDown={handleStartMove}
                             title="Drag to move in 3D space"
-                            className="w-6 h-6 rounded-full bg-[#0088ff]/90 hover:bg-[#38bdf8] border border-white/80 shadow-lg flex items-center justify-center cursor-move transition"
+                            className="w-6 h-6 rounded-full bg-[var(--accent-primary,#0088ff)] hover:bg-[var(--accent-hover,#0077e6)] border border-white/80 shadow-lg flex items-center justify-center cursor-move transition-colors duration-100"
                         >
                             <Move className="w-3 h-3 text-white" />
                         </div>
@@ -797,7 +797,7 @@ export const SelectionOverlay: React.FC<SelectionOverlayProps> = ({
                         <div
                             onMouseDown={handleStart3DTilt}
                             title="Drag in any direction to Tilt in 3D (Pitch & Yaw)"
-                            className="px-2 h-6 rounded-full bg-[#18181b]/90 hover:bg-purple-600 border border-white/30 shadow-lg flex items-center gap-1 cursor-grab active:cursor-grabbing text-[10px] font-medium text-white transition"
+                            className="px-2 h-6 rounded-full bg-[var(--bg-surface,#161619)]/90 hover:bg-[var(--bg-muted,#242428)] border border-[var(--border-medium,rgba(255,255,255,0.12))] shadow-lg flex items-center gap-1 cursor-grab active:cursor-grabbing text-[10px] font-medium text-white transition-colors duration-100"
                         >
                             <Compass className="w-3 h-3" />
                             <span>Tilt</span>
```

---

### 5. `src/stage/Guides.tsx`

**Key Improvements:**
1. Align snap alignment guides with `DESIGN.md` §4.4: Switch from magenta/fuchsia (`bg-fuchsia-500`, `#d946ef`) to Emerald (`var(--accent-success, #10b981)`).
2. Upgrade guide line positioning from layout reflow (`left: ${screenX}px`, `top: ${screenY}px`) to GPU-composited transforms (`transform: translate3d(...)`).
3. Replace hardcoded `#0088ff` and `#38bdf8` in safe zone margins with design tokens.

```diff
--- a/src/stage/Guides.tsx
+++ b/src/stage/Guides.tsx
@@ -53,21 +53,21 @@ export const Guides: React.FC<GuidesProps> = ({
                         <div className="absolute inset-0 pointer-events-none">
                             {/* Top header margin */}
-                            <div className="absolute top-0 inset-x-0 h-[12%] bg-black/20 border-b border-dashed border-[#0088ff]/40 flex items-center justify-center">
-                                <span className="text-[10px] font-mono tabular-nums text-[#38bdf8]/80 uppercase tracking-wider">
+                            <div className="absolute top-0 inset-x-0 h-[12%] bg-black/20 border-b border-dashed border-[var(--accent-primary,#0088ff)]/40 flex items-center justify-center">
+                                <span className="text-[10px] font-mono tabular-nums text-[var(--accent-primary,#0088ff)] uppercase tracking-wider">
                                     Header Safe Zone
                                 </span>
                             </div>
                             {/* Bottom caption margin */}
-                            <div className="absolute bottom-0 inset-x-0 h-[22%] bg-black/20 border-t border-dashed border-[#0088ff]/40 flex items-center justify-center">
-                                <span className="text-[10px] font-mono tabular-nums text-[#38bdf8]/80 uppercase tracking-wider">
+                            <div className="absolute bottom-0 inset-x-0 h-[22%] bg-black/20 border-t border-dashed border-[var(--accent-primary,#0088ff)]/40 flex items-center justify-center">
+                                <span className="text-[10px] font-mono tabular-nums text-[var(--accent-primary,#0088ff)] uppercase tracking-wider">
                                     Caption &amp; Sound Zone
                                 </span>
                             </div>
                             {/* Right action icons margin */}
-                            <div className="absolute top-[12%] bottom-[22%] right-0 w-[18%] bg-black/20 border-l border-dashed border-[#0088ff]/40 flex items-center justify-center">
-                                <span className="text-[10px] font-mono tabular-nums text-[#38bdf8]/80 rotate-90 uppercase tracking-wider">
+                            <div className="absolute top-[12%] bottom-[22%] right-0 w-[18%] bg-black/20 border-l border-dashed border-[var(--accent-primary,#0088ff)]/40 flex items-center justify-center">
+                                <span className="text-[10px] font-mono tabular-nums text-[var(--accent-primary,#0088ff)] rotate-90 uppercase tracking-wider">
                                     UI Buttons
                                 </span>
                             </div>
@@ -75,34 +75,34 @@ export const Guides: React.FC<GuidesProps> = ({
                 </>
             )}
 
-            {/* Active Magenta Smart-Snap Alignment Lines */}
+            {/* Active Emerald Smart-Snap Alignment Lines (DESIGN.md §4.4) */}
             {guides.map((g, idx) => {
                 if (g.axis === 'x') {
                     const screenX =
                         frameWidth / 2 + g.positionFrac * frameWidth * cameraZoom + camOffsetX;
                     return (
                         <div
                             key={`x-${idx}`}
-                            className="absolute top-0 bottom-0 w-px bg-fuchsia-500 shadow-[0_0_8px_#d946ef]"
-                            style={{ left: `${screenX}px` }}
+                            className="absolute top-0 bottom-0 left-0 w-px bg-[var(--accent-success,#10b981)] shadow-[0_0_8px_rgba(16,185,129,0.5)] will-change-transform"
+                            style={{ transform: `translate3d(${screenX}px, 0, 0)` }}
                         >
-                            <span className="absolute top-2 left-1.5 px-1.5 py-0.5 rounded bg-fuchsia-600 text-white text-[10px] font-mono tabular-nums whitespace-nowrap shadow-sm">
+                            <span className="absolute top-2 left-1.5 px-1.5 py-0.5 rounded bg-[var(--accent-success,#10b981)] text-white text-[10px] font-mono tabular-nums whitespace-nowrap shadow-sm">
                                 {g.label}
                             </span>
                         </div>
                     );
                 }
 
                 const screenY =
                     frameHeight / 2 + g.positionFrac * frameHeight * cameraZoom + camOffsetY;
                 return (
                     <div
                         key={`y-${idx}`}
-                        className="absolute left-0 right-0 h-px bg-fuchsia-500 shadow-[0_0_8px_#d946ef]"
-                        style={{ top: `${screenY}px` }}
+                        className="absolute top-0 left-0 right-0 h-px bg-[var(--accent-success,#10b981)] shadow-[0_0_8px_rgba(16,185,129,0.5)] will-change-transform"
+                        style={{ transform: `translate3d(0, ${screenY}px, 0)` }}
                     >
-                        <span className="absolute left-2 -top-5 px-1.5 py-0.5 rounded bg-fuchsia-600 text-white text-[10px] font-mono tabular-nums whitespace-nowrap shadow-sm">
+                        <span className="absolute left-2 -top-5 px-1.5 py-0.5 rounded bg-[var(--accent-success,#10b981)] text-white text-[10px] font-mono tabular-nums whitespace-nowrap shadow-sm">
                             {g.label}
                         </span>
                     </div>
```

---

### 6. `src/stage/CanvasToolbar.tsx`

**Key Improvements:**
1. Replace floating dropdown menu backgrounds from arbitrary `#18181b` with `--bg-muted: #242428` and `--border-subtle`.
2. Tokenize all active buttons with `var(--accent-primary)` and hover states with `var(--bg-hover)`.
3. Standardize focus indicators to `focus-visible:ring-[var(--border-focus,#0088ff)]`.

```diff
--- a/src/stage/CanvasToolbar.tsx
+++ b/src/stage/CanvasToolbar.tsx
@@ -77,9 +77,9 @@ export const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
             className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-left cursor-pointer ${
                 activeTool === item.id
-                    ? 'bg-[#0088ff] text-white'
-                    : 'text-[#d4d4d8] hover:bg-white/5'
+                    ? 'bg-[var(--accent-primary,#0088ff)] text-white'
+                    : 'text-[var(--text-secondary,#d4d4d8)] hover:bg-[var(--bg-hover,rgba(255,255,255,0.05))]'
             }`}
         >
@@ -118,7 +118,7 @@ export const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
             {/* Main Floating Toolbar Pill */}
-            <div className="relative flex items-center gap-1 px-1.5 py-1 rounded-xl bg-[#161619]/95 backdrop-blur-xl border border-white/[0.08] shadow-2xl">
+            <div className="relative flex items-center gap-1 px-1.5 py-1 rounded-xl bg-[var(--bg-surface,#161619)]/95 backdrop-blur-xl border border-[var(--border-subtle,rgba(255,255,255,0.07))] shadow-2xl">
                 {/* 1. Select / Move / Hand Tool + Chevron */}
@@ -127,8 +127,8 @@ export const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
-                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#0088ff] ${isPointerActive
-                                ? 'bg-[#0088ff] text-white shadow-sm'
-                                : 'text-[#a1a1aa] hover:text-white hover:bg-white/5'
+                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors duration-100 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--border-focus,#0088ff)] ${isPointerActive
+                                ? 'bg-[var(--accent-primary,#0088ff)] text-white shadow-sm'
+                                : 'text-[var(--text-muted,#a1a1aa)] hover:text-white hover:bg-[var(--bg-hover,rgba(255,255,255,0.05))]'
                             }`}
@@ -154,7 +154,7 @@ export const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
                     {pointerMenuOpen && (
-                        <div className="absolute bottom-10 left-0 w-44 rounded-xl bg-[#18181b] border border-white/10 shadow-2xl p-1 text-xs z-50">
+                        <div className="absolute bottom-10 left-0 w-44 rounded-xl bg-[var(--bg-muted,#242428)] border border-[var(--border-subtle,rgba(255,255,255,0.07))] shadow-2xl p-1 text-xs z-50">
```

---

### 7. `src/panels/Inspector/ColorPicker.tsx`

**Key Improvements:**
1. Stop propagation on HEX input `onKeyDown` and add explicit `Escape` handler that closes the popup (`setOpen(false); onExitGradient?.();`), preventing accidental layer deselection.
2. Replace hardcoded modal background `#111113` with token `--bg-muted: #242428` (`border-[var(--border-medium)]`).
3. Add `onLostPointerCapture` to both the saturation/brightness square and gradient track SVGs.
4. Replace arbitrary Tailwind colors (`#9ca3af`, `red-300`, `#1b1b1e`) with design tokens.

```diff
--- a/src/panels/Inspector/ColorPicker.tsx
+++ b/src/panels/Inspector/ColorPicker.tsx
@@ -187,6 +187,14 @@ export const ColorPicker: React.FC<ColorPickerProps> = ({
         } catch {
             // ignore
         }
     };
+
+    const handleSquareLostPointerCapture = (event: React.PointerEvent<HTMLDivElement>) => {
+        setDraggingSquare(false);
+    };
 
@@ -220,7 +228,7 @@ export const ColorPicker: React.FC<ColorPickerProps> = ({
             role="dialog"
             aria-label={`${label} picker`}
             style={{ left: position.left, top: position.top }}
-            className="fixed z-[10000] w-[312px] rounded-2xl border border-white/10 bg-[#111113] p-2.5 shadow-[0_18px_60px_rgba(0,0,0,.7)]"
+            className="fixed z-[10000] w-[312px] rounded-2xl border border-[var(--border-medium,rgba(255,255,255,0.12))] bg-[var(--bg-muted,#242428)] p-2.5 shadow-[0_18px_60px_rgba(0,0,0,.7)]"
         >
@@ -251,6 +259,13 @@ export const ColorPicker: React.FC<ColorPickerProps> = ({
                             }}
                             onKeyDown={(event) => {
+                                event.stopPropagation();
+                                if (event.key === 'Escape') {
+                                    event.preventDefault();
+                                    setOpen(false);
+                                    onExitGradient?.();
+                                    return;
+                                }
                                 if (event.key === 'Enter') {
                                     commitHex(hexDraft);
                                     setHexDraft(normalizeHex(hexDraft) || color);
@@ -270,6 +285,7 @@ export const ColorPicker: React.FC<ColorPickerProps> = ({
                             onPointerDown={handleSquarePointerDown}
                             onPointerMove={handleSquarePointerMove}
                             onPointerUp={handleSquarePointerUp}
                             onPointerCancel={handleSquarePointerUp}
+                            onLostPointerCapture={handleSquareLostPointerCapture}
                             className="relative min-w-0 flex-1 touch-none cursor-crosshair rounded-xl select-none"
```

---

## Part 3: Verification & Feel-Check Protocol

To ensure these fixes achieve desktop-grade polish without regressions:

1. **Spacebar & Hotkey Isolation Test:**
   - Click to edit any `ScrubInput` value (e.g., Layer X Position).
   - Press `Spacebar` — verify that video playback does **NOT** toggle and the edit field remains focused.
   - Press `Escape` — verify that inline edit mode exits, but the layer remains **selected** and the Inspector stays on the Layer tab.
   - Tab into a `ScrubInput` container (spinbutton mode). Press `Backspace` / `Delete` — verify that the layer is **NOT** deleted.
   - Open `ColorPicker`. Type a hex value and press `Escape` — verify the color picker closes cleanly while the layer selection is preserved.

2. **Pan & Zoom Smoothness (Emil Kowalski 60fps Feel-Check):**
   - Toggle between `16:9` and `9:16` aspect ratios: verify the stage frame snaps to the new dimensions without 150ms trailing layout desynchronization.
   - Select a layer and drag the canvas around with Hand tool (`Space` + drag) or zoom with wheel (`Ctrl` + wheel):
     - Verify the 8 resize handles and rotation lollipop stay glued to the layer corners without 150ms interpolation lag.
     - Verify the alignment snap lines move with zero layout reflows via composited transforms.
   - Drag the `OrientationGizmo` sphere: verify yaw and pitch update with instantaneous 1:1 tactile response.

3. **Color & Typography Token Compliance:**
   - Inspect computed styles in Chrome DevTools: confirm no raw `#242424` remains on the stage background.
   - Verify alignment snap guides render in `#10b981` Emerald as specified in `DESIGN.md` §4.4.
   - Verify no text element inside `OrientationGizmo` drops below the 10px minimum threshold.
