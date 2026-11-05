import { describe, it, expect } from 'vitest';
import { evaluateLightBlocks, cloneLightRig } from './evaluateLight';
import type { LightRig, LightAnimationBlock } from '../model/types';

describe('evaluateLightBlocks', () => {
  const baseRig: LightRig = {
    position: { x: 0, y: 0, z: 1 },
    intensity: 1.0,
    temperature: 6000,
    ambience: 0.4,
    sources: [
      {
        id: 'spot-1',
        name: 'Spot',
        type: 'spot',
        enabled: true,
        position: { x: 1, y: 1, z: 2 },
        intensity: 0.8,
        color: '#ffffff',
        angle: 0.5,
        penumbra: 0.2,
      },
    ],
  };

  it('no jump at startMs when holdBefore is true (default)', () => {
    const block: LightAnimationBlock = {
      id: 'blk-1',
      label: 'Key Move',
      targetLightId: 'key',
      startMs: 1000,
      durationMs: 1000,
      fromX: 0.5,
      fromY: 0.5,
      toX: 1.0,
      toY: 1.0,
      fromIntensity: 0.5,
      toIntensity: 1.5,
      holdBefore: true,
      easing: { kind: 'preset', name: 'linear' },
    };

    // Before startMs (t=500), should hold fromValues
    const before = evaluateLightBlocks(baseRig, [block], 500);
    expect(before.position.x).toBe(0.5);
    expect(before.keyIntensity).toBe(0.5);

    // Right at startMs (t=1000), should be exactly fromValues (no jump)
    const atStart = evaluateLightBlocks(baseRig, [block], 1000);
    expect(atStart.position.x).toBe(0.5);
    expect(atStart.keyIntensity).toBe(0.5);

    // If holdBefore is explicitly false, it should retain baseRig before startMs
    const blockNoHold: LightAnimationBlock = { ...block, holdBefore: false };
    const beforeNoHold = evaluateLightBlocks(baseRig, [blockNoHold], 500);
    expect(beforeNoHold.position.x).toBe(baseRig.position.x);
  });

  it('two overlapping blocks on one target resolve to the later start', () => {
    const block1: LightAnimationBlock = {
      id: 'blk-1',
      label: 'Early Block',
      targetLightId: 'key',
      startMs: 0,
      durationMs: 2000,
      fromX: 0,
      fromY: 0,
      toX: 2.0,
      toY: 2.0,
      fromIntensity: 1.0,
      toIntensity: 1.0,
      easing: { kind: 'preset', name: 'linear' },
    };

    const block2: LightAnimationBlock = {
      id: 'blk-2',
      label: 'Later Overlapping Block',
      targetLightId: 'key',
      startMs: 1000,
      durationMs: 1000,
      fromX: -1.0,
      fromY: -1.0,
      toX: -2.0,
      toY: -2.0,
      fromIntensity: 2.0,
      toIntensity: 2.0,
      easing: { kind: 'preset', name: 'linear' },
    };

    // At t=1500, block2 has startMs=1000 <= 1500, which is later than block1 startMs=0.
    // Progress of block2 is (1500 - 1000) / 1000 = 0.5.
    // X should lerp(-1.0, -2.0, 0.5) = -1.5.
    const res = evaluateLightBlocks(baseRig, [block1, block2], 1500);
    expect(res.position.x).toBe(-1.5);
    expect(res.keyIntensity).toBe(2.0);
  });

  it('position block B after intensity block A keeps A final intensity', () => {
    const blockA = {
      id: 'blk-a',
      label: 'Intensity Fade',
      targetLightId: 'key',
      startMs: 0,
      durationMs: 500,
      fromIntensity: 0.2,
      toIntensity: 1.8,
      easing: { kind: 'preset', name: 'linear' },
    } as unknown as LightAnimationBlock;

    const blockB = {
      id: 'blk-b',
      label: 'Position Move Later',
      targetLightId: 'key',
      startMs: 1000,
      durationMs: 500,
      fromX: 0.3,
      fromY: 0.4,
      toX: 0.9,
      toY: 0.8,
      easing: { kind: 'preset', name: 'linear' },
    } as unknown as LightAnimationBlock;

    // At t=1250, Block A has ended (intensity=1.8 holds).
    // Block B is halfway through position move.
    const res = evaluateLightBlocks(baseRig, [blockA, blockB], 1250);
    expect(res.keyIntensity).toBe(1.8);
    expect(res.position.x).toBe(0.6); // lerp(0.3, 0.9, 0.5)
  });

  it('Z interpolates with only toZ set', () => {
    const block: LightAnimationBlock = {
      id: 'blk-z',
      label: 'Z push',
      targetLightId: 'key',
      startMs: 0,
      durationMs: 1000,
      fromX: 0,
      fromY: 0,
      toX: 0,
      toY: 0,
      toZ: 5.0, // fromZ omitted; should fall back to baseRig.position.z = 1
      fromIntensity: 1,
      toIntensity: 1,
      easing: { kind: 'preset', name: 'linear' },
    };

    const halfway = evaluateLightBlocks(baseRig, [block], 500);
    // lerp(1.0, 5.0, 0.5) = 3.0
    expect(halfway.position.z).toBe(3.0);
  });

  it('a spot block changes angle and penumbra', () => {
    const block: LightAnimationBlock = {
      id: 'blk-spot',
      label: 'Spot Narrow',
      targetLightId: 'spot-1',
      startMs: 0,
      durationMs: 1000,
      fromX: 1,
      fromY: 1,
      toX: 1,
      toY: 1,
      fromIntensity: 0.8,
      toIntensity: 0.8,
      fromAngle: 0.5,
      toAngle: 0.2,
      fromPenumbra: 0.2,
      toPenumbra: 0.8,
      easing: { kind: 'preset', name: 'linear' },
    };

    const halfway = evaluateLightBlocks(baseRig, [block], 500);
    const spot = halfway.sources?.find((s) => s.id === 'spot-1');
    expect(spot).toBeDefined();
    // angle: lerp(0.5, 0.2, 0.5) = 0.35
    expect(spot?.angle).toBeCloseTo(0.35);
    // penumbra: lerp(0.2, 0.8, 0.5) = 0.5
    expect(spot?.penumbra).toBeCloseTo(0.5);
  });

  it('an explicit property animates only its own channel', () => {
    const block: LightAnimationBlock = {
      id: 'position-only', label: 'Position Only', targetLightId: 'key', property: 'position',
      startMs: 0, durationMs: 1000, fromX: 1, fromY: 2, fromZ: 3,
      toX: 5, toY: 6, toZ: 7, fromIntensity: 0.1, toIntensity: 9,
      easing: { kind: 'preset', name: 'linear' },
    };
    const halfway = evaluateLightBlocks(baseRig, [block], 500);
    expect(halfway.position).toEqual({ x: 3, y: 4, z: 5 });
    expect(halfway.keyIntensity).toBe(baseRig.intensity);
  });
  it('Room Ambience animation changes the room while preserving the key and other light channels', () => {
    const block: LightAnimationBlock = {
      id: 'room-ambience', label: 'Room fade', targetLightId: 'room', property: 'ambience',
      startMs: 0, durationMs: 1000, fromX: 0, fromY: 0, toX: 0, toY: 0,
      fromIntensity: 0.2, toIntensity: 0.8, easing: { kind: 'preset', name: 'linear' },
    };
    const halfway = evaluateLightBlocks(baseRig, [block], 500);
    expect(halfway.ambience).toBeCloseTo(0.5);
    expect(halfway.position).toEqual(baseRig.position);
    expect(halfway.keyIntensity).toBe(baseRig.keyIntensity);
  });
  it('cloneLightRig produces a deep copy without mutation', () => {
    const clone = cloneLightRig(baseRig);
    expect(clone).toEqual(baseRig);
    expect(clone).not.toBe(baseRig);
    expect(clone.position).not.toBe(baseRig.position);
    expect(clone.sources).not.toBe(baseRig.sources);
    expect(clone.sources?.[0].position).not.toBe(baseRig.sources?.[0].position);
  });
});


