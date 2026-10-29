# Layer effect upgrades

The PNG references are the visual and parameter specification. Upgrade the existing effects in place and retain legacy saved values. Screen is the only new effect entry.

1. Extend types and validation with optional parameters: Drop/Inner shadow and spread; Edge/Fill glow, angle, sheen, rim, depth and blending; Uniform/Progressive blur; glass dispersion and shine; Bulge/Ripple/Bend/Curl Wrap; LCD/OLED/CRT/LED Screen and camera controls. Keep normalized legacy blur values readable.
2. Replace repeated inspector mutations with shared typed controls and immutable updates. Keep zero-value effects editable, prevent adding an existing effect from overwriting its settings, and support multiple shadows.
3. Upgrade existing halo and material paths. Use alpha silhouettes for shadows/glow, local coordinates for progressive blur, geometry for Wrap, and bounded shader sampling for glass/Screen. Use timeline time for refresh effects and release temporary canvases/textures.
4. Verify schema round trips, distinct effect modes, neutral values, geometry deformation, shader compilation and controls. Run build, tests, lint and visual checks.
5. Research additional effects after implementation, using primary product documentation. Suggestions are separate from the requested implementation.

Interpretations: unlabeled Glow value 0.2 is intensity; D is depth in pixels. Wrap center is a pixel offset from the layer center. Pixel dimensions use the editor's existing 1920 by 1080 authoring space. LCD uses RGB stripes, OLED a staggered subpixel pattern, CRT a phosphor/scanline mask and LED circular diodes. The screenshots show no hidden Advanced shadow parameters, so none are invented.

## Additional effects implemented

Implemented the ten named recommendations in `recommended-additions.md`: Alpha outline, Color correction (including levels and three editable curve anchors), Noise, Bevel and emboss, Halftone, Roughen edges, Color key, Pixelate, Long Shadow mode and Turbulent Wrap mode. The optional radial/zoom blur and RGB split ideas remain follow-ups.

- Keep Color Key and Roughen before silhouette-dependent effects. Their shared alpha helpers serve text, shapes, images and decoded video frames.
- Inside outlines use the existing surface path. Outside outlines and Long shadows use the existing halo path, with bounded masks and non-accumulating alpha.
- Color correction and grain share shader primitives with scene effects. Halftone precedes grading, so the controls remain useful in combination. Pixelation composes with Screen pixel snapping.
- Turbulence shares seeded coherent noise with Roughen. Geometry buffers update in place using shot-local time. Surface, halo and export pinning use the same content bounds; loop mode uses loop duration rather than an inactive speed slider.
- Preview and export use the same material shader. No effects library was installed. New parameters are optional at the layer-effects level so existing projects continue to load.

Final verification: production build passed; 604 unit/integration tests passed; lint returned no errors and one pre-existing Fast Refresh warning in `SceneEffectsPipeline.tsx`. The browser fixture passed 122 pixel-change comparisons, including parameter changes, combined effects and export-compositor checks, with no shader errors. The fixture is `verify.html`; the captured gallery is `verification-2026-10-29.jpg`.
