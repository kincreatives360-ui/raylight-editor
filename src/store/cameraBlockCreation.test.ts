import { beforeEach, describe, expect, it } from 'vitest';
import { useProjectStore } from './useProjectStore';

describe('camera block creation', () => {
  beforeEach(() => useProjectStore.getState().resetProject());

  it('creates one default camera move with one undo step', () => {
    const shot = useProjectStore.getState().project.shots[0];
    const block = useProjectStore.getState().addCameraBlockToShot(shot.id);

    expect(block?.id).toMatch(/^cam-blk-/);
    expect(useProjectStore.getState().project.shots[0].cameraBlocks).toHaveLength(1);
    expect(useProjectStore.getState().project.shots[0].cameraBlocks[0]).toMatchObject({
      id: block?.id,
      startMs: 0,
      durationMs: shot.durationMs,
      fromFramingId: shot.framings[0].id,
      toFramingId: shot.framings[1].id,
      mode: 'dolly',
      easing: { kind: 'preset', name: 'linear' },
    });

    useProjectStore.getState().undo();
    expect(useProjectStore.getState().project.shots[0].cameraBlocks).toHaveLength(0);
  });

  it('returns null and leaves history untouched for a missing shot', () => {
    const historyBefore = useProjectStore.getState().past.length;

    expect(useProjectStore.getState().addCameraBlockToShot('missing-shot')).toBeNull();
    expect(useProjectStore.getState().past).toHaveLength(historyBefore);
  });
});
