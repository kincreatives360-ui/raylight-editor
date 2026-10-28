import { MenuSurface } from '../../../ui/Menu';
import { useFloatingPanel } from '../../../ui/useFloatingPanel';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
/** Anchored inspector surface shared by preset menus and preset settings. */
export function InspectorFlyout({ anchor, label, menu = false, onClose, children }: {
    anchor: HTMLElement;
    label: string;
    menu?: boolean;
    onClose: () => void;
    children: ReactNode;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState<{ left: number; top: number; transformOrigin?: string }>({ left: 0, top: 0, transformOrigin: 'top right' });
    useFloatingPanel({ open: true, surfaceRef: ref, anchor, onClose, positionKey: children,
        reposition: () => {
            const rect = anchor.getBoundingClientRect();
            const surface = ref.current;
            const width = surface?.offsetWidth ?? 280, height = surface?.offsetHeight ?? 300;
            const left = menu ? rect.right - width : rect.left - width - 10;
            const clampedLeft = Math.max(8, Math.min(left, window.innerWidth - width - 8));
            const clampedTop = Math.max(8, Math.min(menu ? rect.bottom + 5 : rect.top, window.innerHeight - height - 8));
            const originX = clampedLeft + width / 2 <= rect.left + rect.width / 2 ? 'right' : 'left';
            const originY = clampedTop >= rect.top ? 'top' : 'bottom';
            setPosition({ left: clampedLeft, top: clampedTop, transformOrigin: `${originY} ${originX}` });
        },
        ignoreOutside: target => !!target.closest('.figma-select-menu'),
        ignoreEscape: () => !!document.querySelector('.figma-select-menu'),
        onEscape: () => { onClose(); if (anchor.isConnected) anchor.focus(); },
    });
    useEffect(() => {
        const surface = ref.current;
        (surface?.querySelector<HTMLElement>('button,[role="combobox"],input') ?? surface)?.focus();
    }, [anchor, onClose]);
    const Surface = menu ? MenuSurface : 'div';
    return createPortal(<Surface ref={ref} role={menu ? 'menu' : 'dialog'} aria-label={label} tabIndex={-1} className={`animate-flyout ${menu ? 'animate-menu' : 'animate-settings'}`} style={position} >{children}</Surface>, document.body);
}
