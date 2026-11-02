# Focus Plane Task 2 report

## Delivered

- Added the camera-projected focus sheet and near/far boundary sheets. Stage
  focus depth and range come from `frame.effects.state.depthOfField`.
- Added the bottom side-view depth ruler with focus, camera, and visible-layer
  ticks; it shares the transformed Stage overlay so it follows viewport zoom
  and pan, and reserves clearance above the floating toolbar.
- Added hover linkage between ruler depths, focus/range sheets, and layer
  outlines. The plane and layer feedback fade after inactivity.
- Added keyboard-accessible focus-depth and range handles. Arrow keys adjust
  focus depth or range, and Shift uses a finer step; Stage writes the values
  back to the existing shot effects.
- Added projected layer outlines: `dofBlurPx === 0` marks sharp layers, while
  `totalBlurPx` controls blur outline weight/opacity and its accessible title.
- Kept all sheet surfaces pointer-transparent; pointer interaction is limited
  to the focus/range handles and ruler hover ticks. The focus-center and
  near/far handles support pointer drag as single undoable transactions, with
  Escape/pointer cancellation restoring the prior values. Existing
  click-to-focus mode remains available.

Direct D-modified gestures and rack-focus path editing remain out of scope for
this task, as requested for Tasks 3 and 4.

## Verification

- Added `src/stage/focusPlaneOverlay.test.tsx`; confirmed it failed before the
  implementation, then passed.
- Focus overlay plus existing DOF tests: **45 tests passed**.
- Full suite: **129 files, 770 tests passed**.
- Production build: passed. Vite still reports the repository's existing
  large-chunk warning.
- ESLint: full lint passed with 9 existing unused-disable warnings in
  unrelated files; targeted lint for the changed files passed without
  warnings.
- TypeScript check is not clean: it reports existing repository-wide errors
  involving missing model exports, legacy test types, and validation-result
  narrowing. No diagnostics point to the new Focus Plane components or their
  new Stage props; the reported `Stage.tsx` diagnostic is at an untouched
  pre-existing call site.
- Test output includes existing Three.js CommonJS deprecation and JSDOM
  localStorage warnings.

## Pointer-drag follow-up

- Added pointer-down/move/up tests for focus depth and focus range. The center
  drag changes focus depth from `0.4` to `0.6`; the far-edge drag changes range
  from `0.6` to `0.85`. Both tests include multiple pointer moves, verify one
  undo entry, and confirm Undo restores the original value.
- Added an Escape rollback test confirming the project reference is restored,
  the drag snapshot is cleared, and no undo entry is created.
- RED: `npm test -- src/stage/focusPlaneOverlay.test.tsx` failed both new drag
  tests before pointer handlers existed (2 expected behavior failures).
- GREEN: same command passed **10 tests** after implementation.
- Final Focus Plane/DOF verification:
  `npm test -- src/stage/focusPlaneOverlay.test.tsx src/engine/evaluateEffects.test.ts src/engine/evaluateShot.test.ts src/panels/Inspector/sections/sceneEffectsSection.test.tsx src/stage/webgl/sceneEffectsPipeline.test.ts`
  passed **5 files, 48 tests** after the drag updates use the evaluated focus
  values as their baseline.
- Targeted ESLint on all changed TypeScript files passed with no warnings;
  `git diff --check` passed.
- `npx tsc --noEmit -p tsconfig.app.json --pretty false` remains blocked by
  existing repository-wide diagnostics (exit 2); filtering found **0
  diagnostics** in the focus overlay, ruler, layer feedback, new tests, or
  Stage focus wiring. Test output still includes the existing Three.js CJS
  deprecation warning.
