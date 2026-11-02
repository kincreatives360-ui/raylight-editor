// src/engine/evaluateEffects.test.ts
import { describe, it, expect } from 'vitest';
import { evaluateEffectsAtTime } from './evaluateEffects';
import { createDefaultShot } from '../model/defaults';
import type { Shot } from '../model/types';

describe('evaluateEffects', () => {
  describe('evaluateEffectsAtTime', () => {
    it('4. Produces strictly deterministic pseudo-random seeds from frame numbers', () => {
      const shot = createDefaultShot();
      const evalF10_a = evaluateEffectsAtTime(shot, 10);
      const evalF10_b = evaluateEffectsAtTime(shot, 10);
      const evalF25 = evaluateEffectsAtTime(shot, 25);

      expect(evalF10_a.deterministicSeed).toBe(evalF10_b.deterministicSeed);
      expect(evalF10_a.deterministicSeed).not.toBe(evalF25.deterministicSeed);
      expect(evalF10_a.deterministicSeed).toBeGreaterThanOrEqual(0);
      expect(evalF10_a.deterministicSeed).toBeLessThanOrEqual(1);
    });



    it('6. Filters and orders active effects passes', () => {
      const shot = createDefaultShot();
      shot.effects.bloom.enabled = true;
      shot.effects.vignette.enabled = true;
      shot.effects.glitch.enabled = false;

      const evaluated = evaluateEffectsAtTime(shot, 1);
      const activeKeys = evaluated.orderedEnabledPasses.map((p) => p.key);

      expect(activeKeys).toEqual(['bloom', 'vignette']);
      expect(activeKeys).toContain('bloom');
      expect(activeKeys).toContain('vignette');
      expect(activeKeys).not.toContain('glitch');
    });

    it('7. Uses the applied effects rack as the authoritative pass order', () => {
      const shot = createDefaultShot();
      shot.effects.bloom.enabled = true;
      shot.effects.vignette.enabled = true;
      shot.effects.glitch.enabled = true;
      shot.appliedEffects = ['glitch', 'bloom'];

      expect(evaluateEffectsAtTime(shot, 1).orderedEnabledPasses.map((pass) => pass.key))
        .toEqual(['glitch', 'bloom']);
    });
  });
});
