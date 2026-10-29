import React, { useEffect, useRef, useState } from 'react';
import { MAX_TIMELINE_ZOOM, MIN_TIMELINE_ZOOM } from './timelineConstants';

interface TimelineViewportOptions {
    timelineZoom: number;
    setTimelineZoom: (zoom: number) => void;
    timelineHeightPx: number;
    setTimelineHeightPx: (height: number) => void;
    timelineScrollTop: number;
}

export function useTimelineViewport({
    timelineZoom,
    setTimelineZoom,
    timelineHeightPx,
    setTimelineHeightPx,
    timelineScrollTop,
}: TimelineViewportOptions) {
    const trackRef = useRef<HTMLDivElement | null>(null);
    const timelineZoomRef = useRef(timelineZoom);
    const [timelineViewportWidth, setTimelineViewportWidth] = useState(800);

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
        return () => container.removeEventListener('wheel', handleWheel);
    }, [setTimelineZoom]);

    useEffect(() => {
        const element = trackRef.current;
        if (!element) return;
        const observer = new ResizeObserver(([entry]) => {
            setTimelineViewportWidth(Math.max(1, entry.contentRect.width));
        });
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const element = trackRef.current;
        if (element && Math.abs(element.scrollTop - timelineScrollTop) > 1) {
            element.scrollTop = timelineScrollTop;
        }
    }, [timelineScrollTop]);

    const handleStartResizeTimelineHeight = (event: React.PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0 && event.pointerType === 'mouse') return;
        event.preventDefault();
        const startY = event.clientY;
        const startHeight = timelineHeightPx;
        const pointerId = event.pointerId;
        const target = event.currentTarget;
        try {
            target.setPointerCapture(pointerId);
        } catch {
            // Ignore synthetic pointer capture errors.
        }

        const onMove = (moveEvent: PointerEvent) => {
            if (moveEvent.pointerId === pointerId) {
                setTimelineHeightPx(startHeight + startY - moveEvent.clientY);
            }
        };
        const onEnd = (endEvent: PointerEvent) => {
            if (endEvent.pointerId !== pointerId) return;
            try {
                if (target.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId);
            } catch {
                // Ignore release errors.
            }
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onEnd);
            window.removeEventListener('pointercancel', onEnd);
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onEnd);
        window.addEventListener('pointercancel', onEnd);
    };

    return { trackRef, timelineViewportWidth, handleStartResizeTimelineHeight };
}
