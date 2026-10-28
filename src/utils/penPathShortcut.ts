export const PEN_PATH_SHORTCUT = { keys: ['P'], label: 'P' } as const;

export function matchesPenPathShortcut(event: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'metaKey' | 'ctrlKey' | 'altKey'>): boolean {
  return event.key.toLowerCase() === 'p' && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey;
}
