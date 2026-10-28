# Phase 2: Layer Gradient Authoring Design

**Status:** Implemented and verified; committed in Phase 2 change set.  
**Baseline:** `7430f55` (`fix: align export and arrow shortcut controls`).  
**Source audit:** [`raylight-parity-audit-2026-10-28.md`](raylight-parity-audit-2026-10-28.md), Phase 2 of [`raylight-parity-upgrade-roadmap-2026-10-28.md`](raylight-parity-upgrade-roadmap-2026-10-28.md).

## Intent

Add Angular, Diamond and functional Mesh layer fills while preserving existing Linear/Radial documents and matching the same appearance in the picker, WebGL stage, Canvas2D renderer and exports. Let artists edit layer-gradient direction and Mesh control colors directly, without changing the existing scene-background gradient workflow.

The user selected Angular and Diamond fills with shared rendering and round-trip support, and asked to explore Mesh while keeping it functional.

## Current evidence

- `Fill` in `src/model/types.ts` and `FillSchema` in `src/model/schema.ts` accept only Linear/Radial.
- `src/engine/canvasRenderer.ts:createCanvasFillStyle` supports Linear/Radial and Angular backgrounds. Angular falls back to Linear where `createConicGradient` is unavailable.
- `src/stage/webgl/ThreeLayerObject.tsx` independently paints shape fills and supports only Linear/Radial. This duplicates fill rendering and can drift from Canvas2D.
- `src/stage/webgl/SceneBackground.tsx` uses `createCanvasFillStyle` for a 2048px background texture.
- `src/panels/Inspector/ColorPicker.tsx` uses one stop rail and exposes Linear/Radial only. Its gradient value is also used for preview swatches.
- `src/panels/Inspector/sections/ShapeSection.tsx` passes layer gradients to the picker, but does not wire its gradient-mode callbacks to the stage.
- The stage angle handle in `src/stage/Stage.tsx` edits the resolved scene background, not the selected shape’s fill.
- Layer shape fills are persisted in project JSON through the existing model/schema validation and project I/O paths.

## Design decisions proposed

1. Keep the fill family `{ kind: 'solid' | 'gradient' }`. Extend gradient types to `linear | radial | angular | diamond | mesh`; old omitted `gradientType` remains Linear.
2. Linear, Radial, Angular and Diamond continue to use the existing ordered `GradientStop[]` and `angle` fields. Radial remains centered; Diamond uses a centered, rotated Manhattan-distance field normalized to the corners. Angular uses a centered polar-angle field rotated by `angle`. Stops preserve color, opacity, order, and position.
3. Mesh uses a fixed 3×3 lattice of nine normalized control points. Each point stores `{ x, y, color, opacity }`; defaults put points at the regular 3×3 coordinates and initialize colors from a deterministic interpolation of the current stop list. The user can move each point and edit its color/opacity. The fixed lattice avoids a partially specified arbitrary topology while still supporting a genuinely editable multi-color field.
4. Store Mesh data in an optional `mesh` payload on gradient fills. It is required when `gradientType === 'mesh'`; legacy fills without it remain valid. Switching away from Mesh preserves its payload for undo/reselection; switching into Mesh creates defaults. Validation rejects malformed Mesh payloads and repairs/falls back through the existing import recovery path without discarding the rest of the project.
5. Build one shared layer-gradient painter used by Canvas2D and WebGL texture generation. Linear/Radial keep native CanvasGradient paths. Angular, Diamond, and Mesh use deterministic raster output with a bounded cache keyed by dimensions and normalized gradient data, so export/playback does not recompute identical pixels every frame. The implementation must use a same-origin/offscreen canvas path supported by the app’s browser targets; cache eviction and maximum texture dimensions are explicit.
6. The picker keeps the existing stop rail for Linear/Radial/Angular/Diamond. Mesh mode replaces the stop rail with a 3×3 direct-manipulation preview and a selected-point editor for position, HEX/color and opacity. The Mesh preview must be sampled from the same shared painter as the canvas.
7. Wire gradient mode to the selected shape and render the existing angle handle over that shape for Linear, Angular and Diamond. Drag updates its `angle` through the project store (therefore undoable/autosaved). Radial has no angle handle. Mesh uses its own 3×3 point interaction and does not expose the angle handle.
8. Do not change scene background types/controls in this phase. Existing Angular background behavior remains intact; its current fallback may be routed through the shared angular painter only if the change can preserve current appearance and background handle behavior.
9. Blend-mode placement remains unchanged: this phase does not move or duplicate the layer blend-mode control.

## Goals

- Create, edit, save, reload, import and export each supported layer gradient.
- Match each gradient appearance across the inspector preview, WebGL stage, Canvas2D fallback and exported frame/video.
- Keep existing Linear/Radial project data valid and visually stable.
- Make layer angle and Mesh lattice interactions direct and undoable.
- Bound raster memory/CPU cost and expose no type whose renderer is only a preview approximation.

## Non-goals

- Mesh gradients for project/shot scene backgrounds or shader presets.
- Arbitrary mesh topology or Bézier patch handles in the first Mesh implementation.
- Reworking the solid color picker, blend-mode system, layer opacity, or unrelated inspector styling.
- Changing existing background gradient controls except for safe code reuse that passes regression checks.

## Open implementation choices left to the builder

- Exact cache size/eviction strategy after measuring actual render dimensions and layer counts.
- Edge handling for Mesh interpolation outside the convex hull of the 3×3 control-point positions; proposed behavior is clamp to nearest edge/cell.
- Whether to expose a “Reset mesh points” action in the Mesh editor, provided it is undoable and does not add a second model of the lattice.
- Raster sampling quality and downsampling factor, chosen by pixel-difference and performance measurements.

## Implemented choices and audit notes

- Mesh interpolation uses inverse-distance weighting with power 4 over the nine editable points, with exact control-point sampling at zero distance. Coordinates are clamped by the editor and schema to `[0, 1]`.
- Nonlinear raster textures are capped at 1024×1024 and retained in a 10-entry least-recently-used cache. Linear and radial fills remain native CanvasGradient objects.
- Shape gradients now use the same `createCanvasFillStyle` path in the WebGL texture painter, Canvas2D/export painter, and picker preview. Scene-background picker options remain limited to its existing Linear/Radial/Angular set.
- The layer angle overlay is now targeted at the selected shape's projected center and its pointer updates only that shape's fill. The background editor remains a separate target.
- Automated verification passed 526 tests and production build after implementation. Lint passed with one pre-existing `react-refresh/only-export-components` warning in `src/stage/webgl/SceneEffectsPipeline.tsx:102`.
- Live browser interaction and pixel-difference checks across landscape/square/portrait could not be run because browser use is disabled in this Work environment. The implementation has automated sampler/schema/picker/renderer coverage, but those visual parity checks remain an audit limitation.

## Acceptance criteria

1. Old JSON with no `gradientType` and old Linear/Radial JSON parses, round-trips and renders identically in the stage and exports.
2. Angular and Diamond can be selected and edited; changing stops or angle updates picker, stage and export consistently.
3. Mesh selection creates a valid default 3×3 lattice, editing a control point changes its rendered region, and all nine points survive undo/redo and JSON round-trip.
4. Dragging the layer angle handle updates only that selected shape fill; it does not modify the project/shot background. Background angle editing continues to work as before.
5. Canvas2D and WebGL renders use the same gradient painter and produce pixel-close results on identical fixtures at landscape, square and portrait aspects.
6. Render/export of a static gradient does not regenerate the same raster every frame; cache invalidation responds to gradient data and dimensions, and cache size stays bounded.
7. Invalid, empty, duplicated, or out-of-range Mesh point data is handled predictably without crashing the renderer or losing unrelated project content.

## Required verification

- Schema compatibility and malformed import tests.
- Picker tests for mode selection, stop editing, Mesh point editing, keyboard/numeric controls, and reset behavior if present.
- Shared painter tests for each type, opacity, alpha, stop clamping/order, angle wrap, portrait/landscape dimensions, and cache invalidation/bounds.
- WebGL shape texture and Canvas2D/export integration tests using the same fixtures.
- Store undo/redo and project JSON round-trip tests for every type.
- Manual editor audit: create each gradient; drag layer angle and Mesh points; resize/rotate the shape; change selected layer; close/reopen picker; save/reload; verify no background mutation; inspect the exported still and playback frame.

## Self-review as builder

- All audited gaps map to this design: schema/type, duplicated render paths, picker types, selected-shape angle interaction, Mesh representation, and export/round-trip.
- Legacy omission of `gradientType` is explicitly Linear, so existing projects are not migrated by reinterpretation.
- A 3×3 fixed Mesh is an implementation proposal, not behavior observed in Raylight; if the user expects a different Mesh editor model, revise before coding.
- The cache and raster approach is a proposal that requires profiling; if the existing project target has a reliable GPU path or a more suitable shared painter, revise before implementation rather than compromising cross-renderer parity.
