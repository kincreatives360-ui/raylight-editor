// src/stage/webgl/cameraMath.ts
import * as THREE from 'three';
import { getPhoneLocalBounds } from './phoneLayout';
import type { EvaluatedLayerWithEffects } from '../../engine/evaluateShot';
import type { EvaluatedCamera } from '../../engine/evaluateCamera';
import type { Framing, ImageLayer, VideoLayer } from '../../model/types';
import { getDeviceFrameMetrics, getDeviceFrameScale, resolveDeviceFrameSettings, SCREEN_PLANE_Z } from '../../model/deviceFrame';

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
    evaluatedCamera?: EvaluatedCamera | Framing,
    defaultCamera: DefaultCameraConfig = {
        position: { x: 0, y: 0, z: DEFAULT_CAMERA_Z },
        rotation: { x: 0, y: 0, z: 0 },
        focalLength: DEFAULT_FOCAL_LENGTH,
    },
    aspect: number = 16 / 9,
    artboardDimensions?: { width: number; height: number }
): EvaluatedCameraPose {
    const baseZ = defaultCamera.position?.z ?? DEFAULT_CAMERA_Z;
    const isStatic = (evaluatedCamera as EvaluatedCamera)?.activeMode === 'static' || !(evaluatedCamera as EvaluatedCamera)?.activeMode;
    const focalLength = isStatic && defaultCamera.focalLength
        ? defaultCamera.focalLength
        : ((evaluatedCamera as EvaluatedCamera)?.focalLength ?? defaultCamera.focalLength ?? DEFAULT_FOCAL_LENGTH);
    const fov = isStatic && defaultCamera.focalLength
        ? focalLengthToFov(defaultCamera.focalLength)
        : ((evaluatedCamera as EvaluatedCamera)?.fovDegrees ?? focalLengthToFov(focalLength));
    const { planeW, planeH } = getReferencePlaneDimensions(
        aspect,
        baseZ,
        DEFAULT_FOCAL_LENGTH
    );

    const artboardW =
        artboardDimensions?.width ??
        (aspect >= 1 ? 1920 : Math.round((1920 * aspect) / 2) * 2);
    const artboardH =
        artboardDimensions?.height ??
        (aspect >= 1 ? Math.round(1920 / aspect / 2) * 2 : 1920);

    const zoom = Math.max(0.15, evaluatedCamera?.zoom ?? 1);
    const targetX = ((evaluatedCamera?.target?.x ?? 0) / artboardW) * planeW;
    // Y points UP in world coordinates (1 unit = 1 artboard pixel), and Three.js +Y is UP
    const targetY = ((evaluatedCamera?.target?.y ?? 0) / artboardH) * planeH;
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

export function getLayerRenderLayout(
    evalLayer: EvaluatedLayerWithEffects,
    aspect: number,
    cameraZ: number = DEFAULT_CAMERA_Z,
    focalLength: number = DEFAULT_FOCAL_LENGTH
) {
    const transform = getLayer3DWorldTransform(evalLayer, aspect, cameraZ, focalLength);
    const raw = (evalLayer.layer.kind === 'image' || evalLayer.layer.kind === 'video')
        ? (evalLayer.layer as ImageLayer | VideoLayer).deviceFrame
        : undefined;
    const deviceSettings = raw?.enabled ? resolveDeviceFrameSettings(raw) : null;
    const frameMetrics = deviceSettings ? getDeviceFrameMetrics(transform.meshW, transform.meshH, deviceSettings) : null;
    const scale = getDeviceFrameScale(deviceSettings, evalLayer.scale ?? { x: 1, y: 1, z: 1 });
    return {
        ...transform,
        meshW: frameMetrics?.screenWidth ?? transform.meshW,
        meshH: frameMetrics?.screenHeight ?? transform.meshH,
        deviceSettings,
        frameMetrics,
        scale,
    };
}

export function getLayerProjectedCorners(
    evalLayer: EvaluatedLayerWithEffects,
    frameWidth: number,
    frameHeight: number,
    aspect: number,
    cameraPose?: EvaluatedCameraPose,
    refCameraZ: number = DEFAULT_CAMERA_Z,
    refFocalLength: number = DEFAULT_FOCAL_LENGTH,
    bounds: 'body' | 'screen' = 'body'
) {
    const { worldX, worldY, worldZ, meshW, meshH, frameMetrics, deviceSettings, scale } = getLayerRenderLayout(
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

    const sx = scale.x;
    const sy = scale.y;
    const hw = ((bounds === 'body' ? frameMetrics?.bodyWidth : undefined) ?? meshW) * sx / 2;
    const hh = ((bounds === 'body' ? frameMetrics?.bodyHeight : undefined) ?? meshH) * sy / 2;

    // Match ThreeLayerObject Euler rotation (invert X and Z so screen pitch & roll match 3D)
    const euler = new THREE.Euler(
        -evalLayer.rotation.x,
        evalLayer.rotation.y,
        -evalLayer.rotation.z,
        'XYZ'
    );
    const centerVec = new THREE.Vector3(worldX, worldY, worldZ);

    const projectLocalPoint = (lx: number, ly: number, lz = SCREEN_PLANE_Z * (scale.z || 1)) => {
        const pt = new THREE.Vector3(lx, ly, lz);
        pt.applyEuler(euler);
        pt.add(centerVec);
        pt.project(vCam);
        return {
            x: (pt.x * 0.5 + 0.5) * frameWidth,
            y: (-pt.y * 0.5 + 0.5) * frameHeight,
        };
    };

    if (bounds === 'body' && frameMetrics && deviceSettings) {
        const volume = getPhoneLocalBounds(frameMetrics, deviceSettings);
        const projected = [];
        for (const x of [volume.min.x, volume.max.x])
            for (const y of [volume.min.y, volume.max.y])
                for (const z of [volume.min.z, volume.max.z])
                    projected.push(projectLocalPoint(x * scale.x, y * scale.y, z * scale.z));
        const left = Math.min(...projected.map(p => p.x));
        const right = Math.max(...projected.map(p => p.x));
        const top = Math.min(...projected.map(p => p.y));
        const bottom = Math.max(...projected.map(p => p.y));
        const midX = (left + right) / 2, midY = (top + bottom) / 2;
        const pNW = { x: left, y: top }, pNE = { x: right, y: top };
        const pSE = { x: right, y: bottom }, pSW = { x: left, y: bottom };
        return {
            pNW, pNE, pSE, pSW,
            pN: { x: midX, y: top }, pE: { x: right, y: midY },
            pS: { x: midX, y: bottom }, pW: { x: left, y: midY },
            pCenter: projectLocalPoint(0, 0),
            pRot: { x: midX, y: top - Math.max(24, (bottom - top) * 0.11) },
            corners: convexHull(projected),
        };
    }

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

/** Silhouette of the projected bounding volume, including side/rear surfaces. */
function convexHull(points: { x: number; y: number }[]) {
    const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
    const cross = (a: typeof points[number], b: typeof a, c: typeof a) =>
        (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    const half = (input: typeof points) => {
        const result: typeof points = [];
        for (const point of input) {
            while (result.length >= 2 && cross(result[result.length - 2], result[result.length - 1], point) <= 0) result.pop();
            result.push(point);
        }
        return result.slice(0, -1);
    };
    return [...half(sorted), ...half([...sorted].reverse())];
}
