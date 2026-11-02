import { act, createElement, useSyncExternalStore } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { evaluateProjectAtTime } from '../engine/evaluateShot';
import { createDefaultImageLayer, createDefaultProject } from '../model/defaults';
import { useProjectStore } from '../store/useProjectStore';
import { useStageDofFocus } from './useStageDofFocus';
import { useStageWheelNavigation } from './useStageWheelNavigation';
import { DepthOfFieldFocusOverlay } from './DepthOfFieldFocusOverlay';
import { DEFAULT_CAMERA_Z, DEFAULT_FOCAL_LENGTH, evaluateCameraPose } from './webgl/cameraMath';

function makeProject(depthOfFieldEnabled = true) {
    const project = createDefaultProject();
    project.defaultCamera = {
        position: { x: 0, y: 0, z: DEFAULT_CAMERA_Z },
        rotation: { x: 0, y: 0, z: 0 },
        focalLength: DEFAULT_FOCAL_LENGTH,
    };
    project.shots[0].layers = [
        createDefaultImageLayer({
            id: 'foreground',
            name: 'Foreground',
            position: { x: 0, y: 0, z: 0.2 },
        }),
        createDefaultImageLayer({
            id: 'background',
            name: 'Background',
            position: { x: 0, y: 0, z: 0.8 },
        }),
    ];
    project.shots[0].effects.depthOfField = {
        ...project.shots[0].effects.depthOfField,
        enabled: depthOfFieldEnabled,
        target: { x: 0, y: 0, z: 0.4 },
    };
    return project;
}

describe('Stage depth-of-field focus gestures', () => {
    let dom: ReturnType<typeof createDom> | null = null;
    let root: Root | null = null;
    let selectLayer: ReturnType<typeof vi.fn>;
    let pan: ReturnType<typeof vi.fn>;

    function createDom() {
        return new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost' });
    }

    const setup = (project = makeProject(), localTimeMs = 0) => {
        dom = createDom();
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
        useProjectStore.setState({ project, past: [], future: [], dragSnapshot: null });
        selectLayer = vi.fn();
        pan = vi.fn();

        const containerRef = { current: null as HTMLDivElement | null };
        const stageFrameRef = { current: null as HTMLDivElement | null };
        function Harness() {
            const currentProject = useSyncExternalStore(
                useProjectStore.subscribe,
                () => useProjectStore.getState().project
            );
            const frame = evaluateProjectAtTime(currentProject, localTimeMs);
            const cameraPose = evaluateCameraPose(
                frame.camera,
                currentProject.defaultCamera!,
                16 / 9
            );
            const updateShot = useProjectStore.getState().updateShot;
            const beginDragTransaction = useProjectStore.getState().beginDragTransaction;
            const commitDragTransaction = useProjectStore.getState().commitDragTransaction;
            const cancelDragTransaction = useProjectStore.getState().cancelDragTransaction;
            const focus = useStageDofFocus({
                stageFrameRef,
                containerRef,
                frame,
                frameWidth: 960,
                frameHeight: 540,
                canvasZoom: 1,
                targetAspect: 16 / 9,
                cameraPose,
                defaultCamera: currentProject.defaultCamera!,
                updateShot,
                beginDragTransaction,
                commitDragTransaction,
                cancelDragTransaction,
                setDofFocusIndicator: () => {},
                setDofFocusActive: () => {},
            });
            useStageWheelNavigation({
                containerRef,
                activeTool: 'select',
                frame,
                selectedCameraBlockId: null,
                beginDragTransaction,
                commitDragTransaction,
                cancelDragTransaction,
                updateActiveShotCamera: () => {},
                setCanvasZoom: () => {},
                setCanvasPan: pan,
                dofFocusHeld: focus.isDofFocusHeld,
                onAdjustDofFocus: focus.adjustDofFocusDepth,
            });
            const pickLayer = (layerId: string) => (event: React.MouseEvent) => {
                const focusPick = Reflect.apply(focus.focusLayerIfHeld, focus, [layerId, event.shiftKey]) as boolean;
                if (!focusPick) selectLayer(layerId, event.shiftKey);
            };
            return createElement('div', {
                ref: containerRef,
                tabIndex: 0,
                onPointerDownCapture: focus.handlePointerDown,
                onMouseDown: (event: React.MouseEvent) => {
                    if (focus.isDofFocusHeld()) event.preventDefault();
                },
            },
            createElement('div', { 'data-selection-overlay': '' },
                createElement('div', {
                    'data-selection-hit': '',
                    onPointerDown: () => selectLayer('foreground'),
                })),
            createElement('button', {
                type: 'button',
                onClick: pickLayer('foreground'),
                'data-layer-pick': 'foreground',
            }, 'Pick foreground'),
            createElement('button', {
                type: 'button',
                onClick: pickLayer('background'),
                'data-layer-pick': 'background',
            }, 'Pick background'),
            createElement(DepthOfFieldFocusOverlay, {
                active: false,
                indicator: null,
                frame,
                frameWidth: 960,
                frameHeight: 540,
                targetAspect: 16 / 9,
                cameraPose,
                defaultCamera: currentProject.defaultCamera!,
                stageFrameRef,
                onFocusClick: focus.handleFocusClick,
                onBeginDrag: beginDragTransaction,
                onEndDrag: (cancelled: boolean) => cancelled
                    ? cancelDragTransaction()
                    : commitDragTransaction(),
                onAdjustFocusDepth: focus.adjustFocusDepth,
                onAdjustFocusRange: () => {},
            }));
        }

        root = createRoot(dom.window.document.getElementById('root')!);
        act(() => root!.render(createElement(Harness)));
        return dom;
    };

    const pointer = (type: string, pointerId: number, clientX: number, clientY: number, shiftKey = false) =>
        Object.assign(new dom!.window.Event(type, { bubbles: true, cancelable: true }), {
            pointerId,
            clientX,
            clientY,
            button: 0,
            shiftKey,
        });
    const wheel = (deltaY: number, deltaX = 0, shiftKey = false) => {
        const event = new dom!.window.Event('wheel', { bubbles: true, cancelable: true });
        Object.defineProperties(event, {
            deltaY: { value: deltaY },
            deltaX: { value: deltaX },
            deltaMode: { value: 0 },
            shiftKey: { value: shiftKey },
        });
        return event;
    };

    afterEach(() => {
        if (root) act(() => root!.unmount());
        root = null;
        dom?.window.close();
        dom = null;
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        useProjectStore.setState({
            project: createDefaultProject(),
            past: [],
            future: [],
            dragSnapshot: null,
        });
    });

    it('adjusts focus by 0.005 per vertical pixel while D is held', () => {
        const browser = setup();
        act(() => browser.window.dispatchEvent(new browser.window.KeyboardEvent('keydown', {
            key: 'd', bubbles: true,
        })));
        const stage = browser.window.document.querySelector('[tabindex="0"]')!;
        act(() => stage.dispatchEvent(pointer('pointerdown', 1, 200, 200)));
        act(() => browser.window.dispatchEvent(pointer('pointermove', 1, 200, 180)));
        act(() => browser.window.dispatchEvent(pointer('pointerup', 1, 200, 180)));

        expect(useProjectStore.getState().project.shots[0].effects.depthOfField.target.z).toBeCloseTo(0.5);
        expect(useProjectStore.getState().past).toHaveLength(1);
        expect(useProjectStore.getState().dragSnapshot).toBeNull();
    });

    it('uses 0.0005 per pixel for Shift+D fine focus dragging', () => {
        const browser = setup();
        act(() => browser.window.dispatchEvent(new browser.window.KeyboardEvent('keydown', {
            key: 'd', bubbles: true,
        })));
        const stage = browser.window.document.querySelector('[tabindex="0"]')!;
        act(() => stage.dispatchEvent(pointer('pointerdown', 2, 200, 200)));
        act(() => browser.window.dispatchEvent(pointer('pointermove', 2, 200, 180, true)));
        act(() => browser.window.dispatchEvent(pointer('pointerup', 2, 200, 180)));

        expect(useProjectStore.getState().project.shots[0].effects.depthOfField.target.z).toBeCloseTo(0.41);
    });

    it('D-wheel adjusts focus by one notch and enables depth of field', () => {
        const browser = setup(makeProject(false));
        act(() => browser.window.dispatchEvent(new browser.window.KeyboardEvent('keydown', {
            key: 'd', bubbles: true,
        })));
        const stage = browser.window.document.querySelector('[tabindex="0"]')!;
        act(() => stage.dispatchEvent(wheel(-100)));

        const dof = useProjectStore.getState().project.shots[0].effects.depthOfField;
        expect(dof.enabled).toBe(true);
        expect(dof.target.z).toBeCloseTo(0.42);
        expect(pan).not.toHaveBeenCalled();
    });

    it('uses 0.002 depth units per shifted D-wheel notch', () => {
        const browser = setup();
        act(() => browser.window.dispatchEvent(new browser.window.KeyboardEvent('keydown', {
            key: 'd', bubbles: true,
        })));
        const stage = browser.window.document.querySelector('[tabindex="0"]')!;
        act(() => stage.dispatchEvent(wheel(-100, 0, true)));

        expect(useProjectStore.getState().project.shots[0].effects.depthOfField.target.z).toBeCloseTo(0.402);
    });

    it('D-click focuses the picked layer without selecting it', () => {
        const browser = setup();
        act(() => browser.window.dispatchEvent(new browser.window.KeyboardEvent('keydown', {
            key: 'd', bubbles: true,
        })));
        act(() => browser.window.document.querySelector('[data-layer-pick="background"]')!.dispatchEvent(
            new browser.window.MouseEvent('click', { bubbles: true })
        ));

        expect(useProjectStore.getState().project.shots[0].effects.depthOfField.target.z).toBeCloseTo(0.8);
        expect(selectLayer).not.toHaveBeenCalled();
        expect(useProjectStore.getState().past).toHaveLength(1);
    });

    it('does not start a drag transaction for a D-held layer click', () => {
        const browser = setup();
        act(() => browser.window.dispatchEvent(new browser.window.KeyboardEvent('keydown', {
            key: 'd', bubbles: true,
        })));
        const stage = browser.window.document.querySelector('[tabindex="0"]')!;
        const capturePointer = vi.spyOn(browser.window.Element.prototype, 'setPointerCapture');
        act(() => stage.dispatchEvent(pointer('pointerdown', 6, 200, 200)));

        expect(useProjectStore.getState().dragSnapshot).toBeNull();
        expect(capturePointer).not.toHaveBeenCalled();
        capturePointer.mockRestore();
    });

    it('keeps D-drag from also starting a selected-layer transform', () => {
        const browser = setup();
        act(() => browser.window.dispatchEvent(new browser.window.KeyboardEvent('keydown', {
            key: 'd', bubbles: true,
        })));
        const hit = browser.window.document.querySelector('[data-selection-hit]')!;
        act(() => hit.dispatchEvent(pointer('pointerdown', 7, 200, 200)));
        act(() => browser.window.dispatchEvent(pointer('pointermove', 7, 200, 180)));
        act(() => browser.window.dispatchEvent(pointer('pointerup', 7, 200, 180)));

        expect(selectLayer).not.toHaveBeenCalled();
        expect(useProjectStore.getState().project.shots[0].effects.depthOfField.target.z).toBeCloseTo(0.5);
    });

    it('D-click then D+Shift-click creates one undoable rack-focus segment and draws its path', () => {
        const project = makeProject();
        project.shots[0].focusBlocks = [{
            id: 'existing-focus',
            startMs: 100,
            durationMs: 300,
            fromZ: 0.1,
            toZ: 0.3,
            easing: { kind: 'preset', name: 'linear' },
        }];
        const browser = setup(project, 1500);
        act(() => browser.window.dispatchEvent(new browser.window.KeyboardEvent('keydown', {
            key: 'd', bubbles: true,
        })));
        const foreground = browser.window.document.querySelector('[data-layer-pick="foreground"]')!;
        const background = browser.window.document.querySelector('[data-layer-pick="background"]')!;
        act(() => foreground.dispatchEvent(new browser.window.MouseEvent('click', { bubbles: true })));
        const historyBeforeRackFocus = useProjectStore.getState().past.length;
        act(() => background.dispatchEvent(new browser.window.MouseEvent('click', {
            bubbles: true,
            shiftKey: true,
        })));

        const shot = useProjectStore.getState().project.shots[0];
        expect(shot.focusBlocks).toHaveLength(2);
        expect(shot.focusBlocks?.[0]).toMatchObject({ id: 'existing-focus', fromZ: 0.1, toZ: 0.3 });
        expect(shot.focusBlocks?.[1]).toMatchObject({
            startMs: 1500,
            durationMs: 800,
            fromZ: 0.2,
            toZ: 0.8,
            easing: { kind: 'preset', name: 'ease-in-out' },
        });
        expect(useProjectStore.getState().past).toHaveLength(historyBeforeRackFocus + 1);
        expect(selectLayer).not.toHaveBeenCalled();

        const path = browser.window.document.querySelector('[data-rack-focus-path][data-to-depth="0.8"]')!;
        expect(path.getAttribute('data-from-depth')).toBe('0.2');
        expect(path.getAttribute('data-to-depth')).toBe('0.8');
        expect(path.getAttribute('d')).toMatch(/^M [\d.]+,.*[\d.]+,[\d.]+$/);

        act(() => useProjectStore.getState().undo());
        expect(useProjectStore.getState().project.shots[0].focusBlocks).toHaveLength(1);
        expect(useProjectStore.getState().past).toHaveLength(historyBeforeRackFocus);
    });

    it('D+brackets hops focus to the next layer by depth and does not toggle panels', () => {
        const browser = setup();
        act(() => browser.window.dispatchEvent(new browser.window.KeyboardEvent('keydown', {
            key: 'd', bubbles: true,
        })));
        const bracket = new browser.window.KeyboardEvent('keydown', {
            key: ']', code: 'BracketRight', bubbles: true, cancelable: true,
        });
        act(() => browser.window.dispatchEvent(bracket));

        expect(bracket.defaultPrevented).toBe(true);
        expect(useProjectStore.getState().project.shots[0].effects.depthOfField.target.z).toBeCloseTo(0.8);
    });

    it('D-brackets hop to the previous depth without invoking panel shortcuts', () => {
        const browser = setup();
        act(() => browser.window.dispatchEvent(new browser.window.KeyboardEvent('keydown', {
            key: 'd', bubbles: true,
        })));
        const bracket = new browser.window.KeyboardEvent('keydown', {
            key: '[', code: 'BracketLeft', bubbles: true, cancelable: true,
        });
        act(() => browser.window.dispatchEvent(bracket));

        expect(bracket.defaultPrevented).toBe(true);
        expect(useProjectStore.getState().project.shots[0].effects.depthOfField.target.z).toBeCloseTo(0.2);
    });

    it('softly attracts focus toward nearby layer depths while allowing intermediate focus', () => {
        const browser = setup();
        act(() => browser.window.dispatchEvent(new browser.window.KeyboardEvent('keydown', {
            key: 'd', bubbles: true,
        })));
        const stage = browser.window.document.querySelector('[tabindex="0"]')!;
        act(() => stage.dispatchEvent(pointer('pointerdown', 4, 200, 200)));
        act(() => browser.window.dispatchEvent(pointer('pointermove', 4, 200, 130)));
        act(() => browser.window.dispatchEvent(pointer('pointerup', 4, 200, 130)));

        const focusZ = useProjectStore.getState().project.shots[0].effects.depthOfField.target.z;
        expect(focusZ).toBeGreaterThan(0.75);
        expect(focusZ).toBeLessThan(0.8);
    });

    it('shifts both endpoints of the active focus block by the same D-wheel delta', () => {
        const project = makeProject();
        project.shots[0].focusBlocks = [{
            id: 'rack-1',
            startMs: 1000,
            durationMs: 2000,
            fromZ: 0.2,
            toZ: 0.6,
            easing: { kind: 'preset', name: 'linear' },
        }];
        const browser = setup(project, 1500);
        act(() => browser.window.dispatchEvent(new browser.window.KeyboardEvent('keydown', {
            key: 'd', bubbles: true,
        })));
        const stage = browser.window.document.querySelector('[tabindex="0"]')!;
        act(() => stage.dispatchEvent(wheel(-100)));

        const shot = useProjectStore.getState().project.shots[0];
        expect(shot.focusBlocks?.[0].fromZ).toBeCloseTo(0.22);
        expect(shot.focusBlocks?.[0].toZ).toBeCloseTo(0.62);
        expect(shot.effects.depthOfField.target.z).toBeCloseTo(0.4);
    });

    it('edits the latest-starting block when focus blocks overlap', () => {
        const project = makeProject();
        project.shots[0].focusBlocks = [
            {
                id: 'earlier-rack',
                startMs: 1000,
                durationMs: 2000,
                fromZ: 0.2,
                toZ: 0.6,
                easing: { kind: 'preset', name: 'linear' },
            },
            {
                id: 'later-rack',
                startMs: 1200,
                durationMs: 1200,
                fromZ: 0.5,
                toZ: 0.8,
                easing: { kind: 'preset', name: 'linear' },
            },
        ];
        const browser = setup(project, 1500);
        act(() => browser.window.dispatchEvent(new browser.window.KeyboardEvent('keydown', {
            key: 'd', bubbles: true,
        })));
        const stage = browser.window.document.querySelector('[tabindex="0"]')!;
        act(() => stage.dispatchEvent(wheel(-100)));

        const blocks = useProjectStore.getState().project.shots[0].focusBlocks!;
        expect(blocks[0]).toMatchObject({ fromZ: 0.2, toZ: 0.6 });
        expect(blocks[1].fromZ).toBeCloseTo(0.52);
        expect(blocks[1].toZ).toBeCloseTo(0.82);
    });

    it('rolls back a D drag on Escape without leaving an open transaction', () => {
        const browser = setup();
        act(() => browser.window.dispatchEvent(new browser.window.KeyboardEvent('keydown', {
            key: 'd', bubbles: true,
        })));
        const original = useProjectStore.getState().project;
        const stage = browser.window.document.querySelector('[tabindex="0"]')!;
        act(() => stage.dispatchEvent(pointer('pointerdown', 5, 200, 200)));
        act(() => browser.window.dispatchEvent(pointer('pointermove', 5, 200, 160)));
        expect(useProjectStore.getState().project).not.toBe(original);
        act(() => browser.window.dispatchEvent(new browser.window.KeyboardEvent('keydown', {
            key: 'Escape', bubbles: true,
        })));

        expect(useProjectStore.getState().project).toBe(original);
        expect(useProjectStore.getState().past).toHaveLength(0);
        expect(useProjectStore.getState().dragSnapshot).toBeNull();
    });

    it('does not turn ordinary wheel or pointer input into focus edits when D is not held', () => {
        const browser = setup();
        const stage = browser.window.document.querySelector('[tabindex="0"]')!;
        act(() => stage.dispatchEvent(pointer('pointerdown', 3, 200, 200)));
        act(() => browser.window.dispatchEvent(pointer('pointermove', 3, 200, 150)));
        act(() => browser.window.dispatchEvent(pointer('pointerup', 3, 200, 150)));
        act(() => stage.dispatchEvent(wheel(40, 10)));

        expect(useProjectStore.getState().project.shots[0].effects.depthOfField.target.z).toBeCloseTo(0.4);
        expect(pan).toHaveBeenCalledOnce();
    });
});
