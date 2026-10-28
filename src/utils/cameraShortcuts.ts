export const CAMERA_TOOL_SHORTCUT = { keys: ['Shift', 'F'], label: '⇧F' } as const;
export const SCISSORS_SHORTCUT = { keys: ['Shift', 'C'], label: '⇧C' } as const;

export function matchesCameraToolShortcut(event: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'metaKey' | 'ctrlKey' | 'altKey'>): boolean {
  return event.key.toLowerCase() === 'f' && event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey;
}

export function matchesScissorsShortcut(event: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'metaKey' | 'ctrlKey' | 'altKey'>): boolean {
  return event.key.toLowerCase() === 'c' && event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey;
}
