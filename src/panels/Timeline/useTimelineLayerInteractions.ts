import React from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { AnimationBlock, Layer, Shot } from '../../model/types';
import { getSnapTargets, snapTime } from './timelineSnapping';
import { getTimelineTransition, updateTimelineTransition } from './transitionSync';
import type { TimelineGhostDragPreview } from './timelineTypes';

interface TimelineLayerInteractionsOptions {
    pxPerMs: number;
    snapThresholdMs: number;
    setGhostDragPreview: Dispatch<SetStateAction<TimelineGhostDragPreview | null>>;
    setDragging: Dispatch<SetStateAction<boolean>>;
    suppressPillClickRef: React.MutableRefObject<string | null>;
    beginDragTransaction: () => void;
    commitDragTransaction: () => void;
    updateLayer: (
        shotId: string,
        layerId: string,
        updater: (layer: Layer) => Layer,
        options?: { skipHistory?: boolean }
    ) => void;
    setInspectorTab: (tab: 'shot' | 'layer') => void;
    selectLayer: (layerId: string, additive?: boolean) => void;
    selectPreset: (type: 'entrance' | 'exit', layerId?: string) => void;
    selectBlock: (blockId: string | null, layerId?: string) => void;
}

export function useTimelineLayerInteractions({
    pxPerMs,
    snapThresholdMs,
    setGhostDragPreview,
    setDragging,
    suppressPillClickRef,
    beginDragTransaction,
    commitDragTransaction,
    updateLayer,
    setInspectorTab,
    selectLayer,
    selectPreset,
    selectBlock,
}: TimelineLayerInteractionsOptions) {    // 1. Drag / Trim Main Layer Bar (Hardened with Pointer Events & >3px deadzone + Magnetic Snapping)
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


    return { startLayerBarDrag, startPresetDrag, startBlockDrag };
}
