# [S#] F-### <Short name>
Priority: P0 | Depends on: F-.. | Blocks: F-.. | Confidence: high/med/low

## Goal
One sentence, user visible.

## Reference evidence
Screens: S-.. | Controls: C-... | Component: K-.. | Files: 02-evidence/...
Measured values: ...

## Scope
Create/edit: 
Do not touch: 

## Implementation notes
Primitive/library: | Method: | State/data: | ADR: 

## Spec
### Structure
### Styles (token, raw value)
### Behavior (numbered)
1. 
### Timing and motion
### Keyboard and a11y
### Responsive
### Content strings

## States checklist
- [ ] default  - [ ] hover  - [ ] focus-visible  - [ ] active  - [ ] disabled
- [ ] loading  - [ ] error  - [ ] empty  - [ ] selected  (N/A needs a reason)

## Edge cases
## Acceptance tests
- [ ] 
Commands: 
Parity check: `node scripts/dom_inventory.cjs <local> ...` then diff scoped to this component

## Done when
## Out of scope

## Agent prompt (paste as is)
```
You are implementing ONE card in an existing project. Read first: <doc paths>.
Task: <goal>.
Only modify: <files>. Do not modify anything else except to register this component.
Follow the spec exactly. Use tokens, never hardcoded values.
Do not add features, refactor unrelated code, or change other components.
When finished: run <commands>, confirm every item in "Done when", and reply with files changed, checks run and results, and any deviation and why.
If the spec is ambiguous or evidence is missing, stop and ask.
```
