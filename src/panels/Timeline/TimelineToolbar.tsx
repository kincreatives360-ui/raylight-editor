import { Pause, Play, Scissors, Trash2 } from 'lucide-react';
import { IconButton } from '../../ui/primitives';
import type { Shot } from '../../model/types';
import { TimelineTimecode } from './TimelineTimecode';
import { MAX_TIMELINE_ZOOM, MIN_TIMELINE_ZOOM } from './timelineConstants';

interface TimelineToolbarProps {
    isPlaying: boolean;
    onTogglePlay: () => void;
    onSplitAtPlayhead: () => void;
    activeShot?: Shot;
    hasActiveShot: boolean;
    onDeleteShot: (shotId: string) => void;
    totalDurationMs: number;
    timelineZoom: number;
    onTimelineZoomChange: (zoom: number) => void;
}

export function TimelineToolbar({
    isPlaying,
    onTogglePlay,
    onSplitAtPlayhead,
    activeShot,
    hasActiveShot,
    onDeleteShot,
    totalDurationMs,
    timelineZoom,
    onTimelineZoomChange,
}: TimelineToolbarProps) {
    const zoomPercent = ((timelineZoom - MIN_TIMELINE_ZOOM) / (MAX_TIMELINE_ZOOM - MIN_TIMELINE_ZOOM)) * 100;

    return (
        <div className="h-9 px-3.5 flex items-center justify-between shrink-0 border-b border-subtle/30 bg-panel/30">
            <div className="flex items-center gap-2">
                <IconButton
                    unstyled
                    tooltip={false}
                    label={isPlaying ? 'Pause playback' : 'Start playback'}
                    type="button"
                    onClick={onTogglePlay}
                    title="Play / Pause (Space)"
                    className="w-7 h-7 rounded-lg border border-white/20 hover:border-white/50 bg-white/5 hover:bg-white/10 flex items-center justify-center text-white cursor-pointer transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
                    icon={isPlaying ? (
                        <Pause className="w-3 h-3" />
                    ) : (
                        <Play className="w-3 h-3 ml-0.5 fill-current" />
                    )}
                />
                <IconButton
                    unstyled
                    tooltip={false}
                    label="Split clip at playhead"
                    type="button"
                    onClick={onSplitAtPlayhead}
                    title="Split Clip at Playhead (S)"
                    className="w-7 h-7 rounded-lg border border-subtle hover:border-medium bg-surface/50 hover:bg-subtle flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
                    icon={<Scissors className="w-3 h-3" />}
                />
                {activeShot && hasActiveShot && (
                    <IconButton
                        unstyled
                        tooltip={false}
                        label={`Delete shot ${activeShot.name}`}
                        type="button"
                        onClick={() => onDeleteShot(activeShot.id)}
                        title={`Delete ${activeShot.name}`}
                        className="w-7 h-7 rounded-lg border border-subtle hover:border-rose-400/50 bg-surface/50 hover:bg-rose-500/10 flex items-center justify-center text-muted-foreground hover:text-rose-300 cursor-pointer transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                        icon={<Trash2 className="w-3 h-3" />}
                    />
                )}
                <div className="h-4 w-px bg-border/40 mx-1" />
                <TimelineTimecode totalDurationMs={totalDurationMs} />
            </div>

            <div className="flex items-center gap-2">
                <div className="relative w-28 h-1.5 rounded-full bg-subtle flex items-center group/zoom">
                    <div
                        className="h-full rounded-full bg-brand-blue transition-[width] duration-75"
                        style={{ width: `${zoomPercent}%` }}
                    />
                    <input
                        aria-label="Timeline Zoom"
                        type="range"
                        min={MIN_TIMELINE_ZOOM}
                        max={MAX_TIMELINE_ZOOM}
                        step={0.05}
                        value={timelineZoom}
                        onChange={(event) => onTimelineZoomChange(Number(event.target.value))}
                        className="absolute inset-0 w-full opacity-0 cursor-pointer z-10"
                    />
                    <div
                        className="w-3 h-3 rounded-full bg-white shadow-md pointer-events-none absolute -ml-1.5 transition-transform group-hover/zoom:scale-110"
                        style={{ left: `${zoomPercent}%` }}
                    />
                </div>
            </div>
        </div>
    );
}
