import React from 'react';

interface DepthOfFieldFocusOverlayProps {
    active: boolean;
    indicator: { x: number; y: number } | null;
    stageFrameRef: React.RefObject<HTMLDivElement | null>;
    onFocusClick: (event: React.MouseEvent<HTMLDivElement>) => void;
}

export const DepthOfFieldFocusOverlay: React.FC<DepthOfFieldFocusOverlayProps> = ({
    active,
    indicator,
    stageFrameRef,
    onFocusClick,
}) => (
    <>
        {active && (
            <div
                role="button"
                tabIndex={0}
                aria-label="Click the canvas to set depth of field focus"
                onClick={onFocusClick}
                onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    const rect = stageFrameRef.current?.getBoundingClientRect();
                    if (rect) {
                        onFocusClick({
                            clientX: rect.left + rect.width / 2,
                            clientY: rect.top + rect.height / 2,
                        } as React.MouseEvent<HTMLDivElement>);
                    }
                }}
                className="absolute inset-0 z-50 flex items-center justify-center cursor-crosshair bg-sky-500/[0.04]"
            >
                <span className="rounded-full border border-sky-300/60 bg-sky-500/15 px-3 py-1.5 text-[11px] text-white shadow-lg backdrop-blur">
                    Click a point to focus
                </span>
            </div>
        )}
        {!active && indicator && (
            <div
                aria-hidden="true"
                className="absolute z-40 pointer-events-none"
                style={{ left: indicator.x, top: indicator.y, transform: 'translate(-50%,-50%)' }}
            >
                <div className="w-12 h-12 rounded-full border border-sky-300/80 shadow-[0_0_0_1px_rgba(0,0,0,.5),0_0_20px_rgba(56,189,248,.35)]" />
                <div className="absolute left-1/2 top-1/2 w-1.5 h-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-200" />
            </div>
        )}
    </>
);
