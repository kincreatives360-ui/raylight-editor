import React from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { IconButton } from '../../ui/primitives';
import type { AudioClip, Shot } from '../../model/types';
import { AudioClipBar } from './AudioClipBar';

interface TimelineMediaTrackProps {
    clips: AudioClip[];
    muted: boolean;
    timelineWidth: number;
    totalDurationMs: number;
    pxPerMs: number;
    timelineView: 'video' | 'scene';
    activeShot?: Shot;
    onToggleMute: () => void;
    onClipDrag: (event: React.PointerEvent<HTMLElement>, clip: AudioClip, edge: 'move' | 'left' | 'right') => void;
    onClipSeek: (timeMs: number) => void;
    onClipDelete: (clipId: string) => void;
    onClipContextMenu: (event: React.MouseEvent, clip: AudioClip) => void;
}

export function TimelineMediaTrack({
    clips,
    muted,
    timelineWidth,
    totalDurationMs,
    pxPerMs,
    timelineView,
    activeShot,
    onToggleMute,
    onClipDrag,
    onClipSeek,
    onClipDelete,
    onClipContextMenu,
}: TimelineMediaTrackProps) {
    if (clips.length === 0) return null;

    return (
        <div
            className="relative h-7 mb-2 rounded-md bg-white/[0.025] border border-white/[0.06] flex items-center"
            style={{ width: `${Math.max(timelineWidth, totalDurationMs * pxPerMs)}px` }}
            aria-label="Imported media timeline"
        >
            <span className="absolute left-2 top-1 text-[10px] uppercase tracking-wider font-semibold text-slate-400 z-10">Media</span>
            <IconButton
                unstyled
                tooltip={false}
                label={muted ? 'Unmute audio' : 'Mute audio'}
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                    event.stopPropagation();
                    onToggleMute();
                }}
                title={muted ? 'Unmute audio' : 'Mute audio'}
                className="absolute right-2 top-1 text-[10px] text-slate-400 hover:text-white z-10 flex items-center gap-1 cursor-pointer"
                icon={muted ? (
                    <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                ) : (
                    <Volume2 className="w-3.5 h-3.5 text-slate-300" />
                )}
            />
            {clips.map((clip) => {
                const clipEnd = clip.startMs + clip.durationMs;
                const isSceneView = timelineView === 'scene' && activeShot;
                if (isSceneView) {
                    const shotStart = activeShot.startMs;
                    const shotEnd = shotStart + activeShot.durationMs;
                    if (clipEnd <= shotStart || clip.startMs >= shotEnd) return null;

                    const visibleStart = Math.max(clip.startMs, shotStart);
                    const visibleEnd = Math.min(clipEnd, shotEnd);
                    return (
                        <AudioClipBar
                            key={clip.id}
                            clip={clip}
                            left={(visibleStart - shotStart) * pxPerMs}
                            width={Math.max(18, (visibleEnd - visibleStart) * pxPerMs)}
                            muted={clip.muted || muted}
                            onDrag={(event, edge) => onClipDrag(event, clip, edge)}
                            onSeek={() => onClipSeek(visibleStart)}
                            onDelete={() => onClipDelete(clip.id)}
                            onContextMenu={(event) => onClipContextMenu(event, clip)}
                        />
                    );
                }

                return (
                    <AudioClipBar
                        key={clip.id}
                        clip={clip}
                        left={Math.max(0, clip.startMs) * pxPerMs}
                        width={Math.max(18, clip.durationMs * pxPerMs)}
                        muted={clip.muted || muted}
                        onDrag={(event, edge) => onClipDrag(event, clip, edge)}
                        onSeek={() => onClipSeek(Math.max(0, clip.startMs))}
                        onDelete={() => onClipDelete(clip.id)}
                        onContextMenu={(event) => onClipContextMenu(event, clip)}
                    />
                );
            })}
        </div>
    );
}
