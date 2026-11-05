import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DragTimeBadge, TimelineDragPreview } from './TimelineDragPreview';
import { TimelineRangeBar, TrimHandle } from './TimelineRangeBar';

describe('timeline shared presentation', () => {
    it('keeps each preview width floor and its duration/start badge variant', () => {
        for (const minWidth of [28, 32, 36]) {
            const markup = renderToStaticMarkup(<TimelineDragPreview startMs={1250} durationMs={500} pxPerMs={0.01} minWidth={minWidth} variant={minWidth === 32 ? 'layer' : 'pill'} showStart={minWidth !== 28} snapped />);
            expect(markup).toContain(`left:12.5px;width:${minWidth}px`);
            expect(markup).toContain('0.50s');
            expect(markup.includes('1.25s')).toBe(minWidth !== 28);
            expect(markup).toContain('🧲');
            expect(markup).toContain('pointer-events-none');
        }
    });
    it('keeps zero start times and omits unsnapped indicators', () => {
        const markup = renderToStaticMarkup(<DragTimeBadge startMs={0} durationMs={1234} />);
        expect(markup).toContain('0.00s');
        expect(markup).toContain('1.23s');
        expect(markup).not.toContain('🧲');
    });
    it('forwards range and trim event handlers, data markers and domain styles', () => {
        const onPointerDown = vi.fn();
        const onClick = vi.fn();
        const bar = TimelineRangeBar({ left: 25, width: 40, onPointerDown, onClick, 'aria-label': 'Camera', className: 'border-emerald-300' });
        expect(bar.props.onPointerDown).toBe(onPointerDown);
        expect(bar.props.onClick).toBe(onClick);
        expect(bar.props.style).toEqual({ left: '25px', width: '40px' });
        expect(renderToStaticMarkup(bar)).toContain('border-emerald-300');
        for (const side of ['left', 'right'] as const) {
            const handle = TrimHandle({ side, onPointerDown, title: 'Trim edge', className: 'w-2.5 hover:bg-amber-300' });
            expect(handle.props.onPointerDown).toBe(onPointerDown);
            expect(handle.props.className).toContain(`${side}-0`);
            expect(handle.props.className).toContain('cursor-ew-resize');
            expect(handle.props.className).toContain('w-2.5 hover:bg-amber-300');
        }
    });
});
