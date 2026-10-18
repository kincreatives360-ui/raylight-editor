import { describe, it, expect } from 'vitest';
import {
  MAX_SHADOW_CASTERS,
  DEFAULT_FILL_INTENSITY,
  lerpHex,
  resolveKeyIntensity,
  resolveSourceIntensity,
  resolveFill,
  planShadowCasters,
} from './lightMath';
import type { LightRig } from '../model/types';

describe('lightMath', () => {
  it('old-project defaults round-trip: no keyIntensity falls back to intensity', () => {
    const oldRig: LightRig = {
      position: { x: 0, y: 0, z: 1 },
      intensity: 1.5,
      temperature: 6500,
      ambience: 0.4,
    };

    expect(resolveKeyIntensity(oldRig)).toBe(1.5);
  });

  it('explicit keyIntensity takes precedence over master intensity for the key', () => {
    const rig: LightRig = {
      position: { x: 0, y: 0, z: 1 },
      intensity: 2.0,
      keyIntensity: 0.5,
      temperature: 6500,
      ambience: 0.4,
    };

    expect(resolveKeyIntensity(rig)).toBe(0.5);
    // Source intensity should use master rig.intensity, not keyIntensity
    const srcIntensity = resolveSourceIntensity(rig, {
      id: 'src-1',
      name: 'Fill',
      type: 'point',
      enabled: true,
      position: { x: 1, y: 1, z: 1 },
      intensity: 1.2,
      color: '#ffffff',
    });
    // 1.2 * 2.0 * 2.0 = 4.8
    expect(srcIntensity).toBeCloseTo(4.8);
  });

  it('planShadowCasters never exceeds MAX_SHADOW_CASTERS and skips area lights', () => {
    const rig: LightRig = {
      position: { x: 0, y: 0, z: 1 },
      intensity: 1.0,
      temperature: 6500,
      ambience: 0.4,
      keyLightEnabled: true,
      castShadow: true,
      sources: [
        {
          id: 'area-1',
          name: 'Area Light',
          type: 'area',
          enabled: true,
          position: { x: 0, y: 0, z: 1 },
          intensity: 1,
          color: '#ffffff',
          castShadow: true,
        },
        {
          id: 'point-1',
          name: 'Point 1',
          type: 'point',
          enabled: true,
          position: { x: 0, y: 0, z: 1 },
          intensity: 1,
          color: '#ffffff',
          castShadow: true,
        },
        {
          id: 'point-2',
          name: 'Point 2',
          type: 'point',
          enabled: true,
          position: { x: 0, y: 0, z: 1 },
          intensity: 1,
          color: '#ffffff',
          castShadow: true,
        },
        {
          id: 'point-3',
          name: 'Point 3',
          type: 'point',
          enabled: true,
          position: { x: 0, y: 0, z: 1 },
          intensity: 1,
          color: '#ffffff',
          castShadow: true,
        },
      ],
    };

    const plan = planShadowCasters(rig);
    expect(plan.key).toBe(true);
    // Budget is 3: key takes 1, remaining 2 for sources.
    // area-1 is skipped. point-1 and point-2 are included. point-3 exceeds budget.
    expect(plan.sourceIds.size).toBe(2);
    expect(plan.sourceIds.has('area-1')).toBe(false);
    expect(plan.sourceIds.has('point-1')).toBe(true);
    expect(plan.sourceIds.has('point-2')).toBe(true);
    expect(plan.sourceIds.has('point-3')).toBe(false);

    const totalCasters = (plan.key ? 1 : 0) + plan.sourceIds.size;
    expect(totalCasters).toBeLessThanOrEqual(MAX_SHADOW_CASTERS);
  });

  it('lerpHex smoothly blends colors and clamps t', () => {
    expect(lerpHex('#000000', '#ffffff', 0)).toBe('#000000');
    expect(lerpHex('#000000', '#ffffff', 1)).toBe('#ffffff');
    expect(lerpHex('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(lerpHex('#ff0000', '#0000ff', -0.5)).toBe('#ff0000');
    expect(lerpHex('#ff0000', '#0000ff', 1.5)).toBe('#0000ff');
  });

  it('resolveFill follows key by default and respects explicit toggles', () => {
    const keyOnRig: LightRig = {
      position: { x: 0, y: 0, z: 1 },
      intensity: 1,
      temperature: 6500,
      ambience: 0.4,
      keyLightEnabled: true,
    };
    expect(resolveFill(keyOnRig)).toEqual({ enabled: true, intensity: DEFAULT_FILL_INTENSITY });

    const keyOffRig: LightRig = {
      ...keyOnRig,
      keyLightEnabled: false,
    };
    expect(resolveFill(keyOffRig)).toEqual({ enabled: false, intensity: DEFAULT_FILL_INTENSITY });

    const customFillRig: LightRig = {
      ...keyOffRig,
      fillEnabled: true,
      fillIntensity: 0.8,
    };
    expect(resolveFill(customFillRig)).toEqual({ enabled: true, intensity: 0.8 });
  });
});
