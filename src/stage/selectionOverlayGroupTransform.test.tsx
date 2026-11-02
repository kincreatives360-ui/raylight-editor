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
import { evaluateCameraPose, getLayerProjectedCorners } from './webgl/cameraMath';

let dom: JSDOM | null = null;
let root: Root | null = null;

function installTestDom() {
    dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost' });
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
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
        return { x: 120, y: 80, left: 120, top: 80, right: 2040, bottom: 1160, width: 1920, height: 1080, toJSON: () => ({}) };
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

function makeProject(layers: Layer[]): Project {
    const project = createDefaultProject();
    project.shots[0] = {
        ...project.shots[0],
        isPlaceholder: false,
        layers,
    };
    return project;
}

function renderSelectionOverlay(
    project: Project,
    selectedLayerIds: string[],
    options: { canvasZoom?: number; animateMode?: boolean; crop?: boolean } = {}
) {
    useProjectStore.setState({ project, past: [], future: [], dragSnapshot: null });
    useSelectionStore.setState({
        selectedLayerIds,
        selectedBlockId: null,
        selectedCameraBlockId: null,
        selectedLightBlockId: null,
        selectedLightId: null,
        activeTool: 'select',
        isAnimateMode: Boolean(options.animateMode),
        isCropping: Boolean(options.crop),
        canvasZoom: options.canvasZoom ?? 1,
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
            selectedLayerIds,
            frameWidth: 1920,
            frameHeight: 1080,
            snapEnabled: false,
            onUpdateGuides: vi.fn(),
            onSelectLayer: vi.fn(),
        }) as ReactNode
    )));
}

function getLayer(id: string): Layer {
    return useProjectStore.getState().project.shots[0].layers.find((layer) => layer.id === id)!;
}

function getProjectedCenters(project: Project) {
    const frame = evaluateProjectAtTime(project, 0);
    const aspect = 16 / 9;
    const cameraPose = evaluateCameraPose(
        frame.camera,
        project.defaultCamera ?? {
            position: { x: 0, y: 0, z: 2.65 },
            rotation: { x: 0, y: 0, z: 0 },
            focalLength: 50,
        },
        aspect
    );
    return new Map(frame.layers.map((layer) => [
        layer.id,
        getLayerProjectedCorners(layer, 1920, 1080, aspect, cameraPose, 2.65, 50).pCenter,
    ]));
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

describe('selection overlay group transforms', () => {
    it('places resize handles at the union of the selected projected layer bounds', () => {
        const testDom = installTestDom();
        const layers = [
            createDefaultShapeLayer({
                id: 'left-layer',
                position: { x: -0.35, y: 0.1, z: 0.1 },
                size: { width: 0.2, height: 0.12 },
            }),
            createDefaultShapeLayer({
                id: 'right-layer',
                position: { x: 0.32, y: -0.18, z: 0.45 },
                size: { width: 0.28, height: 0.2 },
            }),
        ];
        const project = makeProject(layers);
        const frame = evaluateProjectAtTime(project, 0);
        const rects = layers.map((layer) => {
            const evaluated = frame.layers.find((item) => item.id === layer.id)!;
            const points = getLayerProjectedCorners(evaluated, 1920, 1080, 16 / 9).corners;
            return {
                left: Math.min(...points.map((point) => point.x)),
                top: Math.min(...points.map((point) => point.y)),
                right: Math.max(...points.map((point) => point.x)),
                bottom: Math.max(...points.map((point) => point.y)),
            };
        });
        const expected = {
            left: Math.min(...rects.map((rect) => rect.left)),
            top: Math.min(...rects.map((rect) => rect.top)),
            right: Math.max(...rects.map((rect) => rect.right)),
            bottom: Math.max(...rects.map((rect) => rect.bottom)),
        };
        renderSelectionOverlay(project, layers.map((layer) => layer.id));

        const eastHandle = testDom.window.document.querySelector('[data-selection-handle="e"]') as HTMLElement;
        const groupBounds = testDom.window.document.querySelector('[data-selection-group-bounds="true"]');
        expect(groupBounds).not.toBeNull();
        expect(eastHandle.style.left).toBe(`${expected.right}px`);
        expect(eastHandle.style.top).toBe(`${(expected.top + expected.bottom) / 2}px`);
    });

    it('resizes every selected layer while preserving depth and pitch/yaw in one undo transaction', () => {
        const testDom = installTestDom();
        const layers = [
            createDefaultShapeLayer({
                id: 'left-layer',
                position: { x: -0.35, y: 0.1, z: 0.1 },
                rotation: { x: 0.2, y: -0.15, z: 0.1 },
                size: { width: 0.2, height: 0.12 },
            }),
            createDefaultShapeLayer({
                id: 'right-layer',
                position: { x: 0.32, y: -0.18, z: 0.45 },
                rotation: { x: -0.1, y: 0.25, z: -0.2 },
                size: { width: 0.28, height: 0.2 },
            }),
        ];
        const project = makeProject(layers);
        renderSelectionOverlay(project, layers.map((layer) => layer.id));
        const initial = layers.map((layer) => ({ ...layer }));
        const initialCenters = getProjectedCenters(project);
        const groupBounds = testDom.window.document.querySelector('[data-selection-group-bounds="true"]') as SVGRectElement;
        const anchorX = Number(groupBounds.getAttribute('x'));
        const groupWidth = Number(groupBounds.getAttribute('width'));
        const scaleX = 1 + 80 / groupWidth;
        const handle = testDom.window.document.querySelector('[data-selection-handle="e"]')!;

        dispatchPointer(handle, 'pointerdown', 1, 1500, 540);
        dispatchPointer(testDom.window, 'pointermove', 1, 1580, 540);

        const updatedCenters = getProjectedCenters(useProjectStore.getState().project);
        for (let index = 0; index < layers.length; index += 1) {
            const before = initial[index];
            const after = getLayer(layers[index].id);
            const initialCenter = initialCenters.get(layers[index].id)!;
            const updatedCenter = updatedCenters.get(layers[index].id)!;
            expect(after.position.x).not.toBe(before.position.x);
            expect(after.size.width).toBeGreaterThan(before.size.width);
            expect(updatedCenter.x).toBeCloseTo(anchorX + (initialCenter.x - anchorX) * scaleX, 0);
            expect(updatedCenter.y).toBeCloseTo(initialCenter.y, 0);
            expect(after.position.z).toBe(before.position.z);
            expect(after.rotation.x).toBe(before.rotation.x);
            expect(after.rotation.y).toBe(before.rotation.y);
        }

        dispatchPointer(testDom.window, 'pointerup', 1, 1580, 540);
        expect(useProjectStore.getState().past).toHaveLength(1);
        expect(useProjectStore.getState().dragSnapshot).toBeNull();
    });

    it('rotates all selected layer centers around the group center and preserves depth and pitch/yaw', () => {
        const testDom = installTestDom();
        const layers = [
            createDefaultShapeLayer({
                id: 'left-layer',
                position: { x: -0.35, y: 0.1, z: 0.1 },
                rotation: { x: 0.2, y: -0.15, z: 0.1 },
            }),
            createDefaultShapeLayer({
                id: 'right-layer',
                position: { x: 0.32, y: -0.18, z: 0.45 },
                rotation: { x: -0.1, y: 0.25, z: -0.2 },
            }),
        ];
        const project = makeProject(layers);
        const canvasZoom = 1.5;
        renderSelectionOverlay(project, layers.map((layer) => layer.id), { canvasZoom });
        const initial = layers.map((layer) => ({ ...layer }));
        const initialCenters = getProjectedCenters(project);
        const rotateHandle = testDom.window.document.querySelector('[data-selection-handle="rot-ne"]')!;
        const bounds = testDom.window.document.querySelector('[data-selection-group-bounds="true"]')!;
        const groupRect = bounds as SVGRectElement;
        const centerX = Number(groupRect.getAttribute('x')) + Number(groupRect.getAttribute('width')) / 2;
        const centerY = Number(groupRect.getAttribute('y')) + Number(groupRect.getAttribute('height')) / 2;

        const clientCenterX = 120 + centerX * canvasZoom;
        const clientCenterY = 80 + centerY * canvasZoom;
        dispatchPointer(rotateHandle, 'pointerdown', 2, clientCenterX + 100, clientCenterY);
        dispatchPointer(testDom.window, 'pointermove', 2, clientCenterX, clientCenterY + 100);

        const updatedCenters = getProjectedCenters(useProjectStore.getState().project);
        for (let index = 0; index < layers.length; index += 1) {
            const before = initial[index];
            const after = getLayer(layers[index].id);
            const initialCenter = initialCenters.get(layers[index].id)!;
            const updatedCenter = updatedCenters.get(layers[index].id)!;
            const offsetX = initialCenter.x - centerX;
            const offsetY = initialCenter.y - centerY;
            expect(after.position.x).not.toBe(before.position.x);
            expect(after.position.y).not.toBe(before.position.y);
            expect(updatedCenter.x).toBeCloseTo(centerX - offsetY, 0);
            expect(updatedCenter.y).toBeCloseTo(centerY + offsetX, 0);
            expect(after.rotation.z).toBeCloseTo(before.rotation.z + Math.PI / 2, 4);
            expect(after.position.z).toBe(before.position.z);
            expect(after.rotation.x).toBe(before.rotation.x);
            expect(after.rotation.y).toBe(before.rotation.y);
        }

        dispatchPointer(testDom.window, 'pointerup', 2, clientCenterX, clientCenterY + 100);
        expect(useProjectStore.getState().past).toHaveLength(1);
    });

    it('exposes keyboard-adjustable resize and rotation controls with accessible names', () => {
        const testDom = installTestDom();
        const layers = [
            createDefaultShapeLayer({ id: 'left-layer', position: { x: -0.3, y: 0, z: 0.1 } }),
            createDefaultShapeLayer({ id: 'right-layer', position: { x: 0.3, y: 0, z: 0.3 } }),
        ];
        renderSelectionOverlay(makeProject(layers), layers.map((layer) => layer.id));
        const resizeHandle = testDom.window.document.querySelector('[data-selection-handle="e"]') as HTMLElement;
        const rotateHandle = testDom.window.document.querySelector('[data-selection-handle="rot-ne"]') as HTMLElement;
        const transformHandles = testDom.window.document.querySelectorAll('button[data-selection-handle]');

        expect(transformHandles).toHaveLength(12);
        transformHandles.forEach((handle) => {
            expect(handle.getAttribute('aria-label')).toBeTruthy();
            expect((handle as HTMLElement).tabIndex).toBe(0);
        });
        expect(resizeHandle.tagName).toBe('BUTTON');
        expect(resizeHandle.getAttribute('aria-label')).toBe('Resize selection east');
        expect(resizeHandle.tabIndex).toBe(0);
        expect(rotateHandle.tagName).toBe('BUTTON');
        expect(rotateHandle.getAttribute('aria-label')).toBe('Rotate selection from northeast corner');
        expect(rotateHandle.tabIndex).toBe(0);
        resizeHandle.focus();
        expect(testDom.window.document.activeElement).toBe(resizeHandle);

        const initialWidth = (getLayer('left-layer') as ReturnType<typeof createDefaultShapeLayer>).size.width;
        const initialRotation = getLayer('left-layer').rotation.z;
        act(() => resizeHandle.dispatchEvent(new testDom.window.KeyboardEvent('keydown', {
            key: 'ArrowRight',
            bubbles: true,
            cancelable: true,
        })));
        expect((getLayer('left-layer') as ReturnType<typeof createDefaultShapeLayer>).size.width).toBeGreaterThan(initialWidth);
        act(() => rotateHandle.dispatchEvent(new testDom.window.KeyboardEvent('keydown', {
            key: 'ArrowRight',
            bubbles: true,
            cancelable: true,
        })));
        expect(getLayer('left-layer').rotation.z).toBeGreaterThan(initialRotation);
    });

    it('records group resize pointer transforms as size and position keyframes without changing base layers', () => {
        const testDom = installTestDom();
        const layers = [
            createDefaultShapeLayer({ id: 'left-layer', position: { x: -0.3, y: 0.05, z: 0.1 } }),
            createDefaultShapeLayer({ id: 'right-layer', position: { x: 0.3, y: -0.05, z: 0.3 } }),
        ];
        renderSelectionOverlay(makeProject(layers), layers.map((layer) => layer.id), { animateMode: true });
        const initial = layers.map((layer) => structuredClone(layer));
        const handle = testDom.window.document.querySelector('[data-selection-handle="e"]')!;

        dispatchPointer(handle, 'pointerdown', 3, 1500, 540);
        dispatchPointer(testDom.window, 'pointermove', 3, 1560, 540);

        for (const [index, layer] of layers.entries()) {
            const after = getLayer(layer.id);
            expect(after.position).toEqual(initial[index].position);
            expect((after as ReturnType<typeof createDefaultShapeLayer>).size).toEqual(initial[index].size);
            expect(after.blocks.some((block) => block.property === 'size' && typeof block.amount === 'object'
                && (block.amount.x !== 0 || block.amount.y !== 0))).toBe(true);
            expect(after.blocks.some((block) => block.property === 'position' && typeof block.amount === 'object'
                && (block.amount.x !== 0 || block.amount.y !== 0))).toBe(true);
        }
        const animatedFrame = evaluateProjectAtTime(useProjectStore.getState().project, 200);
        for (const layer of layers) {
            const animatedLayer = animatedFrame.layers.find((item) => item.id === layer.id)!;
            expect(animatedLayer.size.width).toBeGreaterThan(layer.size.width);
        }

        dispatchPointer(testDom.window, 'pointerup', 3, 1560, 540);
        expect(useProjectStore.getState().past).toHaveLength(1);
    });

    it('records group rotation pointer transforms as rotation and position keyframes without changing base layers', () => {
        const testDom = installTestDom();
        const layers = [
            createDefaultShapeLayer({ id: 'left-layer', position: { x: -0.3, y: 0.05, z: 0.1 } }),
            createDefaultShapeLayer({ id: 'right-layer', position: { x: 0.3, y: -0.05, z: 0.3 } }),
        ];
        renderSelectionOverlay(makeProject(layers), layers.map((layer) => layer.id), { animateMode: true });
        const initial = layers.map((layer) => structuredClone(layer));
        const bounds = testDom.window.document.querySelector('[data-selection-group-bounds="true"]') as SVGRectElement;
        const centerX = Number(bounds.getAttribute('x')) + Number(bounds.getAttribute('width')) / 2;
        const centerY = Number(bounds.getAttribute('y')) + Number(bounds.getAttribute('height')) / 2;
        const handle = testDom.window.document.querySelector('[data-selection-handle="rot-ne"]')!;

        dispatchPointer(handle, 'pointerdown', 4, centerX + 100, centerY);
        dispatchPointer(testDom.window, 'pointermove', 4, centerX, centerY + 100);

        for (const [index, layer] of layers.entries()) {
            const after = getLayer(layer.id);
            expect(after.position).toEqual(initial[index].position);
            expect(after.rotation).toEqual(initial[index].rotation);
            expect(after.blocks.some((block) => block.property === 'rotation' && typeof block.amount === 'object'
                && Math.abs(block.amount.z) > 0.1)).toBe(true);
            expect(after.blocks.some((block) => block.property === 'position' && typeof block.amount === 'object'
                && Math.abs(block.amount.x) + Math.abs(block.amount.y) > 0.01)).toBe(true);
        }
        const animatedFrame = evaluateProjectAtTime(useProjectStore.getState().project, 200);
        for (const layer of layers) {
            const animatedLayer = animatedFrame.layers.find((item) => item.id === layer.id)!;
            expect(animatedLayer.rotation.z).not.toBe(layer.rotation.z);
            expect(animatedLayer.position.x).not.toBe(layer.position.x);
        }

        dispatchPointer(testDom.window, 'pointerup', 4, centerX, centerY + 100);
        expect(useProjectStore.getState().past).toHaveLength(1);
    });

    it('records keyboard group resize and rotation as keyframes in separate undo transactions', () => {
        const testDom = installTestDom();
        const layers = [
            createDefaultShapeLayer({ id: 'left-layer', position: { x: -0.3, y: 0.05, z: 0.1 } }),
            createDefaultShapeLayer({ id: 'right-layer', position: { x: 0.3, y: -0.05, z: 0.3 } }),
        ];
        renderSelectionOverlay(makeProject(layers), layers.map((layer) => layer.id), { animateMode: true });
        const initial = layers.map((layer) => structuredClone(layer));
        const resizeHandle = testDom.window.document.querySelector('[data-selection-handle="e"]')!;
        const rotateHandle = testDom.window.document.querySelector('[data-selection-handle="rot-ne"]')!;

        act(() => resizeHandle.dispatchEvent(new testDom.window.KeyboardEvent('keydown', {
            key: 'ArrowRight', bubbles: true, cancelable: true,
        })));
        expect(useProjectStore.getState().past).toHaveLength(1);
        act(() => rotateHandle.dispatchEvent(new testDom.window.KeyboardEvent('keydown', {
            key: 'ArrowRight', bubbles: true, cancelable: true,
        })));

        for (const [index, layer] of layers.entries()) {
            const after = getLayer(layer.id);
            expect(after.position).toEqual(initial[index].position);
            expect((after as ReturnType<typeof createDefaultShapeLayer>).size).toEqual(initial[index].size);
            expect(after.rotation).toEqual(initial[index].rotation);
            expect(after.blocks.some((block) => block.property === 'size')).toBe(true);
            expect(after.blocks.some((block) => block.property === 'rotation')).toBe(true);
            expect(after.blocks.some((block) => block.property === 'position')).toBe(true);
        }
        expect(useProjectStore.getState().past).toHaveLength(2);
    });

    it('uses the primary image bounds and crop operation when cropping alongside a multi-selection', () => {
        const testDom = installTestDom();
        const image = createDefaultImageLayer({
            id: 'primary-image',
            position: { x: -0.2, y: 0, z: 0.1 },
            size: { width: 0.3, height: 0.2 },
        });
        const other = createDefaultShapeLayer({
            id: 'other-layer',
            position: { x: 0.3, y: 0, z: 0.3 },
        });
        const project = makeProject([image, other]);
        const frame = evaluateProjectAtTime(project, 0);
        const evaluatedImage = frame.layers.find((layer) => layer.id === image.id)!;
        const projectedImage = getLayerProjectedCorners(evaluatedImage, 1920, 1080, 16 / 9);
        const expectedRight = Math.max(...projectedImage.corners.map((point) => point.x));
        renderSelectionOverlay(project, [image.id, other.id], { crop: true });
        const eastHandle = testDom.window.document.querySelector('[data-selection-handle="e"]') as HTMLElement;

        expect(testDom.window.document.querySelector('[data-selection-group-bounds="true"]')).toBeNull();
        expect(eastHandle.style.left).toBe(`${expectedRight}px`);
        expect(eastHandle.getAttribute('aria-label')).toBe('Adjust crop east');

        dispatchPointer(eastHandle, 'pointerdown', 5, 1500, 540);
        dispatchPointer(testDom.window, 'pointermove', 5, 1440, 540);

        expect((getLayer(image.id) as ReturnType<typeof createDefaultImageLayer>).crop).not.toEqual(image.crop);
        expect(getLayer(other.id)).toEqual(other);
        dispatchPointer(testDom.window, 'pointerup', 5, 1440, 540);

        const cropBeforeKeyboard = (getLayer(image.id) as ReturnType<typeof createDefaultImageLayer>).crop!;
        act(() => eastHandle.dispatchEvent(new testDom.window.KeyboardEvent('keydown', {
            key: 'ArrowRight', bubbles: true, cancelable: true,
        })));
        const cropAfterKeyboard = (getLayer(image.id) as ReturnType<typeof createDefaultImageLayer>).crop!;
        expect(cropAfterKeyboard.width).toBeGreaterThan(cropBeforeKeyboard.width);
        expect(getLayer(other.id)).toEqual(other);
        expect(useProjectStore.getState().past).toHaveLength(2);
    });
});
