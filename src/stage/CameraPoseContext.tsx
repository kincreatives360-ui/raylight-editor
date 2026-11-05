import { createContext, useContext, useMemo } from 'react';
import type { DefaultCameraConfig, EvaluatedCameraPose } from './webgl/cameraTypes';
import { evaluateCameraPose } from './webgl/cameraMath';
import type { EvaluatedProjectFrame } from '../engine/evaluateShot';
import { getAspectRatio } from './stageUtils';
import type { Project } from '../model/types';

interface CameraPoseContextValue {
    cameraPose: EvaluatedCameraPose;
    gradientCameraPose: EvaluatedCameraPose;
    targetAspect: number;
    defaultCamera: DefaultCameraConfig;
    gradientReferenceCamera: DefaultCameraConfig;
    evaluateCustomPose: (defaultCamera?: DefaultCameraConfig) => EvaluatedCameraPose;
}

const CameraPoseContext = createContext<CameraPoseContextValue | null>(null);

export function CameraPoseProvider({
    children,
    project,
    frame,
    viewportSize,
    activeTool,
    isPlaying,
}: {
    children: React.ReactNode;
    project: Project;
    frame: EvaluatedProjectFrame;
    viewportSize: { width: number; height: number };
    activeTool: string;
    isPlaying: boolean;
}) {
    const ratio = getAspectRatio(project.aspectRatio);
    const targetAspect = ratio;

    const effectiveViewportFrame = frame;

    const defaultCamera = useMemo(() => ({
        position: project.defaultCamera?.position ?? { x: 0, y: 0, z: 2.65 },
        rotation: project.defaultCamera?.rotation ?? { x: 0, y: 0, z: 0 },
        focalLength: project.defaultCamera?.focalLength ?? 50,
    }), [project.defaultCamera?.position, project.defaultCamera?.rotation, project.defaultCamera?.focalLength]);

    const gradientReferenceCamera = defaultCamera;

    const cameraPose = useMemo(() => evaluateCameraPose(
        effectiveViewportFrame.camera,
        defaultCamera,
        targetAspect
    ), [effectiveViewportFrame.camera, defaultCamera, targetAspect]);

    const gradientCameraPose = useMemo(() => evaluateCameraPose(
        effectiveViewportFrame.camera,
        gradientReferenceCamera,
        targetAspect
    ), [effectiveViewportFrame.camera, gradientReferenceCamera, targetAspect]);

    const evaluateCustomPose = useMemo(() => (
        (customDefault?: DefaultCameraConfig) => evaluateCameraPose(undefined, customDefault ?? defaultCamera, targetAspect)
    ), [defaultCamera, targetAspect]);

    const value = useMemo(() => ({
        cameraPose,
        gradientCameraPose,
        targetAspect,
        defaultCamera,
        gradientReferenceCamera,
        evaluateCustomPose,
    }), [cameraPose, gradientCameraPose, targetAspect, defaultCamera, gradientReferenceCamera, evaluateCustomPose]);

    return (
        <CameraPoseContext.Provider value={value}>
            {children}
        </CameraPoseContext.Provider>
    );
}

export function useCameraPose() {
    const context = useContext(CameraPoseContext);
    if (!context) {
        throw new Error('useCameraPose must be used within a CameraPoseProvider');
    }
    return context;
}