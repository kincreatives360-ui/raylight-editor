import { IconButton } from '../../ui/primitives';
import { TimelineRangeBar, TrimHandle } from './TimelineRangeBar';
import React, { useMemo } from 'react';
import { Volume2 } from 'lucide-react';
import type { AudioClip } from '../../model/types';
import { generateWaveformPeaks } from '../../engine/audioEngine';

interface AudioClipBarProps {
    clip: AudioClip;
    left: number;
    width: number;
    muted?: boolean;
    onSeek: () => void;
    onDelete: () => void;
    onDrag: (event: React.PointerEvent<HTMLElement>, edge: 'move' | 'left' | 'right') => void;
}

const AudioWaveform: React.FC<{
    clip: AudioClip;
    width: number;
    muted?: boolean;
}> = React.memo(
    ({ clip, width, muted }) => {
        const barCount = Math.max(12, Math.min(96, Math.floor(width / 5)));
        const peaks = useMemo(
            () => generateWaveformPeaks(clip, barCount),
            [clip, barCount]
        );

        return (
            <svg
                className="absolute inset-0 w-full h-full pointer-events-none opacity-40 overflow-hidden"
                preserveAspectRatio="none"
                viewBox={`0 0 ${barCount * 4} 24`}
            >
                {peaks.map((p, idx) => {
                    const barHeight = Math.max(2, p * 20);
                    const y = (24 - barHeight) / 2;
                    return (
                        <rect
                            key={idx}
                            x={idx * 4 + 1}
                            y={y}
                            width={2.2}
                            height={barHeight}
                            rx={1}
                            fill={muted ? '#94a3b8' : 'var(--color-brand-orange)'}
                        />
                    );
                })}
            </svg>
        );
    },
    (prev, next) => {
        if (prev.muted !== next.muted) return false;
        if (prev.clip.id !== next.clip.id) return false;
        if (prev.clip.durationMs !== next.clip.durationMs) return false;
        if (prev.clip.offsetMs !== next.clip.offsetMs) return false;
        if (prev.clip.dataUrl !== next.clip.dataUrl) return false;
        const prevBars = Math.max(12, Math.min(96, Math.floor(prev.width / 5)));
        const nextBars = Math.max(12, Math.min(96, Math.floor(next.width / 5)));
        return prevBars === nextBars;
    }
);

export function AudioClipBar({ clip, left, width, muted, onSeek, onDelete, onDrag }: AudioClipBarProps) {
    return (
        <TimelineRangeBar
            tone="audio"
            selected={!muted}
            title={`${clip.name} · ${(clip.durationMs / 1000).toFixed(2)}s · Drag to move, drag edges to trim`}
            onPointerDown={(e) => onDrag(e, 'move')}
            onClick={(e) => {
                e.stopPropagation();
                onSeek();
            }}
            left={left}
            width={width}
            className={`group/audioclip absolute top-1 bottom-1 px-2 flex items-center justify-between text-[10px] font-medium tracking-tight truncate cursor-grab active:cursor-grabbing select-none overflow-hidden ${
                muted ? 'opacity-50' : ''
            }`}
        >
            {/* Procedural SVG Waveform */}
            <AudioWaveform clip={clip} width={width} muted={muted} />

            <TrimHandle
                side="left"
                onPointerDown={(e) => onDrag(e, 'left')}
                title="Trim audio start"
                className="w-2 bg-white/10 hover:bg-orange-400/80 rounded-l z-10"
            />
            <div className="flex items-center gap-1.5 z-10 pointer-events-none pl-1 truncate">
                <Volume2 className="w-3 h-3 text-orange-400 shrink-0 opacity-80" />
                <span className="truncate drop-shadow-sm">{clip.name}</span>
                <span className="text-[10px] font-mono text-orange-300/70 hidden sm:inline">
                    {(clip.durationMs / 1000).toFixed(1)}s
                </span>
            </div>
            <IconButton
                unstyled
                tooltip={false}
                label="Delete audio clip"
                title="Delete audio clip"
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                }}
                className="w-3.5 h-3.5 rounded-full hover:bg-rose-500/80 hover:text-white flex items-center justify-center text-[10px] opacity-0 group-hover/audioclip:opacity-100 transition cursor-pointer z-10"
                icon={<>&times;</>}
            />
            <TrimHandle
                side="right"
                onPointerDown={(e) => onDrag(e, 'right')}
                title="Trim audio end"
                className="w-2 bg-white/10 hover:bg-orange-400/80 rounded-r z-10"
            />
        </TimelineRangeBar>
    );
}
