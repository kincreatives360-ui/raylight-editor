# Task 1: Store transaction rollback

## Result

Implemented `cancelDragTransaction(): void`. When a drag snapshot exists, cancellation restores that exact project object and clears the snapshot without changing undo or redo history. With no active transaction, it is a no-op.

The action is exposed by `ProjectStore` and included through the existing `createHistoryActions(set, get)` spread in `useProjectStore`; no additional store initializer change was necessary.

## Files changed

- `src/store/projectStoreHistoryActions.ts` — implemented rollback action.
- `src/store/projectStoreTypes.ts` — added the public store action type.
- `src/store/projectStoreHistoryActions.test.ts` — added rollback-before-change, rollback-after-multiple-updates/history-preservation, and commit/undo coverage.

## TDD evidence

Before implementation, ran:

```text
npm test -- src/store/projectStoreHistoryActions.test.ts
```

Result: 1 test passed and 2 cancellation tests failed because `cancelDragTransaction` was not a function.

After implementation, ran:

```text
npm test -- src/store/projectStoreHistoryActions.test.ts src/store/projectAudioMute.test.ts src/store/cameraBlockCreation.test.ts
```

Result: 3 test files passed, 6 tests passed.

## Validation

- `npx eslint src/store/projectStoreHistoryActions.ts src/store/projectStoreTypes.ts src/store/projectStoreHistoryActions.test.ts` — passed.
- `npm run build` — passed. Vite reported its existing large-chunk advisory (>500 kB).
- `git diff --check` — passed.

## Self-review

Cancellation only updates `project` and `dragSnapshot`; it does not append history, clear redo history, or recompute validation. Tests assert object-identity restoration and preserve both history arrays, including a populated redo stack. Existing commit behavior remains covered by confirming a multi-update drag produces one undo entry and undo restores the start state.

No behavior outside Task 1 was changed. The build's chunk-size advisory is unrelated to this change.

## Commit

`feat: support canceling drag transactions`
