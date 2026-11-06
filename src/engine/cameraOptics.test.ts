// src/engine/cameraOptics.test.ts
import { describe, it, expect } from 'vitest';
import {
  computePhysicalCocGain,
  calculateFocusDistanceToPoint,
  getBokehShapeConfig,
  BOKEH_SHAPES,
  DEFAULT_SCENE_SCALE,
} from './cameraOptics';

describe('cameraOptics module', () => {
  it('computes physical circle of confusion with standard 50mm f/2.8 lens', () => {
    const result = computePhysicalCocGain({
      focalLengthMm: 50,
      fNumber: 2.8,
      sceneScale: DEFAULT_SCENE_SCALE,
      focusDistance: 2.65,
      viewportHeight: 1080,
    });

    expect(result.bokehScale).toBeCloseTo(1080 * 0.05, 2);
    expect(result.cocGain).toBeGreaterThan(0);
    expect(result.cocPixels).toBeGreaterThan(0);
  });

  it('produces stronger blur with wider aperture (f/1.4 vs f/8)', () => {
    const wideAperture = computePhysicalCocGain({
      focalLengthMm: 50,
      fNumber: 1.4,
      focusDistance: 2.65,
      viewportHeight: 1080,
    });

    const smallAperture = computePhysicalCocGain({
      focalLengthMm: 50,
      fNumber: 8.0,
      focusDistance: 2.65,
      viewportHeight: 1080,
    });

    expect(wideAperture.cocGain).toBeGreaterThan(smallAperture.cocGain);
    expect(wideAperture.cocPixels).toBeGreaterThan(smallAperture.cocPixels);
  });

  it('calculates planar distance along camera view axis', () => {
    const cameraPos = { x: 0, y: 0, z: 5 };
    const cameraForward = { x: 0, y: 0, z: -1 };
    const target = { x: 1, y: 2, z: 2 }; // distance along z is 5 - 2 = 3

    const dist = calculateFocusDistanceToPoint(target, cameraPos, cameraForward);
    expect(dist).toBeCloseTo(3, 4);
  });

  it('retrieves distinct bokeh presets correctly', () => {
    expect(getBokehShapeConfig('spherical')).toEqual(BOKEH_SHAPES.spherical);
    expect(getBokehShapeConfig('anamorphic')).toEqual(BOKEH_SHAPES.anamorphic);
    expect(getBokehShapeConfig('vintage')).toEqual(BOKEH_SHAPES.vintage);
    expect(getBokehShapeConfig('portrait')).toEqual(BOKEH_SHAPES.portrait);
    expect(getBokehShapeConfig('unknown' as any)).toEqual(BOKEH_SHAPES.spherical);
  });
});

