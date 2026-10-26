import { beforeEach, describe, expect, it } from 'vitest';
import { useProjectStore } from './useProjectStore';

describe('shot split ownership and intervals', () => {
  beforeEach(() => useProjectStore.getState().resetProject());

  it('remaps mask and group references for the second shot', () => {
    const store = useProjectStore.getState();
    const shot = store.project.shots[0];
    const mask = store.addLayerToShot(shot.id, 'shape');
    const subject = store.addLayerToShot(shot.id, 'shape');
    store.updateLayer(shot.id, mask.id, layer => ({ ...layer, name: 'Unique mask' }));
    store.updateLayer(shot.id, subject.id, layer => ({ ...layer, name: 'Unique subject', maskLayerId: mask.id }));
    const group = store.createGroupFromLayers(shot.id, [mask.id, subject.id], 'Grouped');
    store.updateShot(shot.id, s => ({
      ...s,
      durationMs: 4000,
      layers: s.layers.map(layer => ({ ...layer, inMs: 0, outMs: 4000 })),
    }));
    const next = store.splitShotAtPlayhead(shot.id, 2000);
    expect(next).not.toBeNull();
    const shots = useProjectStore.getState().project.shots;
    const right = shots[1];
    const rightMask = right.layers.find(l => l.name === 'Unique mask');
    const rightSubject = right.layers.find(l => l.name === 'Unique subject');
    expect(rightMask).toBeDefined();
    expect(rightSubject?.maskLayerId).toBe(rightMask?.id);
    expect(rightMask?.id).not.toBe(mask.id);
    expect(right.layers.every(l => !l.groupId || right.groups.some(g => g.id === l.groupId))).toBe(true);
    expect(right.groups.some(g => g.id === group?.id)).toBe(false);
  });

  it('does not generate a ghost layer for content ending before the cut', () => {
    const store = useProjectStore.getState();
    const shot = store.project.shots[0];
    const early = store.addLayerToShot(shot.id, 'shape');
    store.updateShot(shot.id, s => ({
      ...s,
      durationMs: 4000,
      layers: s.layers.map(l => l.id === early.id ? { ...l, inMs: 0, outMs: 800 } : l),
    }));
    const right = store.splitShotAtPlayhead(shot.id, 2000);
    expect(right?.layers.some(l => l.name === early.name)).toBe(false);
  });
});
