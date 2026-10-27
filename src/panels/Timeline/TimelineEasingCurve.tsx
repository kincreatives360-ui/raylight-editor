import { useMemo } from 'react';
import type { Easing } from '../../model/types';
import { buildEasingCurvePoints } from './timelineBarGeometry';

export function TimelineEasingCurve({
    easing,
    color = 'currentColor',
}: {
    easing: Easing;
    color?: string;
}) {
    const points = useMemo(() => buildEasingCurvePoints(easing), [easing]);
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
                stroke={color}
                strokeWidth="0.8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}
