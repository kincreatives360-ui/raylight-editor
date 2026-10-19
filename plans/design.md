# Raylight Editor Replica — Design System and Interaction Specification

**Purpose:** A single source of truth for the UI, interaction states, timeline, visual language, and staged implementation of a Raylight.app-style motion-graphics editor.

**Project context:** React + TypeScript + Vite, with Zustand stores, a Three.js / React Three Fiber canvas, and the existing `src/` structure. This document describes the intended reference experience and a safe way to evolve the current replica. It is not a claim that every authenticated live-editor control has been click-tested.

## 1. Evidence and interpretation rules

Use these labels while implementing:

- **Reference-confirmed:** described in Raylight's public Academy/product pages or visible in public screenshots.
- **Repo-observed:** the current replica contains relevant code for this behavior or control.
- **Target behavior:** the behavior the replica should provide to be coherent and predictable; confirm against the live editor if pixel-perfect parity requires it.
- **Live verification required:** public sources do not fully establish the exact state, animation, copy, or control behavior.

Do not invent a behavior and then describe it as fact. When the reference cannot be tested, implement the most conservative behavior consistent with the existing data model and mark it for later comparison.

## 2. Product mental model

The editor is a desktop-first composition workspace. A project contains ordered **shots/scenes**. A shot contains a 3D stage, a stack of layers, possible camera moves, lighting, scene-wide effects, and optionally audio/media. Each layer has a visual design and may have animation blocks. The editor is organized into four principal regions:

1. **Top bar:** project-level actions, file/project menu, export and contextual actions.
2. **Left sidebar:** File/layer hierarchy and Assets library.
3. **Center stage/canvas:** the composition, selection handles, transform tools, camera view, and workspace around the export frame.
4. **Right inspector:** context-sensitive Design and Animate tabs, plus shot, camera, background, lighting, and effect controls when those objects are selected.
5. **Bottom timeline:** switches between whole-project/shot sequencing and the selected shot's internal layer-animation view; it is resizable.

The selected object determines the inspector context. Selection, playhead time, active shot, timeline mode, and active inspector tab are distinct state concepts; do not collapse them into one variable.

## 3. UI state matrix

### 3.1 Nothing selected on the canvas

**Target behavior**
- Remove layer transform handles and layer-specific selection outlines.
- Keep the current shot visible and keep the timeline, layer list, and stage in sync.
- The right inspector shows project/shot-level controls rather than stale controls from the previously selected layer. If the app has a selected shot but no selected layer, show shot settings; if no shot is selected, show project-level settings or a clear empty state.
- Design/Animate tabs may be hidden or disabled if they only apply to layers. Do not leave the inspector displaying a previous layer's editable values.
- Clicking empty canvas space clears layer selection unless the active tool requires a click/drag (for example, Rectangle or Text creation).
- Clicking empty space while dragging a transform should not clear selection mid-drag.

**Reference/repo note:** Raylight documents scene-wide controls as available when selecting the scene itself or the bottom layer. The replica's `RightSidebar.tsx` has different contexts for selected layer, selected camera block, and scene/project controls. Verify the exact no-selection screen against the live editor.

### 3.2 A shot is selected

- The shot becomes the active editing context; its layers, background, lighting, camera and effects populate the stage/inspector.
- The shot-level timeline block is highlighted. The playhead and ruler must remain aligned to the same project time.
- Shot settings should include available duration/transition and scene-level options. In the replica, `SceneTransitionSection.tsx` includes Hard Cut, Crossfade, Push and Slide, with a duration field for non-cut transitions.
- The left hierarchy shows the selected shot's layers, with order/depth represented consistently.
- If a layer was selected in a different shot, do not silently apply edits to it. Either clear the layer selection or restore a valid selection within the active shot.
- Selecting a shot should not unexpectedly change the global zoom or timeline height.

### 3.3 A shape is selected (rectangle, ellipse/circle, polygon, line, etc.)

**Design tab**
- Show the selected layer's name/type and actions such as hide/show, lock/unlock and delete.
- Show transform/position controls: X, Y and Z/depth; rotation/roll where supported; tilt X/Y; alignment/flip controls where applicable.
- Show geometry/layout controls appropriate to the shape: width/height and shape-specific values. Do not show image crop or text font controls for a generic shape.
- Show Appearance: opacity and corner radius only where meaningful (e.g. rounded rectangle; omit or disable for line/ellipse if the data model cannot apply it).
- Show Fill and Stroke controls, including color, stroke width and supported style. A line should expose stroke-oriented settings and should not show a misleading fill control unless the renderer supports it.
- Show per-layer effects, such as drop shadow, glow or backdrop blur, only if supported for the selected layer.

**Animate tab**
- Show animation blocks attached to this layer: custom animations, In presets, During blocks and Out presets, according to the current implementation's model.
- Adding a block changes the selected layer's animation data and the timeline representation. It must not create a duplicate block when the control is clicked once.
- Selecting a block should reveal that block's own parameters; it should not switch to the Design tab unless the user requests it.

**Canvas**
- Show a clear selection outline and appropriate handles. Resize handles change size; rotation/tilt handles should be separate and only appear when the active tool/mode supports them.
- Dragging a handle updates the same layer values shown in Design. Numeric edits update the canvas and handles.
- Snapping guides should appear only while useful and disappear when the drag ends.

### 3.4 An image is selected

**Design tab**
- Show image-layer name and common transform/appearance controls.
- Show source/replace-image action and image-fit/crop controls if supported. Width/height should affect the rendered image bounds; crop must affect the image viewport rather than accidentally stretching the source pixels.
- Keep opacity, position/depth, rotation, tilt and supported layer effects available.
- Do not show text editing or vector fill/stroke controls unless they are explicitly supported for image layers.

**Animate tab**
- Same block model as other animatable layers: In, During/custom and Out.
- Position/depth, rotation, scale and opacity are common animation channels. Only expose channels the evaluator can render.

**Asset behavior**
- Replacing an image should preserve the layer identity, animation references, and transform unless the reference explicitly resets them. Importing a new image creates a new layer. The Assets panel should not be confused with the current shot's layer hierarchy.

### 3.5 A video is added

**Target behavior / live verification required**
- Importing a video creates a media layer and/or clip with a stable asset reference, duration, and intrinsic dimensions. Preserve aspect ratio by default.
- The layer should be visible in the hierarchy with a recognizable video/media icon and name.
- The canvas displays the current video frame at the playhead. Scrubbing must seek the media preview and remain synchronized with the project time.
- Timeline representation should communicate the clip's duration and start/end. Audio from the video should be represented separately only if the product supports extracted/linked audio; avoid silently creating duplicate sound tracks.
- Design exposes transform, opacity and supported crop/fit controls. Animate exposes supported layer animation channels.
- A missing/unloaded/unsupported video should show an error or placeholder and must not break playback for the rest of the project.
- The exact native Raylight video import controls, codec limits, and whether video appears as a layer or separate timeline clip require live verification. Do not assert these details as confirmed solely from public documentation.

### 3.6 Camera is activated or a camera move is selected

Distinguish **activating the camera tool/view** from **selecting a camera-move block**. They are different states.

- Camera tool activation changes canvas interaction: pointer gestures manipulate the camera/view rather than selecting or transforming a layer. Show camera-specific cursor/controls and avoid changing layer geometry accidentally.
- Selecting a camera move opens camera-block parameters in the right inspector. The current replica contains a dedicated Camera Move inspector in `RightSidebar.tsx` with From and To endpoint sections, framing anchors, zoom, roll, orbit and tilt; mode, shake, timing/duration, easing, and delete action are also represented.
- The timeline camera block should be selected/highlighted; changing endpoint parameters updates the preview and the camera block without changing a layer's transform values.
- A camera move interpolates from a From framing to a To framing over its duration and easing. Start/end timing must be clamped to the shot duration.
- Add Camera Move should create one initialized block with valid endpoints and a sensible duration. Repeated clicks should add one block per click, not duplicate through event bubbling.
- Camera movement can be a true 3D dolly or a flat zoom depending on the selected mode/reference behavior. Preserve that distinction in the model and UI.

### 3.7 Orbit camera is opened

**Target behavior / live verification required:** public pages describe camera moves and the replica has `orbit` and `tilt` endpoint parameters, but the exact standalone Orbit Camera panel/overlay was not fully live-tested.

- Entering orbit mode should visibly indicate that orbit manipulation is active.
- Orbit drag changes camera orbit/rotation around the chosen focal/anchor point; it should not move the selected layer.
- Show only camera-relevant values (orbit, tilt, anchor/framing and possibly focus) and provide a clear way to exit/cancel the mode.
- If the orbit UI is a popover/panel, clicking outside may close the popover but should not erase camera values. Escape should cancel the transient interaction, not delete a camera block.
- If the reference has an on-canvas orbit gizmo, implement it as a distinct camera overlay, not by reusing layer resize handles with different meanings.
- Verify axis directions, drag sensitivity, cursor and whether orbit edits the current camera pose or the selected block endpoint before claiming exact parity.

### 3.8 An effect under a layer is clicked

- Selecting an effect row should select that effect's settings, not the parent layer's transform controls only.
- Right inspector shows the effect's editable parameters and enable/disable state. Keep the parent layer context visible (breadcrumb or section title) so the user knows which layer owns the effect.
- Toggle controls enable/disable an effect without deleting its settings. A delete/remove action removes only that effect instance.
- Effects should render in a deterministic stack order; reordering is only offered if the renderer has a meaningful order.
- Effect parameter edits update the canvas preview and persist in the layer data. Undo/redo should treat a drag/continuous adjustment as one sensible edit rather than hundreds of independent history entries.
- If effects appear as children in the timeline, expanding/collapsing the layer should show/hide those rows without changing effect timing. Do not create separate animation rows for static effects unless they are animatable.

## 4. Inspector: Design and Animate

### 4.1 Design tab: resting appearance

Design describes what the selected object looks like at its base/resting state. It is not the place to silently create time-based animation. It can include:

- **Identity/actions:** layer name, type, layer order, visibility, lock and delete.
- **Transform:** X/Y/Z, roll/rotation, tilt X/Y, alignment, flip, scale/size as supported.
- **Layout:** width, height, aspect/crop/fit controls for relevant media.
- **Appearance:** opacity, corner radius where meaningful.
- **Fill and stroke:** color, stroke thickness and applicable vector properties.
- **Typography for text:** content, font family, size/weight/style, color and other supported text properties.
- **Layer effects:** drop shadow, glow, backdrop blur and other supported effects.
- **Scene-level settings:** background, lighting, transitions and global effects when the scene/context is selected or no layer is selected.

Changes in Design update the base state. If Animate mode is explicitly recording an animation, that is a different operation and must be visually indicated.

### 4.2 Animate tab: time-dependent behavior

The Animate tab defines how the selected layer changes over time.

- **In:** entrance presets. The public Raylight guide says entrance presets can stack. A plus opens a picker; choosing a preset adds an entrance entry. A minus removes the associated entry, not all entrances. Eye/visibility controls, where present, disable/enable preview without destroying configuration.
- **During / custom animation blocks:** time-based motion such as position/depth X/Y/Z, rotation, scale and opacity. A plus opens the custom block picker in the replica. The selected block exposes duration/start, values, direction and easing/curve controls as supported.
- **Out:** exit presets. A plus opens the exit picker; minus removes the specific exit entry. Multiple exits/entries should follow the data model's ordering rules.
- **Timing/easing:** duration, start/end, easing presets or spring/curve controls. Timing values must be clamped to valid shot/layer ranges.
- **Playhead relationship:** the public guide states that edits made with the Animate tool can become blocks ending at the playhead; outside the Animate tool, edits are resting design. The tool shortcut is Shift+A according to the public guide. This distinction must be visible and consistent.
- **Picker:** top-level add/picker allows the user to choose an animation/effect type. A menu should close after a choice and not open twice due to parent/child handlers.

### 4.3 Plus and minus controls are contextual

Never implement one generic “plus/minus means the same thing everywhere” rule. Their meaning depends on the section:

| Location | Plus behavior | Minus/remove behavior |
|---|---|---|
| Custom Animations | Open block-type picker; selecting an option creates one block | Remove the specific block/row associated with that control |
| In | Open entrance preset picker; selected preset is added | Remove the associated entrance entry only |
| Out | Open exit preset picker; selected preset is added | Remove the associated exit entry only |
| Camera | Add one initialized camera move | Remove the selected camera move via its dedicated action |
| Lighting | Open light-type selector or add selected light type | Remove the selected light source only, with safe confirmation if destructive |
| Layer hierarchy | Add menu creates a layer/shape/text/media item | Delete selected layer; do not confuse with collapsing a group |
| Shot timeline | Add shot creates one new shot at a defined insertion point | Remove shot only through an explicit shot action, with dependent timing recalculated |
| Effects | Add an effect instance or open effect picker | Remove that effect instance, not the parent layer or all effects |
| Background/color controls | A plus may add a gradient stop or another supported item | A minus removes that stop/item while enforcing valid minimum counts |

Exact native Raylight behavior for each minus icon should be verified from the live editor. In the replica, every control must have a tooltip/accessibility label that names the object it adds/removes.

## 5. Scene, background, lighting and effects

### 5.1 Background

The public Design page describes device frames, materials and backgrounds including shader, image, color, custom and silk-to-mesh gradient. The replica's `BackgroundSection.tsx` has background-kind and gradient-related controls.

- Background is shot/scene-scoped, not a child layer unless the model explicitly represents it as one.
- Changing background type should preserve compatible settings where possible (e.g. color value when switching solid color types) and avoid stale hidden fields leaking into another type.
- Image backgrounds require asset loading/error states. Gradient editors need stable stop identity and correct +/- semantics.

### 5.2 Lighting

The replica's `LightingSection.tsx` includes a light-type selector (`+ Add Light...`), positioning/shadow controls and selected-light animation. The public design page shows example lighting values including color, ambience, key light, color temperature and intensity-like parameters; those displayed values are examples, not universal defaults.

- Lights are scene-scoped entities with stable IDs and a type.
- Each light exposes only the controls meaningful for its type: position/direction, color, intensity/power, temperature, ambience and shadow properties as supported.
- Adding a light creates one light; deleting it must not delete another light because array indices changed.
- If light animation is supported, its timeline/inspector selection must not be confused with layer animation.

### 5.3 Scene-wide effects

Public documentation lists depth of field, bloom, vignette, motion blur, color split, film grain, ghost, color grade and edge fade. The replica's `SceneEffectsSection.tsx` currently exposes depth of field, bloom, film grain, color grade and vignette in that section; this does not prove the remaining effects are absent elsewhere.

- Scene-wide effects are applied after the scene is rendered, rather than attached to one layer.
- Each effect has an enable/disable state and parameters. Disabled settings remain stored.
- Depth of field controls focus depth and blur outside the focal range; bloom adds soft highlight glow; grain adds texture; vignette darkens/fades edges; color grade adjusts overall color; motion blur communicates movement; color split separates color channels; ghost creates trails/echoes; edge fade softens edges.
- Effects should have one canonical data representation and one renderer path. Do not duplicate effect settings in both a scene object and a second global store.

### 5.4 Layer effects

Drop shadow, glow and backdrop blur are per-layer effects described by the public guide. They should be stored under the owning layer and rendered only for that layer. The selected effect's parameter UI should remain separate from the parent layer's Design controls while still showing the parent context.

### 5.5 Transitions

The replica has Hard Cut, Crossfade, Push and Slide. Transition duration is shown for non-cut transitions. Shot reorder/trim must recalculate start times and preserve valid transition ranges.

## 6. Canvas and tools

### 6.1 Stage and export frame

The public Canvas guide describes a true 3D stage: the bright frame is the export area; the surrounding region is workspace. Preserve this distinction. The stage should be visually dominant, with a neutral dark workspace around the frame, subtle guides, and clear selection overlays.

### 6.2 Tools and shortcuts

Public documentation lists V Select, G Move, Y Tilt, H Hand, T Text, I Image, R Rectangle, O Ellipse, L Line. Canvas navigation: scroll, Space+drag or H to pan; Cmd+scroll/pinch to zoom. Arrow keys nudge; Shift increases nudge size; snapping assists alignment; `]`/`[` restacks layers; Cmd-click selects behind; Cmd+G groups and Cmd+Shift+G ungroups. Confirm platform-specific modifier behavior (Cmd vs Ctrl) in the replica and support the host OS appropriately.

- Select tool selects and transforms objects.
- Move tool moves in screen space and ignores tilt, per the public guide.
- Tilt tool adjusts tilt.
- Hand tool pans.
- Text/Image/Rectangle/Ellipse/Line tools create their corresponding objects.
- Polygon support should be added only if the reference has it; don't infer its exact vertex UI from generic shape support.

### 6.3 Selection overlays

- Overlay geometry must derive from the same layer transform used by the renderer.
- Pointer coordinates must be converted from screen space to stage/world space once in a shared utility.
- Handles must not intercept clicks intended for the object body.
- Multi-selection needs a clearly defined primary layer for inspector values. Do not merge unrelated values without an explicit mixed-value representation.

## 7. Timeline specification

### 7.1 Overall structure

The bottom timeline has two major contexts:

1. **Whole-project / shot level:** ordered shot blocks across project time; optionally audio tracks below them.
2. **Shot detail / layer level:** tracks for the active shot's layers, camera, lighting and any supported timed objects/effects.

The public timeline guide describes these as whole-video and scene-detail levels. The timeline is resizable by dragging its top edge. The current replica has a `ResizeObserver`, a drag handle and timeline-height state/logic in `Timeline.tsx`.

### 7.2 Shot-level timeline

- Each shot is a block laid out horizontally according to start time and duration.
- Clicking a shot selects it and makes it the active editing context. The inspector changes to shot-level settings if no layer selection takes precedence.
- Dragging a shot reorders it; shot start times are recalculated from the new order.
- Dragging shot edges trims duration. The implementation must enforce a minimum duration and keep transition timing valid.
- The public guide documents scene/shot blocks in order, dragging to reorder, dragging edges to trim, and audio below the shots.
- A visible playhead represents the current project time. Clicking/scrubbing the ruler moves the playhead and updates the preview.
- Empty areas of the shot timeline should remain interactive for scrubbing and shot creation only when the relevant affordance is explicit. Hovering an empty area may show a time cursor/tooltip or an “add shot” affordance; do not create a shot on hover alone.
- Dragging the timeline's blank background should not reorder a shot unless the pointer started on a shot drag handle/block.

### 7.3 Layer-level timeline

- One row per layer, with stable row order matching the layer hierarchy/depth order unless the reference uses a separate order.
- The selected layer's row should be highlighted and synchronized with canvas and inspector selection.
- Animation blocks are placed at their start time and sized by duration. Their labels/colors should communicate block type without requiring the user to infer meaning from color alone.
- Camera track appears separately from layer rows. The public guide also describes a light track when a device frame is used; implement only where the model supports it.
- Layer expansion can reveal animation/effect subrows where appropriate. Collapsing rows should not delete or alter blocks.
- Static layer effects are not automatically timeline clips. Only show an effect row if it has timing or is part of the documented interaction.
- Blocks support select, drag-to-move, trim edges and delete. Clamp blocks to valid shot boundaries. Use snapping where appropriate.
- Selecting an animation block should select its owning layer and the block itself; the inspector should show the block's parameters.

### 7.4 Empty-area hover

- Hovering the ruler or empty timeline region should show a vertical hover line and/or time readout if that is the established UI behavior. It must not move the actual playhead until click/drag starts a scrub.
- Hovering an empty row may show a contextual add affordance, but it must not insert a clip automatically.
- If a camera block or clip is previewed at hover time, make that a separate hover-preview state; never overwrite stored playhead time simply because the mouse moved.
- Cursor feedback should distinguish scrubbing (`ew-resize`/scrub cursor), block drag (`grab`/`grabbing`), trim (`ew-resize`) and blank area (`pointer` or default).
- Hover states should disappear on mouse leave and not become stuck after pointer cancellation.

### 7.5 Playheads

Maintain separate values for:
- **Actual playhead time:** authoritative project/shot time used for rendering and playback.
- **Hover time:** transient preview/readout for the current pointer position.
- **Drag/scrub origin:** time and pointer coordinate captured at drag start.
- **Shot-relative time:** actual project time minus the active shot's start time, clamped to the shot range.

Behavior:
- Clicking the ruler sets actual playhead time.
- Dragging the playhead scrubs continuously; preview, timecode, active shot and timeline indicator stay synchronized.
- Playback advances actual playhead time; when paused, it remains stable.
- Switching shots maps project time to the correct shot-relative time and should not create a negative/out-of-range value.
- Hovering must not overwrite the actual playhead. The current replica's `Timeline.tsx` distinguishes hover time and playhead display time; preserve that separation.
- At shot boundaries, determine whether the playhead selects the next shot or stays at the previous shot's end and use the same rule in rendering, inspector and timeline.

### 7.6 Resizing, zooming and scrolling

- Drag the top resize handle vertically to change timeline height. The central stage should resize to the remaining viewport without changing the project composition or zoom unexpectedly.
- Use a minimum and maximum timeline height. Clamp to the available viewport so the timeline cannot cover the top bar or collapse the canvas entirely.
- ResizeObserver should update layout-dependent calculations when container dimensions change; do not attach multiple observers on every render.
- Horizontal zoom changes pixels-per-time-unit, not actual timing data. Cmd-scroll is documented for zoom; Shift-scroll pans; Shift+Z fits the timeline. Use platform modifier mapping as appropriate.
- Vertical row scrolling and horizontal time scrolling must remain independent. Keep the time ruler aligned with every track.
- When zoom changes, preserve the time under the cursor or the current playhead as the anchor if possible. Fit-to-view should show the relevant project/shot range.
- Resize/zoom must not mutate shot durations, animation start times, or camera block timing.

### 7.7 Timeline style

- Dark panel, subtle dividers, compact row height and restrained contrast.
- Ruler and track headers remain readable at low zoom; labels should truncate instead of overflow into adjacent blocks.
- Selected blocks use a clear accent outline/fill; hover is weaker than selected. Disabled/muted items are visually distinct but remain legible.
- Playhead line is visually dominant and runs consistently through ruler and track area. The handle should be draggable with a generous hit target.
- Empty rows should remain visually quiet; add affordances appear on hover rather than permanently cluttering every row.

## 8. File/Assets sidebar and project actions

- File tab contains project/layer hierarchy. Rows are indented for nesting; top rows are in front and lower rows behind, as documented by Raylight. Dragging rows restacks; grouping/ungrouping is explicit.
- Clicking selects; double-click renames; eye toggles visibility; Cmd-click toggles multi-selection; Shift-click selects a range. Lock state prevents canvas transform edits.
- Assets tab holds imported images/videos and should not be conflated with the current shot's layer rows.
- Add menus should clearly separate shape/text/media, grouping, camera/light/effects and project-level actions.
- Save/load must preserve IDs, animation links, assets, shot order and timing. Undo/redo should be introduced only with a single canonical command/history path.

## 9. Audio

The public Sound page describes voiceover, generated sound effects, music/score, EQ, compressor, reverb, delay, filter, distortion, per-track faders/pan/live meters/master bus and volume automation.

- Audio tracks appear below shots at project level or in the designated audio region.
- Clips have stable source references, start/duration and waveform/label where available.
- Fader, pan and effect parameters belong to a track; master bus is project-level.
- Volume automation is time-dependent and should have a clear lane/curve representation.
- Don't implement fake meters that imply actual audio analysis if none exists.

## 10. Figma import

Raylight's public product information says a Figma design can be copied as SVG and pasted as editable layers. The replica's `figmaSvgImporter.ts` is the relevant import path.

- Pasted SVG should preserve supported text/shapes as editable layers rather than flattening everything to one image.
- Unsupported SVG filters/gradients should degrade gracefully and be reported rather than silently corrupting the document.
- Keep SVG import parsing separate from UI components. Sanitize/validate external SVG content and use a stable ID mapping.

## 11. Design tokens and visual system

### 11.1 Current repo observations

`src/index.css` currently sets:
- page background `#07080d`
- foreground `#f3f4f6`
- font stack `-apple-system, BlinkMacSystemFont, Inter, Segoe UI, Roboto, sans-serif`
- scrollbar track `#0b0d14`, thumb `#262936`, 6px scrollbar width/height, 3px radius
- global `box-sizing: border-box` and `user-select: none`, with text selection restored for inputs, textareas and contenteditable fields.

The source contains many literal colors, including `#0088ff`, `#1c1c1f`, `#18181b`, `#0a0a0c`, `#a1a1aa`, `#71717a`, `#e4e4e7`, `#d4d4d8`, `#38bdf8`, `#a855f7`, `#8b5cf6`, `#6366f1`, `#fbbf24`, `#f43f5e` and many one-off values. These are evidence of a dark UI and blue accent, but not proof of a coherent existing token system. Consolidate repeated colors into tokens only after checking their context; don't globally replace colors that communicate different states.

### 11.2 Recommended semantic tokens

Use CSS custom properties in one central file. Values below are a proposed coherent baseline based on the repo's current palette; compare with the live reference before treating them as final pixel-perfect values.

```css
:root {
  color-scheme: dark;
  --ui-bg: #07080d;
  --panel-bg: #0b0b0d;
  --panel-raised: #111114;
  --panel-hover: #18181b;
  --panel-active: #1c1c1f;
  --canvas-workspace: #080a10;
  --surface-border: rgba(255,255,255,.08);
  --surface-border-strong: rgba(255,255,255,.14);
  --text-primary: #f3f4f6;
  --text-secondary: #a1a1aa;
  --text-muted: #71717a;
  --text-disabled: #52525b;
  --accent: #0088ff;
  --accent-hover: #1d9bff;
  --accent-soft: rgba(0,136,255,.14);
  --focus-ring: rgba(56,189,248,.8);
  --success: #34d399;
  --warning: #fbbf24;
  --danger: #f43f5e;
  --purple: #8b5cf6;
  --radius-xs: 3px;
  --radius-sm: 5px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --control-height: 28px;
  --row-height: 28px;
  --sidebar-width: 240px;
  --inspector-width: 300px;
  --timeline-min-height: 180px;
  --timeline-default-height: 280px;
  --timeline-max-height: 60vh;
}
```

### 11.3 Color usage rules

- Primary text: section titles, active values and essential labels.
- Secondary text: descriptions, inactive labels and less important metadata.
- Muted text: placeholders and disabled-but-readable information.
- Accent blue: active selection, focused control, playhead, selected timeline item, and primary action. Avoid using accent blue for every icon.
- Purple/indigo: only for a distinct effect/animation category if the UI already uses that mapping; keep meaning consistent.
- Green/amber/red: success, caution and destructive/error states, not decoration.
- Borders should define panel/row structure subtly. Do not outline every control at the same contrast.
- Never rely on color alone to communicate selection, type or error; pair it with outline, icon, text or shape.

### 11.4 Spacing and sizing

Use a 4px base rhythm: 4, 8, 12, 16, 20, 24, 32. Typical dense editor UI should use 8–12px between controls and 12–16px section padding. Compact inputs can be 26–30px tall; icon buttons around 26–30px square. Timeline rows commonly need a consistent 26–32px height. These are recommended tokens, not measured exact values from the live site.

- Use one shared `SectionHeader`, `InspectorRow`, `NumericField`, `IconButton`, `ColorField`, `SegmentedControl` and `Tooltip` component rather than hand-styling each section.
- Keep label/value columns aligned across inspector sections.
- Section dividers should use consistent vertical spacing and border color.
- Popovers should align to their triggering control and remain within the viewport.

### 11.5 Typography

Current repo uses a system-first sans-serif stack with Inter included as a preference. Recommended hierarchy:
- App/shot title: 13–15px, medium/semibold.
- Panel/section title: 11–12px, medium/semibold, restrained tracking if appropriate.
- Field label: 11–12px, regular/medium.
- Numeric/control value: 11–12px; use tabular numerals for timecodes and numeric fields.
- Helper text/metadata: 10–11px, secondary/muted.
- Timeline labels: 10–11px with truncation.

Avoid many font sizes and weights. Use line height around 1.3–1.45 for compact UI. Ensure controls remain legible at desktop zoom and don't rely on tiny 9px text for essential information.

### 11.6 Borders, radii, shadows and motion

- Prefer 1px low-contrast borders for panels and controls; stronger border for focused/selected state.
- Use small radii (3–5px) for fields and compact buttons; 8px for cards/popovers where appropriate. Avoid rounded-pill styling everywhere unless the reference uses it.
- Shadows should be reserved for floating popovers/menus, not every panel.
- Use short transitions (roughly 100–180ms) for hover/focus/color changes. Avoid animating layout geometry on every render.
- Respect reduced-motion preferences and avoid decorative transitions during timeline playback.

### 11.7 Canvas styling

- Workspace is near-black/dark blue-black; export frame is visually clear and brighter/outlined than workspace.
- Keep the stage centered within the available viewport and scale the preview without mutating document dimensions.
- Grid/guides are subtle and should not compete with artwork.
- Selection outline and handles use the accent color; active transform tool should be obvious but restrained.
- Camera overlays must be visually distinct from layer overlays.
- Loading and media error states should be rendered inside the canvas bounds, not cause the entire editor to flash/reflow.

### 11.8 Timeline styling

- Use a darker panel background separated from canvas by a subtle top border and a draggable resize affordance.
- Ruler: compact fixed height, low-contrast ticks, readable time labels; current playhead is high contrast.
- Track headers: consistent width, subtle row separators and truncation.
- Blocks: stable color per semantic category, with text/shape cues for accessibility; selected state adds outline, not just a color shift.
- Hover should be weaker than selection. Disabled tracks remain readable.
- Scrollbars are thin and low-contrast but visible on hover if supported.

### 11.9 Accessibility and interaction affordances

- Every icon-only button needs a tooltip and accessible name.
- Use visible keyboard focus; don't remove outlines without replacement.
- Hit targets should be at least about 24px where practical, larger for timeline trim/playhead handles.
- Inputs should support keyboard arrows, text entry, select-all and sensible clamping.
- `Escape` closes transient menus/modes when safe; it must not delete data.
- Disabled, locked and hidden are separate concepts and must look/behave differently.

## 12. Current replica file map and implementation ownership

Keep each concern in its existing home unless there is a specific reason to move it. These files were found in the supplied source archive:

| File | Existing responsibility / safe extension point |
|---|---|
| `src/App.tsx` | App composition and coordination. Keep this lean; do not move all inspector/timeline behavior into it. |
| `src/index.css` | Global reset, base page colors/type and scrollbar styling. Best place to define semantic CSS tokens. |
| `src/model/types.ts` | Domain types for project, shots, layers, animation and scene objects. Extend canonical types here. |
| `src/model/schema.ts` | Data validation/schema. Update when persistent model shape changes. |
| `src/model/defaults.ts` | Default project/shot/layer/effect values. New entities need valid defaults here. |
| `src/store/useProjectStore.ts` | Canonical project mutations; route project edits through the existing actions rather than duplicate local copies. |
| `src/store/useSelectionStore.ts` | Selection context and selected IDs. Keep selection state separate from document content. |
| `src/store/usePlayheadStore.ts` | Playback/hover timing state. Keep transient hover time separate from actual playhead time. |
| `src/panels/Inspector/RightSidebar.tsx` | Main inspector and Design/Animate contexts; contains layer, camera-block and other inspector branches. Avoid adding another competing inspector. |
| `src/panels/Inspector/sections/BackgroundSection.tsx` | Background type and background-specific controls. |
| `src/panels/Inspector/sections/CameraSection.tsx` | Camera settings / Add Move path. |
| `src/panels/Inspector/sections/LightingSection.tsx` | Light list/type, position and light settings. |
| `src/panels/Inspector/sections/SceneEffectsSection.tsx` | Scene-wide effect controls currently found there, including DOF, bloom, grain, grade and vignette. |
| `src/panels/Inspector/sections/SceneTransitionSection.tsx` | Shot transition selection and duration. |
| `src/panels/Inspector/ColorPicker.tsx` | Shared color picker. Prefer extending this instead of creating another picker. |
| `src/panels/LeftPanel/LeftPanel.tsx` | File/Assets sidebar, hierarchy and layer-related actions. |
| `src/panels/Timeline/Timeline.tsx` | Shot/layer timeline rendering, drag/trim, hover/playhead display and timeline height resize. Preserve the existing path. |
| `src/stage/CanvasToolbar.tsx` | Canvas tool selection and toolbar UI. |
| `src/stage/Stage.tsx` | Stage/canvas composition and selection integration. |
| `src/stage/SelectionOverlay.tsx` | Selection outlines and transform handles. |
| `src/stage/Guides.tsx` | Canvas guides/snapping visuals. |
| `src/stage/webgl/ViewportCanvas.tsx` | WebGL/Three.js scene composition. |
| `src/stage/webgl/ViewportCamera.tsx` and `cameraMath.ts` | Camera view/evaluation helpers. Keep camera math out of inspector components. |
| `src/stage/webgl/SceneBackground.tsx` | Scene background rendering. |
| `src/stage/webgl/SceneEffectsPipeline.tsx` and `src/engine/evaluateEffects.ts` | Effect rendering/evaluation path. Do not create a second post-processing pipeline for one new effect. |
| `src/stage/webgl/SceneLighting.tsx` | Scene lighting render path. |
| `src/stage/webgl/ThreeLayerObject.tsx` and `src/engine/evaluateLayer.ts` | Layer rendering and evaluated layer state. |
| `src/engine/evaluateShot.ts` | Shot evaluation/composition timing. |
| `src/engine/evaluateCamera.ts` | Camera block evaluation. |
| `src/engine/easing.ts` | Easing functions; reuse before adding duplicate curves. |
| `src/engine/figmaSvgImporter.ts` | SVG/Figma import parsing and layer conversion. |
| `src/engine/audioEngine.ts` | Audio playback/processing integration. |
| `src/storage/projectIO.ts` | Project save/load serialization. Update it when persisted fields change. |
| `src/ui/ScrubInput.tsx` | Reusable numeric/time scrubbing input. Reuse for numeric inspector fields where appropriate. |

### Repo-specific visual and behavior findings

- Global CSS disables text selection broadly, then re-enables it for inputs, textareas and contenteditable fields. Preserve that distinction; otherwise canvas drags can select page text while users edit values.
- Scrollbars are currently 6px wide/high, with `#0b0d14` tracks and `#262936` thumbs, 3px thumb radius.
- The current global page background is `#07080d`, primary foreground is `#f3f4f6`, and the main repeated blue accent is `#0088ff`.
- The code uses several slightly different dark surface values (`#0a0a0c`, `#0b0b0d`, `#111114`, `#18181b`, `#1c1c1f`). They may represent useful elevation layers; map them to semantic tokens only after comparing their roles.
- Other repeated text values include `#71717a`, `#a1a1aa`, `#d4d4d8` and `#e4e4e7`. Do not collapse all into one gray because they encode hierarchy.
- Repeated accent-adjacent values include `#38bdf8`, `#0077e6`, `#0A84FF`, and `#0088ff`; decide which are hover/focus/selection states and standardize them semantically.
- Timeline code already uses `ResizeObserver`, drag-based vertical resize, shot reorder/trim, separate hover-time logic, and shot-relative time calculations. Extend these paths instead of replacing them.
- The inspector already contains camera-block endpoint controls for framing anchors, zoom, roll, orbit and tilt, plus mode, shake, timing, duration and easing. Orbit support in the data/UI does not prove the exact standalone Orbit Camera interaction matches the live product.
- `SceneEffectsSection.tsx` shows a subset of public scene effects. Audit the whole engine before deciding that an effect is missing; it may be rendered or represented elsewhere.

## 13. Architecture rules to avoid bloated or conflicting code

### 12.1 One source of truth per concept

- Project/shots/layers/blocks/effects/lights/camera state belongs in the canonical project model/store.
- Selection IDs and selection type belong in the selection store.
- Playback time, hover time and playback status belong in the playhead store (keep hover transient).
- UI-only open/closed states belong locally or in a small UI store only when multiple panels need them.
- Derived values such as selected layer, shot start time, block position and display labels should be computed, not duplicated and persisted.

### 12.2 Reuse before adding

Before creating a component, search the codebase for an existing control or section. Reuse common input/row/popover patterns. Do not create a second timeline, inspector, animation engine, camera evaluator or effects pipeline for one feature.

### 12.3 Data model first

When adding a feature:
1. Define its type/schema and defaults in `src/model/types.ts`, `schema.ts` and `defaults.ts` where appropriate.
2. Add a pure evaluator in `src/engine/` only if it represents new runtime behavior.
3. Connect the existing store update path.
4. Add UI to the existing panel/section.
5. Add timeline representation only if the item has timing or is required by the reference.
6. Add validation and tests/verification.

Do not place renderer math, store mutation, import parsing and UI layout in one giant React component.

### 12.4 Stable identity and safe updates

Use stable IDs for shots, layers, blocks, effects, lights and assets. Do not use array index as identity. Updating one object must preserve unrelated siblings and nested data. Delete actions must target a stable ID and update dependent selection state.

### 12.5 No duplicated rendering or event paths

- A UI click should trigger one handler and one store update.
- Avoid registering global pointer listeners repeatedly; add/remove listeners in a single effect with correct cleanup.
- Avoid both local component state and store state for the same persisted value.
- Keep one renderer/evaluator per behavior. UI should call canonical actions rather than independently mutating parallel state.
- Do not duplicate `Design`/`Animate` controls in separate branches that drift; use shared field components and context-specific schemas.

### 12.6 Performance

- Keep high-frequency playhead and pointer updates out of unrelated inspector renders.
- Memoize expensive scene/layer evaluation only after profiling and with correct dependencies.
- Avoid calculating 3D geometry in every sidebar render.
- Use `ResizeObserver` once per relevant container and clean it up.
- Playback should not trigger unnecessary React renders for every static panel.
- Keep imported media and SVG processing outside render functions.

## 14. Implementation roadmap

Do the work in small, verifiable phases. Do not rewrite the whole editor in one pass.

### Phase 0 — Baseline and inventory
- Create a git branch/backup before changing files.
- Install dependencies and run the existing build/lint commands; record failures before edits.
- Inventory current stores, types, panel components, renderer and timeline paths.
- Capture screenshots of blank state, selected shot, each layer type, camera block, effects and timeline at several sizes.
- Mark each audit item as implemented, partial, missing or unverified.

### Phase 1 — Canonical design tokens
- Add CSS variables in a central stylesheet and migrate repeated values gradually.
- Keep the current appearance while replacing repeated literals; don't redesign every component at once.
- Standardize spacing, typography, border, radii and control dimensions.
- Verify contrast and compare screenshot before/after.

### Phase 2 — Selection and inspector state contract
- Define explicit selection contexts: none, shot, layer, effect, camera block, light.
- Ensure selection transitions clear invalid context and never leave stale inspector values.
- Make Design/Animate available only in valid contexts; preserve tab selection when appropriate.
- Test selection from canvas, hierarchy and timeline so all routes converge on the same store actions.

### Phase 3 — Design inspector consistency
- Normalize shared rows and controls.
- Add per-layer field visibility based on layer kind (shape, line, text, image, video).
- Confirm numeric fields and canvas transforms are bidirectional.
- Confirm effects belong to a layer and scene-wide effects belong to the scene.

### Phase 4 — Animate and add/remove behavior
- Audit every plus/minus icon and write its target object/action in a short control map.
- Ensure add pickers create exactly one object, close correctly, and initialize valid defaults.
- Ensure minus/delete removes only the targeted block/effect/light/stop.
- Test stacked In/Out presets, custom blocks, timing/easing, and tab switching.

### Phase 5 — Camera and lighting
- Separate camera tool activation, camera move selection and orbit mode.
- Connect From/To endpoints to one camera evaluator.
- Add/modify/delete lights through stable IDs and one canonical store action.
- Test camera/lighting timeline and inspector synchronization.

### Phase 6 — Timeline interaction
- Lock down project-time versus shot-relative-time conversions.
- Test shot select/reorder/trim; block select/move/trim; hover time; playhead scrub; playback.
- Test resize min/max, ResizeObserver, zoom anchoring, horizontal/vertical scroll and fit-to-view.
- Verify all timeline operations preserve model timing and don't depend on pixel positions as persisted data.

### Phase 7 — Media, backgrounds, effects and audio
- Implement/verify video import and frame seeking with robust error states.
- Normalize background types and gradient-stop identity.
- Ensure each effect has one canonical settings object and one renderer path.
- Add audio lanes and automation only in the existing audio model; don't create a parallel audio engine.

### Phase 8 — Figma import and project persistence
- Test SVG paste with text, shapes, gradients, transforms and unsupported features.
- Validate imported data before adding it to the project.
- Save/reload a project with multiple shots, layers, animation blocks, effects, lights and media; verify IDs and timing survive.

### Phase 9 — Verification and parity review
- Compare screenshots at matching viewport size and zoom.
- Use a checklist for every selection context and every add/remove control.
- Run build, lint and manual regression checks after each phase.
- Fix root causes rather than layering CSS overrides or adding duplicate handlers.

## 15. Verification checklist

- [ ] Blank canvas/no layer selected: no stale layer values or handles.
- [ ] Shot selected from canvas/project timeline: active shot, hierarchy and inspector agree.
- [ ] Rectangle, ellipse, line, polygon if supported, text, image and video each show correct controls.
- [ ] Design edits update canvas and saved model; Animate edits create/update blocks rather than silently changing resting state.
- [ ] Every plus creates one expected item; every minus deletes only its own item.
- [ ] Camera tool, camera block and orbit mode are distinct and cancellable.
- [ ] Effect selection opens effect parameters and preserves parent-layer context.
- [ ] Scene-wide effects are not stored as per-layer effects.
- [ ] Shot-level timeline reorders/trims shots and recalculates starts.
- [ ] Layer-level timeline selection/blocks match hierarchy and inspector.
- [ ] Hover time does not mutate actual playhead time.
- [ ] Playhead, preview, timecode and shot-relative time remain synchronized.
- [ ] Timeline resizing changes layout only; zoom changes scale only.
- [ ] Keyboard shortcuts, undo/redo, save/reload and media errors are tested.
- [ ] No duplicate state, duplicate event handlers or second renderer/evaluator was introduced.

## 16. Reference sources

- Raylight home/product: https://www.raylight.app/
- Academy — Design and Animate: https://www.raylight.app/academy/design-and-animate
- Academy — The Canvas: https://www.raylight.app/academy/the-canvas
- Academy — Layers: https://www.raylight.app/academy/layers
- Academy — The Timeline: https://www.raylight.app/academy/the-timeline
- Academy — Cinematic Effects: https://www.raylight.app/academy/cinematic-effects
- Design product page: https://www.raylight.app/design
- Sound product page: https://www.raylight.app/sound
- Public Design screenshot: https://www.raylight.app/rl-design-screen.webp
- Public Animate screenshot: https://www.raylight.app/rl-animate-screen.webp

**Important limitation:** public documentation and screenshots establish the broad UI model and many controls. Exact behavior for authenticated-only interactions—especially video import, the orbit camera panel, effect-row selection, hover affordances and certain plus/minus menus—must be verified against the live editor before calling it pixel-perfect.
