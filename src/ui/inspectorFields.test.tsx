import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AxisFields } from './AxisFields';
import { AnimationTimingFields } from './AnimationTimingFields';
import { InspectorDisclosure } from './InspectorDisclosure';
import { LightTypeIcon } from './LightTypeIcon';

describe('shared inspector fields', () => {
    it('forwards distinct timing labels, limits, units and callbacks unchanged', () => {
        const onStart = vi.fn();
        const onDuration = vi.fn();
        const start = { label: 'Start', value: 0, min: 0, step: 50, onChange: onStart };
        const duration = { label: 'Length', value: 1, min: 0.1, max: 10, step: 0.1, unit: 's', onChange: onDuration };
        const pair = AnimationTimingFields({ start, duration });
        expect(pair.props.children[0].props).toEqual(start);
        expect(pair.props.children[1].props).toEqual(duration);
        pair.props.children[1].props.onChange(2.5);
        expect(onDuration).toHaveBeenCalledWith(2.5);
        expect(onStart).not.toHaveBeenCalled();
    });

    it('preserves individual axis conversions and allows the caller layout', () => {
        const update = vi.fn();
        const group = AxisFields({ className: 'grid grid-cols-2 gap-1', fields: [
            { key: 'x', label: 'X', value: 50, min: 0, max: 100, unit: '%', onChange: (value) => update(value / 100) },
            { key: 'z', label: 'Depth', value: 2, step: 0.05, decimals: 2, onChange: update },
        ] });
        expect(group.props.className).toBe('grid grid-cols-2 gap-1');
        expect(group.props.children[1].props.step).toBe(0.05);
        group.props.children[0].props.onChange(25);
        expect(update).toHaveBeenCalledWith(0.25);
    });

    it('keeps disclosures open by default and supports controlled closed sections', () => {
        const open = renderToStaticMarkup(<InspectorDisclosure title="Position"><span>Coordinates</span></InspectorDisclosure>);
        expect(open).toContain('aria-expanded="true"');
        expect(open).toContain('Coordinates');
        const closed = renderToStaticMarkup(<InspectorDisclosure title="Position" open={false}><span>Coordinates</span></InspectorDisclosure>);
        expect(closed).toContain('aria-expanded="false"');
        expect(closed).not.toContain('Coordinates');
    });

    it('shares type icons while retaining colored list and white overlay presentations', () => {
        expect(renderToStaticMarkup(<LightTypeIcon type="spot" />)).toContain('text-orange-400');
        const overlay = renderToStaticMarkup(<LightTypeIcon type="spot" className="w-3.5 h-3.5 text-white" />);
        expect(overlay).toContain('text-white');
        expect(overlay).not.toContain('text-orange-400');
        expect(renderToStaticMarkup(<LightTypeIcon type="ambient" />)).toContain('lucide-sun');
    });
});
