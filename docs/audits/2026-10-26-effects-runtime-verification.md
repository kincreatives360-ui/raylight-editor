# Effects runtime verification

Report completed 26 October 2026. Measurements were captured on 25 October 2026 at approximately 02:32 WAT. This report supplements the source audit with actual GPU readbacks, exported-file decoding/playback, and runtime benchmarks. It is not a claim that the effects system passes.

## Environment and method

- Chromium 156 in the in-app browser; Intel UHD Graphics through ANGLE/D3D11; device pixel ratio 1.25.
- Production `ViewportCanvas`, evaluator, Canvas2D renderer, and video exporter imported into an isolated audit page. The user's project was not loaded or saved.
- GPU tests: 640 × 360 CSS viewport, 800 × 450 drawing buffer; compare all 360,000 pixels. A changed pixel means any RGB channel differs by more than 1. RGB mean absolute error includes all three channels; alpha is excluded.
- Solid gray fixtures disable scene lighting and scene effects unless the test explicitly enables them. The layer fixture visibly changes 6.04% of pixels relative to the empty fixture, confirming it is actually rendered.
- Exports: a one-second moving rectangle, 1280 × 720, requested 30 fps; a separate image fixture enables a device frame. Production downloads are observed without replacing the exporter or recorder.
- Reproduce at `http://localhost:3000/docs/audits/effects-runtime.html` with the development server running. Run pixel comparisons, recording controls, benchmarks, and exports using the page buttons.

## Confirmed rendering failures

| Test | Measured result | Interpretation |
| --- | --- | --- |
| Neutral gray, GPU versus Canvas2D | GPU RGB 55; reference RGB 128; mean error 73; 100% of pixels differ | Serious color-output mismatch even with effects disabled. Source tracing points to the composer color-space conversion preceding the final FXAA pass. |
| Exposure 2, GPU versus Canvas2D | GPU RGB 220; reference RGB 128; mean error 92 | Canvas2D fallback omits this grading effect. |
| Layer shadow, GPU on versus off | Zero changed pixels | Shadow has no effect in the GPU layer path. The Canvas2D positive control changes 9.66% of pixels. |
| Layer glow, GPU on versus off | Zero changed pixels | Glow has no effect in the GPU layer path. |
| Layer warp, GPU on versus off | Zero changed pixels | Warp has no visible effect in this fixture. |
| Vignette, GPU versus Canvas2D | Mean RGB error 86.28; 100% of pixels differ | Output parity fails; this comparison includes the existing color-output mismatch and cannot isolate vignette error alone. |
| Grain, identical project/timeline position after additional render frames | 95.19% of pixels change; mean RGB error 19.29 | GPU grain depends on elapsed rendering time, not exclusively on the requested timeline frame. |

These runtime results substantiate selected source findings. Other source-audit findings were not each given their own pixel fixture in this pass.

## Actual exported video playback

Plain MP4 and WebM exports eventually succeeded after recording controls warmed up the browser codecs. Both files decoded at 1280 × 720, showed object movement in decoded samples at 50, 450, and 850 ms, and played through to the `ended` event without a media error.

| Production export | File size | Decoded duration | Playback result |
| --- | --- | --- | --- |
| MP4 / AVC | 7,810 bytes | 1.348 seconds | Played to completion; sampled object centroid moved approximately 320 → 512 → 660 px. |
| WebM / VP9 | 16,695 bytes | 1.463 seconds | Played to completion; sampled object centroid moved approximately 318 → 510 → 682 px. |
| Device-frame MP4 | No completed file | — | Consistently throws a `drawImage` type error. |

The device failure is traced to `getStageWebGLCanvas()` in `src/engine/exporter.ts:69`: `getElementById('raylight-stage-webgl-canvas')` returns the React Three Fiber wrapper **DIV**, not its child canvas. The unchecked type assertion bypasses the fallback selector. Device export then passes that DIV to `drawImage`. Ordinary export instead falls back to Canvas2D because the DIV has no canvas width/height.

Recording reliability did not pass: initial MP4 attempts reported no recorded data, and an initial WebM was only 110 bytes and failed demuxing. These failures occurred in both background and foreground attempts. Subsequent production exports played successfully. Browser controls verified that attached and detached canvases can record playable WebM; a later generic MP4 control also played. The exact cause of intermittent empty recordings remains unresolved.

The audit's asynchronous preview synchronization adds export overhead. The durations above exceed the requested one second, but this fixture alone does not establish the amount of timing drift in the normal editor. Playback quality counters in the raw JSON include seeking as well as playback; they must not be interpreted as a clean playback drop rate. Audio was not tested.

## Performance measurements

Foreground, warmed-up development build. Each case uses 20 warm-up animation frames and 90 measured frame intervals, 200 evaluator calls, and 15 Canvas2D renders at 1920 × 1080 with a one-pixel readback to flush drawing work. Effects-on enables vignette, bloom, color grading, grain, chromatic aberration, and glitch.

| Layers | Scene effects | Preview cadence | Frame interval p95 | Canvas2D median at 1080p | Canvas2D p95 |
| --- | --- | --- | --- | --- | --- |
| 1 | Off | 59.99 fps | 17.0 ms | 0.5 ms | 15.1 ms |
| 1 | On | 60.00 fps | 16.9 ms | 13.3 ms | 19.7 ms |
| 10 | Off | 60.01 fps | 16.8 ms | 1.6 ms | 16.9 ms |
| 10 | On | 59.99 fps | 16.9 ms | 15.3 ms | 20.5 ms |

Evaluator mean time was 0.008–0.016 ms per call; timer quantization limits interpretation of these very small measurements. The GPU preview meets a 60 Hz cadence on these simple fixtures. Canvas2D effects consume much more of the frame budget, with p95 above the 16.7 ms budget for 60 fps. An earlier background pass had large timing outliers; it is preserved separately and is not used as the headline benchmark.

These are end-to-end browser frame intervals and CPU render/readback timings, not isolated GPU timer-query measurements. They do not establish performance for large projects, complex device meshes, video layers, 4K export, other GPUs, or a production build.

## Evidence and status

Evidence directory: `C:/Users/Sam Akinkunmi/.codex/visualizations/2026/10/24/01a17024-1871-7d82-be92-d01663867761/`.

- `effects-runtime-results.json`: combined final pixel results, controls, foreground benchmark, and successful/rejected production exports.
- `effects-runtime-initial.json`: initial pass, including failed exports and background benchmark.
- `effects-runtime-foreground-exports.json`: foreground repeat with the 110-byte invalid WebM.
- `audit-plain-mp4-720p-30fps.mp4` and `audit-plain-webm-720p-30fps.webm`: successful production files, with decoded frame PNGs.
- `neutral-gpu.png`, `neutral-canvas.png`, `graded-gpu.png`, `graded-canvas.png`, and `layer-baseline-gpu.png`: actual pixel evidence.
- `effects-audit-live.png`: audit-page screenshot after the completed checks.

The measured core exporter, Canvas2D renderer, evaluator, defaults, and scene effects pipeline remain unchanged between the original audit base and HEAD `7c98003` inspected when completing this report. The viewport has a separate two-line diff; this report does not imply all intervening device/lighting work was re-audited.

**All three requested verification categories were exercised. They do not all pass.** Fix priorities are the invalid export-canvas selection, GPU color-output mismatch, ignored layer effects, deterministic effect timing, and intermittent recorder output. No production fixes were made as part of this verification request.
