# iPhone 15 Pro Visual Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic fixed phone frame with a calibrated, procedurally modelled iPhone 15 Pro that keeps media readable and looks credible from front, side, and rear views.

**Architecture:** Keep the current versioned device dimensions and screen media path. Add one shared `iPhone15ProLayout` module for all calibrated feature placement, then use dedicated procedural geometry/material helpers for hardware that requires depth. `PhoneDeviceFrame` consumes the resolved layout and owns only React/Three assembly and resource lifetime; `phoneLayout` derives editor bounds from the same layout.

**Tech Stack:** React, React Three Fiber, Three.js, TypeScript, Vitest. No new dependencies or external assets.

**Spec:** `docs/superpowers/specs/2026-10-23-iphone-15-pro-visual-model-design.md`

## Global Constraints

- Preserve `geometryVersion: 1`, the existing iPhone 15 Pro body/display dimensions, uniform scaling, media fit/fill, opacity, selection, and export behavior.
- Complete only `deviceId: iphone-15-pro`; generic `iphone` and `iphone-classic` remain unsupported as faithful models.
- Use procedural geometry only. Do not add a network-loaded model, asset license dependency, or native-resolution export redesign.
- Display media remains unlit and opaque; reflections remain controlled hardware/glass highlights and cannot whiten the 0-degree screen view.
- Keep editor selection styling out of scene/export rendering and preserve the current local compositional shadow.
- Work in the existing checkout without reverting earlier milestone or user changes; do not create commits or push branches.

## Review Focus

- 0-degree front view: a black Dynamic Island and glass reflection must not hide or recolour media; Task 3 adds the render-stack check and browser capture.
- ±90-degree and tilted views: side buttons, lens barrels, and the plateau must protrude without exposing front media through the rear; Tasks 2 and 3 test depth and bounds.
- Rear view: all three lens barrels, flash, LiDAR/auxiliary sensor, and Apple mark must be distinct and remain within the physical selection bounds; Tasks 1 and 2 test layout/bounds.
- Existing saved frames: `screenFit`, `screenFillColor`, opacity, and explicit cutout choices must survive without schema migration; Task 3 runs existing compatibility/media tests.
- Two overlapping fading phones: the existing compositor must retain depth ordering after the detailed assembly is introduced; Task 4 exercises the browser acceptance fixture.

---

## File structure

- Create `src/stage/webgl/iphone15ProLayout.ts`: calibrated feature rectangles, radii, depths, material-region positions, and shared local physical bounds.
- Create `src/stage/webgl/iphone15ProLayout.test.ts`: physical placement and ordering invariants independent of renderer details.
- Extend `src/stage/webgl/phoneGeometry.ts`: reusable extruded rounded-panel, camera-barrel, and mark geometry factories.
- Extend `src/stage/webgl/phoneGeometry.test.ts`: topology/depth/bounds tests for those factories.
- Modify `src/stage/webgl/phoneLayout.ts`: consume the shared layout when calculating selection bounds.
- Modify `src/stage/webgl/phoneLayout.test.ts`: prove detail protrusions are included while the shadow is excluded.
- Modify `src/stage/webgl/PhoneDeviceFrame.tsx`: compose the calibrated front, rail, rear glass, camera, sensor, mark, and reflection assemblies with independent resource lifetimes.
- Create `src/stage/webgl/iphone15ProMaterials.ts`: material/texture factories for titanium, rear glass, camera parts, restrained screen reflection, flash, and Apple mark.
- Create `src/stage/webgl/iphone15ProMaterials.test.ts`: material-policy and reflection-alpha tests without a WebGL context.
- Create `docs/audits/2026-10-23-device-frames-milestone-3-checkpoint.md`: capture links and the manual visual acceptance matrix.

### Task 1: Calibrated iPhone 15 Pro layout

**Files:**
- Create: `src/stage/webgl/iphone15ProLayout.ts`
- Create: `src/stage/webgl/iphone15ProLayout.test.ts`
- Modify: `src/stage/webgl/phoneLayout.ts:5-50`
- Modify: `src/stage/webgl/phoneLayout.test.ts:7-46`

**Interfaces:**
- Consumes: `DeviceFrameMetrics`, `DeviceFrameSettings`, and `SCREEN_PLANE_Z`.
- Produces: `getIPhone15ProLayout(metrics, settings): IPhone15ProLayout` and `getIPhone15ProBounds(layout): LocalBounds`.
- Later tasks rely on named layout fields for front stack Z positions, Dynamic Island, button rectangles, camera plateau, lenses, flash, LiDAR, rear mark, and bounds.

- [x] **Step 1: Write failing layout tests**

Add tests that assert the Dynamic Island stays centered in the display top inset, action/volume controls sit on the left rail, the side button sits on the right rail, the camera plateau stays at the rear upper-left, three lenses remain inside it, and physical bounds include every detail but not the shadow.

- [x] **Step 2: Run the new layout test to verify it fails**

Run: `npm test -- iphone15ProLayout.test.ts phoneLayout.test.ts`

Expected: FAIL because `iphone15ProLayout` and its feature/bounds API do not exist.

- [x] **Step 3: Implement `getIPhone15ProLayout` and use it in `getPhoneLocalBounds`**

Express calibrated values as ratios of the fixed body/display metrics. Preserve legacy-frame fallback in `phoneLayout`; fixed iPhone 15 Pro frames use the new shared bounds.

- [x] **Step 4: Run focused layout tests**

Run: `npm test -- iphone15ProLayout.test.ts phoneLayout.test.ts`

Expected: PASS.

### Task 2: Detailed hardware geometry

**Files:**
- Modify: `src/stage/webgl/phoneGeometry.ts:1-79`
- Modify: `src/stage/webgl/phoneGeometry.test.ts:1-35`

**Interfaces:**
- Consumes: `IPhone15ProLayout` feature dimensions from Task 1.
- Produces: `createRoundedPanelGeometry`, `createCameraBarrelGeometry`, and `createAppleMarkGeometry`, each returning disposable Three.js geometry with physical depth.

- [x] **Step 1: Write failing geometry tests**

Assert that a rounded rear panel has the requested X/Y footprint and nonzero Z depth, a camera barrel has a raised ring and recessed glass plane, and the Apple mark geometry is centered and constrained to its supplied rear-mark bounds.

- [x] **Step 2: Run the geometry test to verify it fails**

Run: `npm test -- phoneGeometry.test.ts`

Expected: FAIL because the detailed geometry factories do not exist.

- [x] **Step 3: Implement detailed geometry factories**

Use `ExtrudeGeometry`, `CylinderGeometry`, and `ShapeGeometry` with the dimensions supplied by Task 1. Keep the existing body, bezel, and screen factories unchanged unless their helper extraction is required.

- [x] **Step 4: Run focused geometry tests**

Run: `npm test -- phoneGeometry.test.ts iphone15ProLayout.test.ts`

Expected: PASS.

### Task 3: Material policy and device assembly

**Files:**
- Create: `src/stage/webgl/iphone15ProMaterials.ts`
- Create: `src/stage/webgl/iphone15ProMaterials.test.ts`
- Modify: `src/stage/webgl/PhoneDeviceFrame.tsx:1-270`
- Modify: `src/stage/webgl/ThreeLayerObject.tsx:505-549` only if a stack-order correction is necessary

**Interfaces:**
- Consumes: `IPhone15ProLayout` from Task 1 and detailed geometry factories from Task 2.
- Produces: `createIPhone15ProMaterials(settings)` and a `PhoneDeviceFrame` with named front, rail, rear, camera, sensor, and mark subassemblies.

- [x] **Step 1: Write failing material-policy and assembly tests**

Test that display media stays unlit/opaque under the existing framed-surface policy, reflection alpha is zero or near-zero over most of a head-on display and bounded by the reflection setting, titanium/rear glass/lens materials use distinct metalness/roughness, and the Dynamic Island renders after glass/reflection layers.

- [x] **Step 2: Run the material test to verify it fails**

Run: `npm test -- iphone15ProMaterials.test.ts`

Expected: FAIL because the material factory and calibrated assembly do not exist.

- [x] **Step 3: Implement materials and refactor `PhoneDeviceFrame`**

Replace generic box buttons and flat camera discs with Task 2 geometry. Add separate rear glass, camera plateau, rings, recessed lens glass, flash, LiDAR/auxiliary sensor, Apple mark, calibrated Dynamic Island, and restrained reflection texture. Give every memoized geometry, texture, and material an independent `useDisposable` lifetime.

- [x] **Step 4: Run focused rendering-contract tests**

Run: `npm test -- iphone15ProMaterials.test.ts iphone15ProLayout.test.ts phoneGeometry.test.ts phoneLayout.test.ts mediaSurface.test.ts deviceScenePass.test.ts`

Expected: PASS.

### Task 4: Visual acceptance and regression checkpoint

**Files:**
- Create: `docs/audits/2026-10-23-device-frames-milestone-3-checkpoint.md`
- Create: `docs/audits/milestone-3-*.jpg` acceptance captures

**Interfaces:**
- Consumes: finished renderer, existing local Raylight browser instance, and the M2 media fixture.
- Produces: accepted reference captures and an auditable manual matrix.

- [x] **Step 1: Create the visual acceptance fixture**

Use one framed image with text, saturated colours, a circle, and transparency. Use neutral, bright, and dark backgrounds without changing the device’s physical settings.

- [ ] **Step 2: Capture and inspect approved views**

Capture 0°, 30°, 60°, 90°, 150°, and 180° Y rotations plus positive/negative X tilt, an unselected view, and overlapping/partial-opacity devices. Record front screen clarity, bezel symmetry, island placement, side controls, rear component depth, and selection/export cleanliness in the checkpoint.

- [x] **Step 3: Run the complete automated validation**

Run: `npm test`

Expected: PASS with all test files green.

- [x] **Step 4: Run production validation**

Run: `npm run build`

Expected: successful TypeScript and Vite production build.

- [x] **Step 5: Run changed-file lint and patch validation**

Run: `npx eslint src/stage/webgl/iphone15ProLayout.ts src/stage/webgl/iphone15ProLayout.test.ts src/stage/webgl/iphone15ProMaterials.ts src/stage/webgl/iphone15ProMaterials.test.ts src/stage/webgl/phoneGeometry.ts src/stage/webgl/phoneGeometry.test.ts src/stage/webgl/phoneLayout.ts src/stage/webgl/phoneLayout.test.ts src/stage/webgl/PhoneDeviceFrame.tsx && git diff --check`

Expected: no lint findings and no whitespace errors.

## Self-review

- Spec coverage: Tasks 1-3 implement every detailed front, side, rear, material, bounds, and resource-lifetime requirement; Task 4 covers the mandatory visual acceptance matrix.
- Step scan: each task begins with one failing test, verifies the failure, makes one bounded production change, and verifies green results.
- Type consistency: Task 1 defines the shared layout/bounds contract consumed by Tasks 2 and 3; Task 2 geometry outputs are consumed only by Task 3.
- Review focus: front-screen clarity is tested in Task 3; depth/bounds in Tasks 1-2; saved-frame behavior in Task 3; and overlap/opacity in Task 4.
- Proportion: the plan records interfaces and checks without prescribing component internals or duplicating the implementation.
