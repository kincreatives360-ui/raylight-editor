# Raylight Motion Graphics Editor — Full Codebase Audit & Upgrade Plan

A comprehensive engineering audit and architectural upgrade blueprint for the Raylight 3D motion graphics studio, addressing WebGL rendering fidelity, hardware-accelerated video/image export, storage resilience, playhead performance, and editor ergonomics.

> [!IMPORTANT]
> **Confirmed Strategic Priorities**:
> - **Audit Scope**: Full end-to-end audit across WebGL, export pipeline, timeline engine, and storage architecture.
> - **Report Structure**: Categorized severity report (P0 Critical, P1 High, P2 Medium, P3 Polish) coupled with a phased implementation roadmap.
> - **Export Capability**: Full WebGL hardware-rendered canvas export capturing true 3D perspective, lights, materials, and post-processing effects.

---

## 1. Codebase Audit: Categorized Bug & Architecture Report

### Severity P0 — Critical Functional Blockers

| ID | Component / File | Root Cause & Failure Mechanism | User Impact | Remediation Plan |
|---|---|---|---|---|
| **BUG-01** | `src/engine/exporter.ts`<br>`src/engine/canvasRenderer.ts` | Video and GIF exports rely strictly on a 2D canvas fallback (`renderProjectFrameToCanvas`), which cannot render WebGL shaders, 3D camera depth, or physical materials. | Exported MP4/GIF videos look completely different from the 3D viewport: flat CSS approximations, no true 3D parallax, and missing WebGL lighting. | Implement direct WebGL canvas frame capture using the active Three.js renderer (`preserveDrawingBuffer: true`), offscreen rendering, and multi-shot playback capture. |
| **BUG-02** | `src/stage/webgl/ViewportCanvas.tsx` | Evaluated effects (`frame.effects` containing Bloom, DoF, Vignette, Chromatic Aberration, Grain, and Glitch) are not connected to any WebGL post-processing pass in the canvas. | Scene Effects inspector controls adjust sliders and keyframes with zero visual change in the WebGL viewport. | Integrate a lightweight Three.js post-processing shader pass / composer quad in `ViewportCanvas` that maps `EvaluatedEffects` directly to screen passes. |
| **BUG-03** | `src/storage/projectIO.ts` | Project state and media assets (base64 image data URLs) are saved synchronously into browser `localStorage` (`raylight_studio_project_v1`). | When projects contain 2+ high-res images or audio clips, `localStorage` hits its ~5MB quota and throws `QuotaExceededError`, silently failing to save. | Migrate storage backend to IndexedDB (`idb-keyval` or native IndexedDB object stores) separating lightweight project JSON recipes from binary media blobs. |
| **BUG-04** | `src/App.tsx`<br>*(lines 463-470)* | Keyboard delete handler checks `activeShot.layers.length > 1`. Also only deletes `selectedLayer`, ignoring multi-selection. | Users cannot delete the final remaining layer to leave a blank shot, and selecting multiple layers only deletes one of them. | Remove the `length > 1` restriction, support multi-layer deletion (`selectedLayerIds`), and clear selection on delete. |

---

### Severity P1 — High Severity Performance & State Flaws

| ID | Component / File | Root Cause & Failure Mechanism | User Impact | Remediation Plan |
|---|---|---|---|---|
| **PERF-01** | `src/App.tsx`<br>*(lines 100-214)* | `currentTimeMs` is extracted from `usePlayheadStore` in `App.tsx` and evaluated via `evaluateProjectAtTime`. | The entire application tree (`LeftPanel`, `RightSidebar`, `Timeline`, `Header`) re-renders 60 times/sec during playback, causing UI micro-stutters and high CPU usage. | Decouple playhead state: bind 60fps time updates to transient animation loops; only notify the WebGL canvas and timeline scrubber needles rather than re-rendering all UI panels. |
| **PERF-02** | `src/stage/webgl/ThreeLayerObject.tsx`<br>*(lines 499-524)* | `new THREE.CanvasTexture(canvas)` is created in `useMemo` without disposing previous texture instances on each frame mutation. | Heavy GPU VRAM churn, texture handle leaks, and frame rate degradation over extended editing sessions. | Maintain a persistent `THREE.CanvasTexture` instance per layer and trigger `texture.needsUpdate = true` on content change rather than re-allocating textures. |
| **LOGIC-01** | `src/engine/evaluateShot.ts`<br>*(lines 202-232)* | `shotTransition.outgoingFrame` is typed but never populated. Transitions only evaluate the incoming shot. | Scene transitions (crossfade, push, slide) do not blend the outgoing scene with the incoming scene, making cuts look jarring. | Calculate the preceding shot's local evaluation frame during the transition overlap window and composite both in the renderer. |
| **LOGIC-02** | `src/model/schema.ts`<br>`src/store/useProjectStore.ts` | The data model supports 8 timeline "lanes", but the evaluator uses `shots.find()`, only rendering one shot at a time. | Timeline lanes imply video track layering/compositing, but overlapping lane shots are completely ignored in rendering. | Clarify scene sequencing into sequential scenes on a unified timeline track with explicit transition overlap margins. |

---

### Severity P2 — Medium Usability & Visual Inconsistencies

| ID | Component / File | Issue Description | Proposed Resolution |
|---|---|---|---|
| **UI-01** | `src/index.css` | `* { user-select: none }` is applied globally to all elements without exception. | Text inputs, layer rename fields, and scrub input boxes resist standard click-and-drag cursor text selection in some browsers. Scope `user-select: none` to canvas and chrome, while allowing `user-select: text` on `input, textarea`. |
| **VIS-01** | `src/stage/webgl/SceneLighting.tsx` | Metallic phone/laptop frames lack an environment reflection map (`RoomEnvironment`), causing metallic chassis to look matte and flat. | Add procedural `RoomEnvironment` with PMREM generator to provide realistic specular reflections on device frames and glass bevels. |
| **UI-02** | `src/panels/Inspector/RightSidebar.tsx` | When deselecting a layer, the inspector defaults to Shot Settings, but camera sub-controls require multiple clicks to reveal. | Streamline scene inspector tabs into clean segments: Camera, Lighting, Effects, and Background. |

---

## 2. Overview & Core Concept

Raylight is an in-browser 3D motion graphics studio designed for designers, video editors, and product marketers. It allows users to place mockups, UI screenshots, vector shapes, and text onto 3D planes with realistic device enclosures (iPhone, iPad, MacBook, browser frames), choreograph cinematic camera dolly/zoom moves, apply post-processing effects, and export production-ready 60fps MP4 and WebM videos.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           RAYLIGHT STUDIO ARCHITECTURE                      │
├─────────────────────┬─────────────────────────────────┬─────────────────────┤
│   LEFT PANEL        │       CENTRAL 3D VIEWPORT       │   RIGHT INSPECTOR   │
│   • Layer Hierarchy │   • WebGL Canvas (Three.js)     │   • Layer Props     │
│   • Scene Scenes    │   • 3D Camera Parallax          │   • Camera Blocks   │
│   • Asset Library   │   • Studio Lights & Shadows     │   • Scene Effects   │
│   • Audio Track     │   • Post-Processing Shaders     │   • Lighting Rig    │
├─────────────────────┴─────────────────────────────────┴─────────────────────┤
│                     TIMELINE & PLAYHEAD DOCK                                │
│   • Multi-Shot Track   • Keyframe Animation Blocks   • Ghost Playhead       │
│   • Waveform Scrubbing • Easing / Bezier Visualizer  • 60fps Transport Loop │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. User Experience & Visual Design

- **Visual Direction**: Dark obsidian studio aesthetic (`#07080d` canvas, `#111114` surfaces, `#27272a` hairline borders) with electric cyan/blue accents (`#0088ff`), clean typography (`Plus Jakarta Sans` and `JetBrains Mono` for timecodes), and strict WCAG AA contrast.
- **Top Bar Contract**:
  - Left: "Raylight Studio" brand mark with project title editor.
  - Center: Clean transport controls (Play/Pause, Loop, Timecode `00:00:00 / 00:03:50`, Framerate `60fps`).
  - Right: Undo/Redo, Project JSON Import/Export, and high-visibility "Export Video" action button.
- **Zero-Occlusion 3D Viewport**: The central canvas remains unobstructed with a floating bottom utility dock for Select, Move, Tilt, Hand, Pen, Shapes, and Text tools.

---

## 4. Key Product Decisions & Trade-Offs

### Decision 1: WebGL Canvas Frame Capture vs 2D Fallback
- **Chosen Approach**: Route video and PNG exports through the active WebGL Three.js render context using offscreen canvas rendering at exact target resolutions (720p, 1080p, 4K).
- **Why**: Guarantees 100% visual parity between what the user sees on screen (3D tilts, device frames, specular highlights, post-processing bloom/vignette) and the exported video.
- **Alternative Considered**: Continuing with the 2D canvas approximation would keep export fast, but produces inaccurate flat renders that discard 3D camera parallax and lighting.

### Decision 2: IndexedDB Asset Persistence
- **Chosen Approach**: Store lightweight project metadata and layer recipes in localStorage / IndexedDB, and route binary data URLs / media blobs into an IndexedDB object store.
- **Why**: Eliminates browser storage quota crashes when uploading multiple screenshots or high-res mockups.
- **Alternative Considered**: Leaving base64 in localStorage leads to silent data loss once project size exceeds 5MB.

### Decision 3: Decoupled Playhead Performance Architecture
- **Chosen Approach**: Keep high-frequency 60fps playhead time in a lightweight store and use direct DOM / canvas render triggers for scrubber needles and Three.js frames, while keeping editor panel re-renders debounced or isolated.
- **Why**: Eliminates 60fps re-rendering of all inspector and hierarchy DOM trees during playback, maintaining smooth 60fps execution on all laptops.

---

## 5. Technical Architecture & Phased Implementation Roadmap

```
               ┌───────────────────────────────┐
               │    useProjectStore (State)    │
               │  • Project JSON Schema        │
               │  • History (Undo/Redo)        │
               └──────────────┬────────────────┘
                              │
               ┌──────────────▼────────────────┐
               │   evaluateProjectAtTime()     │
               │  • Evaluates Shot at Time t   │
               │  • Camera, Lights, Layers     │
               │  • Post-Processing Effects    │
               └───────┬──────────────┬────────┘
                       │              │
       ┌───────────────▼──────┐ ┌─────▼────────────────┐
       │   ViewportCanvas     │ │  Hardware Exporter   │
       │  • Three.js R3F      │ │  • Offscreen Canvas  │
       │  • Physical Shaders  │ │  • WebGL Render Pass │
       │  • Post-Processing   │ │  • MediaRecorder /   │
       │  • Realtime Preview  │ │    GIF89a Encoder    │
       └──────────────────────┘ └──────────────────────┘
```

### Phase 1: Storage & Bug Fixes (P0 Blockers)
1. Fix the layer delete restriction in `App.tsx` so users can delete single or multiple layers.
2. Remove `user-select: none` from input fields in `src/index.css`.
3. Implement IndexedDB storage adapter in `src/storage/projectIO.ts` with transparent fallback for seamless persistence of large image assets.

### Phase 2: WebGL Post-Processing & Visual Fidelity
1. Add post-processing shader pass to `src/stage/webgl/ViewportCanvas.tsx` to render bloom, vignette, chromatic aberration, and film grain driven by `frame.effects`.
2. Add studio reflection environment map (`RoomEnvironment`) for realistic metallic device frame rendering.
3. Optimize `ThreeLayerObject.tsx` texture lifecycle to eliminate GPU memory leaks.

### Phase 3: Hardware WebGL Export Pipeline
1. Upgrade `src/engine/exporter.ts` to capture frames directly from the WebGL Three.js renderer for video (MP4/WebM) and still image (PNG) exports.
2. Implement shot transition compositing (crossfade, slide, push) in the WebGL pipeline.
3. Maintain high-performance GIF89a LZW export with dithering and palette optimization.

### Phase 4: Playhead Performance & Polish
1. Optimize playhead subscription in `App.tsx` to stop unnecessary panel re-renders during 60fps playback.
2. Test and verify compilation, linting, and export functionality.

---

## 6. Verification & Quality Gates

- **Compilation**: `npm run build` must compile cleanly without TypeScript errors.
- **Linting**: `npm run lint` must pass with zero ESLint warnings or errors.
- **Functionality**:
  - Image upload and saving must persist across page refreshes without quota errors.
  - Deleting layers must work for all counts (including last layer and multi-select).
  - Scene effects must visibly alter the WebGL viewport in real time.
  - Video and PNG exports must match the WebGL 3D canvas with full lighting and effects.
