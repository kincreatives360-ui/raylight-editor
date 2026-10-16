# Raylight parity replacement package

This package replaces the source files in the supplied project and includes the following changes:

1. Timeline hover ghost playhead, separate from the blue active playhead.
2. Clickable shot segments remain enabled for selection/seeking.
3. Multiple scene light sources: directional, point, spot, area, and ambient; editable enabled state, color, and intensity.
4. Initial/default project is blank; starter template modal/component/data and sample project content are removed.
5. Canvas toolbar adds Pen, Polygon, Rectangle, Line, and Arrow tools.
6. Image imports create a new layer if no image layer is selected. Audio imports create real timeline clips and are decoded/synchronized for playback. Video imports are added as muted media clips in the timeline.
7. Removed the amber placeholder audio bar; actual imported media clips are displayed in a neutral blue/slate track.
8. Removed the on-canvas light dot; lights are adjusted in Lighting controls.
9. New layer animation blocks start relative to the selected layer's in-point and are bounded to the layer's out-point.
10. Layer masking selector is available on layers; shape layers are alpha-composited as masks in the WebGL layer texture. Shape fill, stroke, and effects controls remain available.

## Replace instructions

1. Make a backup of your current project folder.
2. Extract this ZIP.
3. Copy the extracted project files over the matching files in your existing project folder, allowing the updated files to replace the old ones.
4. Keep your existing `package.json` and `package-lock.json` (they are included and unchanged except for normal project metadata if any).
5. Run `npm install`, then `npm run dev`.

Imported video currently appears as a timeline media clip; synchronized video-texture playback inside the canvas is not yet implemented. Audio playback is synchronized to the playhead.
