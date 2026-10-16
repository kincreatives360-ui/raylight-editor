# Raylight app parity report

**Date:** 16 October 2026  
**Scope:** Current repository implementation and the live Raylight editor page available at `raylight.app/editor/...`.  
**Method:** Read-only inspection of the current source and live editor UI, plus the repository build and lint commands. The live reference was a populated project (Manicule; several Hero Reveal scenes, a music row, and a layer), so observations describe that visible state. This is a product and code audit, not a controlled feature-by-feature usability study.

## Executive summary

This repository is no longer the CSS-only prototype described in the earlier parity audit. It now has a React Three Fiber stage, real scene lighting, camera movement, canvas pan and zoom, keyboard tools, direct image/video import, Figma SVG paste, a scene/timeline view switch, camera and light animation tracks, media clips, and image/GIF/video export paths. The production build passes.

The current biggest gap is **reliability and interaction quality**, not missing breadth. The local editor exposes many controls, but some are incomplete or internally mismatched: live playback makes React recompute the whole evaluated project every frame; project autosave runs on each update and serializes assets to localStorage; the video export path is real-time canvas capture and does not include the app's Three.js render/effects or audio; MP4 can silently become WebM; and some advertised effect/model features do not reach rendering. Timeline interactions also use legacy mouse events and can shift scene timing unexpectedly.

The live Raylight UI looks more product-cohesive and keeps structure clear: the left File tree shows scenes and child layers, Assets is separate, the canvas toolbar floats at the stage edge, transport and zoom sit directly above the timeline, and the timeline presents a single time ruler with media and scene rows. The local app has the deeper modeling/inspector surface and explicit scene mode; the live screenshot alone cannot establish feature depth or engine fidelity.

## Evidence and verification

- `npm run build`: **passes** on this checkout. Vite reports a minified JavaScript bundle of **1,717.08 kB** (505.52 kB gzip), above its 500 kB warning threshold.
- `npm run lint`: **fails** with **7 errors and 45 warnings**. Errors include React hook/ref purity violations in `SelectionOverlay.tsx` and mutation of the R3F camera object in `ViewportCamera.tsx`. The full lint output was inspected during this audit.
- Live editor screenshot/AX snapshot: project menu, Insert/File/Assets/Search controls, hierarchical File tree, canvas tools (select, animate, shape, text, pen, frame and light), video/sound modes, timeline zoom/playhead, media row, scene row, project inspector, share/export controls and collaboration indicator were visible.
- Inspected source areas: `App.tsx`, project/selection/playhead stores, schema/types, stage and R3F renderer, evaluator/effects, timeline and track components, browser storage and exporter.

## Parity snapshot

| Area | Local implementation | Live Raylight observation | Assessment |
|---|---|---|---|
| Workspace | Three.js canvas, pan/zoom, selection overlay, context menu, drag/drop, toolbar | Center canvas, floating toolbar, scene content, visible video/sound modes | Local has broad tool coverage; validate direct manipulation and presentation polish against real tasks |
| File organization | Separate panels/tabs for layers/shots/assets and timeline-linked layer tracks | File tree with scene rows and nested layer rows; separate Assets tab and search | Live hierarchy is easier to scan in the visible project; consider unifying local scene/layer navigation |
| Timeline | Whole-video sequential scene clips and scene-focused layer/camera/light rows; resizable, zoomable, media row | Visible shared ruler, media/music row, scene clips, transport, zoom | Local has useful editing depth; scene timing, clip selection, trimming semantics and mouse robustness need attention |
| Animation | In/out presets, property blocks, easing, camera/light/focus tracks, animate recording mode | Animate tool visible; exact behavior not exercised | Strong local data model; editing model is spread across inspector tabs and timeline modes |
| Rendering | R3F/WebGL scene, camera, lights, geometry/textures and per-layer effects | Reference scene visibly rendered in editor | Architectural parity exists; output/export path is not renderer parity and effects are not a full postprocessing chain |
| Audio/video | Audio sync engine; uploaded video currently stored as media clip; no video-texture layer | Video and Sound modes, music clip visible | Local import/track groundwork exists; video playback/compositing and export audio remain major gaps |
| Export | PNG/GIF and MediaRecorder video/WebM/MP4-claimed pipeline with settings/progress/cancel | Export project control visible | Local is beyond a stub, but format/output guarantees and renderer parity are not production-grade |
| Collaboration | No repository implementation observed for live co-editing/presence | Two participants visible, share control visible | Visible reference advantage; requires backend/realtime architecture, not just UI work |
| Code health | Build succeeds; lint fails; large bundle; project validation and serialization in frequent update paths | Not observable in UI | Local engineering cleanup is a first-order quality investment |

## Timeline audit: most important interaction work

### What is already present

- A **whole-video mode** with sequential scene blocks, drag reorder, trim handles, transition cycling, media clips, and add-scene affordance.
- A **scene mode** with layer timing bars, in/out trims, animation blocks, entrance/exit preset pills, camera clips, light clips, add-layer-at-time, and a dimmed step-out area.
- Resizable height, horizontal zoom, play/pause, ruler labels, scroll position, and a separate hover ghost playhead.
- Drag transactions are grouped in undo history for several timeline operations.

### Where it can become smoother and safer

1. **Use Pointer Events and pointer capture.** Several drags attach `mousemove`/`mouseup` listeners to `window`. Touch, pen, pointer cancellation, browser capture loss, and high-frequency movement are fragile. Use pointer events, `setPointerCapture`, and `pointercancel`; make cleanup unconditional.
2. **Separate click-to-select/scrub from drag-to-move.** Layer bars have click and mousedown paths; a drag can also trigger click behavior on release. Add a movement threshold and an explicit scrub-vs-move gesture so accidental time jumps are impossible.
3. **Keep the playhead visible during playback.** The main timeline does not appear to auto-scroll the viewport to follow playback. At the current playhead position, scroll the track region only when the playhead approaches an edge; do not steal vertical scroll from track navigation.
4. **Anchor zoom at the cursor/playhead.** A slider exists, and canvas wheel zoom is available, but timeline zoom should preserve the time under the pointer. Add standard modifier-wheel zoom and shift-wheel horizontal pan, plus Fit Timeline and a clear zoom percentage.
5. **Harden scene reorder and trims.** Scene blocks are draggable and reorder based on a fixed 60 px threshold. Make ordering deterministic under zoom, show a drop indicator, preserve the drag transaction, snap to neighboring edges, and define trim behavior when a scene has downstream clips. Current shot-start recalculation repacks scenes, so trim/reorder should explicitly show ripple behavior and never discard manual positions silently.
6. **Make snapping visible and consistent.** Snap playhead, scene edges, layer in/out, block edges, and markers to frames and each other. Show a guide and delta/timecode tooltip; offer a modifier key to bypass snapping. Avoid the current mixed 10 ms and ~100 ms precision thresholds.
7. **Make every clip keyboard-operable.** Add focusable clip semantics, arrow-key move/trim, Space transport, Delete, split, ripple trim, previous/next scene, Home/End, and cut tool. Show shortcuts in tooltips and a compact help dialog.
8. **Treat media as clips, not a summary lane.** The local media lane has a project-wide mute but weak per-clip controls and no waveform. Add clip labels/thumbnails, waveform, in/out handles, gain, mute/solo, fade handles, snap, and video preview frames. Ensure imported video has an explicit video track/type rather than using the audio shape with `muted: true`.
9. **Improve time ruler precision.** Adaptive ticks should display frames/timecode at high zoom, and ruler click/drag should scrub with frame snapping. Include duration and selected clip start/end in a consistent unit.
10. **Avoid rerendering all tracks during every pointer move.** The project store validates the entire project in each update, including drag updates. Keep transient drag values local or in a lightweight interaction store; commit one validated project transaction at pointer-up. Virtualize long scenes/layer lists and memoize clip rows.
11. **Add clear selection and hierarchy state.** In scene view, keep the clip row aligned to its matching layer tree row, retain scroll offsets when switching levels, and make selected scene/layer/clip state visually distinct without duplicated labels.

### Timeline product recommendation

Keep the two-level timeline: it maps well to the live editor's visible whole-project scene strip while giving the local implementation meaningful per-scene animation depth. Treat scene timings as a deliberate sequence (gapless by default, explicit gaps only if supported) and keep audio/video independent tracks. Preserve the current add and resize affordances, but make clip drag, scrub, trim and zoom semantics consistent and frame-aware.

## Local advantages worth preserving

- Typed project schema with validation/migration, deterministic pure evaluators, easing and animation blocks.
- Reorderable effects model, editable camera and lighting rig, multiple aspect ratios, groups, masks, and layer effects.
- Keyboard tool selection, context menus, marquee selection, snapping, pan/zoom and zoom-to-fit controls.
- Timeline scene mode with camera/light tracks and animation blocks, which is richer than the live screenshot alone can confirm.
- Image and video import, Figma SVG parsing, browser audio playback, project JSON import/export, and export estimates.

These are implementation capabilities, not claims that every combination is polished or fully rendered. Verify each through user workflows before marketing or relying on it.

## Highest-priority findings

### P0 — Export correctness and trust

- **The video export is not deterministic frame encoding.** It waits roughly one frame duration between renders and captures `canvas.captureStream()` with `MediaRecorder`; browser scheduling and encoder behavior control output timing. It can render at real time or slower, but progress is based on frames attempted, not encoded output.
- **MP4 is not guaranteed.** The MIME preference list falls back to `video/webm`, and the output extension follows that MIME. The UI still asks for MP4, which can surprise the user.
- **No audio stream is attached to exported video.** The canvas capture contains video only; the audio engine playback is not mixed into the recorder stream.
- **Export uses `canvasRenderer.ts`, not the interactive R3F stage.** It does not reproduce the Three.js layer composition, camera, scene lighting, shader/material behavior, or viewport rendering. The code's deterministic frame evaluator does not make final pixels equivalent.
- **GIF path buffers every full frame in memory** before encoding, which can exhaust memory for long or large exports. The custom encoder's palette/quality should be checked against gradients, transparency, and animated scenes.
- Errors thrown during export should always reset `exporting`, abort state and progress in a `finally` path; cancellation should stop/close streams and release tracks.

**Recommendation:** explicitly label currently supported formats and resolution constraints; do not report MP4 if the browser generated WebM. For trusted export, build a shared renderer for preview/export (or render through the same WebGL scene), use deterministic timestamps and a real muxer, mix audio, stream/encode incrementally, and exercise cancellation/resource cleanup.

### P0 — Playback and state performance

`App.tsx` advances `currentTimeMs` on every animation frame. It uses that state to recompute `evaluateProjectAtTime(project, currentTimeMs)`, render the main component, synchronize audio, and persist the project because the project effect saves on every project change (less often than time ticks, but every drag update still serializes). This threatens smoothness as projects grow.

**Recommendation:** keep the playback clock in a ref or external clock, update the playhead display at a throttled cadence, and let the renderer consume time imperatively or via a narrowly subscribed store. Debounce persistence, and do not run schema validation/localStorage serialization on transient pointer samples.

### P1 — Autosave/storage limits

`projectIO.ts` writes the entire project JSON to localStorage; imported image/video data URLs are included. This is synchronous, quota-limited storage and the store does load the last saved project, but the save errors are only logged. Large media can silently stop autosaving while the UI suggests the project is saved.

**Recommendation:** move project and binary assets into IndexedDB, debounce writes, retain versioned snapshots, surface saved/saving/error states, and test recovery after interrupted writes. Use object URLs for runtime media instead of copying large base64 strings through React state.

### P1 — Effects and renderer consistency

The evaluator computes ordered effect passes (Bloom, vignette, motion blur, chromatic aberration, film grain, ghost, color grade, edge fade, glitch, depth of field) and the interactive stage uses WebGL, but the visible R3F composition does not contain an ordered postprocessing chain. Layer depth blur is implemented in the layer texture path; this does not establish that the remaining scene effects render. The separate canvas exporter likewise does not use the R3F renderer.

**Recommendation:** either implement ordered postprocessing and matching export rendering or mark effects as preview-only/unsupported where appropriate. Add a per-effect visual acceptance scene so no inspector setting is a no-op.

### P1 — Lint and React correctness

7 lint errors block a clean quality gate. In particular, `SelectionOverlay.tsx` reads camera refs while rendering projected corners and `ViewportCamera.tsx` mutates the camera returned from a hook in an effect, which the current React rules identify as unsafe. Fix by putting camera updates in the R3F frame/imperative integration boundary and deriving overlay camera pose from immutable evaluated props.

### P1 — Bundle and load performance

The production JS bundle is 1.7 MB raw / 505.52 kB gzip and triggers Vite's 500 kB chunk warning. Three.js and editor/export features appear in the initial entry path.

**Recommendation:** split export/GIF encoders, templates, inspector subpanes, and optional importers into lazy chunks; profile first load and interaction on mid-range hardware. Use the warning as a real budget rather than raising the configured threshold without measurement.

## P2 — Product polish and usability

- Replace scattered inspector tabs/accent colors with a smaller Design/Animate model and contextual scene/project panes; keep the powerful existing controls accessible inside those surfaces.
- Unify the scene tree and layer tree into a single File hierarchy. The live page's visible tree avoids switching between separate scene and layer areas.
- Raise small controls and timeline text to readable sizes; the current timeline contains 8–10 px labels. Add stronger contrast, hover/focus states and hit areas for trim handles.
- Reduce visible technical IDs; imported layers/media should have useful names and thumbnails. The reference project itself had an ID-named layer, so this is an opportunity for both products.
- Keep project title, Share and Export as primary chrome; move lower-frequency operations into menus. Make autosave status quiet but truthful.
- Improve empty state with one primary creation/import prompt; avoid visually competing onboarding cards once a project is populated.
- Audit all buttons, tool toggles, timeline clips and slider labels for accessible names, keyboard focus, contrast and screen reader state.
- Add dirty-state recovery, autosave failure messaging, undo history affordance, and clear export error fallback.

## Suggested delivery order

1. Fix the 7 lint errors and make stage camera/overlay update rules sound.
2. Make playback and pointer interactions cheap; use pointer capture, drag thresholds, throttled playhead UI, and validated commits.
3. Correct export claims and implementation: native renderer output, audio, deterministic timestamps, format verification, cancellation and memory limits.
4. Upgrade storage to debounced IndexedDB with visible save status.
5. Finish timeline fundamentals: edge-anchored zoom, follow-playhead, frame snapping, ripple behavior, waveform/media trim and keyboard operations.
6. Complete renderer effect passes and verify inspector-to-pixel behavior.
7. Refine navigation/hierarchy, typography, accessibility and lazy-loaded bundles.
8. Add collaboration only after identifying the required backend/realtime product scope. The live UI shows presence/share, but a screenshot is not enough to define its access, conflict-resolution or persistence behavior.

## Limits

The live reference was inspected in the user's existing browser session. I did not change its project. I did not create or alter a production project, test every interaction, inspect Raylight's private source, or infer backend behavior from visible controls. The assessment of local behavior is source-based except for successful build/lint checks; no end-to-end test suite was run.
