# Raylight Editor — Design System & Visual Specification

## 1. Visual World & Operating Mode
- **Mode**: **Operate** (Professional Creative Studio / Motion Design Tool).
- **Core Aesthetic**: Precision dark mode, minimal cognitive friction, high scanability, tactile scrub controls, and purposeful motion.
- **Principles**:
  - The viewport artifact leads; the tool chrome recedes.
  - High information density without visual noise.
  - Consistent tokenized colors; no arbitrary ad-hoc hex values.
  - Complete keyboard and touch parity on every interactive control.

## 2. Token System (CSS Custom Properties in `src/index.css`)

### Surface Elevation
- Canvas Background: `var(--bg-canvas)` (`#07080d`)
- App Base: `var(--bg-app)` (`#0b0b0d`)
- Sidebar & Inspector Panels: `var(--bg-panel)` (`#111114`)
- Elevated Surface / Cards: `var(--bg-surface)` (`#161619`)
- Input & Control Wells: `var(--bg-subtle)` (`#1c1c1f`)
- Toolbars & Popovers: `var(--bg-muted)` (`#242428`)
- Hover State: `var(--bg-hover)` (`rgba(255, 255, 255, 0.05)`)
- Active State: `var(--bg-active)` (`rgba(255, 255, 255, 0.08)`)

### Borders
- Subtle Divider: `var(--border-subtle)` (`rgba(255, 255, 255, 0.07)`)
- Medium Border: `var(--border-medium)` (`rgba(255, 255, 255, 0.12)`)
- Focus Accent: `var(--border-focus)` (`#0088ff`)

### Typography & Contrast Standards
- **Primary Text**: `var(--text-primary)` (`#f4f4f5`) — 14.5:1 contrast against `#111114`.
- **Secondary Text**: `var(--text-secondary)` (`#d4d4d8`) — 10.8:1 contrast.
- **Muted Text / Labels**: `var(--text-muted)` (`#a1a1aa`) — 4.6:1 contrast (WCAG AA compliant for small 10–11px text).
- **Disabled Text**: `var(--text-disabled)` (`#71717a`).

### Brand & Semantic Accents
- Primary Brand Blue: `var(--accent-primary)` (`#0088ff`)
- Brand Hover: `var(--accent-hover)` (`#0077e6`)
- Tree / Selection Blue: `var(--accent-selection)` (`#09355c`)
- Accent Glow: `var(--accent-glow)` (`rgba(0, 136, 255, 0.25)`)
- Danger / Destructive: `var(--accent-danger)` (`#f43f5e`)
- Success / Validated: `var(--accent-success)` (`#10b981`)
- Warning / Drag Indicator: `var(--accent-warning)` (`#f59e0b`)

## 3. Interactive Component Standards
- **Numeric Scrubbing**: Must use `ScrubInput` supporting Pointer Events (`touch-action: none`), pointer capture, Arrow keys increment/decrement, and Enter-to-type.
- **Treeviews (Layers / Shots)**: Must expose `role="treeitem"`, `aria-selected`, `tabIndex`, and Arrow/Enter navigation.
- **Icon Buttons**: Every button must include descriptive `aria-label` and `title` attributes.
- **Focus Rings**: Mandatory 2px high-contrast focus rings (`focus-visible:ring-1 focus-visible:ring-[#0088ff]`).
- **Motion Sensitivity**: Media queries (`prefers-reduced-motion`) must bypass non-functional animations and instant-scroll viewport containers.
