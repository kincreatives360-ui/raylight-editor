// src/model/deviceSystem.test.ts
import { describe, it, expect } from 'vitest';
import {
  getDeviceModelSpec,
  getDeviceModelSpecByType,
  resolveDeviceModelSpec,
  createDefaultImageLayer,
} from './defaults';
import { DeviceFrameSchema, LayerSchema } from './schema';
import { computeDeviceGeometry, calculateTextureFit } from '../engine/deviceFitMath';
import type { DeviceFrame, ImageLayer } from './types';

describe('3D Device System: Model Registry & Resolution', () => {
  it('contains valid physical and screen specifications for all supported device types', () => {
    const supportedTypes: DeviceFrame['type'][] = [
      'iphone',
      'ipad',
      'macbook',
      'browser',
      'samsung-galaxy',
      'display',
    ];

    supportedTypes.forEach((type) => {
      const spec = getDeviceModelSpecByType(type);
      expect(spec).toBeDefined();
      if (!spec) return;

      expect(spec.nominalWidth).toBeGreaterThan(0);
      expect(spec.nominalHeight).toBeGreaterThan(0);
      expect(spec.screenWidth).toBeGreaterThan(0);
      expect(spec.screenHeight).toBeGreaterThan(0);

      // Screen must physically fit within the nominal device body
      expect(spec.screenWidth).toBeLessThanOrEqual(spec.nominalWidth * 1.05);
      expect(spec.screenHeight).toBeLessThanOrEqual(spec.nominalHeight * 1.05);

      // Default fit must be either contain or cover
      expect(['contain', 'cover']).toContain(spec.defaultFit);
    });
  });

  it('resolves device specs by explicit modelSpecId, by type, and falls back safely on unknown', () => {
    const byId = getDeviceModelSpec('iphone_15_pro');
    expect(byId.id).toBe('iphone_15_pro');

    const byType = resolveDeviceModelSpec({
      type: 'samsung-galaxy',
      color: '#000000',
      gloss: 0.5,
    });
    expect(byType.id).toBe('samsung_galaxy_s22');

    // Safe fallback on undefined or unknown
    const fallbackNull = resolveDeviceModelSpec(undefined);
    expect(fallbackNull).toBeDefined();
    expect(fallbackNull.id).toBe('phone_generic');

    const fallbackUnknown = resolveDeviceModelSpec({
      type: 'unknown-device' as any,
      color: '#000000',
      gloss: 0.5,
    });
    expect(fallbackUnknown).toBeDefined();
    expect(fallbackUnknown.id).toBe('phone_generic');
  });
});

describe('3D Device System: Schema Backward Compatibility & Migration', () => {
  it('migrates legacy screenFit values (fit, fill, stretch) to valid contain and cover', () => {
    const legacyFit = DeviceFrameSchema.parse({
      type: 'iphone',
      color: '#1c1c1f',
      gloss: 0.5,
      screenFit: 'fit',
    });
    expect(legacyFit.screenFit).toBe('contain');

    const legacyFill = DeviceFrameSchema.parse({
      type: 'macbook',
      color: '#e2e8f0',
      gloss: 0.3,
      screenFit: 'fill',
    });
    expect(legacyFill.screenFit).toBe('cover');

    const legacyStretch = DeviceFrameSchema.parse({
      type: 'ipad',
      color: '#1c1c1f',
      gloss: 0.8,
      screenFit: 'stretch',
    });
    expect(legacyStretch.screenFit).toBe('cover');
  });

  it('validates older saved projects without orientation or modelSpecId cleanly', () => {
    const defaultLayer = createDefaultImageLayer({
      device: {
        type: 'iphone',
        color: '#1c1c1f',
        gloss: 0.5,
      },
    });

    const parsed = LayerSchema.parse(defaultLayer) as ImageLayer;
    expect(parsed.device).toBeDefined();
    expect(parsed.device?.type).toBe('iphone');
    expect(parsed.device?.screenFit).toBe('contain'); // default applied
    expect(parsed.device?.orientation).toBeUndefined();
  });
});

describe('3D Device System: Silhouette Invariance & Texture Fitting', () => {
  const iphoneSpec = getDeviceModelSpecByType('iphone')!;

  it('preserves the identical physical device silhouette whether image is portrait or landscape', () => {
    // Container representing layer box
    const containerW = 0.4;
    const containerH = 0.8;

    // Simulate placing a portrait image (9:16) vs landscape image (16:9)
    const portraitMediaFit = calculateTextureFit(1080, 1920, 920, 1950, 'cover');
    const landscapeMediaFit = calculateTextureFit(1920, 1080, 920, 1950, 'cover');

    // Physical device geometry calculation
    const geom1 = computeDeviceGeometry(iphoneSpec, containerW, containerH);
    const geom2 = computeDeviceGeometry(iphoneSpec, containerW, containerH);

    // Physical silhouette does not change
    expect(geom1.deviceW).toBeCloseTo(geom2.deviceW, 5);
    expect(geom1.deviceH).toBeCloseTo(geom2.deviceH, 5);
    expect(geom1.deviceAspect).toBeCloseTo(iphoneSpec.nominalWidth / iphoneSpec.nominalHeight, 5);

    // Screen mesh geometry does not change
    expect(geom1.screenW).toBeCloseTo(geom2.screenW, 5);
    expect(geom1.screenH).toBeCloseTo(geom2.screenH, 5);
    expect(geom1.screenAspect).toBeCloseTo(iphoneSpec.screenWidth / iphoneSpec.screenHeight, 5);

    // But textures adapt cleanly:
    // Portrait image into portrait screen: minimal horizontal crop
    expect(portraitMediaFit.dw).toBe(920);
    expect(portraitMediaFit.dh).toBe(1950);
    // Landscape image into portrait screen: crops wide sides symmetrically
    expect(landscapeMediaFit.dw).toBe(920);
    expect(landscapeMediaFit.dh).toBe(1950);
    expect(landscapeMediaFit.sx).toBeGreaterThan(0);
  });

  it('allows landscape orientation without stretching the chassis body', () => {
    const portraitGeom = computeDeviceGeometry(iphoneSpec, 1.0, 1.0, 'portrait');
    const landscapeGeom = computeDeviceGeometry(iphoneSpec, 1.0, 1.0, 'landscape');

    // Landscape aspect is reciprocal of portrait aspect
    expect(landscapeGeom.deviceAspect).toBeCloseTo(1 / portraitGeom.deviceAspect, 4);
    expect(landscapeGeom.screenAspect).toBeCloseTo(1 / portraitGeom.screenAspect, 4);

    // Physical width and height are swapped cleanly
    expect(landscapeGeom.deviceW).toBeCloseTo(portraitGeom.deviceH, 4);
    expect(landscapeGeom.deviceH).toBeCloseTo(portraitGeom.deviceW, 4);
  });
});
