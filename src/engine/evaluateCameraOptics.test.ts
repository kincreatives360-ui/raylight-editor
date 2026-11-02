import { describe, it, expect } from 'vitest';
import { evaluateCameraOptics } from './evaluateCameraOptics';
import { createDefaultShot, createDefaultShapeLayer } from '../model/defaults';
import type { EvaluatedCamera } from './evaluateCamera';
import type { EvaluatedLayer } from './evaluateLayer';

describe('evaluateCameraOptics', () => {
  const dummyCamera: EvaluatedCamera = {
    position: { x: 0, y: 0, z: 2.65 },
    target: { x: 0, y: 0, z: 0 },
    zoom: 1.0,
    rotation: { x: 0, y: 0, z: 0 },
    fov: 39.6,
  };

  it('evaluates manual focus distance and calculates hyperfocal limits', () => {
    const shot = createDefaultShot({
      cameraOptics: {
        enabled: true,
        focusMode: 'manual',
        focusDistance: 3.0,
        focalLength: 50,
        aperture: 2.8,
        sensorFormat: 'full-frame',
        bokehQuality: 'medium',
        bokehShape: 'circular',
        showFocusPlane: true,
      },
    });

    const evaluated = evaluateCameraOptics(shot, dummyCamera);

    expect(evaluated.enabled).toBe(true);
    expect(evaluated.resolvedFocusDistance).toBe(3.0);
    expect(evaluated.nearFocusDistance).toBeLessThan(3.0);
    expect(evaluated.farFocusDistance).toBeGreaterThan(3.0);
    expect(evaluated.cocScale).toBeGreaterThan(0);
  });

  it('tracks object target 3D distance dynamically', () => {
    const targetLayer = createDefaultShapeLayer({
      id: 'target-obj',
      position: { x: 0, y: 0, z: -0.5 }, // 2.65 - (-0.5) = 3.15m from camera
    });

    const shot = createDefaultShot({
      layers: [targetLayer],
      cameraOptics: {
        enabled: true,
        focusMode: 'target',
        focusDistance: 2.65,
        targetObjectId: 'target-obj',
        focalLength: 85,
        aperture: 1.8,
        sensorFormat: 'full-frame',
        bokehQuality: 'high',
        bokehShape: 'circular',
        showFocusPlane: true,
      },
    });

    const evalLayers: EvaluatedLayer[] = [
      {
        ...targetLayer,
        visible: true,
        worldTransform: {
          position: { x: 0, y: 0, z: -0.5 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
          opacity: 1,
        },
      },
    ];

    const evaluated = evaluateCameraOptics(shot, dummyCamera, evalLayers);

    expect(evaluated.focusMode).toBe('target');
    expect(evaluated.resolvedFocusDistance).toBeCloseTo(3.15, 2);
  });

  it('changes depth-of-field near/far ranges when aperture changes from f/1.4 to f/8', () => {
    const shotFast = createDefaultShot({
      cameraOptics: {
        enabled: true,
        focusMode: 'manual',
        focusDistance: 2.0,
        focalLength: 50,
        aperture: 1.4,
        sensorFormat: 'full-frame',
        bokehQuality: 'medium',
        bokehShape: 'circular',
        showFocusPlane: false,
      },
    });

    const shotSlow = createDefaultShot({
      cameraOptics: {
        enabled: true,
        focusMode: 'manual',
        focusDistance: 2.0,
        focalLength: 50,
        aperture: 8.0,
        sensorFormat: 'full-frame',
        bokehQuality: 'medium',
        bokehShape: 'circular',
        showFocusPlane: false,
      },
    });

    const evalFast = evaluateCameraOptics(shotFast, dummyCamera);
    const evalSlow = evaluateCameraOptics(shotSlow, dummyCamera);

    const rangeFast = evalFast.farFocusDistance - evalFast.nearFocusDistance;
    const rangeSlow = evalSlow.farFocusDistance - evalSlow.nearFocusDistance;

    // f/8 has a wider depth-of-field acceptable sharpness range than f/1.4
    expect(rangeSlow).toBeGreaterThan(rangeFast);
  });
});
