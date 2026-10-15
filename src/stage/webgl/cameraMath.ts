// src/stage/webgl/cameraMath.ts
import * as THREE from 'three';
import type { EvaluatedLayerWithEffects } from '../../engine/evaluateShot';

export interface CameraFraming {
    id?: string;
    name?: string;
    target: { x: number; y: number; z: number };
    zoom: number;
}

export interface DefaultCameraConfig {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    focalLength: number;
}

export interface EvaluatedCameraPose {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    focalLength: number;
    fov: number;
}

export const DEFAULT_CAMERA_Z = 2.65;
export const DEFAULT_FOCAL_LENGTH = 50;
export const SENSOR_HEIGHT_MM = 24;

export function focalLengthToFov(focalLengthMm: number): number {
    const safeFocal = Math.max(12, Math.min(200, focalLengthMm || DEFAULT_FOCAL_LENGTH));
    return (2 * Math.atan(SENSOR_HEIGHT_MM / (2 * safeFocal)) * 180) / Math.PI;
}

export function getReferencePlaneDimensions(
    aspect: number,
    cameraZ: number = DEFAULT_CAMERA_Z,
    focalLength: number = DEFAULT_FOCAL_LENGTH
): { planeW: number; planeH: number } {
    const fovRad = (focalLengthToFov(focalLength) * Math.PI) / 180;
    const planeH = 2 * cameraZ * Math.tan(fovRad / 2);
    const planeW = planeH * aspect;
    return { planeW, planeH };
}

export function evaluateCameraPose(
    framing?: CameraFraming,
    defaultCamera: DefaultCameraConfig = {
        position: { x: 0, y: 0, z: DEFAULT_CAMERA_Z },
        rotation: { x: 0, y: 0, z: 0 },
        focalLength: DEFAULT_FOCAL_LENGTH,
    },
    aspect: number = 16 / 9
): EvaluatedCameraPose {
    const baseZ = defaultCamera.position?.z ?? DEFAULT_CAMERA_Z;
    const focalLength = defaultCamera.focalLength ?? DEFAULT_FOCAL_LENGTH;
    const fov = focalLengthToFov(focalLength);
    const { planeW, planeH } = getReferencePlaneDimensions(aspect, baseZ, focalLength);

    const zoom = Math.max(0.15, framing?.zoom ?? 1);
    const targetX = (framing?.target?.x ?? 0) * planeW;
    // Invert Y because screen/model +Y is down, whereas Three.js +Y is up
    const targetY = -(framing?.target?.y ?? 0) * planeH;
    const targetZ = framing?.target?.z ?? 0;

    return {
        position: {
            x: (defaultCamera.position?.x ?? 0) + targetX,
            y: (defaultCamera.position?.y ?? 0) + targetY,
            z: baseZ / zoom + targetZ,
        },
        rotation: {
            x: defaultCamera.rotation?.x ?? 0,
            y: defaultCamera.rotation?.y ?? 0,
            z: defaultCamera.rotation?.z ?? 0,
        },
        focalLength,
        fov,
    };
}

export function getLayer3DWorldTransform(
    evalLayer: EvaluatedLayerWithEffects,
    aspect: number,
    cameraZ: number = DEFAULT_CAMERA_Z,
    focalLength: number = DEFAULT_FOCAL_LENGTH
): {
    worldX: number;
    worldY: number;
    worldZ: number;
    meshW: number;
    meshH: number;
} {
    const { planeW, planeH } = getReferencePlaneDimensions(aspect, cameraZ, focalLength);

    const meshW = Math.max(0.02, evalLayer.size.width * planeW);
    const meshH = Math.max(0.02, evalLayer.size.height * planeH);

    const worldX = evalLayer.position.x * planeW;
    // Invert Y so moving a layer down (+Y in model) moves it down (-Y in Three.js)
    const worldY = -evalLayer.position.y * planeH;
    const worldZ = evalLayer.position.z * 0.85;

    return { worldX, worldY, worldZ, meshW, meshH };
}

export function getLayerProjectedCorners(
    evalLayer: EvaluatedLayerWithEffects,
    _camera: THREE.PerspectiveCamera | null | undefined,
    frameWidth: number,
    frameHeight: number,
    aspect: number,
    cameraPose?: EvaluatedCameraPose
) {
    const { worldX, worldY, worldZ, meshW, meshH } = getLayer3DWorldTransform(
        evalLayer,
        aspect,
        DEFAULT_CAMERA_Z,
        DEFAULT_FOCAL_LENGTH
    );

    // Build a deterministic PerspectiveCamera matching the exact current frame state
    const vCam = new THREE.PerspectiveCamera(
        cameraPose?.fov ?? focalLengthToFov(DEFAULT_FOCAL_LENGTH),
        aspect,
        0.05,
        100
    );

    if (cameraPose) {
        vCam.position.set(
            cameraPose.position.x,
            cameraPose.position.y,
            cameraPose.position.z
        );
        vCam.rotation.set(
            cameraPose.rotation.x,
            cameraPose.rotation.y,
            cameraPose.rotation.z
        );
    } else {
        vCam.position.set(0, 0, DEFAULT_CAMERA_Z);
    }
    vCam.updateMatrixWorld(true);
    vCam.updateProjectionMatrix();

    const sx = evalLayer.scale?.x ?? 1;
    const sy = evalLayer.scale?.y ?? 1;
    const hw = (meshW * sx) / 2;
    const hh = (meshH * sy) / 2;

    // Match ThreeLayerObject Euler rotation (invert X and Z so screen pitch & roll match 3D)
    const euler = new THREE.Euler(
        -evalLayer.rotation.x,
        evalLayer.rotation.y,
        -evalLayer.rotation.z,
        'XYZ'
    );
    const centerVec = new THREE.Vector3(worldX, worldY, worldZ);

    const projectLocalPoint = (lx: number, ly: number, lz = 0.016) => {
        const pt = new THREE.Vector3(lx, ly, lz);
        pt.applyEuler(euler);
        pt.add(centerVec);
        pt.project(vCam);
        return {
            x: (pt.x * 0.5 + 0.5) * frameWidth,
            y: (-pt.y * 0.5 + 0.5) * frameHeight,
        };
    };

    const pNW = projectLocalPoint(-hw, hh);
    const pN = projectLocalPoint(0, hh);
    const pNE = projectLocalPoint(hw, hh);
    const pE = projectLocalPoint(hw, 0);
    const pSE = projectLocalPoint(hw, -hh);
    const pS = projectLocalPoint(0, -hh);
    const pSW = projectLocalPoint(-hw, -hh);
    const pW = projectLocalPoint(-hw, 0);
    const pCenter = projectLocalPoint(0, 0);

    const rotOffset = Math.max(0.08, Math.abs(hh) * 0.22);
    const pRot = projectLocalPoint(0, hh + rotOffset);

    return {
        pNW,
        pN,
        pNE,
        pE,
        pSE,
        pS,
        pSW,
        pW,
        pCenter,
        pRot,
        corners: [pNW, pNE, pSE, pSW],
    };
}