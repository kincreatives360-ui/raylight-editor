interface DragTimeBadgeProps {
    durationMs: number;
    startMs?: number;
    snapped?: boolean;
}

export function DragTimeBadge({ durationMs, startMs, snapped }: DragTimeBadgeProps) {
    return <div className="absolute -top-5 px-1.5 py-0.5 rounded bg-[#18181b] border border-sky-400/60 text-sky-300 font-mono tabular-nums text-[11px] shadow-sm flex items-center gap-1 whitespace-nowrap">
        {snapped && <span>🧲</span>}
        <span>{(durationMs / 1000).toFixed(2)}s</span>
        {startMs !== undefined && <><span className="text-white/40">·</span><span className="text-white/70">{(startMs / 1000).toFixed(2)}s</span></>}
    </div>;
}

interface TimelineDragPreviewProps extends DragTimeBadgeProps {
    startMs: number;
    pxPerMs: number;
    minWidth: number;
    variant: 'layer' | 'pill';
    showStart?: boolean;
}

export function TimelineDragPreview({ startMs, durationMs, pxPerMs, minWidth, variant, snapped, showStart = true }: TimelineDragPreviewProps) {
    return <div
        style={{ left: `${startMs * pxPerMs}px`, width: `${Math.max(minWidth, durationMs * pxPerMs)}px` }}
        className={variant === 'layer'
            ? 'absolute top-0.5 bottom-0.5 rounded-lg border-2 border-dashed border-[#38bdf8] bg-[#0284c7]/20 pointer-events-none z-20 shadow-sm flex items-center justify-center animate-in fade-in duration-75'
            : 'absolute h-4.5 -top-0.5 rounded-full border-2 border-dashed border-[#38bdf8] bg-[#0284c7]/25 pointer-events-none z-30 shadow-sm flex items-center justify-center animate-in fade-in duration-75'}
    >
        <DragTimeBadge durationMs={durationMs} startMs={showStart ? startMs : undefined} snapped={snapped} />
    </div>;
}
