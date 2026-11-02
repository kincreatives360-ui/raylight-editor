import { describe, expect, it } from 'vitest';
import { createDefaultShot } from '../../../model/defaults';

async function loadActions() {
  try {
    return await import('./dofAnimationActions');
  } catch (error) {
    if (error instanceof Error
      && error.message.startsWith('Cannot find module')
      && error.message.includes('dofAnimationActions')) {
      return null;
    }
    throw error;
  }
}

describe('DOF animation actions', () => {
  it('creates an 800 ms focus block from the evaluated local-time depth', async () => {
    const actions = await loadActions();
    expect(actions?.createDofFocusBlock).toBeTypeOf('function');
    if (!actions) return;

    const shot = createDefaultShot({
      startMs: 1000,
      durationMs: 3000,
      focusBlocks: [{
        id: 'existing-focus',
        startMs: 0,
        durationMs: 1000,
        fromZ: 0.1,
        toZ: 0.5,
        easing: { kind: 'preset', name: 'linear' },
      }],
    });

    const block = actions.createDofFocusBlock(shot, 1500, 0.9);

    expect(block.id).toBeTruthy();
    expect(block.label).toBe('Animate focus');
    expect(block.startMs).toBe(500);
    expect(block.durationMs).toBe(800);
    expect(block.fromZ).toBeCloseTo(0.3);
    expect(block.toZ).toBe(0.9);
    expect(block.easing).toEqual({ kind: 'preset', name: 'ease-in-out' });
  });

  it('creates an 800 ms blur block from zero to the authored bokeh scale', async () => {
    const actions = await loadActions();
    expect(actions?.createDofBlurBlock).toBeTypeOf('function');
    if (!actions) return;

    const shot = createDefaultShot({ startMs: 1000, durationMs: 3000 });
    const block = actions.createDofBlurBlock(shot, 1500, 4.5);

    expect(block.id).toBeTruthy();
    expect(block.label).toBe('Animate blur');
    expect(block.effectKey).toBe('depthOfField');
    expect(block.parameter).toBe('blur');
    expect(block.startMs).toBe(500);
    expect(block.durationMs).toBe(800);
    expect(block.fromValue).toBe(0);
    expect(block.toValue).toBe(4.5);
    expect(block.easing).toEqual({ kind: 'preset', name: 'ease-in-out' });
  });

  it('uses the default point depth when animating focus from a legacy shot without a target', async () => {
    const actions = await loadActions();
    expect(actions?.createDofFocusBlock).toBeTypeOf('function');
    if (!actions) return;

    const shot = createDefaultShot();
    // @ts-expect-error Simulate older project data missing the DOF target.
    shot.effects.depthOfField = { enabled: true };

    const block = actions.createDofFocusBlock(shot, 500, 1);
    expect(block.fromZ).toBe(0);
    expect(block.toZ).toBe(1);
  });
});
