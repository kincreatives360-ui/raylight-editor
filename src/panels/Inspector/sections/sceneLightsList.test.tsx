import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SceneLightsList } from './SceneLightsList';
import { useProjectStore } from '../../../store/useProjectStore';
import { useSelectionStore } from '../../../store/useSelectionStore';
import { createDefaultProject, createDefaultShot } from '../../../model/defaults';
import type { Shot } from '../../../model/types';

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

describe('SceneLightsList Component', () => {
    let shot: Shot;

    beforeEach(() => {
        const project = createDefaultProject();
        shot = createDefaultShot({ id: 'shot-1' });
        shot.light = {
            position: { x: 0.8, y: 2.5, z: 3.0 },
            intensity: 1.2,
            temperature: 6500,
            ambience: 0.45,
            castShadow: true,
            keyLightEnabled: true,
            sources: [
                {
                    id: 'spot-1',
                    name: 'Rim Spot',
                    type: 'spot',
                    enabled: true,
                    position: { x: 0.2, y: 0.4, z: 1.2 },
                    target: { x: 0, y: 0, z: 0 },
                    intensity: 1.5,
                    color: '#ffffff',
                },
                {
                    id: 'area-1',
                    name: 'Soft Area',
                    type: 'area',
                    enabled: false,
                    position: { x: -0.5, y: 0.2, z: 0.8 },
                    intensity: 1.0,
                    color: '#ffddaa',
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

    it('renders all lights in the shot including Sun key light and sources', () => {
        const html = renderToStaticMarkup(
            <SceneLightsList
                activeShot={shot}
                selectedLightId="spot-1"
                onSelectLight={() => {}}
            />
        );

        expect(html).toContain('Sun');
        expect(html).toContain('Rim Spot');
        expect(html).toContain('Soft Area');
        expect(html).toContain('data-testid="scene-light-item-sun-key"');
        expect(html).toContain('data-testid="scene-light-item-spot-1"');
        expect(html).toContain('data-testid="scene-light-item-area-1"');
    });

    it('marks the currently selected light with active selection styling', () => {
        const html = renderToStaticMarkup(
            <SceneLightsList
                activeShot={shot}
                selectedLightId="spot-1"
                onSelectLight={() => {}}
            />
        );

        expect(html).toContain('data-selected="true"');
    });

    it('renders visibility toggle buttons for each light', () => {
        const html = renderToStaticMarkup(
            <SceneLightsList
                activeShot={shot}
                selectedLightId={null}
                onSelectLight={() => {}}
            />
        );

        expect(html).toContain('title="Toggle light visibility"');
    });

    it('renders add light button', () => {
        const html = renderToStaticMarkup(
            <SceneLightsList
                activeShot={shot}
                selectedLightId={null}
                onSelectLight={() => {}}
            />
        );

        expect(html).toContain('Add Light');
    });
});
