# Remaining component reuse findings

Goal: address findings 6–25 of docs/audits/component-reuse-audit-2026-10-28.md while preserving appearance, state ownership, event propagation, keyboard behavior, timing constraints, and Three.js disposal. No new dependencies. The first five refactors remain intact.

- [x] 6 Shared light icon mapping.
- [x] 7 One ColorField adapter/API.
- [x] 8 Shared sidebar resize handles.
- [x] 9 Device screen surfaces/resources.
- [x] 10 Device contact shadows/resources.
- [x] 11 Migrate ordinary icon actions to IconButton without changing caller layout.
- [x] 12 Share segmented choices with appearance variants.
- [x] 13 Shared inspector disclosures.
- [x] 14 Shared animation timing fields.
- [x] 15 Shared menu surface/action rows.
- [x] 16 Shared anchored popup infrastructure.
- [x] 17 Shared modal shell.
- [x] 18 Shared search field shell.
- [x] 19 Shared boolean rows and correct mask-toggle semantics.
- [x] 20 Shared timeline range bars/trim handles.
- [x] 21 Shared light row shell.
- [x] 22 Shared timeline drag previews/time badges.
- [x] 23 Shared shortcut keycaps.
- [x] 24 Shared axis fields where a simple contract fits.
- [x] 25 Adopt existing inspector layout primitives where matching layout permits.
- [x] Integrate, review, run full tests/build/lint and browser smoke checks.

Ownership: device-rendering agent owns webgl frame files; timeline/sidebar agent owns App and Timeline TSX; lighting agent owns light inspectors/list/overlay and new shared inspector controls. Parent owns shared primitives and remaining UI callers. No overlapping file edits during delegation.

Verification baseline from first batch: 83 files / 451 tests pass; build passes; lint zero errors with three pre-existing Fast Refresh warnings. Prefer interaction/resource-lifetime checks over tests that mirror JSX. Any deliberate exceptions must name the instance and reason in the final status.

## Completion record

Findings 6–25 are implemented. Verification on 28 October 2026: 90 test files and 489 tests pass; `npm run build` passes; `npm run lint` reports 0 errors and 3 pre-existing Fast Refresh warnings in `SceneEffectsSection.tsx` and `EasingControl.tsx`. `git diff --check` passes. Browser smoke checks covered add-menu keyboard navigation, text inspector fields, font dropdown dismissal, export modal close, sidebar resize, and layer search/clear. Device surface/material and shadow parity was checked structurally across the supported frame variants; GPU pixel comparison and physical pointer-drag checks were not performed.

See `docs/audits/component-reuse-audit-2026-10-28.md` for the source audit and implementation summary.