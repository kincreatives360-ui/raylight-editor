// src/panels/Timeline/CameraBlockItem.tsx
import React, { useRef } from 'react';
import { Video, Trash2 } from 'lucide-react';
import type { CameraBlock, Shot } from '../../model/types';

interface CameraBlockItemProps {
    shot: Shot;
    cameraBlock: CameraBlock;
    fromFramingName: string;
    toFramingName: string;
    pxPerMs: number;
    selected: boolean;
    onSelect: () => void;
    onUpdate: (patch: Partial<CameraBlock>, skipHistory?: boolean) => void;
    onDelete: () => void;
    beginDragTransaction: () => void;
    commitDragTransaction: () => void;
}

type DragMode = 'move' | 'left' | 'right';

export const CameraBlockItem: React.FC<CameraBlockItemProps> = ({
    shot,
    cameraBlock,
    fromFramingName,
    toFramingName,
    pxPerMs,
    selected,
    onSelect,
    onUpdate,
    onDelete,
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
    const left = (shot.startMs + cameraBlock.startMs) * pxPerMs;
    const width = Math.max(36, cameraBlock.durationMs * pxPerMs);

    const startDrag = (event: React.MouseEvent, mode: DragMode) => {
        event.preventDefault();
        event.stopPropagation();
        onSelect();
        dragRef.current = {
            mode,
            startX: event.clientX,
            originalStart: cameraBlock.startMs,
            originalDuration: cameraBlock.durationMs,
        };
        beginDragTransaction();

        const onMove = (moveEvent: MouseEvent) => {
            const drag = dragRef.current;
            if (!drag) return;
            const deltaMs =
                Math.round(
                    ((moveEvent.clientX - drag.startX) / Math.max(pxPerMs, 0.0001)) / 10
                ) * 10;

            if (drag.mode === 'left') {
                const nextStart = Math.max(
                    0,
                    Math.min(
                        drag.originalStart + drag.originalDuration - 200,
                        drag.originalStart + deltaMs
                    )
                );
                const nextDuration =
                    drag.originalStart + drag.originalDuration - nextStart;
                onUpdate({ startMs: nextStart, durationMs: nextDuration }, true);
            } else if (drag.mode === 'right') {
                const nextDuration = Math.max(
                    200,
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
            className={`absolute top-1 bottom-1 rounded border px-2 flex items-center justify-between text-[10px] font-medium cursor-grab transition select-none group ${
                selected
                    ? 'bg-emerald-600/60 border-emerald-300 text-white ring-1 ring-white/60 shadow'
                    : 'bg-emerald-900/50 border-emerald-600/70 text-emerald-100 hover:bg-emerald-800/60'
            }`}
            style={{ left: `${left}px`, width: `${width}px` }}
            title={`${cameraBlock.label || 'Camera Move'}: ${cameraBlock.mode} (${fromFramingName} -> ${toFramingName}) · ${cameraBlock.durationMs}ms`}
        >
            <div className="flex items-center gap-1.5 truncate pointer-events-none min-w-0">
                <Video className="w-3 h-3 text-emerald-300 shrink-0" />
                <span className="truncate font-semibold text-[9px] uppercase tracking-wider">
                    {cameraBlock.mode}
                </span>
                <span className="text-[9px] text-emerald-200/70 truncate">
                    {fromFramingName} → {toFramingName}
                </span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
                <span className="text-[8px] font-mono text-emerald-200/80 pointer-events-none">
                    {cameraBlock.durationMs}ms
                </span>
                <button
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-rose-500/30 text-rose-300 transition cursor-pointer"
                    title="Delete camera move"
                >
                    <Trash2 className="w-2.5 h-2.5" />
                </button>
            </div>

            {/* Left and Right trim handles */}
            <div
                data-block-handle="left"
                onMouseDown={(e) => startDrag(e, 'left')}
                title="Trim camera move start"
                className="absolute left-0 top-0 bottom-0 w-2 bg-white/30 hover:bg-emerald-300 cursor-ew-resize rounded-l"
            />
            <div
                data-block-handle="right"
                onMouseDown={(e) => startDrag(e, 'right')}
                title="Trim camera move end"
                className="absolute right-0 top-0 bottom-0 w-2 bg-white/30 hover:bg-emerald-300 cursor-ew-resize rounded-r"
            />
        </div>
    );
};
