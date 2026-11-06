# 09. Parity Verification

Contents: what to compare, tools, process, scoring, deviation log.

## What to compare
| Dimension | Method | Tool |
|---|---|---|
| Structure | Same landmarks, order, roles, accessible names | accessibility tree snapshots, `diff_inventories.py` |
| Computed styles | Per matched element, tracked properties within tolerance | `diff_inventories.py` |
| Visual | Screenshot diff per screen, state, breakpoint | Playwright screenshots + pixelmatch/odiff, or Playwright `toHaveScreenshot` |
| Behavior | Replay the same interaction script on both and compare outcomes | Playwright scripts from journeys |
| Motion | Duration, delay, easing, final frame | `getAnimations()` dump, frame capture |
| Network | Same calls, order, payload shape | HAR diff (shape level) |
| Storage | Same keys and shapes | storage dump |
| A11y | Roles, names, focus order, keyboard map | axe-core + manual keyboard pass |
| Performance | Load, interaction latency, FPS | Lighthouse, Performance panel |
| Responsive | All breakpoints | screenshot matrix |

## Process
1. **Baseline**: run `dom_inventory.cjs` on the reference at each target viewport. Save as `06-parity/ref-<viewport>.json` plus screenshots.
2. **After each card**: run the card's checks and a scoped diff of the touched component.
3. **After each stage**: run `dom_inventory.cjs` on the rebuild and `python scripts/diff_inventories.py ref.json build.json --out 06-parity/diff-<stage>.md`. Run the full visual matrix and the interaction replays.
4. **Triage** every difference:
   - **Fix**: becomes a card or an edit to an existing card.
   - **Accepted deviation**: reason recorded (licensing, dynamic data, intentionally different).
   - **Unknown**: added to Unknowns Log.
5. Repeat until no Fix items remain above threshold.

## Tolerances (defaults, set with the user)
- Layout positions and sizes: within 1px at the same viewport.
- Colors: exact for tokens; within deltaE 1 for rendered samples.
- Typography: same family, size, weight, line height, letter spacing.
- Timing: within 20ms and same easing curve family.
- Visual diff: under 0.1% pixel difference per screen after masking dynamic regions (ads, timestamps, user content).

## Mask and stabilize
Freeze animations, fixed time, seeded random, same fonts loaded, same data fixtures, same viewport and device scale factor, disable caret blink. Mask truly dynamic regions explicitly.

## Parity score
Report per area and overall:
```
Structure  96%   (matched nodes / reference nodes)
Styles     93%   (matching tracked props / total)
Visual     99.2% (1 - pixel diff)
Behavior   88%   (passing replays / total)
States     91%   (states built / states catalogued)
Overall    = weighted average, weights agreed with the user
```
List the top 10 gaps by impact.

## deviation-log.md format
```
D-007 | Header logo | Accepted | Brand asset not licensed; placeholder used | owner: user to supply
D-012 | Export MP4 timing | Fix | 340ms slower than reference | card F-188
```

## Final report
Parity score, list of accepted deviations, unresolved unknowns, and what the user must provide (licensed assets, credentials, API keys).
