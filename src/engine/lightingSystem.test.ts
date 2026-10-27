import { describe, expect, it } from 'vitest';
import { MAX_SHADOW_CASTERS, resolveLighting } from './lightingSystem';
import type { LightRig, SceneLight } from '../model/types';

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
});


