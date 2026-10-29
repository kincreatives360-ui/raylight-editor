# Suggested layer effects

Research date: 29 October 2026. These are recommendations, not additional effects installed by this change. Priorities and implementation estimates are my assessment of Raylight's current code. Product behavior is grounded in the primary documentation linked below.

## Recommended next batch

| Priority | Effect | Why it belongs in Raylight | Proposed controls | Reuse and implementation cost |
| --- | --- | --- | --- | --- |
| 1 | Alpha outline | Outline a logo, cutout image, video subject or text using its actual transparency. Shape stroke already exists, but cannot do this for arbitrary artwork. | Width, inside/outside, color, opacity, softness | Reuse the shadow spread/alpha-mask path. Low–medium cost. [Reference](https://www.remotion.dev/docs/effects/outline). |
| 2 | Color correction | Match imported footage and product images without changing the entire shot. The existing scene-level grade is broader than this. | Exposure, contrast, saturation, temperature, tint; advanced levels/curves | Extend the existing material sampling stage with a shared color transform. Medium cost; avoid separate effects for every slider. [Reference](https://www.remotion.dev/docs/color-correction). |
| 3 | Noise / material texture | Add grain to a single card, text layer or photo while preserving transparent regions. A noise background or whole-scene grain does not cover this use. | Amount, scale, monochrome/color, density, seed, static/animated | Reuse deterministic noise rather than generating random values each render. Low–medium cost. [Noise behavior](https://www.remotion.dev/docs/effects/noise); [Figma's noise and texture controls](https://help.figma.com/hc/en-us/articles/360041488473-Apply-effects-to-layers). |
| 4 | Bevel and emboss | Give typography, logos and flat shapes raised or recessed edges with coordinated highlights and shadows. A glow alone cannot produce the opposing light/dark relief. | Edge thickness, depth, light angle, highlight/shadow colors, intensity | Extend the alpha-edge calculations, retaining a single material pass where practical. Medium cost. [Reference](https://www.remotion.dev/docs/effects/bevel-alpha). |
| 5 | Long shadow / extrusion | Build dimensional title treatments with a continuous solid silhouette instead of stacking many offset shadows. | Length, angle, color, opacity, fade | Extend Shadow with a Long mode; do not add another independent shadow implementation. Medium cost. [Reference](https://www.remotion.dev/docs/effects/long-shadows). |

The strongest first release would be Alpha outline, Color correction and Noise. They address everyday editing needs and reuse existing infrastructure. That ordering is a product recommendation, not a claim made by the sources.

## Useful second batch

| Effect | What it adds | Proposed controls | How to avoid duplication |
| --- | --- | --- | --- |
| Turbulent displacement | Organic liquid text, heat haze and waving surfaces beyond the deterministic Wrap shapes. | Amount, feature size, complexity, center, evolution, seed, pinned edges, loop | Add a Turbulent Wrap mode using shared geometry/UV infrastructure. Preserve both color and alpha deformation. [Adobe reference](https://helpx.adobe.com/mx/after-effects/desktop/apply-effects-and-animation-presets/list-of-effects/distort-effects.html); [Remotion reference](https://www.remotion.dev/docs/effects/turbulent-displace). |
| Halftone / print | Brightness-driven dots, lines or squares for print and poster treatments. Screen's fixed subpixels simulate displays rather than print coverage. | Dot size, spacing, angle, shape, foreground/background color, source color, invert | Reuse Screen's cell coordinates, but vary primitive coverage from source luminance. Medium cost. [Reference](https://www.remotion.dev/docs/effects/halftone). |
| Roughen edges | Distress a title or graphic's silhouette for torn paper, ink and worn treatments. | Border width, roughness scale, sharpness, amount, seed, evolution | Reuse Noise plus the existing alpha-mask path. Medium cost. [Adobe reference](https://helpx.adobe.com/ph_fil/after-effects/desktop/apply-effects-and-animation-presets/list-of-effects/stylize-effects.html). |
| Color key | Remove a flat background from footage, images or graphic overlays. | Key color, similarity threshold, edge softness, spill suppression, invert | Add a shared alpha operation before shadows/glow so they follow the keyed silhouette. Medium–high cost; video edge quality needs dedicated testing. [Reference](https://www.remotion.dev/docs/effects/color-key). |
| Pixelate / progressive pixelate | Obscure information or create block transitions, without adding a display grid. | Block size, pixel aspect, uniform/progressive, start/end, angle | Share Screen's pixel snapping and Blur's progression controls. Medium cost. [Adobe Mosaic reference](https://helpx.adobe.com/ph_fil/after-effects/desktop/apply-effects-and-animation-presets/list-of-effects/stylize-effects.html); [effect catalogue](https://www.remotion.dev/docs/effects). |

## Add modes before adding more top-level effects

- Extend Blur with radial/zoom variants if needed. Keep depth of field and motion blur in their existing systems; do not make duplicate standalone versions.
- RGB split can be a layer-local option backed by the existing scene chromatic-aberration math. It is useful, but lower priority than the missing everyday tools. [Reference](https://www.remotion.dev/docs/effects/chromatic-aberration).
- Screen already covers display grids, phosphors and refresh bands. Avoid creating separate LCD, OLED, LED, CRT and scanline effects with overlapping implementations.
- Glass already covers refraction, frost, dispersion and shine. Avoid adding a differently named effect for the same rendering.

Before making effect order configurable, define one ordered effect contract for preview and export. Alpha-changing effects should feed the downstream outline, shadow and glow; duplicating arrays or compositing rules across renderers would recreate the inconsistencies addressed by this upgrade. Figma documents how effect order affects rendering, and Remotion explicitly uses an ordered effect chain. [Figma](https://help.figma.com/hc/en-us/articles/360041488473-Apply-effects-to-layers); [Remotion](https://www.remotion.dev/docs/effects).

The implementation suggestions above do not require adopting another effects library. Remotion, Adobe and Figma were used as behavior references, not added as dependencies.
