import { describe, expect, it } from 'vitest';
import {
  MAX_SHADOW_CASTERS,
  resolveLighting,
  getKelvinPreviewColor,
  LIGHT_ANIMATION_PRESETS,
  applyLightAnimationPreset,
} from './lightingSystem';
import type { LightAnimationBlock, LightRig, SceneLight } from '../model/types';

const source = (id: string, type: SceneLight['type']): SceneLight => ({
  id, name: id, type, enabled: true, position: { x: 1, y: 2, z: 3 },
  target: { x: -1, y: 0, z: 0 }, intensity: 1, color: '#ffffff', castShadow: true,
});
const rig: LightRig = {
  position: { x: 0.25, y: 0.5, z: 1 }, intensity: 1.5, keyIntensity: 0.5,
  temperature: 6500, ambience: 0.3, sources: [
    source('point', 'point'), source('spot', 'spot'), source('area', 'area'),
    source('directional', 'directional'), source('ambient', 'ambient'),
  ],
};

describe('lightingSystem', () => {
  it('honors the Sun switch without disabling independent sources', () => {
    const resolved = resolveLighting({ ...rig, keyLightEnabled: false });
    expect(resolved.key.enabled).toBe(false);
    expect(resolved.key.castShadow).toBe(false);
    expect(resolved.fill.enabled).toBe(false);
    expect(resolved.sources).toHaveLength(5);
  });

  it('allows both ambient illumination and environment reflections to reach zero', () => {
    const resolved = resolveLighting({ ...rig, ambience: 0 });
    expect(resolved.room.intensity).toBe(0);
    expect(resolved.room.environmentIntensity).toBe(0);
  });
  it('uses the editable key light tint without tinting other sources', () => {
    const original = resolveLighting(rig);
    const tinted = resolveLighting({ ...rig, keyColor: '#ff0000' });
    expect(tinted.key.color).toBe('#ff0000');
    expect(tinted.sources).toEqual(original.sources);
  });
  it('resolves one renderer-ready configuration for key, room, and every enabled source', () => {
    const resolved = resolveLighting(rig);
    expect(resolved.key.position).toEqual([1.5, 3, 5]);
    expect(resolved.key.target).toEqual([0, 0, 0]);
    expect(resolved.key.intensity).toBe(1.1);
    expect(resolved.room.intensity).toBeGreaterThan(0);
    expect(resolved.sources.map(({ id }) => id)).toEqual(['point', 'spot', 'area', 'directional', 'ambient']);
    expect(resolved.sources.find(({ id }) => id === 'spot')?.target).toEqual([-6, 0, 0]);
    expect(resolved.sources.find(({ id }) => id === 'area')?.width).toBeGreaterThan(0);
  });

  it('does not drop active lights when the source list exceeds the old arbitrary limit', () => {
    const manyLights = Array.from({ length: 12 }, (_, i) => source(`light-${i}`, 'point'));
    expect(resolveLighting({ ...rig, sources: manyLights }).sources).toHaveLength(12);
  });

  it('only assigns the bounded shadow budget to shadow-capable lights', () => {
    const resolved = resolveLighting(rig);
    const casters = [resolved.key, ...resolved.sources].filter((light) => light.castShadow);
    expect(casters).toHaveLength(MAX_SHADOW_CASTERS);
    expect(resolved.sources.find(({ id }) => id === 'area')?.castShadow).toBe(false);
    expect(resolved.sources.find(({ id }) => id === 'ambient')?.castShadow).toBe(false);
  });

  it('maps Room presets to distinct fallback tints and uses the saved color in Custom', () => {
    expect(resolveLighting({ ...rig, environment: 'night-city' }).room.environmentTint).toBe('#b8c9ff');
    expect(resolveLighting({ ...rig, environment: 'custom', ambientColor: '#ff8040' }).room.environmentTint).toBe('#ff8040');
  });
  it('resolves the saved key target from the inspector', () => {
    const resolved = resolveLighting({ ...rig, target: { x: 1, y: -2, z: 0.5 } });
    expect(resolved.key.target).toEqual([6, -12, 2.5]);
  });

  it('retains old-project light values and safely defaults missing optional properties', () => {
    const resolved = resolveLighting({
      position: { x: 0, y: 0, z: 1 }, intensity: 1.2, temperature: 6100, ambience: 0.45,
    });
    expect(resolved.key.enabled).toBe(true);
    expect(resolved.sources).toEqual([]);
    expect(resolved.room.environment).toBe('studio');
  });

  it('evaluates Kelvin temperature preview colors with blackbody conversion', () => {
    const warm = getKelvinPreviewColor(2700);
    const daylight = getKelvinPreviewColor(6500);
    const cool = getKelvinPreviewColor(9000);

    expect(warm).toMatch(/^rgb\(\d+,\s*\d+,\s*\d+\)$/);
    expect(daylight).toMatch(/^rgb\(\d+,\s*\d+,\s*\d+\)$/);
    expect(cool).toMatch(/^rgb\(\d+,\s*\d+,\s*\d+\)$/);
  });

  it('provides and applies cinematic light animation movement presets', () => {
    expect(LIGHT_ANIMATION_PRESETS.length).toBeGreaterThanOrEqual(4);

    const baseBlock: LightAnimationBlock = {
      id: 'blk-1',
      label: 'Custom',
      targetLightId: 'key',
      property: 'position',
      startMs: 100,
      durationMs: 500,
      fromX: 0,
      fromY: 0,
      fromZ: 1,
      toX: 1,
      toY: 1,
      toZ: 1,
      fromIntensity: 1,
      toIntensity: 1,
      fromTemperature: 6500,
      toTemperature: 6500,
      easing: { kind: 'preset', name: 'linear' },
    };

    const gleam = applyLightAnimationPreset(baseBlock, 'gleam-sweep');
    expect(gleam.label).toBe('Gleam Sweep');
    expect(gleam.property).toBe('position');
    expect(gleam.durationMs).toBe(1400);
    expect(gleam.fromX).toBe(-0.6);
    expect(gleam.toX).toBe(0.6);

    const pulse = applyLightAnimationPreset(baseBlock, 'power-pulse');
    expect(pulse.label).toBe('Power Pulse');
    expect(pulse.property).toBe('intensity');
    expect(pulse.toIntensity).toBe(2.2);

    const untouched = applyLightAnimationPreset(baseBlock, 'non-existent');
    expect(untouched).toEqual(baseBlock);
  });
});
