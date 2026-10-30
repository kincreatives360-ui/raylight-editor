// Camera math compatibility entry point.
import { DEFAULT_FOCAL_LENGTH, SENSOR_HEIGHT_MM, focalLengthToFov } from '../../engine/evaluateCamera';

export { DEFAULT_FOCAL_LENGTH, SENSOR_HEIGHT_MM, focalLengthToFov };
export * from './cameraTypes';
export * from './cameraPresets';
export * from './cameraMovementPresets';
export * from './cameraGeometry';

/**
 * Smooth logarithmic dolly zoom calculation (Raylight 320ms smoothstep)
 * d(t) = exp(ln(d0) + (ln(d1) - ln(d0)) * t^2 * (3 - 2t))
 */
export function computeLogarithmicDolly(d0: number, d1: number, t: number): number {
    const clampedT = Math.max(0, Math.min(1, t));
    const smoothstep = clampedT * clampedT * (3 - 2 * clampedT);
    const safeD0 = Math.max(0.01, d0);
    const safeD1 = Math.max(0.01, d1);
    const ln0 = Math.log(safeD0);
    const ln1 = Math.log(safeD1);
    return Math.exp(ln0 + (ln1 - ln0) * smoothstep);
}
