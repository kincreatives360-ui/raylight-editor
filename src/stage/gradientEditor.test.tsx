import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GradientEditor } from './GradientEditor';
import { createDefaultProject, createDefaultShapeLayer } from '../model/defaults';
import { ProjectSchema } from '../model/schema';
import { registerGradientDragCancellation } from './gradientDragCancellation';
import { useProjectStore } from '../store/useProjectStore';

describe('canvas gradient editor', () => {
    afterEach(() => {
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
    ])('cancels a drag on %s', (_reason, makeEvent) => {
        const eventWindow = new EventTarget();
        const store = useProjectStore.getState();
        const startingProject = store.project;
        store.beginDragTransaction();
        store.updateProject(project => ({ ...project, name: 'Canceled gradient edit' }), { skipHistory: true });
        const removeListeners = registerGradientDragCancellation(
            eventWindow,
            vi.fn(store.cancelDragTransaction)
        );

        eventWindow.dispatchEvent(makeEvent());

        expect(useProjectStore.getState().project).toBe(startingProject);
        expect(useProjectStore.getState().dragSnapshot).toBeNull();
        expect(useProjectStore.getState().past).toHaveLength(0);
        removeListeners();
        eventWindow.dispatchEvent(makeEvent());
        expect(useProjectStore.getState().project).toBe(startingProject);
    });
});
