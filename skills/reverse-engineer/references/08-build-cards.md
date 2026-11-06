# 08. Atomic Build Cards

The build must never be jumbled. Every feature, every control, every state-bearing element is its own card. Nothing is too small.

Contents: atomic rule, granularity examples, ID and file scheme, card template, ordering, agent prompt wrapper, matrix.

## The atomic rule
**One card = one thing a user could name or point at, buildable and testable alone.**
Split a card if it:
- touches unrelated areas ("and" joining two behaviors),
- would take an agent more than one focused session,
- has acceptance checks that cannot be run together,
- contains two controls, two shortcuts, or two screens.

## Granularity examples
| Too coarse | Atomic |
|---|---|
| "Build the toolbar" | Toolbar container shell; Align left button; Align center button; Align right button; Alignment group separator; Bold toggle; Bold shortcut; Toolbar overflow menu; Toolbar responsive collapse |
| "Build the settings page" | Settings route + layout; Theme switch control; Theme persistence; Language select; Notification toggle; Save button + states; Unsaved-changes prompt |
| "Add modals" | Dialog primitive; Dialog overlay animation; Focus trap + return; Esc to close; Confirm-delete dialog; Dialog mobile sheet variant |
| "Style inputs" | Text input default; Input focus ring; Input error state; Input disabled; Input with prefix icon; Input clear button |
Each button gets its own card (markup, all states, handler, tooltip, shortcut, a11y, tests). A shortcut is a separate card from the button it triggers when it has its own rules.

## Lite cards (T2)
In `IMPLEMENTATION.md`, each card is a short block: `### F-### name | depends: ... | files: ...`, then Goal, Spec, Accept (checkboxes), Done when, Not in scope. Evidence is cited by ID, not restated. Same atomic rule applies. Split into a `cards/` folder past about 25 cards. Run `scripts/lint_cards.py` on the file.

## Numbering and files
`05-features/F-###-short-name.md`. Stage prefix in the title: `[S2] F-031 Button / primary`. IDs never reused. Foundations are cards too (tokens, fonts, primitives, layout shell).

## Card template (see `assets/templates/build-card.md`)
Required fields:
1. **ID, title, stage, priority, depends on, blocks**
2. **Goal** (one sentence, user-visible outcome)
3. **Reference evidence**: screens, control IDs, screenshots, measured styles, recordings
4. **Scope**: files to create/edit, files not to touch
5. **Implementation notes**: chosen primitive/library, method, data/state, why (link ADR)
6. **Spec**: structure (markup/anatomy), exact styles per state (use token names plus raw values), behavior step by step, timing and easing, keyboard, a11y (role, name, focus), responsive rules, content strings
7. **States checklist**: default, hover, focus-visible, active, disabled, loading, error, empty, selected (mark N/A with reason)
8. **Edge cases**
9. **Acceptance tests**: observable checks, commands to run, and the parity check (which inventory/diff to run)
10. **Done when** (explicit)
11. **Out of scope** (what this card must not do)
12. **Confidence and unknowns**

## Ordering
1. Build the dependency graph (Mermaid in Build Roadmap). Cards form a DAG; fix cycles by extracting a shared card.
2. Order by stage (S0..S10), then topological order, then risk (hard unknowns early to fail fast).
3. Mark parallel-safe cards (no shared files).
4. First five cards to run are listed in `00-INDEX.md`.

## Agent prompt wrapper
Each card ends with this block so it can be pasted into a coding agent as is:

```
You are implementing ONE card in an existing project. Read these first: <doc paths>.
Task: <goal>.
Only modify: <files>. Do not modify anything else except to register this component (export/route).
Follow the spec below exactly. Use tokens, never hardcoded values.
Do not add features, refactor unrelated code, or change behavior of other components.
When finished: run <commands>, confirm every item in "Done when", and reply with (1) files changed, (2) checks run and results, (3) any deviation from the spec and why.
If the spec is ambiguous or evidence is missing, stop and ask instead of guessing.
```

## feature-matrix.csv columns
`id,stage,name,area,type(component|control|behavior|shortcut|state|foundation),screens,controls,depends_on,priority,status(todo|doing|done|parity),card_file,evidence,confidence`

## Review before handing off
- Every control record (C-###) maps to at least one card.
- Every component spec (K-##) maps to cards for its variants and states.
- No card exceeds one focused session.
- Every card has runnable acceptance checks.
