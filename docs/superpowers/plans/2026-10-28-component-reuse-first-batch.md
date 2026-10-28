# Component reuse: first batch

Goal: address audit findings 1–5 by reusing the material editor and extracting audio clips, transition pills, effect cards, and inline rename inputs. Preserve current visuals, state ownership, timing, event propagation, and save/cancel behavior. No new dependencies.

Reference: docs/audits/component-reuse-audit-2026-10-28.md. The remaining audit findings are outside this first batch.

- [x] Establish baseline tests and inspect existing callers.
- [x] Reuse LayerMaterialSection for text without moving its section.
- [x] Extract AudioClipBar; keep clipping, seeking, and drag calculations in Timeline.
- [x] Extract TransitionPill; keep transition mutations, selection, and drag logic in Timeline.
- [x] Extract LayerEffectCard; preserve native disclosure behavior and remove-button prevention.
- [x] Extract InlineRenameInput for layer/group/shot/light callers; preserve their commit callbacks and cancellation.
- [x] Run complete tests, build, lint, and inspect the final diff. Record any baseline failures.

Validation: existing inspector/timeline tests plus focused interaction checks for extracted callback boundaries. Pure markup extraction does not require new tests that merely mirror component structure. Review clip truncation at shot boundaries, entrance/exit defaults, drag-handle propagation, effect removal, and Enter/Escape/blur renaming.

Results: baseline 82 files / 446 tests passed; final 83 files / 451 tests passed. Production build passed. Lint: zero errors, three warnings in untouched SceneEffectsSection and EasingControl files. Independent read-only review found no actionable issues.

Browser smoke test on the separate 127.0.0.1 origin verified Escape cancellation, Enter/blur rename commits, text material controls, and effect expansion/removal; no browser console errors. The temporary tab was closed. Physical timeline drag gestures and pixel-by-pixel visual comparisons were not performed.

Compatibility detail: the existing exit-curve preview fallback is ease-in while the popup fallback is ease-out; both were preserved rather than changing behavior during extraction.
