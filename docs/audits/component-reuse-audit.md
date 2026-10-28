# Component reuse audit

Date: 28 October 2026. Scope: all 57 production TSX files under `src`, with searches of related source and imports. Tests and historical code in `docs` are excluded from production counts. Findings describe the current working tree, including pre-existing uncommitted changes.

This is a static source audit: JSX structure comparisons, repeated markup/style searches, and inspection of the implementations and their callers. No application source was changed. No runtime or visual checks were performed. The list records confirmed duplication and broader reuse opportunities; it cannot prove that no semantic duplication remains.

“Instance” below means a source implementation site, not the number of rendered items in a `.map()`. Rendering an existing component many times is correct reuse. Repeated props or a repeated CSS class alone do not justify extracting a component. Some findings overlap: for example, extracting an effect card also removes its repeated remove button.

## Confirmed duplication and existing components being bypassed

### 1. Material editor: an existing component has been copied

- Shared implementation: [src/panels/Inspector/sections/LayerMaterialSection.tsx:4](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/LayerMaterialSection.tsx:4>).
- Copy: [src/panels/Inspector/sections/LayerDesignInspector.tsx:75](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/LayerDesignInspector.tsx:75>).
- The non-text path already calls the component at `LayerDesignInspector.tsx:68`, while the text path repeats Receives 3D Light, Glass/Matte/Metal presets, Roughness, Metalness, and update handlers inline.
- Recommendation: call `LayerMaterialSection` for text as well. It already accepts `Layer` and contains text-specific labels/defaults. This is the most straightforward reuse fix.

### 2. Audio timeline clip: two complete implementations

- [src/panels/Timeline/Timeline.tsx:1531](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Timeline/Timeline.tsx:1531>): audio clips in the scene view.
- [src/panels/Timeline/Timeline.tsx:1584](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Timeline/Timeline.tsx:1584>): project audio clips in the other view.
- Both rebuild the draggable clip, waveform, two trim edges, name/duration, delete button, and event propagation handling.
- Recommendation: one `AudioClipBar` with clip, position, width, and callbacks supplied by each view. `AudioWaveform` itself is already shared correctly.

### 3. In/Out transition pills: two nearly identical implementations

- [src/panels/Timeline/Timeline.tsx:1996](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Timeline/Timeline.tsx:1996>): entrance pill.
- [src/panels/Timeline/Timeline.tsx:2067](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Timeline/Timeline.tsx:2067>): exit pill.
- Selection, suppressed-click handling, easing-editor opening, drag handling, styling, curve, and both trim handles are repeated.
- Recommendation: one `TransitionPill` parameterized by side, geometry, selection, easing, and callbacks. Preserve the different entrance/exit timing rules and defaults.

### 4. Timeline drag previews: three copies of one presentation

- [src/panels/Timeline/Timeline.tsx:1937](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Timeline/Timeline.tsx:1937>): layer ghost and time badge.
- [src/panels/Timeline/Timeline.tsx:2137](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Timeline/Timeline.tsx:2137>): preset ghost and time badge (`2144` for the badge).
- [src/panels/Timeline/Timeline.tsx:2231](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Timeline/Timeline.tsx:2231>): animation-block ghost and time badge.
- Recommendation: shared `TimelineDragPreview`/`DragTimeBadge`; pass the preview geometry and formatted times. The three drag algorithms can remain separate.

### 5. Layer effect cards: six hand-built copies of the same shell

- [src/panels/Inspector/sections/LayerEffectsSection.tsx:90](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/LayerEffectsSection.tsx:90>): drop shadow.
- Same file: `132` glow, `168` backdrop blur, `185` layer blur, `202` liquid glass, `241` warp.
- Each repeats `<details>`, a summary with icon/title, and a remove button that prevents disclosure toggling.
- Recommendation: one `LayerEffectCard` with title, icon, remove callback, and effect-specific children. Keep different effect controls inside it. The backdrop/layer blur bodies at `178` and `195` can additionally share a small blur editor or a data-driven rendering path.

### 6. Easing selector/editor: three independently maintained field implementations

- [src/panels/Inspector/sections/LayerAnimateInspector.tsx:27](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/LayerAnimateInspector.tsx:27>): option list; `28` defines a private `EasingField` with curve-editor trigger.
- [src/panels/Inspector/sections/LightBlockInspector.tsx:268](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/LightBlockInspector.tsx:268>): separately built selector and options.
- [src/panels/Inspector/sections/CameraBlockSection.tsx:726](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/CameraBlockSection.tsx:726>): preview plus selector; additional spring/Bezier fields follow.
- Recommendation: promote the existing `EasingField` into a shared component, use one option catalog, and allow camera-specific advanced controls as children or a separate section. These implementations currently expose different option sets/spellings, so preserve intentional compatibility when consolidating.
- `EasingPopover` is already shared by layer animation and timeline; it should remain the common curve editor.

### 7. Design/Animate inspector tabs: three copies

- [src/panels/Inspector/RightSidebar.tsx:1118](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/RightSidebar.tsx:1118>): shot settings tabs.
- [src/panels/Inspector/RightSidebar.tsx:1455](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/RightSidebar.tsx:1455>): object properties tabs.
- [src/panels/Inspector/sections/LightInspector.tsx:179](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/LightInspector.tsx:179>): lighting tabs and close action.
- Recommendation: one `InspectorTabs` with selected value, change callback, accessible label, and optional actions. Keep tab semantics; these should not simply become radio buttons.

### 8. Segmented selection controls: existing `SegmentedControl` bypassed

- Shared component: [src/ui/primitives.tsx:361](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/ui/primitives.tsx:361>); already used correctly by typography alignment.
- [src/ui/ExportModal.tsx:119](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/ui/ExportModal.tsx:119>): export scope; `151` resolution; `171` frame rate; `194` compression.
- [src/panels/Inspector/RightSidebar.tsx:710](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/RightSidebar.tsx:710>): background Color/Image/Shader selector.
- [src/panels/Inspector/sections/ShapeSection.tsx:226](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/ShapeSection.tsx:226>): Rectangle/Circle/Path mask selector.
- [src/panels/Inspector/sections/LayerAnimateInspector.tsx:41](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/LayerAnimateInspector.tsx:41>): direction button group.
- Recommendation: use the existing component, with a small visual variant if necessary. Preserve disabled options and useful accessible labels. Export format cards at `ExportModal.tsx:85` are a different, richer card presentation and need not be forced into the same layout.

### 9. Icon buttons: existing `IconButton` bypassed throughout the UI

- Shared component: [src/ui/primitives.tsx:91](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/ui/primitives.tsx:91>) provides size, active/disabled state, label, focus styling, and tooltip.
- Independently styled icon buttons occur in the inspector, layer tree, toolbar, timeline, effects, dialogs, color picker, orientation gizmo, and toast. Appendix A lists every site recognized by the conservative AST scan, including repeated toolbar and camera alignment buttons.
- Recommendation: reuse `IconButton` for ordinary icon actions. Keep select triggers, specialized drag controls, and grouped selection controls in their appropriate components. Some appendix entries overlap with finding 8.
- Concrete drift: [src/ui/ExportModal.tsx:76](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/ui/ExportModal.tsx:76>) has an X-only close button with no accessible label, while the existing shared component requires one.

### 10. Light-type icon selection: duplicate component logic

- [src/stage/LightingOverlay.tsx:46](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/stage/LightingOverlay.tsx:46>): `LightIcon`.
- [src/panels/Inspector/sections/SceneLightsList.tsx:167](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/SceneLightsList.tsx:167>): `renderLightIcon`.
- Both switch directional/spot/point/area to the same Sun/Flashlight/Lightbulb/Square icons, with different color styling.
- Recommendation: shared `LightTypeIcon`, with a color variant/class override. Do not merge these DOM icons with the different Three.js light gizmos.

### 11. Editable names: four separately implemented edit flows

- [src/panels/LeftPanel/LeftPanel.tsx:438](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/LeftPanel/LeftPanel.tsx:438>): layer name input.
- Same file: `558` group name input and `842` shot name input.
- [src/panels/Inspector/sections/SceneLightsList.tsx:303](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/SceneLightsList.tsx:303>): light name input.
- These repeat entering edit mode, autofocus, input presentation, blur/Enter commit, Escape cancel, and event propagation handling. The left panel already shares some state/helpers, but repeats the input UI.
- Recommendation: `EditableName` with value, commit/cancel callbacks, and editing state. Preserve the differing name validation and store updates at the callers.

### 12. ColorField: two public adapters for the same underlying picker

- [src/ui/primitives.tsx:211](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/ui/primitives.tsx:211>): string callback plus optional event callback, gradient and compact options.
- [src/panels/Inspector/ColorPicker.tsx:721](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/ColorPicker.tsx:721>): event-shaped callback, compact picker.
- The second is used at `DeviceFrameSection.tsx:109`, `135`, and within `ColorPicker.tsx:626`; the first has no production JSX callers found by this scan.
- Recommendation: choose one public `ColorField` contract and make the compatibility adapter explicit if it is still needed. This is duplicate API surface, not two full picker engines: both already render `ColorPicker`.

## Further consolidation opportunities

These are real repeated patterns, but their variations need design/behavior decisions before extraction. They are lower priority than the direct copies above.

### 13. Dialog shell/backdrop: four implementations

- [src/ui/ExportModal.tsx:60](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/ui/ExportModal.tsx:60>).
- [src/ui/KeyboardShortcutsModal.tsx:98](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/ui/KeyboardShortcutsModal.tsx:98>).
- [src/ui/CommandMenu.tsx:99](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/ui/CommandMenu.tsx:99>).
- [src/App.tsx:112](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/App.tsx:112>): lazy modal failure fallback.
- Shared responsibility: backdrop, panel placement, dismissal, focus behavior, dialog labelling, and panel shell. Use a common `Dialog` base while preserving command-menu keyboard navigation and export's busy-state restrictions. Current dismissal and dialog attributes differ; this is more than a class-name deduplication.

### 14. Anchored popup infrastructure: five separate implementations

- [src/ui/FigmaSelect.tsx:15](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/ui/FigmaSelect.tsx:15>), outside handling at `60`, portal at `81`.
- [src/panels/Inspector/ColorPicker.tsx:158](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/ColorPicker.tsx:158>), portal at `333`.
- [src/panels/Inspector/sections/InspectorFlyout.tsx:4](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/InspectorFlyout.tsx:4>), portal at `46`.
- [src/panels/Timeline/EasingPopover.tsx:24](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Timeline/EasingPopover.tsx:24>), outside handling at `92` and positioning below.
- [src/stage/CanvasToolbar.tsx:71](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/stage/CanvasToolbar.tsx:71>): dropdown shell, outside handling at `144`.
- Recommendation: common anchored-surface positioning/dismissal/focus infrastructure, potentially a hook plus `PopoverSurface`. Keep listbox, menu, and color/curve editor semantics distinct; the current implementations have different nesting and scroll behavior.

### 15. Menu rows: local reusable component exists, other menus rebuild rows

- [src/stage/CanvasToolbar.tsx:84](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/stage/CanvasToolbar.tsx:84>): private `MenuItem`.
- [src/stage/Stage.tsx:1452](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/stage/Stage.tsx:1452>), `1471`, `1492`, `1514`, `1533`, `1552`, `1571`, `1591`, `1613`, `1639`, `1663`, `1681`, `1700`, `1720`, `1737`: context-menu entries.
- [src/panels/LeftPanel/LeftPanel.tsx:644](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/LeftPanel/LeftPanel.tsx:644>), `655`, `666`, `677`, `688`: project menu.
- [src/panels/Inspector/sections/SceneLightsList.tsx:207](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/SceneLightsList.tsx:207>), `215`, `223`, `231`: add-light menu.
- [src/panels/Inspector/sections/LightInspector.tsx:193](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/LightInspector.tsx:193>): mapped add-animation entries.
- [src/panels/Inspector/sections/LayerAnimateInspector.tsx:134](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/LayerAnimateInspector.tsx:134>): separate local `menuItem` helper.
- Recommendation: shared row with icon, label, shortcut, disabled/selected state, trailing indicator, and action. Menus need their own shared interaction container; sharing only rows will not unify keyboard behavior.

### 16. Boolean controls: repeated switches and checkbox rows

- Switches: [src/panels/Inspector/RightSidebar.tsx:1169](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/RightSidebar.tsx:1169>) and [src/panels/Inspector/sections/LayerAnimateInspector.tsx:57](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/LayerAnimateInspector.tsx:57>).
- Checkbox rows: [src/panels/Inspector/sections/DeviceFrameSection.tsx:322](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/DeviceFrameSection.tsx:322>), `332`, `342`; `LightInspector.tsx:424`; `LayerMaterialSection.tsx:14`; copied text material checkbox at `LayerDesignInspector.tsx:84`.
- Recommendation: shared `Switch` for switch presentations and `CheckboxField` for checkbox rows. A single wrapper can own labels/focus/disabled styling; retain the different input semantics and business updates. `ShapeSection`'s private `ToggleSwitch` is actually a plus/minus icon action, so it should not be treated as another switch implementation.

### 17. Section and field layout: existing inspector primitives adopted unevenly

- Existing owners: [src/ui/primitives.tsx:256](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/ui/primitives.tsx:256>) (`SectionHeader`), `303` (`InspectorRow`), and [src/panels/Inspector/sections/DesignSection.tsx:6](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/DesignSection.tsx:6>).
- Manual shape section headings: [src/panels/Inspector/sections/ShapeSection.tsx:88](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/ShapeSection.tsx:88>), `198`.
- Repeated collapsible headers: [src/panels/Inspector/sections/LightBlockInspector.tsx:85](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/LightBlockInspector.tsx:85>), `121`.
- Manual light sections: [src/panels/Inspector/sections/LightInspector.tsx:206](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/LightInspector.tsx:206>), `226`, `244`, `269`, `284`, `313`, `338`, `352`, `377`, `393`, `419`.
- Manual project fields: [src/panels/Inspector/RightSidebar.tsx:650](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/RightSidebar.tsx:650>), `662`, `682`.
- Recommendation: reuse section/row primitives with explicit visual variants where they fit. Do not create one new wrapper per panel. The private `Field` in `LayerAnimateInspector.tsx:23` already delegates to `InspectorRow`, so it is not an independently implemented field system.

### 18. Animation timing fields: repeated start/duration pair

- [src/panels/Inspector/sections/CameraBlockSection.tsx:693](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/CameraBlockSection.tsx:693>).
- [src/panels/Inspector/sections/LightBlockInspector.tsx:99](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/LightBlockInspector.tsx:99>).
- [src/panels/Inspector/sections/LayerAnimateInspector.tsx:88](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/LayerAnimateInspector.tsx:88>).
- Recommendation: a small `AnimationTimingFields` receiving values, callbacks, and limits. Preserve the current domain-specific bounds/steps; sharing the UI must not silently change timing rules. Preset delay/duration at `LayerAnimateInspector.tsx:54`, `60` is related but has different semantics.

### 19. Vector/axis field groups: repeated composition around shared inputs

- [src/panels/Inspector/sections/LayerGeometrySections.tsx:46](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/LayerGeometrySections.tsx:46>) position and `60` tilt.
- [src/panels/Inspector/sections/LayerAnimateInspector.tsx:73](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/LayerAnimateInspector.tsx:73>): local vector renderer.
- [src/panels/Inspector/sections/LightInspector.tsx:246](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/LightInspector.tsx:246>) position XY, `269` depth Z, `286` target XY/Z.
- [src/panels/Inspector/sections/LightBlockInspector.tsx:137](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/LightBlockInspector.tsx:137>) From XYZ and `162` To XYZ.
- [src/panels/Inspector/sections/CameraBlockSection.tsx:324](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/CameraBlockSection.tsx:324>): endpoint anchor/depth fields inside the already reused endpoint renderer.
- Recommendation: optional `VectorField`/`AxisFields` if a common axes/layout contract stays simple. `ScrubInput` is already shared here: this is repeated composition, not duplicated numeric-input behavior. Unit conversions and camera/layer/light models should remain outside the generic component.

### 20. Scene light row: built-in Sun and added lights rebuild one shell

- [src/panels/Inspector/sections/SceneLightsList.tsx:250](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/SceneLightsList.tsx:250>): Sun row.
- Same file: `289` mapped custom-light row.
- Repeats selected-row styling, type icon/name layout, and visibility action. Custom lights add editing/duplicate/delete actions.
- Recommendation: one `SceneLightRow` with optional actions and editable-name content. Keep the built-in Sun's special update logic at the caller.

### 21. Keyboard shortcut badge: repeated presentation across four components

- [src/ui/CommandMenu.tsx:127](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/ui/CommandMenu.tsx:127>), `197`, `218`, `219`, `221`.
- [src/ui/KeyboardShortcutsModal.tsx:191](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/ui/KeyboardShortcutsModal.tsx:191>), `209`.
- [src/ui/UndoToast.tsx:61](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/ui/UndoToast.tsx:61>).
- [src/stage/OrientationGizmo.tsx:337](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/stage/OrientationGizmo.tsx:337>).
- Recommendation: small `ShortcutKey`/`ShortcutHint` with subtle visual variants. Low priority; no need for a large shortcut-rendering framework.

### 22. Device contact shadows: eight independently assembled render components

- [src/stage/webgl/AndroidFlagshipFrame.tsx:185](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/stage/webgl/AndroidFlagshipFrame.tsx:185>).
- [src/stage/webgl/BrowserFrame.tsx:159](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/stage/webgl/BrowserFrame.tsx:159>).
- [src/stage/webgl/DetailedIPhone15ProFrame.tsx:265](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/stage/webgl/DetailedIPhone15ProFrame.tsx:265>).
- [src/stage/webgl/IPadProFrame.tsx:200](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/stage/webgl/IPadProFrame.tsx:200>).
- [src/stage/webgl/MacBookProFrame.tsx:355](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/stage/webgl/MacBookProFrame.tsx:355>).
- [src/stage/webgl/PhoneDeviceFrame.tsx:200](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/stage/webgl/PhoneDeviceFrame.tsx:200>) (legacy frame).
- [src/stage/webgl/SamsungGalaxyFrame.tsx:210](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/stage/webgl/SamsungGalaxyFrame.tsx:210>).
- [src/stage/webgl/StudioDisplayFrame.tsx:279](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/stage/webgl/StudioDisplayFrame.tsx:279>).
- Recommendation: shared `DeviceContactShadow` owning its circle geometry, shadow texture/material lifecycle, and mesh, while callers supply transform, opacity, render order, and texture/profile differences. Existing texture factories and `useDisposable` already provide partial reuse. Different devices place shadows differently, so do not normalize placement accidentally.

### 23. Device screen glass/reflection: seven repeated pairs plus one glass-only variant

- [src/stage/webgl/BrowserFrame.tsx:184](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/stage/webgl/BrowserFrame.tsx:184>), `190`.
- [src/stage/webgl/DetailedIPhone15ProFrame.tsx:307](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/stage/webgl/DetailedIPhone15ProFrame.tsx:307>), `314`.
- [src/stage/webgl/IPadProFrame.tsx:262](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/stage/webgl/IPadProFrame.tsx:262>), `268`.
- [src/stage/webgl/MacBookProFrame.tsx:291](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/stage/webgl/MacBookProFrame.tsx:291>), `297`.
- [src/stage/webgl/PhoneDeviceFrame.tsx:220](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/stage/webgl/PhoneDeviceFrame.tsx:220>), `221`.
- [src/stage/webgl/SamsungGalaxyFrame.tsx:244](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/stage/webgl/SamsungGalaxyFrame.tsx:244>), `250`.
- [src/stage/webgl/StudioDisplayFrame.tsx:240](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/stage/webgl/StudioDisplayFrame.tsx:240>), `246`.
- [src/stage/webgl/AndroidFlagshipFrame.tsx:202](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/stage/webgl/AndroidFlagshipFrame.tsx:202>): related glass-only surface.
- Recommendation: consider `DeviceScreenSurface` for glass/reflection mesh composition and resource setup, with supplied geometry/material profiles, offsets and optional reflection. This is lower priority because a highly parameterized component could be less clear than the small repeated meshes. Do not collapse entire device models: chassis, cameras, stands, hinges and buttons are legitimately different.

## Patterns already reused correctly / not duplication findings

- `ScrubInput`, `FigmaSelect`, and `ColorPicker` centralize their actual interaction implementations. Calling them with different labels/values is correct reuse.
- `DesignSection`, `InspectorRow`, `LayerGeometrySections`, `LayerStrokeSection`, and the other layer-specific sections are shared by their relevant callers.
- Project/shot background editing already reuses `ProjectSettingsPanel` through `backgroundOnly` at [src/panels/Inspector/RightSidebar.tsx:1209](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/RightSidebar.tsx:1209>).
- `CameraBlockSection` already renders both endpoints through its local `renderCameraEndpoint` (`95`, calls at `508` and `511`). Separate From/To camera components are not needed.
- Layer-tree rows and recursive groups already use `renderLayerRow`/`renderGroupNode` in `LeftPanel`; an inner helper used repeatedly is still reuse. Only the editable-name presentation is flagged above.
- `TimelineEasingCurve`, `EasingPopover`, and `AudioWaveform` are reused; only surrounding duplicated shells are flagged.
- `MacBookProDeviceFrame.tsx:13` delegates to `MacBookProFrame`; these are not two laptop-rendering implementations. The wrapper may be unnecessary, but that is a separate cleanup question.
- `PhoneDeviceFrame` is a dispatcher for distinct hardware models, not evidence that all models should become one giant conditional component.
- The playhead and skimmer have similar visuals, but the playhead has deliberate imperative/store-subscription behavior. Sharing a tiny presentational marker is optional and is not counted as a duplication finding.

## Suggested order

1. Replace the copied material editor with the existing component.
2. Extract audio clip, transition pill, drag preview and layer effect card shells.
3. Share easing controls, inspector tabs, segmented controls and standard icon actions.
4. Consolidate editable names, light icons and the ColorField contract.
5. Evaluate common dialog/popup behavior and the lower-priority composition/rendering opportunities separately.

No code was refactored and no tests were run: the deliverable is a source audit. Source links/line numbers refer to the working tree at audit time and may move during active edits.

## Appendix A: icon-only native button source sites

The AST scan found 63 source sites in 18 files whose native button children are only imported Lucide icons (including conditional icon choices). Mapped sites can render multiple buttons. This is a conservative inventory, not a count of all icon controls: expressions containing extra markup or dynamically assigned icon variables are not detected. Treat each as a candidate for the existing IconButton or, where appropriate, the shared segmented control.

- src/panels/Inspector/ColorPicker.tsx: [src/panels/Inspector/ColorPicker.tsx:504](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/ColorPicker.tsx:504>), [src/panels/Inspector/ColorPicker.tsx:513](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/ColorPicker.tsx:513>), [src/panels/Inspector/ColorPicker.tsx:582](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/ColorPicker.tsx:582>), [src/panels/Inspector/ColorPicker.tsx:667](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/ColorPicker.tsx:667>).
- src/panels/Inspector/RightSidebar.tsx: [src/panels/Inspector/RightSidebar.tsx:823](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/RightSidebar.tsx:823>), [src/panels/Inspector/RightSidebar.tsx:1386](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/RightSidebar.tsx:1386>), [src/panels/Inspector/RightSidebar.tsx:1407](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/RightSidebar.tsx:1407>), [src/panels/Inspector/RightSidebar.tsx:1415](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/RightSidebar.tsx:1415>).
- src/panels/Inspector/sections/CameraBlockSection.tsx: [src/panels/Inspector/sections/CameraBlockSection.tsx:165](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/CameraBlockSection.tsx:165>), [src/panels/Inspector/sections/CameraBlockSection.tsx:174](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/CameraBlockSection.tsx:174>), [src/panels/Inspector/sections/CameraBlockSection.tsx:183](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/CameraBlockSection.tsx:183>), [src/panels/Inspector/sections/CameraBlockSection.tsx:194](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/CameraBlockSection.tsx:194>), [src/panels/Inspector/sections/CameraBlockSection.tsx:203](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/CameraBlockSection.tsx:203>), [src/panels/Inspector/sections/CameraBlockSection.tsx:212](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/CameraBlockSection.tsx:212>), [src/panels/Inspector/sections/CameraBlockSection.tsx:228](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/CameraBlockSection.tsx:228>), [src/panels/Inspector/sections/CameraBlockSection.tsx:479](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/CameraBlockSection.tsx:479>), [src/panels/Inspector/sections/CameraBlockSection.tsx:523](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/CameraBlockSection.tsx:523>), [src/panels/Inspector/sections/CameraBlockSection.tsx:537](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/CameraBlockSection.tsx:537>).
- src/panels/Inspector/sections/LayerAnimateInspector.tsx: [src/panels/Inspector/sections/LayerAnimateInspector.tsx:41](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/LayerAnimateInspector.tsx:41>).
- src/panels/Inspector/sections/LayerEffectsSection.tsx: [src/panels/Inspector/sections/LayerEffectsSection.tsx:96](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/LayerEffectsSection.tsx:96>), [src/panels/Inspector/sections/LayerEffectsSection.tsx:138](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/LayerEffectsSection.tsx:138>), [src/panels/Inspector/sections/LayerEffectsSection.tsx:174](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/LayerEffectsSection.tsx:174>), [src/panels/Inspector/sections/LayerEffectsSection.tsx:191](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/LayerEffectsSection.tsx:191>), [src/panels/Inspector/sections/LayerEffectsSection.tsx:208](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/LayerEffectsSection.tsx:208>), [src/panels/Inspector/sections/LayerEffectsSection.tsx:247](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/LayerEffectsSection.tsx:247>).
- src/panels/Inspector/sections/LightBlockInspector.tsx: [src/panels/Inspector/sections/LightBlockInspector.tsx:74](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/LightBlockInspector.tsx:74>).
- src/panels/Inspector/sections/LightInspector.tsx: [src/panels/Inspector/sections/LightInspector.tsx:183](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/LightInspector.tsx:183>), [src/panels/Inspector/sections/LightInspector.tsx:190](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/LightInspector.tsx:190>).
- src/panels/Inspector/sections/SceneEffectsSection.tsx: [src/panels/Inspector/sections/SceneEffectsSection.tsx:164](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/SceneEffectsSection.tsx:164>), [src/panels/Inspector/sections/SceneEffectsSection.tsx:263](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/SceneEffectsSection.tsx:263>).
- src/panels/Inspector/sections/SceneLightsList.tsx: [src/panels/Inspector/sections/SceneLightsList.tsx:345](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/SceneLightsList.tsx:345>), [src/panels/Inspector/sections/SceneLightsList.tsx:353](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/SceneLightsList.tsx:353>).
- src/panels/Inspector/sections/ShapeSection.tsx: [src/panels/Inspector/sections/ShapeSection.tsx:93](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/ShapeSection.tsx:93>), [src/panels/Inspector/sections/ShapeSection.tsx:203](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/ShapeSection.tsx:203>), [src/panels/Inspector/sections/ShapeSection.tsx:227](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/ShapeSection.tsx:227>), [src/panels/Inspector/sections/ShapeSection.tsx:238](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/ShapeSection.tsx:238>), [src/panels/Inspector/sections/ShapeSection.tsx:249](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Inspector/sections/ShapeSection.tsx:249>).
- src/panels/LeftPanel/LeftPanel.tsx: [src/panels/LeftPanel/LeftPanel.tsx:475](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/LeftPanel/LeftPanel.tsx:475>), [src/panels/LeftPanel/LeftPanel.tsx:619](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/LeftPanel/LeftPanel.tsx:619>), [src/panels/LeftPanel/LeftPanel.tsx:631](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/LeftPanel/LeftPanel.tsx:631>), [src/panels/LeftPanel/LeftPanel.tsx:731](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/LeftPanel/LeftPanel.tsx:731>), [src/panels/LeftPanel/LeftPanel.tsx:758](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/LeftPanel/LeftPanel.tsx:758>), [src/panels/LeftPanel/LeftPanel.tsx:861](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/LeftPanel/LeftPanel.tsx:861>), [src/panels/LeftPanel/LeftPanel.tsx:879](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/LeftPanel/LeftPanel.tsx:879>), [src/panels/LeftPanel/LeftPanel.tsx:1073](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/LeftPanel/LeftPanel.tsx:1073>), [src/panels/LeftPanel/LeftPanel.tsx:1354](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/LeftPanel/LeftPanel.tsx:1354>), [src/panels/LeftPanel/LeftPanel.tsx:1429](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/LeftPanel/LeftPanel.tsx:1429>).
- src/panels/Timeline/EasingPopover.tsx: [src/panels/Timeline/EasingPopover.tsx:197](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Timeline/EasingPopover.tsx:197>).
- src/panels/Timeline/Timeline.tsx: [src/panels/Timeline/Timeline.tsx:1376](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/panels/Timeline/Timeline.tsx:1376>).
- src/stage/CanvasToolbar.tsx: [src/stage/CanvasToolbar.tsx:492](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/stage/CanvasToolbar.tsx:492>), [src/stage/CanvasToolbar.tsx:529](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/stage/CanvasToolbar.tsx:529>), [src/stage/CanvasToolbar.tsx:554](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/stage/CanvasToolbar.tsx:554>), [src/stage/CanvasToolbar.tsx:606](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/stage/CanvasToolbar.tsx:606>), [src/stage/CanvasToolbar.tsx:617](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/stage/CanvasToolbar.tsx:617>), [src/stage/CanvasToolbar.tsx:628](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/stage/CanvasToolbar.tsx:628>), [src/stage/CanvasToolbar.tsx:647](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/stage/CanvasToolbar.tsx:647>), [src/stage/CanvasToolbar.tsx:656](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/stage/CanvasToolbar.tsx:656>), [src/stage/CanvasToolbar.tsx:698](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/stage/CanvasToolbar.tsx:698>), [src/stage/CanvasToolbar.tsx:708](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/stage/CanvasToolbar.tsx:708>).
- src/stage/OrientationGizmo.tsx: [src/stage/OrientationGizmo.tsx:274](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/stage/OrientationGizmo.tsx:274>).
- src/ui/ExportModal.tsx: [src/ui/ExportModal.tsx:76](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/ui/ExportModal.tsx:76>).
- src/ui/KeyboardShortcutsModal.tsx: [src/ui/KeyboardShortcutsModal.tsx:131](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/ui/KeyboardShortcutsModal.tsx:131>).
- src/ui/UndoToast.tsx: [src/ui/UndoToast.tsx:65](<C:/Users/Sam Akinkunmi/Downloads/Ray_New/raylight-editor/src/ui/UndoToast.tsx:65>).
