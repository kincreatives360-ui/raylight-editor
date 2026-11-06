# 04. Feature Technology Selection

Contents: how to decide, method per feature type, special engines, decision format.

## How to decide
Do not pick one stack and force every feature into it. For each feature:
1. State the **observed behavior** precisely (inputs, outputs, timing, limits).
2. Note **evidence** of the reference's method (globals, network, file formats, performance feel).
3. List **2 to 3 candidate approaches**.
4. Pick the one that reproduces behavior at parity with the least risk. Tie breakers: fewer dependencies, determinism, testability, performance.
5. Record **risks** and a **fallback**.

Decision format (use in the feature doc and in each build card):
```
Feature: F-042 Auto-looping preview
Observed: loops seamlessly, frame-accurate, scrubbable, same result every run
Candidates: A) requestAnimationFrame + delta time  B) deterministic frame clock driven by integer frame index  C) CSS animation
Pick: B
Why: scrubbing and export need identical frames; delta time drifts
Risks: heavier math per frame; fallback: A with fixed timestep
```

## Method per feature type

**Canvas and scene editors (design, motion, diagram, whiteboard)**
- Scene graph as plain serializable data (JSON), rendering as a pure function of that data.
- Renderer: Canvas 2D for simple 2D, PixiJS for many sprites and filters, Konva/Fabric for object-oriented 2D with built-in hit testing and transforms, Three.js for 3D, custom WebGL/WebGPU for shaders.
- Selection, transform handles (move, scale, rotate, skew), multi-select, snapping and guides, grouping, z-order, alignment, distribution.
- Undo/redo: command pattern or patch-based history (Immer patches). One user action = one history entry. Coalesce drags.
- Hit testing, cursor changes per handle, keyboard nudging, pan/zoom with wheel and pinch, rulers, grid.
- Text on canvas: measure with `measureText`, shape with a layout library if needed; fonts via `FontFace`; for font tools use opentype.js (parse, edit glyphs, export).

**Timeline and animation**
- Keyframe model: tracks, keyframes, easing (cubic-bezier, spring), interpolation per property type (number, color, vector, path).
- Deterministic frame clock: state = f(frame). Never accumulate state across frames.
- Seamless loops: compute on loop duration, wrap time with modulo, verify first and last frames match.
- Playback controls, scrubbing, work area, markers, snapping to frames.

**Export pipelines**
- Image: canvas `toBlob`, OffscreenCanvas, SVG serialization.
- Video: WebCodecs (`VideoEncoder`) plus a muxer for quality and speed; `MediaRecorder` as the simple fallback; ffmpeg.wasm when many formats are needed (heavy, needs cross-origin isolation for threads).
- GIF: gif.js or gifenc. Lottie/Rive: export the data model, verify in the reference player.
- PDF: pdf-lib or jsPDF; reading with pdf.js. SVG: build DOM and serialize.
- Always run in a worker for long jobs, report progress, allow cancel.

**Persistence and sync**
- Local-first: IndexedDB (Dexie or idb), OPFS for big files, localStorage only for tiny prefs.
- Remote: match the observed backend shape; Postgres + REST/RPC, Firebase, Supabase, Convex are all valid; pick by data model and realtime needs.
- Realtime collaboration: CRDT (Yjs, Automerge) for rich concurrent editing; simple last-write-wins with versioning for forms and settings. Presence via websocket provider.
- Autosave: debounce, dirty flag, conflict handling, offline queue.

**Auth and accounts**
- Clerk, Auth.js, Supabase Auth, Firebase Auth, or custom. Match flows observed (magic link, OAuth providers, password rules, email verification).
- Sessions, roles, workspace/team model, invites.

**Payments and plans**
- Stripe Checkout/Portal for subscriptions; entitlement checks on server and UI. Mirror observed plan limits and upgrade prompts.

**Search and filtering**
- Small data: client side fuzzy (Fuse, FlexSearch). Large: Postgres full text, Typesense, Meilisearch, Algolia. Match ranking and highlighting behavior observed.

**AI features**
- Streaming via SSE or fetch streams; server proxy to hide keys; message list, stop/regenerate, tool/result rendering, token limit handling, error states. Never call model APIs from the client with secrets.

**Forms**
- Schema first (Zod), match validation timing and message copy, disabled/loading states, optimistic UI where observed.

**Files and uploads**
- Presigned URLs or resumable uploads (tus, Uploadthing); previews, progress, limits, type validation, drag and drop zone states.

**Data visualization**
- SVG for under a few thousand marks; Canvas/WebGL beyond. Match axes, tooltips, legends, interactions (brush, zoom).

**Audio/video playback and editing**
- HTMLMediaElement for playback, Web Audio for processing, WaveSurfer for waveforms, WebCodecs for frame access.

**Maps and geo**
- MapLibre/Mapbox, Leaflet; match tiles style, markers, clustering.

**i18n, a11y, PWA**
- i18next or built-in framework i18n. a11y per component map. PWA only if manifest and service worker exist in the reference.

**Browser extensions (MV3)**
- Service worker background, content scripts with shadow DOM UI for style isolation, message passing, `chrome.storage`, minimal permissions. Plasmo or WXT for tooling.

**WordPress / Elementor builds**
- Elementor global colors/fonts from tokens, theme builder templates for header/footer/archive, custom widgets for anything the native set cannot do, ACF/CPT for structured content, minimal plugins, performance (image sizes, caching).

## Special engines checklist
When the reference is canvas, WebGL, WASM, or a custom engine, document:
- Render loop (rAF, fixed step, manual), frame budget, resolution scaling, DPR handling.
- Scene/data model (inferred from exports and behavior).
- Input model (pointer, wheel, keyboard, touch) and coordinate spaces (screen, canvas, world).
- Asset pipeline (fonts, images, video, SVG, Lottie) and loading states.
- Determinism and seeding for random effects.
- Worker/offscreen usage.
- Performance behavior under load (how it degrades).
- Presets and templates data format (these are usually JSON: capture the schema).

## Performance budget
Set per feature: interaction latency (under 100ms), frame rate target (60fps), memory ceiling, bundle size per route, first load. Measure the reference with Performance panel and match or beat it.
