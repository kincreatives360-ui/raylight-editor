# Raylight Editor

A browser based 2D/3D motion design editor built with React, TypeScript, Three.js, React Three Fiber, Zustand, and Vite.

## Run locally

```sh
npm install
npm run dev
```

The app is served by Vite at the local URL printed in the terminal. Use `npm run build` to type-check and create a production build, `npm run lint` to run ESLint, and `npm run preview` to serve the latest build locally.

## Main areas

- `src/model`: project types, defaults, and Zod validation.
- `src/store`: project, selection, and playhead state.
- `src/stage`: canvas, selection controls, and WebGL scene.
- `src/panels`: project/layer inspectors and the timeline.
- `src/engine`: evaluation, rendering, importing, audio, and export.
- `src/storage`: browser autosave and project JSON import/export.

## Project data

The current project is autosaved in browser `localStorage`. Imported media is stored as data URLs in project state, so large media files can exceed browser storage quotas. Export a `.raylight.json` project file to keep a portable copy.

## Current limitations

- Video files are represented as timeline media clips; they are not time-synchronized video-texture layers in the canvas renderer.
- PNG and animated GIF exports use the 2D project renderer. Video export records a rendered canvas using the browser's `MediaRecorder` support; the available container/codec depends on the browser.
- WebGL-only scene rendering and audio mixing are not included in the 2D export pipeline.
- The project does not currently define an automated test script. The available checks are TypeScript/Vite production build and ESLint.
