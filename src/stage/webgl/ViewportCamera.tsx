// src/stage/webgl/ViewportCamera.tsx
import React, { useEffect, useLayoutEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { EvaluatedCamera } from '../../engine/evaluateCamera';
import {
    DEFAULT_CAMERA_Z,
    DEFAULT_FOCAL_LENGTH,
    evaluateCameraPose,
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

    const pose = evaluateCameraPose(evaluatedCamera, defaultCamera, aspect);

    // R3F exposes Three.js camera as a mutable external object; applying the evaluated pose here is intentional.
    // eslint-disable-next-line react-hooks/immutability
    useLayoutEffect(() => {
        if (camera instanceof THREE.PerspectiveCamera) {
            camera.position.set(pose.position.x, pose.position.y, pose.position.z);
            camera.rotation.set(
                pose.rotation.x,
                pose.rotation.y,
                pose.rotation.z
            );
            if (Math.abs(camera.fov - pose.fov) > 0.001) {
                // eslint-disable-next-line react-hooks/immutability
                camera.fov = pose.fov;
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
        pose.position.x,
        pose.position.y,
        pose.position.z,
        pose.rotation.x,
        pose.rotation.y,
        pose.rotation.z,
        pose.fov,
        cameraRef,
        invalidate,
    ]);

    useEffect(() => {
        invalidate();
    }, [pose.position.x, pose.position.y, pose.position.z, pose.fov, invalidate]);

    return null;
};
