import React from 'react';

export interface SnapLineOverlayProps {
    snapLineMs: number | null;
    pxPerMs: number;
}

/**
 * Global magnetic snap guide overlay (matches Raylight production `SnapLineOverlay` / `h7o`).
 * Renders an absolute 1px accent line across the full vertical timeline whenever a drag/trim
 * operation is magnetically locked to an edge, playhead, or boundary.
 */
export function SnapLineOverlay({
    snapLineMs,
    pxPerMs,
}: SnapLineOverlayProps) {
    if (snapLineMs === null || snapLineMs < 0) return null;
    const leftPx = snapLineMs * pxPerMs;

    return (
        <div
            data-testid="timeline-snap-line-overlay"
            aria-hidden="true"
            style={{ transform: `translate3d(${leftPx}px, 0, 0)` }}
            className="pointer-events-none absolute left-0 inset-y-0 z-40 w-[1px] bg-primary shadow-[0_0_8px_rgba(56,189,248,0.8)]"
        />
    );
}
