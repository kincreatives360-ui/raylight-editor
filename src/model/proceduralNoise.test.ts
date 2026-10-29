import { describe, expect, it } from 'vitest';
import type { WarpEffect } from './types';
import { proceduralNoise, sampleFractalNoise, turbulentWarpPoint } from './proceduralNoise';

const warp: WarpEffect = { enabled: true, mode: 'turbulent', amount: 30, size: 100, complexity: 3, evolution: 23, seed: 42, speed: 60 };

describe('procedural turbulence', () => {
  it('is deterministic, bounded and seed dependent', () => {
    for (let i = -20; i < 20; i++) {
      const value = proceduralNoise(i * .13, i * .71, i * .31, 42);
      expect(value).toBe(proceduralNoise(i * .13, i * .71, i * .31, 42));
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
    expect(proceduralNoise(.2, .3, .4, 1)).not.toBe(proceduralNoise(.2, .3, .4, 2));
  });
  it('evolves continuously across lattice boundaries', () => {
    expect(Math.abs(proceduralNoise(.2, .3, 1 - 1e-5, 42) - proceduralNoise(.2, .3, 1 + 1e-5, 42))).toBeLessThan(1e-6);
    expect(Math.abs(sampleFractalNoise(.2, .3, .4, 42, 3 - 1e-6) - sampleFractalNoise(.2, .3, .4, 42, 3 + 1e-6))).toBeLessThan(1e-6);
  });
  it('keeps zero amount and disabled effects neutral', () => {
    expect(turbulentWarpPoint(17, 32, { ...warp, amount: 0 })).toEqual({ x: 17, y: 32, z: 0 });
    expect(turbulentWarpPoint(17, 32, { ...warp, enabled: false })).toEqual({ x: 17, y: 32, z: 0 });
  });
  it('responds to authored controls and signed amount', () => {
    const base = turbulentWarpPoint(17, 32, warp);
    for (const change of [{ centerX: 50 }, { centerY: 50 }, { size: 200 }, { complexity: 4.5 }, { evolution: 100 }, { seed: 8 }]) {
      expect(turbulentWarpPoint(17, 32, { ...warp, ...change })).not.toEqual(base);
    }
    const inverse = turbulentWarpPoint(17, 32, { ...warp, amount: -30 });
    expect(inverse.x + base.x).toBeCloseTo(34);
    expect(inverse.y + base.y).toBeCloseTo(64);
  });
  it('loops seamlessly with matching derivatives and evolving interior frames', () => {
    const loop = { ...warp, loop: true, loopDuration: 4 };
    const at = (time: number) => turbulentWarpPoint(17, 32, loop, time);
    expect(at(0)).toEqual(at(4));
    expect(at(1)).toEqual(at(5));
    expect(at(1)).not.toEqual(at(0));
    const h = 1e-6;
    for (const axis of ['x', 'y'] as const) {
      const before = (at(0)[axis] - at(-h)[axis]) / h;
      const after = (at(h)[axis] - at(0)[axis]) / h;
      expect(Math.abs(before - after)).toBeLessThan(.005);
    }
  });
  it('pins selected authored bounds exactly and leaves the interior moving', () => {
    const bounds = { width: 200, height: 100 };
    for (const [pinning, x, y] of [['left', -100, 12], ['right', 100, 12], ['top', 12, -50], ['bottom', 12, 50], ['horizontal', 12, -50], ['vertical', -100, 12], ['all', 100, 12]] as const) {
      expect(turbulentWarpPoint(x, y, { ...warp, pinning }, 1, bounds)).toEqual({ x, y, z: 0 });
    }
    expect(turbulentWarpPoint(0, 0, { ...warp, pinning: 'all' }, 1, bounds)).not.toEqual({ x: 0, y: 0, z: 0 });
  });
  it('pins a translated layer using its own bounds in the export compositor', () => {
    const bounds = { width: 200, height: 100, centerX: 300, centerY: -80 };
    expect(turbulentWarpPoint(200, -80, { ...warp, pinning: 'left' }, 1, bounds)).toEqual({ x: 200, y: -80, z: 0 });
    expect(turbulentWarpPoint(300, -80, { ...warp, pinning: 'all' }, 1, bounds)).not.toEqual({ x: 300, y: -80, z: 0 });
  });
});
