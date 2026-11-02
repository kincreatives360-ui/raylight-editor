# Selection Transforms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make marquee selection geometrically correct and make resize/rotation handles transform the complete selected group.

**Architecture:** Add pure geometry helpers for polygon intersection and projected selection bounds, then use them in marquee selection and the selection overlay. Keep model updates and drag history in the existing selection/store path.

**Tech Stack:** React, TypeScript, Three.js camera math, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-02-canvas-overlays-fixes-design.md`

## Global Constraints

- Keep changes within the stage overlay, gizmo, toolbar, related state/store integration, directly relevant tests, and this design document.
- Use projected layer polygons for marquee intersection.
- Multi-selection transforms act on the whole group, not only the primary layer.
- Preserve per-layer depth and existing rotation components unrelated to the 2D group rotation.
- Targeted tests and lint pass; no unrelated tracked files are changed.

## Review Focus

- A marquee crosses the middle of a large polygon while containing no corners: it must select the layer.
- A polygon encloses the marquee: intersection must still select it.
- A marquee only touches an edge or vertex: it must have deterministic inclusive behavior.
- Selection includes hidden/locked layers: preserve current visibility and lock semantics.
- Group members have different rotations and positions: resize and rotate all members coherently without changing their depth.

---

### Task 1: Polygon and selection bounds geometry

**Files:**
- Create: `src/stage/selectionGeometry.ts`
- Test: `src/stage/selectionGeometry.test.ts`

**Interfaces:**
- Define exported `Point { x: number; y: number }` and `Rect { left: number; top: number; right: number; bottom: number }` types in this module.
- Produces `polygonsIntersectRect(polygon: Point[], rect: Rect): boolean` and `unionRects(rects: Rect[]): Rect | null`.

- [ ] **Step 1: Write failing tests** for crossing edges, contained polygons, disjoint polygons, edge/vertex contact, empty input, and union bounds.
- [ ] **Step 2: Run** `npm test -- src/stage/selectionGeometry.test.ts`; confirm the new helper imports fail.
- [ ] **Step 3: Implement** the two pure helpers. Include polygon-vertex-in-rect, rect-corner-in-polygon, and segment intersection checks.
- [ ] **Step 4: Run** `npm test -- src/stage/selectionGeometry.test.ts`; confirm all cases pass.
- [ ] **Step 5: Commit** as `fix: add robust selection geometry`.

### Task 2: Marquee polygon intersection

**Files:**
- Modify: `src/stage/useStagePointerInteractions.ts`
- Test: `src/stage/useStagePointerInteractions.test.ts` (create if absent)

**Interfaces:**
- Consumes: `polygonsIntersectRect` from Task 1.

- [ ] **Step 1: Add a regression test** where the marquee crosses a layer polygon but contains neither its center nor any vertex; assert selection.
- [ ] **Step 2: Run** the focused test and confirm it fails on the current center/corner-only predicate.
- [ ] **Step 3: Replace** the predicate with `polygonsIntersectRect(proj.corners, marqueeRect)` while retaining the existing layer visibility, modifier, and empty-marquee behavior.
- [ ] **Step 4: Run** the focused test and the existing stage pointer tests.
- [ ] **Step 5: Commit** as `fix: select layers intersecting marquee`.

### Task 3: Group resize and rotation

**Files:**
- Modify: `src/stage/SelectionOverlay.tsx`
- Modify: `src/stage/SelectionOverlayVisuals.tsx`
- Modify: `src/stage/StageInteractionOverlayStack.tsx`
- Test: `src/stage/selectionOverlayGroupTransform.test.tsx`

**Interfaces:**
- Consumes: `unionRects` from Task 1.
- Keep existing drag start callbacks and pass group handle positions through `SelectionOverlayVisualsProps`.

- [ ] **Step 1: Add tests** asserting combined bounds and that resizing/rotating a multi-selection updates every selected layer while preserving each layer's `position.z`, `rotation.x`, and `rotation.y`; assert transform handles have accessible names, keyboard focus, and arrow-key adjustment.
- [ ] **Step 2: Run** the focused test and confirm it fails because handles/updates use only the primary layer.
- [ ] **Step 3: Compute** the projected union bounds; map handle drag scale and group-center rotation to every selected layer in the same model transaction. Give handles button/slider semantics, accessible names, and keyboard adjustments using the same group transform operations. Preserve single-selection behavior and remove the unused camera-ref prop chain.
- [ ] **Step 4: Run** `npm test -- src/stage/selectionOverlayGroupTransform.test.tsx src/stage/selectionOverlayGradient.test.tsx`.
- [ ] **Step 5: Commit** as `feat: transform selected layer groups`.
