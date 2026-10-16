import React, { useRef } from 'react';
import {
    Scissors,
    Layers,
    ArrowRight,
    ArrowLeftRight,
    Plus,
    Volume2,
    VolumeX,
    Music,
    Copy,
    Trash2,
} from 'lucide-react';
import type { Shot } from '../../model/types';
import { useProjectStore } from '../../store/useProjectStore';

interface ShotTrackProps {
    shots: Shot[];
    activeShotId?: string;
    pxPerMs: number;
    audioLabel: string;
    totalDurationMs: number;
    onSelectShot: (shotId: string) => void;
    onZoomIntoShot: (shotId: string) => void;
}

export const ShotTrack: React.FC<ShotTrackProps> = ({
    shots,
    activeShotId,
    pxPerMs,
    audioLabel,
    totalDurationMs,
    onSelectShot,
    onZoomIntoShot,
}) => {
    const {
        updateShot,
        duplicateShot,
        deleteShot,
        addShot,
        beginDragTransaction,
        commitDragTransaction,
        project,
        updateProject,
    } = useProjectStore();

    const resizeShotDuration = (shotId: string, durationMs: number, options?: { skipHistory?: boolean }) => {
        updateShot(shotId, (s) => ({ ...s, durationMs: Math.max(300, Math.round(durationMs)) }), options);
    };

    const reorderShots = (fromIndex: number, toIndex: number) => {
        updateProject((proj) => {
            const next = [...proj.shots];
            const [moved] = next.splice(fromIndex, 1);
            next.splice(toIndex, 0, moved);
            return { ...proj, shots: next };
        });
    };

    const toggleAudioMute = () => {};



    const dragRef = useRef<{
        shotId: string;
        startX: number;
        origDurationMs: number;
        shotIndex: number;
    } | null>(null);

    const handleTrimStart = (
        e: React.MouseEvent,
        shot: Shot,
        mode: 'trim-left' | 'trim-right'
    ) => {
        e.preventDefault();
        e.stopPropagation();
        onSelectShot(shot.id);
        dragRef.current = {
            shotId: shot.id,
            startX: e.clientX,
            origDurationMs: shot.durationMs,
            shotIndex: shots.findIndex((s) => s.id === shot.id),
        };
        beginDragTransaction();

        const onPointerMove = (ev: MouseEvent) => {
            const drag = dragRef.current;
            if (!drag) return;
            const deltaMs = Math.round((ev.clientX - drag.startX) / Math.max(pxPerMs, 0.0001) / 10) * 10;

            if (mode === 'trim-right') {
                const nextDuration = Math.max(300, drag.origDurationMs + deltaMs);
                resizeShotDuration(drag.shotId, nextDuration, { skipHistory: true });
            } else if (mode === 'trim-left') {
                const nextDuration = Math.max(300, drag.origDurationMs - deltaMs);
                resizeShotDuration(drag.shotId, nextDuration, { skipHistory: true });
            }
        };

        const onPointerUp = () => {
            commitDragTransaction();
            dragRef.current = null;
            window.removeEventListener('mousemove', onPointerMove);
            window.removeEventListener('mouseup', onPointerUp);
        };

        window.addEventListener('mousemove', onPointerMove);
        window.addEventListener('mouseup', onPointerUp);
    };

    const handleShotDragReorder = (e: React.MouseEvent, shot: Shot, index: number) => {
        e.preventDefault();
        e.stopPropagation();
        onSelectShot(shot.id);
        dragRef.current = {
            shotId: shot.id,
            startX: e.clientX,
            origDurationMs: shot.durationMs,
            shotIndex: index,
        };
        beginDragTransaction();

        const onPointerMove = (ev: MouseEvent) => {
            const drag = dragRef.current;
            if (!drag) return;
            const deltaPx = ev.clientX - drag.startX;
            const currentIndex = drag.shotIndex;

            // Check if dragged past previous or next shot center
            if (deltaPx > 60 && currentIndex < shots.length - 1) {
                reorderShots(currentIndex, currentIndex + 1);
                drag.shotIndex = currentIndex + 1;
                drag.startX = ev.clientX;
            } else if (deltaPx < -60 && currentIndex > 0) {
                reorderShots(currentIndex, currentIndex - 1);
                drag.shotIndex = currentIndex - 1;
                drag.startX = ev.clientX;
            }
        };

        const onPointerUp = () => {
            commitDragTransaction();
            dragRef.current = null;
            window.removeEventListener('mousemove', onPointerMove);
            window.removeEventListener('mouseup', onPointerUp);
        };

        window.addEventListener('mousemove', onPointerMove);
        window.addEventListener('mouseup', onPointerUp);
    };

    const cycleTransitionType = (shotId: string, currentType: 'cut' | 'crossfade' | 'push' | 'slide') => {
        const types: Array<'cut' | 'crossfade' | 'push' | 'slide'> = ['cut', 'crossfade', 'push', 'slide'];
        const nextIdx = (types.indexOf(currentType) + 1) % types.length;
        const nextType = types[nextIdx];
        updateShot(shotId, (s) => ({
            ...s,
            transition: {
                ...s.transition,
                type: nextType,
                durationMs: nextType === 'cut' ? 0 : Math.max(300, s.transition.durationMs || 500),
            },
        }));
    };

    const renderTransitionIcon = (type: string) => {
        switch (type) {
            case 'crossfade':
                return <Layers className="w-2.5 h-2.5" />;
            case 'push':
                return <ArrowRight className="w-2.5 h-2.5" />;
            case 'slide':
                return <ArrowLeftRight className="w-2.5 h-2.5" />;
            case 'cut':
            default:
                return <Scissors className="w-2.5 h-2.5" />;
        }
    };

    return (
        <div className="space-y-2 pt-2">
            {/* ROW 1: Audio Track Pill */}
            <div className="h-7 relative flex items-center">
                <div
                    onMouseDown={(e) => e.stopPropagation()}
                    title={`${audioLabel} (Audio Track)`}
                    className="h-7 rounded-lg border border-[#ea580c]/60 bg-gradient-to-r from-[#5c2008]/85 via-[#431505]/80 to-[#1f0a03]/90 shadow-sm flex items-center justify-between px-2.5 group transition"
                    style={{
                        position: 'absolute',
                        left: 0,
                        width: `${Math.max(80, totalDurationMs * pxPerMs)}px`,
                    }}
                >
                    <div className="flex items-center gap-1.5 truncate pointer-events-none">
                        <Music className="w-3 h-3 text-orange-400 shrink-0" />
                        <span className="text-[10px] font-medium text-orange-200 truncate">
                            {audioLabel}
                        </span>
                    </div>

                    <button
                        onClick={toggleAudioMute}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-orange-500/20 text-orange-300 transition"
                        title={project.audio?.muted ? 'Unmute Audio' : 'Mute Audio'}
                    >
                        {project.audio?.muted ? (
                            <VolumeX className="w-3 h-3" />
                        ) : (
                            <Volume2 className="w-3 h-3" />
                        )}
                    </button>
                </div>
            </div>

            {/* ROW 2: Sequential Shots Track */}
            <div className="h-8 relative flex items-center">
                {shots.map((shot, idx) => {
                    const isSelected = shot.id === activeShotId;
                    const left = shot.startMs * pxPerMs;
                    const width = Math.max(48, shot.durationMs * pxPerMs);
                    const nextShot = shots[idx + 1];
                    const isAbutting = nextShot && Math.abs(shot.startMs + shot.durationMs - nextShot.startMs) < 100;

                    return (
                        <React.Fragment key={shot.id}>
                            {/* Shot Clip */}
                            <div
                                onMouseDown={(e) => handleShotDragReorder(e, shot, idx)}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectShot(shot.id);
                                }}
                                onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    onZoomIntoShot(shot.id);
                                }}
                                title={`${shot.name} • ${(shot.durationMs / 1000).toFixed(2)}s\n(Double-click to zoom into scene)`}
                                style={{
                                    position: 'absolute',
                                    left: `${left}px`,
                                    width: `${width}px`,
                                }}
                                className={`h-8 rounded-lg border transition select-none flex items-center justify-between px-2 cursor-grab active:cursor-grabbing group ${
                                    isSelected
                                        ? 'border-[#0090ff] bg-gradient-to-b from-[#083c6e]/95 via-[#062c52]/90 to-[#041d38]/95 shadow-[0_0_12px_rgba(0,144,255,0.3)] ring-1 ring-[#38bdf8]/50'
                                        : 'border-[#0284c7]/60 bg-gradient-to-b from-[#062c52]/80 to-[#031529]/90 hover:border-[#38bdf8]/80'
                                }`}
                            >
                                {/* Left Trim Handle */}
                                <div
                                    onMouseDown={(e) => handleTrimStart(e, shot, 'trim-left')}
                                    title="Drag to trim start"
                                    className="absolute left-0 top-0 bottom-0 w-2.5 cursor-ew-resize flex items-center justify-center opacity-0 group-hover:opacity-100 transition z-10"
                                >
                                    <div className="w-1 h-4 rounded-full bg-white/70" />
                                </div>

                                {/* Shot Label */}
                                <div className="flex items-center gap-1.5 min-w-0 pointer-events-none px-1">
                                    <span className="text-[11px] font-medium text-white truncate">
                                        {shot.name}
                                    </span>
                                    <span className="text-[9px] font-mono text-white/50 shrink-0">
                                        {(shot.durationMs / 1000).toFixed(1)}s
                                    </span>
                                </div>

                                {/* Shot Quick Actions on Hover */}
                                <div className="hidden group-hover:flex items-center gap-1 shrink-0 z-10">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            duplicateShot(shot.id);
                                        }}
                                        title="Duplicate shot"
                                        className="p-0.5 rounded hover:bg-white/20 text-white/70 hover:text-white transition"
                                    >
                                        <Copy className="w-2.5 h-2.5" />
                                    </button>
                                    {shots.length > 1 && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                deleteShot(shot.id);
                                            }}
                                            title="Delete shot"
                                            className="p-0.5 rounded hover:bg-red-500/20 text-white/70 hover:text-red-400 transition"
                                        >
                                            <Trash2 className="w-2.5 h-2.5" />
                                        </button>
                                    )}
                                </div>

                                {/* Right Trim Handle */}
                                <div
                                    onMouseDown={(e) => handleTrimStart(e, shot, 'trim-right')}
                                    title="Drag to trim duration"
                                    className="absolute right-0 top-0 bottom-0 w-2.5 cursor-ew-resize flex items-center justify-center opacity-0 group-hover:opacity-100 transition z-10"
                                >
                                    <div className="w-1 h-4 rounded-full bg-white/70" />
                                </div>
                            </div>

                            {/* Transition Junction between adjacent shots */}
                            {isAbutting && (
                                <div
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        cycleTransitionType(shot.id, shot.transition?.type || 'cut');
                                    }}
                                    title={`Transition: ${shot.transition?.type || 'cut'} (Click to cycle)`}
                                    style={{
                                        position: 'absolute',
                                        left: `${left + width - 7}px`,
                                        zIndex: 25,
                                    }}
                                    className="w-3.5 h-5 rounded-sm bg-[#18181b] border border-white/30 hover:border-white hover:bg-[#27272a] text-white/80 hover:text-white flex items-center justify-center cursor-pointer transition shadow-md"
                                >
                                    {renderTransitionIcon(shot.transition?.type || 'cut')}
                                </div>
                            )}
                        </React.Fragment>
                    );
                })}

                {/* Add Shot / Track Slot Button */}
                <button
                    onClick={addShot}
                    title="Add new shot to sequence"
                    style={{
                        position: 'absolute',
                        left: `${totalDurationMs * pxPerMs + 8}px`,
                    }}
                    className="h-8 px-2.5 rounded-lg border border-dashed border-white/20 hover:border-white/50 bg-white/[0.03] hover:bg-white/[0.08] text-white/60 hover:text-white flex items-center gap-1 text-[11px] font-medium transition cursor-pointer"
                >
                    <Plus className="w-3 h-3" />
                    <span>Add Shot</span>
                </button>
            </div>
        </div>
    );
};
