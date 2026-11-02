import { act, createElement, useSyncExternalStore } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { evaluateProjectAtTime, type EvaluatedProjectFrame } from '../engine/evaluateShot';
import {
    createDefaultImageLayer,
    createDefaultProject,
    createDefaultTextLayer,
} from '../model/defaults';
import { useProjectStore } from '../store/useProjectStore';
import { DepthOfFieldFocusOverlay } from './DepthOfFieldFocusOverlay';
import { DEFAULT_CAMERA_Z, DEFAULT_FOCAL_LENGTH, evaluateCameraPose } from './webgl/cameraMath';
import { JSDOM } from 'jsdom';

const frameWidth = 960;
const frameHeight = 540;
const targetAspect = frameWidth / frameHeight;

function makeFixture() {
    const project = createDefaultProject();
    project.defaultCamera = {
        position: { x: 0, y: 0, z: DEFAULT_CAMERA_Z },
        rotation: { x: 0, y: 0, z: 0 },
        focalLength: DEFAULT_FOCAL_LENGTH,
    };
    project.shots[0].layers = [
        createDefaultImageLayer({
            id: 'layer-img-device',
            name: 'Device layer',
            position: { x: 0, y: 0, z: 0.2 },
        }),
        createDefaultTextLayer({
            id: 'layer-txt-title',
            name: 'Title layer',
            position: { x: 0, y: 0, z: 0.8 },
        }),
    ];
    project.shots[0].effects.depthOfField = {
        ...project.shots[0].effects.depthOfField,
        enabled: true,
        target: { x: 0.2, y: -0.1, z: 0.4 },
        focusRange: 0.6,
    };
    const evaluated = evaluateProjectAtTime(project, 0);
    const frame = {
        ...evaluated,
        layers: evaluated.layers.map((layer, index) => ({
            ...layer,
            position: { ...layer.position, z: index === 0 ? 0.2 : 0.8 },
            dofBlurPx: index === 0 ? 0 : 2,
            totalBlurPx: index === 0 ? 0 : 7.5,
        })),
    } as EvaluatedProjectFrame;
    const defaultCamera = project.defaultCamera!;
    const cameraPose = evaluateCameraPose(frame.camera, defaultCamera, targetAspect);

    return {
        project,
        frame,
        defaultCamera,
        cameraPose,
        stageFrameRef: { current: null },
        onFocusClick: vi.fn(),
        onAdjustFocusDepth: vi.fn(),
        onAdjustFocusRange: vi.fn(),
    };
}

describe('DepthOfFieldFocusOverlay', () => {
    let dom: JSDOM | null = null;
    let root: Root | null = null;

    afterEach(() => {
        if (root) act(() => root!.unmount());
        root = null;
        dom?.window.close();
        dom = null;
        vi.useRealTimers();
        vi.unstubAllGlobals();
        useProjectStore.setState({
            project: createDefaultProject(),
            past: [],
            future: [],
            dragSnapshot: null,
        });
    });

    const renderOverlay = (overrides: Record<string, unknown> = {}) => {
        const fixture = makeFixture();
        const props = {
            active: false,
            indicator: null,
            frame: fixture.frame,
            frameWidth,
            frameHeight,
            targetAspect,
            cameraPose: fixture.cameraPose,
            defaultCamera: fixture.defaultCamera,
            stageFrameRef: fixture.stageFrameRef,
            onFocusClick: fixture.onFocusClick,
            onBeginDrag: () => {},
            onEndDrag: () => {},
            onAdjustFocusDepth: fixture.onAdjustFocusDepth,
            onAdjustFocusRange: fixture.onAdjustFocusRange,
            ...overrides,
        };
        const html = renderToStaticMarkup(
            createElement(DepthOfFieldFocusOverlay, props as never)
        );
        return { ...fixture, html };
    };

    const setupPointerTest = () => {
        const fixture = makeFixture();
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

        useProjectStore.setState({
            project: fixture.project,
            past: [],
            future: [],
            dragSnapshot: null,
        });

        function Harness() {
            const project = useSyncExternalStore(
                useProjectStore.subscribe,
                () => useProjectStore.getState().project
            );
            const frame = evaluateProjectAtTime(project, 0);
            return createElement(DepthOfFieldFocusOverlay, {
                active: false,
                indicator: null,
                frame,
                frameWidth,
                frameHeight,
                targetAspect,
                cameraPose: evaluateCameraPose(frame.camera, fixture.defaultCamera, targetAspect),
                defaultCamera: fixture.defaultCamera,
                stageFrameRef: fixture.stageFrameRef,
                onFocusClick: fixture.onFocusClick,
                onBeginDrag: () => useProjectStore.getState().beginDragTransaction(),
                onEndDrag: (cancelled: boolean) => {
                    if (cancelled) useProjectStore.getState().cancelDragTransaction();
                    else useProjectStore.getState().commitDragTransaction();
                },
                onAdjustFocusDepth: (delta: number, skipHistory?: boolean) => {
                    useProjectStore.getState().updateShot('shot-1', shot => ({
                        ...shot,
                        effects: {
                            ...shot.effects,
                            depthOfField: {
                                ...shot.effects.depthOfField,
                                target: {
                                    ...shot.effects.depthOfField.target,
                                    z: shot.effects.depthOfField.target.z + delta,
                                },
                            },
                        },
                    }), skipHistory ? { skipHistory: true } : undefined);
                },
                onAdjustFocusRange: (delta: number, skipHistory?: boolean) => {
                    useProjectStore.getState().updateShot('shot-1', shot => ({
                        ...shot,
                        effects: {
                            ...shot.effects,
                            depthOfField: {
                                ...shot.effects.depthOfField,
                                focusRange: shot.effects.depthOfField.focusRange + delta,
                            },
                        },
                    }), skipHistory ? { skipHistory: true } : undefined);
                },
            } as never);
        }

        root = createRoot(dom.window.document.getElementById('root')!);
        act(() => root!.render(createElement(Harness)));
        return fixture;
    };

    const pointerEvent = (type: string, pointerId: number, clientX: number, clientY: number) =>
        Object.assign(new dom!.window.Event(type, { bubbles: true, cancelable: true }), {
            pointerId,
            clientX,
            clientY,
            button: 0,
            shiftKey: false,
        });

    it('links focus and near/far sheets to the evaluated focus values', () => {
        const { html } = renderOverlay();
        const focusDepth = 'data-focus-depth="0.4"';

        expect(html).toContain('data-focus-plane=""');
        expect(html).toContain(focusDepth);
        expect(html).toContain('data-depth-boundary="near"');
        expect(html).toContain('data-depth="0.1"');
        expect(html).toContain('data-depth-boundary="far"');
        expect(html).toContain('data-depth="0.7"');
        expect(html).toContain('data-ruler-focus-depth="0.4"');
    });

    it('shows camera and layer depth ticks on the linked ruler', () => {
        const { html } = renderOverlay();

        expect(html).toContain('data-depth-tick="camera"');
        expect(html).toContain('data-depth="2.65"');
        expect(html).toContain('data-depth-tick="layer"');
        expect(html).toContain('data-layer-id="layer-img-device"');
        expect(html).toContain('data-layer-id="layer-txt-title"');
    });

    it('outlines layers using depth-of-field blur and communicates total blur', () => {
        const { html } = renderOverlay();

        expect(html).toContain('data-focus-layer="layer-img-device"');
        expect(html).toContain('data-focus-state="sharp"');
        expect(html).toContain('data-focus-layer="layer-txt-title"');
        expect(html).toContain('data-focus-state="blurred"');
        expect(html).toContain('data-total-blur-px="7.5"');
        expect(html).toContain('7.5px total blur');
    });

    it('keeps projected sheet surfaces pointer-transparent', () => {
        const { html } = renderOverlay();

        expect(html).toContain('data-depth-sheet-surface=""');
        expect(html).toContain('pointer-events:none');
        expect(html).not.toContain('data-depth-sheet-surface="" role=');
    });

    it('places the ruler above the floating toolbar clearance', () => {
        const { html } = renderOverlay();
        const toolbarHeight = 44;
        const toolbarBottom = 12;
        const rulerBottom = 64;
        expect(html).toContain('bottom:64px');
        expect(html).toContain('height:42px');
        expect(frameHeight - rulerBottom).toBeLessThan(frameHeight - toolbarBottom - toolbarHeight);
    });

    it('exposes named keyboard handles and adjusts focus depth and range', () => {
        const fixture = makeFixture();
        dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost' });
        vi.stubGlobal('window', dom.window);
        vi.stubGlobal('document', dom.window.document);
        vi.stubGlobal('navigator', dom.window.navigator);
        vi.stubGlobal('HTMLElement', dom.window.HTMLElement);
        vi.stubGlobal('SVGElement', dom.window.SVGElement);
        vi.stubGlobal('Node', dom.window.Node);
        vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);

        function Harness() {
            const currentFrame = useSyncExternalStore(
                useProjectStore.subscribe,
                () => fixture.frame
            );
            return createElement(DepthOfFieldFocusOverlay, {
                active: false,
                indicator: null,
                frame: currentFrame,
                frameWidth,
                frameHeight,
                targetAspect,
                cameraPose: fixture.cameraPose,
                defaultCamera: fixture.defaultCamera,
                stageFrameRef: fixture.stageFrameRef,
                onFocusClick: fixture.onFocusClick,
                onBeginDrag: () => {},
                onEndDrag: () => {},
                onAdjustFocusDepth: fixture.onAdjustFocusDepth,
                onAdjustFocusRange: fixture.onAdjustFocusRange,
            });
        }

        root = createRoot(dom.window.document.getElementById('root')!);
        act(() => root!.render(createElement(Harness)));

        const focusHandle = dom.window.document.querySelector('[aria-label="Focus depth; use arrow keys to adjust"]')!;
        const nearHandle = dom.window.document.querySelector('[aria-label="Near focus boundary; use arrow keys to adjust range"]')!;
        const farHandle = dom.window.document.querySelector('[aria-label="Far focus boundary; use arrow keys to adjust range"]')!;
        expect(focusHandle.getAttribute('tabindex')).toBe('0');
        expect(nearHandle.getAttribute('tabindex')).toBe('0');
        expect(farHandle.getAttribute('tabindex')).toBe('0');

        act(() => focusHandle.dispatchEvent(new dom!.window.KeyboardEvent('keydown', {
            bubbles: true,
            key: 'ArrowUp',
        })));
        act(() => nearHandle.dispatchEvent(new dom!.window.KeyboardEvent('keydown', {
            bubbles: true,
            key: 'ArrowDown',
        })));
        act(() => farHandle.dispatchEvent(new dom!.window.KeyboardEvent('keydown', {
            bubbles: true,
            key: 'ArrowUp',
        })));

        expect(fixture.onAdjustFocusDepth).toHaveBeenCalledWith(0.05);
        expect(fixture.onAdjustFocusRange.mock.calls.map(([delta]) => delta)).toEqual([-0.05, 0.05]);
    });

    it('drags focus depth in one undoable transaction', () => {
        setupPointerTest();
        const marker = dom!.window.document.querySelector('[data-focus-marker]')!;
        act(() => marker.dispatchEvent(pointerEvent('pointerdown', 5, 120, 120)));
        act(() => dom!.window.dispatchEvent(pointerEvent('pointermove', 5, 120, 60)));
        act(() => dom!.window.dispatchEvent(pointerEvent('pointermove', 5, 120, 80)));
        act(() => dom!.window.dispatchEvent(pointerEvent('pointerup', 5, 120, 80)));

        expect(useProjectStore.getState().project.shots[0].effects.depthOfField.target.z).toBeCloseTo(0.6);
        expect(useProjectStore.getState().past).toHaveLength(1);
        expect(useProjectStore.getState().dragSnapshot).toBeNull();
        act(() => useProjectStore.getState().undo());
        expect(useProjectStore.getState().project.shots[0].effects.depthOfField.target.z).toBeCloseTo(0.4);
    });

    it('drags a range edge in one undoable transaction', () => {
        setupPointerTest();
        const handle = dom!.window.document.querySelector('[data-depth-handle="far"]')!;
        act(() => handle.dispatchEvent(pointerEvent('pointerdown', 6, 300, 120)));
        act(() => dom!.window.dispatchEvent(pointerEvent('pointermove', 6, 380, 120)));
        act(() => dom!.window.dispatchEvent(pointerEvent('pointermove', 6, 350, 120)));
        act(() => dom!.window.dispatchEvent(pointerEvent('pointerup', 6, 380, 120)));

        expect(useProjectStore.getState().project.shots[0].effects.depthOfField.focusRange).toBeCloseTo(0.85);
        expect(useProjectStore.getState().past).toHaveLength(1);
        expect(useProjectStore.getState().dragSnapshot).toBeNull();
        act(() => useProjectStore.getState().undo());
        expect(useProjectStore.getState().project.shots[0].effects.depthOfField.focusRange).toBeCloseTo(0.6);
    });

    it('rolls back a focus drag on Escape without adding undo history', () => {
        setupPointerTest();
        const originalProject = useProjectStore.getState().project;
        const marker = dom!.window.document.querySelector('[data-focus-marker]')!;
        act(() => marker.dispatchEvent(pointerEvent('pointerdown', 7, 120, 120)));
        act(() => dom!.window.dispatchEvent(pointerEvent('pointermove', 7, 120, 80)));
        expect(useProjectStore.getState().project).not.toBe(originalProject);

        act(() => dom!.window.dispatchEvent(new dom!.window.KeyboardEvent('keydown', {
            bubbles: true,
            key: 'Escape',
        })));

        expect(useProjectStore.getState().project).toBe(originalProject);
        expect(useProjectStore.getState().past).toHaveLength(0);
        expect(useProjectStore.getState().dragSnapshot).toBeNull();
    });

    it('links ruler hover to the projected focus plane and fades after inactivity', () => {
        vi.useFakeTimers();
        const fixture = makeFixture();
        dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost' });
        vi.stubGlobal('window', dom.window);
        vi.stubGlobal('document', dom.window.document);
        vi.stubGlobal('navigator', dom.window.navigator);
        vi.stubGlobal('HTMLElement', dom.window.HTMLElement);
        vi.stubGlobal('SVGElement', dom.window.SVGElement);
        vi.stubGlobal('Node', dom.window.Node);
        vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);

        function Harness() {
            return createElement(DepthOfFieldFocusOverlay, {
                active: false,
                indicator: null,
                frame: fixture.frame,
                frameWidth,
                frameHeight,
                targetAspect,
                cameraPose: fixture.cameraPose,
                defaultCamera: fixture.defaultCamera,
                stageFrameRef: fixture.stageFrameRef,
                onFocusClick: fixture.onFocusClick,
                onBeginDrag: () => {},
                onEndDrag: () => {},
                onAdjustFocusDepth: fixture.onAdjustFocusDepth,
                onAdjustFocusRange: fixture.onAdjustFocusRange,
            });
        }

        root = createRoot(dom.window.document.getElementById('root')!);
        act(() => root!.render(createElement(Harness)));

        const plane = dom.window.document.querySelector('[data-focus-plane]')!;
        const ruler = dom.window.document.querySelector('[data-focus-depth-ruler]')!;
        const focusTick = dom.window.document.querySelector('[data-depth-tick="focus"]')!;
        act(() => focusTick.dispatchEvent(new dom!.window.MouseEvent('mouseover', { bubbles: true })));

        expect(plane.getAttribute('data-hovered-depth')).toBe('0.4');
        expect(ruler.getAttribute('data-hovered-depth')).toBe('0.4');
        expect(ruler.getAttribute('data-faded')).toBe('false');

        const layerTick = dom.window.document.querySelector('[data-depth-tick="layer"][data-layer-id="layer-img-device"]')!;
        act(() => layerTick.dispatchEvent(new dom!.window.MouseEvent('mouseover', { bubbles: true })));
        expect(dom.window.document
            .querySelector('[data-focus-layer="layer-img-device"]')!
            .getAttribute('data-hover-linked')).toBe('true');

        act(() => vi.advanceTimersByTime(2800));

        expect(ruler.getAttribute('data-faded')).toBe('true');
        expect(dom.window.document
            .querySelector('[data-focus-layer="layer-img-device"]')!
            .closest('svg')!
            .getAttribute('class')).toContain('opacity-35');
    });
});
