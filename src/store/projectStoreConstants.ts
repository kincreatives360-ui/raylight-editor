import type { Project } from '../model/types';

export const MAX_HISTORY_STEPS = 50;

export function appendHistoryState(past: Project[], snapshot: Project): Project[] {
  return [...past.slice(-(MAX_HISTORY_STEPS - 1)), snapshot];
}
