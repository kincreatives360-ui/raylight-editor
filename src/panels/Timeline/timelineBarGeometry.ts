import type { Easing } from '../../model/types';
import { evaluateEasing } from '../../engine/easing';

export function getShotTimelineWidth(durationMs: number, pixelsPerMs: number): number {
    return Math.max(0, durationMs) * Math.max(0, pixelsPerMs);
}

export function buildEasingCurvePoints(easing: Easing, sampleCount = 25) {
    const safeSampleCount = Math.max(2, Math.floor(sampleCount));
    return Array.from({ length: safeSampleCount }, (_, index) => {
        const progress = index / (safeSampleCount - 1);
        const value = Math.max(0, Math.min(1, evaluateEasing(progress, easing)));
        return {
            x: Number((progress * 100).toFixed(2)),
            y: Number((14 - value * 12).toFixed(2)),
        };
    });
}
