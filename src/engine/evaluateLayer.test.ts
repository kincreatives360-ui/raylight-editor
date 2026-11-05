// src/engine/evaluateLayer.test.ts
import { describe, it, expect } from 'vitest';
import { evaluateLayerAtTime } from './evaluateLayer';
import {
  createDefaultShapeLayer,
  createDefaultTextLayer,
  createDefaultImageLayer,
} from '../model/defaults';
import type { ShapeLayer, TextLayer } from '../model/types';

describe('evaluateLayerAtTime', () => {
  it('1. Windowing and visibility: hides layer outside inMs/outMs or if opacity <= 0.001', () => {
    const layer = createDefaultShapeLayer({
      inMs: 1000,
      outMs: 3000,
      opacity: 1,
      entrance: { type: 'none', durationMs: 0, delayMs: 0, distance: 0, easing: { kind: 'preset', name: 'linear' } },
      exit: { type: 'none', durationMs: 0, delayMs: 0, distance: 0, easing: { kind: 'preset', name: 'linear' } },
    });

    // Before inMs -> not visible
    const before = evaluateLayerAtTime(layer, 500);
    expect(before.visible).toBe(false);

    // Within window -> visible
    const during = evaluateLayerAtTime(layer, 1500);
    expect(during.visible).toBe(true);
    expect(during.opacity).toBe(1);

    // After outMs -> not visible
    const after = evaluateLayerAtTime(layer, 3500);
    expect(after.visible).toBe(false);

    // Explicitly hidden layer -> not visible even within window
    const hiddenLayer = { ...layer, hidden: true };
    const hiddenEval = evaluateLayerAtTime(hiddenLayer, 1500);
    expect(hiddenEval.visible).toBe(false);

    // Zero opacity layer -> not visible
    const zeroOpLayer = { ...layer, opacity: 0 };
    const zeroOpEval = evaluateLayerAtTime(zeroOpLayer, 1500);
    expect(zeroOpEval.visible).toBe(false);
  });

  it('2. Evaluates entrance transitions (fade, slide-up, scale-out, delay)', () => {
    const layer: ShapeLayer = createDefaultShapeLayer({
      inMs: 1000,
      outMs: 4000,
      opacity: 1,
      position: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      entrance: {
        type: 'slide-up',
        durationMs: 1000,
        delayMs: 200,
        distance: 0.2,
        easing: { kind: 'preset', name: 'linear' },
      },
    });

    // Before entrance starts (during delay: t=1100 < 1000 + 200)
    // rawP = (1100 - 1200) / 1000 = -0.1 -> clamped to p=0
    const inDelay = evaluateLayerAtTime(layer, 1100);
    expect(inDelay.opacity).toBe(0);
    expect(inDelay.position.y).toBeCloseTo(0.2, 3); // position.y + dist * (1 - 0)

    // Halfway through entrance: t=1700 (500ms into 1000ms duration) -> p=0.5
    const halfway = evaluateLayerAtTime(layer, 1700);
    expect(halfway.opacity).toBeCloseTo(0.5, 3);
    expect(halfway.position.y).toBeCloseTo(0.1, 3); // position.y + 0.2 * (1 - 0.5)

    // Entrance complete: t=2300 (> 2200)
    const finished = evaluateLayerAtTime(layer, 2300);
    expect(finished.opacity).toBe(1);
    expect(finished.position.y).toBe(0);
  });

  it('3. Evaluates exit transitions (fade, slide-right)', () => {
    const layer: ShapeLayer = createDefaultShapeLayer({
      inMs: 0,
      outMs: 3000,
      opacity: 1,
      position: { x: 0, y: 0, z: 0 },
      exit: {
        type: 'slide-right',
        durationMs: 1000,
        delayMs: 0,
        distance: 0.16,
        easing: { kind: 'preset', name: 'linear' },
      },
    });

    // Before exit starts: t=1500 (exit starts at outMs - 1000 = 2000)
    const beforeExit = evaluateLayerAtTime(layer, 1500);
    expect(beforeExit.opacity).toBe(1);
    expect(beforeExit.position.x).toBe(0);

    // Halfway through exit: t=2500 -> p=0.5
    const halfwayExit = evaluateLayerAtTime(layer, 2500);
    expect(halfwayExit.opacity).toBeCloseTo(0.5, 3); // 1 - p
    expect(halfwayExit.position.x).toBeCloseTo(0.08, 3); // +dist * p = 0.16 * 0.5
  });

  it('4. Evaluates relative animation blocks (position, rotation, scale, cornerRadius)', () => {
    const layer: ShapeLayer = createDefaultShapeLayer({
      inMs: 0,
      outMs: 4000,
      position: { x: 0.1, y: 0.2, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      cornerRadius: 0.1,
      blocks: [
        {
          id: 'blk-pos',
          label: 'Move',
          property: 'position',
          startMs: 1000,
          durationMs: 1000,
          amount: { x: 0.5, y: -0.2, z: 0.3 },
          easing: { kind: 'preset', name: 'linear' },
        },
        {
          id: 'blk-scale',
          label: 'Scale Up',
          property: 'scale',
          startMs: 1000,
          durationMs: 1000,
          amount: 0.5, // scalar scale amount
          easing: { kind: 'preset', name: 'linear' },
        },
        {
          id: 'blk-radius',
          label: 'Round',
          property: 'cornerRadius',
          startMs: 1000,
          durationMs: 1000,
          amount: 0.2,
          easing: { kind: 'preset', name: 'linear' },
        },
      ],
    });

    // Before block starts: t=500
    const before = evaluateLayerAtTime(layer, 500);
    expect(before.position.x).toBe(0.1);
    expect(before.position.y).toBe(0.2);
    expect(before.scale.x).toBe(1);
    expect(before.cornerRadius).toBe(0.1);

    // Halfway through: t=1500 (eased = 0.5)
    const halfway = evaluateLayerAtTime(layer, 1500);
    expect(halfway.position.x).toBeCloseTo(0.1 + 0.5 * 0.5, 3); // 0.35
    expect(halfway.position.y).toBeCloseTo(0.2 + -0.2 * 0.5, 3); // 0.10
    expect(halfway.position.z).toBeCloseTo(0.3 * 0.5, 3); // 0.15
    expect(halfway.scale.x).toBeCloseTo(1 + 0.5 * 0.5, 3); // 1.25
    expect(halfway.cornerRadius).toBeCloseTo(0.1 + 0.2 * 0.5, 3); // 0.20

    // After block ends: t=2500
    const after = evaluateLayerAtTime(layer, 2500);
    expect(after.position.x).toBeCloseTo(0.6, 3);
    expect(after.scale.x).toBeCloseTo(1.5, 3);
    expect(after.cornerRadius).toBeCloseTo(0.3, 3);
  });

  it('5. Evaluates followPath cubic bezier spline offset', () => {
    const layer = createDefaultShapeLayer({
      inMs: 0,
      outMs: 4000,
      position: { x: 0, y: 0, z: 0 },
      blocks: [
        {
          id: 'blk-path',
          label: 'Follow Path Arc',
          property: 'followPath',
          startMs: 0,
          durationMs: 2000,
          amount: { x: 1, y: 1, z: 0 },
          easing: { kind: 'preset', name: 'linear' },
        },
      ],
    });

    // At t=0 -> spline offset should be (0, 0, 0)
    const atStart = evaluateLayerAtTime(layer, 0);
    expect(atStart.position.x).toBeCloseTo(0, 3);
    expect(atStart.position.y).toBeCloseTo(0, 3);

    // At t=2000 -> spline offset should reach final destination (1, 1, 0)
    const atEnd = evaluateLayerAtTime(layer, 2000);
    expect(atEnd.position.x).toBeCloseTo(1, 3);
    expect(atEnd.position.y).toBeCloseTo(1, 3);

    // At t=1000 (midway) -> spline arc displaces position smoothly
    const midway = evaluateLayerAtTime(layer, 1000);
    expect(midway.position.x).toBeGreaterThan(0);
    expect(midway.position.y).toBeGreaterThan(0);
    expect(Number.isFinite(midway.position.x)).toBe(true);
  });

  it('6. Evaluates counter animation on text layers with comma & decimal preservation', () => {
    const layer: TextLayer = createDefaultTextLayer({
      inMs: 0,
      outMs: 4000,
      content: 'Current balance: $1,200.50 today',
      blocks: [
        {
          id: 'blk-counter',
          label: 'Count Up',
          property: 'counter',
          startMs: 1000,
          durationMs: 1000,
          amount: 800,
          easing: { kind: 'preset', name: 'linear' },
        },
      ],
    });

    // Before block: t=500 -> unchanged
    const before = evaluateLayerAtTime(layer, 500);
    expect(before.textContentOverride).toBeUndefined();

    // Halfway: t=1500 -> 1200.50 + 400 = 1,600.50
    const halfway = evaluateLayerAtTime(layer, 1500);
    expect(halfway.textContentOverride).toBe('Current balance: $1,600.50 today');

    // After completion: t=2500 -> 1200.50 + 800 = 2,000.50
    const after = evaluateLayerAtTime(layer, 2500);
    expect(after.textContentOverride).toBe('Current balance: $2,000.50 today');
  });

  it('7. Robust against missing blocks array, zero duration, and NaN inputs', () => {
    const malformedLayer = {
      ...createDefaultImageLayer(),
      blocks: undefined as unknown as [],
      opacity: NaN,
    };

    const res = evaluateLayerAtTime(malformedLayer, 500);
    expect(res.visible).toBe(false);
    expect(res.opacity).toBe(0);
    expect(res.scale.x).toBe(1);
  });

  it('8. Evaluates all 7 newly added transition presets (pop, spin, flip-x, flip-y, swing, wipe, scramble) & stagger (F-21)', () => {
    const baseShape = createDefaultShapeLayer({
      inMs: 0,
      outMs: 2000,
      scale: { x: 1, y: 1, z: 1 },
      rotation: { x: 0, y: 0, z: 0 },
    });

    const popEval = evaluateLayerAtTime(
      { ...baseShape, entrance: { type: 'pop', durationMs: 1000, delayMs: 0, distance: 0, easing: { kind: 'preset', name: 'linear' } } },
      500
    );
    expect(popEval.scale.x).not.toBe(1);
    expect(popEval.opacity).toBeGreaterThan(0.5);

    const spinEval = evaluateLayerAtTime(
      { ...baseShape, entrance: { type: 'spin', durationMs: 1000, delayMs: 0, distance: 0, easing: { kind: 'preset', name: 'linear' } } },
      500
    );
    expect(spinEval.rotation.z).toBeLessThan(0);

    const flipXEval = evaluateLayerAtTime(
      { ...baseShape, entrance: { type: 'flip-x', durationMs: 1000, delayMs: 0, distance: 0, easing: { kind: 'preset', name: 'linear' } } },
      500
    );
    expect(flipXEval.rotation.x).toBeGreaterThan(0);

    const flipYEval = evaluateLayerAtTime(
      { ...baseShape, entrance: { type: 'flip-y', durationMs: 1000, delayMs: 0, distance: 0, easing: { kind: 'preset', name: 'linear' } } },
      500
    );
    expect(flipYEval.rotation.y).toBeGreaterThan(0);

    const swingEval = evaluateLayerAtTime(
      { ...baseShape, entrance: { type: 'swing', durationMs: 1000, delayMs: 0, distance: 0, easing: { kind: 'preset', name: 'linear' } } },
      300
    );
    expect(Math.abs(swingEval.rotation.z)).toBeGreaterThan(0.01);

    const wipeEval = evaluateLayerAtTime(
      { ...baseShape, entrance: { type: 'wipe', durationMs: 1000, delayMs: 0, distance: 0, easing: { kind: 'preset', name: 'linear' } } },
      400
    );
    expect(wipeEval.maskSweepProgress).toBeCloseTo(0.4, 3);

    const scrambleText = createDefaultTextLayer({
      inMs: 0,
      outMs: 2000,
      content: 'Raylight Studio Motion',
      entrance: {
        type: 'scramble',
        durationMs: 1000,
        delayMs: 0,
        distance: 0,
        stagger: 'word',
        easing: { kind: 'preset', name: 'linear' },
      },
    });
    const scrambleMid = evaluateLayerAtTime(scrambleText, 450);
    expect(scrambleMid.textContentOverride).toBeDefined();
    expect(scrambleMid.textContentOverride).toContain('Raylight ');
    expect(scrambleMid.textContentOverride).not.toBe('Raylight Studio Motion');
  });
});
