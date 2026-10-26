# Advanced 3D Lighting Suite & Procedural MacBook Pro Device Frame Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the full multi-light management hierarchy, 3D on-canvas depth (Z) direct manipulation, timeline light animation blocks, and procedural MacBook Pro device frame, delivering full parity with Raylight's reference architecture.

**Architecture:**
1. **Multi-Light Hierarchy:** Create `SceneLightsList.tsx` for `LightInspector` and `RightSidebar`, supporting enable/disable toggles, inline renaming, duplicating, deleting, and selecting all lights in the shot.
2. **Depth (Z) Axis On-Canvas Drag & Spatial Ground Plane:** Add a dedicated 3D depth drag handle and ground-plane drop-line and shadow ellipse in `LightingOverlay.tsx` with mathematical raycasting in `lightingMath.ts`.
3. **Lighting Animation Keyframing:** Connect `LightAnimationBlock` to `LightInspector` with an "Animate Light" button, and add `LightBlockInspector.tsx` in `RightSidebar` for editing animated keyframe properties.
4. **MacBook Pro Procedural 3D Frame:** Build `MacBookProDeviceFrame.tsx` (screen notch, keyboard base, aluminum body, glass reflection) and route device families (`phone` vs. `laptop`) in `ThreeLayerObject.tsx`.

**Tech Stack:** React 19, Three.js / @react-three/fiber, TypeScript, Tailwind CSS, Lucide icons, Vitest.

## Global Constraints
- Preserve documentation integrity and existing comments.
- Zero TypeScript compiler errors (`npx tsc --noEmit` must pass with 0 errors).
- All 46 existing test suites (275 tests) must remain 100% green.
- Clean code with no dead or conflicting code; follow single responsibility principle.
- Use repository-relative or clickable markdown links.

## Review Focus
1. **Light Selection Synchrony:** Switching lights via canvas badges or the sidebar light list must update `selectedLightId` without race conditions or stale state.
2. **Batch Undo/Redo:** Direct-manipulation of the Z-depth handle must use `startDrag` with `beginDragTransaction` and `commitDragTransaction`.
3. **Depth Clamping:** Light `z` coordinate must strictly clamp between `0.1` and `5.0` (matching world Z scale `0.5` to `25.0`).
4. **Timeline Block Integrity:** Light animation blocks must correctly bind to `targetLightId`, and deleting a light must clean up orphaned light blocks.
5. **Device Frame Sizing:** Laptop frame dimensions must respect `SCREEN_PLANE_Z` and not obscure display media.

---

## Tasks

### Task 1: Multi-Light Hierarchy & Scene Management
**Files:**
- Create: `src/panels/Inspector/sections/SceneLightsList.tsx`
- Modify: `src/panels/Inspector/sections/LightInspector.tsx`
- Modify: `src/panels/Inspector/RightSidebar.tsx`
- Modify: `src/stage/LightingOverlay.tsx`
- Test: `src/panels/Inspector/sections/sceneLightsList.test.tsx`

- [x] **Step 1: Write unit tests in `src/panels/Inspector/sections/sceneLightsList.test.tsx`**
  - Test rendering list of all lights in active shot (Sun Key + Sources).
  - Test toggle enabled/disabled eye button calling `updateShot`.
  - Test duplicate light creating a new light with unique ID.
  - Test delete light removing it and clearing selection if active.
  - Test add light action.
- [x] **Step 2: Implement `SceneLightsList.tsx`**
  - Render compact light items: Icon, Name (inline editable), Eye toggle, Duplicate button, Delete button.
  - Highlight currently selected light.
  - Add "+ Add Light" quick menu.
- [x] **Step 3: Integrate `SceneLightsList` into `LightInspector.tsx` and `RightSidebar.tsx`**
  - Add collapsible "Scene Lights" section at the top of `LightInspector` so switching lights is instant.
  - Add "Scene Lights" section in `ProjectSettingsPanel` when no light is selected.
- [x] **Step 4: Enhance unselected light badges in `LightingOverlay.tsx`**
  - Add tooltip label with light name and hover glow.
- [x] **Step 5: Run tests and verify with `npx vitest run src/panels/Inspector/sections/sceneLightsList.test.tsx`**

---

### Task 2: Depth (Z) Axis Interactive On-Canvas Drag Handles & Ground Plane Spatial Visuals
**Files:**
- Modify: `src/stage/lightingMath.ts`
- Test: `src/stage/lightingMath.test.ts`
- Modify: `src/stage/LightingOverlay.tsx`
- Test: `src/stage/lightingOverlay.test.tsx`

- [x] **Step 1: Write math tests in `src/stage/lightingMath.test.ts`**
  - Test calculating screen-space ground drop point $(X, 0, Z)$ from light position $(X, Y, Z)$.
  - Test delta-Z screen drag calculation mapping vertical delta to clamped Z ($0.1$ to $5.0$).
- [x] **Step 2: Implement ground plane projection and Z-delta helpers in `src/stage/lightingMath.ts`**
  - `calculateLightGroundProjection(pos, cameraPose, frameW, frameH, aspect)`
  - `calculateDepthDeltaFromScreen(deltaScreenY, canvasZoom)`
- [x] **Step 3: Update `LightingOverlay.tsx` with Depth Gizmo & Ground Plane Visualization**
  - For selected light: render vertical dashed drop line from light to ground $(Y=0)$.
  - Render an elliptical shadow ring on ground plane showing spatial footprint.
  - Add a dedicated Depth Handle (or secondary Z-handle) beside the position handle.
  - Wire drag using `startDrag` with Z delta updates and floating `Z: N.Nm` indicator badge.
- [x] **Step 4: Run tests and verify with `npx vitest run src/stage/lightingOverlay.test.tsx src/stage/lightingMath.test.ts`**

---

### Task 3: Lighting Animation & Timeline Keyframing
**Files:**
- Create: `src/panels/Inspector/sections/LightBlockInspector.tsx`
- Modify: `src/panels/Inspector/sections/LightInspector.tsx`
- Modify: `src/panels/Inspector/RightSidebar.tsx`
- Modify: `src/store/useProjectStore.ts`
- Test: `src/panels/Inspector/sections/lightBlockInspector.test.tsx`

- [ ] **Step 1: Write tests in `src/panels/Inspector/sections/lightBlockInspector.test.tsx`**
  - Test adding a light transition block for `selectedLightId`.
  - Test rendering `LightBlockInspector` when `selectedLightBlockId` is set.
  - Test editing `fromIntensity`, `toIntensity`, `fromX/toX`, `fromY/toY`, `fromTemperature/toTemperature`.
- [ ] **Step 2: Add "Animate Light" button in `LightInspector.tsx`**
  - Clicking creates a `LightAnimationBlock` targeting the selected light ID across the current playhead or shot range.
  - Selects the newly created light block.
- [ ] **Step 3: Implement `LightBlockInspector.tsx`**
  - Header with light block name, target light badge, and delete button.
  - Start Time & Duration scrub inputs.
  - From -> To value sliders/scrub inputs for Intensity, Position, Color/Temperature.
  - Easing selector (Spring, Ease Out, Bezier curve).
- [ ] **Step 4: Mount `LightBlockInspector` in `RightSidebar.tsx` when `selectedLightBlockId` is active**
- [ ] **Step 5: Run tests with `npx vitest run src/panels/Inspector/sections/lightBlockInspector.test.tsx`**

---

### Task 4: Procedural MacBook Pro Device Frame & Unified Integration
**Files:**
- Create: `src/stage/webgl/macBookProLayout.ts`
- Create: `src/stage/webgl/MacBookProDeviceFrame.tsx`
- Modify: `src/stage/webgl/ThreeLayerObject.tsx`
- Modify: `src/panels/Inspector/sections/DeviceFrameSection.tsx`
- Test: `src/stage/webgl/macBookProLayout.test.ts`

- [ ] **Step 1: Write layout and geometry tests in `src/stage/webgl/macBookProLayout.test.ts`**
  - Test MacBook Pro 16" screen and chassis bounds, notch cutout coordinates, and keyboard base depth.
- [ ] **Step 2: Implement `macBookProLayout.ts`**
  - Calibrated dimensions: display lid thickness, display notch, keyboard base angle, trackpad, and screen placement.
- [ ] **Step 3: Implement `MacBookProDeviceFrame.tsx`**
  - Procedural Three.js geometry:
    - Display lid with rounded corners and dark bezel with top notch.
    - Keyboard base extruded slab with recessed keyboard well and trackpad outline.
    - Realistic aluminum materials matching finish presets (`space-black`, `silver`).
- [ ] **Step 4: Wire `MacBookProDeviceFrame` into `ThreeLayerObject.tsx`**
  - Check `deviceSpec.family`: if `laptop`, mount `<MacBookProDeviceFrame />`; if `phone`, mount `<PhoneDeviceFrame />`.
- [ ] **Step 5: Update `DeviceFrameSection.tsx` to enable selecting `macbook-pro-16`**
- [ ] **Step 6: Run tests with `npx vitest run src/stage/webgl/macBookProLayout.test.ts`**

---

### Task 5: Full Regression Testing & Validation
- [ ] **Step 1: Run `npx tsc --noEmit` and ensure 0 compiler errors.**
- [ ] **Step 2: Run `npx vitest run` across the entire project and ensure all test suites pass.**
- [ ] **Step 3: Commit all changes with clean commit message.**
