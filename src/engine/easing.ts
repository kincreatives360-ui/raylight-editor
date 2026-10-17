// src/engine/easing.ts
import type {
    Easing,
    PresetEasingName,
    SpringEasingName,
} from '../model/types';

function clamp(val: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, val));
}

// 1. Custom 4-Point Cubic Bezier Solver (x1, y1, x2, y2)
// Uses Newton-Raphson iteration with bisection fallback for steep curves
export function solveCubicBezier(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    t: number
): number {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    if (x1 === y1 && x2 === y2) return t;

    const cx = 3 * x1;
    const bx = 3 * (x2 - x1) - cx;
    const ax = 1 - cx - bx;

    const cy = 3 * y1;
    const by = 3 * (y2 - y1) - cy;
    const ay = 1 - cy - by;

    const sampleCurveX = (u: number) => ((ax * u + bx) * u + cx) * u;
    const sampleCurveY = (u: number) => ((ay * u + by) * u + cy) * u;
    const sampleDerivX = (u: number) => (3 * ax * u + 2 * bx) * u + cx;

    // Try fast Newton-Raphson first
    let u = t;
    for (let i = 0; i < 8; i++) {
        const xError = sampleCurveX(u) - t;
        if (Math.abs(xError) < 1e-6) {
            return Number(sampleCurveY(u).toFixed(6));
        }
        const deriv = sampleDerivX(u);
        if (Math.abs(deriv) < 1e-6) break;
        u -= xError / deriv;
    }

    // Fallback to safe binary subdivision if curve is extremely steep
    let low = 0;
    let high = 1;
    u = t;
    for (let i = 0; i < 12; i++) {
        const xVal = sampleCurveX(u);
        if (Math.abs(xVal - t) < 1e-6) break;
        if (t > xVal) low = u;
        else high = u;
        u = (high + low) * 0.5;
    }

    return Number(sampleCurveY(clamp(u, 0, 1)).toFixed(6));
}

// 2. The 4 Physics Springs (gentle, quick, bouncy, slow)
// Damped harmonic oscillator normalized so t=0 -> 0 and t=1 -> 1
export function evaluateSpring(name: SpringEasingName, t: number): number {
    if (t <= 0) return 0;
    if (t >= 1) return 1;

    const config: Record<
        SpringEasingName,
        { damping: number; frequency: number }
    > = {
        gentle: { damping: 7.5, frequency: 5.5 },
        quick: { damping: 10.5, frequency: 8.5 },
        bouncy: { damping: 4.8, frequency: 11.5 },
        slow: { damping: 5.5, frequency: 3.8 },
    };

    const { damping, frequency } = config[name];

    const rawAt = (time: number) =>
        1 - Math.exp(-damping * time) * Math.cos(frequency * time * Math.PI);

    const endValue = rawAt(1);
    return Number((rawAt(t) / endValue).toFixed(6));
}

// 3. The 11 Standard Presets
export function evaluatePreset(name: PresetEasingName, t: number): number {
    if (t <= 0) return 0;
    if (t >= 1) return 1;

    switch (name) {
        case 'ease':
            return solveCubicBezier(0.25, 0.1, 0.25, 1, t);

        case 'ease-in-quad':
            return t * t;

        case 'ease-out-quad':
            return t * (2 - t);

        case 'ease-in-out-quad':
            return t < 0.5
                ? 2 * t * t
                : 1 - Math.pow(-2 * t + 2, 2) / 2;

        case 'ease-in-cubic':
            return t * t * t;

        case 'ease-out-cubic':
            return 1 - Math.pow(1 - t, 3);

        case 'ease-in-out-cubic':
            return t < 0.5
                ? 4 * t * t * t
                : 1 - Math.pow(-2 * t + 2, 3) / 2;

        case 'linear':
            return t;

        case 'hold':
            return t < 1 ? 0 : 1;

        case 'ease-in':
            return t * t * t;

        case 'ease-out':
            return 1 - Math.pow(1 - t, 3);

        case 'ease-in-out':
            return t < 0.5
                ? 4 * t * t * t
                : 1 - Math.pow(-2 * t + 2, 3) / 2;

        case 'ease-in-expo':
            return Math.pow(2, 10 * t - 10);

        case 'ease-out-expo':
            return 1 - Math.pow(2, -10 * t);

        case 'ease-in-back': {
            const c1 = 1.70158;
            const c3 = c1 + 1;
            return c3 * t * t * t - c1 * t * t;
        }

        case 'ease-out-back': {
            const c1 = 1.70158;
            const c3 = c1 + 1;
            return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
        }

        case 'ease-in-out-back': {
            const c1 = 1.70158;
            const c2 = c1 * 1.525;
            return t < 0.5
                ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
                : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
        }

        case 'bounce': {
            const n1 = 7.5625;
            const d1 = 2.75;
            let x = t;
            if (x < 1 / d1) return n1 * x * x;
            if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
            if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
            return n1 * (x -= 2.625 / d1) * x + 0.984375;
        }

        default:
            return t;
    }
}

// Master Easing Evaluator used by Layers, Camera Blocks, and Effects
export function evaluateEasing(progress: number, easing: Easing): number {
    const clamped = clamp(progress, 0, 1);

    if (clamped <= 0) return 0;
    if (clamped >= 1) return 1;

    switch (easing.kind) {
        case 'preset':
            return evaluatePreset(easing.name, clamped);
        case 'spring':
            return evaluateSpring(easing.name, clamped);
        case 'bezier':
            return solveCubicBezier(
                easing.x1,
                easing.y1,
                easing.x2,
                easing.y2,
                clamped
            );
        default:
            return clamped;
    }
}

// Complete catalog of all 18 Easing Feels for UI Pickers & Testing
export interface EasingCatalogItem {
    id: string;
    label: string;
    category: 'Preset' | 'Spring' | 'Custom Bezier';
    easing: Easing;
}

export const ALL_18_EASINGS: EasingCatalogItem[] = [
    // 11 Presets
    { id: 'preset:linear', label: 'Linear', category: 'Preset', easing: { kind: 'preset', name: 'linear' } },
    { id: 'preset:ease-in', label: 'Ease In', category: 'Preset', easing: { kind: 'preset', name: 'ease-in' } },
    { id: 'preset:ease-out', label: 'Ease Out', category: 'Preset', easing: { kind: 'preset', name: 'ease-out' } },
    { id: 'preset:ease-in-out', label: 'Ease In-Out', category: 'Preset', easing: { kind: 'preset', name: 'ease-in-out' } },
    { id: 'preset:ease-in-expo', label: 'Ease In Expo', category: 'Preset', easing: { kind: 'preset', name: 'ease-in-expo' } },
    { id: 'preset:ease-out-expo', label: 'Ease Out Expo', category: 'Preset', easing: { kind: 'preset', name: 'ease-out-expo' } },
    { id: 'preset:ease-in-back', label: 'Ease In Back', category: 'Preset', easing: { kind: 'preset', name: 'ease-in-back' } },
    { id: 'preset:ease-out-back', label: 'Ease Out Back', category: 'Preset', easing: { kind: 'preset', name: 'ease-out-back' } },
    { id: 'preset:ease-in-out-back', label: 'Ease In-Out Back', category: 'Preset', easing: { kind: 'preset', name: 'ease-in-out-back' } },
    { id: 'preset:hold', label: 'Hold (Step)', category: 'Preset', easing: { kind: 'preset', name: 'hold' } },
    { id: 'preset:bounce', label: 'Bounce', category: 'Preset', easing: { kind: 'preset', name: 'bounce' } },

    // 4 Physics Springs
    { id: 'spring:gentle', label: 'Spring: Gentle', category: 'Spring', easing: { kind: 'spring', name: 'gentle' } },
    { id: 'spring:quick', label: 'Spring: Quick', category: 'Spring', easing: { kind: 'spring', name: 'quick' } },
    { id: 'spring:bouncy', label: 'Spring: Bouncy', category: 'Spring', easing: { kind: 'spring', name: 'bouncy' } },
    { id: 'spring:slow', label: 'Spring: Slow', category: 'Spring', easing: { kind: 'spring', name: 'slow' } },

    // 3 Custom Bezier Curves (totaling 18 options)
    {
        id: 'bezier:cinematic',
        label: 'Bezier: Raylight Snap (0.16, 1, 0.3, 1)',
        category: 'Custom Bezier',
        easing: { kind: 'bezier', x1: 0.16, y1: 1, x2: 0.3, y2: 1 },
    },
    {
        id: 'bezier:dramatic',
        label: 'Bezier: Slow-Fast-Slow (0.85, 0, 0.15, 1)',
        category: 'Custom Bezier',
        easing: { kind: 'bezier', x1: 0.85, y1: 0, x2: 0.15, y2: 1 },
    },
    {
        id: 'bezier: whip',
        label: 'Bezier: Anticipate Whip (0.6, -0.28, 0.74, 0.05)',
        category: 'Custom Bezier',
        easing: { kind: 'bezier', x1: 0.6, y1: -0.28, x2: 0.74, y2: 0.05 },
    },
];

// Automated Math Self-Test (verifies f(0)=0, f(1)=1, and finite values for all 18 curves)
export function runEasingSelfTests(): {
    allPassed: boolean;
    totalTested: number;
    failures: string[];
} {
    const failures: string[] = [];

    for (const item of ALL_18_EASINGS) {
        const startVal = evaluateEasing(0, item.easing);
        const midVal = evaluateEasing(0.5, item.easing);
        const endVal = evaluateEasing(1, item.easing);

        if (Math.abs(startVal - 0) > 1e-5) {
            failures.push(`${item.label}: f(0) returned ${startVal} instead of 0`);
        }
        if (Math.abs(endVal - 1) > 1e-5) {
            failures.push(`${item.label}: f(1) returned ${endVal} instead of 1`);
        }
        if (!Number.isFinite(midVal)) {
            failures.push(`${item.label}: f(0.5) returned non-finite number`);
        }
    }

    return {
        allPassed: failures.length === 0,
        totalTested: ALL_18_EASINGS.length,
        failures,
    };
}