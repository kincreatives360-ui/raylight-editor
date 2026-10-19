import React, { useEffect, useRef } from 'react';
import { usePlayheadStore } from '../../store/usePlayheadStore';

interface TimelineTimecodeProps {
    totalDurationMs: number;
}

export const TimelineTimecode: React.FC<TimelineTimecodeProps> = React.memo(({ totalDurationMs }) => {
    const currentSpanRef = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        // Initial paint synchronization
        const initialMs = usePlayheadStore.getState().currentTimeMs;
        if (currentSpanRef.current) {
            currentSpanRef.current.textContent = `${(initialMs / 1000).toFixed(2)}s`;
        }

        let lastTimeMs = initialMs;

        // Transient Zustand subscription - runs outside React render cycle
        const unsubscribe = usePlayheadStore.subscribe((state) => {
            if (state.currentTimeMs !== lastTimeMs) {
                lastTimeMs = state.currentTimeMs;
                if (currentSpanRef.current) {
                    currentSpanRef.current.textContent = `${(state.currentTimeMs / 1000).toFixed(2)}s`;
                }
            }
        });

        return unsubscribe;
    }, []);

    const initialFormatted = (usePlayheadStore.getState().currentTimeMs / 1000).toFixed(2);
    const totalFormatted = (totalDurationMs / 1000).toFixed(2);

    return (
        <div className="flex items-center gap-1 font-mono text-[10px] text-[#a1a1aa] tracking-tight tabular-nums select-none">
            <span ref={currentSpanRef} className="text-white font-medium">
                {initialFormatted}s
            </span>
            <span className="text-white/30">/</span>
            <span>{totalFormatted}s</span>
        </div>
    );
});
