import { act, createElement, useSyncExternalStore } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GradientEditor } from './GradientEditor';
import { createDefaultProject, createDefaultShapeLayer } from '../model/defaults';
import { ProjectSchema } from '../model/schema';
import { useProjectStore } from '../store/useProjectStore';
import { JSDOM } from 'jsdom';

describe('canvas gradient editor', () => {
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
    const fill = { kind: 'gradient' as const, angle: 90, stops: [{ at: 0, color: '#ff0000' }, { at: .4, color: '#00ff00' }, { at: 1, color: '#0000ff' }] };
    const render = (handles?: { start: { x: number; y: number }; end: { x: number; y: number } }) => renderToStaticMarkup(createElement(GradientEditor, {
        fill: { ...fill, handles }, corners: [{ x: 10, y: 10 }, { x: 110, y: 10 }, { x: 110, y: 110 }, { x: 10, y: 110 }],
        width: 200, height: 200, onChange: vi.fn(), begin: vi.fn(), commit: vi.fn(),
    }));
    it('sizes the initial horizontal line to the shape and shows every stop color', () => {
        const html = render();
        expect(html).not.toContain('Gradient controls');
        expect(html).not.toContain('Stop position');
        expect(html).not.toContain('Ellipse radius');
        expect(html).toContain('x1="10"');
        expect(html).toContain('x2="110"');
        expect(html).toContain('fill="#ff0000"');
        expect(html).toContain('fill="#00ff00"');
        expect(html).toContain('fill="#0000ff"');
        expect(html).toContain('cx="50"');
    });
    it('allows custom endpoints outside the shape', () => {
        const html = render({ start: { x: -.5, y: .5 }, end: { x: 1.5, y: .5 } });
        expect(html).toContain('x1="-40"');
        expect(html).toContain('x2="160"');
    });
    it('retains custom endpoints through project validation', () => {
        const project = createDefaultProject();
        const handles = { start: { x: -.5, y: .5 }, end: { x: 1.5, y: .5 } };
        project.shots[0].layers = [createDefaultShapeLayer({ fill: { ...fill, handles } })];
        const loaded = ProjectSchema.parse(project).shots[0].layers[0];
        expect(loaded.kind === 'shape' && loaded.fill.kind === 'gradient' && loaded.fill.handles).toEqual(handles);
    });
    it.each([
        ['Escape', () => Object.assign(new Event('keydown'), { key: 'Escape' })],
        ['window blur', () => new Event('blur')],
        ['pointer-cancel', () => Object.assign(new Event('pointercancel', { bubbles: true }), { pointerId: 7 })],
        ['lost pointer capture', () => Object.assign(new Event('lostpointercapture', { bubbles: true }), { pointerId: 7 })],
    ])('the GradientEditor drag handler restores its model on %s', (_reason, makeEvent) => {
        dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost' });
        vi.stubGlobal('window', dom.window);
        vi.stubGlobal('document', dom.window.document);
        vi.stubGlobal('navigator', dom.window.navigator);
        vi.stubGlobal('HTMLElement', dom.window.HTMLElement);
        vi.stubGlobal('SVGElement', dom.window.SVGElement);
        vi.stubGlobal('Node', dom.window.Node);
        vi.stubGlobal('Event', dom.window.Event);
        dom.window.Element.prototype.setPointerCapture = function () {};
        dom.window.Element.prototype.hasPointerCapture = function () { return false; };
        dom.window.Element.prototype.releasePointerCapture = function () {};
        dom.window.SVGSVGElement.prototype.getScreenCTM = () => ({
            inverse: () => ({}),
        }) as DOMMatrix;
        vi.stubGlobal('DOMPoint', class {
            constructor(public x: number, public y: number) {}
            matrixTransform() { return this; }
        });

        const layer = createDefaultShapeLayer({ id: 'gradient-layer' });
        const project = createDefaultProject();
        project.shots[0] = { ...project.shots[0], isPlaceholder: false, layers: [layer] };
        useProjectStore.setState({ project, past: [], future: [], dragSnapshot: null });
        function GradientHarness() {
            const currentProject = useSyncExternalStore(
                useProjectStore.subscribe,
                () => useProjectStore.getState().project
            );
            const currentLayer = currentProject.shots[0].layers[0];
            if (currentLayer.kind !== 'shape' || currentLayer.fill.kind !== 'gradient') return null;
            return createElement(GradientEditor, {
                fill: currentLayer.fill,
                corners: [{ x: 10, y: 10 }, { x: 110, y: 10 }, { x: 110, y: 110 }, { x: 10, y: 110 }],
                width: 200,
                height: 200,
                begin: () => useProjectStore.getState().beginDragTransaction(),
                commit: () => useProjectStore.getState().commitDragTransaction(),
                onChange: fill => useProjectStore.getState().updateLayer(
                    project.shots[0].id,
                    layer.id,
                    value => value.kind === 'shape' ? { ...value, fill } : value,
                    { skipHistory: true }
                ),
            });
        }

        root = createRoot(dom.window.document.getElementById('root')!);
        act(() => root!.render(createElement(GradientHarness)));
        const svg = dom.window.document.querySelector('svg[data-gradient-editor="true"]')!;
        const endHandle = svg.querySelector('[data-mode="end"]')!;
        const pointerDown = Object.assign(new dom.window.Event('pointerdown', { bubbles: true, cancelable: true }), {
            pointerId: 7,
            clientX: 60,
            clientY: 60,
            shiftKey: false,
        });
        act(() => endHandle.dispatchEvent(pointerDown));
        const pointerMove = Object.assign(new dom.window.Event('pointermove', { bubbles: true, cancelable: true }), {
            pointerId: 7,
            clientX: 90,
            clientY: 75,
            shiftKey: false,
        });
        act(() => svg.dispatchEvent(pointerMove));

        expect(useProjectStore.getState().project).not.toEqual(project);
        expect(useProjectStore.getState().dragSnapshot).not.toBeNull();
        if (_reason === 'pointer-cancel' || _reason === 'lost pointer capture') {
            act(() => svg.dispatchEvent(makeEvent()));
        } else {
            const cancelEvent = makeEvent();
            act(() => dom!.window.dispatchEvent(cancelEvent));
        }

        expect(useProjectStore.getState().project).toBe(project);
        expect(useProjectStore.getState().dragSnapshot).toBeNull();
        expect(useProjectStore.getState().past).toHaveLength(0);
    });
});
