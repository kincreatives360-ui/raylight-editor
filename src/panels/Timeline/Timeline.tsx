// src/panels/Timeline/Timeline.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';
import type { Shot, Layer, AnimationBlock, CameraBlock, LightAnimationBlock } from '../../model/types';
import { isBlankProjectState } from '../../model/types';
import { recalculateShotStartTimes, useProjectStore } from '../../store/useProjectStore';
import { usePlayheadStore } from '../../store/usePlayheadStore';
import { useSelectionStore } from '../../store/useSelectionStore';
import { evaluateEasing } from '../../engine/easing';

interface TimelineProps {
    totalDurationMs: number;
}

export const Timeline: React.FC<TimelineProps> = ({ totalDurationMs }) => {
    const {
        project,
        updateProject,
        updateShot,
        updateLayer,
        addShot,
        addLayerToShot,
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
        selectedCameraBlockId,
        selectedLightBlockId,
        selectedPresetType,
        timelineView,
        timelineZoom,
        timelineHeightPx,
        timelineScrollTop,
        expandedTimelineLayerIds,
        selectShot,
        selectLayer,
        selectBlock,
        selectCameraBlock,
        selectLightBlock,
        selectPreset,
        setInspectorTab,
        setTimelineView,
        setTimelineZoom,
        setTimelineHeightPx,
        setTimelineScrollTop,
    } = useSelectionStore();

    const trackRef = useRef<HTMLDivElement | null>(null);
    const shotDragRef = useRef<{
        shotId: string;
        index: number;
        startX: number;
        dragging: boolean;
    } | null>(null);
    const suppressShotClickRef = useRef<string | null>(null);
    const [scrollLeft, setScrollLeft] = useState(0);
    const [timelineViewportWidth, setTimelineViewportWidth] = useState(800);
    const [dragging, setDragging] = useState(false);
    const [hoverCameraTimeMs, setHoverCameraTimeMs] = useState<number | null>(null);

    const activeShot =
        project.shots.find((shot) => shot.id === selectedShotId) ??
        project.shots[0];
    const isBlankState = isBlankProjectState(project);

    useEffect(() => {
        const element = trackRef.current;
        if (!element) return;
        const observer = new ResizeObserver(([entry]) => {
            setTimelineViewportWidth(Math.max(1, entry.contentRect.width));
        });
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    // Sync vertical scroll position with LeftPanel's lower track rack
    useEffect(() => {
        const el = trackRef.current;
        if (el && Math.abs(el.scrollTop - timelineScrollTop) > 1) {
            el.scrollTop = timelineScrollTop;
        }
    }, [timelineScrollTop]);

    const visibleDurationMs = isBlankState
        ? 0
        : Math.max(
            1000,
            timelineView === 'scene' && activeShot
                ? activeShot.durationMs
                : totalDurationMs
        );
    const fitWidth = Math.max(120, timelineViewportWidth - 92);
    const fittedPxPerSecond = visibleDurationMs > 0
        ? (fitWidth * 1000) / visibleDurationMs
        : 45;
    const pxPerSecond = fittedPxPerSecond * timelineZoom;
    const pxPerMs = pxPerSecond / 1000;
    const timelineWidth = Math.max(
        1,
        timelineViewportWidth - 32,
        visibleDurationMs * pxPerMs + 60
    );

    const rulerStepMs = useMemo(() => {
        if (visibleDurationMs <= 0) return 1000;
        const desiredStep = (visibleDurationMs * 48) / fitWidth;
        return [1000, 2000, 5000, 10000, 15000, 30000, 60000, 120000, 300000, 600000]
            .find((step) => step >= desiredStep) ?? 600000;
    }, [visibleDurationMs, fitWidth]);

    const rulerMarks = useMemo(() => {
        const marks: { timeMs: number; isHalf?: boolean }[] = [];
        const minorStep = timelineView === 'scene' ? rulerStepMs / 2 : rulerStepMs;
        for (let t = 0; t <= visibleDurationMs; t += minorStep) {
            marks.push({ timeMs: t, isHalf: t % rulerStepMs !== 0 });
        }
        return marks;
    }, [visibleDurationMs, timelineView, rulerStepMs]);

    // Top Splitter Drag: Expand Timeline Up or Contract Down
    const handleStartResizeTimelineHeight = (e: React.MouseEvent) => {
        e.preventDefault();
        const startY = e.clientY;
        const startHeight = timelineHeightPx;

        const onMove = (ev: MouseEvent) => {
            const deltaY = startY - ev.clientY;
            setTimelineHeightPx(startHeight + deltaY);
        };
        const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    };

    const clientXToLocalMs = (clientX: number): number => {
        const el = trackRef.current;
        if (!el) return 0;
        const rect = el.getBoundingClientRect();
        const contentX = clientX - rect.left - 16 + el.scrollLeft;
        const localMs = Math.round(contentX / pxPerMs / 10) * 10;
        return Math.max(0, Math.min(visibleDurationMs, localMs));
    };

    const scrubFromClientX = (clientX: number) => {
        const localMs = clientXToLocalMs(clientX);
        if (timelineView === 'scene' && activeShot) {
            setCurrentTimeMs(
                activeShot.startMs + Math.min(activeShot.durationMs, localMs)
            );
        } else {
            setCurrentTimeMs(Math.min(totalDurationMs, localMs));
        }
    };

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

    // 1. Drag / Trim Main Layer Bar
    const startLayerBarDrag = (
        e: React.MouseEvent,
        shot: Shot,
        layer: Layer,
        mode: 'move' | 'in' | 'out'
    ) => {
        e.preventDefault();
        e.stopPropagation();
        setInspectorTab('layer');
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

    // 2. Drag / Trim In (Entrance) & Out (Exit) Transition Pills!
    const startPresetDrag = (
        e: React.MouseEvent,
        shot: Shot,
        layer: Layer,
        which: 'entrance' | 'exit',
        mode: 'move' | 'left' | 'right'
    ) => {
        e.preventDefault();
        e.stopPropagation();
        selectPreset(which, layer.id);

        const startX = e.clientX;
        const preset = layer[which];
        const origDelay = preset.delayMs || 0;
        const origDur = Math.max(100, preset.durationMs || 500);
        const layerSpan = Math.max(200, layer.outMs - layer.inMs);

        beginDragTransaction();
        setDragging(true);

        const onMove = (ev: MouseEvent) => {
            const deltaMs = Math.round((ev.clientX - startX) / pxPerMs / 10) * 10;

            if (which === 'entrance') {
                let nextDelay = origDelay;
                let nextDur = origDur;
                if (mode === 'move') {
                    nextDelay = Math.max(
                        0,
                        Math.min(layerSpan - origDur, origDelay + deltaMs)
                    );
                } else if (mode === 'left') {
                    nextDelay = Math.max(
                        0,
                        Math.min(origDelay + origDur - 80, origDelay + deltaMs)
                    );
                    nextDur = origDelay + origDur - nextDelay;
                } else if (mode === 'right') {
                    nextDur = Math.max(
                        80,
                        Math.min(layerSpan - origDelay, origDur + deltaMs)
                    );
                }
                updateLayer(
                    shot.id,
                    layer.id,
                    (l) => ({
                        ...l,
                        entrance: {
                            ...l.entrance,
                            delayMs: nextDelay,
                            durationMs: nextDur,
                        },
                    }),
                    { skipHistory: true }
                );
            } else {
                // For exit: delayMs is distance from layer.outMs backward
                let nextDelay = origDelay;
                let nextDur = origDur;
                if (mode === 'move') {
                    nextDelay = Math.max(
                        0,
                        Math.min(layerSpan - origDur, origDelay - deltaMs)
                    );
                } else if (mode === 'left') {
                    nextDur = Math.max(
                        80,
                        Math.min(layerSpan - origDelay, origDur - deltaMs)
                    );
                } else if (mode === 'right') {
                    nextDelay = Math.max(
                        0,
                        Math.min(origDelay + origDur - 80, origDelay - deltaMs)
                    );
                    nextDur = origDelay + origDur - nextDelay;
                }
                updateLayer(
                    shot.id,
                    layer.id,
                    (l) => ({
                        ...l,
                        exit: {
                            ...l.exit,
                            delayMs: nextDelay,
                            durationMs: nextDur,
                        },
                    }),
                    { skipHistory: true }
                );
            }
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

    // 3. Drag / Trim Animation Block
    const startBlockDrag = (
        e: React.MouseEvent,
        shot: Shot,
        layer: Layer,
        block: AnimationBlock,
        mode: 'move' | 'left' | 'right'
    ) => {
        e.preventDefault();
        e.stopPropagation();
        selectBlock(block.id, layer.id);
        const startX = e.clientX;
        const origStart = block.startMs;
        const origDur = block.durationMs;
        beginDragTransaction();
        setDragging(true);

        const onMove = (ev: MouseEvent) => {
            const deltaMs = Math.round((ev.clientX - startX) / pxPerMs / 10) * 10;
            let nextStart = origStart;
            let nextDur = origDur;

            if (mode === 'left') {
                nextStart = Math.max(
                    0,
                    Math.min(origStart + origDur - 80, origStart + deltaMs)
                );
                nextDur = origStart + origDur - nextStart;
            } else if (mode === 'right') {
                nextDur = Math.max(
                    80,
                    Math.min(shot.durationMs - origStart, origDur + deltaMs)
                );
            } else {
                nextStart = Math.max(
                    0,
                    Math.min(shot.durationMs - origDur, origStart + deltaMs)
                );
            }

            updateLayer(
                shot.id,
                layer.id,
                (l) => ({
                    ...l,
                    blocks: l.blocks.map((b) =>
                        b.id === block.id
                            ? { ...b, startMs: nextStart, durationMs: nextDur }
                            : b
                    ),
                }),
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

    // 4. Drag / Trim Camera Block
    const startCameraBlockDrag = (
        e: React.MouseEvent,
        shot: Shot,
        camBlock: CameraBlock,
        mode: 'move' | 'left' | 'right'
    ) => {
        e.preventDefault();
        e.stopPropagation();
        selectCameraBlock(camBlock.id);
        const startX = e.clientX;
        const origStart = camBlock.startMs;
        const origDur = camBlock.durationMs;
        beginDragTransaction();
        setDragging(true);

        const onMove = (ev: MouseEvent) => {
            const deltaMs = Math.round((ev.clientX - startX) / pxPerMs / 10) * 10;
            let nextStart = origStart;
            let nextDur = origDur;

            if (mode === 'left') {
                nextStart = Math.max(
                    0,
                    Math.min(origStart + origDur - 100, origStart + deltaMs)
                );
                nextDur = origStart + origDur - nextStart;
            } else if (mode === 'right') {
                nextDur = Math.max(
                    100,
                    Math.min(shot.durationMs - origStart, origDur + deltaMs)
                );
            } else {
                nextStart = Math.max(
                    0,
                    Math.min(shot.durationMs - origDur, origStart + deltaMs)
                );
            }

            updateShot(
                shot.id,
                (s) => ({
                    ...s,
                    cameraBlocks: s.cameraBlocks.map((cb) =>
                        cb.id === camBlock.id
                            ? { ...cb, startMs: nextStart, durationMs: nextDur }
                            : cb
                    ),
                }),
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

    // 5. Drag / Trim Light Block
    const startLightBlockDrag = (
        e: React.MouseEvent,
        shot: Shot,
        lightBlock: LightAnimationBlock,
        mode: 'move' | 'left' | 'right'
    ) => {
        e.preventDefault();
        e.stopPropagation();
        selectLightBlock(lightBlock.id);
        const startX = e.clientX;
        const origStart = lightBlock.startMs;
        const origDur = lightBlock.durationMs;
        beginDragTransaction();
        setDragging(true);

        const onMove = (ev: MouseEvent) => {
            const deltaMs = Math.round((ev.clientX - startX) / pxPerMs / 10) * 10;
            let nextStart = origStart;
            let nextDur = origDur;

            if (mode === 'left') {
                nextStart = Math.max(
                    0,
                    Math.min(origStart + origDur - 100, origStart + deltaMs)
                );
                nextDur = origStart + origDur - nextStart;
            } else if (mode === 'right') {
                nextDur = Math.max(
                    100,
                    Math.min(shot.durationMs - origStart, origDur + deltaMs)
                );
            } else {
                nextStart = Math.max(
                    0,
                    Math.min(shot.durationMs - origDur, origStart + deltaMs)
                );
            }

            updateShot(
                shot.id,
                (s) => ({
                    ...s,
                    lightBlocks: (s.lightBlocks || []).map((lb) =>
                        lb.id === lightBlock.id
                            ? { ...lb, startMs: nextStart, durationMs: nextDur }
                            : lb
                    ),
                }),
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

    const startShotTrim = (event: React.MouseEvent, shot: Shot) => {
        event.preventDefault();
        event.stopPropagation();
        selectShot(shot.id);
        setInspectorTab('shot');
        const startX = event.clientX;
        const startDuration = shot.durationMs;
        const pixelsPerMsAtStart = pxPerMs;
        beginDragTransaction();
        setDragging(true);

        const onMove = (moveEvent: MouseEvent) => {
            const deltaMs = Math.round((moveEvent.clientX - startX) / Math.max(pixelsPerMsAtStart, 0.0001) / 10) * 10;
            const durationMs = Math.max(300, startDuration + deltaMs);
            updateProject((current) => ({
                ...current,
                shots: recalculateShotStartTimes(current.shots.map((item) =>
                    item.id === shot.id ? { ...item, durationMs } : item
                )),
            }), { skipHistory: true });
        };
        const onUp = () => {
            suppressShotClickRef.current = shot.id;
            commitDragTransaction();
            setDragging(false);
            window.setTimeout(() => {
                if (suppressShotClickRef.current === shot.id) suppressShotClickRef.current = null;
            }, 0);
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    };

    const startShotReorder = (event: React.MouseEvent, shot: Shot, shotIndex: number) => {
        if (event.button !== 0 || (event.target as HTMLElement).closest('[data-shot-trim]')) return;
        const drag = { shotId: shot.id, index: shotIndex, startX: event.clientX, dragging: false };
        shotDragRef.current = drag;

        const onMove = (moveEvent: MouseEvent) => {
            const currentDrag = shotDragRef.current;
            if (!currentDrag) return;
            if (!currentDrag.dragging && Math.abs(moveEvent.clientX - currentDrag.startX) >= 6) {
                currentDrag.dragging = true;
                beginDragTransaction();
                setDragging(true);
            }
            if (!currentDrag.dragging) return;

            let delta = moveEvent.clientX - currentDrag.startX;
            while (delta >= 60 && currentDrag.index < useProjectStore.getState().project.shots.length - 1) {
                const from = currentDrag.index;
                updateProject((current) => {
                    const shots = [...current.shots];
                    if (from < 0 || from >= shots.length - 1) return current;
                    [shots[from], shots[from + 1]] = [shots[from + 1], shots[from]];
                    return { ...current, shots: recalculateShotStartTimes(shots) };
                }, { skipHistory: true });
                currentDrag.index += 1;
                currentDrag.startX += 60;
                delta -= 60;
            }
            while (delta <= -60 && currentDrag.index > 0) {
                const from = currentDrag.index;
                updateProject((current) => {
                    const shots = [...current.shots];
                    if (from <= 0 || from >= shots.length) return current;
                    [shots[from], shots[from - 1]] = [shots[from - 1], shots[from]];
                    return { ...current, shots: recalculateShotStartTimes(shots) };
                }, { skipHistory: true });
                currentDrag.index -= 1;
                currentDrag.startX -= 60;
                delta += 60;
            }
        };
        const onUp = () => {
            const currentDrag = shotDragRef.current;
            if (currentDrag?.dragging) {
                suppressShotClickRef.current = shot.id;
                commitDragTransaction();
                setDragging(false);
                window.setTimeout(() => {
                    if (suppressShotClickRef.current === shot.id) suppressShotClickRef.current = null;
                }, 0);
            }
            shotDragRef.current = null;
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    };

    const playheadDisplayTimeMs =
        timelineView === 'scene' && activeShot
            ? Math.max(0, currentTimeMs - activeShot.startMs)
            : currentTimeMs;

    const hasLightBlocks = (activeShot?.lightBlocks?.length || 0) > 0;

    const addCameraBlockAtTime = (timeMs: number) => {
        if (!activeShot) return;
        const startMs = Math.max(
            0,
            Math.min(Math.max(0, activeShot.durationMs - 100), timeMs)
        );
        const durationMs = Math.max(
            100,
            Math.min(1000, activeShot.durationMs - startMs)
        );
        const camId = `cam-blk-${Date.now()}`;
        updateShot(activeShot.id, (shot) => ({
            ...shot,
            cameraBlocks: [
                ...(shot.cameraBlocks || []),
                {
                    id: camId,
                    label: 'Camera Move',
                    startMs,
                    durationMs,
                    fromFramingId: shot.framings[0]?.id || 'f1',
                    toFramingId: shot.framings[1]?.id || 'f2',
                    mode: 'dolly',
                    easing: { kind: 'preset', name: 'linear' },
                    from: {
                        anchorX: 0,
                        anchorY: 0,
                        zoom: 1,
                        roll: 0,
                        orbit: 0,
                        tilt: 0,
                    },
                    to: {
                        anchorX: -0.05,
                        anchorY: 0.02,
                        zoom: 1.15,
                        roll: 0,
                        orbit: 0,
                        tilt: 0,
                    },
                    shake: { from: 0, to: 0 },
                },
            ],
        }));
        selectCameraBlock(camId);
    };

    return (
        <section
            style={{ height: `${timelineHeightPx}px` }}
            className="border-t border-white/[0.08] bg-[#0b0b0d] flex flex-col shrink-0 select-none relative"
        >
            {/* TOP VERTICAL RESIZE SPLITTER HANDLE (Drag up for more layer room, down to compact) */}
            <div
                onMouseDown={handleStartResizeTimelineHeight}
                title="Drag up or down to resize timeline height"
                className="absolute -top-1 left-0 right-0 h-2 cursor-ns-resize z-40 group flex items-center justify-center"
            >
                <div className="w-12 h-0.5 rounded-full bg-white/15 group-hover:bg-[#0088ff] transition" />
            </div>

            {/* 1. TOP CONTROL ROW (h-8 = 32px) */}
            <div className="h-8 px-4 flex items-center justify-between shrink-0">
                <button
                    onClick={togglePlay}
                    title="Play / Pause (Space)"
                    className="w-5 h-5 rounded-full border border-white/40 hover:border-white flex items-center justify-center text-white cursor-pointer transition"
                >
                    {isPlaying ? (
                        <Pause className="w-2.5 h-2.5" />
                    ) : (
                        <Play className="w-2.5 h-2.5 ml-0.5 fill-current" />
                    )}
                </button>

                <div className="flex items-center gap-2">
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

            {/* 2. TIME RULER (h-6 = 24px, Total Header = 56px / h-14 matching LeftPanel!) */}
            <div
                onMouseDown={handleRulerMouseDown}
                className="h-6 border-b border-white/[0.06] px-4 relative overflow-hidden cursor-ew-resize shrink-0"
            >
                <div
                    style={{
                        width: `${timelineWidth}px`,
                        transform: `translateX(-${scrollLeft}px)`,
                    }}
                    className="h-full relative text-[10px] font-mono text-[#71717a] pointer-events-none"
                >
                    {rulerMarks.map((m) => (
                        <div
                            key={m.timeMs}
                            className="absolute top-1"
                            style={{ left: `${m.timeMs * pxPerMs}px` }}
                        >
                            {m.isHalf ? (
                                <span className="text-[#52525b]">&middot;</span>
                            ) : (
                                <span>{Math.round(m.timeMs / 1000)}s</span>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* 3. SCROLL-SYNCED TRACKS BODY */}
            <div
                ref={trackRef}
                onScroll={(e) => {
                    setTimelineScrollTop(e.currentTarget.scrollTop);
                    setScrollLeft(e.currentTarget.scrollLeft);
                }}
                onMouseDown={handleRulerMouseDown}
                className={`flex-1 overflow-auto relative px-4 py-1 ${dragging ? 'cursor-grabbing' : 'cursor-pointer'
                    }`}
            >
                {isBlankState && timelineView === 'video' && (
                    <button
                        type="button"
                        onMouseDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                            event.stopPropagation();
                            const created = addShot();
                            selectShot(created.id);
                            setInspectorTab('shot');
                        }}
                        className="absolute left-2 right-2 top-[14px] z-10 h-9 rounded-lg border border-[#142b37] bg-[#0e191e] text-[11px] text-[#9aaaba] hover:border-[#0088ff]/50 hover:bg-[#11212a] transition"
                    >
                        Click to add shot
                    </button>
                )}
                <div
                    style={{ width: `${timelineWidth}px`, minWidth: '100%' }}
                    className="relative min-h-full"
                >
                    {(project.audio?.clips?.length || 0) > 0 && (
                        <div className="relative h-7 mb-2 rounded-md bg-white/[0.025] border border-white/[0.06] flex items-center" style={{ width: `${Math.max(timelineWidth, totalDurationMs * pxPerMs)}px` }} aria-label="Imported media timeline">
                            <span className="absolute left-2 top-1 text-[9px] uppercase tracking-wide text-slate-500 z-10">Media</span>
                            <button
                                type="button"
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    updateProject((p) => ({
                                        ...p,
                                        audio: {
                                            clips: p.audio?.clips || [],
                                            muted: !p.audio?.muted,
                                            masterVolume: p.audio?.masterVolume ?? 1,
                                        },
                                    }));
                                }}
                                title={project.audio?.muted ? "Unmute audio" : "Mute audio"}
                                className="absolute right-2 top-1 text-[10px] text-slate-400 hover:text-white z-10 flex items-center gap-1 cursor-pointer"
                            >
                                {project.audio?.muted ? (
                                    <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                                ) : (
                                    <Volume2 className="w-3.5 h-3.5 text-slate-300" />
                                )}
                            </button>
                            {(project.audio?.clips || []).map((clip) => {
                                const clipStart = clip.startMs;
                                const clipEnd = clip.startMs + clip.durationMs;
                                if (timelineView === 'scene' && activeShot) {
                                    const shotStart = activeShot.startMs;
                                    const shotEnd = activeShot.startMs + activeShot.durationMs;
                                    if (clipEnd <= shotStart || clipStart >= shotEnd) return null;
                                    const visibleStart = Math.max(clipStart, shotStart);
                                    const visibleEnd = Math.min(clipEnd, shotEnd);
                                    const left = (visibleStart - shotStart) * pxPerMs;
                                    const width = Math.max(18, (visibleEnd - visibleStart) * pxPerMs);
                                    return (
                                        <button
                                            key={clip.id}
                                            type="button"
                                            title={`${clip.name} · click to seek`}
                                            onMouseDown={(e) => e.stopPropagation()}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setCurrentTimeMs(visibleStart);
                                            }}
                                            style={{ left: `${left}px`, width: `${width}px` }}
                                            className={`absolute top-1 bottom-1 rounded border px-2 text-left text-[9px] truncate cursor-pointer ${
                                                clip.muted || project.audio?.muted
                                                    ? 'border-slate-500/50 bg-slate-700/70 text-slate-200'
                                                    : 'border-sky-500/60 bg-sky-900/70 text-sky-100 hover:bg-sky-800/80'
                                            }`}
                                        >
                                            {clip.name}
                                        </button>
                                    );
                                }
                                const left = Math.max(0, clipStart) * pxPerMs;
                                const width = Math.max(18, clip.durationMs * pxPerMs);
                                return (
                                    <button
                                        key={clip.id}
                                        type="button"
                                        title={`${clip.name} · click to seek`}
                                        onMouseDown={(e) => e.stopPropagation()}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setCurrentTimeMs(Math.max(0, clipStart));
                                        }}
                                        style={{ left: `${left}px`, width: `${width}px` }}
                                        className={`absolute top-1 bottom-1 rounded border px-2 text-left text-[9px] truncate cursor-pointer ${
                                            clip.muted || project.audio?.muted
                                                ? 'border-slate-500/50 bg-slate-700/70 text-slate-200'
                                                : 'border-sky-500/60 bg-sky-900/70 text-sky-100 hover:bg-sky-800/80'
                                        }`}
                                    >
                                        {clip.name}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                    {/* =============================================================== */}
                    {/* STATE 1: ZOOMED-OUT WHOLE VIDEO VIEW                            */}
                    {/* =============================================================== */}
                    {!isBlankState && timelineView === 'video' && (
                        <div className="space-y-2 pt-2">
                            <div className="h-8 relative flex items-center gap-1">
                                {project.shots.map((shot, shotIndex) => {
                                    const isSelected = shot.id === activeShot?.id;
                                    const width = Math.max(95, shot.durationMs * pxPerMs - 4);
                                    return (
                                        <div
                                            key={shot.id}
                                            onMouseDown={(e) => startShotReorder(e, shot, shotIndex)}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (suppressShotClickRef.current === shot.id) {
                                                    suppressShotClickRef.current = null;
                                                    return;
                                                }
                                                selectShot(shot.id);
                                                setInspectorTab('shot');
                                                setCurrentTimeMs(Math.min(totalDurationMs, clientXToLocalMs(e.clientX)));
                                            }}
                                            onDoubleClick={(e) => {
                                                e.stopPropagation();
                                                const hasSelectedLayer = selectedLayerIds.some((id) =>
                                                    shot.layers.some((layer) => layer.id === id)
                                                );
                                                selectShot(shot.id);
                                                setTimelineView('scene');
                                                setInspectorTab(hasSelectedLayer ? 'layer' : 'shot');
                                            }}
                                            title={`${shot.name} · ${(shot.durationMs / 1000).toFixed(2)}s · Drag to reorder, drag the right edge to trim, double-click to open layer tracks`}
                                            style={{ width: `${width}px` }}
                                            className={`h-8 rounded-xl border-[1.5px] px-3 flex items-center justify-between text-[11px] font-medium transition cursor-grab active:cursor-grabbing relative group ${isSelected
                                                    ? 'border-[#8176d9] bg-gradient-to-b from-[#28204f]/95 to-[#17152d]/95 text-white shadow-[0_0_12px_rgba(129,118,217,0.22)]'
                                                    : 'border-[#0284c7]/80 bg-gradient-to-b from-[#062c52]/75 to-[#031529]/85 text-sky-200/80 hover:border-[#38bdf8]'
                                                }`}
                                        >
                                            <span className="truncate">{shot.name}</span>
                                            <span
                                                data-shot-trim="right"
                                                onMouseDown={(e) => startShotTrim(e, shot)}
                                                title="Drag to trim shot duration"
                                                className="absolute right-0 top-0 bottom-0 w-2.5 flex items-center justify-center rounded-r-xl opacity-0 group-hover:opacity-100 hover:bg-white/15 cursor-ew-resize transition"
                                            >
                                                <span className="h-4 w-0.5 rounded-full bg-white/80" />
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* =============================================================== */}
                    {/* STATE 2: ZOOMED-IN SCENE LAYER VIEW (1-to-1 Aligned with LeftPanel!) */}
                    {/* =============================================================== */}
                    {timelineView === 'scene' && activeShot && (
                        <div className="relative flex flex-col gap-0.5">
                            {/* Raylight exposes the add-layer lane before the layer rows. */}
                            <div
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const created = addLayerToShot(activeShot.id, 'shape', {
                                        inMs: 0,
                                        outMs: activeShot.durationMs,
                                    });
                                    setInspectorTab('layer');
                                    selectLayer(created.id, false);
                                }}
                                title="Add a layer to this shot"
                                className="order-0 h-7 relative flex items-center justify-center rounded-md border border-dashed border-sky-500/30 bg-sky-500/[0.025] text-[10px] text-[#8495a8] hover:border-sky-400/70 hover:bg-sky-500/[0.07] hover:text-sky-200 cursor-pointer transition"
                            >
                                <span>+ Add layer</span>
                            </div>

                            {/* Camera track: always present, with a hover preview in empty space. */}
                            <div
                                onMouseDown={(e) => e.stopPropagation()}
                                onMouseMove={(e) => {
                                    e.stopPropagation();
                                    setHoverCameraTimeMs(clientXToLocalMs(e.clientX));
                                }}
                                onMouseLeave={() => setHoverCameraTimeMs(null)}
                                onClick={(e) => {
                                    if ((e.target as HTMLElement).closest('[data-cam-pill]')) return;
                                    addCameraBlockAtTime(clientXToLocalMs(e.clientX));
                                }}
                                title="Hover to preview a camera move; click to add it"
                                aria-label="Camera track"
                                style={{ order: 30 }}
                                className="h-7 relative flex items-center cursor-pointer"
                            >
                                    {hoverCameraTimeMs !== null && !activeShot.cameraBlocks.some((block) =>
                                        hoverCameraTimeMs >= block.startMs &&
                                        hoverCameraTimeMs <= block.startMs + block.durationMs
                                    ) && (
                                        <div
                                            aria-hidden="true"
                                            className="absolute top-1 bottom-1 rounded-md border border-dashed border-emerald-400/80 bg-emerald-400/10 pointer-events-none"
                                            style={{
                                                left: `${hoverCameraTimeMs * pxPerMs}px`,
                                                width: `${Math.max(24, Math.min(1000, activeShot.durationMs - hoverCameraTimeMs) * pxPerMs)}px`,
                                            }}
                                        />
                                    )}
                                    {activeShot.cameraBlocks.map((cb) => {
                                        const isCamSelected = selectedCameraBlockId === cb.id;
                                        const left = cb.startMs * pxPerMs;
                                        const width = Math.max(36, cb.durationMs * pxPerMs);
                                        const modeLabel =
                                            cb.mode === 'dollyzoom'
                                                ? 'WARP'
                                                : cb.mode.toUpperCase();
                                        return (
                                            <div
                                                key={cb.id}
                                                data-cam-pill="true"
                                                onMouseDown={(e) =>
                                                    startCameraBlockDrag(e, activeShot, cb, 'move')
                                                }
                                                style={{ left: `${left}px`, width: `${width}px` }}
                                                className={`absolute top-1 bottom-1 rounded-full border px-2.5 flex items-center justify-between text-[10px] font-medium cursor-grab transition ${isCamSelected
                                                        ? 'border-emerald-300 bg-emerald-700/80 text-white shadow'
                                                        : 'border-emerald-500/70 bg-emerald-950/80 text-emerald-200 hover:border-emerald-400'
                                                    }`}
                                            >
                                                <span className="truncate pointer-events-none">
                                                    {modeLabel} · {cb.from?.zoom ?? 1}x &rarr;{' '}
                                                    {cb.to?.zoom ?? 1.1}x
                                                </span>
                                                <span
                                                    onMouseDown={(e) =>
                                                        startCameraBlockDrag(e, activeShot, cb, 'left')
                                                    }
                                                    className="absolute left-0 top-0 bottom-0 w-2.5 cursor-ew-resize bg-white/20 hover:bg-emerald-300 rounded-l-full"
                                                />
                                                <span
                                                    onMouseDown={(e) =>
                                                        startCameraBlockDrag(e, activeShot, cb, 'right')
                                                    }
                                                    className="absolute right-0 top-0 bottom-0 w-2.5 cursor-ew-resize bg-white/20 hover:bg-emerald-300 rounded-r-full"
                                                />
                                            </div>
                                        );
                                    })}
                            </div>

                            {/* 2. Light Track Row (h-7 = 28px, ONLY rendered when Light blocks exist) */}
                            {hasLightBlocks && (
                                <div style={{ order: 20 }} className="h-7 relative flex items-center">
                                    {(activeShot.lightBlocks || []).map((lb) => {
                                        const isLightSelected = selectedLightBlockId === lb.id;
                                        const left = lb.startMs * pxPerMs;
                                        const width = Math.max(36, lb.durationMs * pxPerMs);
                                        return (
                                            <div
                                                key={lb.id}
                                                data-light-pill="true"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    selectLightBlock(lb.id);
                                                    setInspectorTab('shot');
                                                }}
                                                onMouseDown={(e) =>
                                                    startLightBlockDrag(e, activeShot, lb, 'move')
                                                }
                                                style={{ left: `${left}px`, width: `${width}px` }}
                                                className={`group/light absolute top-1 bottom-1 rounded-full border px-2.5 flex items-center justify-between text-[10px] font-medium cursor-grab transition ${isLightSelected
                                                        ? 'border-amber-300 bg-amber-600/80 text-white shadow'
                                                        : 'border-amber-500/70 bg-amber-950/80 text-amber-200 hover:border-amber-400'
                                                    }`}
                                            >
                                                <span className="truncate pointer-events-none">
                                                    {lb.label || 'Light Sweep'}
                                                </span>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        updateShot(activeShot.id, (s) => ({
                                                            ...s,
                                                            lightBlocks: (s.lightBlocks || []).filter(
                                                                (b) => b.id !== lb.id
                                                            ),
                                                        }));
                                                        if (selectedLightBlockId === lb.id) {
                                                            selectLightBlock(null);
                                                        }
                                                    }}
                                                    title="Delete light block"
                                                    className="w-3.5 h-3.5 rounded-full hover:bg-rose-500/80 hover:text-white flex items-center justify-center text-[10px] opacity-0 group-hover/light:opacity-100 transition cursor-pointer ml-1"
                                                >
                                                    &times;
                                                </button>
                                                <span
                                                    onMouseDown={(e) =>
                                                        startLightBlockDrag(e, activeShot, lb, 'left')
                                                    }
                                                    className="absolute left-0 top-0 bottom-0 w-2.5 cursor-ew-resize bg-white/20 hover:bg-amber-300 rounded-l-full"
                                                />
                                                <span
                                                    onMouseDown={(e) =>
                                                        startLightBlockDrag(e, activeShot, lb, 'right')
                                                    }
                                                    className="absolute right-0 top-0 bottom-0 w-2.5 cursor-ew-resize bg-white/20 hover:bg-amber-300 rounded-r-full"
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* 3. Layer Track Rows (h-7 = 28px) + Indented Sub-rows (h-6 = 24px) */}
                                {activeShot.layers
                                .slice()
                                .sort((a, b) => b.order - a.order)
                                .map((layer) => {
                                    const isSelected = selectedLayerIds.includes(layer.id);
                                    const isExpanded = expandedTimelineLayerIds.includes(
                                        layer.id
                                    );

                                    const left = layer.inMs * pxPerMs;
                                    const width = Math.max(
                                        32,
                                        (layer.outMs - layer.inMs) * pxPerMs
                                    );

                                    const barStyle = isSelected
                                        ? 'border-[1.5px] border-dashed border-[#38bdf8] bg-gradient-to-r from-[#073b63]/90 via-[#0a4f82]/90 to-[#073b63]/90'
                                        : layer.kind === 'text'
                                            ? 'border-[1.5px] border-[#ec4899] bg-gradient-to-r from-[#70153c]/90 via-[#9d174d]/90 to-[#70153c]/90'
                                            : layer.kind === 'shape'
                                                ? 'border-[1.5px] border-[#6d28d9] bg-gradient-to-r from-[#261447]/90 to-[#1b0e36]/90'
                                                : 'border-[1.5px] border-[#1d4ed8]/70 bg-gradient-to-r from-[#112236]/90 to-[#0d1929]/90';

                                    const entStartMs =
                                        layer.inMs + (layer.entrance.delayMs || 0);
                                    const entDurMs = Math.max(80, layer.entrance.durationMs || 500);

                                    const extDurMs = Math.max(80, layer.exit.durationMs || 500);
                                    const extEndMs = layer.outMs - (layer.exit.delayMs || 0);
                                    const extStartMs = Math.max(layer.inMs, extEndMs - extDurMs);

                                    return (
                                        <div key={layer.id} style={{ order: 10 }} className="space-y-0.5">
                                            {/* Main Layer Bar Row (h-7 = 28px — NO duplicate text header above it!) */}
                                            <div className="h-7 relative flex items-center">
                                                <div
                                                    onMouseDown={(e) =>
                                                        startLayerBarDrag(e, activeShot, layer, 'move')
                                                    }
                                                    style={{ left: `${left}px`, width: `${width}px` }}
                                                    className={`absolute top-0.5 bottom-0.5 rounded-lg cursor-grab active:cursor-grabbing transition ${barStyle}`}
                                                >
                                                    <span className="absolute inset-0 flex items-center justify-center px-3 text-[10px] font-medium text-white/80 truncate pointer-events-none">
                                                        {layer.name}
                                                    </span>
                                                    <span
                                                        onMouseDown={(e) =>
                                                            startLayerBarDrag(e, activeShot, layer, 'in')
                                                        }
                                                        title="Drag left edge to trim layer In point"
                                                        className="absolute left-0 top-0 bottom-0 w-2.5 cursor-ew-resize hover:bg-white/30 rounded-l-lg"
                                                    />
                                                    <span
                                                        onMouseDown={(e) =>
                                                            startLayerBarDrag(e, activeShot, layer, 'out')
                                                        }
                                                        title="Drag right edge to trim layer Out point"
                                                        className="absolute right-0 top-0 bottom-0 w-2.5 cursor-ew-resize hover:bg-white/30 rounded-r-lg"
                                                    />
                                                </div>
                                            </div>

                                            {/* Expanded Sub-rows (h-6 = 24px each, aligned 1-to-1 with LeftPanel!) */}
                                            {isExpanded && (
                                                <div className="space-y-0.5">
                                                    {/* ♦ Presets Row: Movable & Resizable In / Out Pills! */}
                                                    <div
                                                        onMouseDown={(e) => e.stopPropagation()}
                                                        onClick={(e) => {
                                                            if (
                                                                (e.target as HTMLElement).closest(
                                                                    '[data-preset-pill]'
                                                                )
                                                            )
                                                                return;
                                                            const clickMs = clientXToLocalMs(e.clientX);
                                                            const midMs = (layer.inMs + layer.outMs) / 2;
                                                            if (clickMs <= midMs) {
                                                                updateLayer(activeShot.id, layer.id, (l) => ({
                                                                    ...l,
                                                                    entrance: {
                                                                        ...l.entrance,
                                                                        type:
                                                                            l.entrance.type === 'none'
                                                                                ? 'fade'
                                                                                : l.entrance.type,
                                                                        delayMs: Math.max(0, clickMs - l.inMs),
                                                                        durationMs: 600,
                                                                    },
                                                                }));
                                                                selectPreset('entrance', layer.id);
                                                            } else {
                                                                updateLayer(activeShot.id, layer.id, (l) => ({
                                                                    ...l,
                                                                    exit: {
                                                                        ...l.exit,
                                                                        type:
                                                                            l.exit.type === 'none'
                                                                                ? 'fade'
                                                                                : l.exit.type,
                                                                        delayMs: Math.max(0, l.outMs - clickMs),
                                                                        durationMs: 550,
                                                                    },
                                                                }));
                                                                selectPreset('exit', layer.id);
                                                            }
                                                        }}
                                                        title="Click anywhere on this row to place an In or Out transition"
                                                        className="h-6 relative flex items-center group"
                                                    >
                                                        {/* Movable & Resizable IN Pill */}
                                                        {layer.entrance.type !== 'none' && (
                                                            <div
                                                                data-preset-pill="in"
                                                                onMouseDown={(e) =>
                                                                    startPresetDrag(
                                                                        e,
                                                                        activeShot,
                                                                        layer,
                                                                        'entrance',
                                                                        'move'
                                                                    )
                                                                }
                                                                style={{
                                                                    left: `${entStartMs * pxPerMs}px`,
                                                                    width: `${Math.max(28, entDurMs * pxPerMs)}px`,
                                                                }}
                                                                className={`absolute h-4 rounded-full border px-2 flex items-center justify-between text-[9px] cursor-grab active:cursor-grabbing transition ${isSelected &&
                                                                        selectedPresetType === 'entrance'
                                                                        ? 'border-purple-300 bg-purple-700 text-white shadow'
                                                                        : 'border-[#8b5cf6] bg-[#341a63]/90 text-purple-200 hover:border-purple-400'
                                                                    }`}
                                                            >
                                                                <span className="truncate pointer-events-none">
                                                                    In: {layer.entrance.type}
                                                                </span>
                                                                <span
                                                                    onMouseDown={(e) =>
                                                                        startPresetDrag(
                                                                            e,
                                                                            activeShot,
                                                                            layer,
                                                                            'entrance',
                                                                            'left'
                                                                        )
                                                                    }
                                                                    title="Drag left edge to adjust In delay & length"
                                                                    className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize bg-white/25 hover:bg-amber-300 rounded-l-full"
                                                                />
                                                                <span
                                                                    onMouseDown={(e) =>
                                                                        startPresetDrag(
                                                                            e,
                                                                            activeShot,
                                                                            layer,
                                                                            'entrance',
                                                                            'right'
                                                                        )
                                                                    }
                                                                    title="Drag right edge to resize In duration"
                                                                    className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize bg-white/25 hover:bg-amber-300 rounded-r-full"
                                                                />
                                                            </div>
                                                        )}

                                                        {/* Movable & Resizable OUT Pill */}
                                                        {layer.exit.type !== 'none' && (
                                                            <div
                                                                data-preset-pill="out"
                                                                onMouseDown={(e) =>
                                                                    startPresetDrag(
                                                                        e,
                                                                        activeShot,
                                                                        layer,
                                                                        'exit',
                                                                        'move'
                                                                    )
                                                                }
                                                                style={{
                                                                    left: `${extStartMs * pxPerMs}px`,
                                                                    width: `${Math.max(28, extDurMs * pxPerMs)}px`,
                                                                }}
                                                                className={`absolute h-4 rounded-full border px-2 flex items-center justify-between text-[9px] cursor-grab active:cursor-grabbing transition ${isSelected && selectedPresetType === 'exit'
                                                                        ? 'border-pink-300 bg-pink-700 text-white shadow'
                                                                        : 'border-[#ec4899] bg-[#591636]/90 text-pink-200 hover:border-pink-400'
                                                                    }`}
                                                            >
                                                                <span className="truncate pointer-events-none">
                                                                    Out: {layer.exit.type}
                                                                </span>
                                                                <span
                                                                    onMouseDown={(e) =>
                                                                        startPresetDrag(
                                                                            e,
                                                                            activeShot,
                                                                            layer,
                                                                            'exit',
                                                                            'left'
                                                                        )
                                                                    }
                                                                    title="Drag left edge to resize Out duration"
                                                                    className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize bg-white/25 hover:bg-amber-300 rounded-l-full"
                                                                />
                                                                <span
                                                                    onMouseDown={(e) =>
                                                                        startPresetDrag(
                                                                            e,
                                                                            activeShot,
                                                                            layer,
                                                                            'exit',
                                                                            'right'
                                                                        )
                                                                    }
                                                                    title="Drag right edge to adjust Out end point"
                                                                    className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize bg-white/25 hover:bg-amber-300 rounded-r-full"
                                                                />
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* ♦ Property Block Sub-rows (h-6 = 24px each) */}
                                                    {layer.blocks.map((blk) => (
                                                        <div
                                                            key={blk.id}
                                                            className="h-6 relative flex items-center"
                                                        >
                                                            <div
                                                                onMouseDown={(e) =>
                                                                    startBlockDrag(
                                                                        e,
                                                                        activeShot,
                                                                        layer,
                                                                        blk,
                                                                        'move'
                                                                    )
                                                                }
                                                                style={{
                                                                    left: `${blk.startMs * pxPerMs}px`,
                                                                    width: `${Math.max(
                                                                        36,
                                                                        blk.durationMs * pxPerMs
                                                                    )}px`,
                                                                }}
                                                                className={`absolute h-4 rounded-full border px-2 flex items-center justify-between text-[9px] cursor-grab transition relative ${selectedBlockId === blk.id
                                                                        ? 'border-[#c084fc] bg-[#581c87] text-white'
                                                                        : 'border-[#7c3aed] bg-[#2a1452]/90 text-purple-200 hover:border-[#a855f7]'
                                                                    }`}
                                                            >
                                                                <svg
                                                                    aria-hidden="true"
                                                                    viewBox="0 0 100 16"
                                                                    preserveAspectRatio="none"
                                                                    className="absolute inset-0 h-full w-full rounded-full opacity-50 pointer-events-none"
                                                                >
                                                                    <polyline
                                                                        fill="none"
                                                                        stroke="currentColor"
                                                                        strokeWidth="1.25"
                                                                        strokeLinecap="round"
                                                                        strokeLinejoin="round"
                                                                        points={Array.from({ length: 25 }, (_, index) => {
                                                                            const progress = index / 24;
                                                                            const eased = Math.max(0, Math.min(1, evaluateEasing(progress, blk.easing)));
                                                                            return `${(progress * 100).toFixed(2)},${(14 - eased * 12).toFixed(2)}`;
                                                                        }).join(' ')}
                                                                    />
                                                                </svg>
                                                                <span className="truncate pointer-events-none">
                                                                    {blk.label}
                                                                </span>
                                                                <span
                                                                    onMouseDown={(e) =>
                                                                        startBlockDrag(
                                                                            e,
                                                                            activeShot,
                                                                            layer,
                                                                            blk,
                                                                            'left'
                                                                        )
                                                                    }
                                                                    className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize bg-white/25 hover:bg-amber-300 rounded-l-full"
                                                                />
                                                                <span
                                                                    onMouseDown={(e) =>
                                                                        startBlockDrag(
                                                                            e,
                                                                            activeShot,
                                                                            layer,
                                                                            blk,
                                                                            'right'
                                                                        )
                                                                    }
                                                                    className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize bg-white/25 hover:bg-amber-300 rounded-r-full"
                                                                />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                            {/* Dimmed Right-Hand Step-Out Curtain */}
                            <div
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setTimelineView('video');
                                }}
                                title="Click dimmed area to step back out to Whole Video view"
                                style={{ left: `${activeShot.durationMs * pxPerMs + 8}px` }}
                                className="absolute top-0 bottom-0 right-0 rounded-l-2xl bg-[#16202a]/80 hover:bg-[#1e2c3a]/85 border-l border-white/10 cursor-pointer transition z-10"
                            />
                        </div>
                    )}

                    {/* Active blue playhead moves only when scrubbed or playing. */}
                    <div
                        className="absolute top-0 bottom-0 w-[1.5px] bg-[#0088ff] z-30 pointer-events-none"
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
