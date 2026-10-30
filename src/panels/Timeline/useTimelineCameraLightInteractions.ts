import React from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { CameraBlock, LightAnimationBlock, Shot } from '../../model/types';
import { snapTime } from './timelineSnapping';
import type { TimelineGhostDragPreview } from './timelineTypes';

interface TimelineCameraLightInteractionsOptions {
    pxPerMs: number;
    setGhostDragPreview: Dispatch<SetStateAction<TimelineGhostDragPreview | null>>;
    setDragging: Dispatch<SetStateAction<boolean>>;
    beginDragTransaction: () => void;
    commitDragTransaction: () => void;
    updateShot: (
        shotId: string,
        updater: (shot: Shot) => Shot,
        options?: { skipHistory?: boolean }
    ) => void;
    selectCameraBlock: (blockId: string | null) => void;
    selectLightBlock: (blockId: string | null) => void;
}

export function useTimelineCameraLightInteractions({
    pxPerMs,
    setGhostDragPreview,
    setDragging,
    beginDragTransaction,
    commitDragTransaction,
    updateShot,
    selectCameraBlock,
    selectLightBlock,
}: TimelineCameraLightInteractionsOptions) {    // 4. Drag / Trim Camera Block (Hardened)
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
            if (shot) {
                shot.cameraBlocks.forEach((b) => {
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
            if (shot) {
                (shot.lightBlocks || []).forEach((b) => {
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

    return { startCameraBlockDrag, startLightBlockDrag };
}
