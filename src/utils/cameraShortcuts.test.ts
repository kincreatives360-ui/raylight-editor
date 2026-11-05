import { describe, expect, it } from 'vitest';
import { CAMERA_TOOL_SHORTCUT, SCISSORS_SHORTCUT, matchesCameraToolShortcut, matchesScissorsShortcut } from './cameraShortcuts';

describe('camera workflow shortcut contract', () => {
  it('uses the observed Orbit and Scissors chords', () => {
    expect(CAMERA_TOOL_SHORTCUT).toEqual({ keys: ['Shift', 'F'], label: '⇧F' });
    expect(SCISSORS_SHORTCUT).toEqual({ keys: ['Shift', 'C'], label: '⇧C' });
  });

  it('matches only unmodified Shift+F and Shift+C', () => {
    expect(matchesCameraToolShortcut({ key: 'F', shiftKey: true, metaKey: false, ctrlKey: false, altKey: false })).toBe(true);
    expect(matchesCameraToolShortcut({ key: 'f', shiftKey: false, metaKey: false, ctrlKey: false, altKey: false })).toBe(false);
    expect(matchesScissorsShortcut({ key: 'C', shiftKey: true, metaKey: false, ctrlKey: false, altKey: false })).toBe(true);
    expect(matchesScissorsShortcut({ key: 'c', shiftKey: true, metaKey: true, ctrlKey: false, altKey: false })).toBe(false);
  });
});
