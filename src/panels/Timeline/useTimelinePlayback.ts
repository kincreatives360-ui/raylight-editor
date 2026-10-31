import React, { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { Shot } from '../../model/types';
import { isInteractiveElement } from '../../utils/shortcuts';

interface TimelinePlaybackOptions {
    trackRef: RefObject<HTMLDivElement | null>;
    pxPerMs: number;
    visibleDurationMs: number;
    totalDurationMs: number;
    timelineView: 'video' | 'scene';
    activeShot?: Shot;
    isBlankState: boolean;
    hoverTimeMs: number | null;
    onHoverTimeChange: (timeMs: number | null) => void;
    isPlaying: boolean;
    setIsPlaying: (playing: boolean) => void;
    setCurrentTimeMs: (timeMs: number) => void;
    dragging: boolean;
    clearLayerSelection: () => void;
    selectedCameraBlockId: string | null;
    selectedLightBlockId: string | null;
    selectedBlockId: string | null;
    updateShot: (shotId: string, updater: (shot: Shot) => Shot) => void;
    updateLayer: (shotId: string, layerId: string, updater: (layer: Shot['layers'][number]) => Shot['layers'][number]) => void;
}

export function useTimelinePlayback({
    trackRef,
    pxPerMs,
    visibleDurationMs,
    totalDurationMs,
    timelineView,
    activeShot,
    isBlankState,
    hoverTimeMs,
    onHoverTimeChange,
    isPlaying,
    setIsPlaying,
    setCurrentTimeMs,
    dragging,
    clearLayerSelection,
    selectedCameraBlockId,
    selectedLightBlockId,
    selectedBlockId,
    updateShot,
    updateLayer,
}: TimelinePlaybackOptions) {
    const isDraggingPlayheadRef = useRef(false);
    const justDraggedPlayheadRef = useRef(false);
    const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
    const rafIdRef = useRef<number | null>(null);
    const latestHoverClientXRef = useRef<number | null>(null);

    useEffect(() => () => {
        if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
    }, []);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
            if (isInteractiveElement(event.target as HTMLElement)) return;
            if (!activeShot) return;

            const stepMs = event.shiftKey ? 100 : 10;
            const deltaMs = event.key === 'ArrowLeft' ? -stepMs : stepMs;

            if (selectedCameraBlockId) {
                const block = activeShot.cameraBlocks.find((item) => item.id === selectedCameraBlockId);
                if (block) {
                    event.preventDefault();
                    const nextStart = Math.max(0, Math.min(activeShot.durationMs - block.durationMs, block.startMs + deltaMs));
                    if (nextStart !== block.startMs) {
                        updateShot(activeShot.id, (shot) => ({
                            ...shot,
                            cameraBlocks: shot.cameraBlocks.map((item) =>
                                item.id === block.id ? { ...item, startMs: nextStart } : item
                            ),
                        }));
                    }
                    return;
                }
            }

            if (selectedLightBlockId) {
                const block = (activeShot.lightBlocks || []).find((item) => item.id === selectedLightBlockId);
                if (block) {
                    event.preventDefault();
                    const nextStart = Math.max(0, Math.min(activeShot.durationMs - block.durationMs, block.startMs + deltaMs));
                    if (nextStart !== block.startMs) {
                        updateShot(activeShot.id, (shot) => ({
                            ...shot,
                            lightBlocks: (shot.lightBlocks || []).map((item) =>
                                item.id === block.id ? { ...item, startMs: nextStart } : item
                            ),
                        }));
                    }
                    return;
                }
            }

            if (selectedBlockId) {
                for (const layer of activeShot.layers) {
                    const block = layer.blocks.find((item) => item.id === selectedBlockId);
                    if (block) {
                        event.preventDefault();
                        const layerSpan = layer.outMs - layer.inMs;
                        const nextStart = Math.max(0, Math.min(layerSpan - block.durationMs, block.startMs + deltaMs));
                        if (nextStart !== block.startMs) {
                            updateLayer(activeShot.id, layer.id, (currentLayer) => ({
                                ...currentLayer,
                                blocks: currentLayer.blocks.map((item) =>
                                    item.id === block.id ? { ...item, startMs: nextStart } : item
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

    const clientXToLocalMs = (clientX: number): number => {
        const element = trackRef.current;
        if (!element) return 0;
        const rect = element.getBoundingClientRect();
        const contentX = clientX - rect.left - 16 + element.scrollLeft;
        return Math.max(0, Math.min(visibleDurationMs, contentX / pxPerMs));
    };

    const timeAtClientX = (clientX: number) => {
        const localMs = clientXToLocalMs(clientX);
        return timelineView === 'scene' && activeShot
            ? activeShot.startMs + Math.min(activeShot.durationMs, localMs)
            : Math.min(totalDurationMs, localMs);
    };

    const scrubFromClientX = (clientX: number) => setCurrentTimeMs(timeAtClientX(clientX));

    const handleTimelinePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        if (isBlankState || totalDurationMs <= 0 || isDraggingPlayheadRef.current || dragging) {
            if (hoverTimeMs !== null) onHoverTimeChange(null);
            return;
        }
        if (isPlaying) setIsPlaying(false);

        latestHoverClientXRef.current = event.clientX;
        if (rafIdRef.current === null) {
            rafIdRef.current = requestAnimationFrame(() => {
                rafIdRef.current = null;
                if (latestHoverClientXRef.current !== null && !isDraggingPlayheadRef.current) {
                    onHoverTimeChange(timeAtClientX(latestHoverClientXRef.current));
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
        if (justDraggedPlayheadRef.current) {
            justDraggedPlayheadRef.current = false;
            return;
        }
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        if (target.closest('button, input, [role="button"], [data-timeline-item], [data-cam-pill], [data-light-pill], [data-preset-pill]')) return;
        clearLayerSelection();
    };

    const handleRulerPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0 && event.pointerType === 'mouse') return;
        event.preventDefault();
        event.stopPropagation();
        isDraggingPlayheadRef.current = true;
        setIsDraggingPlayhead(true);
        onHoverTimeChange(null);
        scrubFromClientX(event.clientX);

        const pointerId = event.pointerId;
        try {
            event.currentTarget.setPointerCapture(pointerId);
        } catch {
            // Ignore capture failure.
        }

        const onMove = (moveEvent: PointerEvent) => {
            if (moveEvent.pointerId === pointerId) scrubFromClientX(moveEvent.clientX);
        };
        const onEnd = (endEvent: PointerEvent) => {
            if (endEvent.pointerId !== pointerId) return;
            isDraggingPlayheadRef.current = false;
            setIsDraggingPlayhead(false);
            justDraggedPlayheadRef.current = true;
            window.setTimeout(() => {
                justDraggedPlayheadRef.current = false;
            }, 120);
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onEnd);
            window.removeEventListener('pointercancel', onEnd);
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onEnd);
        window.addEventListener('pointercancel', onEnd);
    };

    return {
        isDraggingPlayhead,
        clientXToLocalMs,
        handleTimelinePointerMove,
        handleTimelinePointerLeave,
        handleTimelineClick,
        handleRulerPointerDown,
    };
}
