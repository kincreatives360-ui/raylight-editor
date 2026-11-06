# Evals for reverse-engineer skill

Lightweight checks that an agent following the skill produces usable artifacts.

## Smoke tests (manual or scripted)

1. **Trivial static page**
   - Target: any simple marketing page or example.com
   - Run: `node scripts/recon.js https://example.com /tmp/re-example`
   - Expect: `01-recon/stack.json`, `02-evidence/home/digest.md`, `globals.json`, screenshot.

2. **Steps reach state**
   - Create `steps.json` with a click that opens a known panel.
   - Run inventory/sweep with `--steps steps.json`.
   - Expect: inventory reflects the post-click DOM.

3. **Card lint**
   - After generating cards, run `python scripts/lint_cards.py <cards-dir>`.
   - Expect: zero errors for required fields.

4. **A11y walk**
   - `node scripts/a11y_walk.cjs <url> /tmp/a11y`
   - Expect: `tab-order.json` with >0 stops, `a11y-digest.md`.

5. **Visual matrix**
   - `node scripts/visual_diff.js <url> /tmp/vp`
   - Expect: `vp-375.png`, `vp-768.png`, `vp-1440.png`.

## Future golden cards
Store a small set of expected digest fragments or STACK.md claims for known public apps (with version pins) and diff them in CI. Not implemented yet.
