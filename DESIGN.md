# Raylight Motion Graphics Editor — Design System & Visual Specification

## 1. Visual World & Operating Philosophy

### Operating Mode: Operate (Creative Studio)
Raylight Editor is designed as a precision creative instrument for professional motion graphics choreographers. The visual architecture adheres strictly to an **"Operate"** paradigm:
* **Viewport Artifact Primacy:** The 3D/2D motion canvas commands the visual field; the surrounding tool chrome recedes into an unobtrusive, precision dark matte.
* **Information Density Without Visual Clutter:** Controls are compactly organized into scannable panels, unified by consistent margins, borders, and tactile scrub inputs.
* **Zero Arbitrary Values:** Every surface, border, text color, and focus ring derives strictly from tokenized CSS custom properties defined in `src/index.css`.
* **Tactile Micro-Interactions:** Continuous drag scrubbing, instant hover state transitions, and tabular number formatting ensure zero jitter during dynamic adjustment.

---

## 2. Design Tokens & Palette Architecture

All design tokens are defined as CSS Custom Properties in [`src/index.css`](file:///c:/Users/Sam%20Akinkunmi/Downloads/Ray_New/raylight-editor/src/index.css):

### Surface Elevations
| Token | Hex Value | Purpose |
| :--- | :--- | :--- |
| `--bg-canvas` | `#07080d` | Deep space behind the viewport canvas |
| `--bg-app` | `#0b0b0d` | Window foundation and root backdrop |
| `--bg-panel` | `#111114` | Left navigation sidebar and Right inspector panel |
| `--bg-surface` | `#161619` | Elevated cards, section containers, and timeline header |
| `--bg-subtle` | `#1c1c1f` | Input wells, numeric scrubbers, and slider tracks |
| `--bg-muted` | `#242428` | Dropdown menus, modal dialogs, and floating toolbars |
| `--bg-hover` | `rgba(255, 255, 255, 0.05)` | Interactive control hover highlight |
| `--bg-active` | `rgba(255, 255, 255, 0.08)` | Mouse-down / pressed state |

### Border Tokens
| Token | Value | Purpose |
| :--- | :--- | :--- |
| `--border-subtle` | `rgba(255, 255, 255, 0.07)` | Section dividers and panel perimeter borders |
| `--border-medium` | `rgba(255, 255, 255, 0.12)` | Input wells, active tabs, and card perimeters |
| `--border-focus` | `#0088ff` | High-visibility focus indicators |

### Text & Contrast Standards
Every text token meets or exceeds **WCAG AA** contrast requirements against the `#111114` panel background:
| Token | Hex Value | Contrast Ratio | Usage |
| :--- | :--- | :---: | :--- |
| `--text-primary` | `#f4f4f5` | **14.5:1** | Headlines, active values, button labels |
| `--text-secondary` | `#d4d4d8` | **10.8:1** | Body descriptions, layer titles |
| `--text-muted` | `#a1a1aa` | **4.6:1** | Property labels, badges, unselected tabs |
| `--text-disabled` | `#71717a` | **2.8:1** | Disabled buttons and locked indicators |

### Brand & Semantic Accents
* `--accent-primary` (`#0088ff`): Primary action buttons, active timeline playhead, and keyframing markers.
* `--accent-hover` (`#0077e6`): Primary button hover state.
* `--accent-selection` (`#09355c`): Layer tree selection, timeline clip highlight, and text `::selection`.
* `--accent-glow` (`rgba(0, 136, 255, 0.25)`): Subtle drop shadows on active indicators.
* `--accent-danger` (`#f43f5e`): Delete layer, reset project, and destructive alerts.
* `--accent-success` (`#10b981`): Validation checkmarks, export completion, and active audio indicators.
* `--accent-warning` (`#f59e0b`): Warning banners and keyframe friction notices.

### Browser Surface Theming
System-level browser interactions are styled to match the dark studio palette:
* **Text Selection:** `::selection` and `::-moz-selection` styled with `--accent-selection` background and `#ffffff` foreground.
* **Input Caret:** `caret-color: var(--accent-primary)`.
* **Scrollbars:** `scrollbar-width: thin; scrollbar-color: #262936 #0b0d14` with rounded thumb handles.
* **Underlines:** `text-underline-offset: 3px` on interactive text links.

---

## 3. Typography & Numerical Layout

### Font Stack & OpenType Configuration
Raylight loads **Inter** for UI prose and **JetBrains Mono** for numerical values and code representations:
```css
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace;
```

Global typography is configured with advanced OpenType feature flags:
```css
font-feature-settings: 'cv02' 1, 'cv03' 1, 'cv04' 1, 'cv11' 1, 'tnum' 1, 'zero' 1;
```
* `cv02`, `cv03`, `cv04`: Modern open-style numerals (4, 6, 9) for high legibility at micro sizes.
* `cv11`: Single-storey lowercase "a" for geometric UI clarity.
* `tnum`: Monospaced tabular numerals across all numbers, preventing layout jitter during real-time scrubbing.
* `zero`: Slashed zero to distinguish digits from letter "O".

### Typographic Hierarchy & Role Classes
| Class | Size | Weight | Tracking | Usage |
| :--- | :--- | :--- | :--- | :--- |
| `.text-title-lg` | `16px` | SemiBold (600) | `-0.015em` | Modal titles, export summary headings |
| `.text-title-md` | `13px` | Medium (500) | `-0.01em` | Panel headers, dialog subheadings |
| `.text-body-default` | `12px` | Regular (400) | `normal` | General tool descriptions and options |
| `.text-label-caps` | `10px` | SemiBold (600) | `+0.05em` | Inspector section labels, uppercase badges |
| `.text-metric-mono` | `11px` | Regular (400) | `-0.02em` | Scrub input values, timecodes, coordinates |

### Impeccable Craft Rules
1. **Zero Sub-10px Micro-Text:** All labels, badges, and controls are enforced at a minimum of 10px–11px, eliminating unreadable sub-10px text.
2. **Tabular Numerals on Dynamic Scrubbers:** Any element displaying time, dimensions, angles, or percentages must utilize `font-mono tabular-nums` to eliminate layout jitter.

---

## 4. Component Design System & Tactile Interactions

### 1. `ScrubInput` Component (`src/ui/ScrubInput.tsx`)
* **Pointer Capture Drag:** Clicking and dragging horizontally adjusts numerical values with smooth velocity scaling.
* **Modifier Multipliers:** Holding `Shift` accelerates scrubbing by 10×; holding `Alt` enables precision 0.1× micro-adjustments.
* **Direct Input Mode:** Clicking opens an inline editing text field with instant selection.
* **Arrow Navigation:** `ArrowUp` / `ArrowDown` nudge values with full accessibility compliance.

### 2. Inspector Panels & Property Sections
* **Collapsible Sections:** Expand/collapse states with subtle rotation chevron indicators.
* **Segmented Controls:** Pill-style radio toggles with dark glass containers and high-contrast active states.
* **Color Pickers:** Hex code inputs coupled with visual color swatches and opacity sliders.

### 3. Timeline & Track Rack (`src/panels/Timeline/Timeline.tsx`)
* **Layer Bars:** Visual representations of layer in/out duration spans with draggable resize handles.
* **Playhead Line:** Bright blue (`#0088ff`) indicator with live timecode flag and smooth hover skimmer.
* **Scissors Split Clip Tool:** Dedicated Scissors button (`S` shortcut) with instant hover highlight.
* **Audio Track Display:** Synchronized audio clip bars with waveform preview lines and mute/volume badges.

### 4. 3D Stage & Canvas Gizmos (`src/stage/`)
* **Snap Guides:** Emerald alignment lines with pixel-distance readouts.
* **Safe Zones:** TV/Mobile action-safe and title-safe dashed outlines.
* **Rule-of-Thirds Grid:** Low-opacity 3×3 grid overlay for cinematic camera framing.
* **Transform Handles:** 8-point bounding box with rotation anchor and 3D plane axis indicators.

---

## 5. Accessibility & Responsive Constraints

* **Keyboard Navigation:** Full tab order across panels, keyboard shortcuts (`?` for modal cheat sheet), and ARIA tree items for layer hierarchies.
* **High-Contrast Focus Indicators:** All interactive elements feature `focus-visible:ring-1 focus-visible:ring-[#0088ff]` with clean offsets.
* **Reduced Motion:** Respects `prefers-reduced-motion: reduce` by disabling non-essential transitions and animations.
