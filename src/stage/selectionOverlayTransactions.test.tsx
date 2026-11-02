import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { evaluateProjectAtTime } from '../engine/evaluateShot';
import { createDefaultImageLayer, createDefaultProject, createDefaultShapeLayer } from '../model/defaults';
import type { Layer, Project } from '../model/types';
import { useProjectStore } from '../store/useProjectStore';
import { useSelectionStore } from '../store/useSelectionStore';
import { CameraPoseProvider } from './CameraPoseContext';
import { SelectionOverlay } from './SelectionOverlay';

let dom: JSDOM | null = null;
let root: Root | null = null;

function installTestDom() {
    dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost' });
    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);
    vi.stubGlobal('navigator', dom.window.navigator);
    vi.stubGlobal('HTMLElement', dom.window.HTMLElement);
    vi.stubGlobal('SVGElement', dom.window.SVGElement);
    vi.stubGlobal('Node', dom.window.Node);
    vi.stubGlobal('Event', dom.window.Event);
    vi.stubGlobal('MouseEvent', dom.window.MouseEvent);
    vi.stubGlobal('KeyboardEvent', dom.window.KeyboardEvent);
    dom.window.Element.prototype.setPointerCapture = function () {};
    dom.window.Element.prototype.hasPointerCapture = function () { return false; };
    dom.window.Element.prototype.releasePointerCapture = function () {};
    dom.window.Element.prototype.getBoundingClientRect = function () {
        return { x: 0, y: 0, left: 0, top: 0, right: 1920, bottom: 1080, width: 1920, height: 1080, toJSON: () => ({}) };
    };
    return dom;
}

function dispatchPointer(target: EventTarget, type: string, pointerId: number, clientX = 0, clientY = 0) {
    const event = Object.assign(new dom!.window.Event(type, { bubbles: true, cancelable: true }), {
        pointerId,
        clientX,
        clientY,
        altKey: false,
        shiftKey: false,
    });
    act(() => target.dispatchEvent(event));
}

function makeProject(layer: Layer): Project {
    const project = createDefaultProject();
    project.shots[0] = {
        ...project.shots[0],
        isPlaceholder: false,
        layers: [layer],
    };
    return project;
}

function renderSelectionOverlay(project: Project, options: { crop?: boolean; selectedBlockId?: string } = {}) {
    useProjectStore.setState({ project, past: [], future: [], dragSnapshot: null });
    useSelectionStore.setState({
        selectedLayerIds: [project.shots[0].layers[0].id],
        selectedBlockId: options.selectedBlockId ?? null,
        selectedCameraBlockId: null,
        selectedLightBlockId: null,
        selectedLightId: null,
        activeTool: 'select',
        isAnimateMode: false,
        isCropping: Boolean(options.crop),
        canvasZoom: 1,
    });
    const frame = evaluateProjectAtTime(project, 0);
    const container = dom!.window.document.getElementById('root')!;
    root = createRoot(container);
    act(() => root!.render(createElement(
        CameraPoseProvider,
        {
            project,
            frame,
            viewportSize: { width: 1920, height: 1080 },
            activeTool: 'select',
            isPlaying: false,
        },
        createElement(SelectionOverlay, {
            frame,
            selectedLayerIds: [project.shots[0].layers[0].id],
            frameWidth: 1920,
            frameHeight: 1080,
            snapEnabled: false,
            onUpdateGuides: vi.fn(),
            onSelectLayer: vi.fn(),
        }) as ReactNode
    )));
}

function currentLayer(): Layer {
    return useProjectStore.getState().project.shots[0].layers[0];
}

afterEach(() => {
    if (root) act(() => root!.unmount());
    root = null;
    dom?.window.close();
    dom = null;
    vi.unstubAllGlobals();
    useProjectStore.setState({
        project: createDefaultProject(),
        past: [],
        future: [],
        dragSnapshot: null,
    });
    useSelectionStore.setState({
        selectedLayerIds: [],
        selectedBlockId: null,
        isCropping: false,
        isAnimateMode: false,
    });
});

describe('selection overlay drag transactions', () => {
    it.each([
        ['move', () => createDefaultShapeLayer({ id: 'target' }), 'svg polygon.pointer-events-auto', [500, 400], [560, 430]],
        ['resize', () => createDefaultShapeLayer({ id: 'target' }), '[data-selection-handle="e"]', [900, 540], [960, 540]],
        ['rotate', () => createDefaultShapeLayer({ id: 'target' }), '[data-selection-handle="rot-ne"]', [1000, 500], [950, 600]],
        ['crop', () => createDefaultImageLayer({ id: 'target' }), '[data-selection-handle="e"]', [900, 540], [960, 540]],
        ['motion-end', () => createDefaultShapeLayer({
            id: 'target',
            blocks: [{
                id: 'position-block',
                label: 'Move',
                property: 'position',
                startMs: 0,
                durationMs: 1000,
                easing: { kind: 'preset', name: 'linear' },
                amount: { x: 0.1, y: 0.1, z: 0 },
            }],
        }), '.motion-path-gizmo g.cursor-move', [1000, 500], [1050, 550]],
        ['corner-radius', () => createDefaultShapeLayer({ id: 'target' }), '[data-testid="corner-radius-nw"]', [0, 0], [40, 40]],
    ])('the %s handler rolls back its actual edit on pointer-cancel', (path, createLayer, selector, start, end) => {
        const testDom = installTestDom();
        const layer = createLayer();
        const originalProject = makeProject(layer);
        renderSelectionOverlay(originalProject, {
            crop: path === 'crop',
            selectedBlockId: path === 'motion-end' ? 'position-block' : undefined,
        });
        const handle = testDom.window.document.querySelector(selector);
        expect(handle, `${path} handle should render`).not.toBeNull();
        const initialLayer = currentLayer();

        dispatchPointer(handle!, 'pointerdown', 7, start[0], start[1]);
        dispatchPointer(testDom.window, 'pointermove', 7, end[0], end[1]);
        expect(currentLayer()).not.toEqual(initialLayer);
        expect(useProjectStore.getState().dragSnapshot).not.toBeNull();

        dispatchPointer(testDom.window, 'pointercancel', 7);

        expect(useProjectStore.getState().project).toBe(originalProject);
        expect(useProjectStore.getState().dragSnapshot).toBeNull();
        expect(useProjectStore.getState().past).toHaveLength(0);
    });
});
