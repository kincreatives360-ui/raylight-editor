\---

name: parity-auditor

description: Run a comprehensive side-by-side parity analysis between the local codebase (localhost) and a reference web application (such as raylight.app). Use when the user asks for parity analysis, gap analysis, visual or feature comparison against a live site, or wants to generate a PARITY\_MATRIX.md report.

\---

\# Web App Parity Auditor



Compare the local application against a live reference URL across four dimensions: Visual Tokens, Interactive Controls, State \& Data Schema, and Motion Performance.



\## Instructions



1\. \*\*Dual-Session Snapshot Capture:\*\*

&#x20;  - Open two isolated browser sessions at `1920x1080` using `agent-browser` or Playwright: one for the reference URL (`--session ref`) and one for the local dev server (`--session local`).

&#x20;  - Capture interactive accessibility snapshots (`snapshot -i --json`) and screenshots from both sessions.



2\. \*\*Diff Interactive Controls Against the Checklist:\*\*

&#x20;  - Read `resources/motion-editor-checklist.md`.

&#x20;  - Compare every button, canvas tool, timeline track, and shortcut between the reference app and local build. Classify each as `Implemented`, `Partial`, `Stubbed (UI Only)`, or `Missing`.



3\. \*\*Audit Visual Tokens \& 60fps Motion Physics:\*\*

&#x20;  - Compare local CSS variables and styles against the reference `DESIGN.md` tokens.

&#x20;  - Verify high-frequency interactions (playhead scrubbing, panning, dragging) use `useRef` and `requestAnimationFrame` instead of triggering React state re-renders on every frame.



4\. \*\*Verify Codebase Wiring:\*\*

&#x20;  - Check local event handlers in `src/` to confirm UI buttons actually mutate the core state store.



5\. \*\*Generate `PARITY\_MATRIX.md`:\*\*

&#x20;  - Write `PARITY\_MATRIX.md` in the project root scoring each subsystem from `0%` to `100%` with an ordered list of exact file-and-line tasks to close the gaps.

