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
});
