# 06. Mode B: From Scratch

Use when no codebase exists. The output must let an agent build the whole product from nothing, in a safe order.

Contents: foundation decisions, build order, repo layout, what each stage produces, handoff rules.

## 1. Foundation decisions (written as ADRs before any card)
- Framework and rendering approach (from evidence and target constraints).
- Language (TypeScript by default), package manager, monorepo or single app.
- Styling system and token pipeline.
- Primitive/component library choice (doc 03).
- State management and data fetching approach.
- Backend/data plan (inferred contract, doc 04).
- Testing stack: unit (Vitest), component (Testing Library), e2e (Playwright), visual regression.
- Lint, format, CI, env handling.
- Folder structure and naming conventions.

Suggested layout (adapt):
```
src/
  app/                routes, layouts
  components/ui/      primitives (one folder per component)
  components/<area>/  feature components
  features/<name>/    state, hooks, logic per feature
  lib/                utilities, engines, clients
  styles/             tokens.css, globals.css
  types/
  assets/
tests/e2e/ tests/visual/
```

## 2. Build order (stages)
- **S0 Setup**: repo, tooling, CI, env, scripts.
- **S1 Tokens and global styles**: colors, type, spacing, radius, shadow, z-index, motion, fonts, reset, dark mode if present.
- **S2 Primitives**: every base component (button, input, checkbox, tooltip...) each as its own card, each with all variants and states and a visual test page.
- **S3 Layout shell**: app frame, header, sidebars, panels, responsive behavior, routing, empty page states.
- **S4 Data and state skeleton**: stores, schema, API client with mocks matching the contract, persistence.
- **S5 Features**: each feature and each control as its own card, ordered by dependency (core object first, then editing tools, then secondary).
- **S6 Cross cutting**: keyboard shortcuts, undo/redo wiring, error/empty/loading catalog, toasts, a11y pass.
- **S7 Motion and polish**: transitions, micro-interactions, cursors, scroll behavior.
- **S8 Responsive and edge cases**: every breakpoint, odd inputs, offline.
- **S9 Parity pass**: full diff loop (doc 09), fix, accept or flag deviations.
- **S10 Hardening**: performance budget, a11y audit, security, analytics parity if wanted, deploy.

## 3. Rules that keep the build clean
- Build primitives before features. Features compose primitives and do not restyle them ad hoc.
- A card never edits files outside its stated scope except to register itself (route, export).
- Mock the backend per the API contract first, so the UI is complete before real services.
- Each stage ends with a demo checkpoint: what should be visible and testable.
- Keep a living `CHANGELOG` of cards completed.

## 4. Handoff to the building agent
Provide: `00-INDEX.md`, the docs, the ordered card list, the token file, the asset manifest, and a short `AGENT-BRIEF.md` that says: read docs first, follow the order, one card at a time, run the card's checks, report deviations, never skip states, never invent features.
