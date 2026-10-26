import React, { useEffect, useRef } from 'react';
import { usePlayheadStore } from '../../store/usePlayheadStore';

export interface PlayheadOverlayProps {
    pxPerMs: number;
    timelineView: 'video' | 'scene';
    activeShotStartMs: number;
    scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
}

export const PlayheadOverlay: React.FC<PlayheadOverlayProps> = React.memo(({
    pxPerMs,
    timelineView,
    activeShotStartMs,
    scrollContainerRef,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const labelRef = useRef<HTMLDivElement>(null);

    // Keep layout props in refs so transient callback always has freshest zoom/view values
    const pxPerMsRef = useRef(pxPerMs);
    const timelineViewRef = useRef(timelineView);
    const activeShotStartMsRef = useRef(activeShotStartMs);
    const scrollContainerRefRef = useRef(scrollContainerRef);

    useEffect(() => {
        pxPerMsRef.current = pxPerMs;
        timelineViewRef.current = timelineView;
        activeShotStartMsRef.current = activeShotStartMs;
        scrollContainerRefRef.current = scrollContainerRef;
    });

    useEffect(() => {
        const updatePlayhead = (currentTimeMs: number, isPlaying: boolean) => {
            const currentView = timelineViewRef.current;
            const currentShotStart = activeShotStartMsRef.current;
            const currentPxPerMs = pxPerMsRef.current;

            const playheadDisplayTimeMs =
                currentView === 'scene'
                    ? Math.max(0, currentTimeMs - currentShotStart)
                    : currentTimeMs;
            const playheadPx = playheadDisplayTimeMs * currentPxPerMs;

            // Direct GPU-accelerated transform (0 layout reflows)
            if (containerRef.current) {
                containerRef.current.style.transform = `translate3d(${playheadPx}px, 0, 0) translateX(-50%)`;
            }

            // Direct text update (0 React reconciliation)
            if (labelRef.current) {
                labelRef.current.textContent = (playheadDisplayTimeMs / 1000).toFixed(2);
            }

            // Auto-scroll timeline container with playhead during playback
            const container = scrollContainerRefRef.current?.current;
            if (isPlaying && container) {
                const visibleLeft = container.scrollLeft;
                const visibleRight = visibleLeft + container.clientWidth;

                if (playheadPx > visibleRight - 40) {
                    container.scrollLeft = playheadPx - 80;
                } else if (playheadPx < visibleLeft) {
                    container.scrollLeft = Math.max(0, playheadPx - 40);
                }
            }
        };

        // Initial sync on mount or geometry change
        const initial = usePlayheadStore.getState();
        updatePlayhead(initial.currentTimeMs, initial.isPlaying);

        let lastTimeMs = initial.currentTimeMs;
        let lastPlaying = initial.isPlaying;

        // Subscribe to Zustand outside React's render loop
        const unsubscribe = usePlayheadStore.subscribe((state) => {
            if (state.currentTimeMs !== lastTimeMs || state.isPlaying !== lastPlaying) {
                lastTimeMs = state.currentTimeMs;
                lastPlaying = state.isPlaying;
                updatePlayhead(state.currentTimeMs, state.isPlaying);
            }
        });

        return unsubscribe;
    }, [pxPerMs, timelineView, activeShotStartMs]);

    const initialDisplayTimeMs =
        timelineView === 'scene'
            ? Math.max(0, usePlayheadStore.getState().currentTimeMs - activeShotStartMs)
            : usePlayheadStore.getState().currentTimeMs;
    const initialPx = initialDisplayTimeMs * pxPerMs;

    return (
        <div
            ref={containerRef}
            aria-hidden="true"
            className="absolute top-0 bottom-0 pointer-events-none z-30 flex flex-col items-center will-change-transform"
            style={{
                left: 0,
                transform: `translate3d(${initialPx}px, 0, 0) translateX(-50%)`,
            }}
        >
            {/* 1px vertical line in accent blue spanning through full track area with bottom fade */}
            <div
                className="absolute inset-y-0 w-px"
                style={{
                    background: 'linear-gradient(to bottom, #0070e0 0%, #0070e0 85%, rgba(0, 112, 224, 0) 100%)',
                }}
            />

            {/* Rounded blue pill label sitting on the ruler at the top */}
            <div
                ref={labelRef}
                className="relative px-2 py-0.5 rounded-full bg-[#0070e0] text-white text-[11px] font-mono tabular-nums font-semibold tracking-tight shadow-md whitespace-nowrap leading-none select-none mt-1 z-10 border border-sky-300/40"
            >
                {(initialDisplayTimeMs / 1000).toFixed(2)}
            </div>
        </div>
    );
});
