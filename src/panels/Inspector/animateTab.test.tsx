import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createDefaultProject, createDefaultTextLayer } from '../../model/defaults';
import { createAnimationBlock, createPreset } from './animationModel';
import { LayerAnimateInspector } from './sections/LayerAnimateInspector';
describe('Animate inspector', () => {
    function fixture() {
        const project = createDefaultProject();
        const shot = project.shots[0];
        const layer = createDefaultTextLayer();
        layer.blocks = [];
        layer.entrance = { ...layer.entrance, type: 'none' };
        layer.exit = { ...layer.exit, type: 'none' };
        shot.layers = [layer];
        return { shot, layer };
    }
    it('renders only the three overview rows when empty', () => {
        const { shot, layer } = fixture();
        const html = renderToStaticMarkup(<LayerAnimateInspector activeShot={shot} selectedLayer={layer} selectedLayerIds={[layer.id]}/>);
        for (const label of ['Animations', 'In', 'Out'])
            expect(html).toContain('aria-label="' + label + '"');
        expect(html.match(/<section/g)).toHaveLength(3);
        expect(html).not.toContain('No animations');
        expect(html).not.toContain('animate-block-fields');
    });
    it('renders applied preset actions and property controls in reference order', () => {
        const { shot, layer } = fixture();
        layer.entrances = [createPreset('blur', 'in', shot.durationMs)];
        layer.exits = [createPreset('typewriter', 'out', shot.durationMs)];
        layer.blocks = [createAnimationBlock('shimmer', shot, 0)];
        const html = renderToStaticMarkup(<LayerAnimateInspector activeShot={shot} selectedLayer={layer} selectedLayerIds={[layer.id]}/>);
        for (const label of ['Edit in Blur', 'Disable in Blur', 'Remove in Blur', 'Edit out Typewriter', 'Shimmer intensity', 'Width', 'Easing'])
            expect(html).toContain('aria-label="' + label + '"');
        expect(html).toContain('>Color</span>');
        expect(html.indexOf('aria-label="Out"')).toBeLessThan(html.indexOf('aria-label="Shimmer"'));
        expect(html).toContain('aria-label="right" aria-pressed="true"');
    });
});
