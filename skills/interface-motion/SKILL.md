---
name: interface-motion
description: Use when building, refining, or reviewing app interface animations: responsive control feedback, anchored menus, dialogs, drawers, tabs, inspector disclosures, and smooth state changes that remain correct during interruption, keyboard use, and reduced motion. Applies across frameworks and native platforms.
---

# Interface motion

Implement compact, responsive interface motion with stable spatial anchors. This is a portable instruction skill: use the host agent's normal file, browser, and testing tools. No particular agent, framework, or animation package is required. Read references/motion-contract.md for timing recipes, implementation patterns, and acceptance cases.

## Workflow

1. Inspect the target components, existing motion library, focus behavior, and reduced-motion handling. Preserve the application's visual identity and behavior. Reuse its existing animation tools.
2. Identify each trigger and state pair: hover, focus, pressed, open/closed, selected, loading, and interrupted. Specify the animated properties, start/end values, duration, easing, anchor, exit lifetime, and reduced-motion alternative before implementation.
3. Choose a recipe from the reference, then adjust its distance and timing to the component size and interaction frequency. Treat recipe values as starting points. When matching a supplied reference, observe the actual interaction; a still image cannot establish timing or spring behavior.
4. Implement the smallest coherent set of motion tokens and component changes. Prefer CSS for simple state changes; use the existing animation engine for shared geometry, gestures, or interruption. Adapt to native platform animation primitives when needed.
5. Exercise real interactions in the running app. Verify entrance and exit, rapid reversal, keyboard use, reduced motion, scrolling, and small screens. Inspect intermediate frames or a recording for spatial jumps; settled screenshots alone cannot establish animation fidelity.
6. Report changed components, verification performed, and any remaining behavior or performance limitations.

## Motion rules

- Let feedback begin on input. Avoid decorative delays on frequent editor actions.
- Keep toolbar and inspector content anchored. Animate local state without moving the entire workspace.
- Use explicit transition properties. Prefer opacity and transform for movement; avoid transition: all and per-frame layout reads/writes.
- Keep positioning transforms separate from animated transforms using a wrapper or composed transform. A centered dialog must stay centered throughout its scale animation.
- Animate overlays and content independently. Retain exiting content until its exit finishes, then release it. Closing content must stop receiving input immediately.
- Handle interrupted transitions from the current visual state. Repeated toggles must converge on the latest requested state without stale callbacks removing reopened content.
- Preserve dialog focus trapping, Escape dismissal, focus return, menu arrow navigation, and visible focus indicators through animation.
- Honor reduced motion: remove scale, translation, springs, and stagger; apply immediate state changes or a brief opacity change. Never delay access to controls.
- Keep essential status and information available without motion. Avoid perpetual decorative animation in a working editor.

## Delivery contract

Produce working component changes, a small reusable token set, and verification evidence when implementing. When asked only for advice, produce a state/property/timing table and concrete component recommendations. Do not introduce a new dependency solely for fades or hover colors. Do not promise perfect fidelity across every framework or device; specify what was observed and tested.

