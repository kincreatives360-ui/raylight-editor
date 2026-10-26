# Raylight Editor: dependency setup, full-engine remediation and verification prompt

You are implementing a production-grade repair of this **existing** Raylight Editor repository. Start with the source files in the supplied ZIP. Do not substitute a fresh Vite app, delete features, silently downgrade functionality, or add duplicate UI/engine logic. The ZIP includes targeted fixes for asset persistence, shot graph cloning/splitting, and incremental GIF encoding. These are starting points, not proof that the app is complete.

## Required environment and commands (run in repository root)

Use Node.js 22.12+ or an LTS version compatible with the declared Vite/React toolchain. Prefer the team's pinned Node version where defined. First run:

```bash
node --version
npm --version
npm config get registry
npm install --no-audit --no-fund
npm run build
npm test -- --reporter=verbose
npm run lint
```

The repository's `package.json` already declares runtime dependencies (`react`, `react-dom`, `three`, `@react-three/fiber`, `zustand`, `zod`, `lucide-react`) and build/test dependencies (`typescript`, `vite`, `vitest`, `eslint`, `@types/*`, etc.). Do not add a second state library or render framework. Commit the generated `package-lock.json`, then use `npm ci` for reproducible installs. If installation fails due to network resolution, show the error; do not guess missing dependencies.

**Offline video export implementation may need new packages.** Evaluate maintained, license-compatible container muxers for WebM/MP4, such as `mediabunny`, against the installed browser/codec matrix before adding one. Install only the selected compatible package using `npm install <exact-package>`. Inspect the API of the installed version. Do not paste incompatible WebCodecs samples, invent API imports, claim native MP4 is universal, or use FFmpeg in the browser without sizing and performance analysis.

## Non-negotiable implementation workflow

1. Establish a clean baseline: log git commit, build/test/lint failures and a reproducible editor walkthrough. Maintain `AUDIT_FINDINGS.md` with severity, evidence, exact files/functions, expected/actual behavior and reproduction procedure. Never call an unrun test 'passed'.
2. Enumerate complete imports and usages for each changed export/contract using static search and TypeScript language services. Update every calling file and every test fixture. No compile-time bypasses via `any`, `@ts-ignore` or `// eslint-disable` as a substitute for repair.
3. Build ONE authoritative project document schema, scene evaluator, frame/time contract and asset lifecycle. Use existing modules if suitable. Preserve current UI and existing document compatibility with explicit migrations.
4. Group state mutations into atomic user operations (including dragging, splitting, grouping, duplicating, preset application). Validate reference integrity after editing; undo/redo must reverse one complete user action.
5. Repair shot splitting for every owned entity and every animation type: exactly split intervals, preserve source media offsets, remap graph IDs, and preserve animation continuity. Test frames before and after a neutral split, not just object shapes.
6. Replace wall-clock MediaRecorder frame skipping in `src/engine/exporter.ts` with an offline frame-by-frame pipeline. Seek to frame N, evaluate at absolute frame N, render to pixels, encode with explicit monotonic timestamps, mix audio independently and mux. Never silently skip or duplicate frames. Do not ship a fake deterministic export that still uses wall-clock media capture. Handle codec support, color space, first/last frame, 4K memory, abort/error cleanup and missing audio.
7. For video frames, verify source decoding/seek precision, orientation and pixel metadata. Confirm parity between Canvas2D and WebGL paths or remove unfaithful fallback for features it cannot render, with a user-facing error.
8. For audio, use deterministic offline mixing or equivalent timestamp-controlled rendering, supporting source trim, playback rate, fades, overlapping clips, volume/mute and selected-shot export. Do not swallow audio failures while reporting success.
9. For storage, never delete media due only to an empty in-memory `dataUrl`. Add explicit asset deletion with reference tracking, staged writes, durable save status and corruption recovery. Prevent false 'Saved' indicators. Test tab reload, transaction failure and quota exhaustion.
10. Validate device frames, geometry dimensions, UV mapping, `cover`/`contain`/`stretch` crop, screen orientation, GLB/model loading, material color management, depth and lighting across camera rotations. Preserve media aspect ratio independently of chassis geometry. Dispose Three.js resources.
11. Exhaustively connect every inspector property to the canonical project schema, evaluator, undo history, persistence and export. Preserve established panel layout; add no unnecessary UI or duplicate controls.
12. Complete text, shapes, SVG/vector, media import, presets, effects, camera, lighting, reusable templates and project export/import. For each supported feature, test create/edit/save/reload/export and failure path. Do not mark undocumented or nonfunctional features complete.
13. Detect duplicate modules, dead code, circular dependencies, repeated algorithms, unused assets, costly subscriptions and leaked object URLs/GPU resources. Delete only after verifying references and dynamic registration.
14. Add unit, integration, E2E (Playwright if chosen), golden-frame comparison, audio timing, cross-browser compatibility and stress tests. Add GitHub Actions CI for install/build/lint/test. Use an explicit supported-browser matrix, not assumed portability.
15. Provide **complete replacement files** for all touched paths, a manifest of added/deleted files, migration notes, dependency changes and test output. Split into reviewable commits or phases but do not omit required downstream changes.

## Release acceptance scenarios (all required)

- Import image, video, audio and a font; add multiple 2D/3D layers, masks and groups; animate transforms and camera; save/reload; achieve equivalent rendered frames and sound.
- Duplicate a shot with nested groups, mask links, camera framings and animation blocks; all owned IDs unique, references valid, shared assets still shared.
- Split at arbitrary fractional times: no ghost content, media offset preserved, evaluated output unchanged except explicit transition/cut logic.
- Export 24/30/60 fps and multiple resolutions from the same project; exact frame count and monotonic frame timestamps; identical sampled frame output independent of render speed.
- Slow down frame renderer deliberately by 100ms per frame: duration, frame order and audio alignment stay correct.
- Cancel during decoding, rendering, muxing, saving; no orphan streams, URLs, media or misleading success status.
- Exercise 10+ devices, long timelines, large media and repeated project open/close; profile heap, GPU and UI latency.

## Reporting format

Create `AUDIT_FINDINGS.md`, `CHANGED_FILES.md`, `DEPENDENCIES.md`, `TEST_RESULTS.md`, and the full changed files. Label each requirement **verified**, **implemented but unverified**, or **not implemented**. Do not report 'fully functional' unless every release gate passes with evidence. Prioritize data loss, export correctness, reference integrity and crash bugs over optional polish.
