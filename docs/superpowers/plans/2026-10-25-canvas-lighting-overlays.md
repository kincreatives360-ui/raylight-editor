# Canvas Lighting Overlays & Interactive Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement interactive on-canvas overlays and inspector controls for 3D lighting (Spot, Point, Area, Sun/Directional) modeled directly after Raylight, allowing creators to visually adjust light position, aim direction, cone angle, area size, and point reach directly on the stage canvas.

**Architecture:** 
1. Build a high-performance 2D SVG/HTML overlay component `LightingOverlay.tsx` inside the Stage artboard container, projecting 3D light world coordinates onto the 2D stage plane via `evaluateCameraPose`.
2. Add interactive SVG handles for:
   - Source position `(X, Y, Z)`
   - Aim target `(target.x, target.y, target.z)` with dashed direction vector lines
   - Cone angle/penumbra ring handles for Spot lights
   - Corner/edge resize handles for Area lights
   - Radial reach/distance handle for Point lights
3. Wire selection state via `useSelectionStore` (`selectedLightId`, `setSelectedLightId`).
4. Implement dedicated `LightInspector.tsx` in `RightSidebar.tsx` matching Raylight's layout (Type, Position, Aim at, Effect, Color, Cone/Range/Size, Shadows).
5. Add the Light creation/selection dropdown in `CanvasToolbar.tsx`.

**Tech Stack:** React 19, TypeScript, Three.js / @react-three/fiber, Tailwind CSS, Lucide icons, Vitest.

---

## Global Constraints
- Preserve documentation integrity and existing comments.
- Zero TypeScript compiler errors (`npx tsc --noEmit` must pass with 0 errors).
- All 41 existing test suites must remain 100% green.
- All file links formatted as clickable markdown links (`file:///...`).
- Exact Raylight coordinates mapping: World X = `x * 6`, World Y = `y * 6`, World Z = `z * 5`.

---

## Review Focus
1. **Camera transformation changes:** Overlays must stay in lockstep when the camera pans, tilts, zooms, or orbits.
2. **Hit-testing & Drag Transactions:** Dragging on-canvas light handles must not trigger canvas selection marquee or layer drag; drag transactions must batch undo/redo correctly in `useProjectStore`.
3. **Multi-light shot support:** Support selecting and switching between the primary key/sun light and additional source lights (`shot.light.sources`).
4. **Coordinate clamping:** Area width/height and spot cone angle must not invert or produce NaN when dragged past zero.
5. **Deselection:** Clicking on empty canvas space or clicking the `X` button in the Light Inspector must deselect the light and return to the project inspector.

---

## Tasks

### Task 1: Extend Selection Store & Model Types for Light Selection
**Files:**
- Modify: [src/store/useSelectionStore.ts](src/store/useSelectionStore.ts)
- Test: [src/store/lightSelection.test.ts](src/store/lightSelection.test.ts)

- [x] **Step 1: Write unit test for light selection state in `src/store/lightSelection.test.ts`**
- [x] **Step 2: Add `selectedLightId: string | null` and `setSelectedLightId: (id: string | null) => void` to `useSelectionStore`**
- [x] **Step 3: Run `npx vitest run src/store/lightSelection.test.ts` and verify it passes**

---

### Task 2: Build Projection & Raycasting Math Helpers for 3D Lights
**Files:**
- Create: [src/stage/lightingMath.ts](src/stage/lightingMath.ts)
- Test: [src/stage/lightingMath.test.ts](src/stage/lightingMath.test.ts)

- [x] **Step 1: Write tests for projecting light 3D coordinates `(X*6, Y*6, Z*5)` to screen pixels `(sx, sy)` and inverse screen delta to 3D delta**
- [x] **Step 2: Implement `projectLightToScreen(pos, cameraPose, frameW, frameH, aspect)` and `unprojectScreenDeltaToLightDelta` in `src/stage/lightingMath.ts`**
- [x] **Step 3: Run `npx vitest run src/stage/lightingMath.test.ts` and verify it passes**

---

### Task 3: Build the On-Canvas Interactive Overlay (`LightingOverlay.tsx`)
**Files:**
- Create: [src/stage/LightingOverlay.tsx](src/stage/LightingOverlay.tsx)
- Modify: [src/stage/Stage.tsx](src/stage/Stage.tsx)
- Test: [src/stage/lightingOverlay.test.tsx](src/stage/lightingOverlay.test.tsx)

- [x] **Step 1: Write component tests for `LightingOverlay` rendering position gizmo, aim dashed line, target handle, and type-specific handles**
- [x] **Step 2: Implement `LightingOverlay.tsx` with:**
  - Source position icon handle (draggable in X/Y)
  - Amber dashed line connecting to Aim At target handle (draggable)
  - Spot Light: outer cone boundary lines and cone angle handle
  - Area Light: rectangular boundary outline and corner resize handles (width/height)
  - Point Light: radial reach circle and distance handle
- [x] **Step 3: Mount `LightingOverlay` in `Stage.tsx` alongside `SelectionOverlay`**
- [x] **Step 4: Run tests and verify rendering and dragging interactions**

---

### Task 4: Build Dedicated `LightInspector.tsx` in RightSidebar
**Files:**
- Create: [src/panels/Inspector/sections/LightInspector.tsx](src/panels/Inspector/sections/LightInspector.tsx)
- Modify: [src/panels/Inspector/RightSidebar.tsx](src/panels/Inspector/RightSidebar.tsx)
- Test: [src/panels/Inspector/sections/lightInspector.test.tsx](src/panels/Inspector/sections/lightInspector.test.tsx)

- [x] **Step 1: Write test verifying that selecting a light renders the LightInspector with Raylight-matched controls**
- [x] **Step 2: Implement `LightInspector.tsx` with:**
  - Header: Light Type Title + Deselect `X` button
  - Type: Dropdown (`Spot`, `Point`, `Area`, `Sun`)
  - Position: `X`, `Y`, and Depth `Z`
  - Aim at: `X`, `Y`, `Z` (for Spot, Sun, Area)
  - Effect: Intensity (sun icon) + Temperature (thermometer icon in K)
  - Color: Color picker swatch & Hex input
  - Cone (Spot): Angle & Soft
  - Range (Point/Spot): Reach
  - Size (Area): Width & Height
  - Shadows: Cast shadows toggle, Strength %, Soft %
- [x] **Step 3: Render `LightInspector` in `RightSidebar.tsx` whenever `selectedLightId` is non-null**

---

### Task 5: Enhance Bottom Toolbar with Light Tools Menu
**Files:**
- Modify: [src/stage/CanvasToolbar.tsx](src/stage/CanvasToolbar.tsx)
- Test: [src/stage/canvasToolbarLight.test.tsx](src/stage/canvasToolbarLight.test.tsx)

- [x] **Step 1: Add light tools dropdown menu (`Spot`, `Point`, `Area`, `Sun`) to the toolbar lighting button**
- [x] **Step 2: Wire menu item clicks to create/select that light type and activate `selectedLightId`**
- [x] **Step 3: Run test suite and verify toolbar behavior**

---

### Task 6: Full Integration & Visual Polish Validation
- [x] **Step 1: Run `npx tsc --noEmit` and verify 0 compiler errors**
- [x] **Step 2: Run `npx vitest run` across all test files and confirm all pass**
- [x] **Step 3: Verify visual interaction in browser: dragging handles, aiming vectors, resizing cones/areas/spheres**
