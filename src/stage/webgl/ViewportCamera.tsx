// src/stage/webgl/ViewportCamera.tsx
import React, { useEffect, useLayoutEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { EvaluatedCamera } from '../../engine/evaluateCamera';
import {
    DEFAULT_CAMERA_Z,
    DEFAULT_FOCAL_LENGTH,
    getReferencePlaneDimensions,
    type DefaultCameraConfig,
} from './cameraMath';

interface ViewportCameraProps {
    evaluatedCamera: EvaluatedCamera;
    defaultCamera?: DefaultCameraConfig;
    cameraRef?: React.MutableRefObject<THREE.PerspectiveCamera | null>;
}

export const ViewportCamera: React.FC<ViewportCameraProps> = ({
    evaluatedCamera,
    defaultCamera = {
        position: { x: 0, y: 0, z: DEFAULT_CAMERA_Z },
        rotation: { x: 0, y: 0, z: 0 },
        focalLength: DEFAULT_FOCAL_LENGTH,
    },
    cameraRef,
}) => {
    const { camera, size, invalidate } = useThree();
    const aspect = size.width / Math.max(size.height, 1);

    const baseZ = defaultCamera.position?.z ?? DEFAULT_CAMERA_Z;
    const focalLength =
        evaluatedCamera.focalLength ??
        defaultCamera.focalLength ??
        DEFAULT_FOCAL_LENGTH;

    const { planeW, planeH } = getReferencePlaneDimensions(
        aspect,
        baseZ,
        DEFAULT_FOCAL_LENGTH
    );

    const zoom = Math.max(0.15, evaluatedCamera.zoom || 1);
    const camX =
        (defaultCamera.position?.x ?? 0) + evaluatedCamera.target.x * planeW;
    const camY =
        (defaultCamera.position?.y ?? 0) - evaluatedCamera.target.y * planeH;
    const camZ = baseZ / zoom + (evaluatedCamera.target.z || 0);
    const camFov = evaluatedCamera.fovDegrees || 27.0006;

    useLayoutEffect(() => {
        if (camera instanceof THREE.PerspectiveCamera) {
            camera.position.set(camX, camY, camZ);
            camera.rotation.set(
                (defaultCamera.rotation?.x ?? 0) + evaluatedCamera.rotation.x,
                (defaultCamera.rotation?.y ?? 0) + evaluatedCamera.rotation.y,
                (defaultCamera.rotation?.z ?? 0) + evaluatedCamera.rotation.z
            );
            if (Math.abs(camera.fov - camFov) > 0.001) {
                camera.fov = camFov;
            }
            camera.updateMatrixWorld(true);
            camera.updateProjectionMatrix();

            if (cameraRef) {
                cameraRef.current = camera;
            }
            invalidate();
        }
    }, [
        camera,
        camX,
        camY,
        camZ,
        camFov,
        evaluatedCamera.rotation.x,
        evaluatedCamera.rotation.y,
        evaluatedCamera.rotation.z,
        defaultCamera.rotation?.x,
        defaultCamera.rotation?.y,
        defaultCamera.rotation?.z,
        cameraRef,
        invalidate,
    ]);

    useEffect(() => {
        invalidate();
    }, [camX, camY, camZ, camFov, invalidate]);

    return null;
};