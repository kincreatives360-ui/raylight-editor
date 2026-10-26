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

describe('SceneEffectsSection Inspector UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all 10 scene effect accordions even with undefined effectsOrder', () => {
    const shot = createDefaultShot();
    // Simulate legacy project with no effectsOrder
    // @ts-expect-error Testing legacy undefined
    shot.effectsOrder = undefined;

    const html = renderToStaticMarkup(<SceneEffectsSection shot={shot} />);

    expect(html).toContain('Scene Effects');
    expect(html).toContain('Depth of Field');
    expect(html).toContain('Bloom');
    expect(html).toContain('Vignette');
    expect(html).toContain('Motion Blur');
    expect(html).toContain('Chromatic Aberration');
    expect(html).toContain('Film Grain');
    expect(html).toContain('Ghost');
    expect(html).toContain('Color Grade');
    expect(html).toContain('Edge Fade');
    expect(html).toContain('Glitch');
  });

  it('renders reorder buttons with disabled states for boundary items', () => {
    const shot = createDefaultShot();
    const html = renderToStaticMarkup(<SceneEffectsSection shot={shot} />);

    // First item cannot move earlier (should have disabled attribute)
    const firstMoveEarlier = html.match(/aria-label="Move Depth of Field earlier"[^>]*disabled/);
    expect(firstMoveEarlier).not.toBeNull();

    // Last item cannot move later (should have disabled attribute)
    const lastMoveLater = html.match(/aria-label="Move Glitch later"[^>]*disabled/);
    expect(lastMoveLater).not.toBeNull();
  });

  it('renders scrub inputs for color grade temperature and tint', () => {
    const shot = createDefaultShot();
    const html = renderToStaticMarkup(<SceneEffectsSection shot={shot} />);

    expect(html).toContain('Temperature');
    expect(html).toContain('Tint');
    expect(html).toContain('Exposure');
    expect(html).toContain('Contrast');
    expect(html).toContain('Saturation');
  });

  it('renders bokeh shape options for depth of field', () => {
    const shot = createDefaultShot();
    const html = renderToStaticMarkup(<SceneEffectsSection shot={shot} />);

    expect(html).toContain('Bokeh Shape');
    expect(html).toContain('Anamorphic');
    expect(html).toContain('Spherical');
    expect(html).toContain('Vintage');
    expect(html).toContain('Portrait');
  });

  it('safely handles legacy shots with partial or missing depthOfField properties', () => {
    const shot = createDefaultShot();
    // @ts-expect-error Simulating legacy shot with missing target & bokehShape
    shot.effects.depthOfField = { enabled: true };

    const html = renderToStaticMarkup(<SceneEffectsSection shot={shot} />);
    expect(html).toContain('Focus Z');
    expect(html).toContain('Bokeh Shape');
  });
});
