# Component reuse audit

Date: 28 October 2026

Implementation update: findings 1–25 were implemented in revision `e99583d6a2b049e2d9028ebca719577d0843b23b`. Validation commands run against that revision: `npm test` (489 tests passed), `npm run build` (passed), and `npm run lint` (0 errors; 3 Fast Refresh warnings in `SceneEffectsSection.tsx` and `EasingControl.tsx`). Source links below point to repository-relative paths and line anchors for the audited revision. See docs/superpowers/plans/2026-10-28-component-reuse-first-batch.md and docs/superpowers/plans/2026-10-28-component-reuse-remaining.md for implementation details and limits.

The source scan found **25 families of copied UI implementation or missed reuse**. The first ten have concrete repeated blocks or overlapping component definitions. The remaining fifteen are consolidation opportunities with different degrees of variation.

Scope: all 58 production `.tsx` files under `src` were parsed/scanned for component definitions, repeated JSX, native controls, and existing shared-component usage. Findings were checked with targeted source reads and caller searches. Tests, generated `dist`, dependencies, and audit/example code were excluded as duplication targets. This is a static source audit, not a runtime UI test or a guarantee that no further semantic duplication exists.

Each location below identifies the start of the relevant implementation. Related findings overlap; their occurrence counts must not be added together. A component rendered repeatedly, including through `.map()`, is already reused and is not itself a duplication finding.

## Concrete repeated implementations

### 1. Layer material editor — high priority

Locations: [LayerMaterialSection.tsx:4](../../src/panels/Inspector/sections/LayerMaterialSection.tsx#L4) and [LayerDesignInspector.tsx:75](../../src/panels/Inspector/sections/LayerDesignInspector.tsx#L75).

The text-only branch in `LayerDesignInspector` reproduces the material editor: Receives 3D Light checkbox, explanatory text, Glass/Matte/Metal presets, Roughness, and Metalness. The non-text branch already calls `LayerMaterialSection` at line 68. The existing component accepts a `Layer`, so this is the clearest missed reuse in the codebase.

Recommendation: call `LayerMaterialSection` for text too, preserving the surrounding text-specific section placement.

### 2. Audio clip renderer — high priority

Locations: [Timeline.tsx:1544](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Timeline/Timeline.tsx:1544>) and [Timeline.tsx:1597](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Timeline/Timeline.tsx:1597>).

Two branches repeat the clip container, waveform, start/end trim handles, volume icon, name, selection, and delete control. `AudioWaveform` is already shared; the larger clip UI is copied.

Recommendation: one `AudioClipBar` with clip, position, width, selection, and callbacks. Keep each view's coordinate calculations outside it.

### 3. Entrance and exit timeline pills — high priority

Locations: [Timeline.tsx:2009](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Timeline/Timeline.tsx:2009>) and [Timeline.tsx:2080](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Timeline/Timeline.tsx:2080>).

The IN and OUT branches repeat selection, easing-popover opening, drag initiation, bar positioning, curve rendering, and edge trim controls. Their main differences are transition side, appearance, placement, and default easing.

Recommendation: one `TransitionPill` parameterized by `entrance | exit`, with explicit timing and easing defaults.

### 4. Layer effect cards — high priority

All six card implementations in `LayerEffectsSection`:

- [LayerEffectsSection.tsx:90](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/LayerEffectsSection.tsx:90>) — Drop shadow.
- [LayerEffectsSection.tsx:132](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/LayerEffectsSection.tsx:132>) — Glow.
- [LayerEffectsSection.tsx:168](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/LayerEffectsSection.tsx:168>) — Backdrop blur.
- [LayerEffectsSection.tsx:185](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/LayerEffectsSection.tsx:185>) — Layer blur.
- [LayerEffectsSection.tsx:202](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/LayerEffectsSection.tsx:202>) — Liquid glass.
- [LayerEffectsSection.tsx:241](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/LayerEffectsSection.tsx:241>) — Warp.

Each repeats a disclosure shell, icon, title, remove button, and parameter body. Backdrop blur and layer blur also repeat virtually the same numeric editor.

Recommendation: `LayerEffectCard({title, icon, onRemove, children})`; use a small shared blur editor or one data-driven branch for the two blur effects. Keep effect-specific parameter controls separate.

### 5. Inline rename inputs — high priority

Locations:

- [LeftPanel.tsx:438](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/LeftPanel/LeftPanel.tsx:438>) — Layer rename.
- [LeftPanel.tsx:558](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/LeftPanel/LeftPanel.tsx:558>) — Group rename.
- [LeftPanel.tsx:842](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/LeftPanel/LeftPanel.tsx:842>) — Shot rename.
- [SceneLightsList.tsx:303](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/SceneLightsList.tsx:303>) — Light rename.

The repeated mechanism is autofocus, editable text, blur/Enter commit, Escape cancellation, and stopping parent clicks. The light version uses `defaultValue`, while the other three use controlled state.

Recommendation: one `InlineRenameInput` with commit/cancel callbacks and an explicit value-state convention. Preserve each caller's save behavior and styling.

### 6. Light-type icon mapping — medium priority

Locations: [LightingOverlay.tsx:46](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/stage/LightingOverlay.tsx:46>) and [SceneLightsList.tsx:167](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/SceneLightsList.tsx:167>).

Both implement directional → Sun, spot → Flashlight, point → Lightbulb, and area → Square. They vary by color and default handling. The same choices are manually repeated in the creation menus at [CanvasToolbar.tsx:666](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/stage/CanvasToolbar.tsx:666>) and [SceneLightsList.tsx:205](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/SceneLightsList.tsx:205>).

Recommendation: one `LightTypeIcon` with a presentation/className option, backed by shared light-type metadata for menus.

### 7. Two ColorField APIs — medium priority

Definitions: [primitives.tsx:211](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/ui/primitives.tsx:211>) and [ColorPicker.tsx:721](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/ColorPicker.tsx:721>).

Both wrap the same `ColorPicker`. The primitive takes a string callback and optional event callback; the local wrapper takes an event-shaped callback and always uses compact mode. Production uses of the local adapter are [ColorPicker.tsx:626](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/ColorPicker.tsx:626>) and [DeviceFrameSection.tsx:109](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/DeviceFrameSection.tsx:109>), [DeviceFrameSection.tsx:135](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/DeviceFrameSection.tsx:135>). The primitive export has no production caller in the scan.

Recommendation: keep one public `ColorField` API, or remove the unused export. This is duplicated adapter/API responsibility, not two separate color-picker engines.

### 8. Left/right sidebar resize splitters — medium priority

Handlers: [App.tsx:319](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/App.tsx:319>) and [App.tsx:355](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/App.tsx:355>).
Markup: [App.tsx:1436](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/App.tsx:1436>) and [App.tsx:1504](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/App.tsx:1504>).

Both implement pointer capture, drag tracking, width clamping, listener cleanup, double-click reset, keyboard resizing, and separator styling. Direction and width constraints differ.

Recommendation: one `SidebarResizeHandle` plus shared resize logic, parameterized by side, current/min/max widths, reset width, and callback. Preserve reversed right-sidebar arrow/drag direction. The horizontal timeline splitter can remain separate.

### 9. Device glass and reflection layers — medium priority

The same glass/reflection resource setup and mesh pair occur in:

- [SamsungGalaxyFrame.tsx:52](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/stage/webgl/SamsungGalaxyFrame.tsx:52>); mesh pair at line 244.
- [IPadProFrame.tsx:54](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/stage/webgl/IPadProFrame.tsx:54>); mesh pair at line 262.
- [StudioDisplayFrame.tsx:53](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/stage/webgl/StudioDisplayFrame.tsx:53>); mesh pair at line 240.
- [MacBookProFrame.tsx:62](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/stage/webgl/MacBookProFrame.tsx:62>); glass use at line 294.
- [BrowserFrame.tsx:67](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/stage/webgl/BrowserFrame.tsx:67>); mesh pair at line 184.
- [PhoneDeviceFrame.tsx:108](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/stage/webgl/PhoneDeviceFrame.tsx:108>); mesh pair at line 220 in the legacy renderer.

Each repeats glass material settings, reflection material/texture setup, disposal, and two overlaid screen meshes. There are small differences in opacity multipliers, local coordinates, and offsets.

The detailed iPhone also assembles a glass/reflection pair at `DetailedIPhone15ProFrame.tsx:307` and `315`, but uses its own material bundle/render policy. Android has a glass-only surface at `AndroidFlagshipFrame.tsx:202`. These are related variants rather than exact copies of the six setups above.

Recommendation: `DeviceScreenSurface` and/or a shared resource hook with explicit geometry, position, opacity, and render-order parameters. Geometry/texture helpers are already shared; do not duplicate them again. Preserve ownership/disposal of Three.js resources.

### 10. Device contact shadows — medium priority

Common shadow texture/material/geometry setup and conditional mesh rendering occur in:

- [SamsungGalaxyFrame.tsx:107](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/stage/webgl/SamsungGalaxyFrame.tsx:107>); render at line 208.
- [IPadProFrame.tsx:102](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/stage/webgl/IPadProFrame.tsx:102>); render at line 198.
- [StudioDisplayFrame.tsx:101](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/stage/webgl/StudioDisplayFrame.tsx:101>); render near line 277.
- [MacBookProFrame.tsx:119](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/stage/webgl/MacBookProFrame.tsx:119>); render near line 354.
- [BrowserFrame.tsx:92](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/stage/webgl/BrowserFrame.tsx:92>); render at line 158.
- [PhoneDeviceFrame.tsx:135](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/stage/webgl/PhoneDeviceFrame.tsx:135>); render near line 197.

`createShadowTexture` is already shared; the surrounding component/resource lifecycle remains repeated. Facing-camera opacity is also repeated in these renderers. Related shadow variants are `AndroidFlagshipFrame.tsx:183` and `DetailedIPhone15ProFrame.tsx:264`; they use a different texture/layout path and should be evaluated separately.

Recommendation: one configurable `DeviceContactShadow` with explicit dimensions, transform, opacity, and render order. Do not flatten each device's different shadow placement into a single hard-coded formula.

## Missed reuse and consolidation opportunities

### 11. Icon buttons bypass the existing IconButton — high priority, broadest UI reach

Existing primitive: [primitives.tsx:91](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/ui/primitives.tsx:91>).

The following are the principal generic icon-action implementations that hand-code sizing, hover, disabled/active appearance, tooltip/title, or accessible naming. Numbers are source lines within the linked file:

| File | Instances |
| --- | --- |
| [App.tsx:1468](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/App.tsx:1468>) | 1468, 1544: reopen sidebars |
| [LeftPanel.tsx:457](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/LeftPanel/LeftPanel.tsx:457>) | 457, 475: layer visibility/delete; 605, 619, 631: header actions; 731, 758: search/clear; 861, 879: shot duplicate/delete; 985: add layer; 1073: animation expansion; 1171, 1324: uploads; 1354: sound-search clear; 1429: add sound |
| [RightSidebar.tsx:824](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/RightSidebar.tsx:824>) | 824, 848: image delete/upload; 1358: collapse; 1379, 1387: settings/export; 1475: shortcuts |
| [ColorPicker.tsx:504](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/ColorPicker.tsx:504>) | 504, 513: rotate gradient; 582: add stop; 667: delete stop |
| [CameraBlockSection.tsx:153](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/CameraBlockSection.tsx:153>) | 153, 162, 171, 182, 191, 200: alignment; 216: focus; 465: close; 509, 523: movement remove/add |
| [LightBlockInspector.tsx:69](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/LightBlockInspector.tsx:69>) | 69: close; 275: delete |
| [LightInspector.tsx:189](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/LightInspector.tsx:189>) | 189: close; 206: add animation |
| [SceneEffectsSection.tsx:164](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/SceneEffectsSection.tsx:164>) | 164: add; 245: visibility; 263: remove |
| [SceneLightsList.tsx:268](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/SceneLightsList.tsx:268>) | 268, 333: visibility; 345: duplicate; 353: delete |
| [LayerEffectsSection.tsx:96](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/LayerEffectsSection.tsx:96>) | 96, 138, 174, 191, 208, 247: remove effect |
| [ShapeSection.tsx:93](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/ShapeSection.tsx:93>) | 93, 203: fill/mask add-remove; 179: add opacity animation, with an extra badge |
| [CanvasToolbar.tsx:484](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/stage/CanvasToolbar.tsx:484>) | 484, 493, 530, 542, 555, 607, 618, 629, 648, 657, 699, 709: tool and dropdown actions |
| [Stage.tsx:1404](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/stage/Stage.tsx:1404>) | 1404, 1413: camera focus/reset |
| [OrientationGizmo.tsx:263](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/stage/OrientationGizmo.tsx:263>) | 263: reset view |
| [SelectionOverlay.tsx:809](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/stage/SelectionOverlay.tsx:809>) | 809: text action |
| [Timeline.tsx:1389](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Timeline/Timeline.tsx:1389>) | 1389: split action |
| [EasingPopover.tsx:200](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Timeline/EasingPopover.tsx:200>) | 200: close |
| [ExportModal.tsx:76](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/ui/ExportModal.tsx:76>) | 76: close |
| [KeyboardShortcutsModal.tsx:131](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/ui/KeyboardShortcutsModal.tsx:131>) | 131: close |
| [UndoToast.tsx:51](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/ui/UndoToast.tsx:51>) | 51: undo; 65: dismiss |

Recommendation: migrate ordinary actions to `IconButton`. Add a small justified variant for destructive actions or toolbar sizing only if needed. Preserve refs, event propagation, selection states, and tooltip placement. Dropdown triggers, badges, and special canvas controls need individual judgment; wrapping every button blindly would change layout/behavior.

### 12. Segmented choices are rebuilt manually — medium priority

Existing primitive: [primitives.tsx:361](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/ui/primitives.tsx:361>).

Reimplementations:

- [RightSidebar.tsx:711](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/RightSidebar.tsx:711>) — Background Color/Image/Shader.
- [ExportModal.tsx:119](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/ui/ExportModal.tsx:119>) — Entire timeline/current shot scope.
- [ShapeSection.tsx:224](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/ShapeSection.tsx:224>) — Rectangle/ellipse/path mask shape.
- [CameraBlockSection.tsx:568](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/CameraBlockSection.tsx:568>) — Camera move mode.
- [LayerAnimateInspector.tsx:32](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/LayerAnimateInspector.tsx:32>) — Direction selector.

Recommendation: extend/use `SegmentedControl` for mutually exclusive choices. Keep per-option disabled handling and appropriate labels. The direction selector has a different visual shape, so reuse may mean a style variant or shared selection behavior.

### 13. Collapsible inspector sections — medium priority

Existing building blocks: [DesignSection.tsx:6](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/DesignSection.tsx:6>) and [primitives.tsx:256](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/ui/primitives.tsx:256>).

Repeated disclosure state/header/chevron/body:

- [LightBlockInspector.tsx:80](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/LightBlockInspector.tsx:80>), 116, 185, 223 — Timing, Position, Intensity/Ambience, Temperature.
- [CameraBlockSection.tsx:117](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/CameraBlockSection.tsx:117>) — Endpoint disclosure in `renderCameraEndpoint`.
- [DeviceFrameSection.tsx:119](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/DeviceFrameSection.tsx:119>), 194 — Screen and advanced device controls.

Recommendation: a shared disclosure shell with optional controlled open state and configurable header/body classes. Preserve current default-open behavior and endpoint state. Effect-card disclosures are separately covered by finding 4; not every native `details` needs replacing.

### 14. Animation timing groups — medium priority

Locations:

- [CameraBlockSection.tsx:678](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/CameraBlockSection.tsx:678>) — Start/Length.
- [LightBlockInspector.tsx:94](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/LightBlockInspector.tsx:94>) — Start/Duration.
- [LayerAnimateInspector.tsx:84](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/LayerAnimateInspector.tsx:84>) — Start/Duration.
- [LayerAnimateInspector.tsx:50](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/LayerAnimateInspector.tsx:50>), 56 — Preset duration and delay.

The underlying `ScrubInput` is already shared. The repeated larger pattern is a pair/group of timing fields with labels, units, and constraints.

Recommendation: `AnimationTimingFields` if timing behavior is to be maintained centrally. Pass each domain's existing min/max/step explicitly; camera, light, and layer timings currently differ. Do not silently standardize their allowed values.

### 15. Menu surfaces and action rows — high priority

Existing local components: [CanvasToolbar.tsx:71](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/stage/CanvasToolbar.tsx:71>) (`DropdownMenu`) and [CanvasToolbar.tsx:85](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/stage/CanvasToolbar.tsx:85>) (`MenuItem`).

Separate versions:

- [LeftPanel.tsx:642](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/LeftPanel/LeftPanel.tsx:642>) — Add shot/layer/camera menu.
- [Stage.tsx:1434](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/stage/Stage.tsx:1434>) — Context menu; repeated icon + title + shortcut rows.
- [SceneLightsList.tsx:205](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/SceneLightsList.tsx:205>) — Add-light menu.
- [LightInspector.tsx:207](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/LightInspector.tsx:207>) — Add-animation menu.
- [SceneEffectsSection.tsx:175](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/SceneEffectsSection.tsx:175>) — Add-effect menu.
- [LayerAnimateInspector.tsx:147](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/LayerAnimateInspector.tsx:147>) — Existing `InspectorFlyout` menu path, whose item styling can inform the shared version.

Recommendation: move a common menu surface/item into `src/ui`, with anchor/point positioning and optional shortcuts, active state, and destructive styling. Keep action callbacks in callers. Include keyboard/focus behavior in the shared implementation.

### 16. Anchored popup positioning and dismissal — medium priority

Implementations:

- [FigmaSelect.tsx:42](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/ui/FigmaSelect.tsx:42>), 53 — Position calculation, outside pointer dismissal, resize/scroll handling.
- [ColorPicker.tsx:132](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/ColorPicker.tsx:132>) — Positioning, resize/scroll listeners, outside pointer dismissal.
- [InspectorFlyout.tsx:15](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/InspectorFlyout.tsx:15>), 31 — Positioning, focus, outside pointer, Escape.
- [EasingPopover.tsx:83](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Timeline/EasingPopover.tsx:83>), 156 — Outside/Escape handling and positioning.
- [CanvasToolbar.tsx:139](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/stage/CanvasToolbar.tsx:139>) — Outside-click dismissal for toolbar menus.

Recommendation: a shared anchored-surface primitive or hook for positioning/dismissal. Keep listbox, menu, and dialog semantics distinct; preserve nested select behavior and focus restoration. This overlaps menu surfaces in finding 15 but addresses behavior rather than row markup.

### 17. Modal shell/header/close action — medium priority

Locations:

- [ExportModal.tsx:60](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/ui/ExportModal.tsx:60>).
- [KeyboardShortcutsModal.tsx:98](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/ui/KeyboardShortcutsModal.tsx:98>).
- [CommandMenu.tsx:99](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/ui/CommandMenu.tsx:99>).
- [App.tsx:112](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/App.tsx:112>) — Modal-load error fallback.

Each hand-builds the fixed backdrop, surface, stacking, and some combination of header and close behavior. They currently differ in alignment, width, dismissal, and focus handling.

Recommendation: one `ModalShell` supporting centered/top alignment, accessible title, close action, and configurable dismissal. Keep exporting/cancellation locks and command-specific keyboard navigation in callers. Do not replace their different content with one monolithic dialog.

### 18. Search field shells — lower priority

Locations:

- [LeftPanel.tsx:745](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/LeftPanel/LeftPanel.tsx:745>) — Layer search.
- [LeftPanel.tsx:1344](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/LeftPanel/LeftPanel.tsx:1344>) — Sound search.
- [KeyboardShortcutsModal.tsx:143](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/ui/KeyboardShortcutsModal.tsx:143>) — Shortcuts search.
- [CommandMenu.tsx:112](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/ui/CommandMenu.tsx:112>) — Command search.

Repeated composition is search icon + text input + optional clear control, with caller-specific search state and filtering.

Recommendation: a small `SearchField` for the shell and clear action. Filtering and command navigation should remain local. This is a maintenance opportunity rather than an exact-copy finding.

### 19. Boolean checkbox/toggle rows — lower priority

Existing switch: [primitives.tsx:423](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/ui/primitives.tsx:423>).

Repeated checkbox rows:

- [DeviceFrameSection.tsx:320](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/DeviceFrameSection.tsx:320>), 330, 340 — Physical buttons, rear cameras, contact shadow.
- [LightInspector.tsx:440](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/LightInspector.tsx:440>) — Cast shadow.
- [LayerMaterialSection.tsx:7](../../src/panels/Inspector/sections/LayerMaterialSection.tsx#L7) and [LayerDesignInspector.tsx:77](../../src/panels/Inspector/sections/LayerDesignInspector.tsx#L77) — Receives light, already part of finding 1.

Also [ShapeSection.tsx:28](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/ShapeSection.tsx:28>) defines a local `ToggleSwitch` implemented as a plus/minus `IconButton`, used for Invert and Show at lines 311 and 320. Its accessible labels are hard-coded to Add/Remove mask, illustrating semantic drift from local control implementations.

Recommendation: a shared labeled checkbox row when checkbox appearance is desired, and use `Switch` for switch interactions. Checkboxes are valid controls; their existence alone is not a reason to convert them all into switches.

### 20. Timeline animation bar frame and trim edges — medium priority

Locations:

- [Timeline.tsx:1787](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Timeline/Timeline.tsx:1787>) — Camera bar.
- [Timeline.tsx:1826](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Timeline/Timeline.tsx:1826>) — Light bar.
- [Timeline.tsx:2009](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Timeline/Timeline.tsx:2009>), 2080 — Transition bars.
- [Timeline.tsx:2165](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Timeline/Timeline.tsx:2165>) onward — Property-animation row/bar.

These repeat absolute position/width, selected appearance, drag surface, easing curve, and left/right resize edges. `TimelineEasingCurve` is already shared.

Recommendation: a small `TimelineRangeBar` / `TrimHandle` base. Keep specialized drag calculations, selection, and mutations separate. The specialized transition and audio components in findings 2–3 can use a common base if that actually simplifies them. This is overlapping evidence, not additional independent copies of those same bars.

### 21. Scene-light row shell — lower priority

Locations: [SceneLightsList.tsx:252](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/SceneLightsList.tsx:252>) for the built-in sun and [SceneLightsList.tsx:288](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/SceneLightsList.tsx:288>) for custom lights. The Room row at line 245 repeats the selection/icon/name shell with an Environment label instead of visibility controls.

The rows repeat selected styling, type icon/name layout, and a visibility action. Custom lights additionally support renaming, duplication, and deletion.

Recommendation: a shared `SceneLightRow` with name/icon, selected state, visibility toggle, and optional trailing actions. Keep built-in light rules and custom-source mutations in callers.

### 22. Timeline drag previews and time badges — medium priority

Locations: [Timeline.tsx:1949](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Timeline/Timeline.tsx:1949>), [Timeline.tsx:2149](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Timeline/Timeline.tsx:2149>), and [Timeline.tsx:2243](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Timeline/Timeline.tsx:2243>).

Layer, transition, and property-block drags each construct a dashed preview plus a floating duration badge. Layer/block badges also include start time; the transition badge shows duration alone. The snapping indicator, formatting, overlay styling, and position math are repeated.

Recommendation: one `TimelineDragPreview` with size/style variants and a `DragTimeBadge` accepting duration, optional start, and snapped state. Keep the drag algorithms separate. This is separate from the draggable live bars in finding 20.

### 23. Keyboard shortcut badges — lower priority

Locations:

- [CommandMenu.tsx:127](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/ui/CommandMenu.tsx:127>), 197, 218, 219, 221 — Escape, command shortcuts, and navigation keys.
- [KeyboardShortcutsModal.tsx:191](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/ui/KeyboardShortcutsModal.tsx:191>), 209 — Key sequences and the guide toggle hint.
- [UndoToast.tsx:61](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/ui/UndoToast.tsx:61>) — Undo shortcut.
- [OrientationGizmo.tsx:337](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/stage/OrientationGizmo.tsx:337>) — View shortcut hint.

The same small keycap presentation is independently styled in each surface.

Recommendation: a small `ShortcutKey` / `ShortcutHint` with subtle visual variants. Keep the existing platform-aware shortcut formatting helpers.

### 24. Vector/axis field groups — lower priority

Locations:

- [LayerGeometrySections.tsx:46](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/LayerGeometrySections.tsx:46>), 60 — Position and tilt.
- [LayerAnimateInspector.tsx:69](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/LayerAnimateInspector.tsx:69>) — Local vector renderer.
- [LightInspector.tsx:262](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/LightInspector.tsx:262>), 287, 302 — Position and target.
- [LightBlockInspector.tsx:133](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/LightBlockInspector.tsx:133>), 158 — From/To XYZ fields.
- [CameraBlockSection.tsx:315](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/CameraBlockSection.tsx:315>), 327, 343 — Endpoint anchor/depth.

The numeric input implementation is already shared. Repeated composition is axis labels, pair/triple layout, and per-axis callbacks.

Recommendation: optional `AxisFields` if a simple common API emerges. Keep units, conversions, limits, and store mutations in callers. Repeated `ScrubInput` calls alone are not sufficient reason to extract this.

### 25. Inspector field/section layout bypasses existing primitives — lower priority

Existing primitives: [primitives.tsx:256](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/ui/primitives.tsx:256>) (`SectionHeader`) and [primitives.tsx:303](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/ui/primitives.tsx:303>) (`InspectorRow`).

Repeated title/label/control compositions appear in [RightSidebar.tsx:650](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/RightSidebar.tsx:650>), 663, 683, 1128; [LightInspector.tsx:223](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/LightInspector.tsx:223>), 259; [DeviceFrameSection.tsx:121](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/DeviceFrameSection.tsx:121>), 305; and [ShapeSection.tsx:88](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/ShapeSection.tsx:88>), 198.

Recommendation: use `InspectorRow` / `SectionHeader` where the intended design matches, with a restrained layout variant if necessary. This is visual composition reuse, not duplicated editing logic. Do not force device-grid rows, object sections, and project settings into identical spacing merely to remove small amounts of JSX.

## Already shared correctly / not counted as findings

- `ScrubInput`, `FigmaSelect`, and `ColorPicker` are already reused extensively. Multiple invocations are normal.
- `EasingControl` is already used by camera, light, and layer animation settings and itself opens `EasingPopover`. The timeline also uses the same popover. These are not independently rebuilt full editors.
- The shot background override calls `ProjectSettingsPanel backgroundOnly` at [RightSidebar.tsx:1181](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/RightSidebar.tsx:1181>). Project/shot backgrounds already share the editor.
- `InspectorModeTabs` is already used for shot, object, and lighting inspectors.
- `DesignSection`, `InspectorRow`, `LayerStrokeSection`, and `LayerGeometrySections` are reused; they are useful foundations.
- `renderCameraEndpoint` is one renderer called for From/To. Those two endpoints are not separate copied editors.
- `renderLayerRow` and `renderLayerIcon` in LeftPanel are reused render helpers. Being local functions does not make their uses duplication.
- Device types legitimately need different chassis, cameras, buttons, stands, and keyboard geometry. Share glass/shadow subparts, not all device models indiscriminately.
- `MacBookProDeviceFrame` delegates to `MacBookProFrame`; it is a wrapper, not a copied model.
- Stage, modal, and WebGL error boundaries have similar state machinery, but their fallbacks and recovery contexts differ. A generic boundary is possible; it is not a strong duplication finding here.
- Category chips, ordinary labels, single native inputs, and tiny repeated SVG lines are not automatically component candidates.

## Suggested order

1. Remove the copied material editor by reusing the component that already exists.
2. Extract audio clip, transition pill, and effect-card shells.
3. Consolidate rename inputs and sidebar resize handles.
4. Promote shared menu/item primitives and migrate generic icon actions.
5. Consolidate device screen/shadow subcomponents with visual regression checks.
6. Address the remaining opportunities only where the resulting API reduces maintenance.

The original audit did not change application source or run build/tests/browser checks. The first batch and remaining findings have since been implemented. Browser smoke coverage included menu navigation, inspector fields, font dropdown dismissal, export modal close, sidebar resizing, and layer search. Device resource/material/geometry parity was checked structurally; GPU pixel comparison and physical pointer-drag checks were not performed. Deliberate non-extractions and remaining limits are recorded in the implementation plans.
