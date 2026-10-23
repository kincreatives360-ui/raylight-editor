# Device frames milestone 1 implementation plan

**Goal:** Introduce one fixed-proportion phone specification, wire it into the existing stage and controls, and preserve old projects. Stop before milestone 2.

**Spec:** docs/audits/2026-10-23-device-frames.md, milestone 1 only.

**Architecture:** Keep the optional image-layer device setting. New frames use geometryVersion 1 and deviceId iphone-15-pro; their body height follows the existing layer height and their physical proportions come from a shared specification. Legacy settings without geometryVersion retain the old geometry until explicitly upgraded. A separate deviceScale gives Size uniform semantics without repurposing saved scale values.

**Tech stack:** Existing TypeScript, React, Three.js, Zod, Vitest; no new dependency.

## Decisions and constraints

- Work in the current feature branch to preserve and build on its uncommitted implementation; a new worktree would omit that implementation. Do not commit the user's existing changes.
- Apple reference: https://support.apple.com/en-bn/111829 (70.6 × 146.6 × 8.25 mm, 1179 × 2556 display at nominal 460 ppi). Corner profiles and small hardware details are approximations pending milestone 3 visual refinement.
- New placement preserves center and uses layer height as total phone height. Toggling retains layer size, crop, asset, transforms, and animations. Canvas aspect changes preserve height-relative placement and phone proportions; horizontal normalized placement follows existing editor behavior.
- New Size is deviceScale, 0.65–2. Existing scale/bezel/depth/corner fields are preserved for legacy layouts, not reused as new uniform scale.
- An explicit upgrade preserves center and unrotated body height; width intentionally changes to correct proportions. Original legacy fields remain saved. No automatic visual upgrade on project load.
- Normalized layer size is a placement box, not hardware geometry. Fixed frames always resize uniformly; nonuniform evaluated X/Y scale is reduced to a uniform magnitude (geometric mean), with mirror signs preserved.
- Only one fixed model is exposed. Legacy variants remain usable in legacy projects. Unknown device IDs use the supported preset for rendering while retaining their ID in saved data. Future unsupported geometry versions must be rejected, not silently downgraded.
- Do not implement opacity/selection-render changes, display material/reflection improvements, detailed hardware, video frames, or export redesign in this milestone.

## Review focus

Legacy full and partial settings; idempotent load/save; frame enable/disable and undo/redo; square/landscape assets; width-only resizing; nonuniform scale; changing project aspect; unknown IDs and future versions; ordinary media unchanged.

## Tasks

1. [x] Add failing tests for fixed geometry, uniform Size, and legacy invariance. Implement specification and resolved metrics in src/model/deviceFrame.ts plus optional metadata in types.ts.
2. [x] Add failing tests for partial schema compatibility, round trips, explicit upgrades, and undo/redo. Normalize device metadata before project validation and connect inspector enable/upgrade controls. Preserve original fields.
3. [x] Add failing tests for renderer/projection sizing and resize contracts. Feed shared resolved metrics to screen/chassis, use fixed-proportion scale in preview/projection, and constrain resize inputs. Retain the legacy code path.
4. [x] Run focused and full tests, build, changed-file lint, inspect diffs, and request an independent review. Fix verified milestone-1 issues. Attempt runtime validation where available. Record evidence and manual tests, then stop.

## Execution ledger

- Preflight: metrics are shared by stage and projection; schema normalizer imports only model helpers, which import types only, avoiding a schema runtime cycle.
- Baseline from audit: 140 tests and production build passed. Existing uncommitted implementation remains in place.
- User explicitly authorized execution and a stop after this milestone; no further design approval required.

- Tasks 1–4: complete. Watched fixed-geometry, schema, projection, bevel bounds, shrink-saveability, and scale/mirror tests fail before fixes.
- Ruling: final review added legacyHeightCompensation metadata to retain height through nonuniform legacy transforms without rewriting their original values.
- Verification: 166 tests in 30 files pass; build and changed-file ESLint pass; independent re-review found no Important/Critical issues. Browser verified enabling, Size, undo, portrait aspect, reload, and width entry.
- Stop: user checkpoint delivered; milestone 2 has not started. See docs/audits/2026-10-23-device-frames-milestone-1-checkpoint.md.
