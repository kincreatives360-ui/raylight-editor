// src/engine/evaluateShot.test.ts
import { describe, it, expect } from 'vitest';
import { evaluateProjectAtTime } from './evaluateShot';
import {
  DEFAULT_PROJECT,
  createDefaultShot,
  createDefaultShapeLayer,
  createDefaultTextLayer,
} from '../model/defaults';
import type { Project, Shot } from '../model/types';

describe('evaluateProjectAtTime', () => {
  it('1. Computes active shot, local time, frame number, and progress across multi-shot project', () => {
    const shot1: Shot = createDefaultShot({
      id: 'shot-1',
      name: 'Intro',
      startMs: 0,
      durationMs: 3000,
    });

    const shot2: Shot = createDefaultShot({
      id: 'shot-2',
      name: 'Main Content',
      startMs: 3000,
      durationMs: 4000,
    });

    const project: Project = {
      ...DEFAULT_PROJECT,
      fps: 60,
      shots: [shot1, shot2],
    };

    // t=1500 (Midway into Shot 1)
    const frame1 = evaluateProjectAtTime(project, 1500);
    expect(frame1.activeShot.id).toBe('shot-1');
    expect(frame1.shotIndex).toBe(0);
    expect(frame1.shotLocalTimeMs).toBe(1500);
    expect(frame1.shotProgress).toBeCloseTo(0.5, 3);
    expect(frame1.frameNumber).toBe(90); // (1.5s * 60fps)

    // t=5000 (2000ms into Shot 2: 3000ms..7000ms)
    const frame2 = evaluateProjectAtTime(project, 5000);
    expect(frame2.activeShot.id).toBe('shot-2');
    expect(frame2.shotIndex).toBe(1);
    expect(frame2.shotLocalTimeMs).toBe(2000);
    expect(frame2.shotProgress).toBeCloseTo(0.5, 3);
    expect(frame2.frameNumber).toBe(300); // (5s * 60fps)
  });

  it('2. Evaluates group hierarchy: hiding a parent group hides child layers and nested groups', () => {
    const parentGroupId = 'grp-parent';
    const childGroupId = 'grp-child';

    const layer1 = createDefaultShapeLayer({
      id: 'l1',
      name: 'Parent Group Layer',
      groupId: parentGroupId,
      inMs: 0,
      outMs: 4000,
    });

    const layer2 = createDefaultTextLayer({
      id: 'l2',
      name: 'Child Group Layer',
      groupId: childGroupId,
      inMs: 0,
      outMs: 4000,
    });

    const layer3 = createDefaultShapeLayer({
      id: 'l3',
      name: 'Ungrouped Layer',
      inMs: 0,
      outMs: 4000,
    });

    const shot = createDefaultShot({
      layers: [layer1, layer2, layer3],
      groups: [
        {
          id: parentGroupId,
          name: 'Parent Group',
          hidden: true, // Parent is hidden
          collapsed: false,
          locked: false,
        },
        {
          id: childGroupId,
          name: 'Child Group',
          hidden: false, // Child marked visible, but parent is hidden
          parentGroupId,
          collapsed: false,
          locked: false,
        },
      ],
    });

    const project: Project = { ...DEFAULT_PROJECT, shots: [shot] };
    const frame = evaluateProjectAtTime(project, 1000);

    const evalL1 = frame.layers.find((l) => l.id === 'l1');
    const evalL2 = frame.layers.find((l) => l.id === 'l2');
    const evalL3 = frame.layers.find((l) => l.id === 'l3');

    // l1 and l2 must be hidden because parent group is hidden
    expect(evalL1?.visible).toBe(false);
    expect(evalL2?.visible).toBe(false);

    // Ungrouped layer remains visible
    expect(evalL3?.visible).toBe(true);
  });

  it('3. Computes depth of field blur and total blur per layer', () => {
    const layerSharp = createDefaultShapeLayer({
      id: 'l-sharp',
      position: { x: 0, y: 0, z: 0 },
      effects: { layerBlur: 0 },
      inMs: 0,
      outMs: 4000,
    });

    const layerBlurred = createDefaultShapeLayer({
      id: 'l-blurred',
      position: { x: 0, y: 0, z: 2.0 }, // Far out of focus
      effects: { layerBlur: 0.05 }, // 0.05 * 100 = 5px manual blur
      inMs: 0,
      outMs: 4000,
    });

    const shot = createDefaultShot({
      layers: [layerSharp, layerBlurred],
      effects: {
        ...DEFAULT_PROJECT.shots[0].effects,
        depthOfField: {
          enabled: true,
          target: { x: 0, y: 0, z: 0 },
          focusRange: 0.2,
          aperture: 2.8,
          bokehScale: 1.5,
          bokehShape: 'spherical',
        },
      },
    });

    const project: Project = { ...DEFAULT_PROJECT, shots: [shot] };
    const frame = evaluateProjectAtTime(project, 1000);

    const evalSharp = frame.layers.find((l) => l.id === 'l-sharp')!;
    const evalBlurred = frame.layers.find((l) => l.id === 'l-blurred')!;

    // Sharp layer at z=0 is inside focus range -> 0 DoF blur, 0 total blur
    expect(evalSharp.dofBlurPx).toBe(0);
    expect(evalSharp.totalBlurPx).toBe(0);

    // Blurred layer has both DoF blur and manual blur
    expect(evalBlurred.dofBlurPx).toBeGreaterThan(0);
    expect(evalBlurred.totalBlurPx).toBeGreaterThanOrEqual(evalBlurred.dofBlurPx + 5);
  });

  it('4. Evaluates animated effect blocks (e.g. bloom, vignette) on the timeline', () => {
    const shot = createDefaultShot({
      durationMs: 4000,
      effects: {
        ...DEFAULT_PROJECT.shots[0].effects,
        bloom: { enabled: false, intensity: 0, threshold: 0.8 },
      },
      effectBlocks: [
        {
          id: 'eb-bloom',
          label: 'Bloom Flash',
          effectKey: 'bloom',
          startMs: 1000,
          durationMs: 1000,
          fromValue: 0,
          toValue: 2.5,
          easing: { kind: 'preset', name: 'linear' },
        },
      ],
    });

    const project: Project = { ...DEFAULT_PROJECT, shots: [shot] };

    // Before effect block starts: t=500
    const before = evaluateProjectAtTime(project, 500);
    expect(before.activeShot.effects.bloom.intensity).toBe(0);

    // Halfway through effect block: t=1500
    const mid = evaluateProjectAtTime(project, 1500);
    expect(mid.activeShot.effects.bloom.enabled).toBe(true);
    expect(mid.activeShot.effects.bloom.intensity).toBeCloseTo(1.25, 2);

    // After effect block completes: t=2500
    const after = evaluateProjectAtTime(project, 2500);
    expect(after.activeShot.effects.bloom.intensity).toBe(2.5);
  });

  it('5. Evaluates shot-to-shot transitions and produces outgoingFrame', () => {
    const shot1: Shot = createDefaultShot({
      id: 'shot-1',
      startMs: 0,
      durationMs: 3000,
    });

    const shot2: Shot = createDefaultShot({
      id: 'shot-2',
      startMs: 3000,
      durationMs: 4000,
      transition: {
        type: 'crossfade',
        durationMs: 1000,
        easing: { kind: 'preset', name: 'linear' },
      },
    });

    const project: Project = { ...DEFAULT_PROJECT, shots: [shot1, shot2] };

    // t=3500 (500ms into 1000ms transition of Shot 2)
    const frame = evaluateProjectAtTime(project, 3500);
    expect(frame.shotTransition.isTransitioning).toBe(true);
    expect(frame.shotTransition.type).toBe('crossfade');
    expect(frame.shotTransition.progress).toBeCloseTo(0.5, 2);
    expect(frame.shotTransition.outgoingFrame).toBeDefined();
    expect(frame.shotTransition.outgoingFrame?.activeShot.id).toBe('shot-1');

    // t=4500 (> transition duration)
    const afterTrans = evaluateProjectAtTime(project, 4500);
    expect(afterTrans.shotTransition.isTransitioning).toBe(false);
    expect(afterTrans.shotTransition.outgoingFrame).toBeUndefined();
  });

  it('6. Edge cases: empty shots array, negative time, and missing properties do not crash', () => {
    const emptyProject: Project = {
      ...DEFAULT_PROJECT,
      shots: [],
    };

    // Should gracefully fall back to a default shot without throwing
    const frame = evaluateProjectAtTime(emptyProject, -500);
    expect(frame.shotIndex).toBe(0);
    expect(frame.shotLocalTimeMs).toBe(0);
    expect(frame.activeShot).toBeDefined();
    expect(Array.isArray(frame.layers)).toBe(true);
  });
});
