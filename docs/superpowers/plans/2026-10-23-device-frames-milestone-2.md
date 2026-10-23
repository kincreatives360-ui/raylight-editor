# Device frames milestone 2 implementation plan

**Goal:** Correct screen fitting/materials and complete-device visibility, fades, and selection bounds; stop before milestone 3.

**Spec:** docs/audits/2026-10-23-device-frames.md, milestone 2; build on milestone 1 checkpoint.

**Architecture:** Reuse the existing WebGL device assembly and timeline evaluation. Share one media drawing function across image and live-frame paths. Framed displays use an unlit, opaque, front-facing display with the saved fill color behind transparent content. Selection affects only editor overlays. During partial fades, render the existing device into a transparent color/depth target, then composite it once at evaluated opacity, preserving scene occlusion and avoiding internal transparency artifacts. Opaque devices keep the direct rendering path. Use shared phone layout/bounds for rendering and projected selection.

**Tech stack:** Existing React, Three.js, R3F, TypeScript and Vitest. No new dependencies.

## Constraints and decisions

- Continue in the current feature checkout, preserving the user's and milestone 1's uncommitted changes; no commits/pushes.
- User approved this milestone and the stop after it. No additional design approval is needed.
- New frames default to Fit. Preserve explicitly saved Stretch/Fill choices and legacy defaults. Transparent media receives an opaque screen fill.
- A device screen does not react to studio lights; chassis and glass retain lighting. Correct reflection UVs as part of screen composition, without a new detailed model/material system.
- Remove the selected-opacity floor and selected-visibility exception from production layer rendering. Keep editing handles independent.
- Partial device fades must not lower each mesh's opacity independently. Isolate/composite the same scene assembly with sampled depth, and restore all renderer/scene state after the pass, including on failure.
- Allocate a render target only during partial fades, resize with the drawing buffer, and release it on exit/unmount. Own new and touched GPU resources by their individual lifetimes.
- Select the physical chassis/button/camera bounds, excluding decorative shadow. Crop handles remain on the display aperture. Camera and ordinary media behavior must remain coherent.
- Normal VideoLayer frame support, detailed hardware/physical shadow redesign, full texture caching/performance tuning, native-resolution export redesign, and milestone 3 visual approval are out of scope. Video-backed image frames must keep Fit/Fill when their live texture redraws.

## Review focus

Selection at zero/intermediate opacity; hidden/group-hidden/in-out timing; transparent PNG fill; crop+Fit/Fill with varying source aspects; video redraw after seek; color/alpha and depth of the isolated pass; multiple fading devices; renderer state restoration; edge/rear selection; saved fit compatibility; unchanged ordinary media.

## Tasks and ledger

1. [x] Add failing tests for common media drawing and new/legacy defaults. Implement the shared fit/crop/fill path, normalized screen/reflection UVs, and unlit display policy.
2. [x] Add failing tests for selection-independent visibility/material policy and isolated render/composite behavior. Implement complete-device fades with depth and reliable resource ownership.
3. [x] Add failing tests for physical bounds at side/rear rotations and crop aperture behavior. Share staging/bounds with the device component and update projection/overlays/hit areas.
4. [x] Run focused/full tests, production build, changed-file lint and independent review; fix verified milestone-2 issues. Verify browser behavior on an isolated project, save screenshots, write checkpoint/manual acceptance tests, then stop.

Baseline: milestone 1 has 166 passing tests and a passing production build. No milestone-2 changes existed at start.
