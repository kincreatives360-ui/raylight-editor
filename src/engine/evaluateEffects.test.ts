// src/engine/evaluateEffects.test.ts
import { describe, it, expect } from 'vitest';
import { calculateLayerDofBlurPx, evaluateEffectsAtTime } from './evaluateEffects';
import { createDefaultShot } from '../model/defaults';
import type { Shot, Effects } from '../model/types';

describe('evaluateEffects', () => {
  describe('calculateLayerDofBlurPx', () => {
    const baseDof: Effects['depthOfField'] = {
      enabled: true,
      target: { x: 0, y: 0, z: 0 },
      focusRange: 2.0,
      aperture: 2.8,
      bokehScale: 1.0,
      bokehShape: 'spherical',
      focalLength: 50,
    };

    it('1. Returns 0 blur when depthOfField is disabled', () => {
      const disabledDof = { ...baseDof, enabled: false };
      expect(calculateLayerDofBlurPx(5.0, disabledDof)).toBe(0);
    });

    it('2. Returns 0 blur when layer is inside the focus range zone', () => {
      // Focus range is 2.0 -> half zone is 1.0. Layer at z=0.5 is within distance <= 1.0
      expect(calculateLayerDofBlurPx(0.5, baseDof)).toBe(0);
      expect(calculateLayerDofBlurPx(-0.8, baseDof)).toBe(0);
      expect(calculateLayerDofBlurPx(1.0, baseDof)).toBe(0);
    });

    it('3. Computes progressive circle-of-confusion blur outside focus zone capped at 40px', () => {
      // Out of focus: z = 3.0 -> distance = 3.0, outOfFocusDist = 3.0 - 1.0 = 2.0
      // rawBlur = 2.0 * 2.8 * 1.0 * (50/50) * 1.6 = 8.96
      const blur = calculateLayerDofBlurPx(3.0, baseDof);
      expect(blur).toBeCloseTo(8.96, 1);

      // Extreme out of focus should be capped at 40
      const extremeBlur = calculateLayerDofBlurPx(100.0, baseDof);
      expect(extremeBlur).toBe(40);
    });
  });

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

    it('5. Animates rack focus target Z via focusBlocks', () => {
      const shot: Shot = {
        ...createDefaultShot(),
        effects: {
          ...createDefaultShot().effects,
          depthOfField: {
            enabled: true,
            target: { x: 0, y: 0, z: 0 },
            focusRange: 1.0,
            aperture: 2.8,
            bokehScale: 1.0,
            bokehShape: 'spherical',
            focalLength: 50,
          },
        },
        focusBlocks: [
          {
            id: 'fb-1',
            label: 'Rack Focus Foreground to Background',
            startMs: 1000,
            durationMs: 2000,
            fromZ: -10,
            toZ: 30,
            easing: { kind: 'preset', name: 'linear' },
          },
        ],
      };

      // Before focus block
      const before = evaluateEffectsAtTime(shot, 0, 500);
      expect(before.state.depthOfField.target.z).toBe(0);

      // Midpoint: t=2000 (1000ms into 2000ms duration) -> z = -10 + 40 * 0.5 = 10
      const mid = evaluateEffectsAtTime(shot, 60, 2000);
      expect(mid.state.depthOfField.target.z).toBeCloseTo(10, 1);

      // After focus block
      const after = evaluateEffectsAtTime(shot, 120, 3500);
      expect(after.state.depthOfField.target.z).toBe(30);
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
  });
});
