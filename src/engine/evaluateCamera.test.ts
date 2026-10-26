// src/engine/evaluateCamera.test.ts
import { describe, it, expect } from 'vitest';
import { evaluateShotCameraAtTime } from './evaluateCamera';
import { createDefaultShot, degToRad } from '../model/defaults';
import type { Shot, CameraBlock } from '../model/types';

describe('evaluateShotCameraAtTime', () => {
  it('1. Returns default framing values when no camera blocks exist', () => {
    const shot: Shot = createDefaultShot({
      framings: [
        {
          id: 'custom-f1',
          name: 'Hero Frame',
          target: { x: 120, y: -45, z: 0 },
          zoom: 1.25,
          tilt: 5,
          orbit: 15,
          roll: -2,
        },
      ],
      cameraBlocks: [],
    });

    const evaluated = evaluateShotCameraAtTime(shot, 1000);
    expect(evaluated.target.x).toBe(120);
    expect(evaluated.target.y).toBe(-45);
    expect(evaluated.target.z).toBe(0);
    expect(evaluated.zoom).toBe(1.25);
    expect(evaluated.rotation.x).toBeCloseTo(degToRad(5), 4);
    expect(evaluated.rotation.y).toBeCloseTo(degToRad(15), 4);
    expect(evaluated.rotation.z).toBeCloseTo(degToRad(-2), 4);
    expect(evaluated.activeMode).toBe('static');
    expect(evaluated.focalLength).toBe(50);
  });

  it('2. Evaluates dolly mode: physical camera push with constant 50mm lens', () => {
    const block: CameraBlock = {
      id: 'cam-dolly',
      label: 'Dolly Push',
      mode: 'dolly',
      fromFramingId: 'f1',
      toFramingId: 'f2',
      startMs: 1000,
      durationMs: 2000,
      easing: { kind: 'preset', name: 'linear' },
      from: { anchorX: 0, anchorY: 0, zoom: 1.0, roll: 0, orbit: 0, tilt: 0 },
      to: { anchorX: 200, anchorY: 100, zoom: 1.5, roll: 10, orbit: 20, tilt: 30 },
    };

    const shot = createDefaultShot({ cameraBlocks: [block] });

    // Before startMs -> holds from values
    const before = evaluateShotCameraAtTime(shot, 500);
    expect(before.target.x).toBe(0);
    expect(before.zoom).toBe(1.0);
    expect(before.focalLength).toBe(50);

    // Midpoint: t=2000 (1000ms into 2000ms duration)
    const mid = evaluateShotCameraAtTime(shot, 2000);
    expect(mid.target.x).toBeCloseTo(100, 2);
    expect(mid.target.y).toBeCloseTo(50, 2);
    expect(mid.zoom).toBeCloseTo(1.25, 2);
    expect(mid.rotation.x).toBeCloseTo(degToRad(15), 3);
    expect(mid.focalLength).toBe(50); // In dolly mode, focal length stays 50mm
    expect(mid.activeMode).toBe('dolly');

    // After block ends -> holds to values
    const after = evaluateShotCameraAtTime(shot, 3500);
    expect(after.target.x).toBe(200);
    expect(after.target.y).toBe(100);
    expect(after.zoom).toBe(1.5);
    expect(after.focalLength).toBe(50);
  });

  it('3. Evaluates zoom mode: scales focal length directly with zoom without 3D translation', () => {
    const block: CameraBlock = {
      id: 'cam-zoom',
      label: 'Lens Zoom In',
      mode: 'zoom',
      fromFramingId: 'f1',
      toFramingId: 'f2',
      startMs: 0,
      durationMs: 1000,
      easing: { kind: 'preset', name: 'linear' },
      from: { anchorX: 0, anchorY: 0, zoom: 1.0, roll: 0, orbit: 0, tilt: 0 },
      to: { anchorX: 0, anchorY: 0, zoom: 2.0, roll: 0, orbit: 0, tilt: 0 },
    };

    const shot = createDefaultShot({ cameraBlocks: [block] });

    // At t=0 -> 1x zoom => 50mm focal length, 27° FOV
    const atStart = evaluateShotCameraAtTime(shot, 0);
    expect(atStart.zoom).toBe(1.0);
    expect(atStart.focalLength).toBe(50);
    expect(atStart.fovDegrees).toBeCloseTo(27.0006, 2);

    // At t=1000 -> 2x zoom => 100mm focal length, 13.5° FOV
    const atEnd = evaluateShotCameraAtTime(shot, 1000);
    expect(atEnd.zoom).toBe(2.0);
    expect(atEnd.focalLength).toBe(100);
    expect(atEnd.fovDegrees).toBeCloseTo(27.0006 / 2, 2);
    expect(atEnd.activeMode).toBe('zoom');
  });

  it('4. Evaluates dollyzoom (Vertigo effect): counter-scales FOV against physical zoom', () => {
    const block: CameraBlock = {
      id: 'cam-vertigo',
      label: 'Vertigo Dolly Zoom',
      mode: 'dollyzoom',
      fromFramingId: 'f1',
      toFramingId: 'f2',
      startMs: 0,
      durationMs: 2000,
      easing: { kind: 'preset', name: 'linear' },
      from: { anchorX: 0, anchorY: 0, zoom: 1.0, roll: 0, orbit: 0, tilt: 0 },
      to: { anchorX: 0, anchorY: 0, zoom: 2.0, roll: 0, orbit: 0, tilt: 0 },
    };

    const shot = createDefaultShot({ cameraBlocks: [block] });

    const atEnd = evaluateShotCameraAtTime(shot, 2000);
    expect(atEnd.activeMode).toBe('dollyzoom');
    // FOV expands as zoom pushes in
    expect(atEnd.fovDegrees).toBeGreaterThan(27.0006);
    expect(Number.isFinite(atEnd.focalLength)).toBe(true);
  });

  it('5. Evaluates handheld camera shake deterministically', () => {
    const block: CameraBlock = {
      id: 'cam-shake',
      label: 'Shaky Cam',
      mode: 'dolly',
      fromFramingId: 'f1',
      toFramingId: 'f2',
      startMs: 0,
      durationMs: 2000,
      easing: { kind: 'preset', name: 'linear' },
      from: { anchorX: 0, anchorY: 0, zoom: 1.0, roll: 0, orbit: 0, tilt: 0 },
      to: { anchorX: 0, anchorY: 0, zoom: 1.0, roll: 0, orbit: 0, tilt: 0 },
      shake: { from: 50, to: 100 },
    };

    const shot = createDefaultShot({ cameraBlocks: [block] });

    // Shake produces non-zero displacement on target and rotation
    const eval1 = evaluateShotCameraAtTime(shot, 1000);
    expect(eval1.target.x).not.toBe(0);
    expect(eval1.target.y).not.toBe(0);

    // Same time produces strictly identical results (deterministic)
    const eval2 = evaluateShotCameraAtTime(shot, 1000);
    expect(eval2.target.x).toBe(eval1.target.x);
    expect(eval2.target.y).toBe(eval1.target.y);
    expect(eval2.rotation.z).toBe(eval1.rotation.z);
  });

  it('6. Edge cases: missing framings array, zero duration, and NaN zoom handling', () => {
    const bareShot: Shot = {
      ...createDefaultShot(),
      framings: undefined as unknown as [],
      cameraBlocks: [
        {
          id: 'cam-zero',
          label: 'Instant Move',
          mode: 'dolly',
          fromFramingId: 'missing',
          toFramingId: 'missing',
          startMs: 0,
          durationMs: 0,
          easing: { kind: 'preset', name: 'linear' },
          from: { anchorX: 10, anchorY: 20, zoom: NaN, roll: 0, orbit: 0, tilt: 0 },
          to: { anchorX: 30, anchorY: 40, zoom: 1.4, roll: 0, orbit: 0, tilt: 0 },
        },
      ],
    };

    const result = evaluateShotCameraAtTime(bareShot, 100);
    expect(result.target.x).toBe(30);
    expect(result.target.y).toBe(40);
    expect(result.zoom).toBe(1.4);
    expect(Number.isFinite(result.fovDegrees)).toBe(true);
    expect(Number.isFinite(result.focalLength)).toBe(true);
  });

  it('7. Smoothly interpolates targetZ across framing depth changes', () => {
    const shot = createDefaultShot({
      framings: [
        { id: 'f-shallow', name: 'Shallow', target: { x: 0, y: 0, z: -10 }, zoom: 1, tilt: 0, orbit: 0, roll: 0 },
        { id: 'f-deep', name: 'Deep', target: { x: 0, y: 0, z: 50 }, zoom: 1, tilt: 0, orbit: 0, roll: 0 },
      ],
      cameraBlocks: [
        {
          id: 'cam-depth',
          label: 'Z Transition',
          mode: 'dolly',
          fromFramingId: 'f-shallow',
          toFramingId: 'f-deep',
          startMs: 0,
          durationMs: 1000,
          easing: { kind: 'preset', name: 'linear' },
        },
      ],
    });

    const mid = evaluateShotCameraAtTime(shot, 500);
    expect(mid.target.z).toBeCloseTo(20, 2);

    const end = evaluateShotCameraAtTime(shot, 1000);
    expect(end.target.z).toBeCloseTo(50, 2);
  });

  it('8. Smoothly interpolates anchorZ defined directly on keyframe endpoints', () => {
    const shot = createDefaultShot({
      cameraBlocks: [
        {
          id: 'cam-anchor-z',
          label: 'Endpoint Depth',
          mode: 'dolly',
          fromFramingId: 'f1',
          toFramingId: 'f1',
          startMs: 0,
          durationMs: 1000,
          easing: { kind: 'preset', name: 'linear' },
          from: { anchorX: 0, anchorY: 0, anchorZ: -100, zoom: 1, tilt: 0, orbit: 0, roll: 0 },
          to: { anchorX: 0, anchorY: 0, anchorZ: 300, zoom: 1, tilt: 0, orbit: 0, roll: 0 },
        },
      ],
    });

    const mid = evaluateShotCameraAtTime(shot, 500);
    expect(mid.target.z).toBeCloseTo(100, 2);

    const end = evaluateShotCameraAtTime(shot, 1000);
    expect(end.target.z).toBe(300);
  });

  it('9. Smoothly interpolates focalLength and updates fovDegrees dynamically', () => {
    const shot = createDefaultShot({
      cameraBlocks: [
        {
          id: 'cam-lens-pull',
          label: 'Lens Focal Length Pull',
          mode: 'dolly',
          fromFramingId: 'f1',
          toFramingId: 'f1',
          startMs: 0,
          durationMs: 1000,
          easing: { kind: 'preset', name: 'linear' },
          from: { anchorX: 0, anchorY: 0, zoom: 1, tilt: 0, orbit: 0, roll: 0, focalLength: 24 },
          to: { anchorX: 0, anchorY: 0, zoom: 1, tilt: 0, orbit: 0, roll: 0, focalLength: 85 },
        },
      ],
    });

    const start = evaluateShotCameraAtTime(shot, 0);
    expect(start.focalLength).toBe(24);
    expect(start.fovDegrees).toBeGreaterThan(50); // ~53.1° wide lens

    const mid = evaluateShotCameraAtTime(shot, 500);
    expect(mid.focalLength).toBeCloseTo(54.5, 1);

    const end = evaluateShotCameraAtTime(shot, 1000);
    expect(end.focalLength).toBe(85);
    expect(end.fovDegrees).toBeLessThan(20); // ~16.1° portrait lens
  });

  it('10. Applies shake frequency multiplier to oscillation rate', () => {
    const createShakeShot = (frequency: number): Shot =>
      createDefaultShot({
        cameraBlocks: [
          {
            id: 'cam-shake',
            label: 'Handheld Shake',
            mode: 'dolly',
            fromFramingId: 'f1',
            toFramingId: 'f1',
            startMs: 0,
            durationMs: 2000,
            easing: { kind: 'preset', name: 'linear' },
            shake: { from: 50, to: 50, frequency },
            from: { anchorX: 0, anchorY: 0, zoom: 1, tilt: 0, orbit: 0, roll: 0 },
            to: { anchorX: 0, anchorY: 0, zoom: 1, tilt: 0, orbit: 0, roll: 0 },
          },
        ],
      });

    const shotNormal = createShakeShot(1.0);
    const shotFast = createShakeShot(2.5);

    const evalNormal = evaluateShotCameraAtTime(shotNormal, 250);
    const evalFast = evaluateShotCameraAtTime(shotFast, 250);

    // Fast frequency shifts phase/amplitude at t=250ms differently than 1.0x normal
    expect(evalNormal.target.x).not.toBe(0);
    expect(evalFast.target.x).not.toBe(0);
    expect(evalFast.target.x).not.toBeCloseTo(evalNormal.target.x, 3);
  });
});
