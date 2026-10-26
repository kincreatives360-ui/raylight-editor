// src/stage/webgl/cameraMath.ts
import * as THREE from 'three';
import { getPhoneLocalBounds } from './phoneLayout';
import type { EvaluatedLayerWithEffects } from '../../engine/evaluateShot';
import {
    type EvaluatedCamera,
    DEFAULT_FOCAL_LENGTH,
    SENSOR_HEIGHT_MM,
    focalLengthToFov,
} from '../../engine/evaluateCamera';
import type { Framing, ImageLayer, VideoLayer } from '../../model/types';
import { getDeviceFrameMetrics, getDeviceFrameScale, resolveDeviceFrameSettings, SCREEN_PLANE_Z } from '../../model/deviceFrame';

export { DEFAULT_FOCAL_LENGTH, SENSOR_HEIGHT_MM, focalLengthToFov };

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

export type CameraPresetCategory = 'axial' | 'axonometric' | 'cinematic';

export interface CameraPreset {
    id: string;
    name: string;
    category: CameraPresetCategory;
    orbit: number; // Yaw degrees
    tilt: number;  // Pitch degrees
    roll: number;  // Roll degrees
    zoom?: number; // Optional zoom factor
    focalLength?: number; // Lens focal length in mm
    description: string;
}

export const CAMERA_PRESETS: CameraPreset[] = [
    // Axial / Orthogonal Views
    {
        id: 'front',
        name: 'Front',
        category: 'axial',
        orbit: 0,
        tilt: 0,
        roll: 0,
        focalLength: 50,
        description: 'Direct frontal projection (0°, 0°)',
    },
    {
        id: 'back',
        name: 'Back',
        category: 'axial',
        orbit: 180,
        tilt: 0,
        roll: 0,
        focalLength: 50,
        description: 'Reverse rear perspective (180°, 0°)',
    },
    {
        id: 'top',
        name: 'Top',
        category: 'axial',
        orbit: 0,
        tilt: -89,
        roll: 0,
        focalLength: 50,
        description: 'Top-down bird’s-eye view (0°, -89°)',
    },
    {
        id: 'bottom',
        name: 'Bottom',
        category: 'axial',
        orbit: 0,
        tilt: 89,
        roll: 0,
        focalLength: 50,
        description: 'Worm’s-eye perspective looking up (0°, 89°)',
    },
    {
        id: 'left',
        name: 'Left',
        category: 'axial',
        orbit: -90,
        tilt: 0,
        roll: 0,
        focalLength: 50,
        description: 'Left lateral view (-90°, 0°)',
    },
    {
        id: 'right',
        name: 'Right',
        category: 'axial',
        orbit: 90,
        tilt: 0,
        roll: 0,
        focalLength: 50,
        description: 'Right lateral view (90°, 0°)',
    },

    // Axonometric / Spatial Views
    {
        id: 'isometric',
        name: 'Isometric',
        category: 'axonometric',
        orbit: 45,
        tilt: 35.26,
        roll: 0,
        focalLength: 50,
        description: 'True 3D isometric projection (45°, 35°)',
    },
    {
        id: 'dimetric',
        name: '3/4 Studio',
        category: 'axonometric',
        orbit: 35,
        tilt: 20,
        roll: 0,
        focalLength: 50,
        description: 'Standard 3/4 showcase hero view (35°, 20°)',
    },
    {
        id: 'high-angle-iso',
        name: 'High-Angle Iso',
        category: 'axonometric',
        orbit: 45,
        tilt: 55,
        roll: 0,
        focalLength: 50,
        description: 'Elevated spatial layout view (45°, 55°)',
    },

    // Cinematic & Composition Angles
    {
        id: 'hero-low',
        name: 'Hero Low-Angle',
        category: 'cinematic',
        orbit: 18,
        tilt: -16,
        roll: 0,
        focalLength: 28,
        description: 'Imposing upward cinematic shot (18°, -16°, 28mm)',
    },
    {
        id: 'dutch-tilt',
        name: 'Dutch Angle',
        category: 'cinematic',
        orbit: 20,
        tilt: 8,
        roll: -12,
        focalLength: 35,
        description: 'Stylized canted horizon tilt (20°, 8°, -12°, 35mm)',
    },
    {
        id: 'close-up',
        name: 'Close-Up',
        category: 'cinematic',
        orbit: 0,
        tilt: 0,
        roll: 0,
        zoom: 1.8,
        focalLength: 85,
        description: 'Focused macro close-up framing (1.8x, 85mm)',
    },
    {
        id: 'wide-angle',
        name: 'Wide View',
        category: 'cinematic',
        orbit: 0,
        tilt: 0,
        roll: 0,
        zoom: 0.75,
        focalLength: 24,
        description: 'Contextual wide establishing shot (0.75x, 24mm)',
    },
];

export const LENS_PRESETS = [
    { mm: 24, label: '24mm Wide' },
    { mm: 35, label: '35mm Street' },
    { mm: 50, label: '50mm Standard' },
    { mm: 85, label: '85mm Portrait' },
    { mm: 135, label: '135mm Tele' },
] as const;

export function applyCameraPreset<T extends {
    orbit?: number;
    tilt?: number;
    roll?: number;
    zoom?: number;
    presetId?: string;
    focalLength?: number;
}>(
    preset: CameraPreset,
    current: T
): T & { presetId: string; focalLength?: number; zoom?: number } {
    return {
        ...current,
        presetId: preset.id,
        orbit: preset.orbit,
        tilt: preset.tilt,
        roll: preset.roll,
        ...(preset.zoom !== undefined ? { zoom: preset.zoom } : {}),
        ...(preset.focalLength !== undefined ? { focalLength: preset.focalLength } : {}),
    };
}

export function detectMatchingPreset(
    endpoint: { presetId?: string; orbit?: number; tilt?: number; roll?: number; zoom?: number; focalLength?: number } | null | undefined,
    tolerance: number = 0.5
): CameraPreset | null {
    if (!endpoint) return null;
    if (endpoint.presetId) {
        const found = CAMERA_PRESETS.find((p) => p.id === endpoint.presetId);
        if (found) return found;
    }
    const epOrbit = endpoint.orbit ?? 0;
    const epTilt = endpoint.tilt ?? 0;
    const epRoll = endpoint.roll ?? 0;
    const epZoom = endpoint.zoom;

    // Check zoom-specific presets first if endpoint defines a distinct zoom
    if (epZoom !== undefined) {
        const zoomMatch = CAMERA_PRESETS.find((preset) => {
            if (preset.zoom === undefined) return false;
            const dOrbit = Math.abs(preset.orbit - epOrbit);
            const dTilt = Math.abs(preset.tilt - epTilt);
            const dRoll = Math.abs(preset.roll - epRoll);
            const dZoom = Math.abs(preset.zoom - epZoom);
            return dOrbit <= tolerance && dTilt <= tolerance && dRoll <= tolerance && dZoom <= 0.15;
        });
        if (zoomMatch) return zoomMatch;
    }

    // Otherwise match standard orientation presets without zoom requirement
    for (const preset of CAMERA_PRESETS) {
        if (preset.zoom !== undefined) continue;
        const dOrbit = Math.abs(preset.orbit - epOrbit);
        const dTilt = Math.abs(preset.tilt - epTilt);
        const dRoll = Math.abs(preset.roll - epRoll);
        if (dOrbit <= tolerance && dTilt <= tolerance && dRoll <= tolerance) {
            return preset;
        }
    }
    return null;
}

export interface CameraFramingTarget {
    anchorX: number; // in artboard pixels (relative to artboard center)
    anchorY: number; // in artboard pixels (relative to artboard center, +Y is up)
    zoom: number;    // ideal zoom level
}

export type FramableLayer = {
    position?: { x: number; y: number; z?: number };
    size?: { width: number; height: number };
    scale?: { x: number; y: number; z?: number };
};

/**
 * Calculates ideal camera framing (anchorX, anchorY, zoom) to fit a layer or multiple layers into view.
 * Works seamlessly for both 2D artboard framing and 3D camera pose.
 */
export function calculateLayersBoundingFraming(
    layers: FramableLayer[],
    artboardDimensions: { width: number; height: number } = { width: 1920, height: 1080 },
    paddingRatio: number = 1.25
): CameraFramingTarget {
    if (!layers || layers.length === 0) {
        return { anchorX: 0, anchorY: 0, zoom: 1 };
    }

    const { width: artboardW, height: artboardH } = artboardDimensions;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const el of layers) {
        const pos = el.position;
        const size = el.size;
        const posX = pos && Number.isFinite(pos.x) ? pos.x : 0;
        const posY = pos && Number.isFinite(pos.y) ? pos.y : 0;
        const rawW = size && Number.isFinite(size.width) ? size.width : 0.4;
        const rawH = size && Number.isFinite(size.height) ? size.height : 0.3;
        const scaleX = Math.abs(el.scale?.x ?? 1);
        const scaleY = Math.abs(el.scale?.y ?? 1);

        const halfW = (rawW * scaleX) / 2;
        const halfH = (rawH * scaleY) / 2;

        minX = Math.min(minX, posX - halfW);
        maxX = Math.max(maxX, posX + halfW);
        minY = Math.min(minY, posY - halfH);
        maxY = Math.max(maxY, posY + halfH);
    }

    if (!Number.isFinite(minX) || !Number.isFinite(maxX)) {
        return { anchorX: 0, anchorY: 0, zoom: 1 };
    }

    const centerNormX = (minX + maxX) / 2;
    const centerNormY = (minY + maxY) / 2;
    const spanNormX = Math.max(0.01, maxX - minX);
    const spanNormY = Math.max(0.01, maxY - minY);

    // Convert normalized position to artboard coordinates:
    // posX=0 is center. Model +Y is downward, while 3D world/anchor +Y is upward.
    const anchorX = Math.round(centerNormX * artboardW) || 0;
    const anchorY = Math.round(-centerNormY * artboardH) || 0;

    // Calculate zoom needed to contain the bounds with comfortable padding
    const safePadding = Math.max(1.05, paddingRatio);
    const zoomX = 1 / (spanNormX * safePadding);
    const zoomY = 1 / (spanNormY * safePadding);
    const idealZoom = Math.min(zoomX, zoomY);
    const zoom = Number(Math.max(0.2, Math.min(5.0, idealZoom)).toFixed(2));

    return { anchorX, anchorY, zoom };
}

export function calculateLayerFraming(
    layer: FramableLayer,
    artboardDimensions?: { width: number; height: number },
    paddingRatio: number = 1.25
): CameraFramingTarget {
    return calculateLayersBoundingFraming([layer], artboardDimensions, paddingRatio);
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
        const rotX = evalLayer.rotation.x;
        const rotY = evalLayer.rotation.y;
        const isPlanar = Math.abs(rotX) < 0.001 && Math.abs(rotY) < 0.001;

        if (isPlanar) {
            const frontZ = SCREEN_PLANE_Z * (scale.z || 1);
            const pNW = projectLocalPoint(volume.min.x * scale.x, volume.max.y * scale.y, frontZ);
            const pNE = projectLocalPoint(volume.max.x * scale.x, volume.max.y * scale.y, frontZ);
            const pSE = projectLocalPoint(volume.max.x * scale.x, volume.min.y * scale.y, frontZ);
            const pSW = projectLocalPoint(volume.min.x * scale.x, volume.min.y * scale.y, frontZ);
            const pN = { x: (pNW.x + pNE.x) / 2, y: (pNW.y + pNE.y) / 2 };
            const pE = { x: (pNE.x + pSE.x) / 2, y: (pNE.y + pSE.y) / 2 };
            const pS = { x: (pSW.x + pSE.x) / 2, y: (pSW.y + pSE.y) / 2 };
            const pW = { x: (pNW.x + pSW.x) / 2, y: (pNW.y + pSW.y) / 2 };
            const pCenter = projectLocalPoint(0, 0, frontZ);

            const topEdgeDx = pNE.x - pNW.x;
            const topEdgeDy = pNE.y - pNW.y;
            const edgeLen = Math.hypot(topEdgeDx, topEdgeDy) || 1;
            const perpX = -topEdgeDy / edgeLen;
            const perpY = topEdgeDx / edgeLen;
            const rotDist = 28;
            const pRot = {
                x: pN.x + perpX * rotDist,
                y: pN.y + perpY * rotDist,
            };

            return {
                pNW, pNE, pSE, pSW,
                pN, pE, pS, pW,
                pCenter,
                pRot,
                corners: [pNW, pNE, pSE, pSW],
            };
        }

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
