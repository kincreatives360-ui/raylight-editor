import { describe, expect, it } from 'vitest';
import {
  getDeviceFrameMetrics,
  getImageFitRect,
  resolveDeviceFrameSettings,
  DEFAULT_DEVICE_FRAME_SETTINGS,
  DEVICE_SPECS,
  getDeviceSpec,
  DEVICE_FINISH_PRESETS,
} from './deviceFrame';

describe('device frame settings', () => {
  it('preserves the exact geometry of legacy frames until explicitly upgraded', () => {
    const settings = resolveDeviceFrameSettings({
      enabled: true,
      scale: 1,
      bezelWidth: 0.06,
      thickness: 0.035,
      cornerRadius: 0.12,
    });

    const metrics = getDeviceFrameMetrics(0.34, 0.68, settings);
    expect(metrics.bodyWidth).toBeCloseTo(0.3808);
    expect(metrics.bodyHeight).toBeCloseTo(0.7208);
    expect(metrics.bodyDepth).toBeCloseTo(0.0119);
    expect(metrics.bezel).toBeCloseTo(0.0204);
    expect(metrics.cornerRadius).toBeCloseTo(0.0408);
  });

  it('clamps saved numeric settings so old or edited project data cannot create invalid geometry', () => {
    const settings = resolveDeviceFrameSettings({
      enabled: true,
      scale: 8,
      bezelWidth: -1,
      thickness: 0,
      glassRoughness: 2,
      gloss: -4,
      reflection: 2,
      shadowBlur: -1,
    });

    expect(settings.scale).toBe(2);
    expect(settings.bezelWidth).toBe(0.01);
    expect(settings.thickness).toBe(0.005);
    expect(settings.glassRoughness).toBe(1);
    expect(settings.gloss).toBe(0);
    expect(settings.reflection).toBe(1);
    expect(settings.shadowBlur).toBe(0);
  });

  it('contains portrait artwork without cropping when the screen uses Fit', () => {
    expect(getImageFitRect(100, 200, 100, 100, 'contain')).toEqual({
      sourceX: 0,
      sourceY: 0,
      sourceWidth: 100,
      sourceHeight: 200,
      targetX: 25,
      targetY: 0,
      targetWidth: 50,
      targetHeight: 100,
    });
  });

  it('fills a landscape screen by center-cropping portrait artwork when the screen uses Fill', () => {
    expect(getImageFitRect(100, 200, 100, 100, 'cover')).toEqual({
      sourceX: 0,
      sourceY: 50,
      sourceWidth: 100,
      sourceHeight: 100,
      targetX: 0,
      targetY: 0,
      targetWidth: 100,
      targetHeight: 100,
    });
  });
});

describe('fixed device geometry', () => {
  const settings = { ...DEFAULT_DEVICE_FRAME_SETTINGS, enabled: true };

  it('creates new frames with versioned metadata and a separate uniform Size', () => {
    expect(resolveDeviceFrameSettings()).toMatchObject({
      geometryVersion: 1, deviceId: 'iphone-15-pro', deviceScale: 1,
    });
  });

  it.each([[0.34, 0.68], [0.68, 0.68], [1.2, 0.68]])(
    'keeps fixed body and screen proportions for a %s × %s placement box', (width, height) => {
      const metrics = getDeviceFrameMetrics(width, height, settings);
      expect(metrics.bodyHeight).toBeCloseTo(height);
      expect(metrics.bodyWidth / metrics.bodyHeight).toBeCloseTo(70.6 / 146.6);
      expect(metrics.bodyDepth / metrics.bodyHeight).toBeCloseTo(8.25 / 146.6);
      expect(metrics.screenWidth / metrics.screenHeight).toBeCloseTo(1179 / 2556);
      expect(metrics.screenWidth).toBeLessThan(metrics.bodyWidth);
      expect(metrics.screenHeight).toBeLessThan(metrics.bodyHeight);
    }
  );

  it('uniformly scales every physical dimension without changing proportions', () => {
    const normal = getDeviceFrameMetrics(0.34, 0.68, settings);
    const large = getDeviceFrameMetrics(0.34, 0.68, { ...settings, deviceScale: 2 });
    for (const field of ['bodyWidth', 'bodyHeight', 'bodyDepth', 'screenWidth', 'screenHeight', 'cornerRadius', 'bodyCornerRadius'] as const) {
      expect(large[field]).toBeCloseTo(normal[field] * 2);
    }
  });

  it('does not let saved legacy bezel/size/depth overrides deform a fixed preset', () => {
    const normal = getDeviceFrameMetrics(0.34, 0.68, settings);
    expect(getDeviceFrameMetrics(0.34, 0.68, {
      ...settings, scale: 2, bezelWidth: 0.2, thickness: 0.16, cornerRadius: 0.24,
    })).toEqual(normal);
  });
});

describe('procedural device models and finish presets', () => {
  it('registers all 6 procedural devices from PRODUCT.md with valid specs', () => {
    const expectedIds = ['iphone-15-pro', 'ipad-pro', 'macbook-pro', 'samsung-galaxy', 'studio-display', 'browser'];
    for (const id of expectedIds) {
      const spec = getDeviceSpec(id);
      expect(spec.id).toBe(id);
      expect(spec.name).toBeTruthy();
      expect(spec.body.width).toBeGreaterThan(0);
      expect(spec.body.height).toBeGreaterThan(0);
      expect(spec.body.depth).toBeGreaterThan(0);
      expect(spec.screen.width).toBeGreaterThan(0);
      expect(spec.screen.height).toBeGreaterThan(0);
      expect(spec.aspectRatio).toBeCloseTo(spec.screen.width / spec.screen.height);
    }
  });

  it('falls back to iPhone 15 Pro for unknown device IDs', () => {
    const fallback = getDeviceSpec('unknown-model-xyz');
    expect(fallback.id).toBe('iphone-15-pro');
  });

  it('resolves and clamps lidAngle for laptops', () => {
    const defaultSettings = resolveDeviceFrameSettings({ geometryVersion: 1, deviceId: 'macbook-pro' });
    expect(defaultSettings.lidAngle).toBe(110);

    const clampedMin = resolveDeviceFrameSettings({ geometryVersion: 1, deviceId: 'macbook-pro', lidAngle: 20 });
    expect(clampedMin.lidAngle).toBe(60);

    const clampedMax = resolveDeviceFrameSettings({ geometryVersion: 1, deviceId: 'macbook-pro', lidAngle: 200 });
    expect(clampedMax.lidAngle).toBe(150);
  });

  it('computes proportional metrics for tablet, laptop, display, and browser models', () => {
    for (const [id, spec] of Object.entries(DEVICE_SPECS)) {
      const settings = resolveDeviceFrameSettings({ geometryVersion: 1, deviceId: id });
      const metrics = getDeviceFrameMetrics(1.0, 1.0, settings);
      expect(metrics.bodyWidth / metrics.bodyHeight).toBeCloseTo(spec.body.width / spec.body.height, 4);
      expect(metrics.screenWidth / metrics.screenHeight).toBeCloseTo(spec.screen.width / spec.screen.height, 4);
      expect(metrics.bodyDepth).toBeGreaterThan(0);
    }
  });

  it('defines 5 official physical finish presets with valid material properties', () => {
    expect(DEVICE_FINISH_PRESETS).toHaveLength(5);
    const presetIds = DEVICE_FINISH_PRESETS.map((p) => p.id);
    expect(presetIds).toEqual(['space-black', 'titanium', 'silver', 'midnight', 'black']);

    for (const preset of DEVICE_FINISH_PRESETS) {
      expect(preset.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(preset.metalness).toBeGreaterThanOrEqual(0);
      expect(preset.metalness).toBeLessThanOrEqual(1);
      expect(preset.roughness).toBeGreaterThanOrEqual(0);
      expect(preset.roughness).toBeLessThanOrEqual(1);
    }
  });
});

