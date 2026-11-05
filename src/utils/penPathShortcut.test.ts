import { describe, expect, it } from 'vitest';
import { matchesPenPathShortcut, PEN_PATH_SHORTCUT } from './penPathShortcut';

describe('Pen path shortcut', () => {
  it('uses P in the command/help surfaces and matches the unmodified key', () => {
    expect(PEN_PATH_SHORTCUT).toEqual({ keys: ['P'], label: 'P' });
    expect(matchesPenPathShortcut({ key: 'P', shiftKey: false, metaKey: false, ctrlKey: false, altKey: false })).toBe(true);
    expect(matchesPenPathShortcut({ key: 'p', shiftKey: true, metaKey: false, ctrlKey: false, altKey: false })).toBe(false);
  });
});
