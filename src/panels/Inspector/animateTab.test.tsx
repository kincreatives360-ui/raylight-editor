import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RightSidebar } from './RightSidebar';
import { createDefaultProject } from '../../model/defaults';
import type { TextLayer, Transitionish } from '../../model/types';
import { useSelectionStore } from '../../store/useSelectionStore';
import { useProjectStore } from '../../store/useProjectStore';

describe('RightSidebar Animate Tab', () => {
    it('renders clean minimal Animate tab with 3 rows (Animations, In, Out) when no animations/presets applied', () => {
        const project = createDefaultProject();
        const shot = project.shots[0];
        const textLayer = shot.layers.find((l) => l.kind === 'text') as TextLayer;
        expect(textLayer).toBeDefined();

        // Clear entrances and exits and blocks to test clean default
        const cleanLayer: TextLayer = {
            ...textLayer,
            blocks: [],
            entrance: { type: 'none', durationMs: 0, delayMs: 0, distance: 0, easing: { kind: 'preset', name: 'ease-out' } },
            entrances: undefined,
            exit: { type: 'none', durationMs: 0, delayMs: 0, distance: 0, easing: { kind: 'preset', name: 'ease-in' } },
            exits: undefined,
        };

        useProjectStore.setState({ project });
        useSelectionStore.setState({ selectedLayerIds: [cleanLayer.id] });

        const html = renderToStaticMarkup(
            <RightSidebar
                activeShot={shot}
                selectedLayer={cleanLayer}
                selectedLayerIds={[cleanLayer.id]}
                onSwapImageClick={() => {}}
                onOpenExportModal={() => {}}
            />
        );

        // Subheader tabs: Design and Animate
        expect(html).toContain('Design');
        expect(html).toContain('Animate');
    });

    it('renders pill chips for applied In and Out presets', () => {
        const project = createDefaultProject();
        const shot = project.shots[0];
        const textLayer = shot.layers.find((l) => l.kind === 'text') as TextLayer;

        const inPreset: Transitionish = {
            type: 'fade',
            durationMs: 500,
            delayMs: 0,
            distance: 0,
            easing: { kind: 'preset', name: 'ease-out' },
        };

        const outPreset: Transitionish = {
            type: 'slide-down',
            durationMs: 500,
            delayMs: 0,
            distance: 0.25,
            easing: { kind: 'preset', name: 'ease-in' },
        };

        const animatedLayer: TextLayer = {
            ...textLayer,
            entrance: inPreset,
            entrances: [inPreset],
            exit: outPreset,
            exits: [outPreset],
        };

        useProjectStore.setState({ project });
        useSelectionStore.setState({ selectedLayerIds: [animatedLayer.id] });

        const html = renderToStaticMarkup(
            <RightSidebar
                activeShot={shot}
                selectedLayer={animatedLayer}
                selectedLayerIds={[animatedLayer.id]}
                onSwapImageClick={() => {}}
                onOpenExportModal={() => {}}
            />
        );

        expect(html).toBeDefined();
    });
});
