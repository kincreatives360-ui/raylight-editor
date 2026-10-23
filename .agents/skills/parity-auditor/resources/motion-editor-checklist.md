\# Motion Editor Subsystem Parity Checklist



\## 1. Infinite Canvas \& Viewport

\- \[ ] Cursor-centered zoom (Ctrl/Cmd + Wheel) with zoom percentage indicator

\- \[ ] Spacebar + drag panning and middle-mouse panning

\- \[ ] Selection bounding box with 8 resize handles and rotation handle

\- \[ ] Snapping guides (center, edge, and sibling alignment)

\- \[ ] Keyboard shortcut isolation (Backspace deletes layer only when inputs are blurred)



\## 2. Timeline \& Keyframe Engine

\- \[ ] Playhead scrubbing at 60fps without React root re-render lag

\- \[ ] Frame-accurate timecode readout and FPS selector

\- \[ ] Track trimming, splitting, and layer duration bars

\- \[ ] Keyframe diamond insertion, multi-select marquee, and drag-retiming

\- \[ ] Easing curve editor (cubic-bezier handles and spring physics parameters)



\## 3. Layer Tree \& Property Inspector

\- \[ ] Hierarchical layer tree with visibility, lock, and parent-child nesting

\- \[ ] Scrubbable numeric inputs (drag label left/right to adjust X, Y, Scale, Opacity)

\- \[ ] Color picker with opacity channel and design token swatches



\## 4. Playback \& Export Pipeline

\- \[ ] Deterministic frame evaluation `evaluate(state, timeMs)`

\- \[ ] Play/Pause (Space), step 1 frame (Left/Right arrows), jump to start/end (Home/End)

\- \[ ] Client-side or worker-based video export (WebCodecs / MP4 / WebM)

