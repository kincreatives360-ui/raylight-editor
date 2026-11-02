# Interactive Canvas Overlays, Gizmos, and Focus Plane

## Intent

Make the stage's direct-manipulation controls reliable, undoable, and consistent with the spatial editing behavior described in the overlay audit. Turn depth of field into a visible, direct-manipulation scene control while preserving existing canvas and project behavior except where the audit and user decisions below call for a correction.

## Goals

- Correct marquee selection for layer polygons that intersect the marquee, including cases where neither the layer center nor a corner is inside it.
- Make multi-selection resize and rotation operate on the selected group using a combined projected bounding box.
- Make light gizmos reflect the same enabled state as the renderer and honor the gizmo visibility setting.
- Treat pointer cancellation or lost pointer capture as cancellation: restore the drag-start value and close the history transaction without retaining a partial edit.
- Make corner-radius adjustment one undoable drag rather than a history entry for every pointer move.
- Provide one shared camera preset source, remove duplicate poses, and replace the trackball UI with a clickable orientation cube including Front, Top, Side, and Perspective-style views.
- Turn depth of field into an interactive focus object with perspective focus-zone sheets, a side-view depth ruler, direct focus gestures, layer focus/blur feedback, click-to-focus, and rack-focus keyframing.
- Add viewport zoom access to the normal floating toolbar.
- Improve keyboard access and accessible labels for interactive spatial controls.
- Remove unused or redundant overlay/toolbar code that is made obsolete by these fixes.

## Confirmed decisions

- Implement all actionable fixes from the audit workplan.
- Multi-selection transforms act on the whole group, not only the primary layer.
- Canceled drags roll back to their start state.
- Replace the orientation trackball with a clickable orientation cube.
- Implement the hybrid focus plane and depth ruler described in the user's Focus Plane brief; retain click-to-focus and improve its indicator.

## Focus Plane behavior

- Show a translucent focus sheet at the current depth-of-field target, projected in the scene with the same camera pose as layers. Show two fainter boundary sheets at the near and far edges of the sharp zone, derived from `focusRange`.
- Display the same focus position and range in a slim side-view ruler along the stage bottom, placed above the floating toolbar so neither obscures the other. The ruler shows camera/near at left, far at right, layer depth ticks, and a focus bracket with center and edge handles. The focus sheet and ruler are linked views of the same values: hovering the bracket highlights the sheet, and dragging either view updates the other.
- Dragging the sheet or ruler center changes focus depth; dragging either ruler edge changes `focusRange`. Use soft magnetic attraction around layer depths, but allow continued dragging to every in-between depth. `Shift` provides fine adjustment.
- Show the plane while depth of field is enabled. If a user invokes a `D` focus gesture while it is disabled, enable the effect as part of the focus edit.
- Hold `D` and drag vertically anywhere on the stage or scroll to adjust focus depth; `D` plus click on a layer focuses it directly. Use `D` plus bracket keys to hop between layers by depth so existing panel-toggle shortcuts remain unchanged.
- While holding `D`, click one layer and then `Shift`-click another to create a rack-focus segment from the first layer's depth to the second's. Requiring `D` preserves the existing `Shift`-click multi-select behavior otherwise. Reuse the existing `focusBlocks` model; do not introduce a new serialization format. Draw the animated focus path on the ruler and make the edit one undoable operation.
- Create rack-focus segments at the playhead with an 800 ms `ease-in-out` transition, preserving existing focus blocks. When direct focus adjustment occurs within an active focus block, shift both of that block's endpoints by the same depth delta so its easing and duration remain intact; outside an active block, update the base focus target.
- Use evaluated focus/blur values to show in-focus layers with a soft sky-blue outline and show out-of-focus blur amount without replacing the actual rendered effect.
- Focus sheets and indicators fade after interaction. Plane surfaces do not intercept layer selection; only explicit handles do. `Escape` during a drag restores the starting values. The whole drag is one undo step.

## Scope and implementation calls

- Keep changes within stage overlays, gizmos, toolbar, related state/store integration, directly relevant tests, and this design document.
- Use projected layer polygons for marquee intersection. Use robust polygon/rectangle intersection rather than only testing centers and corners.
- Compute the union of selected layers' projected bounds for group transform handles. Apply resize scale factors and rotation around the group's shared center to all selected layers while preserving per-layer depth and existing rotation components unrelated to the 2D group rotation.
- Keep an explicitly selected light editable when gizmos are hidden, but hide unselected light badges. Never expose a disabled light as an available gizmo.
- Share camera view definitions between camera controls; keep view labels and poses unique. Cube faces snap to the six axis-aligned views; its center selects a perspective/isometric view. The cube is a view selector, not a free-drag trackball.
- Model focus plane geometry against the existing camera and focus-target coordinate model. The depth ruler is a compact side-view projection of existing layer `position.z` values. Keep `focusBlocks` as the rack-focus source of truth; create each rack-focus segment at the playhead with an 800 ms `ease-in-out` transition.
- Gate `D`-modified focus gestures and rack-focus selection so ordinary layer selection, browser scrolling, and existing shortcuts continue to work when focus gestures are inactive.
- Make interactive spatial controls keyboard-focusable and named. Provide Enter/Space activation and context-appropriate keyboard adjustments; the focus ruler and orientation cube must be operable without a pointer.
- Use existing store transactions and event-handling patterns. Ensure pointer identity, `pointercancel`, lost capture, unmount cleanup, Escape, and normal pointer-up each end a drag exactly once.
- Remove only code proven unused after wiring replacement behavior; do not broaden cleanup to unrelated stage code.
- Add behavioral tests for marquee intersection, group transforms, light visibility/enabled state, transaction/cancellation behavior, camera presets, focus sheet/ruler interactions, rack-focus creation, and toolbar zoom.

## Non-goals

- Reworking the renderer's lighting or depth-of-field blur algorithms.
- Changing project serialization or adding new persisted project fields.
- Redesigning unrelated inspector panels, general canvas navigation, or animation workflows.

## Acceptance criteria

- Marquee selection includes a layer whenever its projected polygon intersects the marquee and excludes non-intersecting polygons.
- Group resize and rotation update every selected layer consistently and produce one undo step per completed drag.
- Disabled lights cannot be selected or edited through stage gizmos; gizmo visibility hides unselected badges without stranding a selected light.
- A canceled drag restores its initial model state and does not leave a history transaction open.
- Camera controls contain no duplicated equivalent presets; the orientation cube supports pointer and keyboard activation.
- The focus sheet, boundary sheets, depth ruler, and layer feedback all represent the same focus state and track stage zoom/pan. Click-to-focus and rack-focus remain available.
- Focus gestures do not steal normal selection, panel-toggle shortcuts, or scrolling outside active focus interaction.
- Viewport zoom can be changed without entering camera mode.
- Targeted tests and lint pass; no unrelated tracked files are changed.
