# Device frames milestone 1 checkpoint

Implemented on 23 October 2026. Milestone 2 has not started.

## Delivered

- New frames use geometryVersion 1, the stable `iphone-15-pro` device ID, and a separate uniform deviceScale.
- Body dimensions use Apple's published 70.6 × 146.6 × 8.25 mm proportions; the screen rectangle uses 1179 × 2556 pixels at nominal 460 ppi. Reference: [Apple specifications](https://support.apple.com/en-bn/111829). Corner curves and small hardware details remain approximations for milestone 3.
- Body, screen, and selection projection resolve dimensions through the same layout contract. Actual extrusion bounds include bevels inside the specified dimensions.
- New Size scales the assembly uniformly. Fixed hardware does not use the old bezel/depth/corner deformation controls. Width/height controls and resize calculations preserve physical proportions, including evaluated scale and mirror signs.
- Existing settings without a geometryVersion retain legacy geometry. Partial saved device settings receive defaults before validation. Unsupported future geometry versions fail validation; unknown device IDs remain saved while rendering the supported fallback and explaining it in the inspector.
- Existing frames offer **Use fixed phone proportions**. Upgrade preserves center and base body height, including compensation for nonuniform legacy scale, and retains old appearance fields and layer transforms. Width intentionally changes to correct proportions. Undo restores the legacy layout.
- Ordinary image/video layers without frames continue using their existing dimensions and transforms. The feature remains image-layer-only in this milestone.

## Placement rules

The original layer height anchors the new phone's total body height at Size 100%. The original layer width/height, asset, crop, position, and animations remain saved. Turning the frame off reveals the original media rectangle. Turning it back on restores the device settings. Changing artboard aspect preserves height relative to the artboard and keeps the physical phone ratio; horizontal normalized placement follows the editor's existing behavior.

Legacy upgrades retain base placement height. Replacing a deforming legacy animation with a rigid phone can intentionally change its silhouette during that animation. A zero-width/zero-height legacy transform is degenerate; inspect that case manually rather than treating it as a normal physical device pose.

## Verification

- Full Vitest suite: **166 tests in 30 files passed** (26 more tests than the audit baseline).
- Focused device tests cover geometry ratios, uniform Size, legacy arithmetic, full/partial schema data, unknown IDs/future versions, idempotent save/load, explicit upgrades, undo/redo, portrait inspector dimensions, minimum-size saveability, scale/mirror anchoring, actual bevel bounds, and ordinary media transforms.
- Production TypeScript/Vite build: passed.
- Changed application/test files: ESLint passed.
- `git diff --check`: passed (Git reports an existing line-ending conversion notice for cameraMath.ts).
- Independent review found three issues: stored size could fall below the schema minimum, inspector aspect was hardcoded, and resize anchoring omitted evaluated scale. All three were fixed with regression tests. Re-review found no remaining Important/Critical milestone-1 issues.

## Browser verification

The sandboxed localhost server was unreachable. Starting a loopback-only server outside that network sandbox allowed the available browser to connect. Verification used an isolated origin and a synthetic image-layer placeholder, not the user's saved project.

Observed in the real editor:

1. Enabling a new frame selects iPhone 15 Pro and locks physical proportions.
2. At Size 100%, layout dimensions were 354 × 734 px. At 150%, they became 531 × 1102 px; undo restored 354 × 734.
3. Switching the project to 9:16 yielded 629 × 1306 px, retaining the physical body ratio.
4. Reload retained the portrait project, image layer, enabled frame, and its dimensions.
5. Entering W = 400 px in portrait updated H to 831 px; undo restored the prior dimensions.

The browser screenshot is `milestone-1-runtime.jpg`. It verifies the intermediate silhouette and inspector state; it is not approval of final materials or image appearance. Real pointer-drag behavior at arbitrary camera rotations and the original JAMbites project still need manual verification. Legacy upgrade and mirrored/scaled anchoring were covered by automated tests, not browser fixtures.

## Manual acceptance checklist

1. Open your existing project. Confirm the old layout loads without silently changing. Select its image and click **Use fixed phone proportions**. Verify center and height stay stable while width becomes phone-shaped. Undo/redo that action.
2. Enable a new frame on square, landscape, and portrait images. Compare phone outlines at equal layer height; the body and screen proportions should stay the same. Check transparent PNGs too.
3. Try Size at 65%, 100%, 150%, and 200%. Screen, thickness, chassis, and hardware should scale together. Resize from side/corner handles and enter W/H numerically; proportions must stay fixed.
4. Toggle the frame off/on. Confirm original media placement/crop returns when off and device settings return when on.
5. Change the project between 16:9, 9:16, and 1:1. Confirm phone proportions and inspector dimensions remain coherent.
6. Save/reload and export/import the project JSON. Confirm device ID, Size, original crop, and legacy upgrade state survive. This checks project data, not rendered video export quality.
7. Try a scaled/mirrored phone and a very small resize. The saved project should reopen, and resize handles should stay attached. Inspect at several tilt/camera angles.

## Next milestone — wait for user authorization

Milestone 2 corrects display and complete-device behavior: consistent crop/Fit/Fill, a display material independent of hardware lighting, selection-independent rendering, complete-device visibility/fades, and more complete physical selection bounds. Known washed-out screen/reflection issues, detailed photorealistic hardware, video-frame support, resource-lifecycle improvements, and native-resolution export remain outstanding according to the audit sequence. Do not begin that work until the user asks.
