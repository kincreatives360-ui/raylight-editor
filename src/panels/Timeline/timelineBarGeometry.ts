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

/**
 * Returns dynamic sample resolution based on bar pixel width (matches Raylight `e$t`).
 */
export function getEasingCurveSampleCount(widthPx?: number): number {
    if (!widthPx || widthPx <= 72) return 24;
    if (widthPx <= 200) return 48;
    return 96;
}

/**
 * Generates SVG stroke and fill paths for the timeline block easing curve (matches Raylight `j1o` & `t$t`).
 * Returns viewBox 0 0 100 100 coordinates where stroke traces the curve and fill wraps down with `V300 H0 Z`.
 */
export function buildEasingCurveSvgPaths(
    easing: Easing,
    widthPx?: number,
    customSampleCount?: number
): { stroke: string; fill: string } {
    const sampleCount = customSampleCount ?? getEasingCurveSampleCount(widthPx);
    const safeSamples = Math.max(2, sampleCount);

    const values: number[] = [];
    const times: number[] = [];
    let minVal = 0;
    let maxVal = 1;

    for (let i = 0; i < safeSamples; i++) {
        const t = i / (safeSamples - 1);
        const val = evaluateEasing(t, easing);
        times.push(t);
        values.push(val);
        if (val < minVal) minVal = val;
        if (val > maxVal) maxVal = val;
    }

    const range = (maxVal - minVal) || 1;
    const strokePoints: string[] = [];

    for (let i = 0; i < safeSamples; i++) {
        const x = Number((times[i] * 100).toFixed(2));
        const y = Number(((1 - (values[i] - minVal) / range) * 100).toFixed(2));
        strokePoints.push(`${i === 0 ? 'M' : 'L'}${x},${y}`);
    }

    const stroke = strokePoints.join(' ');
    const fill = `${stroke} V300 H0 Z`;

    return { stroke, fill };
}

/**
 * Generates a CSS linear-gradient maskImage that smoothly cuts out the curve stroke
 * behind the center label text so timeline labels remain crisp and readable (matches Raylight `Bwo`).
 */
export function buildLabelMaskImage(label?: string | null, widthPx?: number): string | undefined {
    if (!label || !widthPx || widthPx < 44) return undefined;
    const textWidth = Math.min(Math.max(28, label.length * 6.5), widthPx - 16);
    const halfWidth = textWidth / 2;
    const feather = 10;
    const inner = halfWidth.toFixed(1);
    const outer = (halfWidth + feather).toFixed(1);
    return `linear-gradient(to right, #000 calc(50% - ${outer}px), transparent calc(50% - ${inner}px), transparent calc(50% + ${inner}px), #000 calc(50% + ${outer}px))`;
}
