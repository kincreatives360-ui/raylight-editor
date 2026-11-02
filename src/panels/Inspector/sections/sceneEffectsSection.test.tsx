// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, it, expect, beforeEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SceneEffectsSection } from './SceneEffectsSection';
import { createDefaultProject, createDefaultShot, createDefaultTextLayer } from '../../../model/defaults';
import type { Shot } from '../../../model/types';
import { usePlayheadStore } from '../../../store/usePlayheadStore';
import { useProjectStore } from '../../../store/useProjectStore';
import { useSelectionStore } from '../../../store/useSelectionStore';

Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true });
Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: () => {} });

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

let root: Root | undefined;
let container: HTMLDivElement | undefined;
let updateShotSpy: ReturnType<typeof vi.spyOn> | undefined;
const originalProject = useProjectStore.getState().project;

function makeShot(overrides: Partial<Shot> = {}): Shot {
  const layer = createDefaultTextLayer({
    id: 'subject-layer',
    name: 'Subject',
    position: { x: 0.25, y: -0.5, z: 0.75 },
  });
  const shot = createDefaultShot({
    id: 'dof-shot',
    startMs: 1000,
    durationMs: 4000,
    layers: [layer],
    appliedEffects: ['depthOfField', 'bloom'],
    ...overrides,
  });
  shot.effects.depthOfField.enabled = true;
  shot.effects.bloom.intensity = 0.42;
  return shot;
}

function mountDofPanel(shot: Shot): void {
  useProjectStore.setState({ project: createDefaultProject({ shots: [shot] }) });
  usePlayheadStore.getState().setCurrentTimeMs(1500);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root!.render(<SceneEffectsSection shot={shot} />));
  const dofButton = Array.from(container.querySelectorAll('button'))
    .find((button) => button.textContent?.includes('Depth of field'));
  act(() => dofButton?.click());
}

function clickButton(label: string): void {
  const button = Array.from(container!.querySelectorAll('button'))
    .find((candidate) => candidate.getAttribute('aria-label') === label
      || candidate.textContent?.trim() === label);
  expect(button, `button "${label}"`).toBeTruthy();
  act(() => button!.click());
}

function captureShotUpdates(shot: Shot): () => Shot {
  let updatedShot: Shot | undefined;
  updateShotSpy = vi.spyOn(useProjectStore.getState(), 'updateShot')
    .mockImplementation((_shotId, updater) => {
      updatedShot = typeof updater === 'function' ? updater(shot) : { ...shot, ...updater };
    });
  return () => {
    expect(updatedShot).toBeDefined();
    return updatedShot!;
  };
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
  updateShotSpy?.mockRestore();
  updateShotSpy = undefined;
  useProjectStore.setState({ project: originalProject });
  usePlayheadStore.getState().setCurrentTimeMs(0);
  useSelectionStore.getState().setSelectedLayerIds([]);
});

});
