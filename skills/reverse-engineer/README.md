# Reverse Engineer to Parity

A comprehensive skill and toolkit for reverse engineering any website, web app, browser extension, or software product — and producing the exact artifacts needed to rebuild it to 1-to-1 parity.

## What It Does

This skill turns any reference tool into:
1. **Complete Understanding** — What every element is, what it does, what's behind it (with evidence tags on every claim)
2. **Build Kit** — Sized to the job:
   - **Tier 1 (Full Kit)**: Whole product from scratch → full document set (PRD, TRD, user flows, architecture, specs, contracts) + atomic build cards
   - **Tier 2 (Implementation Doc)**: Single feature or existing codebase → one `IMPLEMENTATION.md` with atomic cards inside
   - **Tier 3 (Quick Answer)**: "What's it built with?" → short answer in chat

## Core Philosophy

- **Use the app, don't just look at it** — Every control gets operated, every state provoked
- **Evidence tags on every claim** — `[OBSERVED]`, `[INFERRED]`, `[ASSUMED]` — never present assumptions as fact
- **Nothing is too small** — A tooltip, a hover color, a focus ring, a 150ms ease — each is tracked
- **Stay legal** — Rebuild behavior/layout/design from observation; no proprietary code, assets, or private data
- **Spend tokens like money** — Scripts write to disk, you read digests, scope before capture

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.8+
- Playwright (`npx playwright install chromium`)

### Environment Check
```bash
node scripts/doctor.js
```

### One-Command Recon (Fingerprint + Inventory + Digest + Tokens + A11y)
```bash
node scripts/recon.js <url> re-<slug> [--root "selector"] [--steps steps.json] [--storage-state auth.json]
```

### Scaffold a Workspace
```bash
# Tier 2 (default) — implementation doc for feature/existing repo
node scripts/scaffold_workspace.js my-app

# Tier 1 — full document set for whole product from scratch
node scripts/scaffold_workspace.js my-app --tier full
```

## Toolkit Scripts

| Script | Purpose |
|--------|---------|
| `recon.js` | One-command: fingerprint → inventory → summarize → tokens → a11y |
| `fingerprint_stack.py` | Detect framework, styling, rendering engine, backend, auth, analytics, hosting |
| `dom_inventory.cjs` | Tear down the DOM div by div, capture every element's role, layout, styles |
| `interaction_sweep.cjs` | Operate every control like a real user, record before/after states, side effects |
| `a11y_walk.cjs` | Accessibility tree, tab order, keyboard map |
| `visual_diff.js` | Multi-viewport screenshots + pixel-perfect diffing |
| `extract_tokens.py` | Design system extraction (colors, type, spacing, motion, shadows, z-index) |
| `har_to_contracts.py` | Convert network HAR to API contract markdown |
| `har_to_msw.py` | Generate MSW handlers from network capture |
| `summarize_inventory.py` | Turn raw inventory JSON into readable digest |
| `diff_inventories.py` | Compare reference vs rebuild inventories |
| `lint_cards.py` | Validate build cards have required fields, no cycles |
| `unpack_extension.py` | Extract Chrome/Firefox extension manifests and file trees |
| `save_auth.js` | Save login state for authenticated recon |
| `scaffold_workspace.js` | Create the standard folder structure |
| `run_agent.js` | Run coding agent on single build card with context injection |
| `generate_tests.py` | Generate Playwright/Vitest component and interaction tests from sweep data |
| `theme_tokens.py` | Multi-theme token pairing, semantic role assignment, and WCAG contrast validation |
| `inspect_canvas.py` | Inspect 2D/WebGL/Three.js/Babylon/PIXI canvases and WebAssembly modules |
| `inspect_extension.py` | Reverse engineer browser extensions, Electron apps, and Tauri apps |
| `capture_websocket.py` | Real-time WebSocket, SSE, and streaming fetch traffic capture |
| `enforce_budget.py` | Performance budget enforcement, CWV measurements, and regression checks |
| `doctor.js` | Check local environment (Node, Python, Playwright, dependencies) |

## Workspace Structure

```
re-<slug>/
├── .github/                 # CI workflows (move to repo root for GitHub Actions)
├── STATE.md                 # Resume file — update at every phase gate
├── UNKNOWNS.md              # Unknowns log
├── IMPLEMENTATION.md        # Tier 2: single implementation doc with cards
├── 01-recon/                # Stack detection, API contracts
│   ├── stack.json
│   ├── STACK.md
│   └── api-contracts.md
├── 02-evidence/             # Raw captures (gitignored)
│   ├── home/                # inventory.json, network.json, screenshots
│   ├── sweep/               # Interaction sweep results
│   └── a11y/                # Accessibility tree, tab order
├── 03-docs/                 # Tier 1 only: full document set
│   ├── PRD.md
│   ├── TRD.md
│   ├── DESIGN-SYSTEM.md
│   ├── API-CONTRACT.md
│   └── ...
├── 04-components/           # Component specs (Tier 1)
├── 05-features/             # Atomic build cards (Tier 1)
├── 06-parity/               # Diff results, parity scores
└── feature-matrix.csv       # Dependency graph + build order
```

## The 10-Phase Process

1. **Recon & Fingerprint** — Know the stack before touching it
2. **Map the Surface** — Complete screen/state inventory
3. **Use It Like a Real User** — Journeys + exhaustive control sweep
4. **Break It Down, Div by Div** — Structural teardown → component specs
5. **Extract Design System** — Tokens, scales, motion, themes
6. **Behavior, Data & What's Behind It** — Network, storage, state machines
7. **Choose Technology** — Per-component primitives with ADRs
8. **Write Documents** (T1 only) — 22-document full set
9. **Atomize the Build** — One card per button/tooltip/shortcut
10. **Parity Loop** — Diff inventories, visual diffs, interaction replays

## Tiers at a Glance

| Situation | Tier | Output |
|-----------|------|--------|
| Whole product, no codebase | **T1 Full Kit** | Full document set + atomic cards |
| Codebase exists or being built | **T2 Implementation Doc** | One `IMPLEMENTATION.md` with cards |
| Single feature (with or without repo) | **T2 Implementation Doc** | One `IMPLEMENTATION.md` with boundary |
| Question only ("what stack?") | **T3 Quick Answer** | Short answer in chat |

## Modes

| Mode | When | Reference |
|------|------|-----------|
| **A. Codebase Parity** | Repo exists, reach parity with reference | `references/05-codebase-parity-mode.md` |
| **B. From Scratch** | No codebase | `references/06-from-scratch-mode.md` |
| **C. Hybrid** | Repo is skeleton/unusable | Audit as A, plan missing as B |

## Hard Cases Handled

- **Canvas/WebGL/WASM apps** — Library globals, frame capture, event probing, exported file inspection
- **Auth-walled features** — Document public surface, mark rest `[ASSUMED]`, ask for test account
- **Heavy anti-bot/obfuscation** — Work from legitimate browser render, note limits
- **Native desktop/mobile** — Accessibility inspectors, emulators, exported assets
- **Browser extensions** — Unpack CRX/XPI, read manifest, content scripts, background worker
- **Builder sites (Webflow, Framer, Elementor)** — Identify builder, plan rebuild in native components
- **Very large products** — Split into modules, one master index

## Anti-Patterns (Don't Do These)

- ❌ Describing a screenshot and calling it analysis
- ❌ One giant "build the whole app" prompt
- ❌ Picking a favorite stack before looking at evidence
- ❌ Skipping empty, error, loading, hover, focus, disabled states
- ❌ Specs like "modern clean look" — use measured values
- ❌ Cards bundling several features
- ❌ Claiming backend is X with no evidence
- ❌ Copying brand assets or code verbatim
- ❌ Full document set for a feature/existing codebase
- ❌ Pasting raw DOM/HAR/JSON into context

## Evaluation & Smoke Tests

```bash
# 1. Trivial static page
node scripts/recon.js https://example.com /tmp/re-example

# 2. Steps reach state
# Create steps.json, then:
node scripts/dom_inventory.cjs <url> <out> --steps steps.json

# 3. Card lint
python scripts/lint_cards.py <cards-dir>

# 4. A11y walk
node scripts/a11y_walk.cjs <url> /tmp/a11y

# 5. Visual matrix
node scripts/visual_diff.js <url> /tmp/vp
```

## References (Read in Order)

1. `references/01-recon-and-fingerprinting.md` — Signal tables for stack detection
2. `references/02-interaction-protocol.md` — How to use the app and tear it down
3. `references/03-component-and-primitives-selection.md` — Choosing UI primitives
4. `references/04-feature-tech-selection.md` — Choosing best method per feature
5. `references/05-codebase-parity-mode.md` — Mode A
6. `references/06-from-scratch-mode.md` — Mode B
7. `references/07-document-templates.md` — All documents and quality bar
8. `references/08-build-cards.md` — Atomic build card rules
9. `references/09-parity-verification.md` — Diff tooling and scoring
10. `references/10-scope-tiers-and-token-budget.md` — Scope, tiers, depth, token rules

## Templates

- `assets/templates/implementation-doc.md` — Tier 2 single doc
- `assets/templates/component-spec.md` — Per-component specification
- `assets/templates/build-card.md` — Atomic build card
- `assets/templates/adr.md` — Architecture Decision Record
- `assets/templates/prd.md`, `trd.md`, `user-flow.md`, `state.md`, `interaction-spec.md`

## Legal & Ethics

- Rebuild behavior, layout, and design from observation only
- Do not copy proprietary source code, logos, brand assets, copyrighted images, or fonts without license
- Do not bypass logins, paywalls, rate limits, or ToS
- Only operate logged-in areas with user-provided credentials
- No destructive actions (delete, pay, send) on real accounts
- Replace brand assets with placeholders; list in asset manifest
- No secrets in outputs — never write passwords, tokens, cookies to docs

## Troubleshooting

**Scripts are CommonJS (`.cjs`)** — Runs as CommonJS even in ESM projects. Use `node scripts/dom_inventory.cjs ...`

**File watcher EBUSY on Windows** — Host app's watcher conflicts with antivirus/OneDrive/Downloads sync. Fix: keep project outside `Downloads`, `Desktop`, OneDrive; exclude `skills/**` and `re-*/**` from watchers; point output folders outside watched trees.

## License

MIT — Use freely for learning, rebuilding, and understanding how things work.