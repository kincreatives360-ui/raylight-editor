import { useCallback } from 'react';
import type { EvaluatedProjectFrame } from '../engine/evaluateShot';
import { useProjectStore } from '../store/useProjectStore';

export interface StageCameraPatch {
    orbit?: number;
    tilt?: number;
    roll?: number;
    targetX?: number;
    targetY?: number;
    targetZ?: number;
    zoom?: number;
    focalLength?: number;
}

interface UseStageCameraUpdateOptions {
    frame: EvaluatedProjectFrame;
    selectedCameraBlockId: string | null;
    updateShot: ReturnType<typeof useProjectStore.getState>['updateShot'];
}

export function useStageCameraUpdate({
    frame,
    selectedCameraBlockId,
    updateShot,
}: UseStageCameraUpdateOptions) {
    return useCallback((patch: StageCameraPatch) => {
        const currentShot = frame.activeShot;
        const selectedCameraBlock = currentShot.cameraBlocks?.find(
            (block) => block.id === selectedCameraBlockId
        );

        if (selectedCameraBlock) {
            const midpoint = selectedCameraBlock.startMs + selectedCameraBlock.durationMs / 2;
            const endpoint = frame.shotLocalTimeMs < midpoint ? 'from' : 'to';
            const currentEndpoint = selectedCameraBlock[endpoint] || {
                anchorX: 0,
                anchorY: 0,
                anchorZ: 0,
                zoom: 1,
                roll: 0,
                orbit: 0,
                tilt: 0,
            };

            updateShot(
                currentShot.id,
                (shot) => ({
                    ...shot,
                    cameraBlocks: (shot.cameraBlocks || []).map((block) =>
                        block.id === selectedCameraBlock.id
                            ? {
                                ...block,
                                [endpoint]: {
                                    ...currentEndpoint,
                                    anchorX: patch.targetX !== undefined ? patch.targetX : currentEndpoint.anchorX,
                                    anchorY: patch.targetY !== undefined ? patch.targetY : currentEndpoint.anchorY,
                                    anchorZ: patch.targetZ !== undefined ? patch.targetZ : (currentEndpoint.anchorZ ?? 0),
                                    zoom: patch.zoom !== undefined ? patch.zoom : currentEndpoint.zoom,
                                    focalLength: patch.focalLength !== undefined ? patch.focalLength : currentEndpoint.focalLength,
                                    orbit: patch.orbit !== undefined ? patch.orbit : currentEndpoint.orbit,
                                    tilt: patch.tilt !== undefined ? patch.tilt : currentEndpoint.tilt,
                                    roll: patch.roll !== undefined ? patch.roll : currentEndpoint.roll,
                                },
                            }
                            : block
                    ),
                }),
                { skipHistory: true }
            );
            return;
        }

        updateShot(
            currentShot.id,
            (shot) => {
                const framings = [...(shot.framings || [])];
                const baseFraming = framings[0] || {
                    id: 'default',
                    name: 'Default',
                    target: { x: 0, y: 0, z: 0 },
                    zoom: 1,
                    roll: 0,
                    orbit: 0,
                    tilt: 0,
                };
                const updatedFraming = {
                    ...baseFraming,
                    target: {
                        ...baseFraming.target,
                        x: patch.targetX !== undefined ? patch.targetX : baseFraming.target.x,
                        y: patch.targetY !== undefined ? patch.targetY : baseFraming.target.y,
                        z: patch.targetZ !== undefined ? patch.targetZ : baseFraming.target.z,
                    },
                    zoom: patch.zoom !== undefined ? patch.zoom : baseFraming.zoom,
                    orbit: patch.orbit !== undefined ? patch.orbit : (baseFraming.orbit ?? 0),
                    tilt: patch.tilt !== undefined ? patch.tilt : (baseFraming.tilt ?? 0),
                    roll: patch.roll !== undefined ? patch.roll : (baseFraming.roll ?? 0),
                };

                framings[0] = updatedFraming;
                return { ...shot, framings };
            },
            { skipHistory: true }
        );
    }, [frame.activeShot, frame.shotLocalTimeMs, selectedCameraBlockId, updateShot]);
}
