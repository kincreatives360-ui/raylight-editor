// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRoot } from 'react-dom/client';
import { CanvasToolbar } from './CanvasToolbar';
import { useSelectionStore } from '../store/useSelectionStore';
import { useProjectStore } from '../store/useProjectStore';
import { createDefaultProject, createDefaultShot } from '../model/defaults';
import { CANVAS_ZOOM_LEVELS } from './cameraAngleViews';

Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true });

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

describe('CanvasToolbar - Lighting Tools Menu', () => {
    beforeEach(() => {
        const project = createDefaultProject();
        const shot = createDefaultShot({ id: 'shot-1' });
        shot.light = {
            position: { x: -0.28, y: 0.36, z: 0.9 },
            intensity: 1.2,
            temperature: 6500,
            ambience: 0.45,
            sources: [],
        };
        project.shots = [shot];
        useProjectStore.getState().loadProjectJson(project);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        useSelectionStore.getState().selectLight(null);
    });

    it('renders the lighting button and dropdown chevron in CanvasToolbar', () => {
        const html = renderToStaticMarkup(<CanvasToolbar selectedLayer={undefined} zoom={1} onZoom={vi.fn()} />);
        expect(html).toContain('aria-label="Lighting Rig"');
        expect(html).toContain('aria-label="Lighting options"');
    });

    it('displays light types Sun, Spot, Point, Area when menu is open', () => {
        // Test dropdown contents rendering
        const html = renderToStaticMarkup(
            <CanvasToolbar selectedLayer={undefined} zoom={1} onZoom={vi.fn()} defaultOpenMenu="light" />
        );
        expect(html).toContain('Sun Light');
        expect(html).toContain('Spot Light');
        expect(html).toContain('Point Light');
        expect(html).toContain('Area Light');
    });

    it('shows the current viewport zoom and changes it to a shared zoom level', () => {
        const previousZoom = useSelectionStore.getState().canvasZoom;
        const previousPan = useSelectionStore.getState().canvasPan;
        const pan = { x: 17, y: -23 };
        useSelectionStore.getState().setCanvasPan(pan);
        const onZoom = vi.fn((value: number) => useSelectionStore.getState().setCanvasZoom(value));
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);

        act(() => {
            root.render(<CanvasToolbar selectedLayer={undefined} zoom={1.5} onZoom={onZoom} />);
        });

        const zoomButton = container.querySelector<HTMLButtonElement>('button[aria-label="Viewport zoom"]');
        expect(zoomButton).toBeTruthy();
        expect(zoomButton?.textContent ?? '').toContain('150%');

        act(() => zoomButton?.click());
        expect(container.textContent).toContain('50%');
        for (const level of CANVAS_ZOOM_LEVELS) {
            expect(container.textContent).toContain(`${Math.round(level * 100)}%`);
        }

        const zoomLevel = Array.from(container.querySelectorAll('button'))
            .find((button) => button.textContent?.trim() === '50%');
        act(() => zoomLevel?.click());
        expect(onZoom).toHaveBeenCalledWith(0.5);
        expect(useSelectionStore.getState().canvasZoom).toBe(0.5);
        expect(useSelectionStore.getState().canvasPan).toEqual(pan);

        act(() => root.unmount());
        container.remove();
        useSelectionStore.getState().setCanvasZoom(previousZoom);
        useSelectionStore.getState().setCanvasPan(previousPan);
    });
});
