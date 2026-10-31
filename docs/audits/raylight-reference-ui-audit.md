# Raylight Reference Editor UI Audit

**Date:** 2026-10-31  
**Reference:** `https://www.raylight.app/editor/b3ceadf3-75d9-4110-a3bf-8b7a5af18d80`  
**Scope:** Visible editor workspace, tool menus, inspector modes, timeline, preview, command menu, export dialog, and shortcut panel. The project artwork and its text are not part of this audit.

## Summary

The reference and this app share the same core editing model: a layer tree, a 3D canvas, floating tools, a timeline, and a contextual inspector. This repo already has the stronger implementation surface for rendering and manipulation in `src/stage`, `src/engine`, and `src/panels`. The fastest route to parity is to preserve that engine and align the workspace shell and interaction surfaces around it.

The reference link was private in the in-app browser. An already-open, signed-in Chrome tab could access it. The observations below come from that live tab and the screenshots supplied in the request. UI interactions were limited to opening menus/dialogs, entering/exiting preview mode, and reading controls. No reference project edits were retained.

## Reference Workspace

At the inspected desktop size, the reference uses three persistent regions:

1. **Left project dock:** project menu and insert button; File/Assets tabs; layer search; expandable shot/layer tree.
2. **Center editor:** 3D canvas, camera controls, contextual floating tool dock, and a timeline below the canvas. In preview mode, the stage expands and the timeline becomes a compact playback strip.
3. **Right inspector:** account/display/export/share actions at the top; Project settings when nothing is selected; Design/Animate tabs for selected layers; persistent help/AI entry at the bottom.

The supplied screenshot is a 1920×872 view; the signed-in browser inspection used a 1536×696 viewport. Keep widths and toolbar placement responsive rather than copying either viewport's pixel dimensions.

## Observed Interactions

| Surface | Observed behavior |
| --- | --- |
| Pointer tools | Select (`V`), Hand (`H`), Orbit (`Shift+F`), Tilt (`Y`), Move (`G`), and Scissors (`Shift+C`) are grouped in a dropdown. |
| Shape tools | Rectangle (`R`), Ellipse (`O`), Polygon, Line (`L`), Arrow (`Shift+L`), Image/video, and Audio (`Shift+I`) are grouped in a dropdown. Pen, Comment, and Frame are separate toolbar tools. |
| Object inspector | Design and Animate tabs are contextual to a selected object. Design exposes alignment, position, depth/rotation, tilt, size, opacity, fill, stroke, frame, mask, and effects. Project mode exposes name, aspect ratio, frame rate, lens, and background. |
| Animation | Animate mode is a tool (`Shift+A`) described as making edits into animation. The Animate panel has Animations, In, and Out areas. Add animation opens Custom, Appearance, and Effects groups. The reference shortcut panel says easing for a selected block opens with Enter. |
| Selection | Click selects a layer; modifier-click adds/removes, Shift-click selects a range, and Command-click deep-selects on the canvas. The overlay has resize and corner controls. The visible circular rotation knob was the control identified for removal in this app. |
| Timeline | Play/Pause uses Space; Home/End move to timeline bounds; arrow keys nudge the playhead; Shift+arrows jump it. Shot clips advertise drag-to-reorder, right-edge trim, and double-click to open layer tracks. Alt-drag scales selected clips evenly. The ruler and zoom slider adjust time scale. |
| Workspace visibility | Display settings toggle layers, sidebar, timeline, and canvas. Safe zones are disabled outside 9:16. Preview mode hides layers/sidebar/timeline, expands the canvas, and shows compact playback controls. |
| Command menu | A searchable palette groups Project, Playback, Timeline, Tools, Edit, Add, View, Theme, and Help actions. Arrow keys move through results, Enter runs the selected command, and Escape closes it. Destructive actions are listed but were not activated. |
| Export | The reference offers MP4/GIF/Image; 24/25/30/50/60 fps; 720p/1080p/paid 4K; Studio/Social/Web/Low compression; a keep/remove badge choice; and share-link visibility/link controls. Export was not started. |

## Motion Evidence

Computed styles in the live editor showed:

- Toolbar buttons use a **150 ms** transition with `cubic-bezier(0.4, 0, 0.2, 1)`.
- The command dialog uses a **200 ms** enter animation/transition with `ease` timing.
- The loaded CSS includes generic enter/exit, accordion, toast, skeleton, and agent-presence keyframes. These are not evidence that every editor panel uses each animation.

The reference project had no visible animation blocks at the inspected playhead, so its actual layer motion curves and playback interpolation could not be measured. The shortcut panel and Animate UI establish the interaction model, but not the full timing/easing design of an animated example.

## Current App Mapping

| Reference surface | Existing owner in this repo | Parity notes |
| --- | --- | --- |
| Three-column shell | `src/App.tsx`, `src/app/useAppWorkspaceLayout.ts`, `src/ui/workspaceLayout.ts` | Left dock, stage/timeline, and inspector already share the workspace. Panel resize and narrow-screen collapse already exist. Keep these owners and improve layout behavior there. |
| Project/layer dock | `src/panels/LeftPanel/LeftPanel.tsx`, `src/panels/LeftPanel/FileTab.tsx` | File/Assets tabs, layer search, project menu, shot/layer tree, and asset panels exist. |
| Canvas and 3D manipulation | `src/stage/Stage.tsx`, `src/stage/CanvasToolbar.tsx`, `src/stage/SelectionOverlay.tsx`, `src/stage/webgl/ViewportCanvas.tsx` | Three.js via React Three Fiber already renders the scene; pointer, camera, shape, text, light, crop, and selection interactions are implemented. Pen is currently grouped under the shape menu. |
| Deterministic animation/render state | `src/engine/evaluateShot.ts`, `src/engine/evaluateLayer.ts`, `src/engine/evaluateCamera.ts`, `src/engine/evaluateEffects.ts` | Preserve these pure evaluation owners; the UI should continue to edit the same project model rather than introducing a second animation state. |
| Timeline | `src/panels/Timeline/Timeline.tsx`, `src/panels/Timeline/useTimelineViewport.ts`, `src/store/usePlayheadStore.ts` | Playback, ruler, zoom, resize, shot/layer/camera/light/audio tracks, trim/move operations, and playhead are already present. Refactor presentation without replacing timeline operations. |
| Design/Animate inspector | `src/panels/Inspector/RightSidebar.tsx`, `src/panels/Inspector/sections/LayerDesignInspector.tsx`, `src/panels/Inspector/sections/LayerAnimateInspector.tsx` | Contextual Design/Animate split exists. Project/shot settings and layer-specific sections are implemented. |
| Command menu | `src/ui/CommandMenu.tsx`, `src/app/useAppCommandList.ts` | Searchable keyboard-driven command menu exists; compare command groups and labels with the reference before adding duplicates. |
| Export | `src/ui/ExportModal.tsx`, `src/app/useAppExport.ts`, `src/engine/exporter.ts` | Local file export is implemented. The “Made in Raylight Watermark” card was only informational UI; there is no matching watermark code in the export engine. That card has been removed as requested. |
| Persistence | `src/app/useAppProjectPersistence.ts`, `src/storage/projectIO.ts` | Project state saves locally through browser storage/IndexedDB. The reference's share links, account, credits, and paid badge removal need service contracts and are not local UI-only features. |

## Recommended Refactor Order

### 1. Workspace shell and visibility

Keep the current left/stage/timeline/right ownership. Align header placement and spacing to the reference, expose display controls for layers/sidebar/timeline/canvas, and add a canvas-focused preview state that temporarily hides docks while preserving a compact player. Keep the current Figma-derived token palette and route all shell surfaces through the existing semantic tokens.

### 2. Tool dock and navigation

Keep existing Select/Pointer, Animate, Shape, Text, Grid, Lighting, and Components behavior. Promote Pen from the shape dropdown to a dedicated tool. Add Comment and Frame only after defining their model, selection, persistence, and keyboard behavior; the current local tool model has no comment tool, and the existing device-frame inspector is not automatically equivalent to the reference's Frame tool. Preserve the command menu and reconcile its groups/hotkeys against the reference shortcut panel.

### 3. Selection overlay and direct manipulation

Retain the dashed depth perimeter and the resize/corner-radius controls. Remove the visible circular rotation handle and its tether, as requested; keep rotation available through the existing inspector controls and corner hit zones. Dragging, resizing, camera movement, and selection should remain direct pointer interactions with current project transactions.

### 4. Timeline and animation presentation

Retain the current timeline engine and tracks. Bring ruler density, clip hierarchy, and selected-block presentation closer to the reference. Make the Animate tool, Design/Animate tabs, In/Out presets, custom animation categories, and selected-block easing controls read as one coherent workflow. Validate the existing time evaluation rather than replacing it.

### 5. Export and sharing boundary

Keep the current functional local export settings and metrics. Do not copy credit purchases, paid-plan badge removal, account actions, or link-sharing controls until the app has real account, billing, and share-link APIs. The reference badge is an actual export choice; the removed local card was not.

### 6. Motion polish

Use the measured reference values as the UI baseline: 150 ms / `cubic-bezier(0.4, 0, 0.2, 1)` for toolbar controls and 200 ms / `ease` for dialog entry. Keep direct manipulation immediate. Continue honoring the current `prefers-reduced-motion` support; do not add spring/bounce to ordinary menus or layout changes without observed reference evidence.

## This Turn's Changes

- Restored the dashed 3D perimeter after the previous change removed it.
- Removed the visible circular rotation knob and connector from the selection overlay; corner rotation hit zones and inspector rotation remain.
- Removed the informational watermark row from the local export modal and updated its existing expectation. No test suite was run.
- The viewport-based timeline cap, stage flex sizing, and named shell tokens from the prior pass remain in place.
