import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RightSidebar } from './RightSidebar';
import { createDefaultProject, createDefaultTextLayer } from '../../model/defaults';
import { useProjectStore } from '../../store/useProjectStore';
import { useSelectionStore } from '../../store/useSelectionStore';

vi.mock('../../store/useProjectStore', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../store/useProjectStore')>();
    const hook = (selector?: (state: ReturnType<typeof actual.useProjectStore.getState>) => unknown) =>
        selector ? selector(actual.useProjectStore.getState()) : actual.useProjectStore.getState();
    return { ...actual, useProjectStore: Object.assign(hook, actual.useProjectStore) };
});

vi.mock('../../store/useSelectionStore', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../store/useSelectionStore')>();
    const hook = (selector?: (state: ReturnType<typeof actual.useSelectionStore.getState>) => unknown) =>
        selector ? selector(actual.useSelectionStore.getState()) : actual.useSelectionStore.getState();
    return { ...actual, useSelectionStore: Object.assign(hook, actual.useSelectionStore) };
});

describe('Project Settings vs Shot Settings Separation & Figma-style Scene Effects', () => {
    beforeEach(() => {
        const project = createDefaultProject();
        useProjectStore.setState({ project });
        useSelectionStore.setState({
            selectedLayerIds: [],
            selectedLightId: null,
            inspectorTab: 'project',
        });
    });

    it('renders ONLY Project Settings when everything is deselected (inspectorTab === project)', () => {
        useSelectionStore.setState({
            selectedLayerIds: [],
            selectedLightId: null,
            inspectorTab: 'project',
        });

        const shot = useProjectStore.getState().project.shots[0];
        const html = renderToStaticMarkup(
            <RightSidebar
                activeShot={shot}
                selectedLayer={undefined}
                selectedLayerIds={[]}
                onSwapImageClick={() => {}}
                onOpenExportModal={() => {}}
            />
        );

        // Has Project Settings
        expect(html).toContain('data-testid="project-settings-section"');
        expect(html).toContain('Project Settings');
        expect(html).toContain('Aspect Ratio');
        expect(html).toContain('Lens');
        expect(html).not.toContain('aria-label="Inspector settings view"');
        expect(html).not.toMatch(/>\s*Shot\s*<\/button>/);
        expect(html).not.toContain('<select');
        expect(html).toContain('role="combobox"');

        // DOES NOT contain Shot Settings or Scene Effects in Project Settings panel
        expect(html).not.toContain('data-testid="shot-settings-section"');
        expect(html).not.toContain('data-testid="scene-effects-section"');
    });

    it('renders ONLY Shot Settings when a shot is selected (inspectorTab === shot)', () => {
        useSelectionStore.setState({
            selectedLayerIds: [],
            selectedLightId: null,
            inspectorTab: 'shot',
        });

        const shot = useProjectStore.getState().project.shots[0];
        const html = renderToStaticMarkup(
            <RightSidebar
                activeShot={shot}
                selectedLayer={undefined}
                selectedLayerIds={[]}
                onSwapImageClick={() => {}}
                onOpenExportModal={() => {}}
            />
        );

        expect(html).toContain('data-testid="shot-settings-section"');
        expect(html).toContain('Shot Name');
        expect(html).toContain('Use project');
        expect(html).toContain('Export shot');

        // Contains Scene effects in Figma style
        expect(html).toContain('data-testid="scene-effects-section"');
        expect(html).toContain('Scene effects');

        expect(html).not.toContain('SCENE LIGHTS');
        expect(html).not.toContain('Shader pass order');
        expect(html).not.toContain('No scene effects added');
        expect(html).not.toContain('aria-label="Inspector settings view"');
        expect(html).not.toMatch(/>\s*Project\s*<\/button>/);
        expect(html).toContain('aria-label="Use project background"');

        // DOES NOT contain Project Settings section
        expect(html).not.toContain('data-testid="project-settings-section"');
    });

    it('keeps shot settings separate from the selected layer inspector', () => {
        const shot = useProjectStore.getState().project.shots[0];
        const textLayer = createDefaultTextLayer();
        shot.layers = [textLayer];

        useSelectionStore.setState({
            selectedLayerIds: [textLayer.id],
            inspectorTab: 'layer',
        });

        const html = renderToStaticMarkup(
            <RightSidebar
                activeShot={shot}
                selectedLayer={textLayer}
                selectedLayerIds={[textLayer.id]}
                onSwapImageClick={() => {}}
                onOpenExportModal={() => {}}
            />
        );

        // Has layer shot settings section at bottom
        expect(html).not.toContain('data-testid="layer-shot-settings-section"');
        expect(html).not.toContain('data-testid="scene-effects-section"');
        expect(html).not.toContain('Use project');
    });
});
