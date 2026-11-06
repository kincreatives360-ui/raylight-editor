// src/engine/evaluateEffects.test.ts
import { describe, it, expect } from 'vitest';
import { evaluateEffectsAtTime, evaluateDepthOfFieldAtTime } from './evaluateEffects';
import { createDefaultShot } from '../model/defaults';
import type { DepthOfField, SceneEffectAnimationBlock } from '../model/types';

describe('evaluateEffects', () => {
  describe('evaluateDepthOfFieldAtTime', () => {
    const baseDof: DepthOfField = {
      enabled: true,
      focusMode: 'target',
      target: { x: 0, y: 0, z: 0 },
      focusDistance: 2.65,
      focusRange: 0.85,
      aperture: 2.8,
      focalLength: 50,
      sensorHeightMm: 24,
      bokehScale: 1.0,
      maxBlur: 32,
      samples: 16,
      quality: 'balanced',
      highlightThreshold: 0.9,
      highlightIntensity: 1.0,
      highlightGain: 1.0,
      focusSoftness: 0.28,
      apertureBlades: 7,
      bokehRotation: 0,
      bokehShape: 'spherical',
      model: 'physical',
      sceneScale: 1.0,
    };

    it('interpolates 3D target coordinates for rack focus across timeline blocks', () => {
      const blocks: SceneEffectAnimationBlock[] = [
        {
          id: 'dof-rack-1',
          label: 'Rack Focus to Actor',
          effectKey: 'depthOfField',
          property: 'target',
          startMs: 1000,
          durationMs: 1000,
          fromValue: 0,
          toValue: 0,
          fromTarget: { x: 0, y: 0, z: 0 },
          toTarget: { x: 100, y: 50, z: -200 },
          easing: { kind: 'preset', name: 'linear' },
        },
      ];

      // Before block start: initial target
      const before = evaluateDepthOfFieldAtTime(baseDof, blocks, 500);
      expect(before.target).toEqual({ x: 0, y: 0, z: 0 });

      // Mid-point at 1500ms (50% progress): exactly halfway
      const mid = evaluateDepthOfFieldAtTime(baseDof, blocks, 1500);
      expect(mid.target.x).toBeCloseTo(50, 2);
      expect(mid.target.y).toBeCloseTo(25, 2);
      expect(mid.target.z).toBeCloseTo(-100, 2);

      // After block end: final target
      const after = evaluateDepthOfFieldAtTime(baseDof, blocks, 2500);
      expect(after.target).toEqual({ x: 100, y: 50, z: -200 });
    });

    it('interpolates aperture pulls dynamically', () => {
      const blocks: SceneEffectAnimationBlock[] = [
        {
          id: 'dof-aperture-1',
          label: 'Open Aperture',
          effectKey: 'depthOfField',
          property: 'aperture',
          startMs: 0,
          durationMs: 1000,
          fromValue: 8.0,
          toValue: 1.4,
          easing: { kind: 'preset', name: 'linear' },
        },
      ];

      const mid = evaluateDepthOfFieldAtTime(baseDof, blocks, 500);
      expect(mid.aperture).toBeCloseTo(4.7, 1);

      const end = evaluateDepthOfFieldAtTime(baseDof, blocks, 1000);
      expect(end.aperture).toBe(1.4);
    });
  });

  describe('evaluateEffectsAtTime', () => {
    it('produces strictly deterministic pseudo-random seeds from frame numbers', () => {
      const shot = createDefaultShot();
      const evalF10_a = evaluateEffectsAtTime(shot, 10);
      const evalF10_b = evaluateEffectsAtTime(shot, 10);
      const evalF25 = evaluateEffectsAtTime(shot, 25);

      expect(evalF10_a.deterministicSeed).toBe(evalF10_b.deterministicSeed);
      expect(evalF10_a.deterministicSeed).not.toBe(evalF25.deterministicSeed);
      expect(evalF10_a.deterministicSeed).toBeGreaterThanOrEqual(0);
      expect(evalF10_a.deterministicSeed).toBeLessThanOrEqual(1);
    });

    it('filters and orders active effects passes', () => {
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

    it('uses the applied effects rack as the authoritative pass order', () => {
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
