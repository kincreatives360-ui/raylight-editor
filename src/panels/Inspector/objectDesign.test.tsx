import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultImageLayer, createDefaultProject, createDefaultShapeLayer, createDefaultTextLayer } from '../../model/defaults';
import type { Layer } from '../../model/types';
import { useProjectStore } from '../../store/useProjectStore';
import { useSelectionStore } from '../../store/useSelectionStore';
import { RightSidebar } from './RightSidebar';
vi.mock('../../store/useProjectStore', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../store/useProjectStore')>();
    const hook = (selector?: (state: ReturnType<typeof actual.useProjectStore.getState>) => unknown) =>
        selector ? selector(actual.useProjectStore.getState()) : actual.useProjectStore.getState();
    return { ...actual, useProjectStore: Object.assign(hook, actual.useProjectStore) };
});

vi.mock('../../store/useSelectionStore', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../store/useSelectionStore')>();
    const hook = (selector?: (state: ReturnType<typeof actual.useSelectionStore.getState>) => unknown) =>
        selector ? selector(actual.useSelectionStore.getState()) : actual.useSelectionStore.getState();
    return { ...actual, useSelectionStore: Object.assign(hook, actual.useSelectionStore) };
});


function render(layer: Layer) {
    const project = createDefaultProject(); project.shots[0].layers = [layer];
    useProjectStore.setState({ project });
    useSelectionStore.setState({ inspectorTab: 'layer', selectedLayerIds: [layer.id], selectedBlockId: null, selectedCameraBlockId: null, selectedLightBlockId: null, selectedLightId: null });
    return renderToStaticMarkup(<RightSidebar activeShot={project.shots[0]} selectedLayer={layer} selectedLayerIds={[layer.id]} onSwapImageClick={() => { }} onOpenExportModal={() => { }} />);
}
describe('reference object Design inspectors', () => {
    beforeEach(() => useSelectionStore.getState().selectProject());
    for (const shape of ['rectangle', 'ellipse', 'polygon', 'line'] as const) it('shares one geometry inspector for ' + shape, () => {
        const html = render(createDefaultShapeLayer({ shape }));
        expect(html).toContain('data-testid="object-design-inspector"');
        for (const name of ['Position', 'Tilt', 'Layout', 'Appearance', 'Fill', 'Stroke', 'Mask', 'Layer effects']) expect(html).toContain('aria-label="' + name + '"');
        expect((html.match(/aria-label="Position"/g) || []).length).toBe(1);
        expect((html.match(/aria-label="Tilt"/g) || []).length).toBe(1);
        const fill = html.match(/<button[^>]*aria-label="Gradient"[^>]*>([\s\S]*?)<\/button>/)?.[1];
        expect(fill).not.toContain('<button');
    });
    it('orders image sections like the reference and preserves hardware controls', () => {
        const html = render(createDefaultImageLayer());
        const names = ['Image', 'Position', 'Tilt', 'Layout', 'Appearance', 'Stroke', 'Frame', 'Staging', 'Layer effects'];
        let last = -1; for (const name of names) { const index = html.indexOf('aria-label="' + name + '"'); expect(index, name).toBeGreaterThan(last); last = index; }
        expect(html).toContain('Swap source');
    });
    it('retains editable line height when reloading a project', () => { const layer = createDefaultTextLayer(); layer.font.lineHeight = 1.6; const p = createDefaultProject(); p.shots[0].layers = [layer]; useProjectStore.getState().loadProjectJson(p); const loaded = useProjectStore.getState().project.shots[0].layers[0]; expect(loaded.kind === 'text' && loaded.font.lineHeight).toBe(1.6); });
    it('puts text content first and typography after mask and effects', () => {
        const html = render(createDefaultTextLayer());
        expect(html).toContain('aria-label="Content"');
        expect(html.indexOf('aria-label="Content"')).toBeLessThan(html.indexOf('aria-label="Position"'));
        expect(html.indexOf('aria-label="Typography"')).toBeGreaterThan(html.indexOf('aria-label="Layer effects"'));
        expect(html).toContain('aria-label="Fill"');
        expect(html).not.toContain('Text Content');
    });
});
