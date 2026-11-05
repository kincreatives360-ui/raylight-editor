import React from 'react';
import type { MutableRefObject } from 'react';
import type { Project, Shot } from '../../model/types';
import { recalculateShotStartTimes } from '../../store/useProjectStore';
import { useProjectStore } from '../../store/useProjectStore';

interface ShotDragState {
    shotId: string;
    index: number;
    startX: number;
    dragging: boolean;
}

interface TimelineShotInteractionsOptions {
    pxPerMs: number;
    updateProject: (updater: (project: Project) => Project, options?: { skipHistory?: boolean }) => void;
    beginDragTransaction: () => void;
    commitDragTransaction: () => void;
    setDragging: (dragging: boolean) => void;
    selectShot: (shotId: string) => void;
    setInspectorTab: (tab: 'shot' | 'layer') => void;
    shotDragRef: MutableRefObject<ShotDragState | null>;
    suppressShotClickRef: MutableRefObject<string | null>;
}

export function useTimelineShotInteractions({
    pxPerMs,
    updateProject,
    beginDragTransaction,
    commitDragTransaction,
    setDragging,
    selectShot,
    setInspectorTab,
    shotDragRef,
    suppressShotClickRef,
}: TimelineShotInteractionsOptions) {    // 6. Shot Edge Trim (Hardened)
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


    return { startShotTrim, startShotReorder };
}