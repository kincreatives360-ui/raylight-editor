// src/panels/Timeline/Timeline.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Play,
    Pause,
    Video,
    Sun,
    Plus,
    ChevronRight,
    ChevronDown,
    ArrowLeft,
} from 'lucide-react';
import type { Shot, Layer, CameraBlock } from '../../model/types';
import { useProjectStore } from '../../store/useProjectStore';
import { usePlayheadStore } from '../../store/usePlayheadStore';
import { useSelectionStore } from '../../store/useSelectionStore';
import { ShotTrack } from './ShotTrack';
import { CameraBlockItem } from './CameraBlockItem';
import { BlockItem } from './BlockItem';

interface TimelineProps {
    activeShot?: Shot;
    totalDurationMs: number;
    audioLabel: string;
}

export const Timeline: React.FC<TimelineProps> = ({
    activeShot: activeShotProp,
    totalDurationMs,
    audioLabel,
}) => {
    const {
        project,
        updateShot,
        updateLayer,
        splitShotAtPlayhead,
        beginDragTransaction,
        commitDragTransaction,
    } = useProjectStore();

    const {
        currentTimeMs,
        isPlaying,
        setCurrentTimeMs,
        togglePlay,
    } = usePlayheadStore();

    const {
        selectedShotId,
        selectedLayerIds,
        selectedBlockId,
        timelineView,
        timelineZoom,
        expandedTimelineLayerIds,
        selectShot,
        selectLayer,
        selectBlock,
        setTimelineView,
        setTimelineZoom,
        toggleTimelineLayerExpanded,
    } = useSelectionStore();

    const trackRef = useRef<HTMLDivElement | null>(null);
    const [dragging, setDragging] = useState(false);
    const [timelineHeight, setTimelineHeight] = useState(250);

    const activeShot =
        activeShotProp ??
        project.shots.find((shot) => shot.id === selectedShotId) ??
        project.shots[0];

    const selectedLayer =
        activeShot?.layers.find((l) => selectedLayerIds.includes(l.id)) ||
        activeShot?.layers[0];

    // Compute durations & scaling
    const visibleDurationMs =
        timelineView === 'scene' && activeShot
            ? Math.max(4500, activeShot.durationMs + 700)
            : Math.max(totalDurationMs + 1000, 8000);

    const pxPerSecond =
        timelineView === 'scene' ? 160 * timelineZoom : 50 * timelineZoom;
    const pxPerMs = pxPerSecond / 1000;
    const timelineWidth = Math.max(760, visibleDurationMs * pxPerMs + 100);

    // Dynamic top edge resize handler
    const handleResizerMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        const startY = e.clientY;
        const startH = timelineHeight;

        const onMouseMove = (ev: MouseEvent) => {
            const deltaY = startY - ev.clientY; // dragging up increases height
            setTimelineHeight(Math.max(160, Math.min(520, startH + deltaY)));
        };

        const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    // Ruler marks matching Raylight
    const rulerMarks = useMemo(() => {
        const stepMs = timelineView === 'scene' ? 1000 : 2000;
        const marks: { timeMs: number; isHalf?: boolean }[] = [];
        for (let t = 0; t <= visibleDurationMs; t += stepMs / 2) {
            const isHalf = t % stepMs !== 0;
            if (timelineView === 'video' && isHalf) continue;
            marks.push({ timeMs: t, isHalf });
        }
        return marks;
    }, [visibleDurationMs, timelineView]);

    // Keyboard shortcuts: Q (in), W (out), C / Cmd+B (cut), Shift+Z (fit)
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            const tag = document.activeElement?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            const key = e.key.toLowerCase();

            if (e.shiftKey && key === 'z' && !e.metaKey && !e.ctrlKey) {
                e.preventDefault();
                setTimelineZoom(1);
                return;
            }

            if (
                (key === 'c' && !e.metaKey && !e.ctrlKey) ||
                ((e.metaKey || e.ctrlKey) && key === 'b')
            ) {
                e.preventDefault();
                if (activeShot) {
                    const created = splitShotAtPlayhead(activeShot.id, currentTimeMs);
                    if (created) selectShot(created.id, created.layers[0]?.id);
                }
                return;
            }

            if (
                key === 'q' &&
                !e.metaKey &&
                !e.ctrlKey &&
                activeShot &&
                selectedLayer
            ) {
                e.preventDefault();
                const localMs = Math.max(
                    0,
                    Math.min(
                        selectedLayer.outMs - 100,
                        Math.round(currentTimeMs - activeShot.startMs)
                    )
                );
                updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                    ...l,
                    inMs: localMs,
                }));
            }

            if (
                key === 'w' &&
                !e.metaKey &&
                !e.ctrlKey &&
                activeShot &&
                selectedLayer
            ) {
                e.preventDefault();
                const localMs = Math.max(
                    selectedLayer.inMs + 100,
                    Math.min(
                        activeShot.durationMs,
                        Math.round(currentTimeMs - activeShot.startMs)
                    )
                );
                updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                    ...l,
                    outMs: localMs,
                }));
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [
        activeShot,
        selectedLayer,
        currentTimeMs,
        splitShotAtPlayhead,
        selectShot,
        updateLayer,
        setTimelineZoom,
    ]);

    const scrubFromClientX = (clientX: number) => {
        const el = trackRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const paddingLeft =
            parseFloat(window.getComputedStyle(el).paddingLeft) || 0;
        const contentX = Math.max(
            0,
            clientX - rect.left - paddingLeft + el.scrollLeft
        );
        const localMs = contentX / pxPerMs;

        if (timelineView === 'scene' && activeShot) {
            setCurrentTimeMs(
                activeShot.startMs + Math.min(activeShot.durationMs, localMs)
            );
        } else {
            setCurrentTimeMs(Math.min(totalDurationMs, localMs));
        }
    };

    const handleTimelineScroll = () => {
        if (!trackRef.current) return;
        window.dispatchEvent(
            new CustomEvent('timeline-vertical-scroll', {
                detail: {
                    scrollTop: trackRef.current.scrollTop,
                    source: 'timeline',
                },
            })
        );
    };

    useEffect(() => {
        const handleSync = (e: Event) => {
            const ce = e as CustomEvent;
            if (ce.detail?.source === 'leftPanel' && trackRef.current) {
                trackRef.current.scrollTop = ce.detail.scrollTop;
            }
        };
        window.addEventListener('timeline-vertical-scroll', handleSync);
        return () =>
            window.removeEventListener('timeline-vertical-scroll', handleSync);
    }, []);

    const handleRulerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault();
        scrubFromClientX(e.clientX);
        const onMove = (ev: MouseEvent) => scrubFromClientX(ev.clientX);
        const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    };

    // Layer Bar Drag in Scene View
    const startLayerBarDrag = (
        e: React.MouseEvent,
        shot: Shot,
        layer: Layer,
        mode: 'move' | 'in' | 'out'
    ) => {
        e.preventDefault();
        e.stopPropagation();
        selectLayer(layer.id, false);
        const startX = e.clientX;
        const origIn = layer.inMs;
        const origOut = layer.outMs;
        beginDragTransaction();
        setDragging(true);

        const onMove = (ev: MouseEvent) => {
            const deltaMs = Math.round((ev.clientX - startX) / pxPerMs / 10) * 10;
            let nextIn = origIn;
            let nextOut = origOut;

            if (mode === 'in') {
                nextIn = Math.max(0, Math.min(origOut - 100, origIn + deltaMs));
            } else if (mode === 'out') {
                nextOut = Math.max(
                    origIn + 100,
                    Math.min(shot.durationMs, origOut + deltaMs)
                );
            } else {
                const dur = origOut - origIn;
                nextIn = Math.max(0, Math.min(shot.durationMs - dur, origIn + deltaMs));
                nextOut = nextIn + dur;
            }

            updateLayer(
                shot.id,
                layer.id,
                (l) => ({ ...l, inMs: nextIn, outMs: nextOut }),
                { skipHistory: true }
            );
        };

        const onUp = () => {
            commitDragTransaction();
            setDragging(false);
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    };

    // Add new camera framing block
    const handleAddCameraMove = () => {
        if (!activeShot) return;
        const count = activeShot.cameraBlocks.length;
        const fromFramingId = activeShot.framings[0]?.id || 'framing-1';
        const toFramingId = activeShot.framings[1]?.id || activeShot.framings[0]?.id || 'framing-2';
        const newBlock: CameraBlock = {
            id: `cam-block-${Date.now()}`,
            label: `Move ${count + 1}`,
            startMs: Math.min(activeShot.durationMs - 1000, count * 1500),
            durationMs: 1200,
            fromFramingId,
            toFramingId,
            mode: 'dolly',
            easing: { kind: 'preset', name: 'ease-out-expo' },
        };
        updateShot(activeShot.id, (s) => ({
            ...s,
            cameraBlocks: [...s.cameraBlocks, newBlock],
        }));
    };

    const playheadDisplayTimeMs =
        timelineView === 'scene' && activeShot
            ? Math.max(0, currentTimeMs - activeShot.startMs)
            : currentTimeMs;

    return (
        <section
            style={{ height: `${timelineHeight}px` }}
            className="border-t border-white/[0.08] bg-[#0b0b0d] flex flex-col shrink-0 select-none relative"
        >
            {/* 0. RESIZER DRAG HANDLE ON TOP EDGE */}
            <div
                onMouseDown={handleResizerMouseDown}
                title="Drag to resize timeline height"
                className="group absolute inset-x-0 top-0 z-40 flex h-2.5 -translate-y-1/2 cursor-row-resize touch-none items-center justify-center"
            >
                <div className="w-12 h-1 rounded-full bg-white/20 group-hover:bg-white/60 transition" />
            </div>

            {/* 1. TOP HEADER & CONTROLS */}
            <div className="h-9 px-3 flex items-center justify-between shrink-0 border-b border-white/[0.05] bg-[#0d0d10]">
                {/* Left: Play/Pause, Timecode, and Level Switcher */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={togglePlay}
                        title="Play / Pause (Space)"
                        className="w-6 h-6 rounded-md hover:bg-white/10 flex items-center justify-center text-white cursor-pointer transition border border-white/20"
                    >
                        {isPlaying ? (
                            <Pause className="w-3 h-3 fill-current" />
                        ) : (
                            <Play className="w-3 h-3 ml-0.5 fill-current" />
                        )}
                    </button>

                    {/* Timecode display */}
                    <div className="text-[11px] font-mono text-[#a1a1aa] flex items-center gap-1 select-none">
                        <span className="text-white font-semibold">
                            {(playheadDisplayTimeMs / 1000).toFixed(2)}s
                        </span>
                        <span className="text-[#52525b]">/</span>
                        <span>
                            {((timelineView === 'scene' && activeShot
                                ? activeShot.durationMs
                                : totalDurationMs) / 1000).toFixed(2)}s
                        </span>
                    </div>

                    {/* Level Indicator / Breadcrumb Button */}
                    <div className="flex items-center gap-1.5 ml-2">
                        {timelineView === 'scene' && activeShot ? (
                            <button
                                onClick={() => setTimelineView('video')}
                                className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#0088ff]/15 border border-[#0088ff]/40 text-[#38bdf8] hover:bg-[#0088ff]/25 text-[10px] font-medium transition cursor-pointer"
                                title="Click to zoom back out to all shots (or press Shift+Z)"
                            >
                                <ArrowLeft className="w-2.5 h-2.5" />
                                <span>Shot: {activeShot.name}</span>
                            </button>
                        ) : (
                            <span className="px-2 py-0.5 rounded-full bg-white/[0.05] text-white/60 text-[10px] font-medium border border-white/10">
                                Project Overview
                            </span>
                        )}
                    </div>
                </div>

                {/* Right: Zoom Slider */}
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-white/40">Zoom</span>
                    <div className="relative w-24 h-1.5 rounded-full bg-[#27272a] flex items-center">
                        <div
                            className="h-full rounded-full bg-[#0088ff]"
                            style={{
                                width: `${((timelineZoom - 0.8) / (2.4 - 0.8)) * 100}%`,
                            }}
                        />
                        <input
                            aria-label="Timeline Zoom"
                            type="range"
                            min={0.8}
                            max={2.4}
                            step={0.05}
                            value={timelineZoom}
                            onChange={(e) => setTimelineZoom(Number(e.target.value))}
                            className="absolute inset-0 w-full opacity-0 cursor-pointer"
                        />
                        <div
                            className="w-3.5 h-3.5 rounded-full bg-white shadow pointer-events-none absolute -ml-1.5"
                            style={{
                                left: `${((timelineZoom - 0.8) / (2.4 - 0.8)) * 100}%`,
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* 2. SCROLLABLE TIMELINE RULER & TRACKS */}
            <div
                ref={trackRef}
                onMouseDown={handleRulerMouseDown}
                onScroll={handleTimelineScroll}
                className={`flex-1 overflow-auto relative px-3 ${
                    dragging ? 'cursor-grabbing' : 'cursor-pointer'
                }`}
            >
                <div
                    style={{ width: `${timelineWidth}px`, minWidth: '100%' }}
                    className="relative min-h-full pb-6"
                >
                    {/* Time Ruler */}
                    <div
                        data-timeline-ruler=""
                        className="h-5 shrink-0 border-b border-white/[0.08] relative flex items-center text-[9px] font-mono text-[#71717a] pointer-events-none"
                    >
                        {rulerMarks.map((m) => (
                            <div
                                key={m.timeMs}
                                className="absolute top-0 flex h-full flex-col items-start"
                                style={{ left: `${m.timeMs * pxPerMs}px` }}
                            >
                                <div className="h-1.5 w-px bg-white/20" />
                                {m.isHalf ? (
                                    <span className="mt-px -translate-x-1/2 text-white/30">&middot;</span>
                                ) : (
                                    <span className="mt-px -translate-x-1/2 font-mono text-[9px] text-white/60 tabular-nums">
                                        {Math.round(m.timeMs / 1000)}s
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* =============================================================== */}
                    {/* STATE 1: VIDEO LEVEL (Project Sequential Shots & Audio)         */}
                    {/* =============================================================== */}
                    {timelineView === 'video' && (
                        <ShotTrack
                            shots={project.shots}
                            activeShotId={activeShot?.id}
                            pxPerMs={pxPerMs}
                            audioLabel={audioLabel}
                            totalDurationMs={totalDurationMs}
                            onSelectShot={(id) => {
                                selectShot(id);
                                const s = project.shots.find((shot) => shot.id === id);
                                if (s) setCurrentTimeMs(s.startMs);
                            }}
                            onZoomIntoShot={(id) => {
                                selectShot(id);
                                const s = project.shots.find((shot) => shot.id === id);
                                if (s) setCurrentTimeMs(s.startMs);
                                setTimelineView('scene');
                            }}
                        />
                    )}

                    {/* =============================================================== */}
                    {/* STATE 2: SCENE LEVEL (Shot Drilldown: Camera, Light, Layers)    */}
                    {/* =============================================================== */}
                    {timelineView === 'scene' && activeShot && (
                        <div className="relative pt-1 space-y-1">
                            {/* TRACK 1: CAMERA FRAMING TRACK */}
                            <div className="space-y-0.5">
                                <div className="h-6 relative flex items-center bg-white/[0.02] rounded px-1.5 border border-white/[0.04]">
                                    <div className="w-32 flex items-center gap-1.5 text-[10px] font-medium text-sky-400 shrink-0 pointer-events-none">
                                        <Video className="w-3 h-3 text-sky-400" />
                                        <span>Camera Track</span>
                                    </div>

                                    {/* Camera Blocks Container */}
                                    <div className="flex-1 relative h-5">
                                        {activeShot.cameraBlocks.map((block) => {
                                            const fromName =
                                                activeShot.framings.find((f) => f.id === block.fromFramingId)?.name || 'Framing A';
                                            const toName =
                                                activeShot.framings.find((f) => f.id === block.toFramingId)?.name || 'Framing B';
                                            return (
                                                <CameraBlockItem
                                                    key={block.id}
                                                    shot={{ ...activeShot, startMs: 0 }}
                                                    cameraBlock={block}
                                                    fromFramingName={fromName}
                                                    toFramingName={toName}
                                                    pxPerMs={pxPerMs}
                                                    selected={selectedBlockId === block.id}
                                                    onSelect={() => selectBlock(block.id)}
                                                    onUpdate={(patch, skipHistory) => {
                                                        updateShot(activeShot.id, (s) => ({
                                                            ...s,
                                                            cameraBlocks: s.cameraBlocks.map((b) =>
                                                                b.id === block.id ? { ...b, ...patch } : b
                                                            ),
                                                        }), { skipHistory });
                                                    }}
                                                    onDelete={() => {
                                                        updateShot(activeShot.id, (s) => ({
                                                            ...s,
                                                            cameraBlocks: s.cameraBlocks.filter((b) => b.id !== block.id),
                                                        }));
                                                    }}
                                                    beginDragTransaction={beginDragTransaction}
                                                    commitDragTransaction={commitDragTransaction}
                                                />
                                            );
                                        })}

                                        {activeShot.cameraBlocks.length === 0 && (
                                            <button
                                                onClick={handleAddCameraMove}
                                                className="h-4 px-2 rounded bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-300 text-[9px] font-medium flex items-center gap-1 transition cursor-pointer"
                                            >
                                                <Plus className="w-2.5 h-2.5" />
                                                <span>Add Camera Move</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* TRACK 2: LIGHTING RIG TRACK */}
                            <div className="space-y-0.5">
                                <div className="h-6 relative flex items-center bg-white/[0.02] rounded px-1.5 border border-white/[0.04]">
                                    <div className="w-32 flex items-center gap-1.5 text-[10px] font-medium text-amber-400 shrink-0 pointer-events-none">
                                        <Sun className="w-3 h-3 text-amber-400" />
                                        <span>Lighting Rig</span>
                                    </div>

                                    {/* Lighting Status Pill */}
                                    <div
                                        style={{
                                            left: '128px',
                                            width: `${Math.max(48, activeShot.durationMs * pxPerMs)}px`,
                                        }}
                                        className="absolute h-4 rounded-full border border-amber-500/30 bg-amber-500/10 flex items-center px-2 text-[9px] font-mono text-amber-200 pointer-events-none"
                                    >
                                        <span>
                                            {activeShot.light?.temperature ?? 6500}K • {Math.round((activeShot.light?.intensity ?? 1) * 100)}%
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* TRACK 3...N: PER-LAYER TRACKS */}
                            {activeShot.layers
                                .slice()
                                .sort((a, b) => b.order - a.order)
                                .map((layer) => {
                                    const isSelected = selectedLayerIds.includes(layer.id);
                                    const isExpanded = expandedTimelineLayerIds.includes(layer.id);
                                    const hasAnimItems =
                                        layer.entrance.type !== 'none' ||
                                        layer.exit.type !== 'none' ||
                                        layer.blocks.length > 0;

                                    const left = layer.inMs * pxPerMs;
                                    const width = Math.max(
                                        32,
                                        (layer.outMs - layer.inMs) * pxPerMs
                                    );

                                    // Raylight layer pill color styling
                                    const barStyle = isSelected
                                        ? 'border border-[#38bdf8] bg-gradient-to-r from-[#073b63]/95 via-[#0a4f82]/95 to-[#073b63]/95 shadow-[0_0_8px_rgba(56,189,248,0.3)]'
                                        : layer.kind === 'text'
                                        ? 'border border-[#ec4899]/70 bg-gradient-to-r from-[#70153c]/85 via-[#9d174d]/85 to-[#70153c]/85'
                                        : layer.kind === 'shape'
                                        ? 'border border-[#6d28d9]/70 bg-gradient-to-r from-[#261447]/85 to-[#1b0e36]/85'
                                        : 'border border-[#1d4ed8]/70 bg-gradient-to-r from-[#112236]/85 to-[#0d1929]/85';

                                    return (
                                        <div key={layer.id} className="space-y-0.5">
                                            {/* Layer Row */}
                                            <div className="h-7 relative flex items-center">
                                                {/* Expand / Collapse toggle for animations */}
                                                {hasAnimItems && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            toggleTimelineLayerExpanded(layer.id);
                                                        }}
                                                        className="absolute -left-1 z-20 p-0.5 rounded hover:bg-white/10 text-white/50 hover:text-white transition"
                                                        title={isExpanded ? 'Collapse animations' : 'Expand animations'}
                                                    >
                                                        {isExpanded ? (
                                                            <ChevronDown className="w-3 h-3" />
                                                        ) : (
                                                            <ChevronRight className="w-3 h-3" />
                                                        )}
                                                    </button>
                                                )}

                                                {/* Main Timing Pill */}
                                                <div
                                                    onMouseDown={(e) =>
                                                        startLayerBarDrag(e, activeShot, layer, 'move')
                                                    }
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        selectLayer(layer.id, false);
                                                    }}
                                                    style={{ left: `${left}px`, width: `${width}px` }}
                                                    className={`absolute top-0.5 bottom-0.5 rounded-lg cursor-grab active:cursor-grabbing transition flex items-center justify-between px-2 select-none group ${barStyle}`}
                                                >
                                                    {/* In-point trim handle */}
                                                    <div
                                                        onMouseDown={(e) =>
                                                            startLayerBarDrag(e, activeShot, layer, 'in')
                                                        }
                                                        title="Drag to adjust in-point"
                                                        className="absolute left-0 top-0 bottom-0 w-2.5 cursor-ew-resize flex items-center justify-center opacity-0 group-hover:opacity-100 transition z-10"
                                                    >
                                                        <div className="w-1 h-3.5 rounded-full bg-white/70" />
                                                    </div>

                                                    <span className="text-[10px] font-medium text-white truncate pointer-events-none">
                                                        {layer.name}
                                                    </span>

                                                    {/* Out-point trim handle */}
                                                    <div
                                                        onMouseDown={(e) =>
                                                            startLayerBarDrag(e, activeShot, layer, 'out')
                                                        }
                                                        title="Drag to adjust out-point"
                                                        className="absolute right-0 top-0 bottom-0 w-2.5 cursor-ew-resize flex items-center justify-center opacity-0 group-hover:opacity-100 transition z-10"
                                                    >
                                                        <div className="w-1 h-3.5 rounded-full bg-white/70" />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Sub-rows: Entrance, Exit, and Animation Blocks */}
                                            {isExpanded && hasAnimItems && (
                                                <div className="space-y-0.5 pl-4 border-l border-white/[0.06] ml-2">
                                                    {/* Entrance / Exit preset indicator */}
                                                    {(layer.entrance.type !== 'none' || layer.exit.type !== 'none') && (
                                                        <div className="h-5 relative flex items-center">
                                                            {layer.entrance.type !== 'none' && (
                                                                <div
                                                                    style={{
                                                                        left: `${(layer.inMs + layer.entrance.delayMs) * pxPerMs}px`,
                                                                        width: `${Math.max(28, layer.entrance.durationMs * pxPerMs)}px`,
                                                                    }}
                                                                    className="absolute h-3.5 rounded-full border border-[#8b5cf6] bg-[#341a63]/90 flex items-center px-1 text-[8px] font-medium text-purple-200"
                                                                    title={`In: ${layer.entrance.type} (${layer.entrance.durationMs}ms)`}
                                                                >
                                                                    <span className="truncate">In: {layer.entrance.type}</span>
                                                                </div>
                                                            )}
                                                            {layer.exit.type !== 'none' && (
                                                                <div
                                                                    style={{
                                                                        left: `${Math.max(0, layer.outMs - layer.exit.durationMs) * pxPerMs}px`,
                                                                        width: `${Math.max(28, layer.exit.durationMs * pxPerMs)}px`,
                                                                    }}
                                                                    className="absolute h-3.5 rounded-full border border-pink-500/70 bg-pink-900/80 flex items-center px-1 text-[8px] font-medium text-pink-200"
                                                                    title={`Out: ${layer.exit.type} (${layer.exit.durationMs}ms)`}
                                                                >
                                                                    <span className="truncate">Out: {layer.exit.type}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Motion Keyframe Blocks */}
                                                    {layer.blocks.map((blk) => (
                                                        <div key={blk.id} className="h-5 relative flex items-center">
                                                            <BlockItem
                                                                shot={{ ...activeShot, startMs: 0 }}
                                                                block={blk}
                                                                pxPerMs={pxPerMs}
                                                                selected={selectedBlockId === blk.id}
                                                                onSelect={() => selectBlock(blk.id, layer.id)}
                                                                onUpdate={(patch, skipHistory) => {
                                                                    updateLayer(
                                                                        activeShot.id,
                                                                        layer.id,
                                                                        (l) => ({
                                                                            ...l,
                                                                            blocks: l.blocks.map((b) =>
                                                                                b.id === blk.id ? { ...b, ...patch } : b
                                                                            ),
                                                                        }),
                                                                        { skipHistory }
                                                                    );
                                                                }}
                                                                beginDragTransaction={beginDragTransaction}
                                                                commitDragTransaction={commitDragTransaction}
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                            {/* Dimmed Right-Hand Step-Out Curtain (Click to step back out to Video view) */}
                            <div
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setTimelineView('video');
                                }}
                                title="Click dimmed area to step back out to Whole Project"
                                style={{ left: `${activeShot.durationMs * pxPerMs + 8}px` }}
                                className="absolute top-0 bottom-0 right-0 rounded-l-2xl bg-[#090d12]/85 hover:bg-[#121a24]/90 border-l border-white/10 cursor-pointer transition z-10 flex items-center pl-3"
                            >
                                <span className="text-[10px] font-medium text-white/40 hover:text-white/80 transition pointer-events-none">
                                    ← Click to step out
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Playhead Needle & Floating Badge */}
                    <div
                        className="pointer-events-none absolute top-1 bottom-0 w-[1.75px] bg-gradient-to-b from-[#0088ff] to-[#0088ff]/20 z-30"
                        style={{ left: `${playheadDisplayTimeMs * pxPerMs}px` }}
                    >
                        <div className="absolute -left-4 top-0 px-1.5 py-0.2 rounded-full bg-[#0088ff] text-white text-[9px] font-mono font-bold shadow">
                            {(playheadDisplayTimeMs / 1000).toFixed(2)}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};