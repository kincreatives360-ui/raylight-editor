# Phase 4 Canvas Tool Scope and Discoverability Plan

**Status:** Implemented and verified.

**Goal:** Close the verified canvas creation discoverability gap and make the Comment/Frame product-scope decisions explicit without presenting controls the app cannot honor.

**Architecture:** Reuse the existing Pen path creation and polygon-layer model. Expose Pen in the shape tool menu and preserve its P shortcut across toolbar, help and command search. Keep unsupported Comment and frame-container creation out of the UI/parity contract; retain the existing camera Frame Scene/Selection actions with clear labels.

**Tech stack:** React, TypeScript, existing Zustand selection state and layer store, Vitest.

**Roadmap:** `design-plans/raylight-parity-upgrade-roadmap-2026-10-28.md`, Phase 4.

## Scope ruling

- **Pen:** In scope. It already captures freehand points and creates a polygon path shape. Surface it in the Shape menu with P, retain the keyboard shortcut/help entry, and add a matching command-menu action. Do not fork the existing path representation. Current contract is a closed polygonal fill (including the current auto-outline for two-point/near-linear strokes); Bézier handles and node editing are not implemented and remain out of scope until a path-editing model is designed.
- **Comment:** Out of scope. The reference audit only observed the control; local app has no collaboration identity, thread/reply model, or comment lifecycle. A local document annotation is a different feature and should not masquerade as collaborative commenting. Keep Comment absent from toolbar/help/commands and mark the reference gap as intentionally deferred.
- **Frame creation:** Out of scope. Local projects have one fixed stage/artboard per project/shot and no frame/container geometry, clipping, or frame-child layout model. Keep frame creation absent. Preserve and label existing Frame Scene/Selection as camera framing actions.

## Tasks

1. Add failing tests for Pen visibility in `SHAPE_TOOL_ITEMS`, P binding parity, and absence of unsupported Comment/frame-creation actions.
2. Add Pen to `src/stage/canvasToolItems.ts` and ensure Shape toolbar recognizes it as active; keep icon/label/shortcut explicit.
3. Add `Pen path tool` to App Command Menu with P and the existing `setActiveTool('pen')` action.
4. Audit Stage creation, selection, project serialization and renderer support to confirm Pen still creates an ordinary polygon ShapeLayer; add focused regression coverage where the existing store APIs allow.
5. Update the roadmap and audit with the scope ruling and remaining Pen editing limitations.
6. Run focused/full tests, build and lint; note browser restrictions if applicable; commit the scoped change.

**Verification:** 536 tests passed; production build passed; lint has zero errors and one pre-existing warning in `SceneEffectsPipeline.tsx:102`. The Pen path lifecycle test covers selection model creation, JSON schema round-trip, undo and redo. Browser pointer interaction was unavailable in Work settings.
