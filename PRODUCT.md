# Raylight Motion Graphics Editor — Product Truth & Specification

## 1. Executive Summary & Vision
Raylight Editor is a high-performance, browser-native 2D and 3D motion graphics studio designed for motion designers, frontend developers, and product storytellers. Built with React 19, TypeScript, Three.js, React Three Fiber, Zustand, and Vite, it delivers the fidelity, spatial depth, and choreographic precision of desktop animation software directly within an interactive, zero-install WebGL canvas.

The core product philosophy is **"Motion design without the heavyweight desktop suite"**:
- Instant startup with zero plugins or compilation steps.
- Direct spatial manipulation in 3D perspective with realistic camera optics and studio lighting rigs.
- Procedural 3D hardware chassis (smartphones, laptops, tablets, displays) with physical material finishes and interactive screen glare.
- Seamless multi-shot choreography with spring physics, easing handles, synchronized audio tracks, and client-side 4K UHD rendering.

---

## 2. Target Personas & Primary Workflows

### Personas
1. **Product Marketers & Launch Teams:** Need photorealistic hardware mockups, dynamic camera push-ins, and animated teaser clips for product launches and social campaigns without 3D CAD modeling.
2. **Motion Designers & Animators:** Require non-destructive keyframing, custom cubic bezier curves, spring dynamics, multi-source studio lighting, and audio synchronization for polished video output.
3. **Frontend Engineers & UI Designers:** Rapidly prototyping interactive 3D UI showcases, responsive micro-animations, and portfolio presentations with clean JSON export and reproducibility.

### Primary User Journeys
* **Journey A — Build a Teaser:** Create a shot → Add media and typography → Animate the composition → Export a 60fps MP4 video.
* **Journey B — Custom Multi-Shot Choreography:** Create new shot → Position 3D device frame with titanium finish → Configure two camera framings (Wide Establishing and Macro Push-In) → Bind camera block with spring physics easing → Add ambient lighting and specular rim spotlight → Split clip at transition point → Synchronize whoosh sound FX.
* **Journey C — Multi-Platform Social Delivery:** Switch project aspect ratio between `16:9` (Widescreen landscape) and `9:16` (Vertical Reels/TikTok) → Adjust safe-zone guides → Export 1080p / 4K UHD video package.

---

## 3. Core System Architecture & Data Model

### State Separation & Domain Architecture
State management is decoupled into three high-performance Zustand stores:
1. **`useProjectStore` (`src/store/useProjectStore.ts`):**
   - Owns the complete project hierarchy: `Project`, `Shot[]`, `Layer[]`, `Group[]`, `Framing[]`, `CameraBlock[]`, `LightRig`, `SceneEffects`, and `AudioTrack`.
   - Manages non-destructive Undo/Redo history stack (up to 50 snapshots).
   - Validates documents against Zod schemas on load, repair, and modification.
2. **`usePlayheadStore` (`src/store/usePlayheadStore.ts`):**
   - High-frequency clock driving real-time playback (`currentTimeMs`), play/pause state, looping mode, and timeline scrubber hover states.
   - Decoupled from heavy project mutations to ensure smooth 60fps animation without re-rendering inspector panels.
3. **`useSelectionStore` (`src/store/useSelectionStore.ts`):**
   - Tracks multi-layer selection (`selectedLayerIds`), active shot, selected camera block, active inspector tabs, guide toggles, and panel collapse states.

### Data Schema & Validation (`src/model/schema.ts`)
All projects conform to a validated schema (`CURRENT_SCHEMA_VERSION = 2`). Defensive migration and repair algorithms automatically reconcile older documents or partial JSON imports:
```typescript
interface Project {
  id: string;
  name: string;
  schemaVersion: number;
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:5';
  fps: 24 | 30 | 60;
  background: ProjectBackground;
  assets: Record<string, ProjectAsset>;
  audio?: ProjectAudio;
  shots: Shot[];
}
```

---

## 4. Comprehensive Feature Matrix

### 3D Spatial Canvas & Device Frames
* **Procedural 3D Device Chassis:** High-fidelity 3D frames for `iphone`, `ipad`, `macbook`, `samsung-galaxy`, `display`, and `browser`.
* **Physical Finishes:** Realistic material rendering with `titanium`, `space-black`, `silver`, `midnight`, and `black` surface shaders.
* **Optical Shading:** Adjustable screen glare reflection, specular gloss factor, screen edge glow, and laptop lid opening angle (`lidAngle`).
* **Spatial Manipulation:** 3D coordinates (X, Y, Z), 3D tilt, roll, orbit, scale, and opacity blending.

### Camera Choreography & Spring Physics
* **Framing Anchors:** Keyframed camera viewpoints capturing target position (X, Y, Z), zoom factor, camera roll, and orbit angle.
* **Camera Blocks:** Non-destructive camera movement spans across the timeline with `zoom`, `dolly`, and `dollyzoom` modes.
* **Spring Dynamics Engine (`src/engine/easing.ts`):** Real-time spring physics simulation (`evaluateSpring`) with stiffness, damping, and mass parameters.
* **Built-in Spring Presets:** `bouncy` (overshoot reveal), `snappy` (quick lock), `smooth` (cinematic glide), `gentle` (slow subtle drift), `wobbly` (playful oscillate), and `tight` (precise UI transition).
* **Cubic Bezier Curves:** Standard cubic bezier transitions (`ease-in-out`, `ease-out`, `ease-in`, `linear`) with interactive bezier handle controls.

### Studio Lighting Rigs & Post-Processing
* **Three-Point Studio Lighting:** Key light with adjustable 3D position, intensity, color temperature (2000K–10000K), and shadow mapping.
* **Multi-Source Rig:** Add custom `directional`, `point`, and `spot` lights with beam angle, penumbra feathering, and target aiming.
* **7 Studio Lighting Presets:**
  1. *Studio Neutral* (Clean balanced 6500K commercial light)
  2. *Cyberpunk Neon* (Dramatic cyan key with magenta specular rim)
  3. *Warm Sunset* (Golden 3200K key with deep amber fill)
  4. *Moody Rim* (High-contrast silhouette rim lighting)
  5. *High Key Commercial* (Bright clean studio with soft shadows)
  6. *Midnight Blue* (Cool moonlight with specular glints)
  7. *Golden Hour* (Warm dramatic grazing sunlight)
* **Post-Processing FX:** Bloom threshold & intensity, vignette feathering, chromatic aberration, film grain, and glitch distortion.

### Timeline Editing & Sound FX
* **Multi-Track Timeline:** Dedicated tracks for Shots, Camera Choreography, Layer Animation Blocks, and Audio Clips.
* **Split Clip Scissors Tool:** Instant clip splitting at playhead via interactive Scissors button or `S` keyboard shortcut with non-destructive state management.
* **Curated Sound FX Library (`src/data/curatedSounds.ts`):** 150+ professional audio samples across 10 categories (Ambience, Click, Glitch, Impact, Pop, Riser, Slide, Typing, UI, Whoosh) with live audio preview and 1-click timeline instantiation.
* **Waveform Audio Playback:** WebAudio mixing with volume envelope, mute/solo flags, and playhead synchronization.

### Production Export Pipeline
* **Resolution Presets:** 4K UHD (`3840×2160`), 1080p Full HD (`1920×1080`), 720p HD (`1280×720`).
* **Frame Rate Support:** 24 fps (Cinematic), 30 fps (Web), 60 fps (Ultra-Smooth).
* **Format Generation:**
  - MP4 video recording with frame-by-frame rendering and WebAudio track multiplexing.
  - Frame-accurate animated GIF generation.
  - High-resolution PNG sequence and single-frame capture.

---

## 5. Parity & Verification Truth

| Category | Reference Feature | Raylight Editor Status | Parity Level |
| :--- | :--- | :--- | :---: |
| **3D Engine** | WebGL 3D Canvas with Three.js | React Three Fiber with custom shader passes | **100%** |
| **Hardware Chassis** | 3D Device Frames (iPhone, Mac, etc.) | 6 device models with 5 physical finishes | **100%** |
| **Physics** | Spring-based camera interpolation | RK4 spring solver with 6 curated presets | **100%** |
| **Lighting** | Multi-source studio rig + shadow mapping | 7 studio presets + directional/spot/point | **100%** |
| **Audio Library** | Curated Sound FX browser | 150+ tracks with search & category filters | **100%** |
| **Timeline** | Keyframe blocks + Clip Splitting | Scissors tool + `S` hotkey + track rack | **100%** |
| **Export** | 4K UHD, 1080p, 60fps MP4 | Full client-side MediaRecorder pipeline | **100%** |
| **Accessibility** | Dark studio UI, ARIA standards | WCAG AA contrast, sub-10px text eliminated | **100%** |

---

## 6. Technical Boundaries & Operational Constraints

1. **Client-Side Autonomy:** All state, rendering, physics calculations, and video transcoding execute entirely within the client's browser. No private user media or project data is sent to external processing servers.
2. **Local Persistence:** Active session state is serialized to `localStorage` with defense against quota limits. Media assets are kept in memory and IndexedDB.
3. **Project File Interchange:** Portable `.raylight.json` format allows instant backup, team sharing, and cross-machine restoration.

---

## 7. Deterministic Behavior Contracts (Phase 0 Baseline)

### 7.1 Global vs. Shot-Local Timebase Contract
* **Global Time (`globalTimeMs`):** Ranges from `0` to `totalProjectDurationMs = sum(shot.durationMs)`. Audio clips on the project audio track (`project.audio.clips`) are authored in global project time (`clip.startMs`, `clip.durationMs`).
* **Active Shot Resolution:** Shots occupy contiguous half-open intervals `[shot.startMs, shot.startMs + shot.durationMs)` for non-terminal shots, and a closed interval `[shot.startMs, shot.startMs + shot.durationMs]` for the terminal shot so the final frame remains evaluable.
* **Shot-Local Time (`shotLocalTimeMs`):** Defined strictly as `clamp(globalTimeMs - activeShot.startMs, 0, activeShot.durationMs)`.
* **Layer & Media Timebase Invariant:** All shot-owned entities—including `layer.inMs`, `layer.outMs`, entrance/exit transitions, `layer.blocks`, `shot.cameraBlocks`, `shot.lightBlocks`, `shot.effectBlocks`, `shot.focusBlocks`, and **video element seeking (`targetSec = Math.max(0, (shotLocalTimeMs - layer.inMs) / 1000)`)**—MUST be evaluated against `shotLocalTimeMs`, never raw `globalTimeMs`.

### 7.2 Shot Transition Composition Contract
* When `activeShotIndex > 0` and `activeShot.transition.type !== 'none'` with `shotLocalTimeMs < activeShot.transition.durationMs`, `evaluateProjectAtTime` sets `shotTransition.isTransitioning = true`, computes eased `progress` $\in [0, 1)$, and evaluates `outgoingFrame` from the immediately preceding shot.
* Both the WebGL stage (`ViewportCanvas`) and the 2D Canvas renderer (`canvasRenderer`) must composite `outgoingFrame` (backgrounds, visible layers, and lights) alongside the incoming `frame` using identical opacity/slide transforms (`crossfade`, `push`, `slide`).

### 7.3 Preview, Fallback & Export Parity Contract
* **WebGL Preview (`ViewportCanvas`):** Primary interactive and stage-capture renderer.
* **Canvas 2D Fallback (`canvasRenderer`):** Deterministic software fallback when WebGL context is unavailable or bypassed; receives the exact same `EvaluatedFrame` contract (including scene/camera motion vectors for `motionBlur`).
* **Export (`exporter`):** Steps deterministically across the target frame range, seeks only active incoming/outgoing video layers using `shotLocalTimeMs`, verifies decoded video frame readiness before capture, and mixes scheduled audio clips across the export range.

### 7.4 Save Durability & Undo Grouping Contract
* **Undo Grouping:** Continuous pointer drags (stage move/resize/rotate, `ScrubInput` drags, timeline bar/block trims) call `beginDragTransaction()` on first movement beyond deadzone, apply intermediate updates with `{ skipHistory: true }`, and call `commitDragTransaction()` on pointer release to record exactly one undo step.
* **Save Durability:** Browser autosave writes lightweight metadata to `localStorage` and full asset blobs transactionally to `IndexedDB` (with `OPFS` supplementary disk streaming), preserving the last-known-good snapshot if quota limits are reached.
