import { describe, expect, it } from 'vitest';
import { createDefaultImageLayer, createDefaultProject } from './defaults';
import { DeviceFrameSettingsSchema, validateProject } from './schema';
import { DEFAULT_DEVICE_FRAME_SETTINGS, getDeviceFrameMetrics, getDeviceFrameScale, upgradeDeviceFrameSettings } from './deviceFrame';
import { useProjectStore } from '../store/useProjectStore';

describe('device frame compatibility', () => {
  it('repairs partial legacy settings without silently upgrading their geometry', () => {
    const result = DeviceFrameSettingsSchema.safeParse({ enabled: true, model: 'iphone' });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.geometryVersion).toBeUndefined();
    expect(result.data.scale).toBe(1.08);
    expect(result.data.model).toBe('iphone');
  });

  it('upgrades explicitly, preserving body height and all legacy appearance fields', () => {
    const legacy = DeviceFrameSettingsSchema.parse({ enabled: true, model: 'iphone-classic', scale: 1.6, bezelWidth: 0.13 });
    const before = getDeviceFrameMetrics(0.6, 0.7, legacy);
    const upgraded = upgradeDeviceFrameSettings(legacy, 0.6, 0.7);
    const after = getDeviceFrameMetrics(0.6, 0.7, upgraded);
    expect(after.bodyHeight).toBeCloseTo(before.bodyHeight, 8);
    expect(after.bodyWidth / after.bodyHeight).toBeCloseTo(70.6 / 146.6, 8);
    expect(upgraded).toMatchObject({ geometryVersion: 1, deviceId: 'iphone-15-pro', model: 'iphone-classic', scale: 1.6, bezelWidth: 0.13 });
    expect(upgradeDeviceFrameSettings(upgraded, 0.6, 0.7)).toEqual(upgraded);
    expect(legacy.geometryVersion).toBeUndefined();
  });

  it('retains unknown device IDs, while rejecting unsupported future geometry versions', () => {
    const settings = { ...DEFAULT_DEVICE_FRAME_SETTINGS, deviceId: 'future-phone' };
    expect(DeviceFrameSettingsSchema.parse(settings).deviceId).toBe('future-phone');
    expect(getDeviceFrameMetrics(0.5, 0.7, settings)).toEqual(getDeviceFrameMetrics(0.5, 0.7, DEFAULT_DEVICE_FRAME_SETTINGS));
    expect(DeviceFrameSettingsSchema.safeParse({ ...settings, geometryVersion: 2 }).success).toBe(false);
  });

  it('preserves body height when explicitly upgrading nonuniform legacy scale', () => {
    const legacy = DeviceFrameSettingsSchema.parse({ enabled: true, scale: 1.4 });
    const scale = { x: 4, y: 1, z: 0.5 };
    const before = getDeviceFrameMetrics(0.6, 0.7, legacy);
    const upgraded = upgradeDeviceFrameSettings(legacy, 0.6, 0.7, scale);
    const after = getDeviceFrameMetrics(0.6, 0.7, upgraded);
    expect(after.bodyHeight * getDeviceFrameScale(upgraded, scale).y).toBeCloseTo(before.bodyHeight * scale.y, 8);
    expect(DeviceFrameSettingsSchema.parse(JSON.parse(JSON.stringify(upgraded)))).toEqual(upgraded);
  });

  it('round-trips new and legacy frames without changing media, crop, position, or source data', () => {
    const project = createDefaultProject();
    const legacy = DeviceFrameSettingsSchema.parse({ enabled: true, scale: 1.7, model: 'iphone' });
    project.shots[0].layers = [
      createDefaultImageLayer({ deviceFrame: { ...DEFAULT_DEVICE_FRAME_SETTINGS, enabled: true, deviceScale: 1.4 }, crop: { x: 0.1, y: 0, width: 0.8, height: 1 } }),
      createDefaultImageLayer({ deviceFrame: legacy }),
      createDefaultImageLayer(),
    ];
    const original = JSON.stringify(project);
    const loaded = validateProject(JSON.parse(original));
    expect(loaded.success).toBe(true);
    if (!loaded.success) return;
    expect(loaded.data.shots[0].layers).toEqual(project.shots[0].layers);
    expect(validateProject(JSON.parse(JSON.stringify(loaded.data)))).toEqual(loaded);
    expect(JSON.stringify(project)).toBe(original);
  });

  it('enables, disables, and restores device metadata through undo/redo', () => {
    const project = createDefaultProject();
    const layer = createDefaultImageLayer();
    project.shots[0].layers = [layer];
    const store = useProjectStore.getState();
    expect(store.loadProjectJson(project).success).toBe(true);
    const shotId = project.shots[0].id;
    store.updateLayer(shotId, layer.id, current => current.kind === 'image' ? {
      ...current, deviceFrame: { ...DEFAULT_DEVICE_FRAME_SETTINGS, enabled: true },
    } : current);
    const enabled = structuredClone(useProjectStore.getState().project);
    store.updateLayer(shotId, layer.id, current => current.kind === 'image' && current.deviceFrame ? {
      ...current, deviceFrame: { ...current.deviceFrame, enabled: false },
    } : current);
    store.undo();
    expect(useProjectStore.getState().project).toEqual(enabled);
    store.undo();
    expect(useProjectStore.getState().project.shots[0].layers[0]).toEqual(layer);
    store.redo();
    expect(useProjectStore.getState().project).toEqual(enabled);
    store.resetProject();
  });

  it('restores legacy metadata and the source placement when undoing an explicit upgrade', () => {
    const project = createDefaultProject();
    project.aspectRatio = '9:16';
    const legacy = DeviceFrameSettingsSchema.parse({ enabled: true, scale: 1.6, bezelWidth: 0.13 });
    const layer = createDefaultImageLayer({ size: { width: 0.4, height: 0.6 }, deviceFrame: legacy });
    project.shots[0].layers = [layer];
    const store = useProjectStore.getState();
    expect(store.loadProjectJson(project).success).toBe(true);
    const original = structuredClone(useProjectStore.getState().project);
    store.updateLayer(project.shots[0].id, layer.id, current => current.kind === 'image' && current.deviceFrame ? {
      ...current, deviceFrame: upgradeDeviceFrameSettings(current.deviceFrame, current.size.width * 9 / 16, current.size.height, current.scale),
    } : current);
    const upgraded = structuredClone(useProjectStore.getState().project);
    const upgradedLayer = upgraded.shots[0].layers[0];
    if (upgradedLayer.kind !== 'image' || !upgradedLayer.deviceFrame) throw new Error('fixture');
    expect(getDeviceFrameMetrics(0.4 * 9 / 16, 0.6, upgradedLayer.deviceFrame).bodyHeight).toBeCloseTo(0.6936, 8);
    expect(upgradedLayer.position).toEqual(layer.position);
    expect(upgradedLayer.size).toEqual(layer.size);
    expect(validateProject(JSON.parse(JSON.stringify(upgraded))).success).toBe(true);
    store.undo();
    expect(useProjectStore.getState().project).toEqual(original);
    store.redo();
    expect(useProjectStore.getState().project).toEqual(upgraded);
    store.resetProject();
  });
});
