// src/stage/lightingMath.ts
import * as THREE from 'three';
import {
    DEFAULT_CAMERA_Z,
    DEFAULT_FOCAL_LENGTH,
    focalLengthToFov,
    type EvaluatedCameraPose,
} from './webgl/cameraMath';

export const LIGHT_SCALE_X = 6;
export const LIGHT_SCALE_Y = 6;
export const LIGHT_SCALE_Z = 5;

export interface ScreenPoint {
    x: number;
    y: number;
    inFront: boolean;
}

export interface Vec3Like {
    x: number;
    y: number;
    z: number;
}

/**
 * Converts light coordinates (normalized/rig space) to 3D world coordinates.
 * Matches SceneLighting.tsx scale factors: X*6, Y*6, Z*5.
 */
export function lightToWorld(pos: Vec3Like): THREE.Vector3 {
    return new THREE.Vector3(
        pos.x * LIGHT_SCALE_X,
        pos.y * LIGHT_SCALE_Y,
        pos.z * LIGHT_SCALE_Z
    );
}

/**
 * Converts 3D world coordinates back to light rig coordinates.
 */
export function worldToLight(world: Vec3Like): Vec3Like {
    return {
        x: world.x / LIGHT_SCALE_X,
        y: world.y / LIGHT_SCALE_Y,
        z: world.z / LIGHT_SCALE_Z,
    };
}

/**
 * Creates a deterministic Three.js perspective camera matching current stage camera state.
 */
export function createVirtualCamera(
    cameraPose?: EvaluatedCameraPose,
    aspect: number = 16 / 9,
    refCameraZ: number = DEFAULT_CAMERA_Z,
    refFocalLength: number = DEFAULT_FOCAL_LENGTH
): THREE.PerspectiveCamera {
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
    return vCam;
}

/**
 * Projects a 3D world position onto 2D stage screen coordinates.
 */
export function projectWorldToScreen(
    worldPos: THREE.Vector3 | Vec3Like,
    camera: THREE.PerspectiveCamera,
    frameWidth: number,
    frameHeight: number
): ScreenPoint {
    const pt = new THREE.Vector3(worldPos.x, worldPos.y, worldPos.z);
    pt.project(camera);
    return {
        x: (pt.x * 0.5 + 0.5) * frameWidth,
        y: (-pt.y * 0.5 + 0.5) * frameHeight,
        inFront: pt.z < 1,
    };
}

/**
 * Projects a light's rig position onto 2D stage screen coordinates.
 */
export function projectLightToScreen(
    lightPos: Vec3Like,
    cameraPose?: EvaluatedCameraPose,
    frameWidth: number = 1920,
    frameHeight: number = 1080,
    aspect: number = 16 / 9
): ScreenPoint {
    const camera = createVirtualCamera(cameraPose, aspect);
    const world = lightToWorld(lightPos);
    return projectWorldToScreen(world, camera, frameWidth, frameHeight);
}

/**
 * Unprojects a screen point back to a 3D world plane at Z = planeZ.
 */
export function unprojectScreenToWorldPlane(
    screenX: number,
    screenY: number,
    planeZ: number,
    camera: THREE.PerspectiveCamera,
    frameWidth: number,
    frameHeight: number
): THREE.Vector3 {
    const ndcX = (screenX / frameWidth) * 2 - 1;
    const ndcY = -(screenY / frameHeight) * 2 + 1;

    const nearPoint = new THREE.Vector3(ndcX, ndcY, -1).unproject(camera);
    const farPoint = new THREE.Vector3(ndcX, ndcY, 1).unproject(camera);
    const dir = farPoint.sub(nearPoint).normalize();

    if (Math.abs(dir.z) < 1e-6) {
        return new THREE.Vector3(nearPoint.x, nearPoint.y, planeZ);
    }

    const t = (planeZ - nearPoint.z) / dir.z;
    return nearPoint.add(dir.multiplyScalar(t));
}

/**
 * Maps a 2D screen drag delta (dx, dy) to a light rig coordinate delta.
 */
export function unprojectScreenDeltaToLightDelta(
    deltaX: number,
    deltaY: number,
    currentLightPos: Vec3Like,
    cameraPose: EvaluatedCameraPose | undefined,
    frameWidth: number,
    frameHeight: number,
    aspect: number
): { dx: number; dy: number } {
    const camera = createVirtualCamera(cameraPose, aspect);
    const worldPos = lightToWorld(currentLightPos);
    const currentScreen = projectWorldToScreen(worldPos, camera, frameWidth, frameHeight);

    const nextScreenX = currentScreen.x + deltaX;
    const nextScreenY = currentScreen.y + deltaY;

    const nextWorld = unprojectScreenToWorldPlane(
        nextScreenX,
        nextScreenY,
        worldPos.z,
        camera,
        frameWidth,
        frameHeight
    );

    const nextLight = worldToLight(nextWorld);
    return {
        dx: nextLight.x - currentLightPos.x,
        dy: nextLight.y - currentLightPos.y,
    };
}

export interface SpotConeOverlayResult {
    sourceScreen: ScreenPoint;
    targetScreen: ScreenPoint;
    rimPoints: ScreenPoint[];
    rimRadiusScreen: number;
}

/**
 * Calculates screen coordinates for Spot light cone boundary, target handle, and rim points.
 */
export function calculateSpotConeOverlay(
    source: Vec3Like,
    target: Vec3Like,
    angle: number,
    cameraPose?: EvaluatedCameraPose,
    frameWidth: number = 1920,
    frameHeight: number = 1080,
    aspect: number = 16 / 9
): SpotConeOverlayResult {
    const camera = createVirtualCamera(cameraPose, aspect);
    const pSrc = lightToWorld(source);
    const pTgt = lightToWorld(target);

    const sourceScreen = projectWorldToScreen(pSrc, camera, frameWidth, frameHeight);
    const targetScreen = projectWorldToScreen(pTgt, camera, frameWidth, frameHeight);

    const dir = new THREE.Vector3().subVectors(pTgt, pSrc);
    const dist = Math.max(0.1, dir.length());
    dir.normalize();

    const safeAngle = Math.max(0.05, Math.min(Math.PI / 2 - 0.05, angle || Math.PI / 6));
    const rimRadiusWorld = dist * Math.tan(safeAngle);

    // Compute orthogonal basis
    const up = Math.abs(dir.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
    const tangent = new THREE.Vector3().crossVectors(dir, up).normalize();
    const bitangent = new THREE.Vector3().crossVectors(dir, tangent).normalize();

    const steps = 16;
    const rimPoints: ScreenPoint[] = [];

    for (let i = 0; i < steps; i++) {
        const theta = (i / steps) * Math.PI * 2;
        const pt = pTgt
            .clone()
            .addScaledVector(tangent, Math.cos(theta) * rimRadiusWorld)
            .addScaledVector(bitangent, Math.sin(theta) * rimRadiusWorld);
        rimPoints.push(projectWorldToScreen(pt, camera, frameWidth, frameHeight));
    }

    const firstRim = rimPoints[0];
    const rimRadiusScreen = Math.hypot(firstRim.x - targetScreen.x, firstRim.y - targetScreen.y);

    return {
        sourceScreen,
        targetScreen,
        rimPoints,
        rimRadiusScreen,
    };
}

export interface AreaRectOverlayResult {
    centerScreen: ScreenPoint;
    targetScreen?: ScreenPoint;
    corners: ScreenPoint[];
}

/**
 * Calculates screen coordinates for Area light rectangle corners and center.
 */
export function calculateAreaRectOverlay(
    position: Vec3Like,
    target?: Vec3Like,
    width: number = 3,
    height: number = 3,
    cameraPose?: EvaluatedCameraPose,
    frameWidth: number = 1920,
    frameHeight: number = 1080,
    aspect: number = 16 / 9
): AreaRectOverlayResult {
    const camera = createVirtualCamera(cameraPose, aspect);
    const pCenter = lightToWorld(position);
    const centerScreen = projectWorldToScreen(pCenter, camera, frameWidth, frameHeight);

    let targetScreen: ScreenPoint | undefined;
    const dir = new THREE.Vector3(0, 0, -1);

    if (target) {
        const pTgt = lightToWorld(target);
        targetScreen = projectWorldToScreen(pTgt, camera, frameWidth, frameHeight);
        dir.subVectors(pTgt, pCenter);
        if (dir.lengthSq() > 1e-4) {
            dir.normalize();
        } else {
            dir.set(0, 0, -1);
        }
    }

    const up = Math.abs(dir.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const tangent = new THREE.Vector3().crossVectors(dir, up).normalize();
    const bitangent = new THREE.Vector3().crossVectors(tangent, dir).normalize();

    const hw = (width || 3) / 2;
    const hh = (height || 3) / 2;

    const corners: ScreenPoint[] = [
        projectWorldToScreen(
            pCenter.clone().addScaledVector(tangent, -hw).addScaledVector(bitangent, hh),
            camera,
            frameWidth,
            frameHeight
        ),
        projectWorldToScreen(
            pCenter.clone().addScaledVector(tangent, hw).addScaledVector(bitangent, hh),
            camera,
            frameWidth,
            frameHeight
        ),
        projectWorldToScreen(
            pCenter.clone().addScaledVector(tangent, hw).addScaledVector(bitangent, -hh),
            camera,
            frameWidth,
            frameHeight
        ),
        projectWorldToScreen(
            pCenter.clone().addScaledVector(tangent, -hw).addScaledVector(bitangent, -hh),
            camera,
            frameWidth,
            frameHeight
        ),
    ];

    return {
        centerScreen,
        targetScreen,
        corners,
    };
}

export interface PointReachOverlayResult {
    centerScreen: ScreenPoint;
    edgeScreen: ScreenPoint;
    radiusScreen: number;
}

/**
 * Calculates screen coordinates for Point light reach radius and edge handle.
 */
export function calculatePointReachOverlay(
    position: Vec3Like,
    distance: number = 5,
    cameraPose?: EvaluatedCameraPose,
    frameWidth: number = 1920,
    frameHeight: number = 1080,
    aspect: number = 16 / 9
): PointReachOverlayResult {
    const camera = createVirtualCamera(cameraPose, aspect);
    const pCenter = lightToWorld(position);
    const pEdge = pCenter.clone().add(new THREE.Vector3(Math.max(0.2, distance || 5), 0, 0));

    const centerScreen = projectWorldToScreen(pCenter, camera, frameWidth, frameHeight);
    const edgeScreen = projectWorldToScreen(pEdge, camera, frameWidth, frameHeight);
    const radiusScreen = Math.hypot(edgeScreen.x - centerScreen.x, edgeScreen.y - centerScreen.y);

    return {
        centerScreen,
        edgeScreen,
        radiusScreen,
    };
}
