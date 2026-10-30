import { useCallback, type MouseEvent, type RefObject } from 'react';
import type { EvaluatedProjectFrame } from '../engine/evaluateShot';
import type { Project } from '../model/types';
import type { EvaluatedCameraPose } from './webgl/cameraMath';
import { DEFAULT_CAMERA_Z, DEFAULT_FOCAL_LENGTH, getLayerProjectedCorners } from './webgl/cameraMath';

interface UseStageDofFocusOptions {
    stageFrameRef: RefObject<HTMLDivElement | null>;
    frame: EvaluatedProjectFrame;
    frameWidth: number;
    frameHeight: number;
    canvasZoom: number;
    targetAspect: number;
    cameraPose: EvaluatedCameraPose;
    defaultCamera: NonNullable<Project['defaultCamera']>;
    updateShot: (shotId: string, updater: (shot: Project['shots'][number]) => Project['shots'][number]) => void;
    setDofFocusIndicator: (indicator: { x: number; y: number }) => void;
    setDofFocusActive: (active: boolean) => void;
}

export function useStageDofFocus({
    stageFrameRef,
    frame,
    frameWidth,
    frameHeight,
    canvasZoom,
    targetAspect,
    cameraPose,
    defaultCamera,
    updateShot,
    setDofFocusIndicator,
    setDofFocusActive,
}: UseStageDofFocusOptions) {
    return useCallback((event: MouseEvent<HTMLDivElement>) => {
        const rect = stageFrameRef.current?.getBoundingClientRect();
        if (!rect) return;

        const x = Math.max(0, Math.min(frameWidth, (event.clientX - rect.left) / canvasZoom));
        const y = Math.max(0, Math.min(frameHeight, (event.clientY - rect.top) / canvasZoom));
        const nearestLayer = frame.layers.reduce<{
            layer: (typeof frame.layers)[number] | null;
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

        updateShot(frame.activeShot.id, (shot) => ({
            ...shot,
            effects: {
                ...shot.effects,
                depthOfField: {
                    ...shot.effects.depthOfField,
                    target: {
                        x: (x / frameWidth - 0.5) * 2,
                        y: (0.5 - y / frameHeight) * 2,
                        z: nearestLayer?.position.z ?? shot.effects.depthOfField.target.z,
                    },
                },
            },
        }));
        setDofFocusIndicator({ x, y });
        setDofFocusActive(false);
    }, [
        cameraPose,
        canvasZoom,
        defaultCamera.focalLength,
        defaultCamera.position.z,
        frame,
        frameHeight,
        frameWidth,
        setDofFocusActive,
        setDofFocusIndicator,
        stageFrameRef,
        targetAspect,
        updateShot,
    ]);
}
