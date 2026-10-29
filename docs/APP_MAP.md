# Raylight Editor — App Map

This guide explains the editor in everyday language. It describes what a person can do in the app, where each part lives in the project, and what still needs work before the app should be called production complete.

## What the app is

Raylight Editor is a browser-based motion design workspace. You build scenes from pictures, video, text, shapes and 3D device mockups; animate them across shots; add camera moves, lighting, sound and visual effects; then save or export the result.

## The screen, from left to right

| Area | What a person uses it for | Main code |
|---|---|---|
| Top bar | Name the project, open and save project files, undo or redo changes, open help and start an export. | `src/App.tsx` |
| Left panel — File | See shots and their layers; add, rename, copy, hide, lock, group or remove them. Search the layer list and choose the active shot. | `src/panels/LeftPanel/LeftPanel.tsx` |
| Left panel — Assets | Bring in images, video, SVG artwork, backgrounds and sound effects. Preview sounds and add them to the timeline. | `src/panels/LeftPanel/LeftPanel.tsx`, `src/data/curatedSounds.ts`, `src/engine/soundPacks.ts` |
| Main stage | See the current shot, select and move objects, work with camera and lighting tools, adjust the view and check guides. The stage is where the finished image is previewed. | `src/stage/Stage.tsx`, `src/stage/CanvasToolbar.tsx`, `src/stage/webgl/ViewportCanvas.tsx` |
| Right inspector — Design | Change the selected object's appearance, text, shape, device frame, fill, image fit, lighting or effects. With nothing selected, adjust project or shot settings and backgrounds. | `src/panels/Inspector/RightSidebar.tsx`, `src/panels/Inspector/sections/` |
| Right inspector — Animate | Record or edit how a selected object or camera changes over time. | `src/panels/Inspector/sections/LayerAnimateInspector.tsx`, `src/panels/Inspector/sections/CameraBlockSection.tsx` |
| Timeline | Play, pause and scrub through the work. Arrange shots, object changes, camera moves, lighting changes and audio; resize or split clips. | `src/panels/Timeline/Timeline.tsx`, `src/panels/Timeline/AudioClipBar.tsx` |
| Export window | Choose video, GIF or image output; select size, frame rate and export range; see progress and cancel an export. | `src/ui/ExportModal.tsx`, `src/engine/exporter.ts` |

## What you can make

- **Scenes and shots:** Break a project into separate scenes, then change the order, duration and transition between them. Each shot can have its own layers, camera moves, lighting and scene effects.
- **Artwork and objects:** Add text, images, video, SVG artwork and shapes. Select, arrange, duplicate, group, hide, lock and animate them.
- **Device mockups:** Place phone, tablet, laptop, display and browser-window frames around screen content. Set their finish, screen look and position.
- **Backgrounds:** Use a plain color, image or animated shader background. Set the fit and adjust visual properties such as blur and dimming.
- **Motion:** Record object changes at the playhead, set animation blocks and easing, and move the camera across a shot.
- **Camera and lighting:** Set the camera framing and lens, add camera moves, and use the scene lighting controls and presets.
- **Effects:** Adjust effects on a whole scene or on an individual layer. Scene effects include depth of field, bloom, atmosphere, color split, film grain, ghosting, color grading, gradient maps, vignette, motion blur, edge fade, glitch, fish-eye and lens distortion. Layer effects and device-specific looks have their own inspector controls.
- **Sound:** Add a sound clip to the timeline, preview built-in effects, and control playback and mute settings.
- **Files and recovery:** Save or reload a `.raylight.json` project, and let browser storage keep a local working copy.
- **Exports:** Create video, animated GIF, a still image or a set of images, using the sizes and frame rates offered in the export window.

## How a change travels through the app

```text
Person changes a control
        ↓
Inspector, timeline, or stage updates the project
        ↓
Project data is checked and stored
        ↓
The scene evaluator works out what should be visible at this time
        ↓
The stage draws the result; export uses the same scene data to make output
```

| Behind-the-scenes area | Plain-language job | Main code |
|---|---|---|
| Project information | Describes projects, shots, layers, animation, lighting, effects and assets. | `src/model/types.ts`, `src/model/defaults.ts` |
| Safety checks for project files | Checks imported and saved project data and handles older project formats. | `src/model/schema.ts`, `src/storage/projectIO.ts` |
| Project and undo history | Keeps the editable project, applies changes and lets people undo or redo them. | `src/store/useProjectStore.ts` |
| Selection and workspace settings | Remembers what is selected, which panels are open and which editing tool is active. | `src/store/useSelectionStore.ts` |
| Playback clock | Keeps the timeline and preview at the same moment in the project. | `src/store/usePlayheadStore.ts` |
| Scene calculator | Works out the position, appearance, camera, lights and effects for a requested moment. | `src/engine/evaluateShot.ts` (project and shot evaluation), `src/engine/evaluateLayer.ts`, `src/engine/evaluateCamera.ts`, `src/engine/evaluateLight.ts`, `src/engine/evaluateEffects.ts` |
| Main picture renderer | Draws the interactive 3D stage and its visual effects. | `src/stage/webgl/ViewportCanvas.tsx`, `src/stage/webgl/sceneRenderLoop.ts`, `src/stage/webgl/sceneEffectPasses.ts` |
| Backup picture renderer | Draws a 2D version when the main WebGL path is unavailable. Some complex effects may not look exactly the same in both paths. | `src/engine/canvasRenderer.ts`, `src/engine/canvasSceneEffects.ts` |
| Local saving and project files | Saves project data and media in the browser and reads or writes project files. | `src/storage/projectIO.ts`, `src/storage/opfsStorage.ts` |
| Sound playback | Reads audio clips, keeps preview playback in time and creates waveforms for the timeline. | `src/engine/audioEngine.ts` |
| Output making | Captures the current scene and packages the requested output file. | `src/engine/exporter.ts`, `src/engine/gifEncoder.ts`, `src/engine/stageCapture.ts` |
| Reusable controls | Supplies shared buttons, sliders, menus, color pickers, dialogs and keyboard help. | `src/ui/` |

## Main paths through the app

1. **Start a project:** Open the editor, set the project frame shape, and use the left panel to add a shot.
2. **Build a scene:** Add media, text, shapes or a device frame. Use the stage to position it and the right panel to change its look.
3. **Animate it:** Move the timeline playhead, record changes or add a camera move, then adjust the timing in the timeline.
4. **Polish the scene:** Set the background, lighting, sound and scene or layer effects.
5. **Save and share:** Save a project file for future editing, or open Export to make a video, GIF or image output.

## Current completeness check

**The app is a working build, but the project is not yet a complete, fully verified production release.** The production build and automated test suite pass, which shows that the source compiles and the tested behaviors work. That does not prove every long editing workflow, browser, GPU and export behaves correctly.

The clearest remaining work is in video export. `src/engine/exporter.ts` uses the browser's live `MediaRecorder` and a real-time render loop; it can skip overdue frames in some export modes. It is therefore not a frame-by-frame, speed-independent export pipeline. The repository's own `DELIVERY_NOTES.md` and `IMPLEMENTATION_PROMPT.md` also call out deterministic video output, broader export/audio checks, browser end-to-end testing, performance testing and a supported-browser check as unfinished release work.

So: **you can run and use the editor, and it has broad editing features; expect further updates before relying on it for production-critical, frame-perfect exports across browsers.**

## Where to look first

- To change the main workspace: `src/App.tsx`
- To change what appears on the stage: `src/stage/`
- To change the left list or asset browser: `src/panels/LeftPanel/`
- To change object settings: `src/panels/Inspector/`
- To change timeline behavior: `src/panels/Timeline/`
- To change what can be stored in a project: `src/model/` and `src/storage/`
- To change animation or scene calculations: `src/engine/`
- To change reusable controls: `src/ui/`
