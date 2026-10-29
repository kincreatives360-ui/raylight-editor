# Timeline-driven text animation research

Researched 29 October 2026 for Raylight. This is a proposal and reference catalogue; no product code was changed. Rankings, preset names, controls and implementation grouping below are recommendations. Linked sources establish the underlying techniques, not that Raylight already implements them.

## Scope

Every proposed animation must work from timeline time alone. Pointer movement, hovering, dragging, scrolling, intersection observers and live microphone input must not be prerequisites. A user can adjust controls while authoring, but exported playback needs no interaction. Audio-related designs can use explicit beat markers or analysis of an imported audio file.

Each preset should support seeking directly to an arbitrary frame, playback in reverse, speed changes and predictable export. Randomized designs need a saved seed. Simulated designs need a fixed simulation step and a reproducible cache or bake.

## Findings from the supplied references

### Museum of Motion

Inspected the supplied repository without running its scripts. Snapshot: `eb927dfe3ab4f151f38e2762135a6e49fbe3c9b0`.

Its Type and Play collections are the relevant starting points. The text stage registry provides useful variants of line masks, character sequencing, word entrances, decoder effects and traveling emphasis. Keep the motion recipes; leave the website navigation, scroll and pointer behavior out of Raylight's playback model.

The implementation already offers useful precedents for seeking, particularly time-indexed decoder output and precomputed glitch steps. However, frames generated with `Math.random()` are seekable only within a constructed timeline and are not reproducible across rebuilds or sessions without a persisted seed, matching the scope section requirements. Its letter-wave builder also addresses layout stability during weight changes. These are valuable engineering references as well as visual examples.

Sources: [exhibit catalogue](https://github.com/kincreatives360-ui/museum-of-motion/blob/eb927dfe3ab4f151f38e2762135a6e49fbe3c9b0/lib/exhibits.ts), [text stages](https://github.com/kincreatives360-ui/museum-of-motion/blob/eb927dfe3ab4f151f38e2762135a6e49fbe3c9b0/lib/motion/stages/text.ts), [wave implementation](https://github.com/kincreatives360-ui/museum-of-motion/blob/eb927dfe3ab4f151f38e2762135a6e49fbe3c9b0/lib/motion/wave.ts).

### Space Type Generator

The supplied domain has a spelling error. The working project is [spacetypegenerator.com](https://spacetypegenerator.com/), by Kiel Danger Mutschelknaus.

It is particularly useful for repeating typography arranged into surfaces, paths and volumes. The current index includes Cylinder, Field, Stripes, Coil, Flag, Cascade, Ribbon, Layers, String, Badge, Clutter, Construct, Snap, Flash, Pow, Crash, Vessel, Shine and Boost.

I also read the public [Flag source](https://spacetypegenerator.com/sketch_flag.js). It exposes independent displacement axes, phase relationships between characters and rows, speed and camera controls. The controls configure the animation; they are not required to keep it moving. For Raylight, those ideas should be sampled from shot time rather than relying on a continuously advancing browser draw loop.

Useful direct references: [Field](https://spacetypegenerator.com/field), [Flag](https://spacetypegenerator.com/flag), [Coil](https://spacetypegenerator.com/coil), [Ribbon](https://spacetypegenerator.com/ribbon), [Flash](https://spacetypegenerator.com/flash). Flash is especially relevant to short, changing title compositions, rather than only infinite decorative loops.

## Shortlist: 12 strongest additions

These are ordered by a combination of everyday usefulness, visual range and the amount of new infrastructure needed. Effort ratings are relative assessments, not estimates in days.

| Priority | Suggested preset | What the viewer sees | Important controls | Effort |
| --- | --- | --- | --- | --- |
| 1 | Masked line rise | Each line emerges from behind its own baseline mask and settles. | Unit, direction, offset, stagger, overshoot, blur, mask padding | Medium |
| 2 | Character cascade | Letters arrive independently with a controlled delay and settle into the original layout. | Order, delay, distance, rotation, easing, overlap | Medium |
| 3 | Word punch | Words arrive on authored beats, with stronger treatment on selected words. | Word timing, scale, squash, emphasis selection, hold | Medium |
| 4 | Tracking settle | A widely spaced heading closes into its final letter spacing. | Start/end tracking, anchor, per-line behavior, duration | Medium |
| 5 | Wave / ripple | A traveling lift, tilt or scale pulse passes through the letters. | Amplitude, wavelength, cycles, phase, direction, falloff | Medium |
| 6 | Elastic type | Letters compress, stretch and rebound with a damped response. | Stretch axes, anchor, overshoot, decay, stagger | Medium |
| 7 | Rolling digits | Numeric columns roll to a new value, preserving their formatting. | Value range, precision, direction, roll distance, separators | Medium |
| 8 | Echo stack | Offset copies trail or sway behind readable foreground text. | Copy count, delay, offset, fade, color, outline/fill | Medium |
| 9 | Variable-font wave | Real weight, width or slant changes travel through the word. | Axis, range, wave, spacing compensation, phase | Medium–high |
| 10 | Flag type | Text behaves like a waving sheet, with real spatial displacement. | XYZ amplitude, wavelength, speed, pinning, perspective | Medium–high |
| 11 | Cylinder / ring type | A phrase revolves around a curved surface or circular path. | Radius, repetitions, speed, facing, orientation, camera | High |
| 12 | Particle assembly | Dots gather into a word, hold, then disperse. | Density, seed, route, assemble time, hold, scatter, particle size | High |

References supporting this shortlist: [Museum text stages](https://github.com/kincreatives360-ui/museum-of-motion/blob/eb927dfe3ab4f151f38e2762135a6e49fbe3c9b0/lib/motion/stages/text.ts), [Flexile](https://flexile.io/text-presets), [Type Jazz controls](https://docs.jakeinmotion.com/type-jazz/using-type-jazz/animation-controls/), [Adobe variable-font animators](https://helpx.adobe.com/after-effects/desktop/variable-font-axes/work-with-variable-font-axes/working-with-variable-font-axes.html), [Space Type Generator](https://spacetypegenerator.com/), [ATOM](https://atomtypelab.com/about).

## Extended catalogue

The following ideas are preset recipes within a few shared systems, rather than a request for dozens of separate animation engines.

### Readable entrances, exits and emphasis

| Idea | Motion and practical use | Controls beyond common timing |
| --- | --- | --- |
| 1. Masked line rise | Editorial titles and multiline text rise through local masks. | Mask direction, baseline offset, line overlap |
| 2. Character cascade | Letters enter in sequence with independent transforms. | Ordering, distance, pivot, stagger |
| 3. Alternating word slide | Adjacent words approach from opposite sides. | Alternation, spread, overlap |
| 4. Center-out build | The middle of a title resolves before the outer letters. | Center index, symmetry, falloff |
| 5. Perspective flip | Letters rotate into view around a baseline or center. | Axis, pivot, angle, perspective |
| 6. Scatter / gather | Letters travel between distributed positions and a clean layout. | Seed, radius, rotation range, convergence |
| 7. Word punch | A phrase is built one emphasized word at a time. | Word markers, punch amount, hold, color accent |
| 8. Blur-to-sharp cascade | Focus resolves separately for each word or line. | Blur, depth offset, stagger, fade |
| 9. Iris / arch reveal | Curved masks open across a line or title. | Mask shape, origin, sweep, feather |
| 10. Highlight reveal | An animated marker band reveals or emphasizes a phrase. | Band color, padding, reveal mode, hold |
| 11. Elastic unfold | Flattened characters expand and settle into their final proportions. | Squash axis, anchor, damping |
| 12. Tracking settle | Spacing expands or closes while the title remains anchored. | Tracking range, alignment, line handling |

Strong references: [Moving Letters](https://tobiasahlin.com/moving-letters/), [Museum](https://github.com/kincreatives360-ui/museum-of-motion), [Type Jazz](https://docs.jakeinmotion.com/type-jazz/), [Flexile](https://flexile.io/text-presets). These examples should inform editable recipes rather than be copied as fixed pieces of website markup.

### Motion that happens during the shot

| Idea | Motion and practical use | Controls beyond common timing |
| --- | --- | --- |
| 13. Traveling hop | A single bounce passes across a readable word. | Height, pulse width, repeat gap |
| 14. Baseline pendulum | Characters swing from their own attachment points and settle. | Pivot, rotation, decay, phase |
| 15. Jelly / squash wave | Compression and stretch propagate through the letters. | Axis coupling, amplitude, wavelength |
| 16. Weight / width / slant wave | Supported font axes vary across the phrase. | Axis range, spatial window, spacing policy |
| 17. Spotlight focus | A moving window brings dim or blurred text into focus. | Window width, softness, brightness, blur |
| 18. Karaoke fill | Color progresses through a phrase according to word timings. | Word markers, active/inactive colors, fill vs block |
| 19. Outline-to-fill | A line drawing becomes a filled title. | Outline width, fill overlap, transition point |
| 20. Glyph construction | Strokes, dots or components assemble into letterforms. | Assembly sequence, stroke duration, component lag |
| 21. Ink / print pulse | Letters appear as repeated impressions with small seeded registration changes. | Frequency, seed, offset, ink variation |
| 22. Light sweep / neon build | A timed highlight crosses the word or illuminated letters activate in sequence. | Sweep width, glow, step timing, decay |
| 23. Chunked glitch | Scheduled slices or blocks shift, then return to readable text. | Seed, burst timing, block size, channel offset |
| 24. Split-flap / odometer | Characters or digits roll through fixed slots to their next state. | Alphabet, direction, slot mask, steps, alignment |

References: [Flexile's mid-shot keyframe groups](https://flexile.io/text-presets), [Webster's constructed glyphs](https://animography.net/products/webster), [Compression](https://animography.net/products/compression), [Adobe variable-font selectors](https://helpx.adobe.com/after-effects/desktop/variable-font-axes/work-with-variable-font-axes/working-with-variable-font-axes.html), [Typotheque's continuous font axes](https://www.typotheque.com/fonts/variable). A genuine path-written glyph is a different capability from simply revealing a horizontal text rectangle.

### Seamless loops and typographic compositions

| Idea | Motion and practical use | Controls beyond common timing |
| --- | --- | --- |
| 25. Echo stack | Delayed text copies create rhythmic depth. | Copies, offset, delay, fade |
| 26. Marquee bands | Repeated phrases circulate continuously through rows or columns. | Direction, speed, gaps, row offsets |
| 27. Tidal field | A grid of type undulates as intersecting waves pass through it. | Rows, columns, amplitude, two wave phases |
| 28. Magnification swell | A lens-like emphasis travels through dense text. | Radius, magnification, path, falloff |
| 29. Accordion rows | Lines compress and expand in a coordinated rhythm. | Line spacing, squeeze, anchor, phase |
| 30. Kinetic word layout | Words trade prominence and make space for the next phrase. | Focus order, minimum size, transition overlap |
| 31. Shape-filled text flow | Moving text fills a silhouette while its boundary changes. | Shape, flow, line widths, spacing, clipping |
| 32. Teletext / dot-matrix build | A character-grid title constructs itself through timed rows and blocks. | Grid, page timing, signal errors, row order |
| 33. Font-axis breathing | Width or weight expands and contracts in a smooth loop. | Axis, minimum/maximum, cycle count, phase |
| 34. Match-cut word sequence | Changing phrases share a common anchor or letter alignment. | Sequence, hold lengths, anchor, transition recipe |

References: [Dasca's kinetic presets](https://dasca.studio/docs/kinetic-typography), [Space Type Generator Flash](https://spacetypegenerator.com/flash), [Poster Lab](https://poster-lab.romeroloconte.com/), [GlyphFlow](https://github.com/hubertlim/GlyphFlow), [Typogram's variable font gradients](https://typogram.co/studio/landing). Typogram is a reference for a spatial style gradient; making that gradient travel over time is the proposed Raylight animation, not an existing feature claim about Typogram.

### Spatial and experimental type

| Idea | Motion and practical use | Controls beyond common timing |
| --- | --- | --- |
| 35. Circular badge / orbit | Letters follow a rotating circular baseline. | Radius, arc, offset, orientation |
| 36. Cylinder / cryptex | Repeating text wraps around a rotating cylindrical surface. | Radius, rows, spin, facing |
| 37. Coil / helix | Text winds through a continuous spatial spiral. | Pitch, turns, radius, twist |
| 38. Ribbon / knot | Words move along a bending band in space. | Path, twist, thickness, travel |
| 39. Waving flag | A text surface ripples with configurable pinning. | XYZ amplitude, phase, speed |
| 40. Perspective corridor / tunnel | Repeating words recede toward a vanishing point. | Depth, spacing, camera travel, fade |
| 41. Depth wave | Individual glyphs advance and retreat along Z. | Depth, phase, focus distance |
| 42. Layered extrusion | Delayed silhouettes create animated depth behind text. | Depth, copies, offset, color ramp |
| 43. Particle assemble / dissolve | A fixed particle set converges on glyphs and disperses. | Seed, density, route, timing |
| 44. Gravity drop / collapse | Glyphs tumble, collide and settle according to a reproducible simulation. | Gravity, restitution, floor, seed, bake |
| 45. Variable color-font depth | A suitable font's own depth or highlight axis animates. | Supported axes, palette, phase |
| 46. Contour morph | Compatible glyph outlines interpolate into a new word. | Correspondence, intermediate shape, timing |

References: [Space Type Generator](https://spacetypegenerator.com/), [ATOM](https://atomtypelab.com/about), [Type Physics](https://typephysics.type.today/), [Nabla's font axes](https://nabla.typearture.com/), [Cavalry's text hierarchy](https://cavalry.studio/docs/nodes/behaviours/sub-mesh/).

Particle and gravity designs are proposals for deterministic timeline versions. Cursor-driven particle repulsion is excluded. Contour morphing is a higher-cost investigation: arbitrary font glyphs do not automatically share compatible contours, and crossfading whole words should not be presented as a true outline morph.

## Fit with Raylight's current implementation

Inspected `src/panels/Inspector/animationModel.ts`, `src/engine/evaluateLayer.ts` and the current text rasterization path.

- Existing text-specific functions include typewriter, scramble, counters and text replacement. Existing layer motions include slides, fades, focus, pop, rotation, flips, swing, path following, shimmer and emphasis.
- The current stagger setting participates in substring revelation. It does not yet provide independent transform, opacity, blur, fill or timing tracks for every glyph. Adding more named presets on top of that would reproduce a small set of whole-layer motions.
- Text is rasterized into a layer texture. Surface Wrap can deform that texture, which is useful for a flag or bent title. It cannot independently position letters around a helix or give every glyph its own 3D rotation.
- Shape path reveal already exists; genuine text write-on requires glyph outlines or another stroke representation. These must remain distinct in the UI.

### Suggested shared foundation

1. **Text layout:** shape text once, then expose stable glyph, word and line units. Preserve kerning, ligatures, baseline metrics, punctuation, whitespace, grapheme clusters and right-to-left shaping. Do not split text by raw string indices.
2. **Selectors:** choose all units, a range, a traveling window, seeded random order, or a spatial falloff. Support forward, reverse, center-out, edges-in and custom ordering. [Cavalry](https://cavalry.studio/docs/nodes/behaviours/sub-mesh/) and [Adobe](https://helpx.adobe.com/after-effects/desktop/variable-font-axes/work-with-variable-font-axes/working-with-variable-font-axes.html) are strong references for this structure.
3. **Channels:** independently animate position, rotation, scale, opacity, blur, fill, stroke, tracking and supported font axes. Reuse the current easing and animation-block evaluation.
4. **Recipes:** masked rise, cascade, wave, jelly, word punch and spotlight become parameter sets on that shared engine. Provide In, Hold/Loop and Out phases, not just an entrance and exit.
5. **Generators:** cylinder, helix, ribbon, text field and tunnel generate a composition of text units. They should be presented as text generators or layouts rather than pretending to be another blur-like layer effect.
6. **Simulation:** particle and physics presets need a deterministic sampler or a baked state cache. The same frame must render identically when reached through playback, seeking or export.

Variable-font axes require actual support from the selected font. Changing `scaleX` is a geometric stretch, not a genuine width-axis animation. Decide whether axis changes preserve layout or allow reflow; offer both deliberately rather than accepting accidental word-wrap changes.

### Proposed release order

**First:** the glyph/word/line animator, masked rise, cascade, alternating slide, word punch, tracking settle, traveling hop, elastic unfold and rolling digits. This is the best practical library for titles, captions and promotional videos.

**Second:** variable-font wave, echo stack, spotlight, karaoke fill, outline-to-fill and timed glitch. Upgrade the existing scramble and counter recipes rather than duplicating them.

**Third:** flag, circular path, cylinder, helix, ribbon, tunnel and shape-filled fields. Treat these as composition generators with their own camera and repetition controls.

**Later:** particle assembly, simulated glyph physics and contour morphing. These have larger performance, shaping and reproducibility requirements.

Common controls should include start, duration, stagger/overlap, easing, unit, ordering, anchor, phase, amplitude, seed, loop length, hold and exit. A loop length must define a repeatable cycle; setting its speed independently should not silently break the seam.

## Additional references worth keeping

| Reference | Why it is useful | Interaction filter |
| --- | --- | --- |
| [Moving Letters](https://tobiasahlin.com/moving-letters/) | Compact reference implementations for letter sequencing and title builds. | Use its time-based sequences; omit webpage triggers. |
| [Type Jazz](https://docs.jakeinmotion.com/type-jazz/) | A focused animator model with grouping, oscillation, bounce, 3D and font axes. | Timeline controls. |
| [Flexile](https://flexile.io/text-presets) | Good examples of combining entrances with mid-shot emphasis. | Hover starts gallery previews, but the underlying animations are timed. |
| [Animography](https://animography.net/) | Glyph-level construction and typeface-specific personality. | Use as a reference for authored glyph motion. |
| [Dasca](https://dasca.studio/docs/kinetic-typography) | Generative text compositions such as radial lists, tunnels, echoes and moving fields. | Select authoring controls, then render from its timeline. |
| [ATOM](https://atomtypelab.com/about) | Experimental type, particles, layered compositions and spatial loops. | Retain autonomous designs; exclude live cursor effects. |
| [Type Physics](https://typephysics.type.today/) | Coupling glyph motion and font axes. | Reproducible timed/baked motion only. |
| [Poster Lab](https://poster-lab.romeroloconte.com/) | Strip deformation and bold typographic poster structures. | Animation ideas only; static styles are not themselves animations. |
| [Typotheque](https://www.typotheque.com/fonts/variable) | Genuine continuous axis variation. | Animate authored axis values from time. |
| [Nabla](https://nabla.typearture.com/) | A font-specific example of controllable extrusion and highlights. | Replace specimen sliders with authored axis tracks. |
| [Typogram](https://typogram.co/studio/landing) | Fine-grained letter control and spatial font-axis gradients. | Treat animation as our proposed extension of the static design idea. |

Museum source code was read locally at the commit above because the web reader could not retrieve its GitHub pages. Other references were checked through their official sites or documentation. This research did not execute the supplied repository, install a library, or alter Raylight's animation behavior.
