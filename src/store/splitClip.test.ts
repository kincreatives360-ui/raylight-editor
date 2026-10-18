// src/store/splitClip.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore } from './useProjectStore';

describe('Split Clip & Split Shot Store Methods', () => {
  beforeEach(() => {
    useProjectStore.getState().resetProject();
  });

  it('splits a shot at valid playhead time', () => {
    const store = useProjectStore.getState();
    const initialShot = store.project.shots[0];
    const initialDuration = initialShot.durationMs; // e.g., 4000ms

    // Split at 2000ms (within safe boundaries > 300ms)
    const splitShot = store.splitShotAtPlayhead(initialShot.id, 2000);
    expect(splitShot).not.toBeNull();

    const updatedShots = useProjectStore.getState().project.shots;
    expect(updatedShots.length).toBe(store.project.shots.length + 1);
    expect(updatedShots[0].durationMs).toBe(2000);
    expect(updatedShots[1].durationMs).toBe(initialDuration - 2000);
  });

  it('rejects split too close to shot boundaries', () => {
    const store = useProjectStore.getState();
    const initialShot = store.project.shots[0];

    // Too close to start (< 300ms)
    const splitTooEarly = store.splitShotAtPlayhead(initialShot.id, 100);
    expect(splitTooEarly).toBeNull();

    // Too close to end
    const splitTooLate = store.splitShotAtPlayhead(initialShot.id, initialShot.durationMs - 50);
    expect(splitTooLate).toBeNull();
  });

  it('splits audio clip at playhead time', () => {
    const store = useProjectStore.getState();
    // Add an audio clip
    store.updateProject((proj) => ({
      ...proj,
      audio: {
        muted: false,
        masterVolume: 1,
        clips: [
          {
            id: 'test-clip-1',
            name: 'Whoosh SFX',
            dataUrl: 'https://example.com/sound.mp3',
            startMs: 500,
            durationMs: 3000,
            offsetMs: 0,
            volume: 1,
            muted: false,
          },
        ],
      },
    }));

    const splitAudio = store.splitAudioClipAtPlayhead('test-clip-1', 1500);
    expect(splitAudio).not.toBeNull();

    const clips = useProjectStore.getState().project.audio?.clips || [];
    expect(clips.length).toBe(2);
    expect(clips[0].durationMs).toBe(1000);
    expect(clips[1].durationMs).toBe(2000);
    expect(clips[1].startMs).toBe(1500);
  });

  it('synchronizes and shifts timeline blocks when splitting shot', () => {
    const store = useProjectStore.getState();
    const shotId = store.project.shots[0].id;

    // Add layer with an animation block
    const layer = store.addLayerToShot(shotId, 'text');
    store.updateShot(shotId, (s) => ({
      ...s,
      durationMs: 4000,
      cameraBlocks: [
        {
          id: 'cam-1',
          mode: 'zoom',
          fromFramingId: 'default',
          toFramingId: 'default',
          startMs: 500,
          durationMs: 1000,
          easing: { kind: 'preset', name: 'ease' },
          from: { anchorX: 0, anchorY: 0, zoom: 1, roll: 0, orbit: 0, tilt: 0 },
          to: { anchorX: 0, anchorY: 0, zoom: 1.5, roll: 0, orbit: 0, tilt: 0 },
        },
        {
          id: 'cam-2',
          mode: 'dolly',
          fromFramingId: 'default',
          toFramingId: 'default',
          startMs: 2500,
          durationMs: 1000,
          easing: { kind: 'preset', name: 'ease' },
          from: { anchorX: 0, anchorY: 0, zoom: 1.5, roll: 0, orbit: 0, tilt: 0 },
          to: { anchorX: 0, anchorY: 0, zoom: 1.5, roll: 0, orbit: 45, tilt: 0 },
        },
      ],
      layers: s.layers.map((l) =>
        l.id === layer.id
          ? {
              ...l,
              blocks: [
                {
                  id: 'blk-1',
                  label: 'Fade',
                  property: 'opacity' as const,
                  startMs: 200,
                  durationMs: 800,
                  amount: 1,
                  easing: { kind: 'preset' as const, name: 'linear' as const },
                },
                {
                  id: 'blk-2',
                  label: 'Move',
                  property: 'position' as const,
                  startMs: 2400,
                  durationMs: 1200,
                  amount: { x: 0.1, y: 0.1, z: 0 },
                  easing: { kind: 'preset' as const, name: 'ease' as const },
                },
              ],
            }
          : l
      ),
    }));

    const splitShot = store.splitShotAtPlayhead(shotId, 2000);
    expect(splitShot).not.toBeNull();

    const updatedShots = useProjectStore.getState().project.shots;
    const firstShot = updatedShots[0];
    const secondShot = updatedShots[1];

    // First shot should keep only blocks before 2000ms
    expect(firstShot.cameraBlocks?.length).toBe(1);
    expect(firstShot.cameraBlocks?.[0].id).toBe('cam-1');
    const firstLayer = firstShot.layers.find((l) => l.name === layer.name);
    expect(firstLayer?.blocks.length).toBe(1);
    expect(firstLayer?.blocks[0].id).toBe('blk-1');

    // Second shot should shift blocks by -2000ms
    expect(secondShot.cameraBlocks?.length).toBe(1);
    expect(secondShot.cameraBlocks?.[0].id).toBe('cam-2');
    expect(secondShot.cameraBlocks?.[0].startMs).toBe(500); // 2500 - 2000

    const secondLayer = secondShot.layers.find((l) => l.name === layer.name);
    expect(secondLayer?.blocks.length).toBe(1);
    expect(secondLayer?.blocks[0].id).toBe('blk-2');
    expect(secondLayer?.blocks[0].startMs).toBe(400); // 2400 - 2000
  });

  it('cleans up dangling maskLayerId and orphan groups when deleting layers', () => {
    const store = useProjectStore.getState();
    const shotId = store.project.shots[0].id;

    const layer1 = store.addLayerToShot(shotId, 'shape');
    const layer2 = store.addLayerToShot(shotId, 'image');

    // Mask layer2 using layer1
    store.updateLayer(shotId, layer2.id, (l) => ({ ...l, maskLayerId: layer1.id }));

    // Group layer1
    const group = store.createGroupFromLayers(shotId, [layer1.id], 'Group 1');
    expect(group).not.toBeNull();

    // Delete layer1
    store.deleteLayerFromShot(shotId, layer1.id);

    const updatedShot = useProjectStore.getState().project.shots.find((s) => s.id === shotId)!;
    const remainingLayer2 = updatedShot.layers.find((l) => l.id === layer2.id)!;

    // maskLayerId should be cleared
    expect(remainingLayer2.maskLayerId).toBeUndefined();

    // Group 1 was only holding layer1, so orphan group should be pruned
    expect(updatedShot.groups.some((g) => g.id === group?.id)).toBe(false);
  });
});
