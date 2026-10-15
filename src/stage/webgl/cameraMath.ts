// src/stage/webgl/cameraMath.ts
// Mathematical formulation for Raylight Camera & Framing Engine

export interface Vec3 {
    x: number;
    y: number;
    z: number;
}

export interface DefaultCameraConfig {
    position: Vec3;
    rotation: Vec3;
    focalLength: number; // in mm, standard 35mm film gauge (e.g. 50mm)
}

export interface FramingAnchor {
    kind?: 'world';
    world?: Vec3;
    x?: number;
    y?: number;
    z?: number;
}

export interface CameraFraming {
    id: string;
    anchor?: FramingAnchor;
    zoom?: number;
    roll?: number; // in degrees
    orbit?: number;
    tilt?: number;
    centerX?: number;
    centerY?: number;
    mode?: 'dolly' | 'zoom' | 'dollyzoom';
}

export interface EvaluatedCameraPose {
    position: Vec3;
    rotation: Vec3;
    focalLength: number;
    fov: number; // in degrees
}

const FILM_GAUGE_HEIGHT = 24; // 35mm full frame sensor height = 24mm

/**
 * Converts 35mm focal length (mm) to Vertical Field of View (degrees)
 */
export function focalLengthToFov(focalLengthMm: number): number {
    const fl = Math.max(8, Math.min(300, focalLengthMm));
    return 2 * Math.atan(FILM_GAUGE_HEIGHT / (2 * fl)) * (180 / Math.PI);
}

/**
 * Computes Camera Z distance based on framing zoom and mode (Dolly vs Zoom vs Dollyzoom)
 * Derived directly from Raylight reverse-engineered formulas
 */
export function calculateCameraZ(
    framing: CameraFraming,
    defaultZ: number
): number {
    const zoom = (framing.zoom && framing.zoom > 0) ? framing.zoom : 1;
    const mode = framing.mode ?? 'dolly';

    if (mode === 'zoom') {
        // Optical Zoom: physical camera position does NOT move in space
        return defaultZ;
    }
    if (mode === 'dollyzoom') {
        // Vertigo effect: camera translates closer and focal length counter-zooms
        return defaultZ / (zoom * zoom);
    }
    // Physical Dolly: camera physically translates closer along Z axis
    return defaultZ / zoom;
}

/**
 * Evaluates the full 3D camera pose (position, rotation, focalLength, fov)
 */
export function evaluateCameraPose(
    framing: CameraFraming | undefined,
    defaultConfig: DefaultCameraConfig = {
        position: { x: 0, y: 0, z: 2.65 },
        rotation: { x: 0, y: 0, z: 0 },
        focalLength: 50,
    },
    viewportAspect: number = 16 / 9
): EvaluatedCameraPose {
    if (!framing) {
        return {
            position: { ...defaultConfig.position },
            rotation: { ...defaultConfig.rotation },
            focalLength: defaultConfig.focalLength,
            fov: focalLengthToFov(defaultConfig.focalLength),
        };
    }

    const zoom = (framing.zoom && framing.zoom > 0) ? framing.zoom : 1;
    const mode = framing.mode ?? 'dolly';
    const rollRad = ((framing.roll ?? 0) * Math.PI) / 180;

    const targetZ = calculateCameraZ(framing, defaultConfig.position.z);

    const focalLength =
        mode === 'zoom'
            ? defaultConfig.focalLength * zoom
            : mode === 'dollyzoom'
                ? defaultConfig.focalLength / zoom
                : defaultConfig.focalLength;

    // Anchor translation
    let anchorX = 0;
    let anchorY = 0;
    if (framing.anchor?.world) {
        anchorX = framing.anchor.world.x;
        anchorY = framing.anchor.world.y;
    } else if (framing.anchor?.x !== undefined && framing.anchor?.y !== undefined) {
        anchorX = framing.anchor.x;
        anchorY = framing.anchor.y;
    } else if (framing.centerX !== undefined && framing.centerY !== undefined) {
        const spreadW = 2 * Math.tan((focalLengthToFov(focalLength) * Math.PI) / 360) * Math.abs(targetZ) * viewportAspect;
        const spreadH = 2 * Math.tan((focalLengthToFov(focalLength) * Math.PI) / 360) * Math.abs(targetZ);
        anchorX = framing.centerX * spreadW;
        anchorY = framing.centerY * spreadH;
    }

    const posX = defaultConfig.position.x + anchorX;
    const posY = defaultConfig.position.y + anchorY;

    return {
        position: { x: posX, y: posY, z: targetZ },
        rotation: {
            x: defaultConfig.rotation.x,
            y: defaultConfig.rotation.y,
            z: defaultConfig.rotation.z + rollRad,
        },
        focalLength,
        fov: focalLengthToFov(focalLength),
    };
}
