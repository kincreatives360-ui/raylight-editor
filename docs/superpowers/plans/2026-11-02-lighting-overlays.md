# Lighting Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep editable light gizmos consistent with rendered light state and the user's gizmo visibility preference.

**Architecture:** Build the editor light list from enabled renderer lights, and separate selected-light visibility from unselected badges so the visibility preference cannot strand the active edit.

**Tech Stack:** React, TypeScript, Zustand, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-02-canvas-overlays-fixes-design.md`

## Global Constraints

- Keep changes within the stage overlay, gizmo, toolbar, related state/store integration, directly relevant tests, and this design document.
- Never expose a disabled light as an available gizmo.
- Keep an explicitly selected light editable when gizmos are hidden, but hide unselected light badges.
- Targeted tests and lint pass; no unrelated tracked files are changed.

## Review Focus

- A disabled source is not shown or selectable even if stale selected-light state references it.
- The key light is disabled while a source remains enabled.
- Gizmos are hidden while a light remains selected; active light editing remains usable.
- Gizmos are hidden while light placement is active; placement still works and new lights are selected.
- No lighting rig exists; adding a light still initializes the rig correctly.

---

### Task 1: Enabled-source and gizmo-visibility behavior

**Files:**
- Modify: `src/stage/LightingOverlay.tsx`
- Test: `src/stage/lightingOverlay.test.tsx`

**Interfaces:**
- No new public interfaces.
- Preserve `UnifiedLight` and `SelectedLightGizmo` props.

- [ ] **Step 1: Add failing tests** for disabled source omission, stale selection of a disabled source, `showGizmos=false` with no selection, a selected light with gizmos hidden, and keyboard access/names for selected-light drag controls.
- [ ] **Step 2: Run** `npm test -- src/stage/lightingOverlay.test.tsx`; confirm disabled lights are currently rendered and hidden-gizmo badges leak through.
- [ ] **Step 3: Filter** source gizmos by `enabled`, ensure selected-light lookup excludes disabled sources, and render unselected badges only when `showGizmos` is true while keeping a valid explicit selection editable. Add accessible names and focus/keyboard adjustment to selected-light source, target, depth, cone, area, and reach handles.
- [ ] **Step 4: Run** the focused file plus `src/engine/lightingSystem.test.ts`.
- [ ] **Step 5: Commit** as `fix: align light gizmos with enabled state`.
