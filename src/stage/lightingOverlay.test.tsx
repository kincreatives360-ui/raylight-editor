import { act, createElement, useSyncExternalStore } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LightingOverlay } from './LightingOverlay';
import { useSelectionStore } from '../store/useSelectionStore';
import { useProjectStore } from '../store/useProjectStore';
import { createDefaultProject, createDefaultShot } from '../model/defaults';
import { evaluateProjectAtTime, type EvaluatedProjectFrame } from '../engine/evaluateShot';
import { JSDOM } from 'jsdom';

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
    let dom: JSDOM | null = null;
    let root: Root | null = null;

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
        if (root) act(() => root!.unmount());
        root = null;
        dom?.window.close();
        dom = null;
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        useSelectionStore.getState().selectLight(null);
        useProjectStore.setState({
            project: createDefaultProject(),
            past: [],
            future: [],
            dragSnapshot: null,
        });
    });

    const createDummyFrame = (): EvaluatedProjectFrame => {
        return evaluateProjectAtTime(useProjectStore.getState().project, 0);
    };

    const setupDragTest = (selectedId: string) => {
        dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost' });
        vi.stubGlobal('window', dom.window);
        vi.stubGlobal('document', dom.window.document);
        vi.stubGlobal('navigator', dom.window.navigator);
        vi.stubGlobal('HTMLElement', dom.window.HTMLElement);
        vi.stubGlobal('SVGElement', dom.window.SVGElement);
        vi.stubGlobal('Node', dom.window.Node);
        vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
        dom.window.Element.prototype.setPointerCapture = function () {};
        dom.window.Element.prototype.hasPointerCapture = function () { return false; };
        dom.window.Element.prototype.releasePointerCapture = function () {};

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
        useProjectStore.setState({ project, past: [], future: [], dragSnapshot: null });
        useSelectionStore.getState().selectLight(selectedId);

        function Harness() {
            const currentProject = useSyncExternalStore(
                useProjectStore.subscribe,
                () => useProjectStore.getState().project
            );
            const frame = evaluateProjectAtTime(currentProject, 0);
            return createElement(LightingOverlay, {
                frame,
                frameWidth: 1920,
                frameHeight: 1080,
            });
        }

        root = createRoot(dom.window.document.getElementById('root')!);
        act(() => root!.render(createElement(Harness)));
        return { originalProject: project };
    };

    const pointerEvent = (type: string, pointerId: number, x: number, y: number) =>
        Object.assign(new dom!.window.Event(type, { bubbles: true, cancelable: true }), {
            pointerId,
            clientX: x,
            clientY: y,
            button: 0,
            shiftKey: false,
        });

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

    it('does not render disabled source badges', () => {
        const shot = useProjectStore.getState().project.shots[0];
        useProjectStore.getState().updateShot(shot.id, {
            light: {
                ...shot.light!,
                sources: shot.light!.sources!.map(source =>
                    source.id === 'spot-1' ? { ...source, enabled: false } : source
                ),
            },
        });

        const frame = createDummyFrame();
        const html = renderToStaticMarkup(
            <LightingOverlay frame={frame} frameWidth={1920} frameHeight={1080} />
        );

        expect(html).not.toContain('data-testid="light-handle-spot-1"');
        expect(html).toContain('data-testid="light-handle-area-1"');
    });

    it('does not show a selected gizmo for a stale selection of a disabled source', () => {
        const shot = useProjectStore.getState().project.shots[0];
        useProjectStore.getState().updateShot(shot.id, {
            light: {
                ...shot.light!,
                sources: shot.light!.sources!.map(source =>
                    source.id === 'spot-1' ? { ...source, enabled: false } : source
                ),
            },
        });
        useSelectionStore.getState().selectLight('spot-1');

        const frame = createDummyFrame();
        const html = renderToStaticMarkup(
            <LightingOverlay frame={frame} frameWidth={1920} frameHeight={1080} />
        );

        expect(html).not.toContain('data-testid="selected-light-source-handle"');
        expect(html).not.toContain('data-testid="light-handle-spot-1"');
    });

    it('hides all light badges when gizmos are disabled and no light is selected', () => {
        const shot = useProjectStore.getState().project.shots[0];
        useProjectStore.getState().updateShot(shot.id, {
            light: { ...shot.light!, showGizmos: false },
        });
        useSelectionStore.getState().selectLight(null);

        const frame = createDummyFrame();
        const html = renderToStaticMarkup(
            <LightingOverlay frame={frame} frameWidth={1920} frameHeight={1080} />
        );

        expect(html).not.toContain('data-testid="lighting-overlay"');
        expect(html).not.toContain('data-testid="light-handle-');
    });

    it('keeps the selected enabled light editable while hiding unselected badges', () => {
        const shot = useProjectStore.getState().project.shots[0];
        useProjectStore.getState().updateShot(shot.id, {
            light: { ...shot.light!, showGizmos: false },
        });
        useSelectionStore.getState().selectLight('spot-1');

        const frame = createDummyFrame();
        const html = renderToStaticMarkup(
            <LightingOverlay frame={frame} frameWidth={1920} frameHeight={1080} />
        );

        expect(html).toContain('data-testid="selected-light-source-handle"');
        expect(html).toContain('data-testid="selected-light-target-handle"');
        expect(html).not.toContain('data-testid="light-handle-sun-key"');
        expect(html).not.toContain('data-testid="light-handle-area-1"');
        expect(html).not.toContain('data-testid="light-handle-point-1"');
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

    it.each([
        ['sun-key', 'selected-light-source-handle'],
        ['sun-key', 'selected-light-target-handle'],
        ['sun-key', 'selected-light-depth-handle'],
        ['spot-1', 'spot-cone-handle'],
        ['area-1', 'area-resize-handle'],
        ['point-1', 'point-reach-handle'],
    ])('restores model updates when the %s light gizmo drag on %s is canceled', (lightId, handleId) => {
        const { originalProject } = setupDragTest(lightId);
        const handle = dom!.window.document.querySelector(`[data-testid="${handleId}"]`)!;
        const pointerId = 73;

        act(() => handle.dispatchEvent(pointerEvent('pointerdown', pointerId, 500, 300)));
        act(() => dom!.window.dispatchEvent(pointerEvent('pointermove', pointerId, 540, 330)));

        expect(useProjectStore.getState().project).not.toBe(originalProject);
        expect(useProjectStore.getState().dragSnapshot).not.toBeNull();

        act(() => dom!.window.dispatchEvent(pointerEvent('pointercancel', pointerId, 540, 330)));

        expect(useProjectStore.getState().project).toBe(originalProject);
        expect(useProjectStore.getState().dragSnapshot).toBeNull();
        expect(useProjectStore.getState().past).toHaveLength(0);
    });

    it('ignores a non-owning pointer and commits a light drag only on pointer-up', () => {
        setupDragTest('sun-key');
        const handle = dom!.window.document.querySelector('[data-testid="selected-light-source-handle"]')!;
        const initialPosition = useProjectStore.getState().project.shots[0].light!.position;

        act(() => handle.dispatchEvent(pointerEvent('pointerdown', 73, 500, 300)));
        act(() => dom!.window.dispatchEvent(pointerEvent('pointermove', 74, 540, 330)));
        expect(useProjectStore.getState().project.shots[0].light!.position).toEqual(initialPosition);
        act(() => dom!.window.dispatchEvent(pointerEvent('pointerup', 74, 540, 330)));
        expect(useProjectStore.getState().dragSnapshot).not.toBeNull();

        act(() => dom!.window.dispatchEvent(pointerEvent('pointermove', 73, 540, 330)));
        act(() => dom!.window.dispatchEvent(pointerEvent('pointerup', 73, 540, 330)));
        expect(useProjectStore.getState().dragSnapshot).toBeNull();
        expect(useProjectStore.getState().past).toHaveLength(1);
    });

    it.each(['Escape', 'lostpointercapture', 'blur', 'unmount'] as const)(
        'rolls back a light drag on %s and ends it once',
        reason => {
            const { originalProject } = setupDragTest('sun-key');
            const handle = dom!.window.document.querySelector('[data-testid="selected-light-source-handle"]')!;
            const pointerId = 73;
            act(() => handle.dispatchEvent(pointerEvent('pointerdown', pointerId, 500, 300)));
            act(() => dom!.window.dispatchEvent(pointerEvent('pointermove', pointerId, 540, 330)));

            if (reason === 'Escape') {
                act(() => dom!.window.dispatchEvent(new dom!.window.KeyboardEvent('keydown', {
                    bubbles: true,
                    key: 'Escape',
                })));
            } else if (reason === 'lostpointercapture') {
                act(() => handle.dispatchEvent(pointerEvent(reason, pointerId, 540, 330)));
                act(() => dom!.window.dispatchEvent(pointerEvent('pointerup', pointerId, 540, 330)));
            } else if (reason === 'blur') {
                act(() => dom!.window.dispatchEvent(new dom!.window.Event('blur')));
            } else {
                act(() => root!.unmount());
                root = null;
            }

            expect(useProjectStore.getState().project).toBe(originalProject);
            expect(useProjectStore.getState().dragSnapshot).toBeNull();
            expect(useProjectStore.getState().past).toHaveLength(0);
        }
    );
});
