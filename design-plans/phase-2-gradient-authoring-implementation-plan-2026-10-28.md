# Phase 2 Gradient Authoring Implementation Plan

> **For agentic workers:** Execute task-by-task with `executing-plans`; every implementation change starts with a failing test.

**Goal:** Deliver editable Linear, Radial, Angular, Diamond and 3×3 Mesh layer gradients with consistent preview, WebGL, Canvas2D and saved-project behavior.

**Architecture:** Extend the layer Fill model and validation, then centralize gradient rasterization/style construction in `canvasRenderer.ts` for both renderers. Extend ColorPicker for type and Mesh editing, and connect selected-shape angle editing to the stage without changing background editing.

**Tech Stack:** TypeScript, React, Zod, Canvas2D, Three.js textures, Vitest.

**Spec:** `design-plans/phase-2-gradient-authoring-design-2026-10-28.md`

## Global Constraints

- Existing linear/radial data and omitted gradient type remain compatible.
- Mesh is a fixed 3×3 lattice with normalized coordinates and per-point color/opacity.
- Scene background controls remain behaviorally unchanged.
- Cache raster gradients with bounded memory and deterministic invalidation.

## Review Focus

- Malformed or missing Mesh data recovers without crashing; schema/import tests cover it.
- Legacy gradients preserve rendering and JSON round-trip; schema and renderer tests cover it.
- Angular/Diamond/Mesh alpha remains correct; shared painter tests cover alpha and dimensions.
- Layer angle edits cannot mutate the scene background; stage/store tests or interaction audit cover it.
- Raster cache remains bounded and distinguishes dimensions/data; painter tests cover eviction/invalidation.

### Task 1: Model and Schema

**Files:** Modify `src/model/types.ts`, `src/model/schema.ts`; test existing model/schema test suites.

- [ ] Write failing cases for Angular/Diamond/Mesh validation, legacy defaults, round-trip, and malformed lattice rejection.
- [ ] Run targeted tests and confirm expected failures.
- [ ] Add gradient type union and typed MeshPoint/MeshGradient payload; require nine finite normalized points for Mesh.
- [ ] Run targeted tests.

### Task 2: Shared Gradient Painter

**Files:** Modify `src/engine/canvasRenderer.ts`; tests in `src/engine/canvasRenderer.test.ts` or focused gradient painter test.

- [ ] Add failing image/pixel assertions for angular, diamond and mesh, opacity and portrait/landscape dimensions, cache invalidation/bounds.
- [ ] Run targeted tests and confirm expected failures.
- [ ] Implement deterministic raster gradient sampling and bounded LRU; retain native linear/radial gradients.
- [ ] Run targeted tests and compare shared output for all layer gradient types.

### Task 3: Renderer Parity

**Files:** Modify `src/stage/webgl/ThreeLayerObject.tsx`; tests in renderer/texture suites.

- [ ] Add failing assertion that WebGL layer fill uses the shared fill-style painter for every type.
- [ ] Run the focused test red.
- [ ] Replace duplicate gradient construction with shared helper.
- [ ] Run renderer and Canvas2D parity tests.

### Task 4: ColorPicker Authoring

**Files:** Modify `src/panels/Inspector/ColorPicker.tsx`, `src/panels/Inspector/sections/ShapeSection.tsx`; test `src/panels/Inspector/colorPicker.test.tsx`.

- [ ] Add failing tests for all fill types and Mesh point selection, drag, numeric edits, color/opacity and reset.
- [ ] Run picker tests red.
- [ ] Add four stop-based fill modes and Mesh 3×3 controls with selected-point editing; preserve mesh data across mode switching.
- [ ] Connect shape gradient type/payload updates and mode-enter/exit callbacks.
- [ ] Run picker and inspector tests.

### Task 5: Selected Shape Angle Interaction

**Files:** Modify `src/stage/Stage.tsx`, selection state as needed, and shape inspector wiring; add focused interaction/store tests.

- [ ] Write failing coverage proving selected-shape angle editing is isolated from background state.
- [ ] Implement an angle overlay bound to the selected shape for Linear/Angular/Diamond, retaining background overlay behavior.
- [ ] Run focused interaction tests and inspect selected layer, radial and mesh cases.

### Task 6: End-to-end audit and verification

**Files:** Update audit/roadmap/design docs with implementation evidence.

- [ ] Verify JSON round-trip and undo/redo for each type.
- [ ] Audit preview, WebGL, Canvas2D/export parity, aspect ratios, switching layers and backgrounds.
- [ ] Run full test suite, build and lint; record existing warnings and any unavailable live UI checks.
- [ ] Review git diff and commit only Phase 2 implementation/docs with a focused message.
