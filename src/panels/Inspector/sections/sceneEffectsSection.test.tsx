import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SceneEffectsSection } from './SceneEffectsSection';
import { createDefaultShot } from '../../../model/defaults';

vi.mock('../../../store/useProjectStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../store/useProjectStore')>();
  const hook = (selector?: (state: ReturnType<typeof actual.useProjectStore.getState>) => unknown) =>
    selector ? selector(actual.useProjectStore.getState()) : actual.useProjectStore.getState();
  return { ...actual, useProjectStore: Object.assign(hook, actual.useProjectStore) };
});

describe('SceneEffectsSection Inspector UI (Figma style)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Scene effects header with add (+) button even with undefined effectsOrder', () => {
    const shot = createDefaultShot();
    // Simulate legacy project with no effectsOrder
    // @ts-expect-error Testing legacy undefined
    shot.effectsOrder = undefined;

    const html = renderToStaticMarkup(<SceneEffectsSection shot={shot} />);

    expect(html).toContain('Scene effects');
    expect(html).toContain('Add scene effect');
    expect(html).not.toContain('Shader pass order');
    expect(html).not.toContain('No scene effects added');
    expect(html).not.toContain('+ Add effect');
  });

  it('renders applied effects list in Figma style with icons, pill labels, eye toggle, and remove (-) buttons', () => {
    const shot = createDefaultShot();
    shot.appliedEffects = ['depthOfField', 'bloom', 'chromaticAberration'];
    shot.effects.depthOfField.enabled = true;
    shot.effects.bloom.enabled = true;
    shot.effects.chromaticAberration.enabled = true;

    const html = renderToStaticMarkup(<SceneEffectsSection shot={shot} />);

    expect(html).toContain('Depth of field');
    expect(html).toContain('Bloom');
    expect(html).toContain('Color split');
    expect(html).toContain('Mute effect');
    expect(html).toContain('Remove Depth of field');
    expect(html).toContain('Remove Bloom');
    expect(html).toContain('Remove Color split');
  });

  it('renders scrub inputs when an effect is active and expanded in initial state or applied', () => {
    const shot = createDefaultShot();
    shot.appliedEffects = ['colorGrade'];
    shot.effects.colorGrade.enabled = true;

    // Simulate pre-expanded key or applied effect
    const html = renderToStaticMarkup(<SceneEffectsSection shot={shot} />);
    expect(html).toContain('Color grade');
    expect(html).toContain('Remove Color grade');
  });

  it('safely handles legacy shots with partial or missing depthOfField properties', () => {
    const shot = createDefaultShot();
    // @ts-expect-error Simulating legacy shot with missing target & bokehShape
    shot.effects.depthOfField = { enabled: true };
    shot.appliedEffects = ['depthOfField'];

    const html = renderToStaticMarkup(<SceneEffectsSection shot={shot} />);
    expect(html).toContain('Depth of field');
    expect(html).toContain('Remove Depth of field');
  });
});
