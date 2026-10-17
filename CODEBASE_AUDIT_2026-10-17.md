# Codebase audit — 2026-10-17

## Changes made

- Removed the unused Vite starter images and replaced the Vite template README with the actual app structure, run commands, persistence behavior, and known export/import limits.
- Debounced browser autosave and added a `pagehide` save so high-frequency project changes do not serialize the full project on every update.
- Skipped whole-project validation during pointer-move drag transactions and validate once when the transaction commits.
- Fixed browser video export reporting success when canvas capture or `MediaRecorder` is unavailable. Export errors are shown in the dialog, the UI recovers from failures, and the capture stream is stopped after completion or cancellation.
- Split export code behind dynamic imports, so the GIF/video encoder is loaded when export is requested.
- Lazy-loaded the 3D stage so the editor shell and panels can load separately from the WebGL renderer.
- Made React Hooks, no-unused-vars, no-explicit-any, no-empty, and prefer-const audit rules fail lint instead of producing warnings.
- Moved `@types/three` from runtime dependencies to development dependencies.
- Added the optional gradient type to the project model/schema and removed unsafe type casts from gradient and inspector handling.
- Replaced several state synchronization effects that triggered React lint warnings with derived or guarded prop synchronization.

## Remaining constraints

- The production build still warns about a large WebGL stage chunk (~1.22 MB minified); the main entry is ~527 KB. The stage is lazy-loaded, and the export path is split out. Further splitting Three.js/R3F needs runtime verification to ensure it does not destabilize the editor.
- Imported media is stored as data URLs in browser `localStorage`. Large files can exceed the browser quota; IndexedDB would be a better backing store for media assets.
- Imported video is a timeline clip and is not a time-synchronized canvas texture. The current PNG/GIF/video export pipeline uses the 2D renderer and does not include WebGL-only effects or mixed audio.
- MP4 output depends on browser `MediaRecorder` codec support. Browsers without MP4 support produce WebM, and unsupported recording environments now raise an error.
- There is no automated test script or test suite configured. Validation for this audit is TypeScript/Vite build and ESLint.

## Verification

`npm run lint` and `npm run build` were run after the changes. See the task summary for their final output and the remaining chunk warning.
