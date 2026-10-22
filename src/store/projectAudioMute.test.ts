import { beforeEach, describe, expect, it } from 'vitest';
import { useProjectStore } from './useProjectStore';

describe('project audio mute', () => {
  beforeEach(() => useProjectStore.getState().resetProject());

  it('toggles project mute through one undoable project update', () => {
    expect(useProjectStore.getState().project.audio?.muted).toBe(false);

    useProjectStore.getState().toggleProjectAudioMuted();
    expect(useProjectStore.getState().project.audio?.muted).toBe(true);

    useProjectStore.getState().undo();
    expect(useProjectStore.getState().project.audio?.muted).toBe(false);
  });
});
