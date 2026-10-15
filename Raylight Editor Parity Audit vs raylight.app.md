# Raylight Editor: Parity Audit vs raylight.app

Prepared 14 Oct 2026 · Codebase: `Raylight.zip` (about 9.5k lines, React 19 + TypeScript + Vite + zustand + Tailwind) · Reference: Raylight Academy docs (canvas, layers, timeline, design-and-animate, cinematic effects, export-and-share, keyboard shortcuts) and raylight.app product pages.

**Caveat:** the live Raylight editor sits behind login, so I could not measure it pixel by pixel. UI parity below follows Raylight's documented structure and behavior. Before polishing visuals, capture screenshots of the real editor (empty project, layer selected, scene selected, timeline open, export dialog) to calibrate spacing, color and type.

## 1. Verdict

The foundation is better than the UI suggests. The data model, deterministic evaluator, easing/spring system, zod schema with migrations, undo with drag transactions, groups, device frames and inspector coverage are all solid and close to Raylight's concepts.

The gap is in four places:

1. **The project does not build cleanly** on a fresh Linux/CI checkout.
2. **Rendering is a CSS approximation.** Scene effects are computed but never drawn, and the camera is a scale, not a real camera.
3. **Export is a stub.** It renders nothing, encodes nothing, and the PNG button exports a blank image.
4. **The editor interaction layer is missing:** tools, pan/zoom canvas, paste/drop import, the Design/Animate split, the two-level timeline, the Animate tool and most shortcuts.

What already matches Raylight: layer kinds (image, text, rectangle, ellipse, line, arrow), device frames (iPhone, iPad, MacBook, browser), 3D tilt and Z depth, per-layer shadow/glow/backdrop blur, blend modes, groups with nesting, animation blocks with easing, a camera with dolly/zoom/dolly-zoom, ten scene effects in a reorderable chain, aspect ratios including 9:16, smart snapping (it already snaps to other layers' edges and centers), undo/redo and a project file format.

## 2. P0: build and correctness blockers

Fix these first. Roughly a day of work.

- **Import path case mismatch.** `App.tsx` imports `./storage/projectIO` but the folder is `src/Storage/`. It works on Windows/macOS, fails on Linux (TS2307). Your `dist/` folder was built locally, but a Vercel/GitHub Actions build will fail. Rename the folder to lowercase `storage`.
- **Undeclared dependencies.** `zustand`, `tailwindcss` and `@tailwindcss/vite` are used (`vite.config.ts`, four stores, `@import "tailwindcss"`) but missing from `package.json`. A fresh clone cannot run. I installed them to type-check.
- **`npm run build` fails on strict TS.** Unused `React` import and unused `resetProject`/`setShowSafeArea` in `App.tsx` (`noUnusedLocals`). `showSafeArea` has no toggle anywhere, so it is permanently on.
- **ESLint: 17 errors.** Includes `setState` inside an effect in `ScrubInput.tsx` and empty blocks in legacy `store.ts`.
- **Dead legacy code still entangled.** `src/engine.ts`, `store.ts`, `types.ts`, `defaults.ts` and `App.css` (Vite template) are not imported by the app, but `model/schema.ts` and `model/defaults.ts` still import `src/types.ts` and `src/defaults.ts`. Move what's needed into `model/`, then delete the legacy files, `hero.png`, `react.svg` and `vite.svg`. Also delete `dist/` from the repo and add it to `.gitignore`.
- **Autosave is write-only.** `saveProjectToBrowser` runs on every project change (including every mouse-move during drags), but `loadProjectFromBrowser` is never called, so a refresh loses everything. Worse, projects store images as base64 in the JSON, which exceeds the localStorage \~5 MB quota quickly and fails silently. Move to IndexedDB: project JSON in one store, asset blobs in another, debounced, restored on boot.
- **Hard-coded initial selection.** `useSelectionStore` starts with `shot-1`, `layer-hero-screenshot`, `block-shift-x`. Any loaded project without those ids starts in a broken selection state. The store also defines `inspectorTab` that `App.tsx` ignores in favor of local state.
- **Image upload metadata is wrong.** Uploads are stored with `width: 1920, height: 1080` regardless of the real image, and the layer is not sized to the image. Raylight drops images flat and fit to the frame. Read natural dimensions via `createImageBitmap`, fit the layer, generate `thumbUrl` (the field exists but is never populated).
- **Upload targets the wrong layer.** The header Upload button writes the asset into whatever layer is selected (or the first layer), silently replacing its image. It should create a new image layer.
- **Performance traps.** `validateProject` (zod) runs on every `updateProject` call, including each drag frame. Playback calls `setCurrentTimeMs` from a `requestAnimationFrame` loop, re-rendering the whole `App` tree 60 times a second and re-evaluating the full project each time. See section 4.
- **Keyboard handler bugs.** Stale dependency array (`deleteLayerFromShot`, `duplicateLayerInShot`, `createGroupFromLayers` missing), Delete is blocked when a shot has one layer, and `* { user-select: none }` in `index.css` also applies to inputs (breaks text selection in Safari and some Chromium inputs). Restrict it to the canvas and chrome.
- **Shot timing is internally inconsistent.** `addShot`/`duplicateShot`/`deleteShot` call `recalculateShotStartTimes` (packs shots back to back, discarding manual positions), while timeline drags allow arbitrary `startMs`. `evaluateProjectAtTime` also forces a minimum 4 s duration even for shorter projects.

## 3. Product model gap: lanes vs scenes

Raylight's model: a project is **one or more scenes on a single timeline**; each scene is a stack of layers with its own camera. Scenes play in order, can be reordered by drag, trimmed by edges, and snap to each other.

Yours: shots on **8 lanes** that can overlap in time. But the evaluator picks one active shot with `find()` (first match), so overlapping lanes are never composited. Lanes are UI that has no rendering meaning.

Recommendation: drop lanes. One row of scenes, ordered, with gapless ripple behavior (or explicit gaps if you want them later). Rename Shot to Scene in UI and types. This removes a whole class of ambiguity and matches Raylight's terminology.

Shot transitions are also incomplete: crossfade/push/slide only animate the **incoming** shot over the background; the outgoing shot is not rendered during the overlap. Real transitions need the evaluator to return both scenes' frames during the transition window.

## 4. Rendering and engine gaps

### 4.1 Scene effects are computed but never drawn (highest-impact gap)

`evaluateEffects.ts` produces state for depth of field, bloom, vignette, motion blur, chromatic aberration, film grain, ghost, color grade, edge fade and glitch. Searching `src/stage/` and `App.tsx` finds **zero** uses of bloom, vignette, grain, chromatic, colorGrade, edgeFade, glitch, ghost, motionBlur, `orderedEnabledPasses` or `deterministicSeed`. Only one thing is applied: a per-layer CSS `blur()` derived from depth of field. The Effects inspector therefore edits values with no visual result.

Even DOF is partial: `bokehShape`, `bokehScale` shape, `highlightThreshold` and `highlightIntensity` have no effect on a uniform Gaussian CSS blur. Raylight's headline look (focus pulls, bokeh, bloom, grain) depends on this.

### 4.2 Camera is a scale, not a camera

`Stage.tsx` applies `translate3d(target) scale(zoom)` to the container that holds all layers, with a CSS `perspective` from FOV. Scaling a whole preserved-3D container uniformly produces no parallax, so **dolly and zoom look identical**, which defeats Raylight's "dolly vs zoom" teaching and its depth-based parallax. `defaultCamera.rotation` is stored but never applied. The "light" is a radial-gradient overlay plus a shimmer sweep, not lighting that responds to device geometry.

### 4.3 Recommended renderer decision

Move stage rendering to **WebGL** (three.js via react-three-fiber, plus a postprocessing chain). Raylight describes its own browser engine built around a 3D scene model: layered depth, a camera, lighting, effects. WebGL gives you real perspective camera movement, true DOF with bokeh shapes, bloom, grain, chromatic aberration, color grade and glitch as shader passes, identical output for preview and export, and a canvas that `toBlob`/WebCodecs can read. Keep DOM only for the selection overlay and text editing.

Lower-fidelity alternative: keep CSS for layers and add SVG/CSS filters for vignette, grain, color grade and bloom approximation. Faster to ship, but dolly parallax, bokeh and export-identical output will not be achievable.

Whichever you pick, the evaluator stays; it is already pure and deterministic, which is exactly what export needs.

### 4.4 Other engine gaps

- **Entrance/exit are single objects.** Raylight lets you stack more than one In and Out preset. Change `entrance`/`exit` to arrays of `Transitionish`.
- **`followPath` is fake.** It shares the `position` code path and has no path data. Either implement spline paths or remove it.
- **No video layers.** Raylight accepts images and video. Add `kind: 'video'` with trim in/out, playback rate, mute and frame-accurate seeking (needed for export).
- **No audio.** Raylight has an audio track under the scenes and a mute key (`M`). Add `project.audio` tracks (clips with start, trim, gain, fade) and mix them on export.
- **Playback clock.** Use a clock ref and drive the renderer imperatively (no React state per frame). Keep React state for the playhead only when paused or scrubbing. Tie audio to the same clock.
- **Placeholder visuals leak into output.** Empty image layers render a fake "Raylight Analytics" dashboard; shapes render their own name, "Blend:" label and a "Glass Npx" badge as content. All of that will appear in exports. Remove it; show empty layers as a neutral dashed placeholder visible only in the editor UI layer.
- **Text.** No inline on-canvas editing (double-click to edit), no font loading (family is a plain string, no Google Fonts or upload), no per-range styling.
- **Figma paste.** Raylight's recommended workflow is Copy as SVG in Figma, then paste; text, shapes and layers arrive separate and editable. Nothing in the codebase handles `paste`, `drop` or the clipboard.

## 5. Export and share gaps

- `runVideoExportPipeline` evaluates each frame and **discards the result**. It never renders, encodes or downloads. `exporting` is never reset if it throws.
- `exportCurrentFrameAsPng` looks up a `<canvas>` in the stage, but the stage is DOM-only, so it falls back to a brand-new empty canvas and downloads a **blank PNG**.
- `exportProjectToFile` (JSON) works but embeds base64 assets. Add a bundled format (zip with assets) later.

What to build, matching Raylight's export dialog:

- **Format:** MP4 (with audio) and GIF (silent loop).
- **Resolution and fps:** up to 1080p and 60 fps; 4K optional. Frame size derives from aspect ratio.
- **Quality presets:** Studio (largest/sharpest) down to Web (smallest), with Social Media as the default.
- **Scope:** entire timeline or only the selected scene.
- **Live estimate** of export time and file size as settings change, a progress bar and a cancel button.
- **Option** to add a small badge (if you want a free/paid distinction) and an "open result when done" toggle.
- **Implementation:** deterministic frame loop rendering to an `OffscreenCanvas`, `VideoEncoder` (WebCodecs) plus a muxer such as mp4-muxer or mediabunny for MP4, `gifenc` for GIF, `AudioEncoder` for the mixdown. Fall back to a clear error where WebCodecs is unavailable.
- **Share:** Raylight's Share button gives a live link that plays the scene in-browser without an account, and each MP4 export also gets a share page. These need a backend. A reasonable first step is a single-file HTML player export (project JSON plus runtime) you can host anywhere.

## 6. Editor interaction parity (canvas)

### 6.1 Workspace

Raylight: the frame is a bright rectangle in the center of an **infinite workspace**; everything outside is off-screen working room. Pan with scroll, hold `Space` or `H`. Zoom with `⌘ Scroll` or pinch.

Yours: the frame auto-fits the container, `overflow-hidden` clips everything outside it, and there is no pan, no zoom and no zoom-to-fit. Build a viewport transform (pan x/y, zoom), render the frame outline over a dimmed workspace, and let layers show outside the frame at reduced opacity.

### 6.2 Tools (floating toolbar at the bottom of the canvas)

There is no tool state in the app. Add a `useToolStore` and a floating toolbar with:

- `V` Select (default; drag moves a tilted layer along its own plane)
- `G` Move (screen space, ignores tilt)
- `Y` Tilt (drag to angle in 3D; you have a tilt handle in `SelectionOverlay`, but it is not a tool)
- `H` Hand (pan)
- `C` Cut (scissors on timeline clips)
- `⇧A` Animate (edits become motion)
- `T` Text, `I` Image, `R` Rectangle, `O` Ellipse, `L` Line, `⇧L` Arrow: click to place a default size, or drag to size
- `Esc` Deselect

### 6.3 The Animate tool (the biggest conceptual feature)

In Raylight, most edits change how a layer sits at rest. With Animate on (`⇧A`), the same edits are recorded as a **block ending at the playhead**; outside that tool nothing records. Your block model already stores deltas (`amount` is a change, not an end value), which fits this perfectly. Implementation: on pointer-down in Animate mode snapshot the layer, on pointer-up diff against the snapshot, and emit blocks for position, rotation, tilt, scale, opacity or size with `startMs` set so the block ends at the playhead, easing defaulting to a preset. The same should work from inspector edits while the tool is active.

### 6.4 Selection and editing

- `⌘ Click` should add/remove (yours uses Shift for toggle); `⇧ Click` should select the range in the layer list.
- `⌘ Click` on canvas for deep select (a layer behind another), marquee selection, `⌘A` select all in scene.
- Multi-selection should move, edit and animate as one unit.
- Nudge with arrows (`⇧` for big steps), restack `]` / `[` and `⌘ ]` / `⌘ [`.
- Align `⌥A`/`⌥D`/`⌥W`/`⌥S`/`⌥H`/`⌥V`; flip `⇧H`/`⇧V`; opacity `1` to `9`; hide/show `⌘⇧H`; ungroup `⌘⇧G`.
- Copy/paste layers `⌘C`/`⌘V`, paste images from the clipboard, drop images/video onto the canvas, drag assets from the library onto the canvas.
- Right-click context menu (duplicate, group, bring to front, hide, lock, delete).
- **Shortcuts today:** only `Space`, `⌘Z`, `⌘⇧Z`, `⌘G`, `⌘D` and `Delete`. Build a central shortcut registry that also powers tooltips and a Help-menu shortcuts dialog (Raylight keeps its full list inside the editor under Help).

## 7. Left sidebar parity

Raylight has two tabs: **File** (tree of scenes, groups and layers) and **Assets**.

Yours has three: Layers, Shots, Assets. Merge Layers and Shots into one **File tree**: scene rows containing groups and layers, indented, top row in front. Specific changes:

- **Drag to restack** and to move into/out of groups. Today restacking is up/down buttons only (no drag at all in `LeftPanel.tsx`).
- Hover eye toggle (you have hide), double-click rename (you have this), `⌘ Click`/`⇧ Click` selection, `⌘G` grouping.
- **Search** field in the File tab that filters by name and keeps the selection scrolled into view.
- **Assets:** images and video you imported, drag onto canvas to reuse without re-uploading.
- When the timeline is open, a panel under the tree should mirror the open scene's layers, each row level with its track on the right (names left, timing right).

## 8. Right sidebar parity: Design and Animate

Raylight's right sidebar has two Figma-style tabs for the selected layer. Yours has six colored tabs (Layer, Shot, Trans, Blocks, Camera, Effects) in 10px text.

**Design tab** (how it looks):

- Position: X, Y, Z, plus roll, flip and align
- Tilt: X and Y angle
- Layout: size and crop
- Appearance: opacity and corner radius
- Fill and stroke
- Effects: per-layer drop shadow, glow, backdrop blur
- Text layers swap these for words and font controls

**Animate tab** (how it moves):

- In and Out presets, stackable
- During: blocks for movement in the middle
- Timing and easing per block, with a curve picker
- A picker at the top to add custom blocks and effects

**Context-dependent panes:**

- **Scene selected** (or its bottom layer): scene effects (depth of field, bloom, vignette, motion blur, color split, film grain, ghost, color grade, edge fade), scene background and export.
- **Nothing selected:** the project itself: name, aspect ratio, background. Today the aspect-ratio dropdown lives in the header and the background has no UI.
- **Camera** is a track on the timeline, not an inspector tab; **Light** is a track shown when the scene uses a device frame. Keep a small camera-block inspector that appears when a camera clip is selected.
- Your `ScrubInput`, `LayerInspector` (983 lines), and effects/camera inspectors can be reused inside the new structure; mostly it's regrouping and removing the per-tab accent colors.

## 9. Timeline parity

Raylight's timeline works at **two levels**.

- **Zoomed out (whole video):** scene blocks in playing order (drag to reorder, drag an edge to trim, they snap to each other) and an audio track.
- **Zoomed in (one scene):** click a scene to open it; the timeline fills with that scene's layers, one row each, plus a **Camera** track and a **Light** track. Click the dimmed area on either side to step back out.

Yours is a single fixed-height (`h-80`) panel that always shows layer tracks and 8 shot lanes together, a duplicated layer-name column, and no camera or light tracks. **Camera blocks are not on the timeline at all**; they can only be edited in `CameraInspector`.

What to add:

- Two-level model with enter/exit behavior as above, and camera and light tracks with draggable clips.
- An audio track with waveform, trim and mute (`M`).
- Transport: play/pause, scrub with playhead snapping to scene edges, a zoom slider next to Play.
- Editing: Scissors `C` plus click, `⌘B` split at playhead, `Q`/`W` trim in/out to playhead.
- Navigation: `⌘ Scroll` zoom, `⇧ Scroll` pan, `⇧Z` fit to view, `⌘ +`/`⌘ −`.
- Playhead keys: `←`/`→` nudge, `⇧←`/`⇧→` jump, `↑`/`↓` previous/next scene, `Home`/`0` start, `End` end.
- Resizable timeline height; ruler in timecode with frame ticks at high zoom.
- Existing good parts to keep: block dragging with 10 ms snap, in/out handles on layer bars, loop toggle, time readout.

## 10. UI and visual-system parity

- **Chrome density and hierarchy.** The header packs project name, save toast, aspect ratio, snap, Upload, Open, Save, PNG, Export MP4, Undo and Redo. Raylight's pattern is lean: project name and menus on the left, Share and Export as the primary actions on the right. Move Open/Save/Upload into a File/Help menu bar, move Undo/Redo and Snap into the canvas toolbar, move aspect ratio into the project pane.
- **Floating bottom toolbar** over the canvas (section 6.2) with shortcut tooltips.
- **Remove debug telemetry.** The stage's top-left badge (aspect, "Snap: ON", "Selected: N"), the pulsing "Production Auto-Saved" toast and the visible key-light pin dot are developer UI. Move the light pin into the Light track or a selection-only gizmo, and show save state as a quiet indicator.
- **Palette.** You use navy surfaces (`#07080d`, `#0c0e17`) with indigo, fuchsia, emerald and purple accent tabs. Raylight's theme is near-black (`#000000` theme color) with restrained neutral chrome. Define design tokens (surface 0-3, border, text 1-3, one accent) in CSS variables and replace the per-feature accent colors.
- **Typography and accessibility.** Pervasive `text-[9px]`/`text-[10px]` and `text-gray-500` on dark backgrounds fall below comfortable size and contrast. Set a 11-12px minimum for controls, add `aria-label`s and focus rings, and avoid color-only state.
- **Selection gizmo polish.** Selection currently draws a 2 px indigo border on some layer types inside the layer itself, which will appear in exports; selection must be an overlay only.
- **Empty states and onboarding.** Raylight starts from a dropped screenshot, a Figma paste or a template. Add a start screen/project dashboard with templates, plus an empty-canvas hint ("Drop an image or paste from Figma").
- **Menus and help.** File/Edit/View/Help menus, a shortcuts dialog under Help, tooltips showing key bindings.
- **Responsive layout.** Fixed `w-80` right panel and `h-80` timeline leave little canvas on small laptops; make both resizable and collapsible.

## 11. Beyond the editor core (separate product surfaces)

These exist on raylight.app but are not editor-canvas parity; scope them separately:

- Templates library, remix and creator marketplace
- Share pages, live project links and embeds (needs backend and auth)
- Sound (music, SFX, voiceover) and Capture for Mac (screen recording)
- Design mode for 3D product mockups
- Agents and the MCP server (drive the editor from Claude/ChatGPT/Cursor). Your pure, schema-validated project JSON plus a command layer over the zustand actions is a good basis for this later.
- Accounts, plans, 1080p vs 4K gating and credits

## 12. Suggested roadmap

**Phase 0: unblock (1 day).** Fix the P0 list: rename `storage`, declare dependencies, clear TS and lint errors, delete legacy files, restore autosave from IndexedDB, fix upload metadata. *Acceptance:* `npm ci && npm run build && npm run lint` pass on Linux; refreshing restores the project; uploading adds a correctly sized new layer.

**Phase 1: renderer.** Choose WebGL (recommended). Real camera, lights, per-layer DOF, then scene effects as passes (bloom, grain, vignette, color grade, chromatic aberration, glitch, edge fade, ghost, motion blur). *Acceptance:* dolly shows parallax and zoom does not; every Effects-inspector toggle visibly changes the frame; frame N renders identically twice.

**Phase 2: export.** OffscreenCanvas frame loop, WebCodecs MP4, GIF, dialog with presets, scope, estimate, progress and cancel; fix PNG. *Acceptance:* a 10 s 1080p60 project exports to a playable MP4 matching the preview.

**Phase 3: interaction layer.** Infinite canvas with pan/zoom, tool store and toolbar, shortcut registry, copy/paste, drop/paste import, Animate tool, multi-select rules, align/flip/restack. *Acceptance:* every shortcut in Raylight's list works or is consciously deferred.

**Phase 4: panel restructure.** File tree with drag restack and search, Design/Animate tabs, scene and project panes, two-level timeline with camera, light and audio tracks, scene model without lanes, stackable In/Out. *Acceptance:* all editing is reachable without leaving the canvas, timeline and two sidebars.

**Phase 5: import and media.** Figma SVG paste into editable layers, video layers, audio clips, font loading, inline text editing.

**Phase 6: product surfaces.** Templates, share/player export, then backend features as needed.

## 13. Data-model changes to schedule

- `Shot` becomes `Scene`; remove `lane`; add ordering only.
- `LayerBase.entrance`/`exit` become arrays.
- New `kind: 'video'`; new `Project.audio` clips; `AssetRecord` stores a blob key instead of `dataUrl`.
- Groups become a real tree used by the File panel (they already have `parentGroupId`).
- Camera blocks and light keyframes surfaced as timeline clips.
- Bump `schemaVersion` and extend `migrateProject` for each change (the migration hook already exists).
