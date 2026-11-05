import { afterEach, describe, expect, it, vi } from 'vitest';
import type { KeyboardEvent, PointerEvent } from 'react';
import { SidebarResizeHandle } from './SidebarResizeHandle';

const { effects } = vi.hoisted(() => ({ effects: [] as Array<() => (() => void)> }));
vi.mock('react', async importOriginal => ({
    ...await importOriginal<typeof import('react')>(),
    useRef: (current: unknown) => ({ current }),
    useEffect: (effect: () => (() => void)) => effects.push(effect),
}));

afterEach(() => { vi.unstubAllGlobals(); effects.length = 0; });

function setup(side: 'left' | 'right') {
    const target = { setPointerCapture: vi.fn(), hasPointerCapture: vi.fn(() => true), releasePointerCapture: vi.fn() };
    const listeners = new Map<string, EventListener>();
    vi.stubGlobal('window', {
        addEventListener: vi.fn((name: string, callback: EventListener) => listeners.set(name, callback)),
        removeEventListener: vi.fn((name: string) => listeners.delete(name)),
    });
    const onResize = vi.fn();
    let max = 500;
    const handle = SidebarResizeHandle({ side, width: 300, minWidth: 200, maxWidth: 600, resetWidth: 320,
        getMaxWidth: () => max, onResize, label: 'Resize', title: 'Resize panel' });
    const event = { clientX: 100, pointerId: 1, currentTarget: target, preventDefault: vi.fn(), stopPropagation: vi.fn() };
    const move = (clientX: number) => listeners.get('pointermove')!({ clientX } as unknown as Event);
    return { handle, event, target, onResize, listeners, move, setMax: (value: number) => { max = value; } };
}

describe('SidebarResizeHandle', () => {
    for (const side of ['left', 'right'] as const) {
        it(`preserves ${side} drag direction, live bounds and pointer cancellation`, () => {
            const { handle, event, target, onResize, listeners, move, setMax } = setup(side);
            handle.props.onPointerDown(event as unknown as PointerEvent<HTMLDivElement>);
            expect(event.preventDefault).toHaveBeenCalledOnce();
            expect(event.stopPropagation).toHaveBeenCalledOnce();
            expect(target.setPointerCapture).toHaveBeenCalledWith(1);
            move(side === 'left' ? 150 : 50);
            expect(onResize).toHaveBeenLastCalledWith(350);
            setMax(330);
            move(side === 'left' ? 800 : -600);
            expect(onResize).toHaveBeenLastCalledWith(330);
            move(side === 'left' ? -600 : 800);
            expect(onResize).toHaveBeenLastCalledWith(200);
            listeners.get('pointercancel')!({} as Event);
            expect(target.releasePointerCapture).toHaveBeenCalledWith(1);
            expect(listeners.size).toBe(0);
        });
        it(`preserves ${side} keyboard direction, endpoints and reset`, () => {
            const { handle, onResize } = setup(side);
            for (const key of ['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape']) {
                const preventDefault = vi.fn();
                handle.props.onKeyDown({ key, preventDefault } as unknown as KeyboardEvent<HTMLDivElement>);
                expect(preventDefault).toHaveBeenCalledTimes(key === 'Escape' ? 0 : 1);
            }
            handle.props.onDoubleClick();
            expect(onResize.mock.calls.map(call => call[0])).toEqual(side === 'left' ? [290, 310, 200, 500, 320] : [310, 290, 200, 500, 320]);
        });
    }
    it('releases capture and removes listeners when the handle unmounts', () => {
        const { handle, event, target, listeners } = setup('left');
        const unmount = effects[0]();
        handle.props.onPointerDown(event as unknown as PointerEvent<HTMLDivElement>);
        unmount();
        expect(target.releasePointerCapture).toHaveBeenCalledWith(1);
        expect(listeners.size).toBe(0);
    });
    it('cleans up a previous gesture before starting another', () => {
        const { handle, event, target, listeners } = setup('left');
        handle.props.onPointerDown(event as unknown as PointerEvent<HTMLDivElement>);
        handle.props.onPointerDown({ ...event, pointerId: 2 } as unknown as PointerEvent<HTMLDivElement>);
        expect(target.releasePointerCapture).toHaveBeenCalledWith(1);
        expect(listeners.size).toBe(3);
        listeners.get('pointerup')!({} as Event);
        expect(target.releasePointerCapture).toHaveBeenLastCalledWith(2);
        expect(listeners.size).toBe(0);
    });
});
