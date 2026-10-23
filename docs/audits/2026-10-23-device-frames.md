# 3D mobile device frames: implementation audit and repair specification

Date: 23 October 2026. Target: the current working tree, including its existing uncommitted device-frame changes. No application source was changed by this audit.

## Verdict and current position

Raylight is a browser motion editor with a Three.js preview, timeline evaluation, project persistence, and Canvas/WebGL export paths. This audit assumes normal desktop use: several media layers, scrubbing and animating a device, changing its appearance, saving/reopening, and exporting up to 4K.

The device-frame feature is an integrated prototype, not a finished realistic device system. It has real 3D extrusions and useful editor plumbing. However, its geometry contract is still “build a phone-shaped border around this media rectangle.” That contract prevents accurate device proportions and predictable controls. Improving only colors, bevels, or lighting will not finish it.

Already implemented: optional image-layer settings; inspector controls; numeric normalization; a separate PhoneDeviceFrame component; extruded body and open bezel; rounded screen mesh with normalized artwork UVs; contain/cover/stretch image fitting; glass/reflection overlays; side-button boxes; rear-camera discs; a shared parent transform; studio lighting and a room reflection environment; chassis padding in the selection overlay; a viewport-capture export workaround; four device helper tests.

Still missing or incorrect: fixed device specifications, meaningful device scaling/model variants, selection-independent appearance, complete-device opacity, correct reflection UVs, credible rear/edge construction, deterministic native-resolution export, full projected bounds, robust resource ownership, video-layer support, and visual/integration regression coverage.

## Evidence and limits

- Read the supplied Markdown and both supplied screenshots, then traced the current model/schema, inspector, scene component, frame component, lighting/environment, camera projection, export caller/pipeline, Canvas fallback, persistence migration, and relevant tests.
- `npm test -- --reporter=dot`: **26 test files and 140 tests passed**. The stderr messages about disk failure and malformed JSON are expected error-path fixtures. Four of these tests concern device helpers.
- `npm run build`: **passed**, including TypeScript and Vite production build. This establishes build health, not visual quality.
- Executed focused probes against the actual device helpers, schema, and geometry builders through Vite SSR and the installed Three.js. See `device-frame-probes.mjs` beside this report.
- No GLB, GLTF, OBJ, or FBX device files were found in the project file search. Procedural construction is allowed; absence of a purchased model is not itself a defect.
- Attempted to open an isolated development instance at `http://127.0.0.1:3107/` in the available browser. Navigation failed with `net::ERR_CONNECTION_TIMED_OUT`, although Vite reported ready. Interactive browser reproduction, GPU appearance, export files, and measured performance remain unverified.
- The screenshot project JSON and original JAMbites source asset were not supplied. The screenshots are at **different times (0.97s and 1.21s)**. They cannot prove that deselection alone caused the washed-out state, nor prove a particular crop/cutout setting.

## Must fix

### 1. Physical device proportions still come from the media rectangle

**What this is:** `src/stage/webgl/ThreeLayerObject.tsx:169–178,693–696` passes the evaluated media mesh width/height into the device builder. `src/model/deviceFrame.ts:72–87` adds a bezel to those dimensions.

**Problem:** With identical settings, the executable probe produced body width/height ratios **0.532798**, **1.0**, and **1.876885** for portrait, square, and landscape screen rectangles. They all identify as the same iPhone Pro. Nonuniform layer scaling can deform the hardware again afterward.

**Fix:** Define one versioned device specification with fixed body, display aperture, depth, corner profiles, cutout, buttons, and camera positions in local coordinates. Derive a uniform device scale from a documented placement rule. Map any source aspect ratio inside its display; media changes must not regenerate the body dimensions. Device resize must preserve proportions unless an explicitly separate artistic deformation mode is intended.

**If skipped:** Every source aspect ratio and resize can produce a differently shaped “iPhone.” A detailed imported model would also be distorted if put under the same scaling contract.

### 2. “Size” changes thickness and bezel rather than scaling the device

**What this is:** `src/panels/Inspector/sections/DeviceFrameSection.tsx:59–77` writes `settings.scale`; `src/model/deviceFrame.ts:78–86` applies it to bezel width and depth, leaving the display dimensions and corner radius unchanged.

**Problem:** On a 0.34 × 0.68 display, changing Size from 65% to 200% changes body width **0.36873 → 0.4284** and depth **0.012155 → 0.0374**. It does not triple the device. The screen remains 0.34 × 0.68. Size and Bezel are therefore coupled.

**Fix:** Give Size one meaning: uniform scale of the complete device. Treat realistic bezel geometry as part of the model specification. If stylized bezel/depth controls remain, identify them as overrides with bounds that preserve the display opening. Migrate existing scale values deliberately; copying the old number into a new scale field changes saved compositions.

**If skipped:** Controls continue to alter the silhouette unpredictably, and users compensate with settings that break at another angle.

### 3. Selection and fades change different parts of the device differently

**What this is:** `src/stage/webgl/ThreeLayerObject.tsx:649–651` bypasses visibility/zero-opacity removal for selected layers and forces their screen opacity to at least 0.65. The PhoneDeviceFrame call receives no evaluated opacity; its shell is opaque and its glass/reflection/shadow use their own appearance opacities.

**Problem:** A layer evaluated at opacity 0.1 displays its screen at 0.65 when selected, but 0.1 when deselected. At intermediate fades the chassis remains solid. A selected invisible/zero-opacity layer can still be rendered. Preview-capture exports inherit that selection-dependent scene.

**Fix:** Remove selection from production material opacity and visibility. Keep edit handles/ghosts in a separate editor-only pass. Apply evaluated visibility, timing, fades, and transitions consistently to the entire device. For accurate translucent assembly fades, composite the device as one isolated render layer where needed; merely assigning alpha to every overlapping mesh can expose internal surfaces.

**If skipped:** Editing changes the artwork, fades leave hardware behind, and output can depend on whether a layer was selected. This is a verified mechanism consistent with the screenshots, not a proven reconstruction of their exact states.

### 4. Export is a viewport enlargement and has no explicit scene-ready contract

**What this is:** `src/engine/exporter.ts:60–83,255–259,404–413,693–702` forces enabled-frame projects to copy the stage canvas regardless of requested resolution. `src/stage/webgl/ViewportCanvas.tsx:195–210` sizes that canvas to the editor with DPR 1–2. The artwork texture is capped at a 1024-pixel long edge in `ThreeLayerObject.tsx:253–264`.

**Problem:** Requesting 4K can enlarge a much smaller viewport and a 1024-pixel screen texture. If the stage is unavailable, Canvas fallback has no device implementation, so the frame disappears. The PNG function evaluates its requested time but does not render that evaluated result into WebGL before copying it. Video/GIF seek callbacks update store time and wait one RAF, without an acknowledgement that React, demand rendering, asset textures, and postprocessing have completed for that exact frame.

**Fix:** Add a shared scene render service with an asynchronous `renderFrame({project,timeMs,width,height})` contract. Reuse the same device scene and evaluation rules as preview. Await media readiness, scene commit, video seek and texture upload, then finish the render and read the pixels. Render into the requested resolution, with suitably sized source textures. Exclude editor ghosts/gizmos. Make unavailable 3D rendering an explicit error or supported shared-renderer fallback; never silently omit the device.

**If skipped:** Exports can be soft, selection-dependent, stale, or missing hardware. Actual frame-staleness frequency needs browser/export testing; the missing readiness guarantee is visible in source.

### 5. Screen appearance is treated like a lit printed surface, and reflection mapping is incorrect

**What this is:** `ThreeLayerObject.tsx:652–689` defaults images to a light-reactive standard material. `PhoneDeviceFrame.tsx:163–165,213–220,314–315` maps a reflection texture onto a raw ShapeGeometry. Unlike the artwork helper, this geometry does not normalize its UVs (texture coordinates).

**Problem:** Scene lights can wash out or darken the displayed image. The geometry probe measured reflection UV ranges **U −0.17…0.17, V −0.34…0.34**, rather than 0…1, for a 0.34 × 0.68 screen. The gradient is consequently cropped/clamped and changes with world size. The shadow is also a blurred local-plane decal that rotates with the phone, rather than a shadow cast onto a scene receiver.

**Fix:** Use a dedicated display material with a defined unlit/emissive color policy, independent of the chassis lighting. Normalize the reflection UVs; then replace or calibrate the overlay against angle-dependent glass reflections and a controlled studio setup. Decide whether the local shadow is an intentional stylized effect; use a scene receiver for physically situated shadows. Verify exposure, color space, glass strength, and postprocessing together.

**If skipped:** More lights and stronger gloss can exaggerate the washed-out result instead of making it realistic. The exact contribution to screenshot 2 is not isolated.

### 6. Device model options do not define different devices

**What this is:** `PhoneDeviceFrame.tsx:287` uses the model ID to choose only one, two, or three rear camera discs. The body construction and cutout are otherwise independent of model selection. Rear bump and lenses are flat ShapeGeometry/CircleGeometry surfaces (`:222–226,326–351`).

**Problem:** Selecting iPhone Classic does not establish classic body proportions or its expected cutout. At rear oblique angles the camera assembly has no sidewalls. These are visible construction limits, not something a material finish can repair.

**Fix:** Complete one explicitly named model first, with measured proportions and front/side/rear construction. Either build detailed procedural geometry or use a model with verified redistribution rights. Separate rail, rear glass, display, lens barrels, lens glass, buttons, and cutout. Bind model-specific defaults to the chosen specification; remove unsupported product claims until their presets exist.

**If skipped:** The menu implies capabilities the geometry does not supply. README and PRODUCT currently claim six finished device families and physical finishes; current code supports only the three phone labels above.

## Should fix

### 7. Selection padding covers the front rectangle, not the complete hardware

**What this is:** `src/stage/SelectionOverlay.tsx:90–127` expands width/height by bezel. `src/stage/webgl/cameraMath.ts:183–213` projects that rectangle at a fixed screen-plane depth.

**Problem:** The calculation excludes chassis depth, bevel overhang, protruding buttons, and rear cameras. Those alter the silhouette at side/rear angles. Projection also does not apply the full group Z scale to the local screen offset.

**Fix:** Derive bounds from the same resolved device geometry/specification and complete world matrix. Project the physical bounding volume or silhouette appropriate to selection, excluding the decorative shadow. Use the display aperture separately for crop editing. Preserve existing drag/resize semantics through round-trip projection tests.

**If skipped:** Handles can stop enclosing the hardware at strong rotations even though the front view appears fixed.

### 8. Resource cleanup disposes objects that the next render still uses

**What this is:** `PhoneDeviceFrame.tsx:251–273` has one cleanup effect covering all memoized geometries, materials, and textures, with every resource as a dependency.

**Problem:** Changing reflection replaces its texture/material and triggers cleanup of unchanged body geometry, shell material, shadow texture, and lens materials too. The next render still references those unchanged objects. Three.js may recreate disposed GPU resources, causing unnecessary uploads and shader/resource churn. `ThreeLayerObject.tsx:571–583` also keys texture generation on the entire project and layer, so unrelated project changes rebuild media textures.

**Fix:** Give each resource cleanup the same ownership/dependency lifetime as its creation, or use declarative renderer ownership consistently. Separate geometry topology from mutable material properties. Cache artwork based on asset/crop/display/effect inputs, not the whole project. Size export textures independently from preview textures. Measure allocations and frame time before/after repeated scrubs and inspector changes.

**If skipped:** Appearance edits and animation can repeatedly recreate expensive GPU work. No measured FPS or leak claim is made here.

### 9. Video support and saved-data compatibility are incomplete

**What this is:** Device settings exist only on ImageLayer and its schema. Both renderer and inspector explicitly check `kind === 'image'`. Video-backed image assets are recognized, but their live redraw (`ThreeLayerObject.tsx:598–627`) stretches the crop and bypasses the initial fitted draw helper. Schema fields within a present deviceFrame object are required; migration does not normalize device metadata.

**Problem:** Normal video layers cannot use the feature. A video-backed image configured with Fit/Fill can be redrawn with Stretch. Executable validation accepts full settings but rejects `{enabled:true, model:'iphone-pro'}`, even though the renderer normalizer can fill omitted values. This does not show corruption of current complete saves; it identifies a compatibility gap for older/partial data and future schema changes.

**Fix:** Share the optional device settings across supported image and video layers. Use one crop/fit function for static and live frames. Introduce versioned device metadata, explicit legacy conversion, and defaults before validation; test ordinary complete saves, partial older settings, unknown model IDs, and portable project round trips.

**If skipped:** The same media behaves differently depending on which layer kind imported it, and upgrades can reject otherwise usable projects.

### 10. The current tests do not protect the required behavior

**What this is:** `src/model/deviceFrame.test.ts` contains four arithmetic/normalization/fitting tests. Its first test explicitly expects chassis dimensions to follow the source screen size.

**Problem:** Green tests currently preserve the wrong geometry contract and do not exercise real rendered devices. Existing export tests use mocked canvases and do not establish device quality or pixel parity.

**Fix:** Replace the source-dependent geometry expectation with device invariants. Add small rendering/integration fixtures that specifically fail for findings 1–9. Retain the valid fit/clamp tests and existing ordinary-media tests.

**If skipped:** Another implementation can pass the entire suite while repeating the same visible defects.

## Verification of the supplied Markdown

| Document claim | Current verdict | Correction |
|---|---|---|
| No model assets; procedural construction | Confirmed in project search | Imported models are optional; accurate geometry/specifications are required. |
| Device dimensions follow layer dimensions | Confirmed by executed probe | This remains the principal architectural problem. |
| Screen uses the full chassis dimensions with no separate aperture | Outdated as stated | The body is now larger and an extruded bezel has a hole. The aperture is still derived from the media rectangle. |
| Body is one generic extrusion and has no buttons/cameras | Partly outdated | Separate body/bezel, button boxes, and rear-camera surfaces now exist; they are basic and not model-accurate. |
| Selection forces opacity to at least 0.65 | Confirmed | Current location is ThreeLayerObject.tsx:651; it affects the screen, and chassis opacity has an additional integration defect. |
| Canvas2D has another device-frame implementation | Not true in this working tree | Canvas fallback draws ordinary media and ignores deviceFrame. The current mismatch is omission versus WebGL viewport capture. |
| Model only has broad categories such as iPad/MacBook | Outdated | DeviceFrameSettings now has three phone model IDs and many appearance controls; no physical specifications accompany them. |
| Lighting/materials need work | Supported, but incomplete diagnosis | A room reflection environment and studio lighting already exist. Fix display material policy, reflection mapping, and composition before adding lighting complexity. |
| Distorted image and faint silhouette prove specific bugs | Needs qualification | Visible symptoms are real. Different playhead times and absent project data prevent assigning every symptom to one cause. |
| Dedicated device module; one complete phone first; shared preview/export | Sound recommendation | Reuse the new PhoneDeviceFrame boundary and existing scene evaluation; do not replace the editor. |

The document's referenced line numbers and some structures belong to an older snapshot. Its sample useGLTF code is illustrative, not a verified patch for this application. It does not settle geometry, ownership, migration, or export readiness.

## Durable implementation sequence

### Milestone 1 — Establish the contract and preserve existing projects

Add a stable device ID/version and fixed local-space specification for one phone. Resolve a complete device instance containing body/display geometry and one uniform scale. Define how enabling a frame preserves media placement, how model switching preserves the device center/height, and how old layer size, scale, bezel, and depth values migrate. Preserve the original data during conversion and avoid discarding a project on a repairable field error.

Keep existing media/crop/timeline models and inspector layout. Extend them rather than adding a competing editor model. Replace the test that encodes source-shaped phones.

Gate: square, portrait, landscape, and transparent source assets all produce the same device ratios at the same scale; enable/disable, undo/redo, save/reopen, and aspect-ratio changes have documented, tested placement behavior.

### Milestone 2 — Correct the display and whole-device behavior

Attach screen content, glass, bezel, buttons, and cameras under one device root. Give the display a normalized aperture mapping; reuse crop plus Fit/Fill across static/live media. Default new devices to a proportion-preserving fit; preserve explicit legacy Stretch settings. Use a display material independent of hardware lighting. Separate editor ghosts from scene rendering. Implement evaluated opacity/visibility for the complete assembly and correct bounds.

Gate: selection does not change rendered pixels; a complete phone fades together; circles remain circular in Fit/Fill; no artwork detaches at front, side, or rear rotations; video frames keep the chosen fit.

### Milestone 3 — Meet the actual visual target

Choose an explicit phone generation and record its reference dimensions. Complete a detailed procedural model or integrate a licensed, validated asset with a named display surface. Add actual depth to the rear camera assembly and distinct material regions. Calibrate front/side/rear rendering under a neutral studio rig, then bright/dark backgrounds. Normalize reflection coordinates and choose the intended shadow model. Fix resource ownership before performance tuning.

Gate: approved reference views at 0°, 30°, 60°, 90°, 150°, and 180° Y rotation, plus positive/negative X tilt. Inspect cutout, borders, lens barrels, buttons, transparency, and overlapping-device depth behavior. Appearance must be accepted by comparing actual renders, not just source or build output.

### Milestone 4 — Render exports through the shared scene

Introduce the asynchronous frame-render contract described in finding 4. Preview and export must share the device, camera/evaluation, lighting, environment, and effects implementations. Allow export-specific pixel size without changing scene proportions or mutating the user's project. Restore temporary render settings on success, failure, and cancellation. Make source readiness and render completion explicit.

Gate: compare preview and exported pixels at the same timestamp/resolution with a small documented tolerance; render natively at 720p, 1080p, and 4K; verify PNG at a requested time different from the visible playhead; verify first/middle/last frames of video/GIF and shot boundaries. Test no-stage, unavailable WebGL, media loading failure, and cancellation paths.

### Milestone 5 — Regression gate and release truth

Automate the acceptance matrix below, capture approved image baselines, and measure representative scenes on the intended desktop browser/hardware. Update README/PRODUCT to the verified capability set. Only then expand to other models using the same device specification and shared scene path.

## Acceptance matrix

| Area | Required checks |
|---|---|
| Device invariants | Same model ratios across source aspects; uniform resize; model-specific aperture/cutout; stable position across toggle/model switch. |
| Screen content | Square/portrait/landscape calibration chart; circle/grid distortion check; Fit/Fill/Stretch; crop edges; transparent PNG; low-resolution source. |
| Rotation/depth | Front, edge, rear; both X/Y directions; animated rotation; nonzero Z scale policy; intersecting devices; no screen visible through opaque rear. |
| Selection/timing | Selected/unselected scene pixel equality; hidden and zero-opacity layers; full-device fade; in/out boundaries; camera moves and shot transitions. |
| Inspector | Size scales entire phone; bezel does not silently resize content; model switch applies defaults; every visible control changes its intended property; undo/redo. |
| Persistence | Complete current project round trip; partial legacy settings; unsupported model; asset rehydration; export/import without losing device metadata. |
| Export | Correct timestamp; actual target-resolution render; matching camera/material/effects; no editor ghosts/gizmos; explicit unavailable-renderer handling. |
| Performance | Repeated material edits do not dispose retained geometry; no static-image texture regeneration on unrelated edits; stable resources after repeated mount/unmount; frame-time measurements for several devices. |
| Existing media | Image/video layers without frames retain their previous behavior and export; crop/selection regressions covered. |

## Scope boundary

This audit completed the requested diagnosis and repair specification. It did not implement the renderer repair, acquire model assets, verify the old ZIP, reconstruct the screenshot project, or approve visual/export quality. Those require the staged implementation and runtime gates above. The best starting point is the fixed device contract, opacity/selection correction, and shared export contract—not another isolated bevel/gloss patch.
