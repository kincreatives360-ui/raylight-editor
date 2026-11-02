# Drag Transactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every audited drag a single undoable edit and ensure cancellation restores the pre-drag state.

**Architecture:** Add one explicit store cancellation action that restores the transaction snapshot, then wire pointer-up, cancellation, lost capture, Escape, and unmount cleanup through idempotent drag lifecycles.

**Tech Stack:** React, TypeScript, Zustand, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-02-canvas-overlays-fixes-design.md`

## Global Constraints

- Keep changes within the stage overlay, gizmo, toolbar, related state/store integration, directly relevant tests, and this design document.
- A canceled drag restores its initial model state and does not leave a history transaction open.
- Use existing store transactions and event-handling patterns.
- Ensure pointer identity, `pointercancel`, lost capture, unmount cleanup, Escape, and normal pointer-up each end a drag exactly once.
- Targeted tests and lint pass; no unrelated tracked files are changed.

## Review Focus

- `pointercancel` after several model updates: restore the snapshot and leave no undo entry.
- `lostpointercapture` followed by `pointerup`: cancel/commit only once.
- Escape while a drag is active: restore values and remove listeners.
- Window blur/unmount during a drag: remove listeners and clear transaction state.
- Two different pointers: events from the non-owning pointer must not update or finish the drag.

---

### Task 1: Store transaction rollback

**Files:**
- Modify: `src/store/projectStoreHistoryActions.ts`
- Modify: `src/store/projectStoreTypes.ts`
- Modify: `src/store/useProjectStore.ts`
- Test: `src/store/projectStoreHistoryActions.test.ts`

**Interfaces:**
- Produces `cancelDragTransaction(): void`, restoring `dragSnapshot` to `project`, clearing `dragSnapshot`, and not adding undo history.

- [ ] **Step 1: Write failing tests** for cancel-before-change, cancel-after-multiple-updates, and commit-after-update; verify rollback preserves the exact starting project and leaves history unchanged.
- [ ] **Step 2: Run** `npm test -- src/store/projectStoreHistoryActions.test.ts`; confirm cancellation is not available.
- [ ] **Step 3: Implement** `cancelDragTransaction` and expose it in the store types and initial actions.
- [ ] **Step 4: Run** the focused history tests and existing project store history tests.
- [ ] **Step 5: Commit** as `feat: support canceling drag transactions`.

### Task 2: Shared selection and corner-radius drag lifecycle

**Files:**
- Modify: `src/stage/SelectionOverlay.tsx`
- Modify: `src/stage/SelectionOverlayVisuals.tsx`
- Modify: `src/stage/GradientEditor.tsx`
- Test: `src/stage/selectionOverlayTransactions.test.tsx`
- Test: `src/stage/gradientEditor.test.tsx`

**Interfaces:**
- Consumes: `cancelDragTransaction()` from Task 1.

- [ ] **Step 1: Add regression tests** for corner-radius drag undo grouping and cancel rollback; cover resize, rotate, crop, move, motion-end, and gradient drag cancellation including Escape and window blur.
- [ ] **Step 2: Run** the focused test and confirm radius edits currently create per-move history and canceled transforms persist.
- [ ] **Step 3: Route** all selection drags through one pointer-aware lifecycle; begin once, commit on pointer-up, cancel on pointer-cancel/lost capture/Escape/unmount. Make radius updates skip history during the drag. Change the gradient editor's blur completion to rollback; keep its existing pointer-cancel behavior and add Escape cancellation.
- [ ] **Step 4: Run** the focused transaction tests and existing selection-overlay tests.
- [ ] **Step 5: Commit** as `fix: make selection drags atomic`.

### Task 3: Camera and lighting drag cancellation

**Files:**
- Modify: `src/stage/CameraFramingOverlay.tsx`
- Modify: `src/stage/LightingOverlay.tsx`
- Test: `src/stage/cameraFramingOverlay.test.tsx`
- Test: `src/stage/lightingOverlay.test.tsx`

**Interfaces:**
- Consumes: `cancelDragTransaction()` from Task 1.

- [ ] **Step 1: Add tests** that cancel camera endpoint pan/resize and each light gizmo drag after a model update; assert model rollback and no open transaction. Also assert camera framing handles are named, keyboard-focusable, and support arrow adjustments.
- [ ] **Step 2: Run** the focused tests and confirm partial updates currently remain after cancellation.
- [ ] **Step 3: Add** pointer-ID ownership and idempotent completion; commit only on normal pointer-up and restore on cancel/lost capture/Escape/unmount. Add accessible names and keyboard pan/resize controls to the camera framing handles.
- [ ] **Step 4: Run** the two focused test files and store transaction tests.
- [ ] **Step 5: Commit** as `fix: roll back canceled camera and light drags`.
