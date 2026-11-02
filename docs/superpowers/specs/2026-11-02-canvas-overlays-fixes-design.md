# Interactive Canvas Overlays and Gizmos

## Intent

Make the stage's direct-manipulation controls reliable, undoable, and consistent with the spatial editing behavior described in the overlay audit, while preserving existing canvas and project behavior except where the audit and user decisions below call for a correction.

## Goals

- Correct marquee selection for layer polygons that intersect the marquee, including cases where neither the layer center nor a corner is inside it.
- Make multi-selection resize and rotation operate on the selected group using a combined projected bounding box.
- Make light gizmos reflect the same enabled state as the renderer and honor the gizmo visibility setting.
- Treat pointer cancellation or lost pointer capture as cancellation: restore the drag-start value and close the history transaction without retaining a partial edit.
- Make corner-radius adjustment one undoable drag rather than a history entry for every pointer move.
- Provide one shared camera preset source, remove duplicate poses, and replace the trackball UI with a clickable orientation cube including Front, Top, Side, and Perspective-style views.
- Add viewport zoom access to the normal floating toolbar.
- Improve keyboard access and accessible labels for interactive spatial controls.
- Remove unused or redundant overlay/toolbar code that is made obsolete by these fixes.

## Confirmed decisions

- Implement all actionable fixes from the audit workplan.
- Multi-selection transforms act on the whole group, not only the primary layer.
- Canceled drags roll back to their start state.
- Replace the orientation trackball with a clickable orientation cube.

## Scope and implementation calls

- Keep changes within stage overlays, gizmos, toolbar, related state/store integration, directly relevant tests, and this design document.
- Use projected layer polygons for marquee intersection. Use robust polygon/rectangle intersection rather than only testing centers and corners.
- Compute the union of selected layers' projected bounds for group transform handles. Apply resize scale factors and rotation around the group's shared center to all selected layers while preserving per-layer depth and existing rotation components unrelated to the 2D group rotation.
- Keep an explicitly selected light editable when gizmos are hidden, but hide unselected light badges. Never expose a disabled light as an available gizmo.
- Share camera view definitions between camera controls; keep view labels and poses unique. Cube faces snap to the six axis-aligned views; its center selects a perspective/isometric view. The cube is a view selector, not a free-drag trackball.
- Make interactive spatial controls keyboard-focusable and named. Provide Enter/Space activation and context-appropriate keyboard adjustments; the orientation cube must be operable without a pointer.
- Use existing store transactions and event-handling patterns. Ensure pointer identity, `pointercancel`, lost capture, unmount cleanup, Escape, and normal pointer-up each end a drag exactly once.
- Remove only code proven unused after wiring replacement behavior; do not broaden cleanup to unrelated stage code.
- Add behavioral tests for marquee intersection, group transforms, light visibility/enabled state, transaction/cancellation behavior, camera presets, and toolbar zoom.

## Non-goals

- Reworking the renderer's lighting algorithms.
- Changing project serialization or adding new persisted project fields.
- Redesigning unrelated inspector panels, general canvas navigation, or animation workflows.

## Acceptance criteria

- Marquee selection includes a layer whenever its projected polygon intersects the marquee and excludes non-intersecting polygons.
- Group resize and rotation update every selected layer consistently and produce one undo step per completed drag.
- Disabled lights cannot be selected or edited through stage gizmos; gizmo visibility hides unselected badges without stranding a selected light.
- A canceled drag restores its initial model state and does not leave a history transaction open.
- Camera controls contain no duplicated equivalent presets; the orientation cube supports pointer and keyboard activation.
- Viewport zoom can be changed without entering camera mode.
- Targeted tests and lint pass; no unrelated tracked files are changed.
