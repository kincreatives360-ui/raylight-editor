import { useMemo } from 'react';
import type { EvaluatedProjectFrame } from '../engine/evaluateShot';
import type { EvaluatedCamera } from '../engine/evaluateCamera';
import type { Project } from '../model/types';
import { resolveShotBackground } from '../model/types';
import { DEFAULT_CAMERA_Z, DEFAULT_FOCAL_LENGTH, evaluateCameraPose, getLayerProjectedCorners } from './webgl/cameraMath';
import { ASPECT_RATIO_CONFIG } from './stageUtils';

interface ViewportSize {
    width: number;
    height: number;
}

interface UseStageViewportModelOptions {
    project: Project;
    frame: EvaluatedProjectFrame;
    viewportSize: ViewportSize;
    isCameraSelected: boolean;
    activeTool: string;
    isPlaying: boolean;
}

export function useStageViewportModel({
    project,
    frame,
    viewportSize,
    isCameraSelected,
    activeTool,
    isPlaying,
}: UseStageViewportModelOptions) {
    const ratio = ASPECT_RATIO_CONFIG[project.aspectRatio];
    const targetAspect = ratio.widthRatio / ratio.heightRatio;
    const availableAspect = viewportSize.width / viewportSize.height;
    const frameWidth = availableAspect > targetAspect
        ? Math.round(viewportSize.height * targetAspect)
        : viewportSize.width;
    const frameHeight = availableAspect > targetAspect
        ? viewportSize.height
        : Math.round(viewportSize.width / targetAspect);

    const effectiveViewportFrame = useMemo(() => {
        if (!isCameraSelected && activeTool !== 'camera') return frame;
        const designCamera: EvaluatedCamera = {
            target: { x: 0, y: 0, z: 0 },
            rotation: activeTool === 'camera' ? { x: -0.3, y: -0.65, z: 0 } : { x: 0, y: 0, z: 0 },
            zoom: activeTool === 'camera' ? 0.45 : 1,
            fovDegrees: 27.0006,
            focalLength: 50,
            activeMode: 'static',
        };
        return { ...frame, camera: designCamera };
    }, [activeTool, frame, isCameraSelected]);

    const exteriorSilhouettes = useMemo(() => {
        if (isPlaying) return [];
        const defaultCamera = project.defaultCamera || {
            position: { x: 0, y: 0, z: DEFAULT_CAMERA_Z },
            rotation: { x: 0, y: 0, z: 0 },
            focalLength: DEFAULT_FOCAL_LENGTH,
        };
        const cameraPose = evaluateCameraPose(effectiveViewportFrame.camera, defaultCamera, targetAspect);
        const refCameraZ = defaultCamera.position?.z ?? DEFAULT_CAMERA_Z;
        const refFocalLength = defaultCamera.focalLength ?? DEFAULT_FOCAL_LENGTH;
        const silhouettes: { id: string; points: string }[] = [];

        for (const layer of frame.layers) {
            if (layer.visible === false || (layer.opacity ?? 1) <= 0) continue;
            const projection = getLayerProjectedCorners(
                layer,
                frameWidth,
                frameHeight,
                targetAspect,
                cameraPose,
                refCameraZ,
                refFocalLength
            );
            const outside = projection.corners.some(
                (corner) => corner.x < -0.5 || corner.x > frameWidth + 0.5 || corner.y < -0.5 || corner.y > frameHeight + 0.5
            );
            if (!outside) continue;
            silhouettes.push({
                id: layer.id,
                points: projection.corners.map((corner) => `${corner.x.toFixed(1)},${corner.y.toFixed(1)}`).join(' '),
            });
        }
        return silhouettes;
    }, [
        effectiveViewportFrame.camera,
        frame.layers,
        frameHeight,
        frameWidth,
        isPlaying,
        project.defaultCamera,
        targetAspect,
    ]);

    const effectiveBackground = resolveShotBackground(project, frame.activeShot);
    const gradientReferenceCamera = project.defaultCamera || {
        position: { x: 0, y: 0, z: DEFAULT_CAMERA_Z },
        rotation: { x: 0, y: 0, z: 0 },
        focalLength: DEFAULT_FOCAL_LENGTH,
    };
    const gradientCameraPose = evaluateCameraPose(
        effectiveViewportFrame.camera,
        gradientReferenceCamera,
        targetAspect
    );

    return {
        targetAspect,
        frameWidth,
        frameHeight,
        effectiveViewportFrame,
        exteriorSilhouettes,
        effectiveBackground,
        gradientReferenceCamera,
        gradientCameraPose,
    };
}
