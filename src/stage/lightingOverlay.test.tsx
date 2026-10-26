import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LightingOverlay } from './LightingOverlay';
import { useSelectionStore } from '../store/useSelectionStore';
import { useProjectStore } from '../store/useProjectStore';
import { createDefaultProject, createDefaultShot } from '../model/defaults';
import { evaluateProjectAtTime, type EvaluatedProjectFrame } from '../engine/evaluateShot';

// SSR uses Zustand's initial snapshot. Read real loaded state for rendering.
vi.mock('../store/useProjectStore', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../store/useProjectStore')>();
    const hook = (selector?: (state: ReturnType<typeof actual.useProjectStore.getState>) => unknown) =>
        selector ? selector(actual.useProjectStore.getState()) : actual.useProjectStore.getState();
    return { ...actual, useProjectStore: Object.assign(hook, actual.useProjectStore) };
});

vi.mock('../store/useSelectionStore', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../store/useSelectionStore')>();
    const hook = (selector?: (state: ReturnType<typeof actual.useSelectionStore.getState>) => unknown) =>
        selector ? selector(actual.useSelectionStore.getState()) : actual.useSelectionStore.getState();
    return { ...actual, useSelectionStore: Object.assign(hook, actual.useSelectionStore) };
});

describe('LightingOverlay Component', () => {
    beforeEach(() => {
        const project = createDefaultProject();
        const shot = createDefaultShot({ id: 'shot-1' });
        shot.light = {
            position: { x: -0.28, y: 0.36, z: 0.9 },
            intensity: 1.2,
            temperature: 6100,
            ambience: 0.45,
            showGizmos: true,
            sources: [
                {
                    id: 'spot-1',
                    name: 'Spot 1',
                    type: 'spot',
                    enabled: true,
                    position: { x: 0.2, y: 0.4, z: 1.2 },
                    target: { x: 0, y: 0, z: 0 },
                    intensity: 1.5,
                    color: '#ffffff',
                    angle: Math.PI / 6,
                    penumbra: 0.2,
                },
                {
                    id: 'area-1',
                    name: 'Area 1',
                    type: 'area',
                    enabled: true,
                    position: { x: -0.5, y: 0.2, z: 0.8 },
                    target: { x: 0, y: 0, z: 0 },
                    intensity: 1.0,
                    color: '#ffeedd',
                    width: 2.5,
                    height: 2.0,
                },
                {
                    id: 'point-1',
                    name: 'Point 1',
                    type: 'point',
                    enabled: true,
                    position: { x: 0, y: 0.3, z: 0.5 },
                    intensity: 0.8,
                    color: '#ffffff',
                    distance: 4,
                },
            ],
        };
        project.shots = [shot];
        useProjectStore.getState().loadProjectJson(project);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        useSelectionStore.getState().selectLight(null);
    });

    const createDummyFrame = (): EvaluatedProjectFrame => {
        return evaluateProjectAtTime(useProjectStore.getState().project, 0);
    };

    it('renders unselected light badges when gizmos are enabled', () => {
        useSelectionStore.getState().selectLight(null);
        const frame = createDummyFrame();
        const html = renderToStaticMarkup(
            <LightingOverlay frame={frame} frameWidth={1920} frameHeight={1080} />
        );

        expect(html).toContain('data-testid="light-handle-sun-key"');
        expect(html).toContain('data-testid="light-handle-spot-1"');
        expect(html).toContain('data-testid="light-handle-area-1"');
        expect(html).toContain('data-testid="light-handle-point-1"');
    });

    it('renders selected sun light source and target handles with dashed line', () => {
        useSelectionStore.getState().selectLight('sun-key');
        const frame = createDummyFrame();
        const html = renderToStaticMarkup(
            <LightingOverlay frame={frame} frameWidth={1920} frameHeight={1080} />
        );

        expect(html).toContain('data-testid="selected-light-source-handle"');
        expect(html).toContain('data-testid="selected-light-target-handle"');
        expect(html).toContain('stroke-dasharray');
    });

    it('renders spot light cone overlay and cone angle handle when spot is selected', () => {
        useSelectionStore.getState().selectLight('spot-1');
        const frame = createDummyFrame();
        const html = renderToStaticMarkup(
            <LightingOverlay frame={frame} frameWidth={1920} frameHeight={1080} />
        );

        expect(html).toContain('data-testid="selected-light-source-handle"');
        expect(html).toContain('data-testid="selected-light-target-handle"');
        expect(html).toContain('data-testid="spot-cone-handle"');
    });

    it('renders area light rectangle outline and resize handle when area is selected', () => {
        useSelectionStore.getState().selectLight('area-1');
        const frame = createDummyFrame();
        const html = renderToStaticMarkup(
            <LightingOverlay frame={frame} frameWidth={1920} frameHeight={1080} />
        );

        expect(html).toContain('data-testid="selected-light-source-handle"');
        expect(html).toContain('data-testid="area-resize-handle"');
    });

    it('renders point light reach circle and perimeter handle when point is selected', () => {
        useSelectionStore.getState().selectLight('point-1');
        const frame = createDummyFrame();
        const html = renderToStaticMarkup(
            <LightingOverlay frame={frame} frameWidth={1920} frameHeight={1080} />
        );

        expect(html).toContain('data-testid="selected-light-source-handle"');
        expect(html).toContain('data-testid="point-reach-handle"');
    });

    it('renders selected light depth handle and ground projection drop-line and shadow ellipse', () => {
        useSelectionStore.getState().selectLight('sun-key');
        const frame = createDummyFrame();
        const html = renderToStaticMarkup(
            <LightingOverlay frame={frame} frameWidth={1920} frameHeight={1080} />
        );

        expect(html).toContain('data-testid="selected-light-depth-handle"');
        expect(html).toContain('data-testid="selected-light-ground-projection"');
        expect(html).toContain('↕Z');
    });
});
