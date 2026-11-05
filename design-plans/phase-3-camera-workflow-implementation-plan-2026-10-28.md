# Phase 3 Camera Workflow Implementation Plan

**Status:** Implemented and verified.

**Goal:** Add the seven audited named viewpoints and a clear pin/return workflow while keeping camera framing separate from canvas zoom and preserving authored shot/camera-block evaluation.

**Architecture:** Add the seven named views to the OrientationGizmo and route their angles through the existing active-camera update path. Keep Pin state transient in selection state; Back restores through the existing authored camera update path. Centralize view values and bookmark state for testability.

**Tech stack:** React, TypeScript, Zustand, existing camera evaluator, Vitest.

**Roadmap:** `design-plans/raylight-parity-upgrade-roadmap-2026-10-28.md`, Phase 3.

## Ruling

The original reference audit recorded the contextual controls and labels but did not exercise their actions. At the user's direction to match the observed audit, preserve the observed Angle/Pin/Back presentation. For local behavior use a reversible transient interpretation: Pin bookmarks the current evaluated view for the active shot, and Back restores it without changing canvas zoom/pan. Cost if wrong: the reference may use Pin to lock a camera target or authored camera move; the implementation must keep the action local and non-destructive until that contract is observed.

**Implementation:** Added seven tested angle values; Angle menu, contextual Pin/Back controls, per-shot transient bookmarks including target, zoom and lens, authored camera block/framing restoration, and observed Shift+F Orbit / Shift+C Scissors bindings. Plain F remains Frame Selection. Existing camera gestures and canvas zoom state are unchanged.

**Verification:** 532 tests passed; production build passed; lint has zero errors and one pre-existing warning in `SceneEffectsPipeline.tsx:102`. Focused UI/store/shortcut tests passed. Browser interaction was unavailable because browser use is disabled in Work settings.

## Tasks

1. **Named views:** Add failing UI tests for all seven labels and exact angle values; add a focused `CAMERA_ANGLE_VIEWS` registry and render it in the quick-view menu; verify callbacks and reset/current quick views remain intact.
2. **Pin/Back state:** Add failing store tests for per-shot pin isolation and clearing; add transient bookmark state to the selection store only; wire Pin/Back and disabled states in the contextual Orbit controls.
3. **Camera and zoom semantics:** Keep selected shot/authored camera updates on view selection; Pin/Back must not change `canvasZoom` or `canvasPan`; preserve camera block evaluation and current camera zoom handling. Add regression tests.
4. **Shortcut parity:** Verify Orbit and Scissors labels against App key handling, CanvasToolbar and KeyboardShortcutsModal; correct mismatches and test central metadata.
5. **Audit/verification:** Update roadmap evidence; run focused tests, full suite, build and lint; manually inspect if browser access is available; commit the scoped Phase 3 change.
