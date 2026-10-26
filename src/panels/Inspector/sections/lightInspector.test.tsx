import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LightInspector } from './LightInspector';
import { RightSidebar } from '../RightSidebar';
import { useSelectionStore } from '../../../store/useSelectionStore';
import { useProjectStore } from '../../../store/useProjectStore';
import { createDefaultProject, createDefaultShot } from '../../../model/defaults';

vi.mock('../../../store/useProjectStore', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../store/useProjectStore')>();
    const hook = (selector?: (state: ReturnType<typeof actual.useProjectStore.getState>) => unknown) =>
        selector ? selector(actual.useProjectStore.getState()) : actual.useProjectStore.getState();
    return { ...actual, useProjectStore: Object.assign(hook, actual.useProjectStore) };
});

vi.mock('../../../store/useSelectionStore', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../store/useSelectionStore')>();
    const hook = (selector?: (state: ReturnType<typeof actual.useSelectionStore.getState>) => unknown) =>
        selector ? selector(actual.useSelectionStore.getState()) : actual.useSelectionStore.getState();
    return { ...actual, useSelectionStore: Object.assign(hook, actual.useSelectionStore) };
});

describe('LightInspector Component', () => {
    beforeEach(() => {
        const project = createDefaultProject();
        const shot = createDefaultShot('shot-1');
        shot.light = {
            position: { x: 0.8, y: 2.5, z: 3.0 },
            intensity: 1.2,
            temperature: 6500,
            ambience: 0.45,
            castShadow: true,
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
                    angle: Math.PI / 4,
                    penumbra: 0.3,
                    distance: 8,
                },
                {
                    id: 'area-1',
                    name: 'Area 1',
                    type: 'area',
                    enabled: true,
                    position: { x: -0.5, y: 0.2, z: 0.8 },
                    target: { x: 0, y: 0, z: 0 },
                    intensity: 1.0,
                    color: '#ffffff',
                    width: 3.5,
                    height: 2.5,
                },
                {
                    id: 'point-1',
                    name: 'Point 1',
                    type: 'point',
                    enabled: true,
                    position: { x: 0, y: 0.3, z: 0.5 },
                    intensity: 0.8,
                    color: '#ffffff',
                    distance: 6,
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

    it('renders Sun inspector layout matching Raylight reference', () => {
        const shot = useProjectStore.getState().project.shots[0];
        const html = renderToStaticMarkup(
            <LightInspector activeShot={shot} selectedLightId="sun-key" onClose={() => {}} />
        );

        expect(html).toContain('Sun');
        expect(html).toContain('Type');
        expect(html).toContain('Position');
        expect(html).toContain('Depth');
        expect(html).toContain('Aim at');
        expect(html).toContain('Effect');
        expect(html).toContain('Color');
        expect(html).toContain('Shadows');
        expect(html).toContain('Cast shadows');
    });

    it('renders Spot light cone and range controls', () => {
        const shot = useProjectStore.getState().project.shots[0];
        const html = renderToStaticMarkup(
            <LightInspector activeShot={shot} selectedLightId="spot-1" onClose={() => {}} />
        );

        expect(html).toContain('Cone');
        expect(html).toContain('Angle');
        expect(html).toContain('Soft');
        expect(html).toContain('Range');
    });

    it('renders Area light size width and height controls', () => {
        const shot = useProjectStore.getState().project.shots[0];
        const html = renderToStaticMarkup(
            <LightInspector activeShot={shot} selectedLightId="area-1" onClose={() => {}} />
        );

        expect(html).toContain('Size');
        expect(html).toContain('Width');
        expect(html).toContain('Height');
    });

    it('renders Point light reach range control', () => {
        const shot = useProjectStore.getState().project.shots[0];
        const html = renderToStaticMarkup(
            <LightInspector activeShot={shot} selectedLightId="point-1" onClose={() => {}} />
        );

        expect(html).toContain('Range');
        expect(html).toContain('Reach');
    });

    it('renders inside RightSidebar when selectedLightId is set and no layer is selected', () => {
        const shot = useProjectStore.getState().project.shots[0];
        useSelectionStore.getState().selectLight('sun-key');

        const html = renderToStaticMarkup(
            <RightSidebar
                activeShot={shot}
                selectedLayer={undefined}
                selectedLayerIds={[]}
                onSwapImageClick={() => {}}
                onOpenExportModal={() => {}}
            />
        );

        expect(html).toContain('data-testid="light-inspector"');
        expect(html).toContain('Cast shadows');
    });
});
