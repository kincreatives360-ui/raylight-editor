# Raylight Editor — Product Truth

## Mission
Raylight Editor is a browser-based 2D/3D motion graphics studio built with React 19, TypeScript, Three.js, React Three Fiber, Zustand, and Vite. It empowers motion designers and developers to choreograph multi-shot camera moves, layer-based 2D/3D transforms, lighting rigs, post-processing effects, and audio tracks directly in the browser with real-time 60fps WebGL preview and client-side MP4/GIF/PNG rendering.

## Core Capabilities & User Stories
1. **Scene & Shot Management**:
   - Multi-shot timeline sequencing with independent durations, transitions (cut, crossfade, dissolve, wipe), and background configurations (solid, linear/radial gradient, image).
2. **2D/3D Layer Canvas & Stage**:
   - Plane-aware 3D spatial positioning (X, Y, Z coordinates, 3D tilt, roll, orbit).
   - Rich layer types: Vector Shapes (rectangle, ellipse, polygon, line, arrow, pen paths), Typography, Media (images, videos), and Device Mockups.
   - Smart snap guides, safe zones, alignment distribution, and live transform gizmos.
3. **Lighting Rig & Shading**:
   - Key light, fill light, ambient terms, and directional / point / spot sources with shadow mapping.
   - Device surface gloss and specular reflection models.
4. **Timeline Choreography & Keyframing**:
   - Non-destructive animation blocks with spring and cubic bezier easing curves.
   - Synchronized audio tracks with WebAudio playback and waveform skimming.
5. **High-Fidelity Client-side Export**:
   - MP4 video recording with audio synchronization via MediaRecorder.
   - Frame-accurate animated GIF and high-res PNG still generation.

## Technical Architecture & Constraints
- **State Architecture**: Zustand stores with discrete domain separation:
  - `useProjectStore`: Project hierarchy, undo/redo history, layer and shot data.
  - `usePlayheadStore`: High-frequency playhead clock (`currentTimeMs`), playback state, and skimmer time.
  - `useSelectionStore`: Multi-layer selection, active tool modes, zoom/pan transform states.
- **Data Integrity**: Zod schemas (`src/model/schema.ts`) validate all project documents and prevent corruption or schema drift across versions.
- **Rendering**: Hybrid WebGL 3D canvas (`ViewportCanvas`) alongside 2D export renderers.
- **Persistence**: Non-blocking IndexedDB asset storage combined with browser localStorage session recovery.
