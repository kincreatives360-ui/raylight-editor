// src/engine/deviceFitMath.test.ts
import { describe, it, expect } from 'vitest';
import {
  calculateTextureFit,
  computeDeviceGeometry,
} from './deviceFitMath';
import type { DeviceModelSpec } from '../model/types';

describe('deviceFitMath: calculateTextureFit', () => {
  it('covers correctly when source is wider than target (landscape into portrait)', () => {
    // 1920x1080 (16:9 ~ 1.777) into 900x1950 (9:19.5 ~ 0.461)
    const fit = calculateTextureFit(1920, 1080, 900, 1950, 'cover');

    // Entire target must be filled
    expect(fit.dx).toBe(0);
    expect(fit.dy).toBe(0);
    expect(fit.dw).toBe(900);
    expect(fit.dh).toBe(1950);

    // Source must be cropped horizontally symmetrically
    expect(fit.sh).toBe(1080);
    const expectedSw = 1080 * (900 / 1950);
    expect(fit.sw).toBeCloseTo(expectedSw, 2);
    expect(fit.sx).toBeCloseTo((1920 - expectedSw) / 2, 2);
    expect(fit.sy).toBe(0);
  });

  it('covers correctly when source is taller than target (portrait into landscape)', () => {
    // 1080x1920 (9:16 ~ 0.562) into 1500x950 (16:10 ~ 1.578)
    const fit = calculateTextureFit(1080, 1920, 1500, 950, 'cover');

    expect(fit.dx).toBe(0);
    expect(fit.dy).toBe(0);
    expect(fit.dw).toBe(1500);
    expect(fit.dh).toBe(950);

    // Source must be cropped vertically symmetrically
    expect(fit.sw).toBe(1080);
    const expectedSh = 1080 / (1500 / 950);
    expect(fit.sh).toBeCloseTo(expectedSh, 2);
    expect(fit.sx).toBe(0);
    expect(fit.sy).toBeCloseTo((1920 - expectedSh) / 2, 2);
  });

  it('contains correctly when source is wider than target (letterbox top/bottom)', () => {
    // 1600x900 (16:9) into 1000x1000 (1:1)
    const fit = calculateTextureFit(1600, 900, 1000, 1000, 'contain');

    expect(fit.dx).toBe(0);
    expect(fit.dw).toBe(1000);
    const expectedDh = 1000 / (1600 / 900);
    expect(fit.dh).toBeCloseTo(expectedDh, 2);
    expect(fit.dy).toBeCloseTo((1000 - expectedDh) / 2, 2);

    expect(fit.sx).toBe(0);
    expect(fit.sy).toBe(0);
    expect(fit.sw).toBe(1600);
    expect(fit.sh).toBe(900);
  });

  it('contains correctly when source is taller than target (pillarbox left/right)', () => {
    // 900x1600 (9:16) into 1000x1000 (1:1)
    const fit = calculateTextureFit(900, 1600, 1000, 1000, 'contain');

    expect(fit.dy).toBe(0);
    expect(fit.dh).toBe(1000);
    const expectedDw = 1000 * (900 / 1600);
    expect(fit.dw).toBeCloseTo(expectedDw, 2);
    expect(fit.dx).toBeCloseTo((1000 - expectedDw) / 2, 2);

    expect(fit.sx).toBe(0);
    expect(fit.sy).toBe(0);
    expect(fit.sw).toBe(900);
    expect(fit.sh).toBe(1600);
  });

  it('handles equal aspect ratios identically in contain and cover', () => {
    const contain = calculateTextureFit(800, 600, 1600, 1200, 'contain');
    const cover = calculateTextureFit(800, 600, 1600, 1200, 'cover');

    expect(contain.dx).toBe(0);
    expect(contain.dy).toBe(0);
    expect(contain.dw).toBe(1600);
    expect(contain.dh).toBe(1200);

    expect(cover.dx).toBe(0);
    expect(cover.dy).toBe(0);
    expect(cover.dw).toBe(1600);
    expect(cover.dh).toBe(1200);
  });

  it('handles invalid or non-positive dimensions gracefully without crashing', () => {
    expect(() => calculateTextureFit(0, 0, 100, 100, 'cover')).not.toThrow();
    expect(() => calculateTextureFit(-50, 100, 0, -20, 'contain')).not.toThrow();
    expect(() => calculateTextureFit(NaN, Infinity, 100, 100, 'cover')).not.toThrow();

    const fit = calculateTextureFit(0, 0, 100, 100, 'cover');
    expect(fit.dw).toBeGreaterThan(0);
    expect(fit.dh).toBeGreaterThan(0);
  });
});

describe('deviceFitMath: computeDeviceGeometry', () => {
  const iphoneSpec: DeviceModelSpec = {
    id: 'phone_generic',
    name: 'iPhone',
    kind: 'procedural',
    nominalWidth: 1,
    nominalHeight: 2.05,
    nominalDepth: 0.08,
    screenWidth: 0.92,
    screenHeight: 1.95,
    defaultFit: 'cover',
    chassisCornerRadius: 0.14,
    screenCornerRadius: 0.135,
  };

  it('preserves physical device proportions regardless of container box aspect ratio', () => {
    // Square container
    const geomSquare = computeDeviceGeometry(iphoneSpec, 1.0, 1.0);
    // Landscape container
    const geomWide = computeDeviceGeometry(iphoneSpec, 2.0, 0.5);
    // Tall container
    const geomTall = computeDeviceGeometry(iphoneSpec, 0.5, 2.0);

    const expectedDeviceAspect = iphoneSpec.nominalWidth / iphoneSpec.nominalHeight;
    const expectedScreenAspect = iphoneSpec.screenWidth / iphoneSpec.screenHeight;

    expect(geomSquare.deviceAspect).toBeCloseTo(expectedDeviceAspect, 4);
    expect(geomWide.deviceAspect).toBeCloseTo(expectedDeviceAspect, 4);
    expect(geomTall.deviceAspect).toBeCloseTo(expectedDeviceAspect, 4);

    expect(geomSquare.screenAspect).toBeCloseTo(expectedScreenAspect, 4);
    expect(geomWide.screenAspect).toBeCloseTo(expectedScreenAspect, 4);
    expect(geomTall.screenAspect).toBeCloseTo(expectedScreenAspect, 4);
  });

  it('swaps dimensions predictably when orientation is landscape', () => {
    const portrait = computeDeviceGeometry(iphoneSpec, 1.0, 2.0, 'portrait');
    const landscape = computeDeviceGeometry(iphoneSpec, 2.0, 1.0, 'landscape');

    // Landscape device width/height ratio should be inverse of portrait
    expect(landscape.deviceAspect).toBeCloseTo(1 / portrait.deviceAspect, 4);
    expect(landscape.screenAspect).toBeCloseTo(1 / portrait.screenAspect, 4);
  });
});
