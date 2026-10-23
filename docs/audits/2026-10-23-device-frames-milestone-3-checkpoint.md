# Device frames — Milestone 3 checkpoint

Date: 23 October 2026

## Delivered

- The fixed `iphone-15-pro` frame now uses one calibrated physical layout for its Dynamic Island, black bezel, rail controls, rear glass, raised camera plateau, three lens barrels, flash, LiDAR/auxiliary sensor, Apple mark, and selection bounds.
- The detailed model is an isolated fixed-device renderer path. Legacy and generic frame settings retain the Milestone 2 renderer.
- Camera lenses, rear plate, rails, and controls use depth-bearing geometry rather than flat discs or generic boxes.
- Screen artwork remains the existing unlit, opaque display surface. The new screen glass reflection is capped at 10% at head-on view and the Dynamic Island renders above it.
- Titanium rail, rear glass, lens ring, lens glass, sensor, flash, and Apple mark use separate material responses and independent disposal lifetimes.

## Automated evidence

- The complete automated suite passes: 37 files and 202 assertions, including the focused layout, bounds, geometry, material, media, compositor, and frame-layout coverage.
- Production build and changed-file lint passed after the detailed renderer was added.
- [Front fixture](milestone-3-front.jpg), [30-degree fixture](milestone-3-y30.jpg), [90-degree fixture](milestone-3-y90.jpg), [rear fixture](milestone-3-back.jpg), and [positive-tilt fixture](milestone-3-tilt.jpg) confirm the physical model is rendered in the live stage. The first blank capture was traced to the fixture's entrance fade at time zero, not a missing frame render; the fixture disables that animation for deterministic inspection.

## Required manual acceptance

The captured 0, 30, and 90-degree front/side views and 180-degree rear view confirm frame visibility, even bezel, Island placement, side depth, and the rear camera/mark assembly. A browser run with a real project image is still required to assess display-media clarity, together with the 60 and 150-degree rotations, negative X tilt, light/dark background pair, unselected export, and two-overlapping-partial-opacity-device checks.

## Limitation

The temporary browser's remaining capture commands were blocked by the desktop application's usage-limit approval service after the available live captures had been recorded. This does not indicate a renderer failure. The outstanding release-QA views above should be run once browser automation is available again.
