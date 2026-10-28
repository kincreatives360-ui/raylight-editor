import type { HTMLAttributes } from 'react';

interface TimelineRangeBarProps extends HTMLAttributes<HTMLDivElement> {
    left: number;
    width: number;
}

/** A positioned drag surface; selection and drag transactions stay with the caller. */
export function TimelineRangeBar({ left, width, style, ...props }: TimelineRangeBarProps) {
    return <div {...props} style={{ left: `${left}px`, width: `${width}px`, ...style }} />;
}

interface TrimHandleProps extends HTMLAttributes<HTMLSpanElement> {
    side: 'left' | 'right';
}

export function TrimHandle({ side, className = '', ...props }: TrimHandleProps) {
    return <span {...props} className={`absolute ${side === 'left' ? 'left-0' : 'right-0'} top-0 bottom-0 cursor-ew-resize ${className}`} />;
}
