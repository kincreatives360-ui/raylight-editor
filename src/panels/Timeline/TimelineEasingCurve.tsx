import { useMemo } from 'react';
import type { Easing } from '../../model/types';
import { buildEasingCurvePoints } from './timelineBarGeometry';

export type TimelineCurveTone = 'camera' | 'animation' | 'light' | 'effect' | 'audio' | 'shot';

const TONE_CURVE_COLORS: Record<TimelineCurveTone, { selected: string; unselected: string }> = {
    camera: {
        selected: 'var(--color-brand-green)',
        unselected: 'color-mix(in oklab, var(--color-brand-green) 75%, transparent)',
    },
    animation: {
        selected: 'var(--color-brand-purple)',
        unselected: 'color-mix(in oklab, var(--color-brand-purple) 75%, transparent)',
    },
    effect: {
        selected: 'var(--color-brand-purple)',
        unselected: 'color-mix(in oklab, var(--color-brand-purple) 75%, transparent)',
    },
    light: {
        selected: 'var(--color-brand-amber)',
        unselected: 'color-mix(in oklab, var(--color-brand-amber) 75%, transparent)',
    },
    audio: {
        selected: 'var(--color-brand-orange)',
        unselected: 'color-mix(in oklab, var(--color-brand-orange) 75%, transparent)',
    },
    shot: {
        selected: 'var(--primary)',
        unselected: 'color-mix(in oklab, var(--primary) 75%, transparent)',
    },
};

export function TimelineEasingCurve({
    easing,
    tone,
    selected = false,
    color,
}: {
    easing: Easing;
    tone?: TimelineCurveTone;
    selected?: boolean;
    color?: string;
}) {
    const points = useMemo(() => buildEasingCurvePoints(easing), [easing]);
    const strokeColor = color ?? (tone ? (selected ? TONE_CURVE_COLORS[tone].selected : TONE_CURVE_COLORS[tone].unselected) : 'currentColor');

    return (
        <svg
            aria-hidden="true"
            viewBox="0 0 100 16"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full pointer-events-none"
        >
            <polyline
                points={points.map(({ x, y }) => `${x},${y}`).join(' ')}
                fill="none"
                stroke={strokeColor}
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}
