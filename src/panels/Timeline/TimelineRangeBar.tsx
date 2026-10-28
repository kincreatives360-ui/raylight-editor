import type { HTMLAttributes, ReactNode } from 'react';

export type TimelineBarTone = 'camera' | 'animation' | 'light' | 'effect' | 'audio' | 'shot';

export interface TimelineRangeBarProps extends HTMLAttributes<HTMLDivElement> {
    left: number;
    width: number;
    tone?: TimelineBarTone;
    selected?: boolean;
    children?: ReactNode;
}

const TONE_BORDER_CLASSES: Record<TimelineBarTone, { selected: string; unselected: string }> = {
    camera: {
        selected: 'border-camera-zoom text-emerald-100',
        unselected: 'border-camera-zoom/60 hover:border-camera-zoom text-emerald-200',
    },
    animation: {
        selected: 'border-animation text-purple-100',
        unselected: 'border-animation/60 hover:border-animation text-purple-200',
    },
    effect: {
        selected: 'border-effect text-purple-100',
        unselected: 'border-effect/60 hover:border-effect text-purple-200',
    },
    light: {
        selected: 'border-light-key text-amber-100',
        unselected: 'border-light-key/60 hover:border-light-key text-amber-200',
    },
    audio: {
        selected: 'border-audio-track text-orange-100',
        unselected: 'border-audio-track/60 hover:border-audio-track text-orange-200',
    },
    shot: {
        selected: 'border-shot text-white',
        unselected: 'border-dashed border-shot/60 hover:border-shot text-muted-foreground',
    },
};

const TONE_GRADIENT_CLASSES: Record<TimelineBarTone, { selected: string; unselected: string }> = {
    camera: {
        selected: 'bg-linear-to-b from-camera-zoom/60 to-camera-zoom/10',
        unselected: 'bg-linear-to-b from-camera-zoom/20 to-transparent',
    },
    animation: {
        selected: 'bg-linear-to-b from-animation/60 to-animation/10',
        unselected: 'bg-linear-to-b from-animation/20 to-transparent',
    },
    effect: {
        selected: 'bg-linear-to-b from-effect/60 to-effect/10',
        unselected: 'bg-linear-to-b from-effect/20 to-transparent',
    },
    light: {
        selected: 'bg-linear-to-b from-light-key/60 to-light-key/10',
        unselected: 'bg-linear-to-b from-light-key/20 to-transparent',
    },
    audio: {
        selected: 'bg-linear-to-b from-audio-track/50 to-audio-track/10',
        unselected: 'bg-linear-to-b from-audio-track/20 to-transparent',
    },
    shot: {
        selected: 'bg-linear-to-b from-shot/40 to-shot/10',
        unselected: 'bg-linear-to-b from-shot/20 to-transparent',
    },
};

/** A positioned drag surface; selection and drag transactions stay with the caller. */
export function TimelineRangeBar({ left, width, tone, selected = false, style, className = '', children, ...props }: TimelineRangeBarProps) {
    const toneBorder = tone ? (selected ? TONE_BORDER_CLASSES[tone].selected : TONE_BORDER_CLASSES[tone].unselected) : '';
    const toneGradient = tone ? (selected ? TONE_GRADIENT_CLASSES[tone].selected : TONE_GRADIENT_CLASSES[tone].unselected) : '';

    return (
        <div
            {...props}
            style={{ left: `${left}px`, width: `${width}px`, ...style }}
            className={`group absolute overflow-hidden rounded-md border-2 transition-colors duration-200 ${toneBorder} ${className}`}
        >
            {tone && (
                <div aria-hidden="true" className={`pointer-events-none absolute inset-0 ${toneGradient}`} />
            )}
            {children}
        </div>
    );
}

export interface TrimHandleProps extends HTMLAttributes<HTMLSpanElement> {
    side: 'left' | 'right';
}

export function TrimHandle({ side, className = '', ...props }: TrimHandleProps) {
    return <span {...props} className={`absolute ${side === 'left' ? 'left-0' : 'right-0'} top-0 bottom-0 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity ${className}`} />;
}
