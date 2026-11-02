import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { EvaluatedProjectFrame } from '../engine/evaluateShot';
import type { Project } from '../model/types';
import { getFocusDepthRange, projectFocusPlane } from './focusPlaneGeometry';
import { FocusDepthRuler } from './FocusDepthRuler';
import { FocusLayerFeedback } from './FocusLayerFeedback';
import { createPointerDragLifecycle } from './selectionDragLifecycle';
import type { EvaluatedCameraPose } from './webgl/cameraMath';

interface DepthOfFieldFocusOverlayProps {
    active: boolean;
    indicator: { x: number; y: number } | null;
    frame: EvaluatedProjectFrame;
    frameWidth: number;
    frameHeight: number;
    targetAspect: number;
    cameraPose: EvaluatedCameraPose;
    defaultCamera: NonNullable<Project['defaultCamera']>;
    stageFrameRef: React.RefObject<HTMLDivElement | null>;
    onFocusClick: (event: React.MouseEvent<HTMLDivElement>) => void;
    onBeginDrag: () => void;
    onEndDrag: (cancelled: boolean) => void;
    onAdjustFocusDepth: (delta: number, skipHistory?: boolean) => void;
    onAdjustFocusRange: (delta: number, skipHistory?: boolean) => void;
}

function formatDepth(depth: number): string {
    return Number(depth.toFixed(3)).toString();
}

function projectFocusPoint(
    points: { x: number; y: number }[],
    normalizedX: number,
    normalizedY: number
) {
    if (points.length !== 4) return null;
    const u = Math.max(0, Math.min(1, (normalizedX + 1) / 2));
    const v = Math.max(0, Math.min(1, (1 - normalizedY) / 2));
    const topX = points[0].x + (points[1].x - points[0].x) * u;
    const topY = points[0].y + (points[1].y - points[0].y) * u;
    const bottomX = points[3].x + (points[2].x - points[3].x) * u;
    const bottomY = points[3].y + (points[2].y - points[3].y) * u;
    return {
        x: topX + (bottomX - topX) * v,
        y: topY + (bottomY - topY) * v,
    };
}

export const DepthOfFieldFocusOverlay: React.FC<DepthOfFieldFocusOverlayProps> = ({
    active,
    indicator,
    frame,
    frameWidth,
    frameHeight,
    targetAspect,
    cameraPose,
    defaultCamera,
    stageFrameRef,
    onFocusClick,
    onBeginDrag,
    onEndDrag,
    onAdjustFocusDepth,
    onAdjustFocusRange,
}) => {
    const dof = frame.effects.state.depthOfField;
    const target = dof.target;
    const focusDepth = target.z;
    const focusRange = dof.focusRange;
    const layerDepths = frame.layers
        .filter(layer => layer.visible !== false && Number.isFinite(layer.position.z))
        .map(layer => layer.position.z);
    const cameraDepth = cameraPose.position.z;
    const depthRange = getFocusDepthRange([...layerDepths, cameraDepth], focusDepth, focusRange);
    const focusPoints = projectFocusPlane(focusDepth, cameraPose, frameWidth, frameHeight, targetAspect);
    const nearPoints = projectFocusPlane(focusDepth - focusRange / 2, cameraPose, frameWidth, frameHeight, targetAspect);
    const farPoints = projectFocusPlane(focusDepth + focusRange / 2, cameraPose, frameWidth, frameHeight, targetAspect);
    const focusPoint = projectFocusPoint(focusPoints, target.x, target.y);
    const layerTicks = frame.layers
        .filter(layer => layer.visible !== false && Number.isFinite(layer.position.z))
        .map(layer => ({ id: layer.id, name: layer.name, depth: layer.position.z }));
    const [hoveredDepth, setHoveredDepth] = useState<number | null>(null);
    const [faded, setFaded] = useState(false);
    const fadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const activeDragCleanupRef = useRef<(() => void) | null>(null);
    useEffect(() => () => activeDragCleanupRef.current?.(), []);
    const interaction = useCallback(() => {
        setFaded(false);
        if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
        fadeTimeoutRef.current = setTimeout(() => setFaded(true), 2600);
    }, []);

    useEffect(() => {
        interaction();
        return () => {
            if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
        };
    }, [interaction]);

    const handleHoverDepth = useCallback((depth: number | null) => {
        setHoveredDepth(depth);
        if (depth !== null) interaction();
    }, [interaction]);

    const handleFocusMarkerKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        const direction = event.key === 'ArrowUp' ? 1 : event.key === 'ArrowDown' ? -1 : 0;
        if (!direction) return;
        event.preventDefault();
        event.stopPropagation();
        interaction();
        onAdjustFocusDepth(direction * (event.shiftKey ? 0.01 : 0.05));
    };

    const handleFocusMarkerPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        activeDragCleanupRef.current?.();
        const startY = event.clientY;
        activeDragCleanupRef.current = createPointerDragLifecycle({
            pointerId: event.pointerId,
            target: event.currentTarget,
            begin: onBeginDrag,
            commit: () => onEndDrag(false),
            cancel: () => onEndDrag(true),
            onMove: moveEvent => {
                interaction();
                onAdjustFocusDepth(-(moveEvent.clientY - startY) * 0.005, true);
            },
            onEnd: () => {
                activeDragCleanupRef.current = null;
            },
        });
    };

    const depthPlaneVisible = dof.enabled || active;
    const cameraZ = defaultCamera.position.z;
    const focalLength = defaultCamera.focalLength;
    const toPoints = (points: { x: number; y: number }[]) =>
        points.map(point => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
    const hovered = (depth: number) => hoveredDepth !== null && Math.abs(hoveredDepth - depth) < 0.001;

    return (
        <>
            {depthPlaneVisible && (
                <div
                    className="absolute inset-0 z-30 overflow-visible pointer-events-none"
                    data-focus-plane-overlay=""
                    data-faded={String(faded)}
                    onMouseMove={interaction}
                >
                    <svg
                        aria-hidden="true"
                        className={`absolute inset-0 h-full w-full overflow-visible pointer-events-none transition-opacity duration-500 ${faded ? 'opacity-35' : 'opacity-100'}`}
                        viewBox={`0 0 ${frameWidth} ${frameHeight}`}
                        preserveAspectRatio="none"
                    >
                        {nearPoints.length === 4 && (
                            <polygon
                                points={toPoints(nearPoints)}
                                fill="rgba(14,165,233,.08)"
                                stroke={hovered(focusDepth - focusRange / 2) ? '#bae6fd' : 'rgba(125,211,252,.45)'}
                                strokeWidth={hovered(focusDepth - focusRange / 2) ? 2 : 1}
                                pointerEvents="none"
                                data-depth-sheet-surface=""
                                data-depth-boundary="near"
                                data-depth={formatDepth(focusDepth - focusRange / 2)}
                                data-hovered-depth={hoveredDepth === null ? undefined : formatDepth(hoveredDepth)}
                                data-hover-linked={String(hovered(focusDepth - focusRange / 2))}
                            />
                        )}
                        {farPoints.length === 4 && (
                            <polygon
                                points={toPoints(farPoints)}
                                fill="rgba(14,165,233,.08)"
                                stroke={hovered(focusDepth + focusRange / 2) ? '#bae6fd' : 'rgba(125,211,252,.45)'}
                                strokeWidth={hovered(focusDepth + focusRange / 2) ? 2 : 1}
                                pointerEvents="none"
                                data-depth-sheet-surface=""
                                data-depth-boundary="far"
                                data-depth={formatDepth(focusDepth + focusRange / 2)}
                                data-hovered-depth={hoveredDepth === null ? undefined : formatDepth(hoveredDepth)}
                                data-hover-linked={String(hovered(focusDepth + focusRange / 2))}
                            />
                        )}
                        {focusPoints.length === 4 && (
                            <polygon
                                points={toPoints(focusPoints)}
                                fill="rgba(56,189,248,.09)"
                                stroke={hovered(focusDepth) ? '#e0f2fe' : 'rgba(125,211,252,.82)'}
                                strokeWidth={hovered(focusDepth) ? 2.5 : 1.5}
                                pointerEvents="none"
                                data-depth-sheet-surface=""
                                data-focus-plane=""
                                data-focus-depth={formatDepth(focusDepth)}
                                data-hovered-depth={hoveredDepth === null ? undefined : formatDepth(hoveredDepth)}
                                data-hover-linked={String(hovered(focusDepth))}
                            />
                        )}
                    </svg>

                    {dof.enabled && (
                        <FocusLayerFeedback
                            frame={frame}
                            frameWidth={frameWidth}
                            frameHeight={frameHeight}
                            targetAspect={targetAspect}
                            cameraPose={cameraPose}
                            cameraZ={cameraZ}
                            focalLength={focalLength}
                            hoveredDepth={hoveredDepth}
                            faded={faded}
                        />
                    )}

                    {focusPoint && (
                        <div
                            role="spinbutton"
                            aria-label="Focus depth; use arrow keys to adjust"
                            title="Use the up and down arrow keys to adjust focus depth"
                            aria-valuenow={focusDepth}
                            aria-valuetext={`Focus depth ${formatDepth(focusDepth)}`}
                            data-focus-marker=""
                            data-focus-depth={formatDepth(focusDepth)}
                            tabIndex={0}
                            className={`absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border border-sky-100 bg-sky-400/20 shadow-[0_0_16px_rgba(56,189,248,.7)] pointer-events-auto transition-opacity ${faded ? 'opacity-55' : 'opacity-100'} focus-visible:outline focus-visible:outline-2 focus-visible:outline-white`}
                            style={{ left: focusPoint.x, top: focusPoint.y }}
                            onMouseDown={event => event.stopPropagation()}
                            onPointerDown={handleFocusMarkerPointerDown}
                            onPointerEnter={() => handleHoverDepth(focusDepth)}
                            onPointerLeave={() => handleHoverDepth(null)}
                            onKeyDown={handleFocusMarkerKeyDown}
                            onFocus={() => handleHoverDepth(focusDepth)}
                            onBlur={() => handleHoverDepth(null)}
                        >
                            <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
                        </div>
                    )}

                    <FocusDepthRuler
                        minDepth={depthRange.min}
                        maxDepth={depthRange.max}
                        focusDepth={focusDepth}
                        focusRange={focusRange}
                        cameraDepth={cameraDepth}
                        layerTicks={layerTicks}
                        hoveredDepth={hoveredDepth}
                        faded={faded}
                        onHoverDepth={handleHoverDepth}
                        onBeginDrag={onBeginDrag}
                        onEndDrag={onEndDrag}
                        onAdjustFocusRange={(delta, skipHistory) => {
                            interaction();
                            onAdjustFocusRange(delta, skipHistory);
                        }}
                    />
                </div>
            )}

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
};
