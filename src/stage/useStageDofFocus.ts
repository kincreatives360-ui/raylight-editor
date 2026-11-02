import { useCallback, useEffect, useRef, type MouseEvent, type PointerEvent, type RefObject } from 'react';
import type { EvaluatedProjectFrame } from '../engine/evaluateShot';
import type { FocusBlock, Project } from '../model/types';
import type { EvaluatedCameraPose } from './webgl/cameraMath';
import { DEFAULT_CAMERA_Z, DEFAULT_FOCAL_LENGTH, getLayerProjectedCorners } from './webgl/cameraMath';
import { createPointerDragLifecycle } from './selectionDragLifecycle';

type UpdateShot = (
    shotId: string,
    updater: (shot: Project['shots'][number]) => Project['shots'][number],
    options?: { skipHistory?: boolean }
) => void;
type EvaluatedLayer = EvaluatedProjectFrame['layers'][number];

interface UseStageDofFocusOptions {
    stageFrameRef: RefObject<HTMLDivElement | null>;
    containerRef: RefObject<HTMLDivElement | null>;
    frame: EvaluatedProjectFrame;
    frameWidth: number;
    frameHeight: number;
    canvasZoom: number;
    targetAspect: number;
    cameraPose: EvaluatedCameraPose;
    defaultCamera: NonNullable<Project['defaultCamera']>;
    updateShot: UpdateShot;
    beginDragTransaction: () => void;
    commitDragTransaction: () => void;
    cancelDragTransaction: () => void;
    setDofFocusIndicator: (indicator: { x: number; y: number }) => void;
    setDofFocusActive: (active: boolean) => void;
}

function isEditableTarget(target: EventTarget | null): boolean {
    if (!target || !('closest' in target) || typeof target.closest !== 'function') return false;
    const element = target as HTMLElement;
    return element.isContentEditable || Boolean(element.closest('input, textarea, select, [contenteditable="true"]'));
}

function findActiveFocusBlock(blocks: FocusBlock[] | undefined, timeMs: number): FocusBlock | undefined {
    return blocks?.find((block) => {
        const startMs = block.sourceStartMs ?? block.startMs;
        const durationMs = block.sourceDurationMs ?? block.durationMs;
        return timeMs >= startMs && timeMs <= startMs + durationMs;
    });
}

export function useStageDofFocus({
    stageFrameRef,
    containerRef,
    frame,
    frameWidth,
    frameHeight,
    canvasZoom,
    targetAspect,
    cameraPose,
    defaultCamera,
    updateShot,
    beginDragTransaction,
    commitDragTransaction,
    cancelDragTransaction,
    setDofFocusIndicator,
    setDofFocusActive,
}: UseStageDofFocusOptions) {
    const focusDepthRef = useRef(frame.effects.state.depthOfField.target.z);
    const dHeldRef = useRef(false);
    const activeDragCleanupRef = useRef<(() => void) | null>(null);
    const layers = frame.layers;

    useEffect(() => {
        focusDepthRef.current = frame.effects.state.depthOfField.target.z;
    }, [frame.effects.state.depthOfField.target.z]);

    const writeFocusEdit = useCallback((
        edit: { x?: number; y?: number; z: number },
        skipHistory = true
    ) => {
        const previousDepth = focusDepthRef.current;
        const delta = edit.z - previousDepth;
        focusDepthRef.current = edit.z;
        updateShot(frame.activeShot.id, (shot) => {
            const dof = shot.effects.depthOfField ?? frame.effects.state.depthOfField;
            const activeBlock = findActiveFocusBlock(shot.focusBlocks, frame.shotLocalTimeMs);
            return {
                ...shot,
                focusBlocks: activeBlock
                    ? shot.focusBlocks?.map((block) => block.id === activeBlock.id
                        ? { ...block, fromZ: block.fromZ + delta, toZ: block.toZ + delta }
                        : block)
                    : shot.focusBlocks,
                effects: {
                    ...shot.effects,
                    depthOfField: {
                        ...dof,
                        enabled: true,
                        target: {
                            ...dof.target,
                            ...(edit.x === undefined ? {} : { x: edit.x }),
                            ...(edit.y === undefined ? {} : { y: edit.y }),
                            z: activeBlock ? dof.target.z : edit.z,
                        },
                    },
                },
            };
        }, { skipHistory });
    }, [
        frame.activeShot.id,
        frame.effects.state.depthOfField,
        frame.shotLocalTimeMs,
        updateShot,
    ]);

    const withFocusTransaction = useCallback((edit: () => void) => {
        beginDragTransaction();
        try {
            edit();
            commitDragTransaction();
        } catch (error) {
            cancelDragTransaction();
            throw error;
        }
    }, [beginDragTransaction, cancelDragTransaction, commitDragTransaction]);

    const softSnapDepth = useCallback((previousDepth: number, depth: number) => {
        const nearestDepth = frame.layers
            .filter((layer) => layer.visible !== false && Number.isFinite(layer.position.z))
            .map((layer) => layer.position.z)
            .reduce<number | null>((nearest, layerDepth) =>
                nearest === null || Math.abs(layerDepth - depth) < Math.abs(nearest - depth)
                    ? layerDepth
                    : nearest, null);
        if (nearestDepth === null) return depth;
        const distance = nearestDepth - depth;
        if (Math.abs(distance) > 0.12 || Math.abs(distance) >= Math.abs(nearestDepth - previousDepth)) {
            return depth;
        }
        return depth + distance * 0.4;
    }, [frame.layers]);

    const adjustFocusDepth = useCallback((delta: number, skipHistory = false) => {
        const previousDepth = focusDepthRef.current;
        const nextDepth = previousDepth + delta;
        if (skipHistory) {
            writeFocusEdit({ z: nextDepth }, true);
        } else {
            withFocusTransaction(() => writeFocusEdit({ z: nextDepth }, true));
        }
    }, [withFocusTransaction, writeFocusEdit]);

    const adjustDofFocusDepth = useCallback((delta: number, skipHistory = false) => {
        const previousDepth = focusDepthRef.current;
        const nextDepth = softSnapDepth(previousDepth, previousDepth + delta);
        if (skipHistory) {
            writeFocusEdit({ z: nextDepth }, true);
        } else {
            withFocusTransaction(() => writeFocusEdit({ z: nextDepth }, true));
        }
    }, [softSnapDepth, withFocusTransaction, writeFocusEdit]);

    const setFocusDepth = useCallback((depth: number) => {
        withFocusTransaction(() => writeFocusEdit({ z: depth }, true));
    }, [withFocusTransaction, writeFocusEdit]);

    const isDofFocusHeld = useCallback(() => dHeldRef.current, []);

    const focusLayerIfHeld = useCallback((layerId: string): boolean => {
        if (!dHeldRef.current) return false;
        const layer = frame.layers.find((candidate) =>
            candidate.id === layerId && candidate.visible !== false
        );
        if (!layer) return false;
        setFocusDepth(layer.position.z);
        return true;
    }, [frame.layers, setFocusDepth]);

    const focusNextLayerDepth = useCallback((direction: -1 | 1) => {
        const currentDepth = focusDepthRef.current;
        const depths = [...new Set(frame.layers
            .filter((layer) => layer.visible !== false && Number.isFinite(layer.position.z))
            .map((layer) => layer.position.z))]
            .sort((a, b) => a - b);
        const nextDepth = direction > 0
            ? depths.find((depth) => depth > currentDepth + 1e-6)
            : depths.slice().reverse().find((depth) => depth < currentDepth - 1e-6);
        if (nextDepth !== undefined) setFocusDepth(nextDepth);
    }, [frame.layers, setFocusDepth]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (isEditableTarget(event.target)) return;
            if (event.key.toLowerCase() === 'd' || event.code === 'KeyD') {
                dHeldRef.current = true;
                return;
            }
            if (!dHeldRef.current) return;
            const direction = event.code === 'BracketRight' || event.key === ']'
                ? 1
                : event.code === 'BracketLeft' || event.key === '['
                    ? -1
                    : 0;
            if (!direction) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            focusNextLayerDepth(direction);
        };
        const handleKeyUp = (event: KeyboardEvent) => {
            if (event.key.toLowerCase() === 'd' || event.code === 'KeyD') {
                dHeldRef.current = false;
            }
        };
        const handleBlur = () => {
            dHeldRef.current = false;
        };
        window.addEventListener('keydown', handleKeyDown, true);
        window.addEventListener('keyup', handleKeyUp, true);
        window.addEventListener('blur', handleBlur);
        return () => {
            window.removeEventListener('keydown', handleKeyDown, true);
            window.removeEventListener('keyup', handleKeyUp, true);
            window.removeEventListener('blur', handleBlur);
        };
    }, [focusNextLayerDepth]);

    const handlePointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
        if (!dHeldRef.current || event.button !== 0 || !containerRef.current) return;
        const target = event.target as HTMLElement | null;
        if (target?.closest?.('button, [data-focus-marker], [data-depth-handle], [aria-label="Orbit camera controls"]')) {
            return;
        }
        event.preventDefault();
        activeDragCleanupRef.current?.();
        let previousY = event.clientY;
        activeDragCleanupRef.current = createPointerDragLifecycle({
            pointerId: event.pointerId,
            target: containerRef.current,
            begin: beginDragTransaction,
            commit: commitDragTransaction,
            cancel: cancelDragTransaction,
            onMove: (moveEvent) => {
                const deltaY = previousY - moveEvent.clientY;
                previousY = moveEvent.clientY;
                adjustDofFocusDepth(deltaY * (moveEvent.shiftKey ? 0.0005 : 0.005), true);
            },
            onEnd: () => {
                activeDragCleanupRef.current = null;
            },
        });
    }, [adjustDofFocusDepth, beginDragTransaction, cancelDragTransaction, commitDragTransaction, containerRef]);

    useEffect(() => () => activeDragCleanupRef.current?.(), []);

    const handleFocusClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
        const rect = stageFrameRef.current?.getBoundingClientRect();
        if (!rect) return;
        const x = Math.max(0, Math.min(frameWidth, (event.clientX - rect.left) / canvasZoom));
        const y = Math.max(0, Math.min(frameHeight, (event.clientY - rect.top) / canvasZoom));
        const nearestLayer = layers.reduce<{
            layer: EvaluatedLayer | null;
            distance: number;
        }>((nearest, layer) => {
            if (layer.visible === false) return nearest;
            const center = getLayerProjectedCorners(
                layer,
                frameWidth,
                frameHeight,
                targetAspect,
                cameraPose,
                defaultCamera.position.z ?? DEFAULT_CAMERA_Z,
                defaultCamera.focalLength ?? DEFAULT_FOCAL_LENGTH
            ).pCenter;
            const distance = Math.hypot(center.x - x, center.y - y);
            return distance < nearest.distance ? { layer, distance } : nearest;
        }, { layer: null, distance: Infinity }).layer;

        withFocusTransaction(() => writeFocusEdit({
            x: (x / frameWidth - 0.5) * 2,
            y: (0.5 - y / frameHeight) * 2,
            z: nearestLayer?.position.z ?? focusDepthRef.current,
        }));
        setDofFocusIndicator({ x, y });
        setDofFocusActive(false);
    }, [
        cameraPose,
        canvasZoom,
        defaultCamera.focalLength,
        defaultCamera.position.z,
        layers,
        frameHeight,
        frameWidth,
        setDofFocusActive,
        setDofFocusIndicator,
        stageFrameRef,
        targetAspect,
        withFocusTransaction,
        writeFocusEdit,
    ]);

    return {
        adjustFocusDepth,
        adjustDofFocusDepth,
        focusLayerIfHeld,
        handleFocusClick,
        handlePointerDown,
        isDofFocusHeld,
    };
}
