# Depth of Field Rebuild Design

## Intent

Replace the editor's custom depth-of-field (DOF) implementation with
`pmndrs/postprocessing` and rebuild its focus controls around the Raylight
reference editor. The current effect is a single custom shader and the current
focus overlay has grown into a collection of depth sheets, a ruler, layer
feedback, a draggable marker, and a temporary focus mode. The reference instead
shows a persistent, minimal focus-plane guide and keeps focus adjustments in
the DOF controls.

The rebuild should make focus distance correspond to actual camera/world depth,
produce DOF in the shared scene render path, keep editor UI sharp, and avoid
changing unrelated scene effects.

## Reference observations

- The DOF controls include a **Focus on** selector, an aperture/f-number
  control, separate **Blur settings**, a **Bokeh** selector, Position X/Y,
  Depth, **Snap to subject**, **Animate focus**, and **Animate blur**.
- The focus guide remains visible after closing the settings popover while DOF
  is enabled.
- The guide is one unfilled projected quadrilateral, with a 1.5 px primary
  stroke. It is an SVG overlay with pointer events disabled.
- No depth sheets, focus marker, ruler, per-layer status, or drag handles were
  visible in the reference state.
- The scene image is blurred while editor overlays remain crisp.

## Goals

1. Use `DepthOfFieldEffect` from `pmndrs/postprocessing`, rendered through an
   `EffectPass` in the existing Three.js `EffectComposer`. Preserve the existing
   scene-effect ordering, output-encoding pass, FXAA, and shared live/export
   render path. Do not replace or reorder unrelated effects.
2. Use the scene depth texture and the active camera. Convert the authored
   focus target into a world-space point so X/Y/Depth and subject focus resolve
   to a camera-relative focus distance.
3. Replace the DOF overlay with only the persistent, passive focus-plane
   outline described above. Keep it visible whenever DOF is enabled, including
   when the settings panel is closed or idle. Disable its pointer events.
4. Rebuild the DOF controls around the reference flow: focus target, aperture,
   blur settings, bokeh, target position/depth, subject snapping, and animation
   actions. Integrate them into the existing Inspector rather than redesigning
   the surrounding application shell.
5. Make **Animate focus** create an 800 ms ease-in-out focus transition from the
   current depth to the selected target. Make **Animate blur** create an 800 ms
   ease-in-out transition from zero blur to the authored blur amount.
6. Preserve compatibility with existing saved projects and retain existing
   focus-block playback.

## Non-goals

- Replacing the composer or changing the rendering of non-DOF effects.
- Reworking selection, camera, lighting, or other stage overlays.
- Keeping the old click-to-focus mode, D-key rack-focus gesture, ruler,
  per-layer feedback, focus marker, or depth-range sheets.
- Adding focus stacking, physical camera simulation beyond the library's
  supported model, or a new timeline editor.

## Design and implementation calls

### Rendering

- Add the `postprocessing` dependency and create the library DOF effect and
  `EffectPass` only while the scene DOF pass is enabled.
- Insert that pass at the existing `depthOfField` position in the ordered
  effect pipeline. Initialize and resize it with the shared renderer and its
  existing depth texture; dispose the effect/pass with the composer lifecycle.
- Keep other scene effects in the current Three.js composer. This avoids a
  broad composer migration and preserves effect ordering and output encoding.
- Set the library effect's camera-relative focus target from the authored
  point (or selected subject), and update its focus distance/range and bokeh
  scale from evaluated settings. Rendering must remain confined to the scene
  image; React/SVG editor overlays stay outside the post-processing pipeline.
- Remove the custom DOF GLSL branch and its DOF-only uniform configuration.
  Remove the per-layer DOF blur calculation/metadata once no longer needed;
  preserve authored layer blur and unrelated texture effects.

### Focus controls and animation

- The **Focus on** control offers a point and focusable scene subjects. A
  subject choice is stored as an optional subject ID; point focus continues to
  use the existing normalized X/Y and depth values.
- Point X/Y retain the existing normalized-frame convention (`[-1, 1]`, Y up).
  Depth retains the existing world-Z convention used by layer positions and the
  focus-plane projection. Convert a point by casting its camera ray and
  intersecting the world-Z plane at that depth; recompute after camera changes.
- The subject list uses visible evaluated scene layers and focuses each
  layer's evaluated center. If a stored subject is no longer available, fall
  back to the last authored point rather than losing the saved target.
- **Snap to subject** targets the selected layer and updates the stored target
  accordingly.
- **Animate focus** uses the existing focus-block timeline model. **Animate
  blur** uses an explicit DOF blur parameter in the scene-effect animation
  block model; old DOF animation blocks without a parameter continue to mean
  focus-depth animation.
- Both actions create a block at the current playhead using the confirmed
  800 ms ease-in-out transition. Their endpoint is the selected focus target or
  current authored blur amount, respectively. Focus blocks capture numeric
  depths at creation (they do not follow a moving subject). Blur animates
  `bokehScale` from zero to its authored value, holding aperture and focus
  range constant.

### Overlay

- Keep/reuse the existing focus-plane projection math where correct, but render
  exactly one SVG polygon with no fill, a 1.5 px primary-color stroke, and
  `pointer-events: none`.
- Show it only while the DOF effect is enabled; never fade or hide it due to
  inactivity or popover visibility.
- Remove the extra visual and interaction components when no longer used.

### Saved-project compatibility and unsupported legacy controls

- Keep existing DOF fields in the saved-project schema so older files continue
  to load. Reuse `focusRange`, aperture, bokeh scale, focal length, target, and
  focus mode where they have a meaningful mapping to the library.
- Add optional focus-subject and animation-parameter fields with migration-safe
  defaults. Existing projects without these fields retain point focus and
  existing focus-block behavior.
- Map aperture inversely to the library's bokeh scale, keeping the existing
  focal-length multiplier so lower f-numbers and longer focal lengths still
  increase blur. Calibrate the mapping against the current default scene.
- `pmndrs/postprocessing` provides its built-in spherical bokeh rather than the
  old custom shader's selectable anamorphic/vintage/portrait kernels and
  highlight-threshold boost. The rebuilt Inspector shows the supported
  spherical bokeh only. Keep legacy shape/highlight fields readable, but do not
  claim they affect the new renderer.

## Validation

- Unit tests cover effect/pass creation, effect ordering, focus-point and
  subject distance mapping, sizing/disposal, and old saved-project defaults.
- Overlay tests assert one passive polygon while enabled, no auxiliary
  interaction visuals, and persistence after idle/popover close.
- Animation tests assert an 800 ms ease-in-out focus block and blur block with
  correct start/end values, without changing focus when animating blur.
- Run the focused stage/webgl/effect tests, typecheck, lint on touched files,
  and production build. Visually verify that depth-aware blur affects the scene
  but leaves overlays crisp.

## Left to the builder

- Choose the smallest safe adapter between `postprocessing.EffectPass` and the
  existing Three.js composer, respecting initialization, depth-texture
  ownership, size changes, and disposal.
- Calibrate the legacy aperture/focal-length/bokeh-scale values to the
  library's scale and document any field that remains serialized but no longer
  affects rendering.
- Keep migration and UI changes narrowly scoped to DOF.
