// src/stage/focusZoneOverlay.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { FocusZoneOverlay } from './FocusZoneOverlay';
import { useSelectionStore } from '../store/useSelectionStore';
import { createDefaultShot } from '../model/defaults';
import type { EvaluatedProjectFrame } from '../engine/evaluateShot';

// SSR uses Zustand's initial snapshot. Read real loaded state for rendering.
vi.mock('../store/useSelectionStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../store/useSelectionStore')>();
  const hook = (selector?: (state: ReturnType<typeof actual.useSelectionStore.getState>) => unknown) =>
    selector ? selector(actual.useSelectionStore.getState()) : actual.useSelectionStore.getState();
  return { ...actual, useSelectionStore: Object.assign(hook, actual.useSelectionStore) };
});

describe('FocusZoneOverlay Component', () => {
  beforeEach(() => {
    useSelectionStore.getState().setFocusZonePreview(false);
  });

  const createDummyFrame = (dofEnabled = true): EvaluatedProjectFrame => {
    const shot = createDefaultShot();
    shot.effects.depthOfField = {
      ...shot.effects.depthOfField,
      enabled: dofEnabled,
      focusDistance: 3.5,
      aperture: 1.8,
      bokehShape: 'anamorphic',
      target: { x: 0.5, y: -0.2, z: 2.0 },
    };
    return {
      activeShot: shot,
      camera: {
        position: { x: 0, y: 0, z: 5 },
        target: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        zoom: 1,
        focalLength: 50,
      } as any,
      layers: [],
    };
  };

  it('does not render when focusZonePreview is false', () => {
    useSelectionStore.getState().setFocusZonePreview(false);
    const frame = createDummyFrame(true);
    const html = renderToStaticMarkup(
      <FocusZoneOverlay frame={frame} frameWidth={1920} frameHeight={1080} />
    );
    expect(html).toBe('');
  });

  it('renders visual focus plane and HUD when focusZonePreview is true and DoF is enabled', () => {
    useSelectionStore.getState().setFocusZonePreview(true);
    const frame = createDummyFrame(true);
    const html = renderToStaticMarkup(
      <FocusZoneOverlay frame={frame} frameWidth={1920} frameHeight={1080} />
    );
    expect(html).toContain('data-testid="focus-zone-overlay"');
    expect(html).toContain('Focus Plane: 3.50m');
    expect(html).toContain('f/1.8');
    expect(html).toContain('Anamorphic');
    expect(html).toContain('Focus Target');
  });
});
