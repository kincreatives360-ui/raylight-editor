# Task 1: Selection geometry helpers

## Status

Implemented `src/stage/selectionGeometry.ts` and its focused tests in `src/stage/selectionGeometry.test.ts`.

The module exports `Point`, `Rect`, `polygonsIntersectRect`, and `unionRects`. Polygon/rectangle intersection checks polygon vertices, rectangle corners, and edge crossings. Point and segment tests include boundary contact, so touching edges or vertices count as intersection. Empty polygons return `false`; an empty rectangle list returns `null`.

## Verification

- Tests-first check: `npm test -- src/stage/selectionGeometry.test.ts` failed because the new helper module did not yet exist.
- Final focused test: `npm test -- src/stage/selectionGeometry.test.ts` — 1 file passed, 6 tests passed.
- Lint: `npx eslint src/stage/selectionGeometry.ts src/stage/selectionGeometry.test.ts` — passed.
- Self-review confirmed inclusive contact handling and that only this task's module, test, and report are included in its commit.

## Commit

`fix: add robust selection geometry`

## Review follow-up: floating-point boundary contact

Added a regression test for a fractional, non-axis-aligned polygon edge touching a rectangle vertex. The test failed before the fix because the computed orientation was a tiny nonzero value.

Replaced exact-zero orientation checks with a sign predicate using a `Number.EPSILON` error bound scaled by determinant-product magnitude and coordinate-subtraction magnitude. Segment bounds use a coordinate-scaled ULP tolerance. This avoids a fixed world-space epsilon while preserving inclusive contact behavior.

- Focused test: `npm test -- src/stage/selectionGeometry.test.ts` — 1 file passed, 7 tests passed.
- Lint: `npx eslint src/stage/selectionGeometry.ts src/stage/selectionGeometry.test.ts` — passed.
