# 05. Mode A: Codebase Parity

Use when a repo exists and must be brought to parity with the reference.

Contents: repo audit, run it, traceability, gap analysis, fix plan, quality audit.

## 1. Map the repo (read before judging)
- Tree, package manager, scripts, framework and versions, build tool, lint/test setup.
- Entry points, routing, layout shell, global styles, theme/tokens, state stores, data layer (API clients, hooks), types/schemas, utilities, assets, config and env.
- Dependency list: what is installed vs actually imported. Flag duplicates (two date libs), abandoned packages, heavy ones.
- Note the conventions (naming, folder layout, patterns). The plan must follow them unless they are the problem.

## 2. Run it
Install, build, start. Record errors, warnings, broken routes, console errors, missing env. Capture the **same inventories** you captured on the reference (`dom_inventory.cjs` on the local URL). If it will not run, fixing that is card F-000.

## 3. Traceability matrix
For each reference feature/control/component, find where (if anywhere) the repo implements it. Use the live app: React DevTools, source maps in dev, grep by visible text, `data-testid`, class names, event handlers.

`06-parity/traceability.csv`:
```
id, feature, reference behavior, repo files, status, notes
F-014, Align left button, sets text-align on selection, src/components/Toolbar/Align.tsx, partial, no active state, no shortcut
```
Status values: **Missing**, **Stub** (UI only, no logic), **Partial** (works but misses states/edge cases), **Divergent** (works differently), **Matches**, **Extra** (in repo, not in reference; decide keep or remove).

## 4. Gap analysis
For every non-Matches row, write the delta precisely: what the reference does, what the repo does, exact difference in structure, style values, behavior, states, timing. Pull from the diff tooling in `09-parity-verification.md`.

Also audit systemic issues: hardcoded colors and spacing instead of tokens, missing responsive rules, missing a11y, no empty/loading/error states, mocked data, TODOs, dead code, god components, duplicated logic, missing types, no tests, wrong primitives for the pattern, state in the wrong place.

## 5. Fix plan
- Foundation gaps first (tokens, primitives, layout shell, state architecture). Feature fixes on a broken foundation are wasted.
- Group by dependency, then by risk. Refactors required to unblock features become their own cards, with a clear "do not change behavior" rule.
- Each gap becomes one or more **build cards** (see `08-build-cards.md`). Cards for existing code say which files to edit, what to keep, what to replace.
- Prefer small diffs. Do not rewrite working parts to match taste.

## 6. Parity definition per item
An item reaches parity only when: structure matches (DOM role/landmark/order), styles match within tolerance, every state exists, behavior and timing match, keyboard and a11y match, and the interaction replay passes.

## 7. Deliverables for Mode A
Everything in the standard document set, plus:
- `03-docs/REPO-AUDIT.md`
- `06-parity/traceability.csv`
- `06-parity/GAP-ANALYSIS.md`
- Build cards numbered for the fix order, each referencing the matrix row.
