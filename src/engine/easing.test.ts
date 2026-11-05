// src/engine/easing.test.ts
import { describe, it, expect } from 'vitest';
import { evaluateEasing, evaluateSpring, ALL_18_EASINGS } from './easing';
import { easingFromSelection } from '../model/easingSelection';

describe('Easing & Spring Engine', () => {
  it('includes all 18 easing functions and spring presets', () => {
    const ids = ALL_18_EASINGS.map((e) => e.id);
    expect(ids).toContain('spring:gentle');
    expect(ids).toContain('spring:bouncy');
    expect(ids).toContain('spring:snappy');
    expect(ids).toContain('preset:linear');
    expect(ids).toContain('bezier:cinematic');
    expect(ids).toContain('bezier:whip');
    expect(ids).not.toContain('bezier: whip');
    expect(easingFromSelection('bezier:whip')).toEqual({
      kind: 'bezier',
      x1: 0.6,
      y1: -0.28,
      x2: 0.74,
      y2: 0.05,
    });
    expect(easingFromSelection('bezier: whip')).toEqual({
      kind: 'bezier',
      x1: 0.6,
      y1: -0.28,
      x2: 0.74,
      y2: 0.05,
    });
  });

  it('clamps evaluateEasing boundaries t=0 and t=1 correctly', () => {
    expect(evaluateEasing(0, { kind: 'preset', name: 'linear' })).toBe(0);
    expect(evaluateEasing(1, { kind: 'preset', name: 'linear' })).toBe(1);
    expect(evaluateEasing(0, { kind: 'preset', name: 'ease-in-out' })).toBe(0);
    expect(evaluateEasing(1, { kind: 'preset', name: 'ease-in-out' })).toBe(1);
  });

  it('evaluates spring physics accurately', () => {
    // At t=0, spring should start at 0
    const startVal = evaluateSpring('gentle', 0, { stiffness: 100, damping: 10, mass: 1 });
    expect(startVal).toBeCloseTo(0, 5);

    // At t=1, spring should settle to 1
    const endVal = evaluateSpring('gentle', 1, { stiffness: 200, damping: 25, mass: 1 });
    expect(endVal).toBe(1);

    // Mid-flight value between 0 and 1.5
    const midVal = evaluateSpring('bouncy', 0.5);
    expect(midVal).toBeGreaterThan(0.5);
    expect(midVal).toBeLessThan(1.5);

    // Critically damped springs ('gentle', 'slow', 'stiff') never overshoot 1.0
    for (const preset of ['gentle', 'slow', 'stiff'] as const) {
      for (let i = 1; i < 20; i++) {
        const sample = evaluateSpring(preset, i / 20);
        expect(sample).toBeGreaterThanOrEqual(0);
        expect(sample).toBeLessThanOrEqual(1);
      }
    }
  });

  it('supports custom cubic-bezier evaluation strings', () => {
    const bezierResult = evaluateEasing(0.5, {
      kind: 'bezier',
      x1: 0.25,
      y1: 0.1,
      x2: 0.25,
      y2: 1.0,
    });
    expect(bezierResult).toBeGreaterThan(0);
    expect(bezierResult).toBeLessThan(1);
  });
});
