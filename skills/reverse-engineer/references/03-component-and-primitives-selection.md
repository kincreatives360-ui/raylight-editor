# 03. Component and Primitives Selection

Contents: selection rubric, pattern to primitive map, library families, styling and motion, how to record the decision.

## Rubric (apply in this order)
1. **Evidence match**: what the reference actually uses (see fingerprint tables). Matching its primitives gives matching DOM, ARIA, focus and `data-state` behavior for free.
2. **Behavior fit**: does the primitive reproduce the observed behavior (collision flipping, typeahead, focus return, scroll lock, roving tabindex)? Test against the control record, not the marketing page.
3. **Accessibility**: keyboard map and ARIA pattern match the WAI-ARIA Authoring Practices pattern for that widget.
4. **Styling control**: unstyled/headless beats opinionated when the reference has a custom look. Opinionated kits only when the reference visibly uses them.
5. **Framework fit**: React, Vue, Svelte, Solid, vanilla, or WordPress/Elementor. Do not force React primitives on a Vue target.
6. **Cost**: bundle size, tree shaking, SSR support.
7. **Health**: license, last release, open issue trend, maintainers. **Verify with web search/npm before pinning**, since this changes fast.
8. **Fallback**: name one runner-up.

## Pattern to primitive map (React targets; swap per framework)
| UI pattern | First choice | Alternatives | Notes |
|---|---|---|---|
| Dialog / alert dialog / sheet | Radix Dialog | React Aria, Ark, Base UI | Focus trap, scroll lock, portal, Esc, outside click |
| Drawer (mobile bottom sheet) | vaul | Radix Dialog + custom | Drag to dismiss, snap points |
| Popover | Radix Popover | Floating UI + custom | Check collision flip and arrow |
| Tooltip | Radix Tooltip | Floating UI | Match delay (often 300 to 700ms) and skip-delay group |
| Dropdown menu / context menu | Radix DropdownMenu / ContextMenu | React Aria Menu | Submenus, typeahead, checkbox/radio items |
| Select (custom) | Radix Select | React Aria Select, Ark | Native `<select>` if the reference uses native |
| Combobox / autocomplete | cmdk or React Aria ComboBox | Downshift, Ark | Async, grouping, empty state |
| Command palette | cmdk | kbar | Fuzzy match, shortcuts |
| Tabs | Radix Tabs | React Aria Tabs | Activation mode (auto vs manual) |
| Accordion / collapsible | Radix Accordion | native `<details>` | Height animation via CSS var |
| Toggle, switch, checkbox, radio | Radix | native inputs styled | Indeterminate state |
| Slider / range | Radix Slider | React Aria, custom for multi-handle | Step, marks, keyboard |
| Number input / scrubby label | custom + pointer events | react-aria NumberField | Drag-to-scrub is often custom |
| Toast | Sonner | Radix Toast | Stack, swipe, timers, position |
| Resizable panels / splitters | react-resizable-panels | custom | Persist sizes, keyboard resize |
| Drag and drop (lists, boards) | dnd-kit | pragmatic-drag-and-drop, react-aria DnD | Sensors, collision, keyboard DnD |
| Virtual lists/grids | TanStack Virtual | react-window | Dynamic row heights |
| Data table | TanStack Table (headless) | AG Grid for heavy features | Match column behaviors |
| Forms and validation | React Hook Form + Zod | TanStack Form | Match validation timing |
| Date and time | react-day-picker + date-fns | React Aria DatePicker | Locale and range modes |
| Color picker | react-colorful | custom canvas picker | Match formats (hex, rgb, hsl, oklch) |
| Rich text | TipTap (ProseMirror) | Lexical, Slate | Match schema and shortcuts |
| Code editor | CodeMirror 6 | Monaco | Monaco for IDE-like features only |
| Charts | Recharts | visx, ECharts, D3, Chart.js | Canvas for large data |
| Icons | Match reference set (often Lucide, Phosphor, Heroicons, Radix Icons, Material Symbols) | custom SVG sprite | Match stroke width and size grid |
| Avatars, badges, progress, skeleton, separator | Radix/shadcn style primitives | CSS only | Often trivial, still own card |
| File upload / dropzone | react-dropzone | native input | Progress, validation, previews |
| Canvas editors | See `04-feature-tech-selection.md` | | |

## Library families (when reference uses a full kit)
- **Radix + Tailwind (shadcn pattern)**: copy-in components, full control. Default for modern React apps with a custom look.
- **React Aria Components**: strongest accessibility, headless, good for complex widgets.
- **Ark UI (Zag)**: framework agnostic (React, Vue, Solid, Svelte).
- **Headless UI**: smaller set, tied to Tailwind ecosystem.
- **MUI / Ant Design / Chakra / Mantine**: use only if the reference visibly uses it, or if the user wants a batteries-included kit.
- **Vue**: Radix Vue / Reka UI, PrimeVue, Vuetify, Element Plus. **Svelte**: Bits UI, Melt UI. **Solid**: Kobalte.
- **WordPress / Elementor**: native widgets first, custom widget plugin second, custom CSS last. Prefer global styles and theme tokens.

## Styling and tokens
- Tailwind with CSS variables for tokens when the reference uses utility classes or when speed matters. Map extracted tokens into `tailwind.config` / `@theme` and CSS variables.
- CSS Modules or vanilla-extract when the reference uses hashed classes and the team wants strict scoping.
- Never hardcode hex or px values in components. Everything flows from `design-tokens.json`.

## Motion
- Simple state transitions: CSS transitions using the measured duration and easing.
- Orchestrated UI motion, layout animation, gestures: Motion (framer-motion).
- Timelines, scroll-driven scenes: GSAP (check license terms) or CSS scroll-driven animations.
- Vector animation playback: Lottie or Rive. Canvas motion: engine's ticker (see doc 04).
- Honor `prefers-reduced-motion`.

## Record the decision
For every non-obvious pick, create `03-docs/adr/ADR-###-<topic>.md` from `assets/templates/adr.md`: context, evidence from reference, options considered (at least two), decision, consequences, fallback. Update the component spec to name the primitive and the exact props to use.
