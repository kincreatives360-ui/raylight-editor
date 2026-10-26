import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LightBlockInspector } from './LightBlockInspector';
import { LightInspector } from './LightInspector';
import { RightSidebar } from '../RightSidebar';
import { useSelectionStore } from '../../../store/useSelectionStore';
import { useProjectStore } from '../../../store/useProjectStore';
import { createDefaultProject, createDefaultShot } from '../../../model/defaults';
import type { LightAnimationBlock } from '../../../model/types';

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

const mockLightBlock: LightAnimationBlock = {
    id: 'light-blk-1',
    label: 'Key Light Move',
    targetLightId: 'key',
    startMs: 200,
    durationMs: 1200,
    fromX: -0.28,
    fromY: 0.36,
    fromZ: 1.0,
    toX: 0.5,
    toY: -0.2,
    toZ: 2.0,
    fromIntensity: 1.2,
    toIntensity: 2.5,
    fromTemperature: 6500,
    toTemperature: 4500,
    easing: { kind: 'bezier', x1: 0.42, y1: 0, x2: 0.58, y2: 1 },
};

describe('LightBlockInspector Component', () => {
    beforeEach(() => {
        const project = createDefaultProject();
        const shot = createDefaultShot({ id: 'shot-1' });
        shot.lightBlocks = [mockLightBlock];
        project.shots = [shot];
        useProjectStore.setState({ project,  });
        useSelectionStore.setState({
            selectedLightBlockId: 'light-blk-1',
            selectedLightId: null,
            selectedLayerIds: [],
        });
    });

    it('renders block timing, position, intensity, and temperature controls', () => {
                const html = renderToStaticMarkup(
            <LightBlockInspector
                activeShotId="shot-1"
                activeLightBlock={mockLightBlock}
                onDone={() => {}}
            />
        );

        expect(html).toContain('data-testid="light-block-inspector"');
        expect(html).toContain('Key Light Move');
        expect(html).toContain('Timing');
        expect(html).toContain('Position');
        expect(html).toContain('Intensity');
        expect(html).toContain('Temperature');
        expect(html).toContain('Delete Block');
    });

    it('renders in RightSidebar when selectedLightBlockId is active', () => {
        const shot = useProjectStore.getState().project.shots[0];
        useSelectionStore.getState().selectLightBlock('light-blk-1');

        const html = renderToStaticMarkup(
            <RightSidebar
                activeShot={shot}
                selectedLayer={undefined}
                selectedLayerIds={[]}
                onSwapImageClick={() => {}}
                onOpenExportModal={() => {}}
            />
        );

        expect(html).toContain('data-testid="light-block-inspector"');
        expect(html).toContain('Key Light Move');
    });
});

describe('LightInspector Animate Light integration', () => {
    beforeEach(() => {
        const project = createDefaultProject();
        const shot = createDefaultShot({ id: 'shot-1' });
        project.shots = [shot];
        useProjectStore.setState({ project,  });
        useSelectionStore.setState({
            selectedLightId: 'sun-key',
            selectedLightBlockId: null,
            selectedLayerIds: [],
        });
    });

    it('renders Animate Light button in LightInspector', () => {
        const shot = useProjectStore.getState().project.shots[0];
        const html = renderToStaticMarkup(
            <LightInspector activeShot={shot} selectedLightId="sun-key" onClose={() => {}} />
        );

        expect(html).toContain('data-testid="animate-light-btn"');
        expect(html).toContain('Animate Light');
    });
});
