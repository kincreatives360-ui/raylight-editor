// src/stage/webgl/ViewportCamera.tsx
import React, { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { evaluateCameraPose, type CameraFraming, type DefaultCameraConfig } from './cameraMath';

interface ViewportCameraProps {
    framing?: CameraFraming;
    defaultCamera?: DefaultCameraConfig;
    manualPose?: {
        position: { x: number; y: number; z: number };
        rotation: { x: number; y: number; z: number };
        zoom?: number;
    };
    cameraRef?: React.MutableRefObject<THREE.PerspectiveCamera | null>;
}

export const ViewportCamera: React.FC<ViewportCameraProps> = ({
    framing,
    defaultCamera = {
        position: { x: 0, y: 0, z: 2.65 },
        rotation: { x: 0, y: 0, z: 0 },
        focalLength: 50,
    },
    manualPose,
    cameraRef,
}) => {
    const { camera, size, invalidate } = useThree();
    const internalCamRef = useRef<THREE.PerspectiveCamera | null>(null);

    // Compute evaluated camera pose
    const aspect = size.width / Math.max(size.height, 1);
    const evaluated = evaluateCameraPose(framing, defaultCamera, aspect);

    useEffect(() => {
        if (camera instanceof THREE.PerspectiveCamera) {
            internalCamRef.current = camera;
            if (cameraRef) {
                cameraRef.current = camera;
            }
        }
    }, [camera, cameraRef]);

    useFrame(() => {
        if (!internalCamRef.current) return;
        const cam = internalCamRef.current;

        // Apply position
        if (manualPose?.position) {
            cam.position.set(manualPose.position.x, manualPose.position.y, manualPose.position.z);
        } else {
            cam.position.set(evaluated.position.x, evaluated.position.y, evaluated.position.z);
        }

        // Apply rotation
        if (manualPose?.rotation) {
            cam.rotation.set(manualPose.rotation.x, manualPose.rotation.y, manualPose.rotation.z);
        } else {
            cam.rotation.set(evaluated.rotation.x, evaluated.rotation.y, evaluated.rotation.z);
        }

        // Apply FOV based on focal length
        if (cam.fov !== evaluated.fov) {
            cam.fov = evaluated.fov;
            cam.updateProjectionMatrix();
        }
    });

    // Request render whenever camera parameters change
    useEffect(() => {
        invalidate();
    }, [evaluated, manualPose, invalidate]);

    return null;
};
