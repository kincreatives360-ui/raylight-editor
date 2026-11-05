# Full App Audit Fixes Implementation Plan

**Goal:** Resolve the high-priority interaction, accessibility, responsive, and motion defects identified in the full editor audit.

**Architecture:** Reuse the existing React and Tailwind patterns. Add one small shared modal-focus hook for the three user-facing dialogs; keep editor state and rendering behavior in their existing components.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Vite.

## Work groups

1. Correct Share feedback and remove the inactive profile affordance in `RightSidebar.tsx`.
2. Add active-descendant semantics and focus management to `CommandMenu.tsx`; add dialog naming, focus management, and small-height scrolling to `ExportModal.tsx` and `KeyboardShortcutsModal.tsx` via a shared `useModalFocus` hook.
3. Add keyboard selection to shot clips and a semantic Add Layer control in `Timeline.tsx`; label the WebGL scene canvas in `ViewportCanvas.tsx`.
4. Prevent both side panels from opening simultaneously below the existing 860px breakpoint in the selection store, preserving the stage's usable width.
5. Restore focus on camera-popover dismissal, improve framing-handle hover/press feedback, and remove ineffective toast transitions.

## Constraints

- Preserve the existing dark studio visual system and user project data.
- Do not add dependencies or modify unrelated lighting-engine work.
- Do not add or run tests for this request; verify source with lint/build and the browser.
- Keep Escape handling, existing keyboard shortcuts, and pointer-drag behavior intact.
