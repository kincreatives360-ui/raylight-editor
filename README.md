# Raylight Motion Graphics Editor

A high-performance, browser-native 2D and 3D motion graphics studio built with **React 19**, **TypeScript**, **Three.js**, **React Three Fiber**, **Zustand**, and **Vite**.

Raylight Editor empowers motion designers, developers, and product creators to choreograph multi-shot camera moves, 3D device mockups, studio lighting rigs, keyframed animation blocks, and synchronized audio tracks directly in the browser with real-time 60fps WebGL preview and client-side 4K video export.

---

## ✨ Features

* **Procedural 3D Device Frames:** Photorealistic 3D hardware chassis for `iPhone 15 Pro`, `MacBook Pro`, `iPad Pro`, `Samsung Galaxy`, `Studio Display`, and `Browser Window` with 5 finishes (`Titanium`, `Space Black`, `Silver`, `Midnight`, `Black`), screen glare, specular gloss, and screen glow.
* **Spring Dynamics & Bezier Choreography:** Camera movement engine powered by real-time spring physics (`evaluateSpring` with RK4 integration) and 6 curated presets (`Bouncy`, `Snappy`, `Smooth`, `Gentle`, `Wobbly`, `Tight`), alongside interactive cubic bezier handles.
* **Studio Lighting Rigs:** Multi-source lighting setup with key, fill, ambient terms, and custom `directional`, `point`, and `spot` lights with shadow mapping, color temperature, and 7 studio presets (*Studio Neutral*, *Cyberpunk Neon*, *Warm Sunset*, *Moody Rim*, *High Key Commercial*, *Midnight Blue*, *Golden Hour*).
* **Multi-Track Timeline & Split Clip:** Synchronized timeline with shot sequencing, camera movement blocks, layer transitions, audio waveforms, and instant clip splitting via the Scissors tool or `S` hotkey.
* **Curated Sound FX Library:** 150+ built-in sound effects across 10 categories (Ambience, Click, Glitch, Impact, Pop, Riser, Slide, Typing, UI, Whoosh) with instant preview and 1-click timeline instantiation.
* **High-Fidelity Client-Side Export:** Client-side 4K UHD (`3840×2160`), 1080p, and 720p at 24, 30, and 60 fps MP4 video with synchronized WebAudio recording, animated GIF, and PNG sequence rendering.
* **Precision Dark Studio Design System:** Inter and JetBrains Mono typography with OpenType features (`cv02, cv03, cv04, cv11, tnum, zero`), WCAG AA contrast compliance, and zero sub-10px micro-text.

---

## 🚀 Quickstart

### Prerequisites
Node.js 18+ and npm.

### Installation & Development
```sh
# Clone repository and install dependencies
npm install

# Start local development server (served on http://localhost:3000)
npm run dev
```

### Testing & Validation
```sh
# Run unit test suite (18 Vitest tests)
npm test

# Type-check and build production bundle
npm run build

# Run ESLint validation
npm run lint
```

---

## 📁 Architecture & Directory Structure

```
raylight-editor/
├── src/
│   ├── data/                 # Curated sound FX library
│   │   ├── curatedSounds.ts   # 150+ categorized audio effects with URLs
│   ├── engine/               # Math, animation physics, audio, and export
│   │   ├── easing.ts          # Cubic bezier and RK4 spring physics solver
│   │   ├── evaluateLight.ts   # Light evaluation and 3-point calculations
│   │   ├── exporter.ts        # Client-side 4K/1080p/60fps video recorder
│   │   └── soundPacks.ts      # Built-in sound packs and procedural tones
│   ├── model/                # Data types, defaults, and Zod schemas
│   │   ├── schema.ts          # Zod schema definitions and migrations
│   │   ├── types.ts           # TypeScript domain interfaces
│   │   └── defaults.ts        # Canonical default project and layers
│   ├── panels/               # Editor chrome and inspector panels
│   │   ├── LeftPanel/         # Layers tree, asset manager, and SFX
│   │   ├── Inspector/         # Layer, shot, camera, lighting, and shape inspectors
│   │   └── Timeline/          # Multi-track timeline, scrubber, and split tool
│   ├── stage/                # 2D/3D viewport canvas and WebGL renderer
│   │   ├── webgl/             # React Three Fiber 3D scene and device objects
│   │   ├── ViewportCanvas.tsx # Canvas wrapper with zoom and pan controls
│   │   └── Guides.tsx         # Snap guides, safe zones, and rule-of-thirds
│   ├── storage/              # LocalStorage autosave and JSON project I/O
│   ├── store/                # Zustand domain state stores
│   │   ├── useProjectStore.ts # Project data, layers, and undo/redo history
│   │   ├── usePlayheadStore.ts# High-frequency playback clock and state
│   │   └── useSelectionStore.ts# Multi-selection, active tools, and UI panels
│   └── ui/                   # Reusable atomic UI controls (ScrubInput, modals)
├── DESIGN.md                 # Design system, color tokens, and typography spec
├── PRODUCT.md                # Comprehensive product truth and feature matrix
└── README.md                 # Project documentation and quickstart
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Space` | Toggle Play / Pause playback |
| `Cmd/Ctrl + Z` | Undo last action |
| `Cmd/Ctrl + Shift + Z` | Redo action |
| `S` | **Split Clip** at playhead (Scissors tool) |
| `Delete` / `Backspace` | Delete selected layer(s) or shot |
| `[` | Collapse Left Navigation Panel |
| `]` | Collapse Right Inspector Panel |
| `Cmd/Ctrl + A` | Select all layers in active shot |
| `Escape` | Clear layer selection / Close modal |
| `?` | Open **Keyboard Shortcuts** modal |

---

## 💾 Project Data & Portability

* **Automatic Autosave:** The current project is automatically serialized to browser `localStorage` on every change.
* **Defensive Schema Migration:** On launch, projects are checked against Zod schemas; corrupted or outdated configurations are gracefully repaired.
* **Portable Project Files:** Click the project title menu in the top bar to **Export Project JSON** (`.raylight.json`) or **Import Project** to transfer projects across browsers and workstations without data loss.

---

## 📄 License

MIT
