// src/stage/focusZoneOverlay.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { FocusZoneOverlay } from './FocusZoneOverlay';
import { useSelectionStore } from '../store/useSelectionStore';
import { createDefaultProject, createDefaultShot } from '../model/defaults';
import { evaluateProjectAtTime, type EvaluatedProjectFrame } from '../engine/evaluateShot';

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
    const project = createDefaultProject();
    const shot = createDefaultShot();
    shot.effects.depthOfField = {
      ...shot.effects.depthOfField,
      enabled: dofEnabled,
      focusDistance: 3.5,
      aperture: 1.8,
      bokehShape: 'anamorphic',
      target: { x: 0.5, y: -0.2, z: 2.0 },
    };
    project.shots = [shot];
    return evaluateProjectAtTime(project, 0);
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
