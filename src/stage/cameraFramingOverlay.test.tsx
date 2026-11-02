// src/stage/cameraFramingOverlay.test.tsx
import { act, createElement, useSyncExternalStore } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CameraFramingOverlay } from './CameraFramingOverlay';
import { createDefaultCameraBlock, createDefaultProject } from '../model/defaults';
import { useProjectStore } from '../store/useProjectStore';
import { JSDOM } from 'jsdom';

describe('CameraFramingOverlay UI Integration', () => {
    let dom: JSDOM | null = null;
    let root: Root | null = null;

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
    });

    const setupDragTest = () => {
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
        const shot = project.shots[0];
        const block = createDefaultCameraBlock('block-test', 0, 2000, 'f1', 'f2', 'Pan Right');
        project.shots[0] = { ...shot, cameraBlocks: [block] };
        useProjectStore.setState({ project, past: [], future: [], dragSnapshot: null });

        function Harness() {
            const currentProject = useSyncExternalStore(
                useProjectStore.subscribe,
                () => useProjectStore.getState().project
            );
            const currentShot = currentProject.shots[0];
            return createElement(CameraFramingOverlay, {
                shot: currentShot,
                selectedCameraBlockId: block.id,
                frameWidth: 960,
                frameHeight: 540,
            });
        }

        root = createRoot(dom.window.document.getElementById('root')!);
        act(() => root!.render(createElement(Harness)));
        return { shotId: shot.id, blockId: block.id };
    };

    const pointerEvent = (type: string, pointerId: number, x: number, y: number) =>
        Object.assign(new dom!.window.Event(type, { bubbles: true, cancelable: true }), {
            pointerId,
            clientX: x,
            clientY: y,
            button: 0,
            shiftKey: false,
        });

    it('renders From and To framing boxes, interactive Move chip, and corner handles', () => {
        const shot = useProjectStore.getState().project.shots[0];
        const block = createDefaultCameraBlock('block-test', 0, 2000, 'f1', 'f2', 'Pan Right');
        const shotWithBlock = {
            ...shot,
            cameraBlocks: [block],
        };

        const html = renderToStaticMarkup(
            <CameraFramingOverlay
                shot={shotWithBlock}
                selectedCameraBlockId={block.id}
                frameWidth={960}
                frameHeight={540}
            />
        );

        expect(html).toContain('data-camera-endpoint="from"');
        expect(html).toContain('data-camera-endpoint="to"');
        expect(html).toContain('border-dashed border-emerald-400');
        expect(html).toContain('border-solid border-emerald-400');

        // Corner handles for resizing
        expect(html).toContain('Drag to scale From framing (NW)');
        expect(html).toContain('Drag to scale To framing (SE)');
    });

    it('returns null when selectedCameraBlockId does not match any block', () => {
        const shot = useProjectStore.getState().project.shots[0];
        const html = renderToStaticMarkup(
            <CameraFramingOverlay
                shot={shot}
                selectedCameraBlockId="non-existent"
                frameWidth={960}
                frameHeight={540}
            />
        );

        expect(html).toBe('');
    });

    it('keeps camera movement and lens values in the inspector, not on-canvas controls', () => {
        const shot = useProjectStore.getState().project.shots[0];
        const block = createDefaultCameraBlock('block-vertigo', 500, 3500, 'f1', 'f2', 'Vertigo (Dolly Zoom In)');
        block.mode = 'dollyzoom';
        if (block.from && block.to) {
            block.from.focalLength = 24;
            block.to.focalLength = 85;
        }

        const html = renderToStaticMarkup(
            <CameraFramingOverlay
                shot={{ ...shot, cameraBlocks: [block] }}
                selectedCameraBlockId={block.id}
                frameWidth={1920}
                frameHeight={1080}
            />
        );

        expect(html).toContain('data-camera-endpoint="from"');
        expect(html).toContain('data-camera-endpoint="to"');
        expect(html).not.toContain('Vertigo');
        expect(html).not.toContain('24mm');
        expect(html).not.toContain('85mm');
        expect(html).not.toContain('Edit From Camera Controls');
    });

    it.each([
        ['endpoint pan', 'from'],
        ['endpoint resize', 'from-corner'],
    ])('restores camera model updates when %s is canceled', (_name, handle) => {
        const { shotId, blockId } = setupDragTest();
        const originalProject = useProjectStore.getState().project;
        const endpoint = handle === 'from'
            ? dom!.window.document.querySelector('[data-camera-endpoint="from"]')!.parentElement!
            : dom!.window.document.querySelector('[title="Drag to scale From framing (SE)"]')!;
        const pointerId = 41;

        act(() => endpoint.dispatchEvent(pointerEvent('pointerdown', pointerId, 100, 100)));
        act(() => endpoint.dispatchEvent(pointerEvent('pointermove', pointerId, 140, 125)));

        const changedBlock = useProjectStore.getState().project.shots
            .find(shot => shot.id === shotId)!.cameraBlocks!.find(block => block.id === blockId)!;
        expect(changedBlock.from).not.toEqual(originalProject.shots
            .find(shot => shot.id === shotId)!.cameraBlocks![0].from);
        expect(useProjectStore.getState().dragSnapshot).not.toBeNull();

        act(() => endpoint.dispatchEvent(pointerEvent('pointercancel', pointerId, 140, 125)));

        expect(useProjectStore.getState().project).toBe(originalProject);
        expect(useProjectStore.getState().dragSnapshot).toBeNull();
        expect(useProjectStore.getState().past).toHaveLength(0);
    });

    it('gives camera framing handles accessible names, keyboard focus, and arrow adjustments', () => {
        const { shotId, blockId } = setupDragTest();
        const endpoint = dom!.window.document.querySelector('[data-camera-endpoint="from"]')!.parentElement!;
        const resizeHandle = dom!.window.document.querySelector('[title="Drag to scale From framing (SE)"]')!;
        expect(endpoint.getAttribute('aria-label')).toBe('From camera framing; use arrow keys to pan');
        expect(endpoint.getAttribute('role')).toBe('group');
        expect(endpoint.getAttribute('tabindex')).toBe('0');
        expect(resizeHandle.getAttribute('aria-label')).toBe('Resize From camera framing southeast');
        expect(resizeHandle.getAttribute('role')).toBe('button');
        expect(resizeHandle.getAttribute('tabindex')).toBe('0');

        const initial = useProjectStore.getState().project.shots
            .find(shot => shot.id === shotId)!.cameraBlocks!.find(block => block.id === blockId)!;
        act(() => endpoint.dispatchEvent(new dom!.window.KeyboardEvent('keydown', {
            bubbles: true,
            key: 'ArrowRight',
        })));
        const panned = useProjectStore.getState().project.shots
            .find(shot => shot.id === shotId)!.cameraBlocks!.find(block => block.id === blockId)!;
        expect(panned.from!.anchorX).toBe(initial.from!.anchorX + 1);

        act(() => resizeHandle.dispatchEvent(new dom!.window.KeyboardEvent('keydown', {
            bubbles: true,
            key: 'ArrowRight',
        })));
        const resized = useProjectStore.getState().project.shots
            .find(shot => shot.id === shotId)!.cameraBlocks!.find(block => block.id === blockId)!;
        expect(resized.from!.zoom).not.toBe(panned.from!.zoom);
        expect(resized.from!.anchorX).toBe(panned.from!.anchorX);
    });

    it('ignores other pointer IDs and commits a camera drag only on pointer-up', () => {
        const { shotId, blockId } = setupDragTest();
        const endpoint = dom!.window.document.querySelector('[data-camera-endpoint="from"]')!.parentElement!;
        const original = useProjectStore.getState().project.shots
            .find(shot => shot.id === shotId)!.cameraBlocks!.find(block => block.id === blockId)!.from!;

        act(() => endpoint.dispatchEvent(pointerEvent('pointerdown', 41, 100, 100)));
        act(() => endpoint.dispatchEvent(pointerEvent('pointermove', 42, 140, 125)));
        expect(useProjectStore.getState().project.shots
            .find(shot => shot.id === shotId)!.cameraBlocks!.find(block => block.id === blockId)!.from)
            .toEqual(original);
        act(() => endpoint.dispatchEvent(pointerEvent('pointerup', 42, 140, 125)));
        expect(useProjectStore.getState().dragSnapshot).not.toBeNull();

        act(() => endpoint.dispatchEvent(pointerEvent('pointermove', 41, 140, 125)));
        act(() => endpoint.dispatchEvent(pointerEvent('pointerup', 41, 140, 125)));
        expect(useProjectStore.getState().dragSnapshot).toBeNull();
        expect(useProjectStore.getState().past).toHaveLength(1);
    });

    it.each(['Escape', 'lostpointercapture', 'blur', 'unmount'] as const)(
        'rolls back camera framing on %s and ends the drag once',
        reason => {
            const { shotId, blockId } = setupDragTest();
            const original = useProjectStore.getState().project;
            const endpoint = dom!.window.document.querySelector('[data-camera-endpoint="from"]')!.parentElement!;
            const pointerId = 41;
            act(() => endpoint.dispatchEvent(pointerEvent('pointerdown', pointerId, 100, 100)));
            act(() => endpoint.dispatchEvent(pointerEvent('pointermove', pointerId, 140, 125)));

            if (reason === 'Escape') {
                act(() => dom!.window.dispatchEvent(new dom!.window.KeyboardEvent('keydown', {
                    bubbles: true,
                    key: 'Escape',
                })));
            } else if (reason === 'lostpointercapture') {
                act(() => endpoint.dispatchEvent(pointerEvent(reason, pointerId, 140, 125)));
                act(() => endpoint.dispatchEvent(pointerEvent('pointerup', pointerId, 140, 125)));
            } else if (reason === 'blur') {
                act(() => dom!.window.dispatchEvent(new dom!.window.Event('blur')));
            } else {
                act(() => root!.unmount());
                root = null;
            }

            expect(useProjectStore.getState().project).toBe(original);
            expect(useProjectStore.getState().dragSnapshot).toBeNull();
            expect(useProjectStore.getState().past).toHaveLength(0);
            expect(useProjectStore.getState().project.shots
                .find(shot => shot.id === shotId)!.cameraBlocks!.find(block => block.id === blockId)).toBeDefined();
        }
    );
});

describe('Camera framing overlay reference styling', () => {
    it('keeps the canvas overlay to labeled, draggable From and To framing boxes', () => {
        const shot = useProjectStore.getState().project.shots[0];
        const block = createDefaultCameraBlock('block-overlay-reference', 0, 2000);
        const html = renderToStaticMarkup(
            <CameraFramingOverlay
                shot={{ ...shot, cameraBlocks: [block] }}
                selectedCameraBlockId={block.id}
                frameWidth={960}
                frameHeight={540}
            />
        );

        expect(html).toContain('data-camera-endpoint="from"');
        expect(html).toContain('data-camera-endpoint="to"');
        expect(html).toContain('>From</span>');
        expect(html).toContain('>To</span>');
        expect(html).not.toContain('Edit From Camera Controls &amp; Presets');
    });
});
