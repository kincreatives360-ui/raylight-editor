# Motion recipes and acceptance criteria

## Core timing recipes

Use these as practical defaults. Tune against the running interface; shorter, frequently repeated interactions should settle sooner than larger surface transitions.

| Surface | Properties | Timing and anchoring |
|---|---|---|
| Control feedback | Color, background, border | 150 ms cubic-bezier(0.4,0,0.2,1); no input delay |
| Modal overlay | Opacity | 150 ms; independent from dialog surface |
| Dialog surface | Opacity 0 to 1; scale 0.95 to 1 | 200 ms ease-out; preserve positioning throughout; reverse on exit |

## Component recipes

| Interaction | Suggested behavior |
|---|---|
| Anchored menu/popover | Opacity 0 to 1, scale 0.98 to 1, origin at trigger edge, 150 ms ease-out; exit 100 ms |
| Tooltip | Brief opacity transition; respect existing delay policy; no movement on every pointer shift |
| Inspector disclosure | 160-200 ms expansion only when it helps track hierarchy; prevent clipped controls and measure size once |
| Tab selection | 150 ms color feedback; animate indicator geometry only when stable identity exists |
| Button press | Color feedback by default; optional subtle scale only for isolated buttons, not dense text fields |
| Drawer | 200 ms small directional translation with opacity, anchored to entering edge |

## Framework-neutral tokens and CSS example

```css
:root {
  --motion-feedback: 150ms;
  --motion-dialog: 200ms;
  --motion-control-ease: cubic-bezier(.4, 0, .2, 1);
}
.control {
  transition: background-color var(--motion-feedback) var(--motion-control-ease),
              color var(--motion-feedback) var(--motion-control-ease),
              border-color var(--motion-feedback) var(--motion-control-ease);
}
/* A positioning wrapper owns left/top/translate. This child owns scale. */
.dialog-surface {
  transform-origin: center;
  transition: opacity var(--motion-dialog) ease-out,
              transform var(--motion-dialog) ease-out;
}
.dialog-surface[data-phase="enter-from"],
.dialog-surface[data-phase="exit-to"] {
  opacity: 0;
  transform: scale(.95);
}
.dialog-surface[data-phase="open"] { opacity: 1; transform: scale(1); }
@media (prefers-reduced-motion: reduce) {
  .control, .dialog-surface { transition: none; }
  .dialog-surface { transform: none !important; }
}
```

The host implementation must schedule the initial and target states on separate render frames, keep exiting elements mounted, and clean up transition listeners on interruption/unmount. Handle zero-duration reduced-motion transitions explicitly; transitionend may never fire. Use an existing accessible dialog primitive for semantics and focus management.

## Acceptance scenarios

1. Open, close, then reopen a dialog before its exit completes. It remains open, interactive, and correctly focused; no old callback removes it.
2. Press Escape during entry. The dialog closes, focus returns to its trigger, and no invisible overlay blocks the page.
3. Enable reduced motion before opening and while open. Controls remain usable with no spatial animation or waiting for a missing transition event.
4. Toggle toolbar selection rapidly. The latest selection wins without layout shifts or queued animation.
5. Open a menu near a viewport edge. It stays within bounds and scales from its actual placement anchor.
6. Compare normal-speed playback and intermediate frames. Confirm no positioning jump, double transform, clipped content, or background scroll jump.
7. Run on a small screen and under main-thread load. Check responsiveness and whether motion creates avoidable layout/paint work.

Record actual outcomes; these cases are a verification checklist, not evidence that an implementation has passed.

