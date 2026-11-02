# Task 1: Shared camera and zoom presets

## Result

Implemented shared camera orientation presets and viewport zoom levels.

`src/stage/cameraAngleViews.ts` now exports one unique `CAMERA_ANGLE_VIEWS`
source containing the six axis-aligned cube poses (front, back, left, right,
top, bottom), the isometric center pose, and the still-distinct three-quarter
and low-angle views. The previous profile and top-down entries duplicated or
approximated the new side/top poses and were removed. The module also exports
`CANVAS_ZOOM_LEVELS: readonly number[]` with the required levels:
`[0.25, 0.5, 0.74, 1, 1.5, 2]`.

The orientation quick-view menu now renders its presets from the shared list,
and orbit-camera zoom options use the shared zoom list instead of another
hardcoded array.

## Tests

Added `src/stage/canvasViewOptions.test.ts` to verify:

- all seven cube/center presets are present at their expected poses;
- preset IDs, labels, and degree-normalized poses are unique;
- the shared zoom levels match the required values.

Updated `src/stage/orientationGizmo.test.tsx` to assert the revised shared
quick-view labels.

Tests-first verification initially failed on the missing back/side/center
presets and missing shared zoom export, as expected. After implementation:

- `npm test -- src/stage/orientationGizmo.test.tsx src/stage/orbitCameraOverlay.test.tsx src/stage/canvasViewOptions.test.ts` — **3 files, 9 tests passed**
- `npx eslint src/stage/cameraAngleViews.ts src/stage/canvasViewOptions.test.ts src/stage/orientationGizmo.test.tsx src/stage/OrientationGizmo.tsx src/stage/OrbitCameraOverlay.tsx` — **passed**
- `git diff --check` — **passed**
- Searched camera-stage sources for the old hardcoded quick-view poses and duplicate zoom array; none remain.

## Concerns

The cube's exact top and bottom poses use ±90° tilt rather than the prior
near-top `-89°` preset, so those views are now truly axis-aligned. Distinct
three-quarter and low-angle presets are retained.
