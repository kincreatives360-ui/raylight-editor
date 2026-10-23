# iPhone 15 Pro visual-model design

## Intent

Raylight's existing fixed device frame has the correct overall iPhone 15 Pro body and display dimensions, but it still reads as a generic phone: its front glass can wash out media, its controls are boxes, and its rear camera cluster is flat. This milestone turns that fixed model into a credible, premium iPhone 15 Pro render while keeping user media as the actual display content.

The user wants a frame that looks like a real phone for its selected model: correctly placed and proportioned features, a real black display bezel, a Dynamic Island for iPhones that support it, an unwashed screen, and a detailed rear with cameras and a logo. Visual realism, rather than a decorative phone-shaped border, is the success criterion.

## Goals

- Deliver one explicit, calibrated `iPhone 15 Pro` procedural device model using the existing fixed physical metrics: 70.6 mm wide, 146.6 mm high, and 8.25 mm deep.
- Preserve a separate display aperture inside the chassis, with its existing rounded corners and a symmetric black bezel. The device frame must never stretch or recolour the placed media.
- Give the front a correctly scaled, black Dynamic Island positioned at the top of the display aperture. It is an opaque hardware feature, distinct from the media and glass reflection overlay.
- Build a recognisably physical titanium side rail: separate action button, volume-up, volume-down, and side button forms at their correct sides and relative positions. Buttons must project from the chassis.
- Build a separate rear-glass surface, a raised camera plateau, three camera rings, three recessed lens-glass barrels, flash, and LiDAR/auxiliary sensor. Those details must have actual depth and remain visible in oblique/rear views.
- Add a centered rear Apple mark as a subtle, durable model detail whose contrast works on light and dark rear finishes.
- Replace the broad white wash with restrained, angle-readable glass reflection. The display image remains unlit and opaque; hardware lighting affects only chassis, rear glass, camera glass, and rail materials.
- Keep the current device root, projected bounds, selection affordance, opacity compositor, media fitting, and export scene behavior intact. The neon green outline remains editor-only and cannot appear in exports.
- Use no external 3D asset or new runtime dependency. Geometry remains procedural Three.js/R3F so sizing and rendering stay deterministic.

## Visual construction decisions

The model is a faithful iPhone 15 Pro interpretation, built from the existing dimension contract rather than a scanned or licensed asset. Small feature measurements that the current public body/display contract does not encode are implementation calibration values. The builder should centralize them in an iPhone model-layout helper, expressed as ratios of the fixed body/display dimensions, and cover their relative placement with tests.

The front stack, from rear to viewer, is: titanium body; black bezel ring; unlit media display surface with its saved fit/fill policy; a very thin clear screen-glass layer; restrained reflection highlights; and a black Dynamic Island above the display. Glass overlays must not blanket the screen with white, must not change screen brightness at a head-on view, and must stay behind the Dynamic Island.

The rear stack is: body and separately shaded rear glass; a raised square-with-rounded-corners camera plateau at the upper left; independent metallic lens surrounds; barrel depth; dark lens-glass discs recessed inside each barrel; flash; LiDAR/auxiliary dark sensor; and a centered, low-contrast Apple mark. The rear camera cluster must face rearward so it cannot appear through the opaque front display during rotation.

The side details use distinct geometry/material instances from the body. The action button and volume buttons are on the viewer's left when the screen faces the viewer; the side button is on the right. Their local bounds must feed the shared physical selection bounds.

## Material and lighting policy

- The display uses the milestone-2 unlit material policy with an opaque saved screen-fill backing. Studio lights, shadows, and tone mapping must not wash out display media.
- Titanium rail: high metalness with a restrained roughness so it reads as a softly brushed metal edge rather than chrome.
- Rear glass: lower metalness, moderate roughness, and a different response from the rail.
- Camera surrounds are metallic; lens glass is dark, glossy, and visibly inset; the flash is pale emissive/bright but not a screen-sized light source.
- The existing reflection overlay becomes a subtle specular accent. At 0-degree front view, it cannot obscure the media. At oblique views it may show a controlled highlight without becoming a white sheet.
- The existing local soft shadow remains a deliberate compositional shadow in this milestone. A physical scene receiver is outside this milestone.

## Acceptance views and checks

Use the actual Raylight renderer, a neutral studio background, then bright and dark backgrounds. Capture and inspect one device at Y rotations of 0, 30, 60, 90, 150, and 180 degrees, plus positive and negative X tilt. Use a media fixture containing saturated colours, text, circles, and transparency.

The front checks are: even bezel widths; properly positioned Dynamic Island; no media tinting or white wash; visible unlit display content; and reflection only when it adds a controlled highlight. The side checks are: visible chassis depth, rail material distinction, and correctly located protruding buttons. The rear checks are: camera plateau thickness, three separate lens barrels/recessed glass, flash/sensor placement, centered Apple mark, and an opaque body that prevents front media leaking through. Test overlapping devices and the existing partial-opacity compositor so depth remains coherent.

The milestone passes only when the accepted renderer captures show these views. Unit tests must cover the calibrated layout, topology/bounds, front-stack ordering, and material-policy invariants. Browser runtime checks must confirm the selection outline is absent when deselected and in exported/scene rendering.

## Constraints

- Keep the existing `geometryVersion: 1` physical-device contract and backward-compatible saved settings. Do not change old project layout, undo/redo, or media crop semantics.
- Keep the current size rule: a fixed device scales uniformly from placement, with media fitted into its fixed display aperture.
- Preserve `screenFit`, `screenFillColor`, opacity/visibility, and selection behavior from milestones 1 and 2.
- Do not claim that the other generic `iphone` or `iphone-classic` options are visually faithful; this milestone completes only `deviceId: iphone-15-pro`.
- Do not add an external model, network load, license dependency, or a native-resolution export redesign.
- Continue in this working tree without reverting unrelated user changes or earlier milestone work.

## Non-goals

- Supporting additional iPhone generations, Android phones, tablets, laptops, or interchangeable rear colours.
- Simulating a functioning iOS interface, animated Dynamic Island content, or operating-system chrome.
- Per-pixel refraction, physically based scene shadows, HDRI authoring, or a full product-photography lighting system.
- Changing the editor's green selection styling; this work only guarantees it is not part of scene/export rendering.

## Builder choices

The builder may choose the exact Three.js primitives and calibration constants, provided each feature has separate geometry/material ownership, the values live in a shared iPhone layout module, and the resulting bounds include every physical protrusion. The existing `PhoneDeviceFrame`, `phoneGeometry`, `phoneLayout`, and `useDisposable` boundaries should remain the basis of the implementation.
