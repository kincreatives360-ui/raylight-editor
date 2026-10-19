// src/stage/webgl/cameraMath.ts
import * as THREE from 'three';
import type { EvaluatedLayerWithEffects } from '../../engine/evaluateShot';
import type { EvaluatedCamera } from '../../engine/evaluateCamera';

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
    evaluatedCamera?: EvaluatedCamera | CameraFraming,
    defaultCamera: DefaultCameraConfig = {
        position: { x: 0, y: 0, z: DEFAULT_CAMERA_Z },
        rotation: { x: 0, y: 0, z: 0 },
        focalLength: DEFAULT_FOCAL_LENGTH,
    },
    aspect: number = 16 / 9
): EvaluatedCameraPose {
    const baseZ = defaultCamera.position?.z ?? DEFAULT_CAMERA_Z;
    const focalLength =
        (evaluatedCamera as EvaluatedCamera)?.focalLength ??
        defaultCamera.focalLength ??
        DEFAULT_FOCAL_LENGTH;
    const fov =
        (evaluatedCamera as EvaluatedCamera)?.fovDegrees ?? focalLengthToFov(focalLength);
    const { planeW, planeH } = getReferencePlaneDimensions(
        aspect,
        baseZ,
        DEFAULT_FOCAL_LENGTH
    );

    const zoom = Math.max(0.15, evaluatedCamera?.zoom ?? 1);
    const targetX = ((evaluatedCamera?.target?.x ?? 0) / 1920) * planeW;
    // Y points UP in world coordinates (1 unit = 1 artboard pixel), and Three.js +Y is UP
    const targetY = ((evaluatedCamera?.target?.y ?? 0) / 1080) * planeH;
    const targetZ = evaluatedCamera?.target?.z ?? 0;

    const rotX =
        (defaultCamera.rotation?.x ?? 0) +
        ((evaluatedCamera as EvaluatedCamera)?.rotation?.x ?? 0);
    const rotY =
        (defaultCamera.rotation?.y ?? 0) +
        ((evaluatedCamera as EvaluatedCamera)?.rotation?.y ?? 0);
    const rotZ =
        (defaultCamera.rotation?.z ?? 0) +
        ((evaluatedCamera as EvaluatedCamera)?.rotation?.z ?? 0);

    const dist = baseZ / zoom;
    const offset = new THREE.Vector3(0, 0, dist);
    if (rotX !== 0 || rotY !== 0 || rotZ !== 0) {
        offset.applyEuler(new THREE.Euler(rotX, rotY, rotZ, 'XYZ'));
    }

    return {
        position: {
            x: (defaultCamera.position?.x ?? 0) + targetX + offset.x,
            y: (defaultCamera.position?.y ?? 0) + targetY + offset.y,
            z: targetZ + offset.z,
        },
        rotation: {
            x: rotX,
            y: rotY,
            z: rotZ,
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

    const rawW = Number.isFinite(evalLayer.size?.width) ? evalLayer.size.width : 0.4;
    const rawH = Number.isFinite(evalLayer.size?.height) ? evalLayer.size.height : 0.3;
    const meshW = Math.max(0.02, rawW * planeW);
    const meshH = Math.max(0.02, rawH * planeH);

    const posX = Number.isFinite(evalLayer.position?.x) ? evalLayer.position.x : 0;
    const posY = Number.isFinite(evalLayer.position?.y) ? evalLayer.position.y : 0;
    const posZ = Number.isFinite(evalLayer.position?.z) ? evalLayer.position.z : 0;

    const worldX = posX * planeW;
    // Invert Y so moving a layer down (+Y in model) moves it down (-Y in Three.js)
    const worldY = -posY * planeH;
    const worldZ = posZ * 0.85;

    return { worldX, worldY, worldZ, meshW, meshH };
}

export function getLayerProjectedCorners(
    evalLayer: EvaluatedLayerWithEffects,
    _camera: THREE.PerspectiveCamera | null | undefined,
    frameWidth: number,
    frameHeight: number,
    aspect: number,
    cameraPose?: EvaluatedCameraPose,
    refCameraZ: number = DEFAULT_CAMERA_Z,
    refFocalLength: number = DEFAULT_FOCAL_LENGTH
) {
    const { worldX, worldY, worldZ, meshW, meshH } = getLayer3DWorldTransform(
        evalLayer,
        aspect,
        refCameraZ,
        refFocalLength
    );

    // Build a deterministic PerspectiveCamera matching the exact current frame state
    const vCam = new THREE.PerspectiveCamera(
        cameraPose?.fov ?? focalLengthToFov(refFocalLength),
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
        vCam.position.set(0, 0, refCameraZ);
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