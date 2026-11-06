# Technical Requirements: <Product name>
Mode: A codebase parity | B from scratch | C hybrid

## 1. Stack
| Layer | Choice | Reason | Fallback | ADR |
|---|---|---|---|---|
| Language | | | | |
| Framework | | | | |
| Rendering | DOM / Canvas / WebGL | | | |
| Styling | | | | |
| UI primitives | | | | |
| State | | | | |
| Data / backend | | | | |
| Auth | | | | |
| Storage | | | | |
| Build / tooling | | | | |
| Testing | | | | |
| Hosting | | | | |

## 2. Architecture
Diagram (Mermaid), modules and responsibilities, boundaries, data flow from input to persistence.

## 3. Rendering and interaction engine (if canvas/WebGL)
Render loop, scene/data model, input model, coordinate spaces, determinism, workers.

## 4. State and data
State inventory, persistence keys, schema versions, migration plan, sync/conflict rules, undo/redo model.

## 5. API and integrations
Link to API-CONTRACT.md. Mock strategy. Third party services.

## 6. Performance targets
Load, interaction latency, FPS, memory, bundle.

## 7. Security and privacy
Auth, authorization, input sanitization, secrets handling, CSP, uploads, rate limiting, data retention.

## 8. Accessibility
Standards, per component rules, keyboard model.

## 9. Browser and device support

## 10. Quality
Lint, types, unit/component/e2e/visual tests, CI gates, parity gates.

## 11. Environments and config
Env vars, feature flags, deploy.

## 12. Risks and unknowns
