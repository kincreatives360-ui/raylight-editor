// src/panels/Timeline/Timeline.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Scissors } from 'lucide-react';
import type { Shot, Layer, AnimationBlock, CameraBlock, LightAnimationBlock, AudioClip } from '../../model/types';
import { isBlankProjectState } from '../../model/types';
import { recalculateShotStartTimes, useProjectStore } from '../../store/useProjectStore';
import { usePlayheadStore } from '../../store/usePlayheadStore';
import { useSelectionStore } from '../../store/useSelectionStore';
import { evaluateEasing } from '../../engine/easing';
import { createDefaultCameraBlock } from '../../model/defaults';
import { TimelineTimecode } from './TimelineTimecode';
import { PlayheadOverlay } from './PlayheadOverlay';

const MIN_TIMELINE_ZOOM = 0.8;
const MAX_TIMELINE_ZOOM = 2.4;

interface TimelineProps {
    totalDurationMs: number;
    hoverTimeMs?: number | null;
    onHoverTimeChange?: (timeMs: number | null) => void;
}

export const Timeline: React.FC<TimelineProps> = React.memo(({
    totalDurationMs,
    hoverTimeMs: propHoverTimeMs,
    onHoverTimeChange: propOnHoverTimeChange,
}) => {
    const {
        project,
        updateProject,
        updateShot,
        updateLayer,
        addShot,
        addLayerToShot,
        splitAtPlayhead,
        beginDragTransaction,
        commitDragTransaction,
    } = useProjectStore();

    const {
        hoverTimeMs: storeHoverTimeMs,
        setHoverTimeMs,
        isPlaying,
        setIsPlaying,
        setCurrentTimeMs,
        togglePlay,
    } = usePlayheadStore();

    const hoverTimeMs = propHoverTimeMs !== undefined ? propHoverTimeMs : storeHoverTimeMs;
    const onHoverTimeChange = propOnHoverTimeChange ?? setHoverTimeMs;

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
    const timelineZoomRef = useRef(timelineZoom);
    useEffect(() => {
        timelineZoomRef.current = timelineZoom;
    }, [timelineZoom]);

    useEffect(() => {
        const container = trackRef.current;
        if (!container) return;

        const handleWheel = (event: WheelEvent) => {
            if (event.ctrlKey || event.metaKey) {
                event.preventDefault();
                const rect = container.getBoundingClientRect();
                const mouseX = event.clientX - rect.left;
                const timelineX = mouseX + container.scrollLeft;

                const zoomDelta = event.deltaY < 0 ? 0.12 : -0.12;
                const currentZoom = timelineZoomRef.current;
                const nextZoom = Math.max(
                    MIN_TIMELINE_ZOOM,
                    Math.min(MAX_TIMELINE_ZOOM, Number((currentZoom + zoomDelta).toFixed(2)))
                );
                if (nextZoom === currentZoom) return;

                const scaleRatio = nextZoom / currentZoom;
                setTimelineZoom(nextZoom);

                requestAnimationFrame(() => {
                    if (trackRef.current) {
                        trackRef.current.scrollLeft = Math.max(0, timelineX * scaleRatio - mouseX);
                    }
                });
            }
        };

        container.addEventListener('wheel', handleWheel, { passive: false });
        return () => {
            container.removeEventListener('wheel', handleWheel);
        };
    }, [setTimelineZoom]);
    const shotDragRef = useRef<{
        shotId: string;
        index: number;
        startX: number;
        dragging: boolean;
    } | null>(null);
    const suppressShotClickRef = useRef<string | null>(null);
    const [timelineViewportWidth, setTimelineViewportWidth] = useState(800);
    const [dragging, setDragging] = useState(false);
    const [hoverCameraTimeMs, setHoverCameraTimeMs] = useState<number | null>(null);
    const isDraggingPlayheadRef = useRef(false);
    const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
    const rafIdRef = useRef<number | null>(null);
    const latestHoverClientXRef = useRef<number | null>(null);

    useEffect(() => {
        return () => {
            if (rafIdRef.current !== null) {
                cancelAnimationFrame(rafIdRef.current);
            }
        };
    }, []);

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
    // Fixed base scale so resizing an element's duration physically expands/contracts its bar,
    // while keeping the timeline ruler rock solid!
    const BASE_PX_PER_SECOND = 140;
    const pxPerSecond = BASE_PX_PER_SECOND * timelineZoom;
    const pxPerMs = pxPerSecond / 1000;
    const timelineWidth = Math.max(
        1,
        timelineViewportWidth - 32,
        visibleDurationMs * pxPerMs + 160
    );

    const rulerStepMs = useMemo(() => {
        if (pxPerSecond >= 220) return 500;
        if (pxPerSecond >= 90) return 1000;
        if (pxPerSecond >= 45) return 2000;
        return 5000;
    }, [pxPerSecond]);

    const rulerMarks = useMemo(() => {
        const marks: { timeMs: number; isHalf?: boolean }[] = [];
        const maxTimeMs = Math.max(visibleDurationMs, totalDurationMs);
        const minorStep = rulerStepMs / 2;
        for (let t = 0; t <= maxTimeMs + rulerStepMs * 2; t += minorStep) {
            marks.push({ timeMs: t, isHalf: t % rulerStepMs !== 0 });
        }
        return marks;
    }, [visibleDurationMs, totalDurationMs, rulerStepMs]);

    // Top Splitter Drag: Expand Timeline Up or Contract Down
    const handleStartResizeTimelineHeight = (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        e.preventDefault();
        const startY = e.clientY;
        const startHeight = timelineHeightPx;
        const pointerId = e.pointerId;

        const onMove = (ev: PointerEvent) => {
            if (ev.pointerId === pointerId) {
                const deltaY = startY - ev.clientY;
                setTimelineHeightPx(startHeight + deltaY);
            }
        };
        const onEnd = (ev: PointerEvent) => {
            if (ev.pointerId === pointerId) {
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onEnd);
                window.removeEventListener('pointercancel', onEnd);
            }
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onEnd);
        window.addEventListener('pointercancel', onEnd);
    };

    const clientXToLocalMs = (clientX: number): number => {
        const el = trackRef.current;
        if (!el) return 0;
        const rect = el.getBoundingClientRect();
        const contentX = clientX - rect.left - 16 + el.scrollLeft;
        const localMs = contentX / pxPerMs;
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

    const timeAtClientX = (clientX: number) => {
        const localMs = clientXToLocalMs(clientX);
        return timelineView === 'scene' && activeShot
            ? activeShot.startMs + Math.min(activeShot.durationMs, localMs)
            : Math.min(totalDurationMs, localMs);
    };

    const handleTimelinePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        if (isBlankState || totalDurationMs <= 0 || isDraggingPlayheadRef.current || dragging) {
            if (hoverTimeMs !== null) onHoverTimeChange(null);
            return;
        }

        // Pause playback while skimming so the preview has full visual focus
        if (isPlaying) {
            setIsPlaying(false);
        }

        latestHoverClientXRef.current = event.clientX;
        if (rafIdRef.current === null) {
            rafIdRef.current = requestAnimationFrame(() => {
                rafIdRef.current = null;
                if (latestHoverClientXRef.current !== null && !isDraggingPlayheadRef.current) {
                    const time = timeAtClientX(latestHoverClientXRef.current);
                    onHoverTimeChange(time);
                }
            });
        }
    };

    const handleTimelinePointerLeave = () => {
        if (rafIdRef.current !== null) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
        }
        latestHoverClientXRef.current = null;
        onHoverTimeChange(null);
    };

    const handleTimelineClick = (event: React.MouseEvent<HTMLDivElement>) => {
        // Empty timeline space seeks on click; existing controls and clips keep their own click behavior.
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        if (
            target.closest('button, input, [role="button"], [data-timeline-item], [data-cam-pill], [data-light-pill], [data-preset-pill]')
        ) return;
        const targetTime = hoverTimeMs !== null ? hoverTimeMs : timeAtClientX(event.clientX);
        setCurrentTimeMs(targetTime);
    };

    const handleRulerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        e.preventDefault();
        e.stopPropagation();
        isDraggingPlayheadRef.current = true;
        setIsDraggingPlayhead(true);
        onHoverTimeChange(null);
        scrubFromClientX(e.clientX);

        const pointerId = e.pointerId;
        try {
            e.currentTarget.setPointerCapture(pointerId);
        } catch {
            // Ignore capture failure
        }

        const onMove = (ev: PointerEvent) => {
            if (ev.pointerId === pointerId) {
                scrubFromClientX(ev.clientX);
            }
        };
        const onEnd = (ev: PointerEvent) => {
            if (ev.pointerId === pointerId) {
                isDraggingPlayheadRef.current = false;
                setIsDraggingPlayhead(false);
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onEnd);
                window.removeEventListener('pointercancel', onEnd);
            }
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onEnd);
        window.addEventListener('pointercancel', onEnd);
    };

    // 1. Drag / Trim Main Layer Bar (Hardened with Pointer Events & >3px deadzone)
    const startLayerBarDrag = (
        e: React.PointerEvent,
        shot: Shot,
        layer: Layer,
        mode: 'move' | 'in' | 'out'
    ) => {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        e.preventDefault();
        e.stopPropagation();
        setInspectorTab('layer');
        selectLayer(layer.id, false);
        const startX = e.clientX;
        const origIn = layer.inMs;
        const origOut = layer.outMs;
        const pointerId = e.pointerId;
        let hasMoved = false;

        try {
            e.currentTarget.setPointerCapture(pointerId);
        } catch {
            // Ignore capture failure
        }

        const onMove = (ev: PointerEvent) => {
            if (ev.pointerId !== pointerId) return;
            if (!hasMoved) {
                if (Math.abs(ev.clientX - startX) < 4) return;
                hasMoved = true;
                beginDragTransaction();
                setDragging(true);
            }

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

        const onEnd = (ev: PointerEvent) => {
            if (ev.pointerId !== pointerId) return;
            if (hasMoved) {
                commitDragTransaction();
                setDragging(false);
            }
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onEnd);
            window.removeEventListener('pointercancel', onEnd);
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onEnd);
        window.addEventListener('pointercancel', onEnd);
    };

    // 2. Drag / Trim In (Entrance) & Out (Exit) Transition Pills! (Hardened)
    const startPresetDrag = (
        e: React.PointerEvent,
        shot: Shot,
        layer: Layer,
        which: 'entrance' | 'exit',
        mode: 'move' | 'left' | 'right'
    ) => {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        e.preventDefault();
        e.stopPropagation();
        selectPreset(which, layer.id);

        const startX = e.clientX;
        const preset = layer[which];
        const origDelay = preset.delayMs || 0;
        const origDur = Math.max(100, preset.durationMs || 500);
        const layerSpan = Math.max(200, layer.outMs - layer.inMs);
        const pointerId = e.pointerId;
        let hasMoved = false;

        try {
            e.currentTarget.setPointerCapture(pointerId);
        } catch {
            // Ignore capture error
        }

        const onMove = (ev: PointerEvent) => {
            if (ev.pointerId !== pointerId) return;
            if (!hasMoved) {
                if (Math.abs(ev.clientX - startX) < 4) return;
                hasMoved = true;
                beginDragTransaction();
                setDragging(true);
            }

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

        const onEnd = (ev: PointerEvent) => {
            if (ev.pointerId !== pointerId) return;
            if (hasMoved) {
                commitDragTransaction();
                setDragging(false);
            }
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onEnd);
            window.removeEventListener('pointercancel', onEnd);
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onEnd);
        window.addEventListener('pointercancel', onEnd);
    };

    // 3. Drag / Trim Animation Block (Hardened)
    const startBlockDrag = (
        e: React.PointerEvent,
        shot: Shot,
        layer: Layer,
        block: AnimationBlock,
        mode: 'move' | 'left' | 'right'
    ) => {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        e.preventDefault();
        e.stopPropagation();
        selectBlock(block.id, layer.id);
        const startX = e.clientX;
        const origStart = block.startMs;
        const origDur = block.durationMs;
        const pointerId = e.pointerId;
        let hasMoved = false;

        try {
            e.currentTarget.setPointerCapture(pointerId);
        } catch {
            // Ignore capture error
        }

        const onMove = (ev: PointerEvent) => {
            if (ev.pointerId !== pointerId) return;
            if (!hasMoved) {
                if (Math.abs(ev.clientX - startX) < 4) return;
                hasMoved = true;
                beginDragTransaction();
                setDragging(true);
            }

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

        const onEnd = (ev: PointerEvent) => {
            if (ev.pointerId !== pointerId) return;
            if (hasMoved) {
                commitDragTransaction();
                setDragging(false);
            }
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onEnd);
            window.removeEventListener('pointercancel', onEnd);
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onEnd);
        window.addEventListener('pointercancel', onEnd);
    };

    // 4. Drag / Trim Camera Block (Hardened)
    const startCameraBlockDrag = (
        e: React.PointerEvent,
        shot: Shot,
        camBlock: CameraBlock,
        mode: 'move' | 'left' | 'right'
    ) => {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        e.preventDefault();
        e.stopPropagation();
        selectCameraBlock(camBlock.id);
        const startX = e.clientX;
        const origStart = camBlock.startMs;
        const origDur = camBlock.durationMs;
        const pointerId = e.pointerId;
        let hasMoved = false;

        try {
            e.currentTarget.setPointerCapture(pointerId);
        } catch {
            // Ignore capture error
        }

        const onMove = (ev: PointerEvent) => {
            if (ev.pointerId !== pointerId) return;
            if (!hasMoved) {
                if (Math.abs(ev.clientX - startX) < 4) return;
                hasMoved = true;
                beginDragTransaction();
                setDragging(true);
            }

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

        const onEnd = (ev: PointerEvent) => {
            if (ev.pointerId !== pointerId) return;
            if (hasMoved) {
                commitDragTransaction();
                setDragging(false);
            }
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onEnd);
            window.removeEventListener('pointercancel', onEnd);
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onEnd);
        window.addEventListener('pointercancel', onEnd);
    };

    // 5. Drag / Trim Light Block (Hardened)
    const startLightBlockDrag = (
        e: React.PointerEvent,
        shot: Shot,
        lightBlock: LightAnimationBlock,
        mode: 'move' | 'left' | 'right'
    ) => {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        e.preventDefault();
        e.stopPropagation();
        selectLightBlock(lightBlock.id);
        const startX = e.clientX;
        const origStart = lightBlock.startMs;
        const origDur = lightBlock.durationMs;
        const pointerId = e.pointerId;
        let hasMoved = false;

        try {
            e.currentTarget.setPointerCapture(pointerId);
        } catch {
            // Ignore capture error
        }

        const onMove = (ev: PointerEvent) => {
            if (ev.pointerId !== pointerId) return;
            if (!hasMoved) {
                if (Math.abs(ev.clientX - startX) < 4) return;
                hasMoved = true;
                beginDragTransaction();
                setDragging(true);
            }

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

        const onEnd = (ev: PointerEvent) => {
            if (ev.pointerId !== pointerId) return;
            if (hasMoved) {
                commitDragTransaction();
                setDragging(false);
            }
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onEnd);
            window.removeEventListener('pointercancel', onEnd);
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onEnd);
        window.addEventListener('pointercancel', onEnd);
    };

    // 6. Shot Edge Trim (Hardened)
    const startShotTrim = (event: React.PointerEvent, shot: Shot) => {
        if (event.button !== 0 && event.pointerType === 'mouse') return;
        event.preventDefault();
        event.stopPropagation();
        selectShot(shot.id);
        setInspectorTab('shot');
        const startX = event.clientX;
        const startDuration = shot.durationMs;
        const pixelsPerMsAtStart = pxPerMs;
        const pointerId = event.pointerId;
        let hasMoved = false;

        try {
            event.currentTarget.setPointerCapture(pointerId);
        } catch {
            // Ignore capture error
        }

        const onMove = (moveEvent: PointerEvent) => {
            if (moveEvent.pointerId !== pointerId) return;
            if (!hasMoved) {
                if (Math.abs(moveEvent.clientX - startX) < 4) return;
                hasMoved = true;
                beginDragTransaction();
                setDragging(true);
            }
            const deltaMs = Math.round((moveEvent.clientX - startX) / Math.max(pixelsPerMsAtStart, 0.0001) / 10) * 10;
            const durationMs = Math.max(300, startDuration + deltaMs);
            updateProject((current) => ({
                ...current,
                shots: recalculateShotStartTimes(current.shots.map((item) =>
                    item.id === shot.id ? { ...item, durationMs } : item
                )),
            }), { skipHistory: true });
        };

        const onEnd = (endEvent: PointerEvent) => {
            if (endEvent.pointerId !== pointerId) return;
            if (hasMoved) {
                suppressShotClickRef.current = shot.id;
                commitDragTransaction();
                setDragging(false);
                window.setTimeout(() => {
                    if (suppressShotClickRef.current === shot.id) suppressShotClickRef.current = null;
                }, 0);
            }
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onEnd);
            window.removeEventListener('pointercancel', onEnd);
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onEnd);
        window.addEventListener('pointercancel', onEnd);
    };

    // 7. Shot Reorder (Hardened)
    const startShotReorder = (event: React.PointerEvent, shot: Shot, shotIndex: number) => {
        if (event.button !== 0 || (event.target as HTMLElement).closest('[data-shot-trim]')) return;
        const drag = { shotId: shot.id, index: shotIndex, startX: event.clientX, dragging: false };
        shotDragRef.current = drag;
        const pointerId = event.pointerId;

        try {
            event.currentTarget.setPointerCapture(pointerId);
        } catch {
            // Ignore capture error
        }

        const onMove = (moveEvent: PointerEvent) => {
            if (moveEvent.pointerId !== pointerId) return;
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

        const onEnd = (endEvent: PointerEvent) => {
            if (endEvent.pointerId !== pointerId) return;
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
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onEnd);
            window.removeEventListener('pointercancel', onEnd);
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onEnd);
        window.addEventListener('pointercancel', onEnd);
    };

    // 8. Audio / Media Clip Drag & Trim (Hardened)
    const startAudioClipDrag = (
        e: React.PointerEvent,
        clip: AudioClip,
        mode: 'move' | 'left' | 'right'
    ) => {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        e.preventDefault();
        e.stopPropagation();
        const startX = e.clientX;
        const origStart = clip.startMs;
        const origDur = clip.durationMs;
        const origOffset = clip.offsetMs || 0;
        const pointerId = e.pointerId;
        let hasMoved = false;

        try {
            e.currentTarget.setPointerCapture(pointerId);
        } catch {
            // Ignore capture failure
        }

        const onMove = (ev: PointerEvent) => {
            if (ev.pointerId !== pointerId) return;
            if (!hasMoved) {
                if (Math.abs(ev.clientX - startX) < 4) return;
                hasMoved = true;
                beginDragTransaction();
                setDragging(true);
            }

            const deltaMs = Math.round((ev.clientX - startX) / pxPerMs / 10) * 10;
            let nextStart = origStart;
            let nextDur = origDur;
            let nextOffset = origOffset;

            if (mode === 'move') {
                nextStart = Math.max(0, origStart + deltaMs);
            } else if (mode === 'left') {
                const minStart = Math.max(0, origStart - origOffset);
                const maxStart = origStart + origDur - 100;
                nextStart = Math.max(minStart, Math.min(maxStart, origStart + deltaMs));
                const diff = nextStart - origStart;
                nextDur = origDur - diff;
                nextOffset = origOffset + diff;
            } else if (mode === 'right') {
                nextDur = Math.max(100, origDur + deltaMs);
            }

            updateProject(
                (p) => ({
                    ...p,
                    audio: {
                        clips: (p.audio?.clips || []).map((c) =>
                            c.id === clip.id
                                ? { ...c, startMs: nextStart, durationMs: nextDur, offsetMs: nextOffset }
                                : c
                        ),
                        muted: p.audio?.muted || false,
                        masterVolume: p.audio?.masterVolume ?? 1,
                    },
                }),
                { skipHistory: true }
            );
        };

        const onEnd = (ev: PointerEvent) => {
            if (ev.pointerId !== pointerId) return;
            if (hasMoved) {
                commitDragTransaction();
                setDragging(false);
            }
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onEnd);
            window.removeEventListener('pointercancel', onEnd);
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onEnd);
        window.addEventListener('pointercancel', onEnd);
    };

    // 9. Delete Audio Clip helper
    const deleteAudioClip = (clipId: string) => {
        updateProject((p) => ({
            ...p,
            audio: {
                clips: (p.audio?.clips || []).filter((c) => c.id !== clipId),
                muted: p.audio?.muted || false,
                masterVolume: p.audio?.masterVolume ?? 1,
            },
        }));
    };

    // 10. Cursor-Anchored Horizontal Zoom handled via native wheel listener on trackRef

    const hoverDisplayTimeMs = hoverTimeMs === null
        ? null
        : timelineView === 'scene' && activeShot
            ? Math.max(0, hoverTimeMs - activeShot.startMs)
            : hoverTimeMs;

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
                createDefaultCameraBlock(
                    camId,
                    startMs,
                    durationMs,
                    shot.framings[0]?.id || 'f1',
                    shot.framings[1]?.id || 'f2'
                ),
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
                onPointerDown={handleStartResizeTimelineHeight}
                title="Drag up or down to resize timeline height"
                style={{ touchAction: 'none' }}
                className="absolute -top-1 left-0 right-0 h-2 cursor-ns-resize z-40 group flex items-center justify-center"
            >
                <div className="w-12 h-0.5 rounded-full bg-white/15 group-hover:bg-[#0088ff] transition" />
            </div>

            {/* 1. TOP CONTROL ROW (h-8 = 32px) */}
            <div className="h-8 px-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={togglePlay}
                        aria-label={isPlaying ? 'Pause playback' : 'Start playback'}
                        title="Play / Pause (Space)"
                        className="w-5 h-5 rounded-full border border-white/40 hover:border-white flex items-center justify-center text-white cursor-pointer transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0088ff]"
                    >
                        {isPlaying ? (
                            <Pause className="w-2.5 h-2.5" />
                        ) : (
                            <Play className="w-2.5 h-2.5 ml-0.5 fill-current" />
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={() => splitAtPlayhead(usePlayheadStore.getState().currentTimeMs)}
                        aria-label="Split clip at playhead"
                        title="Split Clip at Playhead (S)"
                        className="w-5 h-5 rounded-full border border-white/20 hover:border-white/60 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0088ff]"
                    >
                        <Scissors className="w-2.5 h-2.5" />
                    </button>
                    <TimelineTimecode totalDurationMs={totalDurationMs} />
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative w-24 h-1.5 rounded-full bg-[#27272a] flex items-center">
                        <div
                            className="h-full rounded-full bg-[#0088ff]"
                            style={{
                                width: `${((timelineZoom - MIN_TIMELINE_ZOOM) / (MAX_TIMELINE_ZOOM - MIN_TIMELINE_ZOOM)) * 100}%`,
                            }}
                        />
                        <input
                            aria-label="Timeline Zoom"
                            type="range"
                            min={MIN_TIMELINE_ZOOM}
                            max={MAX_TIMELINE_ZOOM}
                            step={0.05}
                            value={timelineZoom}
                            onChange={(e) => setTimelineZoom(Number(e.target.value))}
                            className="absolute inset-0 w-full opacity-0 cursor-pointer"
                        />
                        <div
                            className="w-3.5 h-3.5 rounded-full bg-white shadow pointer-events-none absolute -ml-1.5"
                            style={{
                                left: `${((timelineZoom - MIN_TIMELINE_ZOOM) / (MAX_TIMELINE_ZOOM - MIN_TIMELINE_ZOOM)) * 100}%`,
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* 2. SCROLL-SYNCED TRACKS BODY (Includes Ruler + Tracks + Playhead + Skimmer) */}
            <div
                ref={trackRef}
                onScroll={(e) => {
                    setTimelineScrollTop(e.currentTarget.scrollTop);
                }}
                onPointerMove={handleTimelinePointerMove}
                onPointerLeave={handleTimelinePointerLeave}
                onClick={handleTimelineClick}
                className={`flex-1 overflow-auto relative px-4 ${
                    isDraggingPlayhead ? 'cursor-ew-resize' : dragging ? 'cursor-grabbing' : 'cursor-pointer'
                }`}
            >
                {isBlankState && timelineView === 'video' && (
                    <button
                        type="button"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                            event.stopPropagation();
                            const created = addShot();
                            selectShot(created.id);
                            setInspectorTab('shot');
                        }}
                        className="absolute left-2 right-2 top-[38px] z-10 h-9 rounded-lg border border-[#142b37] bg-[#0e191e] text-[11px] text-[#9aaaba] hover:border-[#0088ff]/50 hover:bg-[#11212a] transition"
                    >
                        Click to add shot
                    </button>
                )}
                <div
                    style={{ width: `${timelineWidth}px`, minWidth: '100%' }}
                    className="relative min-h-full flex flex-col"
                >
                    {/* TIME RULER (h-6 = 24px) */}
                    <div
                        onPointerDown={handleRulerPointerDown}
                        style={{ touchAction: 'none' }}
                        className="sticky top-0 z-10 h-6 border-b border-white/[0.08] bg-[#0b0b0d] relative cursor-ew-resize select-none shrink-0"
                    >
                        {rulerMarks.map((m) => (
                            <div
                                key={m.timeMs}
                                className="absolute top-1 pointer-events-none -translate-x-1/2 flex items-center justify-center"
                                style={{ left: `${m.timeMs * pxPerMs}px` }}
                            >
                                {m.isHalf ? (
                                    <span className="text-[#52525b] text-base leading-none">&middot;</span>
                                ) : (
                                    <span className="text-[10px] font-mono text-[#a1a1aa] font-medium">
                                        {Math.round(m.timeMs / 1000)}s
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* TRACKS CONTENT */}
                    <div className="py-2 flex-1 relative flex flex-col">
                    {(project.audio?.clips?.length || 0) > 0 && (
                        <div className="relative h-7 mb-2 rounded-md bg-white/[0.025] border border-white/[0.06] flex items-center" style={{ width: `${Math.max(timelineWidth, totalDurationMs * pxPerMs)}px` }} aria-label="Imported media timeline">
                            <span className="absolute left-2 top-1 text-[10px] uppercase tracking-wider font-semibold text-slate-400 z-10">Media</span>
                            <button
                                type="button"
                                onPointerDown={(e) => e.stopPropagation()}
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
                                        <div
                                            key={clip.id}
                                            title={`${clip.name} · ${(clip.durationMs / 1000).toFixed(2)}s · Drag to move, drag edges to trim`}
                                            onPointerDown={(e) => startAudioClipDrag(e, clip, 'move')}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setCurrentTimeMs(visibleStart);
                                            }}
                                            style={{ left: `${left}px`, width: `${width}px` }}
                                            className={`group/audioclip absolute top-1 bottom-1 rounded border px-2 flex items-center justify-between text-[10px] font-medium tracking-tight truncate cursor-grab active:cursor-grabbing transition select-none ${
                                                clip.muted || project.audio?.muted
                                                    ? 'border-slate-500/50 bg-slate-700/70 text-slate-200'
                                                    : 'border-sky-500/60 bg-sky-900/70 text-sky-100 hover:bg-sky-800/80'
                                            }`}
                                        >
                                            <span
                                                onPointerDown={(e) => startAudioClipDrag(e, clip, 'left')}
                                                title="Trim audio start"
                                                className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize bg-white/20 hover:bg-sky-300 rounded-l"
                                            />
                                            <span className="truncate pointer-events-none pl-1">{clip.name}</span>
                                            <button
                                                type="button"
                                                onPointerDown={(e) => e.stopPropagation()}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteAudioClip(clip.id);
                                                }}
                                                title="Delete audio clip"
                                                className="w-3.5 h-3.5 rounded-full hover:bg-rose-500/80 hover:text-white flex items-center justify-center text-[10px] opacity-0 group-hover/audioclip:opacity-100 transition cursor-pointer ml-1 z-10 shrink-0"
                                            >
                                                &times;
                                            </button>
                                            <span
                                                onPointerDown={(e) => startAudioClipDrag(e, clip, 'right')}
                                                title="Trim audio end"
                                                className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize bg-white/20 hover:bg-sky-300 rounded-r"
                                            />
                                        </div>
                                    );
                                }
                                const left = Math.max(0, clipStart) * pxPerMs;
                                const width = Math.max(18, clip.durationMs * pxPerMs);
                                return (
                                    <div
                                        key={clip.id}
                                        title={`${clip.name} · ${(clip.durationMs / 1000).toFixed(2)}s · Drag to move, drag edges to trim`}
                                        onPointerDown={(e) => startAudioClipDrag(e, clip, 'move')}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setCurrentTimeMs(Math.max(0, clipStart));
                                        }}
                                        style={{ left: `${left}px`, width: `${width}px` }}
                                        className={`group/audioclip absolute top-1 bottom-1 rounded border px-2 flex items-center justify-between text-[10px] font-medium tracking-tight truncate cursor-grab active:cursor-grabbing transition select-none ${
                                            clip.muted || project.audio?.muted
                                                ? 'border-slate-500/50 bg-slate-700/70 text-slate-200'
                                                : 'border-sky-500/60 bg-sky-900/70 text-sky-100 hover:bg-sky-800/80'
                                        }`}
                                    >
                                        <span
                                            onPointerDown={(e) => startAudioClipDrag(e, clip, 'left')}
                                            title="Trim audio start"
                                            className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize bg-white/20 hover:bg-sky-300 rounded-l"
                                        />
                                        <span className="truncate pointer-events-none pl-1">{clip.name}</span>
                                        <button
                                            type="button"
                                            onPointerDown={(e) => e.stopPropagation()}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                deleteAudioClip(clip.id);
                                            }}
                                            title="Delete audio clip"
                                            className="w-3.5 h-3.5 rounded-full hover:bg-rose-500/80 hover:text-white flex items-center justify-center text-[10px] opacity-0 group-hover/audioclip:opacity-100 transition cursor-pointer ml-1 z-10 shrink-0"
                                        >
                                            &times;
                                        </button>
                                        <span
                                            onPointerDown={(e) => startAudioClipDrag(e, clip, 'right')}
                                            title="Trim audio end"
                                            className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize bg-white/20 hover:bg-sky-300 rounded-r"
                                        />
                                    </div>
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
                                    const width = Math.max(16, shot.durationMs * pxPerMs - 2);
                                    return (
                                        <div
                                            key={shot.id}
                                            onPointerDown={(e) => startShotReorder(e, shot, shotIndex)}
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
                                                onPointerDown={(e) => startShotTrim(e, shot)}
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
                                onPointerDown={(e) => e.stopPropagation()}
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
                                onPointerDown={(e) => e.stopPropagation()}
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
                                                onPointerDown={(e) =>
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
                                                    onPointerDown={(e) =>
                                                        startCameraBlockDrag(e, activeShot, cb, 'left')
                                                    }
                                                    className="absolute left-0 top-0 bottom-0 w-2.5 cursor-ew-resize bg-white/20 hover:bg-emerald-300 rounded-l-full"
                                                />
                                                <span
                                                    onPointerDown={(e) =>
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
                                                onPointerDown={(e) =>
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
                                                    onPointerDown={(e) =>
                                                        startLightBlockDrag(e, activeShot, lb, 'left')
                                                    }
                                                    className="absolute left-0 top-0 bottom-0 w-2.5 cursor-ew-resize bg-white/20 hover:bg-amber-300 rounded-l-full"
                                                />
                                                <span
                                                    onPointerDown={(e) =>
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
                                                    onPointerDown={(e) =>
                                                        startLayerBarDrag(e, activeShot, layer, 'move')
                                                    }
                                                    style={{ left: `${left}px`, width: `${width}px` }}
                                                    className={`absolute top-0.5 bottom-0.5 rounded-lg cursor-grab active:cursor-grabbing transition ${barStyle}`}
                                                >
                                                    <span className="absolute inset-0 flex items-center justify-center px-3 text-[10px] font-medium text-white/80 truncate pointer-events-none">
                                                        {layer.name}
                                                    </span>
                                                    <span
                                                        onPointerDown={(e) =>
                                                            startLayerBarDrag(e, activeShot, layer, 'in')
                                                        }
                                                        title="Drag left edge to trim layer In point"
                                                        className="absolute left-0 top-0 bottom-0 w-2.5 cursor-ew-resize hover:bg-white/30 rounded-l-lg"
                                                    />
                                                    <span
                                                        onPointerDown={(e) =>
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
                                                        onPointerDown={(e) => e.stopPropagation()}
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
                                                                onPointerDown={(e) =>
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
                                                                className={`absolute h-4 rounded-full border px-2 flex items-center justify-between text-[10px] font-medium tracking-tight cursor-grab active:cursor-grabbing transition ${isSelected &&
                                                                        selectedPresetType === 'entrance'
                                                                        ? 'border-purple-300 bg-purple-700 text-white shadow'
                                                                        : 'border-[#8b5cf6] bg-[#341a63]/90 text-purple-200 hover:border-purple-400'
                                                                    }`}
                                                            >
                                                                <span className="truncate pointer-events-none">
                                                                    In: {layer.entrance.type}
                                                                </span>
                                                                <span
                                                                    onPointerDown={(e) =>
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
                                                                    onPointerDown={(e) =>
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
                                                                onPointerDown={(e) =>
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
                                                                className={`absolute h-4 rounded-full border px-2 flex items-center justify-between text-[10px] font-medium tracking-tight cursor-grab active:cursor-grabbing transition ${isSelected && selectedPresetType === 'exit'
                                                                        ? 'border-pink-300 bg-pink-700 text-white shadow'
                                                                        : 'border-[#ec4899] bg-[#591636]/90 text-pink-200 hover:border-pink-400'
                                                                    }`}
                                                            >
                                                                <span className="truncate pointer-events-none">
                                                                    Out: {layer.exit.type}
                                                                </span>
                                                                <span
                                                                    onPointerDown={(e) =>
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
                                                                    onPointerDown={(e) =>
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
                                                                onPointerDown={(e) =>
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
                                                                className={`absolute h-4 rounded-full border px-2 flex items-center justify-between text-[10px] font-medium tracking-tight cursor-grab transition relative ${selectedBlockId === blk.id
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
                                                                    onPointerDown={(e) =>
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
                                                                    onPointerDown={(e) =>
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
                    </div>

                    {/* ======================================================= */}
                    {/* SKIMMER (GREY)                                          */}
                    {/* ======================================================= */}
                    {hoverDisplayTimeMs !== null && !isDraggingPlayhead && (
                        <div
                            aria-hidden="true"
                            className="absolute top-0 bottom-0 pointer-events-none z-20 flex flex-col items-center"
                            style={{
                                left: `${hoverDisplayTimeMs * pxPerMs}px`,
                                transform: 'translateX(-50%)',
                            }}
                        >
                            {/* 1px vertical line in muted grey (~#3a3a3a to #4a4a4a) spanning with same height */}
                            <div
                                className="absolute inset-y-0 w-px"
                                style={{
                                    background: 'linear-gradient(to bottom, #44444c 0%, #44444c 82%, rgba(68, 68, 76, 0) 100%)',
                                }}
                            />

                            {/* Small dark pill label with grey monospace text sitting on ruler at top */}
                            <div className="relative px-1.5 py-0.5 rounded-full bg-[#242428] border border-white/10 text-[#a1a1aa] text-[9.5px] font-mono font-medium shadow-sm whitespace-nowrap leading-none select-none mt-1 z-10">
                                {(hoverDisplayTimeMs / 1000).toFixed(2)}
                            </div>
                        </div>
                    )}

                    {/* ======================================================= */}
                    {/* MAIN PLAYHEAD (BLUE)                                    */}
                    {/* ======================================================= */}
                    <PlayheadOverlay
                        pxPerMs={pxPerMs}
                        timelineView={timelineView}
                        activeShotStartMs={activeShot?.startMs ?? 0}
                        scrollContainerRef={trackRef}
                    />
                </div>
            </div>
        </section>
    );
});
