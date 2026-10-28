import { clampPanelWidth } from './workspaceLayout';
import { useEffect, useRef, type PointerEvent } from 'react';

interface SidebarResizeHandleProps {
    side: 'left' | 'right';
    width: number;
    minWidth: number;
    maxWidth: number;
    resetWidth: number;
    getMaxWidth: () => number;
    onResize: (width: number) => void;
    label: string;
    title: string;
}

export function SidebarResizeHandle({ side, width, minWidth, maxWidth, resetWidth, getMaxWidth, onResize, label, title }: SidebarResizeHandleProps) {
    const cleanupRef = useRef<(() => void) | null>(null);
    useEffect(() => () => cleanupRef.current?.(), []);
    const resize = (value: number) => onResize(clampPanelWidth(value, minWidth, maxWidth, getMaxWidth()));
    const direction = side === 'left' ? 1 : -1;
    const startResize = (event: PointerEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        cleanupRef.current?.();
        const target = event.currentTarget;
        const pointerId = event.pointerId;
        const startX = event.clientX;
        target.setPointerCapture(pointerId);
        const move = (next: globalThis.PointerEvent) => {
            resize(width + direction * (next.clientX - startX));
        };
        const cleanup = () => {
            if (target.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId);
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', cleanup);
            window.removeEventListener('pointercancel', cleanup);
            cleanupRef.current = null;
        };
        cleanupRef.current = cleanup;
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', cleanup);
        window.addEventListener('pointercancel', cleanup);
    };
    return <div
        role="separator" aria-orientation="vertical" aria-label={label}
        aria-valuenow={width} aria-valuemin={minWidth} aria-valuemax={Math.max(minWidth, Math.min(maxWidth, getMaxWidth()))} tabIndex={0}
        onPointerDown={startResize}
        onDoubleClick={() => resize(resetWidth)}
        onKeyDown={event => {
            const next = event.key === 'ArrowLeft' ? width - direction * 10
                : event.key === 'ArrowRight' ? width + direction * 10
                : event.key === 'Home' ? minWidth : event.key === 'End' ? maxWidth : null;
            if (next === null) return;
            event.preventDefault();
            resize(next);
        }}
        className="w-1.5 -mx-[3px] relative flex items-center justify-center cursor-col-resize group select-none shrink-0 z-20 hover:bg-[#0088ff]/40 active:bg-[#0088ff] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#0088ff]"
        title={title}
    ><div className="w-0.5 h-8 rounded-full bg-white/20 group-hover:bg-[#0088ff] transition-colors" /></div>;
}
