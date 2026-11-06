import React, { useMemo } from 'react';
import type { Easing } from '../../model/types';
import { buildEasingCurveSvgPaths, buildLabelMaskImage } from './timelineBarGeometry';

export type TimelineCurveTone = 'camera' | 'animation' | 'light' | 'effect' | 'audio' | 'shot';

const TONE_CURVE_COLORS: Record<TimelineCurveTone, { selected: string; unselected: string }> = {
    camera: {
        selected: 'var(--color-brand-green)',
        unselected: 'color-mix(in oklab, var(--color-brand-green) 85%, transparent)',
    },
    animation: {
        selected: 'var(--color-brand-purple)',
        unselected: 'color-mix(in oklab, var(--color-brand-purple) 85%, transparent)',
    },
    effect: {
        selected: 'var(--color-brand-purple)',
        unselected: 'color-mix(in oklab, var(--color-brand-purple) 85%, transparent)',
    },
    light: {
        selected: 'var(--color-brand-amber)',
        unselected: 'color-mix(in oklab, var(--color-brand-amber) 85%, transparent)',
    },
    audio: {
        selected: 'var(--color-brand-orange)',
        unselected: 'color-mix(in oklab, var(--color-brand-orange) 85%, transparent)',
    },
    shot: {
        selected: 'var(--primary)',
        unselected: 'color-mix(in oklab, var(--primary) 85%, transparent)',
    },
};

export interface TimelineEasingCurveProps {
    easing: Easing;
    tone?: TimelineCurveTone;
    selected?: boolean;
    color?: string;
    widthPx?: number;
    label?: string | null;
    className?: string;
}

/**
 * Renders the easing curve inside timeline bars with dual-layer fill + stroke
 * and smart text label legibility masking (100% parity with Raylight `BlockEasingCurve` / `k1`).
 */
export const TimelineEasingCurve: React.FC<TimelineEasingCurveProps> = React.memo(({
    easing,
    tone = 'animation',
    selected = false,
    color,
    widthPx,
    label,
    className,
}) => {
    const paths = useMemo(() => buildEasingCurveSvgPaths(easing, widthPx), [easing, widthPx]);
    const mask = useMemo(() => buildLabelMaskImage(label, widthPx), [label, widthPx]);

    // Suppress curve rendering on tiny bars to avoid visual noise (matches Raylight D1o = 28px)
    if (widthPx !== undefined && widthPx < 28) {
        return null;
    }

    const strokeColor = color ?? (tone ? (selected ? TONE_CURVE_COLORS[tone].selected : TONE_CURVE_COLORS[tone].unselected) : 'currentColor');
    const fillColor = color ?? strokeColor;

    const maskStyle: React.CSSProperties | undefined = mask
        ? { maskImage: mask, WebkitMaskImage: mask }
        : undefined;

    return (
        <div
            data-testid="timeline-easing-curve"
            aria-hidden="true"
            className={`pointer-events-none absolute inset-0 overflow-hidden ${className || ''}`}
        >
            {/* 1. Translucent area fill underneath the curve */}
            <svg
                aria-hidden="true"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="absolute inset-x-0 top-1 bottom-0.5 h-[calc(100%-6px)] w-full overflow-visible"
            >
                <path
                    d={paths.fill}
                    fill={fillColor}
                    fillOpacity={0.16}
                    stroke="none"
                />
            </svg>

            {/* 2. Curve stroke line with smart label cut-out mask */}
            <svg
                aria-hidden="true"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                style={maskStyle}
                className="absolute inset-x-0 top-1 bottom-0.5 h-[calc(100%-6px)] w-full overflow-visible"
            >
                <path
                    d={paths.stroke}
                    fill="none"
                    stroke={strokeColor}
                    strokeOpacity={0.9}
                    strokeWidth="1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                />
            </svg>
        </div>
    );
});
