import React from 'react';

export interface FramerCutMomentProps {
    id: string;
    timeMs: number;
    pxPerMs: number;
    shape?: 'seam' | 'trailing' | 'leading' | 'full';
    label?: string;
    selected?: boolean;
    onSelect?: () => void;
    onContextMenu?: (e: React.MouseEvent) => void;
}

/**
 * Instantaneous camera cut marker rendered as an equilateral diamond (matches Raylight `FramerCutMoment` / `qYt`).
 * Supports `shape: "seam"` with vertical divider line when placed between abutting camera moves.
 */
export function FramerCutMoment({
    id,
    timeMs,
    pxPerMs,
    shape = 'full',
    label = 'Camera cut',
    selected = false,
    onSelect,
    onContextMenu,
}: FramerCutMomentProps) {
    const centerPx = timeMs * pxPerMs;
    const isSeam = shape === 'seam';
    const isInteractive = Boolean(onSelect);

    const handleKeyDown = isInteractive
        ? (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onSelect?.();
            }
        }
        : undefined;

    return (
        <div
            data-testid={`camera-cut-${id}`}
            data-cut-id={id}
            role={isInteractive ? 'button' : undefined}
            tabIndex={isInteractive ? 0 : undefined}
            aria-label={label}
            aria-pressed={isInteractive ? selected : undefined}
            onClick={isInteractive ? (e) => {
                e.stopPropagation();
                onSelect?.();
            } : undefined}
            onKeyDown={handleKeyDown}
            onContextMenu={onContextMenu}
            style={{ left: `${centerPx}px` }}
            title={`${label} at ${(timeMs / 1000).toFixed(2)}s`}
            className={`group absolute top-0.5 bottom-0.5 -translate-x-1/2 flex flex-col items-center justify-start z-20 pointer-events-auto select-none ${
                isInteractive ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary' : 'cursor-default'
            }`}
        >
            {/* Diamond shape (rotated square) */}
            <div
                className={`w-3 h-3 rotate-45 border transition-all duration-150 ${
                    selected
                        ? 'bg-white border-primary shadow-[0_0_8px_rgba(255,255,255,0.8)] scale-110'
                        : 'bg-camera-zoom border-emerald-200 group-hover:scale-110'
                }`}
            />
            {/* Vertical seam dividing line between abutting camera moves */}
            {isSeam && (
                <div
                    aria-hidden="true"
                    className={`w-[1.5px] flex-1 mt-0.5 ${
                        selected ? 'bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]' : 'bg-camera-zoom/80'
                    }`}
                />
            )}
        </div>
    );
}

