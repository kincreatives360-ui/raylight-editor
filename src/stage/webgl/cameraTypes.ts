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

