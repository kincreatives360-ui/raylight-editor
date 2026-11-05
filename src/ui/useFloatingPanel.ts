import { useLayoutEffect, useRef } from 'react';

interface FloatingPanelOptions {
    open: boolean;
    surfaceRef: { current: HTMLElement | null };
    anchorRef?: { current: HTMLElement | null };
    anchor?: HTMLElement;
    onClose: () => void;
    onEscape?: () => void;
    reposition?: () => void;
    positionKey?: unknown;
    dismissOnViewportChange?: boolean;
    outsideEvent?: 'pointerdown' | 'mousedown';
    escape?: boolean;
    ignoreOutside?: (target: HTMLElement) => boolean;
    ignoreEscape?: () => boolean;
}

/** One listener lifecycle for menus, listboxes, and picker/dialog popups. */
export function subscribeFloatingPanel(options: Omit<FloatingPanelOptions, 'open' | 'positionKey'>) {
    const { surfaceRef, anchorRef, anchor, outsideEvent = 'pointerdown', escape = true } = options;
    const outside = (event: Event) => {
        const target = event.target as HTMLElement | null;
        if (!target || surfaceRef.current?.contains(target) || anchorRef?.current?.contains(target) || anchor?.contains(target) || options.ignoreOutside?.(target)) return;
        options.onClose();
    };
    const keydown = (event: KeyboardEvent) => {
        if (!escape || event.key !== 'Escape' || options.ignoreEscape?.()) return;
        event.preventDefault();
        event.stopPropagation();
        (options.onEscape ?? options.onClose)();
    };
    const viewport = (event: Event) => {
        if (options.dismissOnViewportChange) {
            if (event.type === 'scroll' && surfaceRef.current?.contains(event.target as Node)) return;
            options.onClose();
        } else options.reposition?.();
    };
    document.addEventListener(outsideEvent, outside);
    if (escape) document.addEventListener('keydown', keydown);
    const trackViewport = !!(options.reposition || options.dismissOnViewportChange);
    if (trackViewport) {
        window.addEventListener('resize', viewport);
        window.addEventListener('scroll', viewport, true);
    }
    options.reposition?.();
    return () => {
        document.removeEventListener(outsideEvent, outside);
        if (escape) document.removeEventListener('keydown', keydown);
        if (trackViewport) {
            window.removeEventListener('resize', viewport);
            window.removeEventListener('scroll', viewport, true);
        }
    };
}

export function useFloatingPanel(options: FloatingPanelOptions) {
    const callbacks = useRef(options);
    useLayoutEffect(() => { callbacks.current = options; });
    const { open, surfaceRef, anchorRef, anchor, positionKey, outsideEvent, escape, dismissOnViewportChange } = options;
    const tracksPosition = !!options.reposition;
    useLayoutEffect(() => {
        if (!open) return;
        return subscribeFloatingPanel({
            surfaceRef, anchorRef, anchor, outsideEvent, escape, dismissOnViewportChange,
            onClose: () => callbacks.current.onClose(),
            onEscape: () => (callbacks.current.onEscape ?? callbacks.current.onClose)(),
            reposition: tracksPosition ? () => callbacks.current.reposition?.() : undefined,
            ignoreOutside: target => callbacks.current.ignoreOutside?.(target) ?? false,
            ignoreEscape: () => callbacks.current.ignoreEscape?.() ?? false,
        });
    }, [open, surfaceRef, anchorRef, anchor, positionKey, outsideEvent, escape, dismissOnViewportChange, tracksPosition]);
}
