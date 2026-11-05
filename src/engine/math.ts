// src/engine/math.ts
// Shared math utilities for the evaluation engine

/**
 * Linear interpolation between a and b.
 * @param a Start value
 * @param b End value
 * @param t Interpolation factor [0, 1]
 * @returns Interpolated value
 */
export function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

/**
 * Clamp a value between min and max.
 * @param val Value to clamp
 * @param min Minimum value
 * @param max Maximum value
 * @returns Clamped value
 */
export function clamp(val: number, min: number, max: number): number {
    return Math.max(min, Math.min(val, max));
}

/**
 * Inverse linear interpolation - returns t such that lerp(a, b, t) = val.
 * @param a Start value
 * @param b End value
 * @param val Target value
 * @returns Interpolation factor [0, 1] (unclamped)
 */
export function invlerp(a: number, b: number, val: number): number {
    return (val - a) / (b - a);
}

/**
 * Smoothstep interpolation - smooth Hermite interpolation.
 * @param t Input value [0, 1]
 * @returns Smoothed value [0, 1]
 */
export function smoothstep(t: number): number {
    const clamped = Math.max(0, Math.min(1, t));
    return clamped * clamped * (3 - 2 * clamped);
}

/**
 * Smootherstep interpolation - Ken Perlin's improved smoothstep.
 * @param t Input value [0, 1]
 * @returns Smoothed value [0, 1]
 */
export function smootherstep(t: number): number {
    const clamped = Math.max(0, Math.min(1, t));
    return clamped * clamped * clamped * (clamped * (clamped * 6 - 15) + 10);
}

/**
 * Logarithmic interpolation - useful for zoom/dolly.
 * @param a Start value (> 0)
 * @param b End value (> 0)
 * @param t Interpolation factor [0, 1]
 * @returns Logarithmically interpolated value
 */
export function lerpLog(a: number, b: number, t: number): number {
    const safeA = Math.max(0.0001, a);
    const safeB = Math.max(0.0001, b);
    return Math.exp(Math.log(safeA) + (Math.log(safeB) - Math.log(safeA)) * Math.max(0, Math.min(1, t)));
}

/**
 * Angle interpolation (shortest path in degrees).
 * @param a Start angle (degrees)
 * @param b End angle (degrees)
 * @param t Interpolation factor [0, 1]
 * @returns Interpolated angle (degrees)
 */
export function lerpAngle(a: number, b: number, t: number): number {
    let diff = b - a;
    // Normalize to [0, 360) then subtract 360 when > 180 to get shortest path in (-180, 180]
    diff = ((diff % 360) + 360) % 360;
    diff = diff > 180 ? diff - 360 : diff;
    return a + diff * Math.max(0, Math.min(1, t));
}