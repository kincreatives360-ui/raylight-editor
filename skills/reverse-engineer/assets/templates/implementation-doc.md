# IMPLEMENTATION: <Feature or product part>
Mode: A codebase | B scratch-feature | Tier: T2 | Depth: scan | standard | deep
Reference: <url> | Captured: <date, viewport, theme, auth state> | Repo: <path or none>

## 1. Boundary
Feature = <name>. Root = `<selector>`. Entry = <how a user reaches it>. Ends when = <outcome>.
Depends on (existing, not rebuilt): <tokens, primitives, stores, APIs>

## 2. What it is and what is behind it
| Layer | Finding | Confidence | Evidence |
|---|---|---|---|
| Rendering | | | |
| UI primitives | | | |
| State | | | |
| Data / API | | | |
| Special engine | | | |
Behavior summary (5 to 10 lines, tags [OBSERVED]/[INFERRED]/[ASSUMED]):

## 3. Current repo status (skip if no repo)
| Part | Status (Missing/Stub/Partial/Divergent/Matches) | Files | Gap |
|---|---|---|---|

## 4. Anatomy (nested outline with layout rules)
```
Root (flex col, h-full, ...)
  Part (...)
```

## 5. Controls and states
| ID | Control | Does | States present | Keyboard | Notes |
|---|---|---|---|---|---|

## 6. Style values (only what this feature uses)
| Token or role | Raw value | Used by |
|---|---|---|
Motion: | element | property | duration | easing | trigger |

## 7. Behavior and data flow
Numbered steps from user input to result and persistence. State shape. API calls (method, path, request, response). Undo and persistence rules.

## 8. Technology choices
| Need | Choice | Why | Fallback |
|---|---|---|---|

## 9. Foundation prerequisites (only for a new project)
Tokens used, primitives needed, state shape, routes.

## 10. Build steps (atomic lite cards, in order)
Each card is one control or behavior. Dependencies by ID.

### F-001 <name> | depends: none | files: <list>
Goal: <one line>
Spec: <structure, styles by token+value, behavior steps, states, keys, a11y, copy>
Accept: - [ ] <check>  - [ ] <check>
Done when: <explicit>
Not in scope: <what not to touch>

### F-002 ...

## 11. Agent brief (paste once at the top of the build session)
Read this document. Implement one card at a time in order. Touch only the files named in the card. Use tokens, not hardcoded values. Do not add features or refactor unrelated code. After each card run its checks and report files changed, results, and deviations. If something is ambiguous or missing, stop and ask.

## 12. Parity check
Commands to capture and diff this feature on reference vs build, tolerances, masks.

## 13. Unknowns and accepted deviations
