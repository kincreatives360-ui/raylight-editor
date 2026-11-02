# Task 3: Camera and lighting drag cancellation

## Status

Implemented camera framing and lighting gizmo drag rollback, pointer ownership, idempotent terminal handling, and camera framing keyboard accessibility.

## Changes

- Camera framing pan and resize drags now use the shared pointer-owned lifecycle. Pointer-up commits; pointer-cancel, lost pointer capture, Escape, window blur, and unmount restore the pre-drag project without adding history.
- All light source, target, depth, spot cone, area resize, and point reach drags use the same lifecycle and terminal behavior.
- Camera framing groups and corner handles have accessible names and keyboard focus. Arrow keys pan the framing endpoint or adjust its zoom.
- Added interaction tests for rollback after model updates, pointer ownership, commit behavior, idempotent completion, cancellation paths, and camera keyboard controls.

## Verification

- Tests-first check: new camera and lighting regression tests failed before implementation, including cases where canceled edits persisted and pointer identity was ignored.
- `npm test -- --reporter=dot src/stage/cameraFramingOverlay.test.tsx src/stage/lightingOverlay.test.tsx src/store/projectStoreHistoryActions.test.ts` — 3 files, 32 tests passed.
- `npx tsc --noEmit` — passed.
- `npx eslint src/stage/CameraFramingOverlay.tsx src/stage/LightingOverlay.tsx src/stage/cameraFramingOverlay.test.tsx src/stage/lightingOverlay.test.tsx` — passed.
- `git diff --check` — passed.

## Commit

`fix: roll back canceled camera and light drags`
