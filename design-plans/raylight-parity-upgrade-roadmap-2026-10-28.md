# Raylight Editor Parity Upgrade Roadmap

> Implementation sequence derived from [the 28 October 2026 parity audit](raylight-parity-audit-2026-10-28.md). This is a staged roadmap; each workstream can be planned and reviewed as a separate change set.

**Baseline:** repository revision `99f7bf79c98e179d723ad2f38e7ffd4733e3d2d1`  
**Goal:** Resolve verified interaction defects first, close the highest-impact authoring gaps against Raylight, and establish matched-fixture evidence for the parts of the reference that could not be safely exercised.  
**Design constraints:** Preserve the dark precision-studio identity and documented “Viewport Artifact Primacy”; reuse current owners; keep numeric editing tactile and values stable; avoid adding controls whose product intent has not been confirmed.  
**Scope:** Local editor parity gaps and validation derived from the cited audit. This is not a promise to replicate Raylight’s private services or features whose behavior was not observed.

## Roadmap at a glance

| Phase | Workstream | Priority | Dependency | Exit condition |
| --- | --- | --- | --- | --- |
| 0 | Lock product decisions and create comparable fixtures | Foundation | None | Decisions and fixture matrix are checked in with known local/reference states documented. |
| 1 | Correct Share / export action and shortcut truthfulness | P0 | None | Labels and outcomes agree; no false “Copied!” feedback; toolbar shortcut labels match working key bindings. |
| 2 | Gradient authoring parity | P1 | Phase 0 decision on supported fill types | Fill schema, UI, all renderers, serialization and editing round-trip support the selected types. |
| 3 | Camera viewpoints and authored-camera controls | P1 | Phase 0 confirmation of Pin/Back semantics | Named angles and explicit camera return/pin behavior work and persist as intended. |
| 4 | Canvas tool coverage and discoverability | P2 | Phase 0 decision on Pen/Comment/Frame scope | Every advertised tool has a working implementation or is removed from user-facing help. |
| 5 | Canvas-first layout tuning | P2 | Responsive baseline measurements | Default inspector sizing follows documented viewport priority while resize behavior remains predictable. |
| 6 | Full timeline, rendering, assets and failure-state parity validation | P2 | Phase 0 fixtures; Phases 2–4 for changed behavior | Matched-fixture report covers interactions and recovery states without relying on mismatched projects. |

P0/P1/P2 here mean user-facing severity and dependency order for this roadmap, not a release SLA.

## Phase 0 — Establish decisions and comparison fixtures

**Purpose:** Avoid implementing the wrong reference interpretation and make later parity claims reproducible.

1. Decide whether layer fills must support Angular, Diamond and Mesh gradients, or whether Mesh remains a background/shader-only feature. The audit confirms the reference picker showed these options but did not verify their saved representation or full rendering semantics.
2. Decide whether local Pin and Back to camera should manipulate the current editor camera, an authored camera move, or both. Capture the intended distinction before adding controls.
3. Decide whether Pen, Comment and Frame creation are in the intended product scope. “Frame Selection” is already a separate local camera action; do not conflate it with a creation Frame tool.
4. Phase 1 ruling: retain the existing video-export behavior and rename the duplicate Share action to Export. A real project-share flow is deferred until its contract and reference behavior are established.
5. Build a local parity fixture with: multiple shots; nested groups; rectangle, text and image/device-frame layers; solid and gradient fills; layer and scene effects; animated properties; camera and light blocks; audio/video clips; and transitions. Use synthetic/local media so it is safe to reset and deterministic.
6. Record reference observations and local fixture states for each behavior in a compact matrix, including viewport dimensions, timeline zoom, selected item, active tool, and time/playhead position.

**Exit criteria:** Decisions 1–4 are explicit, fixture can be recreated or reset, and every later comparison names a fixture state rather than comparing unrelated project screenshots.

## Phase 1 — Fix false action feedback and stale tool help (P0)

**Owners:** `src/panels/Inspector/RightSidebar.tsx`, `src/ui/KeyboardShortcutsModal.tsx`, `src/App.tsx` only if action routing changes.

### 1A. Make Share’s label match its behavior

- If Phase 0 selects Export semantics, replace the Share label and “Copied!” toast with Export language and route it to the existing export modal. Remove the copy-success timer/state.
- If Phase 0 selects a real share link, implement a real link-generation/copy path, show “Copied” only after the clipboard write succeeds, and provide actionable failure feedback when clipboard access or link creation fails. Keep video export as a distinct action.
- Preserve current export settings, MP4/GIF/PNG formats, and modal entry points unless a concrete routing bug is discovered.

**Acceptance:** Clicking the labeled action produces the named outcome; clipboard success is never reported without a successful write; export remains independently reachable; keyboard activation behaves like pointer activation.

### 1B. Reconcile advertised shortcuts

- Compare actual key event handlers, toolbar menus and `KeyboardShortcutsModal.tsx`. Pen is implemented as a path-drawing mode bound to `P`; retain its valid shortcut.
- Correct the Arrow menu label from `⇧L` to `A`, matching the keyboard guide and `App.tsx` key handler.
- Add regression coverage for toolbar shortcut metadata.

**Acceptance:** Every visible shortcut performs its described action, toolbar menu shortcuts match actual key handlers, and the help dialog contains no unimplemented advertised tool.

**Verification:** focused UI tests for right-sidebar action routing and keyboard shortcut metadata; manual check of visible labels, modal launch, clipboard success/failure if sharing is implemented, and keyboard/pointer parity.

## Phase 2 — Extend layer gradient authoring end to end (P1)

**Owners:** `src/model/types.ts`, `src/model/schema.ts`, `src/panels/Inspector/ColorPicker.tsx`, `src/panels/Inspector/sections/ShapeSection.tsx`, `src/stage/webgl/ThreeLayerObject.tsx`, `src/engine/canvasRenderer.ts`, any export renderer sharing fill evaluation, import/export serialization and relevant defaults.

### 2A. Preserve current two gradient modes and define the fill contract

- Define supported layer-fill kinds and exact parameter representation for Angular and Diamond. Decide whether Mesh is a finite editable multi-stop mesh, a shader-backed fill, or intentionally unsupported for layer fills.
- Preserve old project compatibility: old `linear` and `radial` values must parse and render identically; omitted `gradientType` retains its existing default.
- Do not map background Angular or background mesh shader data into a layer fill implicitly; these are separate existing workflows.

### 2B. Implement types through every render path

- Extend the shared fill type/schema and validation only after the representation is fixed.
- Update the picker’s type selector and stop/geometry controls to expose only modes the model can faithfully store.
- Update WebGL, Canvas2D fallback and export rendering from the same semantic definition, avoiding UI-only previews that differ from final output.
- Define deterministic behavior for zero/one stop, coincident stop positions, alpha, reverse, rotation, resize/aspect changes and malformed imported values.

### 2C. Implement gradient editing interactions

- Keep draggable stop handles, keyboard/numeric position editing, stop color/opacity, add/remove, reverse/rotate and on-canvas linear angle editing.
- For each new type, specify direct-manipulation handles if meaningful; otherwise keep parameters in the inspector and clearly distinguish that from canvas manipulation.
- Align blend-mode access with the approved product decision. Existing blend control is outside the picker; move/duplicate only if the interaction decision calls for it, ensuring a single source of truth.

**Acceptance:** New gradient values survive save/reload and project JSON round-trip; old linear/radial documents render unchanged; type-specific controls update both preview and final render; undo/redo restores parameters; malformed imported data falls back predictably.

**Verification:** type/schema tests, color-picker interaction tests, renderer parity fixtures for WebGL and Canvas2D/export at common aspects, serialization round-trip tests, pointer and keyboard editing checks.

**Execution update (28 October 2026):** Implemented Angular, Diamond and fixed 3×3 Mesh fills; bounded shared nonlinear raster painter; picker Mesh drag/numeric/color/opacity authoring; selected-shape angle routing; and schema compatibility. Automated verification passed 526 tests, production build, and lint with one unrelated existing warning. Live browser and three-aspect pixel-difference checks remain unverified because browser use is disabled in the current Work environment. See [Phase 2 implementation plan](phase-2-gradient-authoring-implementation-plan-2026-10-28.md) and [approved design](phase-2-gradient-authoring-design-2026-10-28.md).

## Phase 3 — Match camera viewpoint and camera-return workflow (P1)

**Owners:** `src/stage/OrientationGizmo.tsx`, `src/stage/Stage.tsx`, camera model/evaluation modules under `src/engine/` and `src/model/`, `src/ui/KeyboardShortcutsModal.tsx`.

### 3A. Add the seven observed named views

- Add Three-quarter right, Three-quarter left, Profile right, Profile left, Top down, Low angle, and Front as explicit named angle choices, preserving existing Front/Top/Right/Iso quick views if they remain useful.
- Derive each angle from explicit camera pose/framing values with stable orientation and no accidental roll. Add deterministic animation/transition only if consistent with the current camera interaction model.
- Keep the orientation trackball, current angle/readout and Frame Scene/Selection actions.

### 3B. Define Pin and Back to camera semantics

- Based on Phase 0, define whether Pin stores the current viewport pose, locks the camera while other tools are active, or pins an authored camera framing. Label the action to distinguish these meanings.
- Back to camera must restore the relevant authored/evaluated camera framing without resetting unrelated canvas zoom or selected object state; if the local model has no authored camera in the current context, present a clear unavailable state.
- Make camera and canvas zoom distinction visible in control labels/help. Preserve current gesture mappings unless user testing shows a conflict.

### 3C. Reconcile shortcuts

- Ensure Orbit/Scissors labels in toolbar, command menu, shortcuts modal and key handlers agree; provide a regression test for the central binding list.

**Acceptance:** Each named view reaches the intended orientation repeatedly; Pin/back behavior is explicit and reversible; selecting views does not change document content; authored camera moves still evaluate correctly; shortcut help matches actual handlers.

**Verification:** pose unit tests, orientation UI tests, manual orbit/pan/dolly/zoom sequences, authored-camera fixture playback and return behavior, keyboard shortcut parity.

**Execution update (28 October 2026):** Implemented the seven audited angles, in-memory per-shot camera bookmarks with Back restoration, contextual Angle/Pin/Back controls, and Shift+F / Shift+C shortcut alignment. The original reference audit observed the controls and labels but did not exercise Pin/Back semantics; the local behavior is documented in the Phase 3 implementation plan as a reversible bookmark. Full verification passed: 532 tests, production build, and lint with one existing warning in `src/stage/webgl/SceneEffectsPipeline.tsx:102`. Browser interaction could not be run because browser use is disabled in the current Work environment.

## Phase 4 — Decide and close canvas creation-tool gaps (P2)

**Owners:** `src/stage/CanvasToolbar.tsx`, `src/stage/Stage.tsx`, `src/model/types.ts`, selection overlays, command/help surfaces, undo/serialization/renderers according to the selected tools.

**Phase 4 scope decision (28 October 2026):** Keep Pen as a basic closed polygon path tool and expose it. Do not add collaborative Comment until a real identity/thread/backend contract exists; a project-local annotation is a separate product feature. Do not add frame-container creation to the fixed-artboard model; existing Frame Scene/Selection remain camera actions. These two reference tools stay out of the local parity commitment and user-facing tool surfaces.

### 4A. Pen

Pen path drawing already exists and creates polygon path layers with points. If Pen remains in scope, add a discoverable toolbar entry and then audit whether path closure, Bézier handles, node editing, style, undo/redo, serialization, rendering and timeline participation meet the intended product contract. Do not duplicate the existing path model before checking it.

### 4B. Comment

Decide whether comments are document annotations, team collaboration records, or local notes. If collaboration/back-end behavior is not in scope, do not mimic a nonfunctional collaborative Comment tool; instead remove it from parity commitments. If local annotations are chosen, define anchor behavior when layers move/delete and persistence/export semantics.

### 4C. Frame creation

Distinguish a canvas frame/layout object from the existing camera “Frame Scene/Selection” action. Implement only the selected meaning, with a visible object model and resize/content behavior if it is a frame object.

**Acceptance:** Every surfaced creation tool produces an object/action that can be selected, edited, undone, saved and reopened, or it is absent from toolbar/help. Tool names and shortcut labels stay aligned.

**Verification:** tool-creation interaction tests, selection/undo/redo, project serialization round trip, WebGL/Canvas2D visibility, and keyboard command parity for each approved tool.

**Execution update (28 October 2026):** Exposed Pen path creation in the Shape menu and Command Menu; centralized the P shortcut across the toolbar, key handler, command list, and shortcut guide. Lifecycle tests verify polygon points survive project JSON round-trip and undo/redo. Scope decision excludes Comment and frame-container creation for the documented product-model reasons; no such controls are exposed. Full verification passed: 536 tests, production build, and lint with one pre-existing warning in `src/stage/webgl/SceneEffectsPipeline.tsx:102`. Browser pointer verification could not run because browser use is disabled in Work settings.

## Phase 5 — Tune default workspace sizing to canvas-first intent (P2)

**Owners:** `src/App.tsx`, `src/ui/SidebarResizeHandle.tsx`, panel layout styles and existing width persistence logic.

- Measure local and reference panel/stage widths at equal viewport sizes and equivalent visible panels. Audit already observed a local right inspector around 370 px versus reference around 250 px at 1536 px width; treat this as a measurement to re-confirm, not a universal target.
- Establish a responsive default width policy from the documented canvas-first goal and actual inspector content constraints. Avoid adopting a fixed reference pixel value across all viewport sizes.
- Preserve manual resizing, double-click reset, minimum usable control width and user preference persistence if present.
- Check overlap/collapse behavior at narrow, standard and ultrawide widths; test long values, nested sections and open color/easing popovers.

**Acceptance:** The stage gets the intended share of available width at each supported viewport; inspector controls remain usable; resize/reset are predictable and persistent according to current behavior.

**Verification:** side-by-side viewport captures at 1280, 1536 and 1920 widths (or project-supported breakpoints), splitter drag/reset checks, and inspector content stress states.

## Phase 6 — Deep parity validation for timeline, rendering, assets and recovery (P2)

This phase resolves audit uncertainty before adding speculative features. It may spawn separate implementation plans after findings are proven.

### 6A. Timeline interaction matrix

Use the Phase 0 fixture to record and verify shot reorder/trim, scene/video view switch, layer-bar move and in/out trim, snap targets, block drag/trim, transition handles, audio clip move/trim/mute/volume, zoom anchoring, playhead scrubbing, playback and split. Compare equivalent states and durations. Record any reference behavior that remains inaccessible rather than inferring from bar appearance.

### 6B. Rendering and device models

Compare identical solid/gradient shape, text, image/device frame, lighting, shadow and effect states across the WebGL stage, Canvas2D fallback and exports. Cover supported browser/context failure and missing-media fallbacks. Prioritize changes that create a visible state mismatch; do not add model geometry detail just because the reference has it.

### 6C. Assets and audio

Compare categories, search, preview-stop, import/drop, unsupported file feedback, asset reuse, relinking and timeline insertion. Verify whether reference sound/music generation is available and in-scope before treating its absence locally as a gap. Use local fixture assets and avoid external uploads without explicit authorization.

### 6D. Error and recovery states

Exercise WebGL boundary/fallback, stage loading skeleton, autosave warning/error/quota states, undo toast, export cancellation/failure and malformed project import using isolated disposable fixtures. Verify the user can understand the state and recover without losing the active project.

**Acceptance:** Each matrix item has an observed reference result, local result, evidence/confidence, and either a verified gap with owner or an explicit “unknown/not comparable” status. Every verified functional gap receives a separate scoped implementation plan.

**Verification:** deterministic UI fixtures and fault injection in a disposable local project; no destructive scenario is run on the active user project.

## Cross-cutting implementation gates

- Keep current document support backward-compatible; every schema addition needs migration/default behavior and import/export round-trip coverage.
- For visible editor changes, verify the real rendered stage and inspector at supported widths. Accessibility tree presence alone does not prove visual parity.
- Pointer interactions must have a keyboard/direct-value path when applicable; drag controls must expose clear active feedback and not steal gestures from canvas navigation.
- Shared layer appearance changes must be checked in WebGL, Canvas2D fallback and export paths.
- Do not call a surface “complete” based only on source presence. State what was interacted with, what was traced, and what remains unverified.
- Run the repository’s focused checks for each workstream, then relevant broader checks before release; this roadmap itself did not run tests.

## Suggested release slices

1. **Trustworthy controls:** Phase 1 Share/export labeling and shortcut correction.
2. **Authoring parity:** Phase 2 gradient support and Phase 3 camera workflows. They can proceed independently after Phase 0 decisions.
3. **Creation scope:** Phase 4 only after explicit scope decisions; Pen is likely its own feature project.
4. **Workspace polish:** Phase 5 width behavior.
5. **Evidence-led parity:** Phase 6, with new plans for gaps it verifies.

## Explicitly deferred / not established by the audit

- A complete clone of Raylight’s private APIs, account, collaboration and server-backed generation.
- Project template workflows: no local ProjectTemplatesModal was found, but template behavior and product intent were not confirmed.
- Shimmer as a separate effect: no exact local Shimmer section was identified; the reference’s selected Liquid glass label is not enough evidence that these are equivalent.
- Full behavior of reference bars, Share flow, export flow, error screens, small screens, keyboard focus, all hardware models, and every hidden reference state. Phase 6 or a dedicated instrumented session must establish these before implementation is proposed.
