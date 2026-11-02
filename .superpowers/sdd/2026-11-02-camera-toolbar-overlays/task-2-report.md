# Task 2: Clickable orientation cube

## Implementation

- Replaced the draggable trackball with a CSS 3D orientation cube: six focusable, named face buttons and a keyboard-operable perspective center.
- Face and perspective actions look up their poses from the shared `CAMERA_ANGLE_VIEWS`; `onSetOrientation(orbitDeg, tiltDeg, rollDeg?, zoom?)` remains the action interface.
- Removed trackball-only drag callbacks from `StageCameraHud` and its `Stage` caller.
- Kept the shared quick-view presets and frame action. The menu now has a `min(70vh, 24rem)` maximum height with vertical scrolling, so the 11 combined choices remain reachable on short viewports.

## Validation

- Tests-first: the new orientation test failed against the original trackball and non-scrollable menu markup.
- Passed: `npm test -- --run src/stage/orientationGizmo.test.tsx src/stage/orbitCameraOverlay.test.tsx src/stage/canvasViewOptions.test.ts` (3 files, 11 tests).
- Passed: ESLint on the changed stage components and test.
- Passed: `npx tsc --noEmit`.
- Passed: `npm run build`; Vite reported existing large-chunk size warnings.
- There is no separate `StageCameraHud.test.tsx`; the existing `orbitCameraOverlay.test.tsx` covers camera-mode HUD controls.

## Layout consideration

The shared menu has ten camera presets, plus the optional frame action (11 entries when framing is available). Its bounded height and vertical scrolling keep every entry reachable without forcing the HUD to extend beyond a small viewport.

## Reviewer follow-up (2026-11-02)

### Findings addressed

1. **Perspective center visibility/clicking:** moved the center action out of the transformed cube and made it a separate `z-20` overlay above the six faces. The orientation regression mounts the gizmo, checks that the center is a sibling overlay above the cube, focuses it, activates it, and verifies the shared isometric pose callback.
2. **Active camera quick-view layout:** bounded the Orbit Camera angle menu to `min(70vh, 24rem)` and enabled vertical scrolling with overscroll containment. Both menu tests open their menu in a 320px-high jsdom viewport and verify the layout constraint and that all shared presets (and the orientation menu's frame action) are present/reachable.
3. **Roll display:** deferred as a minor visual-only difference. The cube remains a discrete pose selector and roll remains supported through the existing shared view callback; changing its visual representation is outside this focused reviewer-fix scope.

### Follow-up validation evidence

- `npm test -- --run src/stage/orientationGizmo.test.tsx src/stage/orbitCameraOverlay.test.tsx` — **2 test files passed, 9 tests passed**. Covers center focus/activation and overlay layering, and both menus in a 320px viewport.
- `npx tsc --noEmit` — passed.
- `npx eslint src/stage/OrientationGizmo.tsx src/stage/OrbitCameraOverlay.tsx src/stage/orientationGizmo.test.tsx src/stage/orbitCameraOverlay.test.tsx` — passed.
