# 02. Interaction Protocol and Structural Teardown

Contents: tooling, the user-session method, journeys, the control sweep, state matrix, structural teardown (div by div), hard targets, evidence logging, coverage gate.

## Tooling
Use whatever browser control you have, in this order of preference:
1. A browser agent or MCP with real DOM access and input control (Chrome DevTools MCP, Playwright MCP, a browser subagent).
2. Playwright scripts (`scripts/dom_inventory.cjs`, `scripts/interaction_sweep.cjs`, or your own).
3. Manual steps by the user with your instructions, if neither exists (lowest quality, say so).

Always capture: the accessibility tree, the DOM, computed styles, network log, console log, screenshots, and for motion, a video or a frame sequence.

## The user-session method
Do not start by enumerating elements. Start by being a user.

1. **Pick personas**: first-time visitor, returning user, power user, user who makes mistakes. Note what each would try first.
2. **Cold open**: load the app with empty storage. Record what a first-time user sees: onboarding, empty states, prompts, cookie banners, default data.
3. **Complete the main journeys end to end** (see below). Narrate each step in a log: intent, action, result, surprise.
4. **Break things on purpose**: invalid input, double clicks, rapid toggles, back button, refresh mid-flow, offline, slow network, huge content, tiny viewport.
5. **Then** run the exhaustive control sweep to catch what the journeys missed.

## Journeys
List journeys as goals. Typical set (adapt to the product):
- First run and onboarding
- Sign up, sign in, sign out, forgot password, verify email
- Create the core object (project, document, post, design)
- Edit the core object (every editing tool)
- Organize (rename, move, duplicate, delete, restore, search, sort, filter)
- Import and export (every format and option; download the files and inspect them)
- Share and collaborate (links, permissions, invites, comments, presence)
- Settings and preferences (every toggle persists? where?)
- Billing, plans, limits, upgrade prompts
- Help, shortcuts, command palette, feedback
- Errors and recovery
Each journey gets a file in `03-docs/user-flows/J-##-name.md` with a Mermaid diagram, the steps, the screens touched (S-##), the controls used (C-###), and the edge cases tried.

## Control sweep (exhaustive)
Goal: operate every interactive element on every screen and state.

Interactive means any of: `a[href]`, `button`, `input`, `select`, `textarea`, `summary`, `[role=button|link|tab|menuitem|menuitemcheckbox|menuitemradio|option|checkbox|radio|switch|slider|combobox|treeitem|gridcell]`, `[tabindex]`, `[contenteditable]`, elements with `cursor:pointer`, elements with click handlers (listener log), draggable items, resize handles, scrollable regions, canvas hit areas.

For each control, record a **control record** (`C-###`):
```
id: C-014
screen/state: S-03 / default
location: Toolbar > Alignment group > Align Left
element: <button aria-label="Align left"> icon-only
accessible name / role: "Align left", button
visual states: default, hover, focus-visible, active, disabled, pressed(toggled), loading
what it does: sets text-align on selection to left
precondition: a text layer is selected (else disabled)
effect: DOM/canvas/state change, network call, storage write, URL change, focus move
keyboard: Enter/Space activates; shortcut Cmd+Shift+L
tooltip: "Align left (Cmd+Shift+L)" after 500ms delay
undoable: yes, one history entry
persists: yes, saved with project
errors: none
evidence: 02-evidence/sweep/C-014-*.png, interactions.json#14
```
Run `scripts/interaction_sweep.cjs` for the DOM-reachable ones, then do the rest by hand: drag handles, resize, pan/zoom, canvas clicks, right-click menus, long-press, double-click, multi-select, paste, drop files, keyboard-only flows.

## State matrix
For every control and every stateful component capture each applicable state:
default, hover, focus (mouse), focus-visible (keyboard), active/pressed, selected/checked/toggled, disabled, loading, error/invalid, success, empty, read-only, dragging, drop-target, expanded/collapsed, open/closed, overflowing/truncated, skeleton.
Use CSS state forcing in DevTools (`:hover`, `:focus-visible`, `:active`) or Playwright `hover()`/`focus()`/`mouse.down()` and read computed styles in each state. Record the **diff** from default, not the whole style.

## Timing and motion
For every transition and animation capture: trigger, property, duration, delay, easing, and result. Sources: computed `transition-*`, `animation-*`, `element.getAnimations()` (gives keyframes, timing, easing), `@keyframes` rules, JS animation libraries (GSAP timelines, spring configs). For canvas/JS driven motion, record a video and extract frames, then estimate curves. Capture reduced-motion behavior (`prefers-reduced-motion`).

## Input fuzzing
For every field: empty, whitespace, very long, unicode and emoji, RTL text, HTML/script strings (to see escaping), numbers out of range, wrong format, paste vs type. Record validation timing (on input, blur, submit), message text, message position, and styling.

## Responsive sweep
Test widths 320, 375, 414, 768, 1024, 1280, 1440, 1920, plus landscape phone and tall/short heights. To find exact breakpoints, binary search the width where layout changes (nav collapses, columns change). Record what changes at each: layout, visibility, order, size, interaction (hover vs tap).

## Persistence and sync tests
Reload mid-flow, open a second tab, clear storage, sign in on another profile, go offline then online. Record what survives, where it lives, and how conflicts resolve.

## Structural teardown (div by div, section by section)

Goal: explain every node on the page. Work top down using `inventory.json` and live DevTools.

**Level 0: page shell.** `html`, `head` (title, meta, theme-color, color-scheme, fonts, preloads), `body` (classes, background, overflow, font smoothing).

**Level 1: landmarks and regions.** Header, nav, aside/sidebar, main, footer, toolbars, panels, overlays root. For each: position (static, sticky, fixed, absolute), size rule (fixed, flex, grid track, content), scroll behavior (which element scrolls, overscroll, scrollbar styling), z-layer.

**Level 2: sections.** Each distinct block inside a region (hero, feature grid, property panel group, layer list). Record layout model and the rule it follows (flex row with gap 8, grid 12 col, etc.).

**Level 3: containers and wrappers.** Every wrapper `div` must be classified. Why does it exist?
- layout (flex/grid container)
- spacing (padding/margin wrapper)
- scroll container (overflow auto)
- positioning context (position relative for absolute children)
- stacking context (z-index, transform, opacity, filter)
- clipping (overflow hidden, border radius mask)
- semantic or a11y wrapper (role, labelledby)
- interaction target (hit area bigger than visible)
- decorative (background, gradient, noise)
- portal or overlay slot
If a wrapper has no purpose, say so (it may be framework residue). Reproduce purposeful wrappers, not residue.

**Level 4: elements.** Text, icons, images, inputs, buttons, separators. Record content, typography, color, size, spacing, borders, radius, shadow, opacity, cursor, transitions, and states.

**Per-node fields** (the inventory already captures most):
`path, tag, id, classes, role, aria-*, data-*, text, bbox (x y w h), layout (display, position, flex/grid props), box model (margin, padding, border), typography, colors, effects (shadow, filter, backdrop), overflow, z-index, transform, transition/animation, pseudo-elements, listeners, children count`.

**Group into components.** Look for repetition (same structure and styles repeated = one component with props) and for natural boundaries (has own state, own states, reused, named by the product). Name them the way the product's own language would (Toolbar, LayerRow, InspectorSection). Write one spec each (`assets/templates/component-spec.md`): anatomy (slots), props (inferred), variants, sizes, states, behavior, a11y, responsive, and the exact style values.

**Anatomy diagram.** For each non-trivial component add a nested outline:
```
LayerRow (flex, h-32, px-8, gap-8, items-center, hover:bg-muted)
  DragHandle (icon 16, opacity .4, cursor grab)
  VisibilityToggle (button 24x24, icon eye / eye-off)
  Thumbnail (24x24, radius 4, checkerboard bg)
  Name (flex-1, truncate, 13px/500, editable on double-click)
  LockToggle (button 24x24)
```

## Hard targets

- **Portals and overlays**: dialogs, popovers, menus, toasts, tooltips render under `body` or a named root, not inside the trigger. Trigger each, then re-snapshot the DOM. Record anchoring (side, align, offset, collision flip), focus trap, scroll lock, backdrop, dismiss rules (Esc, outside click), animation in and out.
- **Shadow DOM**: traverse `shadowRoot`; the inventory script does. Note `::part` and CSS variable theming hooks.
- **iframes**: same-origin can be walked; cross-origin only by behavior. Note sandbox attributes and postMessage use.
- **Virtualized lists**: only visible rows exist. Scroll and record row height, overscan, and sticky headers. Count total items via scroll height.
- **Canvas / WebGL**: DOM tells nothing. Probe by input: click, drag, wheel, keyboard; compare screenshots; read library globals (`PIXI.VERSION`, `THREE.REVISION`, scene objects if exposed); export to a file and inspect (SVG/JSON/PNG/Lottie shows the data model). Build a **behavior table**: input, tool, result, snapping, handles, cursor changes.
- **Infinite scroll, lazy loading**: record trigger distance, batch size, placeholders.
- **Drag and drop**: record drag start threshold, ghost/preview, drop indicators, valid/invalid targets, auto-scroll, keyboard alternative, result and undo.
- **Rich text**: toolbar behaviors, selection rules, paste cleaning, markdown shortcuts, slash menu, mentions.
- **Data tables**: sorting, filtering, column resize/reorder, pagination, row selection, bulk actions, sticky headers/columns, empty and loading states.

## Evidence logging
Name files so they sort and cross reference:
- `02-evidence/screens/S-03-default.png`, `S-03-empty.png`
- `02-evidence/controls/C-014-hover.png`
- `02-evidence/flows/J-02-step-04.png`
- `02-evidence/network/J-02.har`
- `02-evidence/motion/C-031-open.webm`
Every spec line should point to evidence.

## Coverage gate (must pass before Phase 5)
- 100% of interactive elements in the inventory have a control record or are explicitly marked "not reachable, reason".
- Every screen has every applicable state captured.
- Every journey is written and has been completed in the live app at least once.
- Every overlay type has been triggered and dissected.
- Keyboard-only pass, responsive sweep, persistence tests done and logged.
Report coverage numbers to the user.
