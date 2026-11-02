# Task 2: Marquee polygon intersection

## Result

Marquee selection now uses `polygonsIntersectRect(proj.corners, marqueeRect)` with each layer's actual projected polygon corners. This detects crossings and containment cases missed by the former center-or-corner-in-marquee check.

Existing semantics remain intact: invisible layers are skipped, modifier selection adds to the current selection, small/empty marquees keep their prior deselection behavior, and no lock filtering was introduced.

## Verification

- Added pointer-interaction regression coverage for a marquee crossing a projected polygon without containing its center or vertices. Confirmed this test failed with the old predicate.
- Added checks for additive modifier selection, invisible-layer filtering, and empty-marquee deselection.
- `npm test -- src/stage/useStagePointerInteractions.test.ts src/stage/selectionGeometry.test.ts src/stage/selectionOverlayTransactions.test.tsx src/stage/selectionOverlayGradient.test.tsx` — passed (4 files, 17 tests).
- `npx eslint src/stage/useStagePointerInteractions.ts src/stage/useStagePointerInteractions.test.ts` — passed.
- `git diff --check` — passed.

## Scope and commit

Changed only `src/stage/useStagePointerInteractions.ts`, its focused test, and this report. Commit: `fix: select layers intersecting marquee`.
