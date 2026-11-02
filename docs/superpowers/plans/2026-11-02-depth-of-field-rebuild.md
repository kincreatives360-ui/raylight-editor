# Depth of Field Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the custom DOF shader and interactive overlay with pmndrs depth-aware rendering, a persistent focus-plane outline, and the approved reference-style controls.

**Architecture:** Keep the existing Three.js `EffectComposer` for all scene effects and insert a pmndrs `EffectPass` at the existing DOF order. Resolve point/subject focus into a camera-relative world point, retain project compatibility, and keep the SVG focus plane outside the WebGL effect pipeline.

**Tech Stack:** React, TypeScript, Three.js 0.186, `postprocessing` 6.39.6, Vitest, Zod.

**Spec:** `docs/superpowers/specs/2026-11-02-depth-of-field-rebuild-design.md`

## Global Constraints

- Use `DepthOfFieldEffect` and `EffectPass` from `pmndrs/postprocessing`; the effect must use the active camera and scene depth texture.
- Preserve existing scene-effect order, output encoding, FXAA, and shared live/export rendering.
- Render DOF on scene pixels only; editor overlays remain sharp.
- Show one passive, unfilled focus-plane polygon at 1.5 px primary stroke while DOF is enabled; never hide it due to inactivity or popover state.
- Preserve old project loading; old DOF animation blocks without a parameter continue to animate focus depth.
- Focus and blur actions create 800 ms ease-in-out blocks at the current playhead; blur animation changes `bokehScale` only.
- Do not discard existing unrelated dirty worktree changes; replace only DOF-specific portions.

## Review Focus

- **Legacy projects without the new target/animation fields:** defaults must preserve point focus and focus-depth animation (Task 1).
- **Camera-tilted point focus on a world-Z plane:** screen-normalized X/Y must resolve through a camera ray, not a screen-space distance approximation (Task 1).
- **Missing or hidden focused subject:** use the last authored point instead of throwing or clearing the saved target (Task 1).
- **Pass insertion/removal and viewport resizing:** keep depth-texture ownership, effect ordering, and resource disposal valid (Task 2).
- **Blur/focus animation overlap and playhead boundaries:** blur blocks must not alter focus and legacy focus blocks must keep their prior behavior (Tasks 1 and 4).

---

### Task 1: Persist focus subjects and animate blur independently

**Files:**
- Modify: `src/model/sceneTypes.ts`
- Modify: `src/model/shotSchemas.ts`
- Modify: `src/engine/evaluateShot.ts`
- Modify: `src/engine/evaluateEffects.ts`
- Modify: `src/engine/index.ts`
- Create: `src/stage/webgl/depthOfFieldTarget.ts`
- Create: `src/stage/webgl/depthOfFieldTarget.test.ts`
- Modify: `src/engine/evaluateShot.test.ts`
- Modify: `src/engine/evaluateEffects.test.ts`

**Interfaces:**
- Produce `resolveDepthOfFieldWorldTarget(camera: THREE.Camera, target: Vec3, subjectPosition?: Vec3): THREE.Vector3`.
- Add optional `focusTargetId?: string` to the depth-of-field settings.
- Add optional `parameter?: 'focus' | 'blur'` to `SceneEffectAnimationBlock`; missing/`focus` preserves the old DOF target-Z handler, while `blur` animates `bokehScale`.

- [ ] **Step 1: Add failing focus-target tests**

Assert that normalized center X/Y intersects the authored world-Z plane at its center, an offset point moves along the projected camera ray, a supplied subject position is returned unchanged, and a camera ray parallel to the plane uses a finite fallback.

- [ ] **Step 2: Run the focused target tests**

Run: `npx vitest run src/stage/webgl/depthOfFieldTarget.test.ts`
Expected: FAIL because the target resolver does not exist.

- [ ] **Step 3: Implement the focus-target resolver**

In `depthOfFieldTarget.ts`, use `Raycaster.setFromCamera` with normalized X/Y and intersect a plane at `target.z`; return the subject center when supplied. Make the parallel-ray fallback finite and deterministic.

- [ ] **Step 4: Add failing model/evaluation tests**

Assert that a legacy effect block without `parameter` still animates `target.z`, a `parameter: 'blur'` block changes only `bokehScale`, and old shot data parses without `focusTargetId` or `parameter`.

- [ ] **Step 5: Extend types, schema, and evaluation**

Add the optional fields and route explicit blur blocks to `bokehScale`; leave focus blocks and legacy DOF effect blocks unchanged. Keep subject IDs optional and preserve the point target as the fallback.

- [ ] **Step 6: Run model and resolver tests**

Run: `npx vitest run src/stage/webgl/depthOfFieldTarget.test.ts src/engine/evaluateShot.test.ts src/engine/evaluateEffects.test.ts`
Expected: PASS.

### Task 2: Replace the custom DOF renderer with pmndrs

**Files:**
- Modify: `package.json`
- Create: `src/stage/webgl/depthOfFieldPass.ts`
- Create: `src/stage/webgl/depthOfFieldPass.test.ts`
- Modify: `src/stage/webgl/SceneEffectsPipeline.tsx`
- Modify: `src/stage/webgl/sceneEffectPasses.ts`
- Modify: `src/stage/webgl/sceneEffectsPipeline.test.ts`
- Modify: `src/engine/evaluateShot.ts`
- Modify: `src/engine/evaluateShot.test.ts`
- Modify: `src/engine/evaluateEffects.ts`
- Modify: `src/engine/evaluateEffects.test.ts`
- Modify: `src/engine/index.ts`
- Modify: `src/stage/webgl/ThreeLayerObject.tsx`
- Modify: `src/stage/webgl/useLayerTexture.ts`
- Modify: `src/stage/webgl/layerEffects.ts`
- Modify: related layer-effect tests under `src/stage/webgl/`

**Interfaces:**
- Produce `createDepthOfFieldPass(camera: THREE.Camera, depthTexture: THREE.DepthTexture): { pass: EffectPass; effect: DepthOfFieldEffect }`.
- Produce `configureDepthOfFieldEffect(effect: DepthOfFieldEffect, dof: Effects['depthOfField'], focusTarget: THREE.Vector3): void`.
- Store scene passes as `Pass` instances so the pmndrs pass can coexist with existing Three.js passes.

- [ ] **Step 1: Add failing pmndrs pass tests**

Assert that the factory creates an `EffectPass` with a `DepthOfFieldEffect`, binds the supplied depth texture, and configures focus target, focus range, aperture-derived bokeh scale, and focal-length scaling.

- [ ] **Step 2: Add `postprocessing` 6.39.6**

Add `postprocessing: ^6.39.6` to `package.json` and install it without generating a new lockfile; this repository currently has no tracked package-manager lockfile.

- [ ] **Step 3: Implement and test the DOF pass adapter**

Initialize the effect with the renderer and current framebuffer precision, set its size with the composer, update target/range/scale from evaluated values, and dispose its effect resources with the pipeline.

- [ ] **Step 4: Integrate the pass at the existing DOF order**

Change the pipeline pass map to `Pass`, create the pmndrs bundle for `depthOfField`, preserve all other ShaderPass creation and order, bind the composer depth texture, and update the focus target when the camera or subject position changes.

- [ ] **Step 5: Remove the bespoke DOF shader and per-layer DOF blur**

Delete the DOF GLSL branch and its custom uniforms from `sceneEffectPasses.ts`. Remove `calculateLayerDofBlurPx`, its evaluated-layer metadata, and the related subtraction from the authored layer-blur path. Retain normal authored/animated layer blur and unrelated texture effects.

- [ ] **Step 6: Update pipeline and layer-blur tests**

Assert DOF insertion/removal preserves pass order, resizing updates the pass, old layer DOF metadata is gone, and authored layer blur remains unchanged.

- [ ] **Step 7: Run focused renderer tests**

Run: `npx vitest run src/stage/webgl/depthOfFieldPass.test.ts src/stage/webgl/sceneEffectsPipeline.test.ts src/stage/webgl/layerEffects.test.ts src/stage/webgl/threeLayerTexture.test.ts src/engine/evaluateShot.test.ts src/engine/evaluateEffects.test.ts`
Expected: PASS.

### Task 3: Replace the overlay and retire DOF canvas gestures

**Files:**
- Modify: `src/stage/DepthOfFieldFocusOverlay.tsx`
- Modify: `src/stage/focusPlaneGeometry.ts`
- Modify: `src/stage/StageInteractionOverlayStack.tsx`
- Modify: `src/stage/Stage.tsx`
- Modify: `src/stage/useStageWheelNavigation.ts`
- Modify: `src/store/useSelectionStore.ts`
- Delete when unused: `src/stage/FocusDepthRuler.tsx`
- Delete when unused: `src/stage/FocusLayerFeedback.tsx`
- Delete when unused: `src/stage/useStageDofFocus.ts`
- Modify: `src/stage/focusPlaneOverlay.test.tsx`
- Modify or delete: `src/stage/focusPlaneGestures.test.tsx`
- Modify: `src/stage/focusPlaneGeometry.test.ts`

**Interfaces:**
- The overlay consumes the enabled DOF state, the resolved focus depth, camera pose, and frame geometry; it produces no pointer or keyboard handlers.
- Reuse `projectFocusPlane` for the single SVG polygon; remove any geometry helper used only by deleted auxiliary visuals.

- [ ] **Step 1: Replace interaction-heavy overlay tests**

Assert that enabled DOF renders exactly one unfilled polygon with a 1.5 px primary stroke and pointer events disabled; assert that disabled DOF renders no focus guide and no ruler/marker/feedback/gesture surface exists.

- [ ] **Step 2: Simplify the overlay to a passive focus plane**

Remove inactivity timers, sheets, feedback, marker, focus-click surface, and drag handles. Keep the polygon visible for the full enabled lifetime, independent of popover state.

- [ ] **Step 3: Remove stage wiring for retired DOF gestures**

Remove `useStageDofFocus`, D-key handlers, pointer-capture handling, and focus-indicator state from Stage and the overlay stack. Preserve the existing focus-block evaluator; the Inspector will be the new focus/animation entry point.

- [ ] **Step 4: Remove obsolete components and tests**

Delete ruler, feedback, and gesture modules only after confirming no other imports remain; retain shared pointer lifecycle helpers used by non-DOF overlays.

- [ ] **Step 5: Run focus-plane tests**

Run: `npx vitest run src/stage/focusPlaneGeometry.test.ts src/stage/focusPlaneOverlay.test.tsx`
Expected: PASS.

### Task 4: Rebuild reference-style DOF controls and animation actions

**Files:**
- Modify: `src/panels/Inspector/sections/SceneEffectsSection.tsx`
- Create: `src/panels/Inspector/sections/dofAnimationActions.ts`
- Create: `src/panels/Inspector/sections/dofAnimationActions.test.ts`
- Create or modify: `src/panels/Inspector/sections/SceneEffectsSection.test.tsx`
- Modify: `src/stage/webgl/ViewportCanvas.tsx`

**Interfaces:**
- Produce `createDofFocusBlock(shot: Shot, currentTimeMs: number, targetZ: number): FocusBlock`.
- Produce `createDofBlurBlock(shot: Shot, currentTimeMs: number, currentBokehScale: number): SceneEffectAnimationBlock`.
- Both constructors use duration `800`, `ease-in-out`, and unique IDs from the existing `generateId` helper.
- Convert global playhead time to clamped shot-local time for block start times. Compute the focus block's start depth from the shot's evaluated DOF state at that local time.

- [x] **Step 1: Add failing animation-action tests**

Assert exact start/end values, 800 ms duration, ease-in-out easing, focus/blur labels, and that the blur action uses `effectKey: 'depthOfField'` with `parameter: 'blur'`.

- [x] **Step 2: Implement the pure action constructors**

Build the focus block from the currently evaluated depth to the selected target depth; build the blur block from zero to the authored `bokehScale`. Do not change aperture, range, or focus in a blur block.

- [x] **Step 3: Add failing Inspector interaction tests**

Assert the DOF panel exposes point/subject focus, target X/Y/depth, aperture, supported spherical bokeh, blur settings, Snap to subject, Animate focus, and Animate blur. Assert each action updates the shot at the current playhead without modifying unrelated effects.

- [x] **Step 4: Rebuild the DOF-specific Inspector controls**

Use the existing Inspector shell and controls. Persist a selected subject ID, resolve visible scene layers by ID, fall back to the authored point when unavailable, and make Snap to subject target the selected layer center. Put focus range and bokeh scale under Blur settings; retain the aperture/f-number control; replace unsupported old bokeh-shape/highlight controls with the supported spherical option.

- [x] **Step 5: Wire animation actions to the playhead**

Read `currentTimeMs` from `usePlayheadStore`, append the generated blocks to the active shot, and keep existing effect ordering and settings state intact.

- [x] **Step 6: Pass the evaluated focus subject to the renderer**

In `ViewportCanvas.tsx`, resolve the selected subject from evaluated layers and pass its center to `SceneEffectsPipeline`; use the authored point when the subject is hidden or missing.

- [x] **Step 7: Run focused Inspector and animation tests**

Run: `npx vitest run src/panels/Inspector/sections/dofAnimationActions.test.ts src/panels/Inspector/sections/sceneEffectsSection.test.tsx src/engine/evaluateShot.test.ts src/stage/webgl/depthOfFieldTarget.test.ts`
Expected: PASS.

### Task 5: End-to-end verification

**Files:** No planned source changes; fix only regressions caused by this rebuild.

- [x] **Step 1: Run the complete test suite**

Run: `npm test`
Expected: all tests pass.

- [x] **Step 2: Run typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no type errors.

Run: `npx eslint <all changed TypeScript/TSX files>`
Expected: no errors or new warnings.

- [x] **Step 3: Run the production build**

Run: `npm run build`
Expected: Vite build completes successfully.

- [x] **Step 4: Visually verify the DOF path**

With DOF enabled, inspect the live stage at a point focus and a subject focus, then resize the viewport and change focus depth. Confirm foreground/background blur is depth-aware, the single focus plane persists after idle/popover close, and selection/camera/lighting overlays remain sharp and interactive.

Browser smoke verification covered an enabled point-focus blur, switching to a visible text subject, snapping the authored point to that subject, and the persistent focus-plane outline. Composer resizing is covered by the automated pipeline tests; viewport resizing was not separately exercised manually.
