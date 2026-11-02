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

    it('evaluates an 800 ms ease-in-out rack-focus segment at its start, midpoint, and end', () => {
      const shot = createDefaultShot();
      shot.effects.depthOfField.enabled = true;
      shot.focusBlocks = [{
        id: 'existing-focus-segment',
        startMs: 500,
        durationMs: 2000,
        fromZ: 0.1,
        toZ: 0.3,
        easing: { kind: 'preset', name: 'linear' },
      }, {
        id: 'focus-segment',
        startMs: 1500,
        durationMs: 800,
        fromZ: 0.2,
        toZ: 0.8,
        easing: { kind: 'preset', name: 'ease-in-out' },
      }];

      expect(evaluateEffectsAtTime(shot, 45, 1500).state.depthOfField.target.z).toBeCloseTo(0.2);
      expect(evaluateEffectsAtTime(shot, 57, 1900).state.depthOfField.target.z).toBeCloseTo(0.5);
      expect(evaluateEffectsAtTime(shot, 69, 2300).state.depthOfField.target.z).toBeCloseTo(0.8);
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
