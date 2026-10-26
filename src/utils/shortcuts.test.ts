// src/utils/shortcuts.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { isMac, getModifierKey, formatShortcut, isEditableElement } from './shortcuts';

describe('Shortcuts Utility (Detail 4)', () => {
  const originalNavigator = globalThis.navigator;

  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      configurable: true,
      writable: true,
    });
  });

  it('detects macOS environment correctly', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { platform: 'MacIntel', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)' },
      configurable: true,
      writable: true,
    });
    expect(isMac()).toBe(true);
    expect(getModifierKey()).toBe('⌘');
    expect(formatShortcut(['Mod', 'K'])).toBe('⌘K');
    expect(formatShortcut(['Mod', 'Shift', 'Z'])).toBe('⌘⇧Z');
  });

  it('detects Windows / Linux environment correctly', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { platform: 'Win32', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      configurable: true,
      writable: true,
    });
    expect(isMac()).toBe(false);
    expect(getModifierKey()).toBe('Ctrl');
    expect(formatShortcut(['Mod', 'K'])).toBe('Ctrl+K');
    expect(formatShortcut(['Mod', 'Shift', 'Z'])).toBe('Ctrl+Shift+Z');
  });

  it('correctly identifies editable text elements to suppress global shortcuts', () => {
    const inputMock = { tagName: 'INPUT', isContentEditable: false, getAttribute: () => null };
    const textareaMock = { tagName: 'TEXTAREA', isContentEditable: false, getAttribute: () => null };
    const selectMock = { tagName: 'SELECT', isContentEditable: false, getAttribute: () => null };
    const contentEditableMock = { tagName: 'DIV', isContentEditable: true, getAttribute: () => null };
    const spinbuttonMock = { tagName: 'DIV', isContentEditable: false, getAttribute: (attr: string) => attr === 'role' ? 'spinbutton' : null };
    const textboxMock = { tagName: 'DIV', isContentEditable: false, getAttribute: (attr: string) => attr === 'role' ? 'textbox' : null };
    const normalDivMock = { tagName: 'DIV', isContentEditable: false, getAttribute: () => null };

    expect(isEditableElement(inputMock)).toBe(true);
    expect(isEditableElement(textareaMock)).toBe(true);
    expect(isEditableElement(selectMock)).toBe(true);
    expect(isEditableElement(contentEditableMock)).toBe(true);
    expect(isEditableElement(spinbuttonMock)).toBe(true);
    expect(isEditableElement(textboxMock)).toBe(true);
    expect(isEditableElement(normalDivMock)).toBe(false);
    expect(isEditableElement(null)).toBe(false);
  });
});
