// src/utils/shortcuts.ts

/**
 * Detects whether the user is on macOS / iOS
 */
export function isMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  const platform = (navigator as unknown as { userAgentData?: { platform?: string } }).userAgentData?.platform || navigator.platform || navigator.userAgent || '';
  return /Mac|iPhone|iPad|iPod/i.test(platform);
}

/**
 * Returns primary modifier key symbol: '⌘' on macOS, 'Ctrl' elsewhere
 */
export function getModifierKey(): string {
  return isMac() ? '⌘' : 'Ctrl';
}

/**
 * Formats key combination into human-readable, OS-aware string.
 * Example:
 *   formatShortcut(['Mod', 'K']) -> '⌘K' (Mac) or 'Ctrl+K' (Win)
 *   formatShortcut(['Mod', 'Shift', 'Z']) -> '⌘⇧Z' (Mac) or 'Ctrl+Shift+Z' (Win)
 */
export function formatShortcut(keys: string[]): string {
  const mac = isMac();
  return keys
    .map((k) => {
      const lower = k.toLowerCase();
      if (lower === 'mod' || lower === 'cmd' || lower === 'ctrl' || lower === '⌘/ctrl') {
        return mac ? '⌘' : 'Ctrl';
      }
      if (lower === 'shift') {
        return mac ? '⇧' : 'Shift';
      }
      if (lower === 'alt' || lower === 'opt' || lower === 'option') {
        return mac ? '⌥' : 'Alt';
      }
      return k;
    })
    .join(mac ? '' : '+');
}

/**
 * Checks whether an element is an editable text field where global shortcuts should not fire
 */
export function isEditableElement(el: { tagName?: string; isContentEditable?: boolean; getAttribute?: (attr: string) => string | null } | null): boolean {
  if (!el) return false;
  const tag = el.tagName?.toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    return true;
  }
  if (el.isContentEditable) return true;
  const role = typeof el.getAttribute === 'function' ? el.getAttribute('role') : null;
  return role === 'textbox' || role === 'spinbutton';
}

/**
 * Checks whether an element is an interactive control (button, link, tab, menuitem, summary, slider, etc.)
 * where Space/Enter keys should trigger the native element action rather than studio global shortcuts.
 */
export function isInteractiveElement(el: { tagName?: string; isContentEditable?: boolean; getAttribute?: (attr: string) => string | null } | null): boolean {
  if (!el) return false;
  if (isEditableElement(el)) return true;
  const tag = el.tagName?.toUpperCase();
  if (tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY' || tag === 'DETAILS') {
    return true;
  }
  const role = typeof el.getAttribute === 'function' ? el.getAttribute('role') : null;
  return (
    role === 'button' ||
    role === 'tab' ||
    role === 'menuitem' ||
    role === 'menuitemcheckbox' ||
    role === 'menuitemradio' ||
    role === 'checkbox' ||
    role === 'radio' ||
    role === 'switch' ||
    role === 'slider' ||
    role === 'option' ||
    role === 'combobox'
  );
}
