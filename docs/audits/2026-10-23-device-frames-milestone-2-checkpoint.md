# Device frames — milestone 2 checkpoint

Milestone 2 is complete. It corrects device screen composition, whole-assembly visibility and fades, and physical selection bounds. It deliberately stops before the realistic hardware/model work of milestone 3.

## Delivered

- Screen content now shares one crop/Fit/Fill drawing path for initial images and live redraws. Newly created frames default to Fit; explicitly saved Stretch and legacy projects retain their previous behavior.
- A framed display is opaque, unlit, front-facing, and receives `screenFillColor` behind transparent media. This prevents studio lighting from washing out the artwork.
- The display texture and procedural reflection use normalized UVs, so the reflection does not change shape with device scale.
- Selection no longer changes scene visibility or opacity. A device at zero opacity stays absent even while selected; editor handles remain independent.
- Partial fades capture and composite the complete assembly (screen, bezel, glass, cutout, cameras, buttons, and local shadow) in a transparent target. The renderer uses one linear composer path at all opacities, preserves MSAA, and restores target, source visibility, shadow flags, and auto-clear state even when a pass fails.
- Shared `phoneLayout` geometry drives both the device component and its physical bounds. Selection includes hardware protrusions and retains a usable silhouette at side/rear angles; crop mode uses the screen aperture.

## Verification

- `npm test`: **34 files, 189 tests passed**.
- `npm run build`: passed (TypeScript and production Vite build).
- Targeted ESLint over changed device-frame source and tests: passed with no output.
- Independent review checked the color-space, alpha, depth, shadow-state, MSAA, legacy bevel, and overlapping-device paths. Follow-up issues found during review were fixed and covered by tests.
- Browser checks used a wide 2:1 raster test asset: Fit letterboxed without distorting the circle; Fill cropped it without distortion; full/half/zero opacity rendered as whole assemblies; deselection did not change scene visibility; an edge-on device retained selection width; a rear opaque device remained visible through a front 50% faded one. Runtime checks found no device-frame WebGL errors after the corrected render transaction.

Screenshots: [full opacity](milestone-2-opacity-100.jpg), [half opacity](milestone-2-opacity-50.jpg), [zero opacity](milestone-2-opacity-0.jpg), [Fit](milestone-2-fit.jpg), [Fill](milestone-2-fill.jpg), [edge-on](milestone-2-edge.jpg), and [overlap](milestone-2-overlap.jpg).

## Remaining for milestone 3

The core behavior is reliable, but the visual target is not yet met. The procedural frame still has a broad, milky glass/reflection treatment and shallow, simplified rear cameras, rails, and buttons. Milestone 3 should build and calibrate one detailed iPhone 15 Pro model under a neutral studio rig, then approve reference renders at front, side, rear, positive/negative tilt, and overlapping-device angles.

