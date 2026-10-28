import { afterEach, describe, expect, it, vi } from 'vitest';
import { subscribeFloatingPanel } from './useFloatingPanel';

describe('floating panel listener lifecycle', () => {
    afterEach(() => vi.unstubAllGlobals());
    it('keeps nested popup/anchor clicks open, dismisses outside, and removes listeners', () => {
        const doc = new EventTarget(), win = new EventTarget();
        vi.stubGlobal('document', doc); vi.stubGlobal('window', win);
        const inside = {} as HTMLElement, anchor = {} as HTMLElement, nested = {} as HTMLElement;
        const onClose = vi.fn(), reposition = vi.fn();
        const surfaceRef = { current: { contains: (node: Node) => node === inside } as HTMLElement };
        const anchorRef = { current: { contains: (node: Node) => node === anchor } as HTMLElement };
        const cleanup = subscribeFloatingPanel({ surfaceRef, anchorRef, onClose, reposition, ignoreOutside: target => target === nested });
        const pointer = (target: object) => { const e = new Event('pointerdown'); Object.defineProperty(e, 'target', { value: target }); doc.dispatchEvent(e); };
        pointer(inside); pointer(anchor); pointer(nested);
        expect(onClose).not.toHaveBeenCalled();
        pointer({});
        expect(onClose).toHaveBeenCalledOnce();
        win.dispatchEvent(new Event('resize'));
        expect(reposition).toHaveBeenCalledTimes(2);
        cleanup();
        pointer({}); win.dispatchEvent(new Event('resize'));
        expect(onClose).toHaveBeenCalledOnce();
        expect(reposition).toHaveBeenCalledTimes(2);
    });

    it('does not dismiss a parent for Escape while a nested select is open', () => {
        const doc = new EventTarget(); vi.stubGlobal('document', doc); vi.stubGlobal('window', new EventTarget());
        const onClose = vi.fn(); let nestedOpen = true;
        const cleanup = subscribeFloatingPanel({ surfaceRef: { current: null }, onClose, ignoreEscape: () => nestedOpen });
        const escape = () => { const e = new Event('keydown', { cancelable: true }); Object.defineProperty(e, 'key', { value: 'Escape' }); doc.dispatchEvent(e); return e; };
        expect(escape().defaultPrevented).toBe(false);
        expect(onClose).not.toHaveBeenCalled(); nestedOpen = false;
        expect(escape().defaultPrevented).toBe(true);
        expect(onClose).toHaveBeenCalledOnce(); cleanup();
    });
});
