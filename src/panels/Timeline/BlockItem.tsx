// src/panels/Timeline/BlockItem.tsx
import React, { useRef } from 'react';
import type { AnimationBlock, Shot } from '../../model/types';

interface BlockItemProps {
    shot: Shot;
    block: AnimationBlock;
    pxPerMs: number;
    selected: boolean;
    onSelect: () => void;
    onUpdate: (patch: Partial<AnimationBlock>, skipHistory?: boolean) => void;
    beginDragTransaction: () => void;
    commitDragTransaction: () => void;
}

type DragMode = 'move' | 'left' | 'right';

export const BlockItem: React.FC<BlockItemProps> = ({
    shot,
    block,
    pxPerMs,
    selected,
    onSelect,
    onUpdate,
    beginDragTransaction,
    commitDragTransaction,
}) => {
    const dragRef = useRef<{
        mode: DragMode;
        startX: number;
        originalStart: number;
        originalDuration: number;
    } | null>(null);

    const safeShotDuration = Math.max(100, shot.durationMs);
    const left = (shot.startMs + block.startMs) * pxPerMs;
    const width = Math.max(24, block.durationMs * pxPerMs);

    const startDrag = (event: React.MouseEvent, mode: DragMode) => {
        event.preventDefault();
        event.stopPropagation();
        onSelect();
        dragRef.current = {
            mode,
            startX: event.clientX,
            originalStart: block.startMs,
            originalDuration: block.durationMs,
        };
        beginDragTransaction();

        const onMove = (moveEvent: MouseEvent) => {
            const drag = dragRef.current;
            if (!drag) return;
            const deltaMs = Math.round(
                ((moveEvent.clientX - drag.startX) / Math.max(pxPerMs, 0.0001)) / 10
            ) * 10;

            if (drag.mode === 'left') {
                const nextStart = Math.max(
                    0,
                    Math.min(
                        drag.originalStart + drag.originalDuration - 100,
                        drag.originalStart + deltaMs
                    )
                );
                const nextDuration =
                    drag.originalStart + drag.originalDuration - nextStart;
                onUpdate({ startMs: nextStart, durationMs: nextDuration }, true);
            } else if (drag.mode === 'right') {
                const nextDuration = Math.max(
                    100,
                    Math.min(
                        safeShotDuration - drag.originalStart,
                        drag.originalDuration + deltaMs
                    )
                );
                onUpdate({ durationMs: nextDuration }, true);
            } else {
                const nextStart = Math.max(
                    0,
                    Math.min(
                        safeShotDuration - drag.originalDuration,
                        drag.originalStart + deltaMs
                    )
                );
                onUpdate({ startMs: nextStart }, true);
            }
        };

        const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            dragRef.current = null;
            commitDragTransaction();
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    };

    return (
        <div
            onMouseDown={(e) => {
                if ((e.target as HTMLElement).closest('[data-block-handle]')) return;
                startDrag(e, 'move');
            }}
            onClick={(e) => {
                e.stopPropagation();
                onSelect();
            }}
            className={`absolute top-1 bottom-1 rounded border px-2 flex items-center justify-between text-[10px] font-medium cursor-pointer transition ${selected
                    ? 'bg-fuchsia-600/50 border-fuchsia-300 text-white ring-1 ring-white/60 shadow'
                    : 'bg-indigo-600/35 border-indigo-500/50 text-indigo-100 hover:bg-indigo-600/50'
                }`}
            style={{ left: `${left}px`, width: `${width}px` }}
            title={`${block.label} (${block.property})`}
        >
            <span className="truncate pointer-events-none">{block.label}</span>

            {/* Resize handles */}
            <div
                data-block-handle="left"
                onMouseDown={(e) => startDrag(e, 'left')}
                className="absolute left-0 top-0 bottom-0 w-2 bg-white/40 hover:bg-amber-300 cursor-ew-resize rounded-l"
            />
            <div
                data-block-handle="right"
                onMouseDown={(e) => startDrag(e, 'right')}
                className="absolute right-0 top-0 bottom-0 w-2 bg-white/40 hover:bg-rose-300 cursor-ew-resize rounded-r"
            />
        </div>
    );
};