// Stage 15: layer timing plus draggable relative-animation blocks.
import React, { useRef } from 'react';
import type { AnimationBlock, Layer, Shot } from '../../model/types';
import { useProjectStore } from '../../store/useProjectStore';
import { useSelectionStore } from '../../store/useSelectionStore';
import { BlockItem } from './BlockItem';

interface LayerTrackProps {
    shot: Shot;
    layer: Layer;
    pxPerMs: number;
    selected: boolean;
    onSelect: () => void;
    onScrub: (globalTimeMs: number) => void;
}

type DragMode = 'move' | 'in' | 'out';

export const LayerTrack: React.FC<LayerTrackProps> = ({ shot, layer, pxPerMs, selected, onSelect, onScrub }) => {
    const { updateLayer, beginDragTransaction, commitDragTransaction } = useProjectStore();
    const { selectedBlockId, selectBlock } = useSelectionStore();
    const dragRef = useRef<{ mode: DragMode; startX: number; originalIn: number; originalOut: number } | null>(null);

    const safeDuration = Math.max(100, shot.durationMs);
    const inMs = Math.max(0, Math.min(safeDuration - 100, layer.inMs));
    const outMs = Math.max(inMs + 100, Math.min(safeDuration, layer.outMs));
    const left = (shot.startMs + inMs) * pxPerMs;
    const width = Math.max(8, (outMs - inMs) * pxPerMs);
    const tint = layer.kind === 'text' ? 'bg-violet-500/70 border-violet-300' : layer.kind === 'shape' ? 'bg-emerald-500/65 border-emerald-300' : 'bg-cyan-500/65 border-cyan-300';

    const startDrag = (event: React.MouseEvent, mode: DragMode) => {
        event.preventDefault();
        event.stopPropagation();
        onSelect();
        dragRef.current = { mode, startX: event.clientX, originalIn: inMs, originalOut: outMs };
        beginDragTransaction();

        const onMove = (moveEvent: MouseEvent) => {
            const drag = dragRef.current;
            if (!drag) return;
            const delta = Math.round(((moveEvent.clientX - drag.startX) / Math.max(pxPerMs, 0.0001)) / 10) * 10;
            let nextIn = drag.originalIn;
            let nextOut = drag.originalOut;

            if (drag.mode === 'in') {
                nextIn = Math.max(0, Math.min(drag.originalOut - 100, drag.originalIn + delta));
            } else if (drag.mode === 'out') {
                nextOut = Math.max(drag.originalIn + 100, Math.min(safeDuration, drag.originalOut + delta));
            } else {
                const duration = drag.originalOut - drag.originalIn;
                nextIn = Math.max(0, Math.min(safeDuration - duration, drag.originalIn + delta));
                nextOut = nextIn + duration;
            }

            updateLayer(shot.id, layer.id, (current) => ({ ...current, inMs: nextIn, outMs: nextOut }), { skipHistory: true });
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

    const updateBlock = (blockId: string, patch: Partial<AnimationBlock>, skipHistory = false) => {
        updateLayer(shot.id, layer.id, (current) => ({
            ...current,
            blocks: current.blocks.map((block) => (block.id === blockId ? { ...block, ...patch } : block)),
        }), { skipHistory });
    };

    return (
        <div className="h-14 border-b border-white/[0.05] relative" title={`${layer.name}: in ${Math.round(inMs)}ms, out ${Math.round(outMs)}ms`}>
            <button
                type="button"
                aria-label={`Select ${layer.name} timeline bar`}
                onClick={(event) => {
                    onSelect();
                    const rect = event.currentTarget.parentElement?.getBoundingClientRect();
                    if (rect) {
                        const localX = Math.max(0, event.clientX - rect.left);
                        onScrub(Math.max(shot.startMs, Math.min(shot.startMs + shot.durationMs, localX / pxPerMs)));
                    }
                }}
                onMouseDown={(event) => {
                    if ((event.target as HTMLElement).closest('[data-trim-handle]')) return;
                    startDrag(event, 'move');
                }}
                className={`absolute top-1 h-6 rounded border overflow-hidden text-left cursor-grab transition ${selected ? 'ring-1 ring-white/70 shadow' : ''} ${tint}`}
                style={{ left: `${left}px`, width: `${width}px` }}
            >
                <span className="h-full flex items-center px-2 text-[9px] text-white/90 truncate pointer-events-none">
                    {layer.name}
                    <span className="ml-2 text-[8px] text-white/60 shrink-0">{Math.round(outMs - inMs)}ms</span>
                </span>
                <span data-trim-handle="in" onMouseDown={(event) => startDrag(event, 'in')} title="Drag to change layer in-point" className="absolute left-0 top-0 bottom-0 w-2.5 bg-white/60 hover:bg-amber-300 cursor-ew-resize transition" />
                <span data-trim-handle="out" onMouseDown={(event) => startDrag(event, 'out')} title="Drag to change layer out-point" className="absolute right-0 top-0 bottom-0 w-2.5 bg-white/60 hover:bg-rose-300 cursor-ew-resize transition" />
            </button>

            <div className="absolute left-0 right-0 bottom-0 h-6 border-t border-white/[0.04] bg-black/10">
                {layer.blocks.map((block) => (
                    <BlockItem
                        key={block.id}
                        shot={shot}
                        block={block}
                        pxPerMs={pxPerMs}
                        selected={selectedBlockId === block.id}
                        onSelect={() => selectBlock(block.id, layer.id)}
                        onUpdate={(patch, skipHistory) => updateBlock(block.id, patch, skipHistory)}
                        beginDragTransaction={beginDragTransaction}
                        commitDragTransaction={commitDragTransaction}
                    />
                ))}
            </div>

            <div className="absolute top-0 bottom-0 w-px bg-white/10 pointer-events-none" style={{ left: `${shot.startMs * pxPerMs}px` }} />
        </div>
    );
};