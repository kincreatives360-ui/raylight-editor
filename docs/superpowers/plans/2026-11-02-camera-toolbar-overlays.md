# Camera and Toolbar Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace duplicated camera orientation UI with an accessible orientation cube and make viewport zoom available from the standard toolbar.

**Architecture:** Keep `OrientationGizmo` as the HUD entry point, render explicit camera-pose buttons from one shared preset source, and add zoom controls to `CanvasToolbar` using the existing selection-store zoom action.

**Tech Stack:** React, TypeScript, Three.js, Zustand, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-02-canvas-overlays-fixes-design.md`

## Global Constraints

- Keep changes within the stage overlay, gizmo, toolbar, related state/store integration, directly relevant tests, and this design document.
- Camera controls contain no duplicated equivalent presets; the orientation cube supports pointer and keyboard activation.
- Viewport zoom can be changed without entering camera mode.
- Remove only code proven unused after wiring replacement behavior.
- Targeted tests and lint pass; no unrelated tracked files are changed.

## Review Focus

- Cube buttons are reachable and operable with keyboard only.
- Current camera rotation uses radians, while preset definitions are in degrees.
- Zoom selection preserves current stage pan and updates the same `canvasZoom` used by all overlays.
- Camera mode continues to expose angle, pin, back, and zoom controls after replacing the normal HUD.
- Small viewport width does not clip the toolbar's zoom control.

---

### Task 1: Shared camera and zoom presets

**Files:**
- Modify: `src/stage/cameraAngleViews.ts`
- Create: `src/stage/canvasViewOptions.test.ts`
- Test: `src/stage/orientationGizmo.test.tsx`
- Test: `src/stage/orbitCameraOverlay.test.tsx`

**Interfaces:**
- Produces a unique shared `CAMERA_ANGLE_VIEWS` list and `CANVAS_ZOOM_LEVELS: readonly number[]` containing the existing levels `0.25, 0.5, 0.74, 1, 1.5, 2`.
- `CAMERA_ANGLE_VIEWS` must include the six axis-aligned cube poses and its perspective/isometric center pose, alongside any existing camera presets that remain in use.

- [ ] **Step 1: Write tests** ensuring labels/poses are unique, all seven cube poses are represented in the shared list, and the zoom-level list is shared.
- [ ] **Step 2: Run** the two camera UI tests and the new options test; confirm duplicate hardcoded cube poses remain.
- [ ] **Step 3: Move** primary front/top/side/perspective poses and zoom levels into shared data; remove duplicate pose declarations from controls.
- [ ] **Step 4: Run** the focused camera tests.
- [ ] **Step 5: Commit** as `refactor: share camera view and zoom presets`.

### Task 2: Clickable orientation cube

**Files:**
- Modify: `src/stage/OrientationGizmo.tsx`
- Modify: `src/stage/StageCameraHud.tsx`
- Modify: `src/stage/Stage.tsx`
- Test: `src/stage/orientationGizmo.test.tsx`

**Interfaces:**
- Consumes: `CAMERA_ANGLE_VIEWS` from Task 1.
- Keep `onSetOrientation(orbitDeg, tiltDeg, rollDeg?, zoom?)` as the cube action interface.

- [ ] **Step 1: Add tests** for six axis-aligned face buttons, a perspective center button, accessible names, and keyboard focusability; assert the trackball is absent.
- [ ] **Step 2: Run** `npm test -- src/stage/orientationGizmo.test.tsx`; confirm it fails on the trackball markup.
- [ ] **Step 3: Replace** the trackball with a CSS 3D cube: front/back/left/right/top/bottom face buttons snap to axis-aligned poses, and the center snaps to perspective/isometric. Remove trackball-only drag callbacks/state from its callers.
- [ ] **Step 4: Run** the orientation and Stage camera HUD tests.
- [ ] **Step 5: Commit** as `feat: add clickable orientation cube`.

### Task 3: Standard toolbar viewport zoom and dead-code cleanup

**Files:**
- Modify: `src/stage/CanvasToolbar.tsx`
- Modify: `src/stage/Stage.tsx`
- Modify: `src/App.tsx`
- Delete: `src/stage/canvasToolbarLayout.ts`
- Delete: `src/stage/canvasToolbarLayout.test.ts`
- Test: `src/stage/canvasToolbar.test.tsx`
- Test: `src/stage/canvasToolbarLight.test.tsx`
- Test: `src/stage/orbitCameraOverlay.test.tsx`

**Interfaces:**
- Consumes: `CANVAS_ZOOM_LEVELS` from Task 1.
- Add `zoom: number` and `onZoom: (zoom: number) => void` to `CanvasToolbarProps`.

- [ ] **Step 1: Add tests** that normal stage toolbar exposes current zoom and selects a zoom level; ensure camera-mode zoom uses the same levels.
- [ ] **Step 2: Run** the focused tests and confirm normal toolbar has no zoom control.
- [ ] **Step 3: Add** zoom control to the toolbar, pass `canvasZoom`/`setCanvasZoom` from `Stage`, remove the fixed placement prop and utility/test, and remove unused toolbar props (`onOpenSceneEffects`, `onOpenShortcuts`) plus their dead `Stage`/`App` forwarding.
- [ ] **Step 4: Run** the toolbar, camera HUD, and Stage tests; lint touched files.
- [ ] **Step 5: Commit** as `feat: add viewport zoom to canvas toolbar`.
