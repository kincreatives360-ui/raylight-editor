# Effects repairs implementation plan

**Goal:** Repair the source-audit and runtime-verification findings, preserving existing projects and current device/lighting work.

**Architecture:** Keep one GPU scene pipeline for preview and native-resolution capture. Evaluate effects from timeline state; apply scene passes in stored order and encode output once. Keep Canvas2D fallback explicit and functional. Preserve animation source curves when splitting clips.

**Tech stack:** React, Three.js/R3F, TypeScript, Vitest, browser MediaRecorder.

**Spec:** `docs/audits/2026-10-26-effects-runtime-verification.md` plus the initial effects audit in this chat.

## Repair checklist

- [ ] Scene pipeline: output color encoding, deterministic time, ordered passes, bloom threshold, temperature/tint, grain size, ghost, motion blur, edge fade.
- [ ] Remove duplicate Stage CSS/DOM grading, vignette, grain and edge fade.
- [ ] Export: correct canvas selection, exact-size/time capture for PNG/GIF/video, recorder readiness/finalization, invalid-data rejection and cancellation cleanup.
- [ ] Canvas fallback: grading and ordered scene effects, masks and missing layer effects.
- [ ] GPU layers: shadows, glow, blend modes, backdrop blur, glass, warp, sweep/path reveals and animated glow.
- [ ] Evaluation: animated rack focus, aperture direction, bokeh settings, split-curve continuity.
- [ ] Inspector: normalized units and accessible scene-effect controls/order.
- [ ] Confirm earlier resolution, gizmo placement, duplicate crop/HUD and merge fixes remain present.
- [ ] Run focused regressions, TypeScript/build, full tests and review integrated diff.
- [ ] Repeat actual GPU pixels, exported video decoding/playback and benchmark measurements; record outcomes and any remaining limitations.

## Review focus

Transparent colors/edges must survive output encoding and export. Cancelled exports must restore rendering state and produce no download. Old documents with missing/partial effect order must retain enabled effects. Cuts through nonlinear animation must retain the original trajectory. Large capture sizes must respect device limits and fail explicitly rather than silently scaling a low-resolution buffer.
