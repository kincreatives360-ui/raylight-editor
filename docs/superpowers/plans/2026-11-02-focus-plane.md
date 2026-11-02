# Interactive Focus Plane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make depth of field visible and directly editable through a camera-projected focus plane, linked depth ruler, keyboard gestures, and rack-focus interaction.

**Architecture:** Add pure projection/ruler helpers and focused overlay components. Route all focus changes through existing shot effects and `focusBlocks`; use the shared drag transaction API from the drag-transactions plan for gestures that can be canceled.

**Tech Stack:** React, TypeScript, Three.js camera math, Zustand, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-02-canvas-overlays-fixes-design.md`

## Global Constraints

- Keep changes within the stage overlay, gizmo, toolbar, related state/store integration, directly relevant tests, and this design document.
- Do not introduce a new serialization format.
- Reuse existing `focusBlocks` as the rack-focus source of truth.
- Requiring `D` preserves the existing `Shift`-click multi-select behavior otherwise.
- If depth of field is disabled, a `D` focus gesture enables it as part of the focus edit.
- Targeted tests and lint pass; no unrelated tracked files are changed.

## Review Focus

- No layers or all layers at the same `z`: ruler range remains nonzero and handles remain usable.
- Focus range at schema minimum/maximum: boundary sheets stay ordered and in range.
- Stage zoom/pan and camera orbit: projected focus plane and ruler ticks remain synchronized with layers.
- Focus animation is active at the playhead: gestures update the intended current focus value without corrupting existing blocks.
- Scroll over controls or outside the stage while `D` is not held: normal browser/canvas behavior remains unchanged.

---

### Task 1: Focus geometry and depth-ruler model

**Files:**
- Create: `src/stage/focusPlaneGeometry.ts`
- Create: `src/stage/focusPlaneGeometry.test.ts`

**Interfaces:**
- Import `EvaluatedCameraPose` from `./webgl/cameraMath.ts`; define `FocusPoint { x: number; y: number }` and `FocusDepthRange { min: number; max: number }`.
- Produces `projectFocusPlane(targetZ: number, cameraPose: EvaluatedCameraPose, frameWidth: number, frameHeight: number, targetAspect: number): FocusPoint[]` and `getFocusDepthRange(layerDepths: number[], targetZ: number, focusRange: number): FocusDepthRange`.

- [ ] **Step 1: Write failing tests** for plane projection under front/orbit camera poses, non-finite projections, empty/equal layer depths, and boundary depths at `focusRange` 0 and 20.
- [ ] **Step 2: Run** `npm test -- src/stage/focusPlaneGeometry.test.ts`; confirm helpers are missing.
- [ ] **Step 3: Implement** projection with existing camera math and a stable depth range enclosing all visible layer depths plus the focus boundaries.
- [ ] **Step 4: Run** the focused geometry test and existing camera math tests.
- [ ] **Step 5: Commit** as `feat: add focus plane geometry`.

### Task 2: Focus plane, depth ruler, and layer feedback

**Files:**
- Create: `src/stage/FocusDepthRuler.tsx`
- Create: `src/stage/FocusLayerFeedback.tsx`
- Modify: `src/stage/DepthOfFieldFocusOverlay.tsx`
- Modify: `src/stage/StageInteractionOverlayStack.tsx`
- Modify: `src/stage/Stage.tsx`
- Test: `src/stage/focusPlaneOverlay.test.tsx`

**Interfaces:**
- Consumes: geometry functions from Task 1.
- Keep stage focus values sourced from `frame.effects.state.depthOfField.target` and `frame.effects.state.depthOfField.focusRange`; use `dofBlurPx` to identify in-focus layers and `totalBlurPx` to communicate total blur.

- [ ] **Step 1: Add tests** for linked focus plane/ruler values, near/far boundary sheets, camera and layer depth ticks, `dofBlurPx` focus outlines, pointer-transparent sheet surfaces, hover linkage between ruler and plane, fade after interaction, no overlap with the toolbar, and focus marker/handles that are named, keyboard-focusable, and support arrow adjustments.
- [ ] **Step 2: Run** the focused test and confirm the current overlay has only a point marker.
- [ ] **Step 3: Render** the camera-projected focus sheet, two range sheets, bottom side-view ruler above the floating toolbar, draggable center/range handles, hover linkage, fade after interaction, and focus/blur feedback. Keep plane surfaces pointer-transparent; give only handles pointer interaction and keyboard adjustment. Use `dofBlurPx === 0` for the sharp outline and `totalBlurPx` for the blur indication.
- [ ] **Step 4: Run** focused overlay tests and existing depth-of-field tests.
- [ ] **Step 5: Commit** as `feat: visualize focus plane and depth range`.

### Task 3: Direct focus gestures and cancellation

**Files:**
- Modify: `src/stage/useStageDofFocus.ts`
- Modify: `src/stage/Stage.tsx`
- Modify: `src/stage/DepthOfFieldFocusOverlay.tsx`
- Modify: `src/stage/useStageWheelNavigation.ts`
- Test: `src/stage/focusPlaneGestures.test.tsx`

**Interfaces:**
- Consumes: `cancelDragTransaction()` from `docs/superpowers/plans/2026-11-02-drag-transactions.md`.
- Add explicit handler props for plane-depth drag, range-edge drag, `D`-drag, `D`-wheel, and Escape. Dragging uses `0.005` depth units per screen pixel (`0.0005` with Shift); wheel uses `0.02` per notch (`0.002` with Shift). All focus edits enable depth of field if needed and write existing `depthOfField.target.z` and `focusRange`.

- [ ] **Step 1: Add tests** for D+vertical drag at `0.005` depth units per screen pixel (`0.0005` with Shift), D+wheel at `0.02` per notch (`0.002` with Shift), auto-enabling depth of field, D+click layer, D+bracket depth navigation, Escape rollback, focus-depth snap resistance, and no gesture effects when D is not held.
- [ ] **Step 2: Run** the focused test and confirm these gestures are not implemented.
- [ ] **Step 3: Implement** pointer-owned, one-transaction focus gestures; add soft attraction near layer depths that remains continuously draggable; commit on completion and rollback on Escape/cancel. When the playhead is inside a focus block, apply a direct adjustment as an equal delta to both block endpoints; otherwise update the base target.
- [ ] **Step 4: Run** focused gesture tests, stage wheel tests, and transaction tests.
- [ ] **Step 5: Commit** as `feat: add direct focus plane gestures`.

### Task 4: Rack-focus creation and ruler path

**Files:**
- Modify: `src/stage/useStageDofFocus.ts`
- Modify: `src/stage/FocusDepthRuler.tsx`
- Modify: `src/stage/Stage.tsx`
- Test: `src/stage/focusPlaneGestures.test.tsx`
- Test: `src/engine/evaluateEffects.test.ts`

**Interfaces:**
- Reuse the existing `FocusBlock` shape: `id`, `startMs`, `durationMs`, `fromZ`, `toZ`, and `easing`.

- [ ] **Step 1: Add tests** that D-click on one layer then D+Shift-click on another creates one focus block from the first layer's `z` to the second's, starting at the playhead, with one undo step; assert the ruler path follows its start/end depths.
- [ ] **Step 2: Run** the focused tests and confirm no block is created.
- [ ] **Step 3: Create** an 800 ms `ease-in-out` rack-focus segment starting at the playhead, using existing focus-block conventions and no new persisted fields. Preserve existing focus blocks and render the segment path on the depth ruler.
- [ ] **Step 4: Run** focus interaction and effect evaluation tests.
- [ ] **Step 5: Commit** as `feat: create rack focus from layer picks`.
