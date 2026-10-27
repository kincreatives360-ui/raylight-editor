import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
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
    const [position, setPosition] = useState({ left: 0, top: 0 });
    useLayoutEffect(() => {
        const place = () => {
            const rect = anchor.getBoundingClientRect();
            const surface = ref.current;
            const width = surface?.offsetWidth ?? 280, height = surface?.offsetHeight ?? 300;
            const left = menu ? rect.right - width : rect.left - width - 10;
            setPosition({ left: Math.max(8, Math.min(left, window.innerWidth - width - 8)), top: Math.max(8, Math.min(menu ? rect.bottom + 5 : rect.top, window.innerHeight - height - 8)) });
        };
        place();
        window.addEventListener('resize', place);
        window.addEventListener('scroll', place, true);
        return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
    }, [anchor, menu, children]);
    useEffect(() => {
        const surface = ref.current;
        (surface?.querySelector<HTMLElement>('button,[role="combobox"],input') ?? surface)?.focus();
        const outside = (event: PointerEvent) => {
            const target = event.target as HTMLElement;
            if (!surface?.contains(target) && !anchor.contains(target) && !target.closest('.figma-select-menu'))
                onClose();
        };
        const escape = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !document.querySelector('.figma-select-menu')) {
                event.preventDefault();
                event.stopPropagation();
                onClose();
                if (anchor.isConnected) anchor.focus();
            }
        };
        document.addEventListener('pointerdown', outside);
        document.addEventListener('keydown', escape);
        return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
    }, [anchor, onClose]);
    return createPortal(<div ref={ref} role={menu ? 'menu' : 'dialog'} aria-label={label} tabIndex={-1} className={`animate-flyout ${menu ? 'animate-menu' : 'animate-settings'}`} style={position} onKeyDown={event => {
            if (!menu || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key))
                return;
            event.preventDefault();
            const buttons = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? []);
            const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
            buttons[next]?.focus();
        }}>{children}</div>, document.body);
}
