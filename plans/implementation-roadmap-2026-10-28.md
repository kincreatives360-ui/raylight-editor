# Raylight Editor — Consolidated Master Implementation & Product Roadmap

- **Basis:** Consolidated Master Audit (`plans/audit-report-2026-10-28.md`, Findings `F-01` through `F-32`)
- **Product direction:** Minimal, canvas-first 2D/3D motion studio with a Figma-inspired interaction model. Keep high-frequency daily controls immediately accessible in compact rows; tuck advanced or inactive settings (`3D Tilt/Depth`, `Layer Effects`, `Animation Block Settings`, `Shader Knobs`, `Hardware Optical Details`) into `+` headers, 1-line summary pills, dropdowns, and `InspectorFlyout` popovers. Keep every action searchable (`⌘K`) and keyboard-accessible.
- **Core engineering rule:** Establish deterministic playback, evaluation, and render parity first; ensure project files and media are durable and portable; complete keyboard and focus foundations; and reorganize the UI through progressive disclosure without removing capabilities.

---

## Target Workspace Architecture (Figma-Style Minimal UI)

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ [Project Menu ▾]  Untitled Project · Saved ✓    Undo Redo    [Export / ⌘E] │
├──────────────┬───────────────────────────────────────────┬─────────────────┤
│ Shots &      │                                           │ Design | Animate│
│ Layers Tree  │                                           │─────────────────│
│ (Drag/Drop + │                 Main Stage                │ Transform Grid  │
│  Keyboard)   │            (Clean Bounding Box,           │  X  Y  W  H  R° │
│──────────────│             Rotated Resize,               │  Radius Opacity │
│ Assets / SFX │             On-Canvas Motion Path)        │ 3D Tilt & Z (+) │
│ (Searchable) │                                           │ Fill        (+) │
│              │     ┌───────────────────────────────┐     │ Stroke      (+) │
│              │     │ V ▾ | H | C | R ▾ | T | I | L │     │ Device Frame(+) │
│              │     └───────────────────────────────┘     │ Effects     (+) │
├──────────────┴───────────────────────────────────────────┴─────────────────┤
│ Compact Timeline: Playhead · Magnetic Snapping · Shot / Layer / Audio Bars │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Phased Execution Plan

### Phase 0 — Behavior Contracts, Multi-Shot Fixture & Baseline Profiling

**Scope (Addresses F-03, F-17, F-18, F-19):**
1. **Deterministic Multi-Shot Fixture:** Build a canonical test fixture containing 2+ shots with a `crossfade`/`push`/`slide` transition, video layers in Shot 1 and Shot 2 (including a shared video source), audio clips before and after `t = 0ms`, all transition preset types, 3D device frames, scene lights, and post-processing effects.
2. **Timebase & Render Contract:** Document and test the invariant that `evaluateShotAtTime`, `ThreeLayerObject`, `canvasRenderer`, and `exporter` all evaluate layer visibility, animation, and video seeking using `shotLocalTimeMs = globalTimeMs - shot.startMs`.
3. **Baseline Measurements:** Record baseline vitals for edit latency, playback frame time, memory usage, and export parity across preview (WebGL), fallback (Canvas 2D), and export.

**Exit Criteria:**
- Automated fixture tests reproduce the current audio, video-timebase, transition-parity, and preset gaps before fixes are applied.

---

### Phase 1 — Playback, Evaluation, Stage Manipulation & Render Parity (P0 / P1)

**Scope (Addresses F-01, F-02, F-03, F-13, F-14, F-15, F-21, F-22, F-23, F-24, F-25):**
1. **Web Audio Lookahead & Active Clip Scheduler (`F-01` — `src/engine/audioEngine.ts`, `src/App.tsx`):**
   - Track scheduled `AudioBufferSourceNode` instances by `clip.id` and schedule both active clips (`clipStart <= currentTimeMs < clipEnd`) and upcoming clips (`clipStart > currentTimeMs`) against `AudioContext.currentTime`, canceling/rescheduling cleanly on pause, seek, loop, mute, or clip edit.
   - Guard the playback RAF loop in `App.tsx:449-464` so zero-duration or empty projects immediately stop playback rather than spinning `requestAnimationFrame` forever.
2. **Shot-Local Video Timebase & Safe Seek Deduplication (`F-02`, `F-13` — `src/stage/webgl/ThreeLayerObject.tsx`, `src/engine/canvasRenderer.ts`):**
   - Compute video target time using `shotLocalTimeMs - layer.inMs` (instead of global `currentTimeMs - layer.inMs`) in both `ThreeLayerObject.tsx` and `canvasRenderer.ts`.
   - In `syncAndSeekAllProjectVideos`, seek only the active incoming (and, during transitions, outgoing) shot's visible video layers, and key `<video>` elements by `layer.id` (or clone per concurrent instance) so reused video assets across shots never overwrite each other's decoded frame.
   - In `seekVideoElement`, verify decoded frame readiness (`readyState >= 2` and `Math.abs(video.currentTime - targetSec) <= tolerance`) or surface an explicit warning/retry rather than silently resolving a stale frame on timeout.
3. **WebGL & Canvas Shot Transition Parity (`F-03` — `src/stage/webgl/ViewportCanvas.tsx`, `src/engine/canvasRenderer.ts`):**
   - Render `frame.shotTransition.outgoingFrame.layers` and outgoing lighting in `ViewportCanvas.tsx` during active transitions (`progress < 1`) with matching opacity/slide transforms so WebGL preview and Canvas 2D fallback produce identical transition frames.
4. **Complete All 18 Layer Transition Presets & Text Stagger (`F-21` — `src/engine/evaluateLayer.ts`):**
   - Implement `'pop'` (elastic scale overshoot), `'spin'` ($Z$-rotation + scale), `'flip-x'` (3D $X$-tilt $90^\circ \to 0^\circ$), `'flip-y'` (3D $Y$-tilt $90^\circ \to 0^\circ$), `'swing'` (pendulum $Z$-rotation), `'wipe'` (`revealProgress` + `revealDirection`), and true deterministic character `'scramble'` in `evaluateLayerAtTime`, plus word/letter/line stagger support.
5. **Fix Easing Catalog ID & Unsettled Spring Blending (`F-23` — `src/engine/easing.ts`):**
   - Fix `'bezier: whip'` $\to$ `'bezier:whip'` (with backward-compatible alias in `parseEasingString`) and replace global `rawAt(t) / rawAt(1)` rescaling with a smooth terminal settle blend over the final 15% of the normalized duration so bouncy springs preserve their natural trajectory without a velocity kink.
6. **Fix DoF Auto-Focus Fallback & Sequential Camera Block Continuity (`F-24`, `F-25` — `src/engine/evaluateShot.ts`, `src/engine/evaluateCamera.ts`):**
   - Change `resolveDepthOfFieldFocusZ` fallback from `visibleLayers[0]` (back-most) to `visibleLayers[visibleLayers.length - 1]` (foreground hero layer).
   - Ensure newly added or sequential `CameraBlock` moves link smoothly from the preceding camera state, and compensate camera $Z$ distance in `dollyzoom` so subject width remains constant.
7. **Fix Rotated Layer Resizing & Modifiers on Stage (`F-22` — `src/stage/SelectionOverlay.tsx`):**
   - Project pointer deltas `(clientX - startX, clientY - startY)` into the layer's local rotated coordinate system (`cos(-rotZ)`, `sin(-rotZ)`), keep the opposite anchor fixed in world space, and support `Shift` (aspect-ratio lock) and `Alt` (symmetric resize from center).
8. **Canvas Motion Blur & Export Bitrate Alignment (`F-14`, `F-15` — `src/engine/evaluateEffects.ts`, `src/engine/canvasSceneEffects.ts`, `src/engine/exportMetrics.ts`, `src/engine/exporter.ts`):**
   - Pass camera/scene `motionVector` through `EvaluatedEffects` so `applyCanvasSceneEffects` renders scene motion blur matching WebGL.
   - Unify bitrate constants (`18 / 10 / 5 Mbps`) between `exportMetrics.ts` and `exporter.ts`, and honor user FPS/resolution scaling in GIF export.

**Acceptance Criteria:**
- Crossing future audio clips plays every clip on time; empty project playback stops immediately; videos in Shot 2+ play from `0.0s` at `layer.inMs`; WebGL and Canvas transitions match; all 18 transition presets animate; rotated layers resize accurately along their local axes.

---

### Phase 2 — Project Portability, Schema Integrity & Storage Durability (P1)

**Scope (Addresses F-04, F-05, F-12, F-16, F-20):**
1. **Wire `.raylight.json` Import / Export into the Project Header Menu (`F-04` — `src/panels/LeftPanel/LeftPanel.tsx`, `src/App.tsx`, `src/ui/CommandMenu.tsx`):**
   - Connect `exportProjectToFile(project)` and `importProjectFromFile(file)` to a clean Project dropdown menu on the top-left project header and to `CommandMenu` (`⌘K`), complete with unsaved-replacement confirmation, validation error reporting, and toast confirmation.
2. **Enforce Unique IDs & Referential Integrity in `validateProject` (`F-05` — `src/model/schema.ts`):**
   - Add document-level validation/repair ensuring unique IDs across `shots`, `layers`, `groups`, `blocks`, `cameraBlocks`, `lightBlocks`, `effectBlocks`, `audio.clips`, and `assets`, and repairing or rejecting dangling `groupId`, `parentGroupId`, `maskLayerId`, or `assetId` references.
3. **Visible Autosave Status & Media Durability (`F-12` — `src/storage/projectIO.ts`, `src/App.tsx`):**
   - Track persistence state (`'saved' | 'saving' | 'warning' | 'error'`) from `saveProjectToBrowser` / `saveProjectToIndexedDB`, display a subtle status indicator in the header, and retain the last-known-good IndexedDB/OPFS snapshot if quota overflow occurs.
4. **Safe Media Ingestion, SVG `<image href>` Sanitization & Stage Video/Audio Drop (`F-16` — `src/engine/figmaSvgImporter.ts`, `src/stage/Stage.tsx`, `src/App.tsx`):**
   - Validate scheme (`data:image/` or `blob:`), file byte size, and image/video dimensions on import; reject or strip arbitrary remote `http(s)://` image URLs inside pasted SVGs unless explicitly embedded.
   - Extend `handleCanvasDrop` in `Stage.tsx` so dragging `.mp4`, `.webm`, `.mov`, `.mp3`, or `.wav` files directly onto the Stage imports and places them at the drop coordinates / playhead.
5. **Synchronize Documentation & Zero Lint Warnings (`F-20` — `README.md`, `PRODUCT.md`, `SceneEffectsSection.tsx`, `EasingControl.tsx`):**
   - Resolve the 3 ESLint `react-refresh/only-export-components` warnings (`npm run lint` $\to$ 0 errors, 0 warnings) and update `README.md` / `PRODUCT.md` to match the 90+ test suites, current schema version, and real UI menus.

**Acceptance Criteria:**
- Users can export and re-import `.raylight.json` files from the UI and `⌘K`; duplicate IDs are caught/repaired by `validateProject`; storage errors are visible; `npm run lint` reports 0 warnings.

---

### Phase 3 — Keyboard Operability, Shortcut Unification & Modal/Focus Accessibility (P1)

**Scope (Addresses F-06, F-07, F-08, F-09, F-10, F-11, F-30, F-32):**
1. **Fix `Space` Activation & Centralize Global Shortcuts (`F-06`, `F-07` — `src/utils/shortcuts.ts`, `src/App.tsx`, `src/stage/Stage.tsx`, `src/stage/CanvasToolbar.tsx`):**
   - Update `isEditableElement` (or add `isInteractiveElement`) so `Space` and `Enter` never hijack focused `<button>`, `<a>`, `<summary>`, `[role="button"]`, `[role="tab"]`, or `[role="menuitem"]` elements.
   - Remove the duplicate `keydown` listener in `Stage.tsx` and fix the `CanvasToolbar.tsx` shortcut badges (`Scissors = S`, `Orbit = C`, `Frame Selection = F`).
   - Update `Delete` / `Backspace` in `App.tsx` so when no layer/block/audio clip is selected and a Shot is focused/selected (with `shots.length > 1`), it deletes the active shot as documented.
2. **Keyboard-Operable Shot Rows, Layer Reordering, Timeline Bars & Light Rows (`F-08`, `F-30`, `F-32` — `LeftPanel.tsx`, `Timeline.tsx`, `SceneLightRow.tsx`):**
   - Add keyboard selection (`Enter`/`Space`), arrow navigation (`Up`/`Down`), and `Alt+Up`/`Alt+Down` + drag-and-drop layer reordering in `LeftPanel.tsx`.
   - Make `SceneLightRow.tsx` a keyboard-focusable button/row.
   - Unify the 8 timeline drag handlers in `Timeline.tsx` so Camera and Light blocks also get magnetic snapping and ghost timecode previews, and add keyboard nudge (`ArrowLeft`/`ArrowRight` to move start time by `10ms`/`100ms`, `Shift+ArrowLeft`/`Right` to trim duration) for selected timeline blocks/bars.
3. **WAI-ARIA Tabs, Focus-Visible Hover Actions & Modal Focus Lifecycle (`F-09`, `F-10`, `F-11` — `primitives.tsx`, `LeftPanel.tsx`, `ModalShell.tsx`, `ExportModal.tsx`):**
   - Add roving `tabIndex`, `ArrowLeft`/`ArrowRight`/`Home`/`End` key handling, and `aria-controls`/`role="tabpanel"` to `InspectorModeTabs` and `LeftPanel` tabs.
   - Add `focus-within:opacity-100 focus-visible:opacity-100` to all `opacity-0 group-hover:opacity-100` action buttons across `LeftPanel`, `RightSidebar`, `SceneLightsList`, and `AudioClipBar`.
   - Upgrade `ModalShell.tsx` with initial focus, `Tab`/`Shift+Tab` focus containment, `Escape` close, return-focus-to-trigger on unmount, and `aria-labelledby` wiring in `ExportModal.tsx`.
   - Add `@media (prefers-reduced-motion: reduce)` support in `src/index.css`.

**Acceptance Criteria:**
- Pressing `Space` on any focused button activates that button; all hierarchy items, tabs, timeline blocks, and modals are fully keyboard-operable with zero invisible focus stops.

---

### Phase 4 — Figma-Style Minimal Contextual Workspace (P1)

**Scope (Addresses F-27, F-28, F-29, F-31):**
1. **Clean Stage Selection Gizmo & Floating Dock (`F-27`, `F-28` — `src/stage/SelectionOverlay.tsx`, `src/stage/CanvasToolbar.tsx`):**
   - Remove the interior `Edit / Move / Tilt` pills from covering the center of selected layers (`primaryProj.pCenter`). Keep the interior of the bounding box 100% unobstructed (drag inside to move; double-click text to edit; place a compact perimeter 3D tilt handle/badge outside the frame).
   - Remove the dead `Tag — coming soon` and `Upgrade` buttons from `CanvasToolbar.tsx`.
2. **Consolidate Transform, Layout & 3D Tilt into a Compact Figma Cluster (`F-29` — `src/panels/Inspector/sections/LayerGeometrySections.tsx`, `LayerDesignInspector.tsx`):**
   - Merge `Position`, `Layout (W/H)`, `Rotation (R°)`, `Corner Radius`, `Opacity`, and `Blend Mode` into a sleek, high-density Figma top block.
   - Tuck `3D Tilt & Depth (RX, RY, Z, Isometric presets)` behind a compact `+` disclosure/popover row when `rotation.x === 0 && rotation.y === 0 && position.z === 0` so 2D layers remain ultra-minimal until 3D is engaged.
3. **1-Line Summary Pills + `InspectorFlyout` Popovers for Layer Effects, Animation Blocks, Camera Moves & Shaders (`F-29`):**
   - **`LayerEffectsSection.tsx`:** Replace the multi-row inline `LayerEffectCard` stack with compact 1-line Figma rows (`[Icon] [Drop shadow · 16px] [Eye] [-]`) that open their parameter scrubbers inside `InspectorFlyout` when clicked—matching `SceneEffectsSection`.
   - **`LayerAnimateInspector.tsx`:** Render custom `AnimationBlock` items as sleek 1-line pills (`[Icon] [Position · +120px] [Eye] [×]`) that open `<BlockSettings />` in `InspectorFlyout` on click, matching the `In` and `Out` preset rows.
   - **`CameraBlockSection.tsx`:** Replace the two stacked 350-line `From` and `To` forms with a single `[ From | To | Swap ⇄ ]` segmented view, and tuck `Camera Presets` and `Lens Focal Length` into compact rows/flyouts.
   - **`RightSidebar.tsx` (`ProjectSettingsPanel` / `ShotSettingsPanel`):** Tuck the 8 Shader / Image / Gradient background knobs into a flyout popover triggered by clicking the 1-line Background swatch row, and remove the non-functional stock avatar and duplicate footer buttons.
4. **Figma-Grade `ScrubInput` Math Expressions & `ColorPicker` Eyedropper (`F-31` — `src/ui/ScrubInput.tsx`, `src/panels/Inspector/ColorPicker.tsx`):**
   - Add safe arithmetic expression parsing (`1920/2`, `100+48`, `50*1.5`) on `Enter`/blur in `ScrubInput.tsx`.
   - Add native browser `EyeDropper` support (when available) and document color swatches in `ColorPicker.tsx`.

**Acceptance Criteria:**
- Selecting any layer, shot, or camera move presents a clean, scannable, non-scrolling Figma-style Inspector where unused features are collapsed behind `+` headers and active items open in crisp flyouts.

---

### Phase 5 — Profile-Led Performance & Scaling (P1 / P2)

**Scope (Addresses F-17, F-18, F-19):**
1. **Isolate 60fps Playhead Subscriptions & Stabilize `App` Keydown Listener (`F-17` — `src/App.tsx`, `src/panels/Timeline/Timeline.tsx`):**
   - Remove `currentTimeMs` subscription from `<App />` and `<Timeline />` root components; read `usePlayheadStore.getState().currentTimeMs` inside imperative handlers (`App.tsx:890` keydown effect) and isolate playhead UI rendering into leaf `<TimelinePlayhead />` and `<TimelineTimecode />` components.
2. **Reuse Persistent `<canvas>` / `CanvasTexture` & Stabilize Effect Passes (`F-17`, `F-19` — `ThreeLayerObject.tsx`, `SceneEffectsPipeline.tsx`, `evaluateEffects.ts`):**
   - Reuse a persistent `HTMLCanvasElement` and `THREE.CanvasTexture` ref per `ThreeLayerObject` (calling `ctx.clearRect` + `texture.needsUpdate = true` instead of `document.createElement('canvas')` every frame).
   - Stabilize `SceneEffectsPipeline` so `composer.passes` only reconstructs when the enabled pass list changes, updating uniforms in place on `useFrame`.
   - Capture export frames via an offscreen `THREE.WebGLRenderTarget` (or dedicated offscreen buffer) so `StageCaptureBridge` does not resize the visible viewport DOM canvas on every exported frame.
3. **Scope `validateProject` to I/O Boundaries & Reuse Canvas Effect Buffers (`F-17`, `F-18` — `useProjectStore.ts`, `canvasSceneEffects.ts`):**
   - Skip full-project Zod re-validation on `undo()`, `redo()`, and hot internal store updates (validating at load/import/migration boundaries).
   - Reuse ping-pong `Float32Array` buffers across passes in `applyCanvasSceneEffects`.

**Acceptance Criteria:**
- Zero root `<App />` or `<Timeline />` track re-renders during 60fps playback; zero `keydown` listener churn during playback; measurable reduction in edit and frame latency on multi-shot projects.

---

### Phase 6 — Top-Tier Studio Capabilities & Reuse (P2 / P3)

1. **Transformable 3D Groups (`F-26` — `types.ts`, `evaluateShot.ts`, `SelectionOverlay.tsx`, `RightSidebar.tsx`):**
   - Give `Group` nodes optional `position`, `rotation`, `scale`, `opacity`, and `blocks` so grouped layers can be moved, scaled, rotated in 3D, and animated as a parent container on the Stage.
2. **On-Canvas Motion Path Gizmo (`Stage.tsx`, `SelectionOverlay.tsx`):**
   - When a `Position` or `followPath` animation block is selected, render its `From → To` motion path curve directly on the Stage with draggable endpoints.
3. **Deterministic WebCodecs Offline Export & 1-Click 4K PNG Snapshot (`exporter.ts`, `ExportModal.tsx`):**
   - Add non-real-time deterministic frame stepping for video export so heavy 4K scenes never skip frames, alongside 1-click PNG frame export.
4. **Graph Editor Curves, Multi-Block Marquee Selection & Component Overrides:**
   - Expand timeline multi-block marquee selection, speed/value curve editing, and reusable component presets.
