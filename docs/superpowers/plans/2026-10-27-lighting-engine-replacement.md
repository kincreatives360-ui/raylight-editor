# Lighting Engine Replacement Plan

> Implementation uses the existing project model and inspector while replacing rendering, shared lighting resolution, Canvas fallback, and export integration.

**Goal:** Replace the current lighting implementation with one consistent, physically based Three.js lighting system that renders on the stage and remains consistent through timeline playback and exports.

**Architecture:** Preserve `LightRig`, `SceneLight`, light-animation blocks, and their existing Figma-style inspector controls. Add a shared resolver for model-to-world values, effective colors/intensities, environment profile and shadow assignment; consume it in the R3F scene, Canvas fallback, timeline evaluator, and export capture. Use Drei Environment/Lightformer for procedural room illumination; use Three.js light semantics for key, directional, point, spot, and rect area emitters.

**Tech Stack:** React 19, React Three Fiber, Three.js, Drei Environment/Lightformer, Zustand model, Vitest.

**Spec:** User request from 2026-10-27 and the referenced lighting design screenshots in `plans/Lighting controls` and `plans/Lighting Animate settings`.

## Global Constraints

- Keep the existing inspector parameters and stored project schema compatible with old projects.
- Keep the existing Figma-style inspector primitives and visual language.
- Reuse shared controls and avoid a parallel control store.
- Ensure lighting changes are reflected in the viewport, timeline evaluation, Canvas fallback and exports.
- Remove obsolete lighting engine code after replacements are wired.

## Review Focus

- Key and source light conversion/temperature values retain correct intensity and colors.
- Area and ambient lights never receive shadow configuration; supported lights get shadows within a bounded budget.
- Room presets produce different lighting/reflection behavior and custom room color/intensity remain editable.
- Animation is deterministic and changes to the animated light properties reach the renderer/export at requested time.
- Export capture never uses a stale playhead frame and remains safe when the WebGL renderer is unavailable.

---

### Task 1: Shared light resolution

**Files:**
- Create `src/engine/lightingSystem.ts` and focused tests.
- Replace imports from `src/engine/lightMath.ts` and delete that obsolete module/tests after migration.

- [x] Define normalized world positions, targets, Kelvin/color composition, effective power, environment profile, type-specific values and bounded shadow plan in a pure resolver.
- [x] Cover all supported source types and compatibility fallbacks with unit tests.
- [x] Migrate callers and remove the old lightMath implementation.

### Task 2: New R3F scene lights and Room environment

**Files:**
- Replace `src/stage/webgl/SceneLighting.tsx` and its rendering tests.
- Update `src/stage/webgl/ViewportCanvas.tsx` and dependencies for procedural Drei environment lighting.

- [x] Rebuild emitters from the normalized config with Three.js classes, proper spot targets/orientation and area-light setup.
- [x] Add procedural Environment/Lightformer room profiles while preserving Room controls.
- [x] Preserve and dispose gizmo geometry correctly; cover construction and configuration with tests.

### Task 3: Timeline and Canvas fallback

**Files:**
- Update `src/engine/evaluateLight.ts` and its tests.
- Update Canvas fallback light rendering in `src/engine/canvasRenderer.ts` and tests.

- [x] Ensure animated light/room values resolve into the same `LightRig` consumed by the new resolver.
- [x] Use resolver outputs in the 2D fallback with projection-aware rendering for all supported source types.
- [x] Retain deterministic, non-mutating evaluation and compatibility with saved animation blocks.

### Task 4: Export capture integration

**Files:**
- Update `src/engine/stageCapture.ts`, `src/stage/webgl/ViewportCanvas.tsx`, `src/engine/exporter.ts` only if needed, and relevant tests.

- [x] Ensure frame capture waits for the requested timeline frame and renderer completion before reading the WebGL canvas.
- [x] Ensure all export formats consume the same evaluated lighting, using the same 2D fallback only when WebGL capture is genuinely unavailable.
- [x] Cover capture availability/fallback behavior.

### Task 5: Integration review

- [x] Run build, focused lighting/timeline/export tests, full test suite, lint, and production build.
- [x] Verify the running browser viewport visually; the starter scene has no shaded 3D object, so material-lighting appearance cannot be visually judged in this project state.
- [x] Search for stale engine symbols and unused code; remove replaced files/imports.
