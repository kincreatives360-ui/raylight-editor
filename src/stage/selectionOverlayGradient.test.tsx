
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SelectionOverlay } from './SelectionOverlay';
import { createDefaultProject, createDefaultShapeLayer } from '../model/defaults';
import { evaluateProjectAtTime } from '../engine/evaluateShot';

describe('SelectionOverlay Onscreen Gradient Handles', () => {
    it('does not render a second gradient editor merely because a gradient shape is selected', () => {
        const shape = createDefaultShapeLayer({
            id: 'shape-grad-1',
            name: 'Gradient Rect',
            shape: 'rectangle',
            fill: {
                kind: 'gradient',
                angle: 45,
                stops: [
                    { at: 0, color: '#ff007a', opacity: 1 },
                    { at: 1, color: '#00f0ff', opacity: 1 },
                ],
            },
        });

        const project = createDefaultProject();
        project.shots[0].layers = [shape];
        const evaluatedFrame = evaluateProjectAtTime(project, 0);

        const html = renderToStaticMarkup(
            <SelectionOverlay
                frame={evaluatedFrame}
                selectedLayerIds={['shape-grad-1']}
                frameWidth={1920}
                frameHeight={1080}
                snapEnabled={true}
                onUpdateGuides={vi.fn()}
                onSelectLayer={vi.fn()}
            />
        );

        expect(html).not.toContain('data-gradient-handles="true"');
        expect(html).not.toContain('Drag to adjust gradient start position / angle');
        expect(html).not.toContain('Drag to adjust gradient end position / angle');
    });
});
