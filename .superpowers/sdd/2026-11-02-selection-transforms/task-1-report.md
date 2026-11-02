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
