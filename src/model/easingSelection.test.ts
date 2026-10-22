import { describe, expect, it } from 'vitest';
import { easingFromSelection } from './easingSelection';

describe('easingFromSelection', () => {
  it.each([
    ['preset:linear', { kind: 'preset', name: 'linear' }],
    ['preset:ease', { kind: 'preset', name: 'ease' }],
    ['preset:ease-in', { kind: 'preset', name: 'ease-in' }],
    ['preset:ease-out', { kind: 'preset', name: 'ease-out' }],
    ['preset:ease-in-out', { kind: 'preset', name: 'ease-in-out' }],
    ['preset:ease-in-quad', { kind: 'preset', name: 'ease-in-quad' }],
    ['preset:ease-out-quad', { kind: 'preset', name: 'ease-out-quad' }],
    ['preset:ease-in-out-quad', { kind: 'preset', name: 'ease-in-out-quad' }],
    ['preset:ease-in-cubic', { kind: 'preset', name: 'ease-in-cubic' }],
    ['preset:ease-out-cubic', { kind: 'preset', name: 'ease-out-cubic' }],
    ['preset:ease-in-out-cubic', { kind: 'preset', name: 'ease-in-out-cubic' }],
    ['preset:ease-in-back', { kind: 'preset', name: 'ease-in-back' }],
    ['preset:ease-out-back', { kind: 'preset', name: 'ease-out-back' }],
    ['preset:ease-in-out-back', { kind: 'preset', name: 'ease-in-out-back' }],
    ['preset:ease-in-expo', { kind: 'preset', name: 'ease-in-expo' }],
    ['preset:ease-out-expo', { kind: 'preset', name: 'ease-out-expo' }],
    ['preset:bounce', { kind: 'preset', name: 'bounce' }],
    ['preset:hold', { kind: 'preset', name: 'hold' }],
    ['spring:gentle', { kind: 'spring', name: 'gentle' }],
    ['spring:quick', { kind: 'spring', name: 'quick' }],
    ['spring:bouncy', { kind: 'spring', name: 'bouncy' }],
    ['spring:slow', { kind: 'spring', name: 'slow' }],
    ['spring:snappy', { kind: 'spring', name: 'snappy' }],
    ['spring:stiff', { kind: 'spring', name: 'stiff' }],
  ] as const)('maps %s to the existing easing model', (selection, expected) => {
    expect(easingFromSelection(selection)).toEqual(expected);
  });

  it('preserves the caller-specific custom Bezier defaults', () => {
    expect(easingFromSelection('bezier', { x1: 0.16, y1: 1, x2: 0.3, y2: 1 })).toEqual({
      kind: 'bezier', x1: 0.16, y1: 1, x2: 0.3, y2: 1,
    });
  });
});
