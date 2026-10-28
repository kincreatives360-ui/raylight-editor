import { IconButton } from '../../ui/primitives';
import { TimelineDragPreview } from './TimelineDragPreview';
import { TimelineRangeBar, TrimHandle } from './TimelineRangeBar';
import { getTimelineTransition, updateTimelineTransition } from './transitionSync';
// src/panels/Timeline/Timeline.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Scissors, Trash2 } from 'lucide-react';
import type { Shot, Layer, AnimationBlock, CameraBlock, LightAnimationBlock, AudioClip, Easing } from '../../model/types';
import { isBlankProjectState } from '../../model/types';
import { recalculateShotStartTimes, useProjectStore } from '../../store/useProjectStore';
import { usePlayheadStore } from '../../store/usePlayheadStore';
import { useSelectionStore } from '../../store/useSelectionStore';
import { TimelineTimecode } from './TimelineTimecode';
import { PlayheadOverlay } from './PlayheadOverlay';
import { EasingPopover } from './EasingPopover';
import { TimelineEasingCurve } from './TimelineEasingCurve';
import { getShotTimelineWidth } from './timelineBarGeometry';
import { AudioClipBar } from './AudioClipBar';
import { TransitionPill } from './TransitionPill';
import { isInteractiveElement } from '../../utils/shortcuts';

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
        deleteShot,
        addLayerToShot,
        addCameraBlockToShot,
        toggleProjectAudioMuted,
        splitAtPlayhead,
        beginDragTransaction,
        commitDragTransaction,
    } = useProjectStore();

    const isPlaying = usePlayheadStore((s) => s.isPlaying);
    const storeHoverTimeMs = usePlayheadStore((s) => s.hoverTimeMs);
    const setHoverTimeMs = usePlayheadStore((s) => s.setHoverTimeMs);
    const setIsPlaying = usePlayheadStore((s) => s.setIsPlaying);
    const setCurrentTimeMs = usePlayheadStore((s) => s.setCurrentTimeMs);
    const togglePlay = usePlayheadStore((s) => s.togglePlay);

    const hoverTimeMs = propHoverTimeMs !== undefined ? propHoverTimeMs : storeHoverTimeMs;
    const onHoverTimeChange = propOnHoverTimeChange ?? setHoverTimeMs;

    const {
        selectedShotId,
        selectedLayerIds,
        selectedBlockId,
        selectedCameraBlockId,
        selectedLightBlockId,
        selectedPresetType,
        inspectorTab,
        clearLayerSelection,
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

    const selectedLayerSet = useMemo(() => new Set(selectedLayerIds), [selectedLayerIds]);
    const expandedTimelineLayerSet = useMemo(
        () => new Set(expandedTimelineLayerIds),
        [expandedTimelineLayerIds]
    );

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
    const suppressPillClickRef = useRef<string | null>(null);
    const [timelineViewportWidth, setTimelineViewportWidth] = useState(800);
    const [addShotHoverX, setAddShotHoverX] = useState<number | null>(null);
    const [addLayerHoverX, setAddLayerHoverX] = useState<number | null>(null);
    const [dragging, setDragging] = useState(false);
    const [hoverCameraTimeMs, setHoverCameraTimeMs] = useState<number | null>(null);
    const isDraggingPlayheadRef = useRef(false);
    const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
    const [easingPopoverTarget, setEasingPopoverTarget] = useState<{
        easing: Easing;
        onChange: (easing: Easing) => void;
        anchorRect?: DOMRect | null;
    } | null>(null);
    const [ghostDragPreview, setGhostDragPreview] = useState<{
        id: string;
        type: 'block' | 'entrance' | 'exit' | 'layer' | 'camera' | 'light';
        startMs: number;
        durationMs: number;
        label?: string;
        trimEdge?: 'left' | 'right';
        snapped?: boolean;
    } | null>(null);
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

    // ArrowLeft / ArrowRight keyboard nudge for selected timeline blocks (CameraBlock, LightBlock, AnimationBlock)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
            if (isInteractiveElement(e.target as HTMLElement)) return;
            if (!activeShot) return;

            const stepMs = e.shiftKey ? 100 : 10;
            const deltaMs = e.key === 'ArrowLeft' ? -stepMs : stepMs;

            if (selectedCameraBlockId) {
                const cb = activeShot.cameraBlocks.find((b) => b.id === selectedCameraBlockId);
                if (cb) {
                    e.preventDefault();
                    const nextStart = Math.max(0, Math.min(activeShot.durationMs - cb.durationMs, cb.startMs + deltaMs));
                    if (nextStart !== cb.startMs) {
                        updateShot(activeShot.id, (s) => ({
                            ...s,
                            cameraBlocks: s.cameraBlocks.map((b) =>
                                b.id === cb.id ? { ...b, startMs: nextStart } : b
                            ),
                        }));
                    }
                    return;
                }
            }

            if (selectedLightBlockId) {
                const lb = (activeShot.lightBlocks || []).find((b) => b.id === selectedLightBlockId);
                if (lb) {
                    e.preventDefault();
                    const nextStart = Math.max(0, Math.min(activeShot.durationMs - lb.durationMs, lb.startMs + deltaMs));
                    if (nextStart !== lb.startMs) {
                        updateShot(activeShot.id, (s) => ({
                            ...s,
                            lightBlocks: (s.lightBlocks || []).map((b) =>
                                b.id === lb.id ? { ...b, startMs: nextStart } : b
                            ),
                        }));
                    }
                    return;
                }
            }

            if (selectedBlockId) {
                for (const layer of activeShot.layers) {
                    const blk = layer.blocks.find((b) => b.id === selectedBlockId);
                    if (blk) {
                        e.preventDefault();
                        const layerSpan = layer.outMs - layer.inMs;
                        const nextStart = Math.max(0, Math.min(layerSpan - blk.durationMs, blk.startMs + deltaMs));
                        if (nextStart !== blk.startMs) {
                            updateLayer(activeShot.id, layer.id, (l) => ({
                                ...l,
                                blocks: l.blocks.map((b) =>
                                    b.id === blk.id ? { ...b, startMs: nextStart } : b
                                ),
                            }));
                        }
                        return;
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedCameraBlockId, selectedLightBlockId, selectedBlockId, activeShot, updateShot, updateLayer]);

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
    const addLayerLaneWidth = activeShot
        ? getShotTimelineWidth(activeShot.durationMs, pxPerMs)
        : 0;
    const addLayerGhostWidth = Math.min(132, addLayerLaneWidth);
    const addLayerGhostLeft = Math.max(
        0,
        Math.min(addLayerLaneWidth - addLayerGhostWidth, (addLayerHoverX ?? 0) - addLayerGhostWidth / 2)
    );
    const timelineWidth = Math.max(
        1,
        timelineViewportWidth - 32,
        visibleDurationMs * pxPerMs + 160
    );

    const rulerStepMs = useMemo(() => {
        if (pxPerSecond >= 240) return 1000;
        if (pxPerSecond >= 80) return 2000;
        if (pxPerSecond >= 40) return 4000;
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
        const target = e.currentTarget;
        try {
            target.setPointerCapture(pointerId);
        } catch {
            // Ignore synthetic pointer capture errors
        }

        const onMove = (ev: PointerEvent) => {
            if (ev.pointerId === pointerId) {
                const deltaY = startY - ev.clientY;
                setTimelineHeightPx(startHeight + deltaY);
            }
        };
        const onEnd = (ev: PointerEvent) => {
            if (ev.pointerId === pointerId) {
                try {
                    if (target.hasPointerCapture(pointerId)) {
                        target.releasePointerCapture(pointerId);
                    }
                } catch {
                    // Ignore release errors
                }
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
        clearLayerSelection();
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

    // Magnetic Snapping calculation (12px visual threshold converted into milliseconds)
    const snapThresholdMs = Math.max(15, Math.round(12 / pxPerMs));

    const getSnapTargets = (shot: Shot, excludeId?: string): number[] => {
        const targets = new Set<number>();
        targets.add(0);
        targets.add(shot.durationMs);

        const playheadTimeMs = usePlayheadStore.getState().currentTimeMs;
        const playheadLocalMs = playheadTimeMs - shot.startMs;
        if (playheadLocalMs >= 0 && playheadLocalMs <= shot.durationMs) {
            targets.add(playheadLocalMs);
        }

        for (const l of shot.layers) {
            if (l.id !== excludeId) {
                targets.add(l.inMs);
                targets.add(l.outMs);
            }
            if (getTimelineTransition(l, 'entrance').type !== 'none' && `${l.id}-entrance` !== excludeId && l.id !== excludeId) {
                const entStart = l.inMs + (getTimelineTransition(l, 'entrance').delayMs || 0);
                const entDur = Math.max(80, getTimelineTransition(l, 'entrance').durationMs || 500);
                targets.add(entStart);
                targets.add(entStart + entDur);
            }
            if (getTimelineTransition(l, 'exit').type !== 'none' && `${l.id}-exit` !== excludeId && l.id !== excludeId) {
                const extDur = Math.max(80, getTimelineTransition(l, 'exit').durationMs || 500);
                const extEnd = l.outMs - (getTimelineTransition(l, 'exit').delayMs || 0);
                targets.add(Math.max(l.inMs, extEnd - extDur));
                targets.add(extEnd);
            }
            for (const b of l.blocks) {
                if (b.id !== excludeId) {
                    targets.add(b.startMs);
                    targets.add(b.startMs + b.durationMs);
                }
            }
        }
        return Array.from(targets);
    };

    const snapTime = (val: number, targets: number[], threshold: number): { time: number; snapped: boolean } => {
        let closest = val;
        let minDiff = threshold;
        let snapped = false;
        for (const t of targets) {
            const diff = Math.abs(val - t);
            if (diff < minDiff) {
                minDiff = diff;
                closest = t;
                snapped = true;
            }
        }
        return { time: closest, snapped };
    };

    // 1. Drag / Trim Main Layer Bar (Hardened with Pointer Events & >3px deadzone + Magnetic Snapping)
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
        const snapTargets = getSnapTargets(shot, layer.id);
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
                const snap = snapTime(origIn + deltaMs, snapTargets, snapThresholdMs);
                nextIn = Math.max(0, Math.min(origOut - 100, snap.time));
                setGhostDragPreview({
                    id: layer.id,
                    type: 'layer',
                    startMs: nextIn,
                    durationMs: nextOut - nextIn,
                    label: layer.name,
                    trimEdge: 'left',
                    snapped: snap.snapped,
                });
            } else if (mode === 'out') {
                const snap = snapTime(origOut + deltaMs, snapTargets, snapThresholdMs);
                nextOut = Math.max(
                    origIn + 100,
                    Math.min(shot.durationMs, snap.time)
                );
                setGhostDragPreview({
                    id: layer.id,
                    type: 'layer',
                    startMs: nextIn,
                    durationMs: nextOut - nextIn,
                    label: layer.name,
                    trimEdge: 'right',
                    snapped: snap.snapped,
                });
            } else {
                const dur = origOut - origIn;
                const snapStart = snapTime(origIn + deltaMs, snapTargets, snapThresholdMs);
                const snapEnd = snapTime(origOut + deltaMs, snapTargets, snapThresholdMs);
                let snapped = false;
                let targetIn = origIn + deltaMs;
                if (snapStart.snapped) {
                    targetIn = snapStart.time;
                    snapped = true;
                } else if (snapEnd.snapped) {
                    targetIn = snapEnd.time - dur;
                    snapped = true;
                }
                nextIn = Math.max(0, Math.min(shot.durationMs - dur, targetIn));
                nextOut = nextIn + dur;
                setGhostDragPreview({
                    id: layer.id,
                    type: 'layer',
                    startMs: nextIn,
                    durationMs: dur,
                    label: layer.name,
                    snapped,
                });
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
            setGhostDragPreview(null);
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

    // 2. Drag / Trim In (Entrance) & Out (Exit) Transition Pills! (Hardened + Magnetic Snapping)
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
        const preset = getTimelineTransition(layer, which);
        const origDelay = preset.delayMs || 0;
        const origDur = Math.max(100, preset.durationMs || 500);
        const layerSpan = Math.max(200, layer.outMs - layer.inMs);
        const pointerId = e.pointerId;
        const snapTargets = getSnapTargets(shot, `${layer.id}-${which}`);
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
                const origGlobalStart = layer.inMs + origDelay;

                if (mode === 'move') {
                    const snapStart = snapTime(origGlobalStart + deltaMs, snapTargets, snapThresholdMs);
                    const snapEnd = snapTime(origGlobalStart + origDur + deltaMs, snapTargets, snapThresholdMs);
                    let targetGlobal = origGlobalStart + deltaMs;
                    let snapped = false;
                    if (snapStart.snapped) {
                        targetGlobal = snapStart.time;
                        snapped = true;
                    } else if (snapEnd.snapped) {
                        targetGlobal = snapEnd.time - origDur;
                        snapped = true;
                    }
                    const targetDelay = targetGlobal - layer.inMs;
                    nextDelay = Math.max(
                        0,
                        Math.min(layerSpan - origDur, targetDelay)
                    );
                    setGhostDragPreview({
                        id: `${layer.id}-entrance`,
                        type: 'entrance',
                        startMs: layer.inMs + nextDelay,
                        durationMs: nextDur,
                        label: `In: ${getTimelineTransition(layer, 'entrance').type}`,
                        snapped,
                    });
                } else if (mode === 'left') {
                    const snap = snapTime(origGlobalStart + deltaMs, snapTargets, snapThresholdMs);
                    const targetDelay = snap.time - layer.inMs;
                    nextDelay = Math.max(
                        0,
                        Math.min(origDelay + origDur - 80, targetDelay)
                    );
                    nextDur = origDelay + origDur - nextDelay;
                    setGhostDragPreview({
                        id: `${layer.id}-entrance`,
                        type: 'entrance',
                        startMs: layer.inMs + nextDelay,
                        durationMs: nextDur,
                        label: `In: ${getTimelineTransition(layer, 'entrance').type}`,
                        trimEdge: 'left',
                        snapped: snap.snapped,
                    });
                } else if (mode === 'right') {
                    const snap = snapTime(origGlobalStart + origDur + deltaMs, snapTargets, snapThresholdMs);
                    const targetDur = snap.time - origGlobalStart;
                    nextDur = Math.max(
                        80,
                        Math.min(layerSpan - origDelay, targetDur)
                    );
                    setGhostDragPreview({
                        id: `${layer.id}-entrance`,
                        type: 'entrance',
                        startMs: layer.inMs + nextDelay,
                        durationMs: nextDur,
                        label: `In: ${getTimelineTransition(layer, 'entrance').type}`,
                        trimEdge: 'right',
                        snapped: snap.snapped,
                    });
                }
                updateLayer(
                    shot.id,
                    layer.id,
                    (l) => updateTimelineTransition(l, 'entrance', {
                            delayMs: nextDelay,
                            durationMs: nextDur,
                        }),
                    { skipHistory: true }
                );
            } else {
                let nextDelay = origDelay;
                let nextDur = origDur;
                const origGlobalEnd = layer.outMs - origDelay;

                if (mode === 'move') {
                    const snapStart = snapTime(origGlobalEnd - origDur + deltaMs, snapTargets, snapThresholdMs);
                    const snapEnd = snapTime(origGlobalEnd + deltaMs, snapTargets, snapThresholdMs);
                    let targetGlobalEnd = origGlobalEnd + deltaMs;
                    let snapped = false;
                    if (snapEnd.snapped) {
                        targetGlobalEnd = snapEnd.time;
                        snapped = true;
                    } else if (snapStart.snapped) {
                        targetGlobalEnd = snapStart.time + origDur;
                        snapped = true;
                    }
                    const targetDelay = layer.outMs - targetGlobalEnd;
                    nextDelay = Math.max(
                        0,
                        Math.min(layerSpan - origDur, targetDelay)
                    );
                    setGhostDragPreview({
                        id: `${layer.id}-exit`,
                        type: 'exit',
                        startMs: Math.max(layer.inMs, layer.outMs - nextDelay - nextDur),
                        durationMs: nextDur,
                        label: `Out: ${getTimelineTransition(layer, 'exit').type}`,
                        snapped,
                    });
                } else if (mode === 'left') {
                    const snap = snapTime(origGlobalEnd - origDur + deltaMs, snapTargets, snapThresholdMs);
                    const targetDur = origGlobalEnd - snap.time;
                    nextDur = Math.max(
                        80,
                        Math.min(layerSpan - origDelay, targetDur)
                    );
                    setGhostDragPreview({
                        id: `${layer.id}-exit`,
                        type: 'exit',
                        startMs: Math.max(layer.inMs, layer.outMs - nextDelay - nextDur),
                        durationMs: nextDur,
                        label: `Out: ${getTimelineTransition(layer, 'exit').type}`,
                        trimEdge: 'left',
                        snapped: snap.snapped,
                    });
                } else if (mode === 'right') {
                    const snap = snapTime(origGlobalEnd + deltaMs, snapTargets, snapThresholdMs);
                    const targetDelay = layer.outMs - snap.time;
                    nextDelay = Math.max(
                        0,
                        Math.min(origDelay + origDur - 80, targetDelay)
                    );
                    nextDur = origDelay + origDur - nextDelay;
                    setGhostDragPreview({
                        id: `${layer.id}-exit`,
                        type: 'exit',
                        startMs: Math.max(layer.inMs, layer.outMs - nextDelay - nextDur),
                        durationMs: nextDur,
                        label: `Out: ${getTimelineTransition(layer, 'exit').type}`,
                        trimEdge: 'right',
                        snapped: snap.snapped,
                    });
                }
                updateLayer(
                    shot.id,
                    layer.id,
                    (l) => updateTimelineTransition(l, 'exit', {
                            delayMs: nextDelay,
                            durationMs: nextDur,
                        }),
                    { skipHistory: true }
                );
            }
        };

        const onEnd = (ev: PointerEvent) => {
            if (ev.pointerId !== pointerId) return;
            setGhostDragPreview(null);
            if (hasMoved) {
                suppressPillClickRef.current = `${layer.id}-${which}`;
                commitDragTransaction();
                setDragging(false);
                window.setTimeout(() => {
                    if (suppressPillClickRef.current === `${layer.id}-${which}`) {
                        suppressPillClickRef.current = null;
                    }
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

    // 3. Drag / Trim Animation Block (Hardened + Magnetic Snapping)
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
        const snapTargets = getSnapTargets(shot, block.id);
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
                const snap = snapTime(origStart + deltaMs, snapTargets, snapThresholdMs);
                nextStart = Math.max(
                    0,
                    Math.min(origStart + origDur - 80, snap.time)
                );
                nextDur = origStart + origDur - nextStart;
                setGhostDragPreview({
                    id: block.id,
                    type: 'block',
                    startMs: nextStart,
                    durationMs: nextDur,
                    label: block.label || block.property,
                    trimEdge: 'left',
                    snapped: snap.snapped,
                });
            } else if (mode === 'right') {
                const snap = snapTime(origStart + origDur + deltaMs, snapTargets, snapThresholdMs);
                const nextEnd = Math.max(origStart + 80, Math.min(shot.durationMs, snap.time));
                nextDur = nextEnd - origStart;
                setGhostDragPreview({
                    id: block.id,
                    type: 'block',
                    startMs: origStart,
                    durationMs: nextDur,
                    label: block.label || block.property,
                    trimEdge: 'right',
                    snapped: snap.snapped,
                });
            } else {
                const snapStart = snapTime(origStart + deltaMs, snapTargets, snapThresholdMs);
                const snapEnd = snapTime(origStart + origDur + deltaMs, snapTargets, snapThresholdMs);
                let snapped = false;
                let targetStart = origStart + deltaMs;
                if (snapStart.snapped) {
                    targetStart = snapStart.time;
                    snapped = true;
                } else if (snapEnd.snapped) {
                    targetStart = snapEnd.time - origDur;
                    snapped = true;
                }
                nextStart = Math.max(
                    0,
                    Math.min(shot.durationMs - origDur, targetStart)
                );
                setGhostDragPreview({
                    id: block.id,
                    type: 'block',
                    startMs: nextStart,
                    durationMs: nextDur,
                    label: block.label || block.property,
                    snapped,
                });
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
            setGhostDragPreview(null);
            if (hasMoved) {
                suppressPillClickRef.current = block.id;
                commitDragTransaction();
                setDragging(false);
                window.setTimeout(() => {
                    if (suppressPillClickRef.current === block.id) {
                        suppressPillClickRef.current = null;
                    }
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

            const snapThresholdMs = Math.round(10 / pxPerMs);
            const snapTargets = [0, shot.durationMs];
            if (activeShot) {
                activeShot.cameraBlocks.forEach((b) => {
                    if (b.id !== camBlock.id) {
                        snapTargets.push(b.startMs, b.startMs + b.durationMs);
                    }
                });
            }

            if (mode === 'left') {
                const snap = snapTime(origStart + deltaMs, snapTargets, snapThresholdMs);
                nextStart = Math.max(
                    0,
                    Math.min(origStart + origDur - 100, snap.time)
                );
                nextDur = origStart + origDur - nextStart;
                setGhostDragPreview({
                    id: camBlock.id,
                    type: 'camera',
                    startMs: nextStart,
                    durationMs: nextDur,
                    label: camBlock.label,
                    trimEdge: 'left',
                    snapped: snap.snapped,
                });
            } else if (mode === 'right') {
                const snap = snapTime(origStart + origDur + deltaMs, snapTargets, snapThresholdMs);
                const nextEnd = Math.max(
                    origStart + 100,
                    Math.min(shot.durationMs, snap.time)
                );
                nextDur = nextEnd - origStart;
                setGhostDragPreview({
                    id: camBlock.id,
                    type: 'camera',
                    startMs: origStart,
                    durationMs: nextDur,
                    label: camBlock.label,
                    trimEdge: 'right',
                    snapped: snap.snapped,
                });
            } else {
                const dur = origDur;
                const snapStart = snapTime(origStart + deltaMs, snapTargets, snapThresholdMs);
                const snapEnd = snapTime(origStart + origDur + deltaMs, snapTargets, snapThresholdMs);
                let snapped = false;
                if (snapStart.snapped) {
                    nextStart = Math.max(0, Math.min(shot.durationMs - dur, snapStart.time));
                    snapped = true;
                } else if (snapEnd.snapped) {
                    nextStart = Math.max(0, Math.min(shot.durationMs - dur, snapEnd.time - dur));
                    snapped = true;
                } else {
                    nextStart = Math.max(0, Math.min(shot.durationMs - dur, origStart + deltaMs));
                }
                setGhostDragPreview({
                    id: camBlock.id,
                    type: 'camera',
                    startMs: nextStart,
                    durationMs: origDur,
                    label: camBlock.label,
                    snapped,
                });
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
            setGhostDragPreview(null);
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

            const snapThresholdMs = Math.round(10 / pxPerMs);
            const snapTargets = [0, shot.durationMs];
            if (activeShot) {
                (activeShot.lightBlocks || []).forEach((b) => {
                    if (b.id !== lightBlock.id) {
                        snapTargets.push(b.startMs, b.startMs + b.durationMs);
                    }
                });
            }

            if (mode === 'left') {
                const snap = snapTime(origStart + deltaMs, snapTargets, snapThresholdMs);
                nextStart = Math.max(
                    0,
                    Math.min(origStart + origDur - 100, snap.time)
                );
                nextDur = origStart + origDur - nextStart;
                setGhostDragPreview({
                    id: lightBlock.id,
                    type: 'light',
                    startMs: nextStart,
                    durationMs: nextDur,
                    label: lightBlock.label,
                    trimEdge: 'left',
                    snapped: snap.snapped,
                });
            } else if (mode === 'right') {
                const snap = snapTime(origStart + origDur + deltaMs, snapTargets, snapThresholdMs);
                const nextEnd = Math.max(
                    origStart + 100,
                    Math.min(shot.durationMs, snap.time)
                );
                nextDur = nextEnd - origStart;
                setGhostDragPreview({
                    id: lightBlock.id,
                    type: 'light',
                    startMs: origStart,
                    durationMs: nextDur,
                    label: lightBlock.label,
                    trimEdge: 'right',
                    snapped: snap.snapped,
                });
            } else {
                const dur = origDur;
                const snapStart = snapTime(origStart + deltaMs, snapTargets, snapThresholdMs);
                const snapEnd = snapTime(origStart + origDur + deltaMs, snapTargets, snapThresholdMs);
                let snapped = false;
                if (snapStart.snapped) {
                    nextStart = Math.max(0, Math.min(shot.durationMs - dur, snapStart.time));
                    snapped = true;
                } else if (snapEnd.snapped) {
                    nextStart = Math.max(0, Math.min(shot.durationMs - dur, snapEnd.time - dur));
                    snapped = true;
                } else {
                    nextStart = Math.max(0, Math.min(shot.durationMs - dur, origStart + deltaMs));
                }
                setGhostDragPreview({
                    id: lightBlock.id,
                    type: 'light',
                    startMs: nextStart,
                    durationMs: origDur,
                    label: lightBlock.label,
                    snapped,
                });
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
            setGhostDragPreview(null);
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
        const block = addCameraBlockToShot(activeShot.id, { startMs, durationMs });
        if (block) selectCameraBlock(block.id);
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
                    <IconButton
                        unstyled
                        tooltip={false}
                        label={isPlaying ? 'Pause playback' : 'Start playback'}
                        type="button"
                        onClick={togglePlay}
                        title="Play / Pause (Space)"
                        className="w-5 h-5 rounded-full border border-white/40 hover:border-white flex items-center justify-center text-white cursor-pointer transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0088ff]"
                        icon={isPlaying ? (
                            <Pause className="w-2.5 h-2.5" />
                        ) : (
                            <Play className="w-2.5 h-2.5 ml-0.5 fill-current" />
                        )}
                    />
                    <IconButton
                        unstyled
                        tooltip={false}
                        label="Split clip at playhead"
                        type="button"
                        onClick={() => splitAtPlayhead(usePlayheadStore.getState().currentTimeMs)}
                        title="Split Clip at Playhead (S)"
                        className="w-5 h-5 rounded-full border border-white/20 hover:border-white/60 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0088ff]"
                        icon={<Scissors className="w-2.5 h-2.5" />}
                    />
                    {activeShot && project.shots.some((shot) => shot.id === activeShot.id) && (
                        <IconButton
                            unstyled
                            tooltip={false}
                            label={`Delete shot ${activeShot.name}`}
                            type="button"
                            onClick={() => deleteShot(activeShot.id)}
                            title={`Delete ${activeShot.name}`}
                            className="w-5 h-5 rounded-full border border-white/20 hover:border-rose-400/70 flex items-center justify-center text-[#a1a1aa] hover:text-rose-300 cursor-pointer transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                            icon={<Trash2 className="w-2.5 h-2.5" />}
                        />
                    )}
                    <TimelineTimecode totalDurationMs={totalDurationMs} />
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative w-28 h-1.5 rounded-full bg-[#27272a] flex items-center group/zoom">
                        <div
                            className="h-full rounded-full bg-[#0088ff] transition-[width] duration-75"
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
                            className="absolute inset-0 w-full opacity-0 cursor-pointer z-10"
                        />
                        <div
                            className="w-3 h-3 rounded-full bg-white shadow-md pointer-events-none absolute -ml-1.5 transition-transform group-hover/zoom:scale-110"
                            style={{
                                left: `${((timelineZoom - MIN_TIMELINE_ZOOM) / (MAX_TIMELINE_ZOOM - MIN_TIMELINE_ZOOM)) * 100}%`,
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* 2. SCROLL-SYNCED TRACKS BODY (Includes Ruler + Tracks + Playhead + Skimmer) */}
            <div
                id="timeline-tracks-scroll"
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
                {isBlankState && (
                    <button
                        type="button"
                        aria-label="Add shot"
                        onPointerDown={(event) => event.stopPropagation()}
                        onPointerMove={(event) => {
                            const bounds = event.currentTarget.getBoundingClientRect();
                            setAddShotHoverX(event.clientX - bounds.left);
                        }}
                        onPointerLeave={() => setAddShotHoverX(null)}
                        onClick={(event) => {
                            event.stopPropagation();
                            const created = addShot();
                            selectShot(created.id);
                            setInspectorTab('shot');
                        }}
                        className="absolute left-2 right-2 top-[38px] z-10 h-9 overflow-hidden rounded-lg border border-dashed border-[#263946] bg-[#0e191e] text-[11px] text-[#9aaaba] hover:border-[#0088ff]/50 hover:bg-[#11212a] transition"
                    >
                        {addShotHoverX !== null && (
                            <span
                                aria-hidden="true"
                                className="absolute inset-y-0 pointer-events-none"
                                style={{ left: `${addShotHoverX}px`, transform: 'translateX(-50%)' }}
                            >
                                <span
                                    className="absolute h-4 w-10 -translate-x-1/2 -translate-y-1/2 rounded border border-dashed border-sky-400/35 bg-sky-400/[0.03]"
                                    style={{ left: -58, top: '50%' }}
                                />
                                <span
                                    className="absolute h-6 w-14 -translate-x-1/2 -translate-y-1/2 rounded-md border border-dashed border-sky-300/75 bg-sky-400/[0.08]"
                                    style={{ left: 0, top: '50%' }}
                                />
                                <span
                                    className="absolute h-4 w-10 -translate-x-1/2 -translate-y-1/2 rounded border border-dashed border-sky-400/35 bg-sky-400/[0.03]"
                                    style={{ left: 58, top: '50%' }}
                                />
                            </span>
                        )}
                        <span className={addShotHoverX === null ? '' : 'opacity-50'}>Add shot</span>
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
                                    <span className="w-1 h-1 rounded-full bg-[#52525b]/70 mt-1.5" />
                                ) : (
                                    <span className="text-[11px] font-mono tabular-nums text-[#a1a1aa] font-medium tracking-tight">
                                        {m.timeMs === 0 ? '0.00' : `${Math.round(m.timeMs / 1000)}s`}
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
                            <IconButton
                                unstyled
                                tooltip={false}
                                label={project.audio?.muted ? "Unmute audio" : "Mute audio"}
                                type="button"
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleProjectAudioMuted();
                                }}
                                title={project.audio?.muted ? "Unmute audio" : "Mute audio"}
                                className="absolute right-2 top-1 text-[10px] text-slate-400 hover:text-white z-10 flex items-center gap-1 cursor-pointer"
                                icon={project.audio?.muted ? (
                                    <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                                ) : (
                                    <Volume2 className="w-3.5 h-3.5 text-slate-300" />
                                )}
                            />
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
                                        <AudioClipBar key={clip.id} clip={clip} left={left} width={width}
                                            muted={clip.muted || project.audio?.muted}
                                            onDrag={(event, edge) => startAudioClipDrag(event, clip, edge)}
                                            onSeek={() => setCurrentTimeMs(visibleStart)}
                                            onDelete={() => deleteAudioClip(clip.id)} />
                                    );
                                }
                                const left = Math.max(0, clipStart) * pxPerMs;
                                const width = Math.max(18, clip.durationMs * pxPerMs);
                                return (
                                    <AudioClipBar key={clip.id} clip={clip} left={left} width={width}
                                        muted={clip.muted || project.audio?.muted}
                                        onDrag={(event, edge) => startAudioClipDrag(event, clip, edge)}
                                        onSeek={() => setCurrentTimeMs(Math.max(0, clipStart))}
                                        onDelete={() => deleteAudioClip(clip.id)} />
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
                                    const isSelected = inspectorTab === 'shot' && shot.id === activeShot?.id;
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
                                                const hasSelectedLayer = shot.layers.some((layer) =>
                                                    selectedLayerSet.has(layer.id)
                                                );
                                                selectShot(shot.id);
                                                setTimelineView('scene');
                                                setInspectorTab(hasSelectedLayer ? 'layer' : 'shot');
                                            }}
                                            title={`${shot.name} · ${(shot.durationMs / 1000).toFixed(2)}s · Drag to reorder, drag the right edge to trim, double-click to open layer tracks`}
                                            style={{ width: `${width}px` }}
                                            className={`h-8 rounded-xl border-[1.5px] px-3 flex items-center justify-between text-[11px] font-medium transition cursor-grab active:cursor-grabbing relative group ${isSelected
                                                    ? 'border-[#8176d9] bg-gradient-to-b from-[#28204f]/95 to-[#17152d]/95 text-white shadow-sm'
                                                    : 'border-[#3e3870]/80 bg-gradient-to-b from-[#181628]/90 to-[#100e1c]/90 text-slate-300 hover:border-[#8176d9]/60'
                                                }`}
                                        >
                                            <span className="truncate">{shot.name}</span>
                                            <IconButton
                                                unstyled
                                                tooltip={false}
                                                label={`Delete shot ${shot.name}`}
                                                icon={<Trash2 className="w-3 h-3" />}
                                                onPointerDown={(event) => event.stopPropagation()}
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    deleteShot(shot.id);
                                                }}
                                                title="Delete shot"
                                                className="z-10 rounded p-1 text-slate-400 opacity-0 transition hover:bg-rose-500/30 hover:text-white focus-visible:opacity-100 group-hover:opacity-100"
                                            />
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
                            <button
                                type="button"
                                aria-label="Add layer to the open shot"
                                onPointerDown={(e) => e.stopPropagation()}
                                onPointerMove={(event) => {
                                    const bounds = event.currentTarget.getBoundingClientRect();
                                    setAddLayerHoverX(Math.max(0, Math.min(addLayerLaneWidth, event.clientX - bounds.left)));
                                }}
                                onPointerLeave={() => setAddLayerHoverX(null)}
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
                                style={{ order: 0, width: `${addLayerLaneWidth}px` }}
                                className="h-10 shrink-0 relative overflow-hidden flex items-center justify-center rounded-lg border border-transparent bg-transparent text-[10px] text-[#8495a8] hover:text-sky-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-sky-700 cursor-pointer"
                            >
                                {addLayerHoverX === null ? (
                                    <span>+ Add layer</span>
                                ) : (
                                    <span
                                        aria-hidden="true"
                                        className="absolute left-0 top-1/2 h-8 rounded-md border border-dotted border-sky-400/80 bg-sky-400/[0.06] text-sky-100 flex items-center justify-center pointer-events-none"
                                        style={{
                                            width: `${addLayerGhostWidth}px`,
                                            transform: `translate3d(${addLayerGhostLeft}px, -50%, 0)`,
                                        }}
                                    >
                                        + Add layer
                                    </span>
                                )}
                            </button>

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
                                className="h-10 relative flex items-center cursor-pointer"
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
                                            <React.Fragment key={cb.id}>
                                                <TimelineRangeBar
                                                    data-cam-pill="true"
                                                    onPointerDown={(e) =>
                                                        startCameraBlockDrag(e, activeShot, cb, 'move')
                                                    }
                                                    left={left} width={width}
                                                    title={`${modeLabel} · ${(cb.durationMs / 1000).toFixed(2)}s`}
                                                    className={`absolute top-0.5 bottom-0.5 overflow-hidden rounded-lg border px-2.5 flex items-center justify-between text-[10px] font-medium cursor-grab transition ${isCamSelected
                                                            ? 'border-emerald-300 bg-gradient-to-b from-[#073b28]/95 to-[#061b13]/95 text-emerald-100 shadow-[inset_0_0_20px_rgba(16,185,129,0.12)]'
                                                            : 'border-emerald-600/90 bg-gradient-to-b from-[#08281d]/90 to-[#06160f]/95 text-emerald-200 hover:border-emerald-400'
                                                        } ${ghostDragPreview?.id === cb.id ? 'opacity-40' : ''}`}
                                                >
                                                    <TimelineEasingCurve easing={cb.easing} color="#18c988" />
                                                    <TrimHandle side="left"
                                                        onPointerDown={(e) =>
                                                            startCameraBlockDrag(e, activeShot, cb, 'left')
                                                        }
                                                        className="w-2.5 bg-white/20 hover:bg-emerald-300 rounded-l-full" />
                                                    <TrimHandle side="right"
                                                        onPointerDown={(e) =>
                                                            startCameraBlockDrag(e, activeShot, cb, 'right')
                                                        }
                                                        className="w-2.5 bg-white/20 hover:bg-emerald-300 rounded-r-full" />
                                                </TimelineRangeBar>
                                                {ghostDragPreview && ghostDragPreview.id === cb.id && (
                                                    <TimelineDragPreview
                                                        startMs={ghostDragPreview.startMs}
                                                        durationMs={ghostDragPreview.durationMs}
                                                        snapped={ghostDragPreview.snapped}
                                                        pxPerMs={pxPerMs}
                                                        minWidth={36}
                                                        variant="pill"
                                                    />
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                            </div>

                            {/* 2. Light Track Row (h-7 = 28px, ONLY rendered when Light blocks exist) */}
                            {hasLightBlocks && (
                                <div style={{ order: 20 }} className="h-10 relative flex items-center">
                                    {(activeShot.lightBlocks || []).map((lb) => {
                                        const isLightSelected = selectedLightBlockId === lb.id;
                                        const left = lb.startMs * pxPerMs;
                                        const width = Math.max(36, lb.durationMs * pxPerMs);
                                        return (
                                            <React.Fragment key={lb.id}>
                                                <TimelineRangeBar
                                                    data-light-pill="true"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        selectLightBlock(lb.id);
                                                        setInspectorTab('shot');
                                                    }}
                                                    onPointerDown={(e) =>
                                                        startLightBlockDrag(e, activeShot, lb, 'move')
                                                    }
                                                    left={left} width={width}
                                                    title={`${lb.label || 'Light animation'} · ${(lb.durationMs / 1000).toFixed(2)}s`}
                                                    className={`group/light absolute top-0.5 bottom-0.5 overflow-hidden rounded-lg border px-2.5 flex items-center justify-between text-[10px] font-medium cursor-grab transition ${isLightSelected
                                                            ? 'border-[#ff402f] bg-gradient-to-b from-[#3a1713]/95 to-[#1e0e0c]/95 text-red-100 shadow-[inset_0_0_20px_rgba(248,62,43,0.12)]'
                                                            : 'border-[#ff3829] bg-gradient-to-b from-[#321410]/90 to-[#1c0c0a]/95 text-red-200 hover:border-[#ff6b5c]'
                                                        } ${ghostDragPreview?.id === lb.id ? 'opacity-40' : ''}`}
                                                >
                                                    <TimelineEasingCurve easing={lb.easing} color="#ff493b" />
                                                    <IconButton
                                                        unstyled
                                                        tooltip={false}
                                                        label="Delete light block"
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
                                                        icon={<>&times;</>}
                                                    />
                                                    <TrimHandle side="left"
                                                        onPointerDown={(e) =>
                                                            startLightBlockDrag(e, activeShot, lb, 'left')
                                                        }
                                                        className="w-2.5 bg-white/20 hover:bg-amber-300 rounded-l-full" />
                                                    <TrimHandle side="right"
                                                        onPointerDown={(e) =>
                                                            startLightBlockDrag(e, activeShot, lb, 'right')
                                                        }
                                                        className="w-2.5 bg-white/20 hover:bg-amber-300 rounded-r-full" />
                                                </TimelineRangeBar>
                                                {ghostDragPreview && ghostDragPreview.id === lb.id && (
                                                    <TimelineDragPreview
                                                        startMs={ghostDragPreview.startMs}
                                                        durationMs={ghostDragPreview.durationMs}
                                                        snapped={ghostDragPreview.snapped}
                                                        pxPerMs={pxPerMs}
                                                        minWidth={36}
                                                        variant="pill"
                                                    />
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </div>
                            )}

                            {/* 3. Layer Track Rows (h-7 = 28px) + Indented Sub-rows (h-6 = 24px) */}
                                {activeShot.layers
                                .slice()
                                .sort((a, b) => b.order - a.order)
                                .map((layer) => {
                                    const isSelected = selectedLayerSet.has(layer.id);
                                    const hasAnimations =
                                        layer.blocks.length > 0 ||
                                        getTimelineTransition(layer, 'entrance').type !== 'none' ||
                                        getTimelineTransition(layer, 'exit').type !== 'none';
                                    const isExpanded =
                                        expandedTimelineLayerSet.has(layer.id) ||
                                        (isSelected && hasAnimations);

                                    const left = layer.inMs * pxPerMs;
                                    const width = Math.max(
                                        32,
                                        (layer.outMs - layer.inMs) * pxPerMs
                                    );

                                    const barStyle = layer.kind === 'shape'
                                        ? isSelected
                                            ? 'border-[#7773ff] bg-gradient-to-b from-[#1b1b3c]/95 to-[#0c1023]/95 shadow-[inset_0_0_20px_rgba(99,102,241,0.12)]'
                                            : 'border-[#4b4bc3] bg-gradient-to-b from-[#17172e]/90 to-[#0b1020]/95 hover:border-[#7773ff]'
                                        : isSelected
                                            ? 'border-[#16b8f4] bg-gradient-to-b from-[#0b2938]/95 to-[#08151e]/95 shadow-[inset_0_0_20px_rgba(14,165,233,0.12)]'
                                            : 'border-[#087fad] bg-gradient-to-b from-[#0a222e]/90 to-[#07141d]/95 hover:border-[#16b8f4]';

                                    const entStartMs =
                                        layer.inMs + (getTimelineTransition(layer, 'entrance').delayMs || 0);
                                    const entDurMs = Math.max(80, getTimelineTransition(layer, 'entrance').durationMs || 500);

                                    const extDurMs = Math.max(80, getTimelineTransition(layer, 'exit').durationMs || 500);
                                    const extEndMs = layer.outMs - (getTimelineTransition(layer, 'exit').delayMs || 0);
                                    const extStartMs = Math.max(layer.inMs, extEndMs - extDurMs);

                                    return (
                                        <div key={layer.id} style={{ order: 10 }} className="space-y-0.5">
                                            {/* Main layer bars use the same 40px track height as the reference. */}
                                            <div className="h-10 relative flex items-center">
                                                <TimelineRangeBar
                                                    onPointerDown={(e) =>
                                                        startLayerBarDrag(e, activeShot, layer, 'move')
                                                    }
                                                    left={left} width={width}
                                                    aria-label={`${layer.name} layer bar`}
                                                    title={`${layer.name} · ${(layer.outMs - layer.inMs) / 1000}s`}
                                                    className={`absolute top-0.5 bottom-0.5 overflow-hidden rounded-lg border cursor-grab active:cursor-grabbing transition ${barStyle} ${
                                                        ghostDragPreview?.id === layer.id ? 'opacity-40' : ''
                                                    }`}
                                                >
                                                    <TrimHandle side="left"
                                                        onPointerDown={(e) =>
                                                            startLayerBarDrag(e, activeShot, layer, 'in')
                                                        }
                                                        title="Drag left edge to trim layer In point"
                                                        className="w-2.5 hover:bg-white/30 rounded-l-lg" />
                                                    <TrimHandle side="right"
                                                        onPointerDown={(e) =>
                                                            startLayerBarDrag(e, activeShot, layer, 'out')
                                                        }
                                                        title="Drag right edge to trim layer Out point"
                                                        className="w-2.5 hover:bg-white/30 rounded-r-lg" />
                                                </TimelineRangeBar>

                                                {/* Dashed Ghost Outline during Layer Drag */}
                                                {ghostDragPreview && ghostDragPreview.id === layer.id && (
                                                    <TimelineDragPreview startMs={ghostDragPreview.startMs} durationMs={ghostDragPreview.durationMs} snapped={ghostDragPreview.snapped} pxPerMs={pxPerMs} minWidth={32} variant="layer" />
                                                )}
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
                                                                updateLayer(activeShot.id, layer.id, (l) => updateTimelineTransition(l, 'entrance', {
                                                                        type:
                                                                            getTimelineTransition(l, 'entrance').type === 'none'
                                                                                ? 'fade'
                                                                                : getTimelineTransition(l, 'entrance').type,
                                                                        delayMs: Math.max(0, clickMs - l.inMs),
                                                                        durationMs: 600,
                                                                    }));
                                                                selectPreset('entrance', layer.id);
                                                            } else {
                                                                updateLayer(activeShot.id, layer.id, (l) => updateTimelineTransition(l, 'exit', {
                                                                        type:
                                                                            getTimelineTransition(l, 'exit').type === 'none'
                                                                                ? 'fade'
                                                                                : getTimelineTransition(l, 'exit').type,
                                                                        delayMs: Math.max(0, l.outMs - clickMs),
                                                                        durationMs: 550,
                                                                    }));
                                                                selectPreset('exit', layer.id);
                                                            }
                                                        }}
                                                        title="Click anywhere on this row to place an In or Out transition"
                                                        className="h-9 relative flex items-center group"
                                                    >
                                                        {/* Movable & resizable entrance / exit pills */}
                                                        {(['entrance', 'exit'] as const).map(side => {
                                                            const transition = getTimelineTransition(layer, side);
                                                            if (transition.type === 'none') return null;
                                                            const easing: Easing = transition.easing || { kind: 'preset', name: side === 'entrance' ? 'ease-out' : 'ease-in' };
                                                            return <TransitionPill key={side} side={side}
                                                                left={(side === 'entrance' ? entStartMs : extStartMs) * pxPerMs}
                                                                width={Math.max(28, (side === 'entrance' ? entDurMs : extDurMs) * pxPerMs)}
                                                                selected={isSelected && selectedPresetType === side}
                                                                ghosted={ghostDragPreview?.id === `${layer.id}-${side}`}
                                                                easing={easing}
                                                                onDrag={(event, edge) => startPresetDrag(event, activeShot, layer, side, edge)}
                                                                onClick={event => {
                                                                    event.stopPropagation();
                                                                    if (suppressPillClickRef.current === `${layer.id}-${side}`) {
                                                                        suppressPillClickRef.current = null;
                                                                        return;
                                                                    }
                                                                    selectPreset(side, layer.id);
                                                                    setEasingPopoverTarget({
                                                                        easing,
                                                                        onChange: next => updateLayer(activeShot.id, layer.id, l => updateTimelineTransition(l, side, { easing: next })),
                                                                        anchorRect: event.currentTarget.getBoundingClientRect(),
                                                                    });
                                                                }} />;
                                                        })}

                                                        {/* Dashed Ghost Outline during Preset Drag */}
                                                        {ghostDragPreview && (ghostDragPreview.id === `${layer.id}-entrance` || ghostDragPreview.id === `${layer.id}-exit`) && (
                                                            <TimelineDragPreview startMs={ghostDragPreview.startMs} durationMs={ghostDragPreview.durationMs} snapped={ghostDragPreview.snapped} pxPerMs={pxPerMs} minWidth={28} variant="pill" showStart={false} />
                                                        )}
                                                    </div>

                                                    {/* ♦ Property blocks use 36px rows; bars are 90% of the main layer bar. */}
                                                    {layer.blocks.map((blk) => (
                                                        <div
                                                            key={blk.id}
                                                            className="h-9 relative flex items-center"
                                                        >
                                                            <TimelineRangeBar
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (suppressPillClickRef.current === blk.id) {
                                                                        suppressPillClickRef.current = null;
                                                                        return;
                                                                    }
                                                                    selectBlock(blk.id, layer.id);
                                                                    setEasingPopoverTarget({
                                                                        easing: blk.easing,
                                                                        onChange: (easing) => {
                                                                            updateLayer(activeShot.id, layer.id, (l) => ({
                                                                                ...l,
                                                                                blocks: l.blocks.map((b) =>
                                                                                    b.id === blk.id ? { ...b, easing } : b
                                                                                ),
                                                                            }));
                                                                        },
                                                                        anchorRect: (e.currentTarget as HTMLElement).getBoundingClientRect(),
                                                                    });
                                                                }}
                                                                onPointerDown={(e) =>
                                                                    startBlockDrag(
                                                                        e,
                                                                        activeShot,
                                                                        layer,
                                                                        blk,
                                                                        'move'
                                                                    )
                                                                }
                                                                left={blk.startMs * pxPerMs} width={Math.max(36, blk.durationMs * pxPerMs)}
                                                                title={`${blk.label} · ${(blk.durationMs / 1000).toFixed(2)}s · Click to edit easing`}
                                                                aria-label={`${blk.label} animation bar`}
                                                                className={`absolute top-1/2 h-[90%] -translate-y-1/2 overflow-hidden rounded-lg border px-2 flex items-center justify-between text-[10px] font-medium tracking-tight cursor-grab transition ${selectedBlockId === blk.id
                                                                        ? 'border-[#c084fc] bg-gradient-to-b from-[#351b53]/95 to-[#1a0f2b]/95 text-white shadow-[inset_0_0_18px_rgba(168,85,247,0.12)]'
                                                                        : 'border-[#8c45cc] bg-gradient-to-b from-[#291442]/95 to-[#150b22]/95 text-purple-200 hover:border-[#bc70ff]'
                                                                    } ${ghostDragPreview?.id === blk.id ? 'opacity-40' : ''}`}
                                                            >
                                                                <TimelineEasingCurve easing={blk.easing} color="#bd70ff" />
                                                                <TrimHandle side="left"
                                                                    onPointerDown={(e) =>
                                                                        startBlockDrag(
                                                                            e,
                                                                            activeShot,
                                                                            layer,
                                                                            blk,
                                                                            'left'
                                                                        )
                                                                    }
                                                                    className="w-2 bg-white/25 hover:bg-amber-300 rounded-l-full" />
                                                                <TrimHandle side="right"
                                                                    onPointerDown={(e) =>
                                                                        startBlockDrag(
                                                                            e,
                                                                            activeShot,
                                                                            layer,
                                                                            blk,
                                                                            'right'
                                                                        )
                                                                    }
                                                                    className="w-2 bg-white/25 hover:bg-amber-300 rounded-r-full" />
                                                            </TimelineRangeBar>

                                                            {/* Dashed Ghost Outline during Block Drag */}
                                                            {ghostDragPreview && ghostDragPreview.id === blk.id && (
                                                                <TimelineDragPreview startMs={ghostDragPreview.startMs} durationMs={ghostDragPreview.durationMs} snapped={ghostDragPreview.snapped} pxPerMs={pxPerMs} minWidth={36} variant="pill" />
                                                            )}
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
                            <div className="relative px-2 py-0.5 rounded-full bg-[#242428] border border-white/10 text-[#a1a1aa] text-[11px] font-mono tabular-nums font-medium shadow-sm whitespace-nowrap leading-none select-none mt-1 z-10">
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
                    {/* Floating Visual Bezier Curve Popover */}
                    {easingPopoverTarget && (
                        <EasingPopover
                            easing={easingPopoverTarget.easing}
                            onChange={(nextEasing) => {
                                easingPopoverTarget.onChange(nextEasing);
                                setEasingPopoverTarget((prev) =>
                                    prev ? { ...prev, easing: nextEasing } : null
                                );
                            }}
                            onClose={() => setEasingPopoverTarget(null)}
                            anchorRect={easingPopoverTarget.anchorRect}
                        />
                    )}
                </div>
            </div>
        </section>
    );
});
