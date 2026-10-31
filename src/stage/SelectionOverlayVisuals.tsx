import React from 'react';
import { Crop, Lock, RotateCw } from 'lucide-react';
import type { Layer, TextLayer } from '../model/types';
import type { EvaluatedLayerWithEffects } from '../engine/evaluateShot';
import { getLayerProjectedCorners } from './webgl/cameraMath';

export type ResizeHandleDir = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
type ProjectedLayer = ReturnType<typeof getLayerProjectedCorners>;
type HandleItem = { dir: ResizeHandleDir; pos: { x: number; y: number }; cursor: string };

interface SelectionOverlayVisualsProps {
    selectedEvalLayers: EvaluatedLayerWithEffects[];
    projectCorners: (layer: EvaluatedLayerWithEffects) => ProjectedLayer;
    primaryProj: ProjectedLayer;
    layer: Layer;
    activeShotId: string;
    frameWidth: number;
    isLocked: boolean;
    isCropping: boolean;
    isAnimateMode: boolean;
    isEditingInlineText: boolean;
    setIsEditingInlineText: (editing: boolean) => void;
    activeTool: string;
    borderColor: string;
    isMotionBlock: boolean;
    motionStartPoint: { x: number; y: number };
    motionEndPoint: { x: number; y: number };
    motionMidControl: { x: number; y: number };
    motionAmount: { x: number; y: number };
    handleItems: HandleItem[];
    onMoveStart: (event: React.PointerEvent | React.MouseEvent) => void;
    onMotionEndStart: (event: React.PointerEvent) => void;
    onRotateStart: (event: React.PointerEvent | React.MouseEvent) => void;
    onResizeStart: (event: React.PointerEvent | React.MouseEvent, direction: ResizeHandleDir) => void;
    onSelectLayer: (layerId: string, multiSelect?: boolean) => void;
    updateLayer: (shotId: string, layerId: string, updater: (layer: Layer) => Layer) => void;
}

export const SelectionOverlayVisuals: React.FC<SelectionOverlayVisualsProps> = ({
    selectedEvalLayers, projectCorners, primaryProj, layer, activeShotId, frameWidth,
    isLocked, isCropping, isAnimateMode, isEditingInlineText, setIsEditingInlineText,
    activeTool, borderColor, isMotionBlock, motionStartPoint, motionEndPoint,
    motionMidControl, motionAmount, handleItems, onMoveStart, onMotionEndStart,
    onRotateStart, onResizeStart, onSelectLayer, updateLayer,
}) => {
    return (
    <>            <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none">
                {selectedEvalLayers.slice(1).map((sec) => {
                    const secProj = projectCorners(sec);
                    const pts = secProj.corners.map((point) => `${point.x},${point.y}`).join(' ');
                    return (
                        <g key={sec.id}>
                            <polygon
                                points={pts}
                                fill="var(--accent-primary, #0088ff)"
                                fillOpacity="0.04"
                                stroke="var(--accent-primary, #0088ff)"
                                strokeWidth="1.5"
                                strokeDasharray="5 3"
                                className="cursor-move pointer-events-auto"
                                onPointerDown={onMoveStart}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectLayer(sec.id, e.shiftKey || e.metaKey || e.ctrlKey);
                                }}
                            />
                        </g>
                    );
                })}

                {!isEditingInlineText && (
                    <g>
                        {!isLocked && !isCropping && (
                            <line
                                x1={primaryProj.pN.x}
                                y1={primaryProj.pN.y}
                                x2={primaryProj.pRot.x}
                                y2={primaryProj.pRot.y}
                                stroke={borderColor}
                                strokeWidth="1.5"
                                strokeDasharray="3 2"
                            />
                        )}

                        {primaryProj.corners.length > 4 && (
                            <polygon
                                points={`${primaryProj.pNW.x},${primaryProj.pNW.y} ${primaryProj.pNE.x},${primaryProj.pNE.y} ${primaryProj.pSE.x},${primaryProj.pSE.y} ${primaryProj.pSW.x},${primaryProj.pSW.y}`}
                                fill="none"
                                stroke={borderColor}
                                strokeWidth="1"
                                strokeDasharray="3 3"
                                strokeOpacity="0.45"
                            />
                        )}

                        <polygon
                            points={primaryProj.corners.map((point) => `${point.x},${point.y}`).join(' ')}
                            fill="var(--accent-primary, #0088ff)"
                            fillOpacity="0.02"
                            stroke={borderColor}
                            strokeWidth="1.75"
                            strokeDasharray={isLocked || isCropping ? '6 4' : 'none'}
                            className={`pointer-events-auto ${isLocked
                                    ? 'cursor-not-allowed'
                                    : activeTool === 'tilt'
                                        ? 'cursor-grab'
                                        : 'cursor-move'
                                }`}
                            onPointerDown={onMoveStart}
                            onDoubleClick={(e) => {
                                if (layer.kind === 'text') {
                                    e.stopPropagation();
                                    setIsEditingInlineText(true);
                                }
                            }}
                        />

                        {isMotionBlock && (
                            <g className="motion-path-gizmo pointer-events-auto">
                                <path
                                    d={`M ${motionStartPoint.x} ${motionStartPoint.y} Q ${motionMidControl.x} ${motionMidControl.y} ${motionEndPoint.x} ${motionEndPoint.y}`}
                                    stroke="var(--accent-primary, #0088ff)"
                                    strokeWidth="2.5"
                                    strokeDasharray="5 4"
                                    fill="none"
                                />
                                <circle
                                    cx={motionStartPoint.x}
                                    cy={motionStartPoint.y}
                                    r="5"
                                    fill="var(--accent-primary, #0088ff)"
                                    stroke="#ffffff"
                                    strokeWidth="2"
                                />
                                <g
                                    transform={`translate(${motionEndPoint.x}, ${motionEndPoint.y})`}
                                    onPointerDown={onMotionEndStart}
                                    className="cursor-move"
                                >
                                    <circle
                                        r="7"
                                        fill="var(--accent-danger, #f43f5e)"
                                        stroke="#ffffff"
                                        strokeWidth="2.5"
                                        className="hover:scale-125 transition-transform"
                                    />
                                    <text
                                        x="12"
                                        y="4"
                                        fill="#ffffff"
                                        fontSize="10"
                                        fontWeight="bold"
                                        className="pointer-events-none select-none font-mono"
                                        paintOrder="stroke"
                                        stroke="#000000"
                                        strokeWidth="3"
                                    >
                                        To ({Math.round(motionAmount.x * 1920)}px, {Math.round(motionAmount.y * 1080)}px)
                                    </text>
                                </g>
                            </g>
                        )}
                    </g>
                )}

            </svg>

            {/* TOP 2D ROTATION LOLLIPOP KNOB & PERIMETER 3D TILT BADGE */}
            {!isLocked && !isCropping && !isEditingInlineText && (
                <>
                    <div
                        data-selection-handle="rotate"
                        style={{
                            left: `${primaryProj.pRot.x}px`,
                            top: `${primaryProj.pRot.y}px`,
                            transform: 'translate(-50%, -50%)',
                        }}
                        onPointerDown={onRotateStart}
                        title="Drag around object to Spin / Rotate (Roll Z)"
                        className="absolute pointer-events-auto w-5 h-5 rounded-full bg-[var(--accent-primary,#0088ff)] hover:bg-[var(--accent-hover,#0077e6)] border-2 border-white shadow-xl flex items-center justify-center cursor-grab active:cursor-grabbing transition-transform duration-100 ease-out hover:scale-110"
                    >
                        <RotateCw className="w-2.5 h-2.5 text-white" />
                    </div>

                </>
            )}

            
            {/* FIGMA-STYLE RECTANGLE CORNER ROUNDING NODES */}
            {!isLocked && !isCropping && !isEditingInlineText && layer.kind === 'shape' && ((layer as any).shape === 'rectangle' || !(layer as any).shape) && (
                (() => {
                    const shapeL = layer as any;
                    const center = primaryProj.pCenter;
                    const corners = [
                        { id: 'nw', pt: primaryProj.pNW },
                        { id: 'ne', pt: primaryProj.pNE },
                        { id: 'se', pt: primaryProj.pSE },
                        { id: 'sw', pt: primaryProj.pSW },
                    ];
                    const currentRadius = shapeL.cornerRadius ?? 0;

                    return corners.map((c) => {
                        const vx = center.x - c.pt.x;
                        const vy = center.y - c.pt.y;
                        const dist = Math.hypot(vx, vy);
                        if (dist < 18) return null;
                        const nx = vx / dist;
                        const ny = vy / dist;
                        const offset = Math.min(dist * 0.45, Math.max(14, 14 + currentRadius * 80));
                        const posX = c.pt.x + nx * offset;
                        const posY = c.pt.y + ny * offset;

                        return (
                            <div
                                key={c.id}
                                data-testid={`corner-radius-${c.id}`}
                                style={{
                                    left: `${posX}px`,
                                    top: `${posY}px`,
                                    transform: 'translate(-50%, -50%)',
                                }}
                                title="Drag to adjust corner rounding"
                                className="w-2.5 h-2.5 rounded-full bg-white border border-[var(--accent-primary,#0088ff)] shadow-md absolute pointer-events-auto cursor-crosshair hover:scale-125 transition-transform duration-75 ease-out z-20 hover:bg-sky-50"
                                onPointerDown={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    const startX = e.clientX;
                                    const startY = e.clientY;
                                    const initialRadius = shapeL.cornerRadius ?? 0;

                                    const onMove = (moveEv: PointerEvent) => {
                                        const dx = moveEv.clientX - startX;
                                        const dy = moveEv.clientY - startY;
                                        const dot = dx * nx + dy * ny;
                                        const deltaRadius = dot / 120;
                                        const nextRadius = Math.max(0, Math.min(0.5, Number((initialRadius + deltaRadius).toFixed(3))));
                                        updateLayer(activeShotId, layer.id, (l) =>
                                            l.kind === 'shape' ? { ...l, cornerRadius: nextRadius } : l
                                        );
                                    };

                                    const onUp = () => {
                                        window.removeEventListener('pointermove', onMove);
                                        window.removeEventListener('pointerup', onUp);
                                        window.removeEventListener('pointercancel', onUp);
                                    };

                                    window.addEventListener('pointermove', onMove);
                                    window.addEventListener('pointerup', onUp);
                                    window.addEventListener('pointercancel', onUp);
                                }}
                            />
                        );
                    });
                })()
            )}

            {/* 8 RESIZE / CROP HANDLES */}
            {!isLocked &&
                !isEditingInlineText &&
                handleItems.map((h) => (
                        <div
                            key={h.dir}
                            data-selection-handle={h.dir}
                            onPointerDown={(e) => onResizeStart(e, h.dir)}
                            style={{
                                left: `${h.pos.x}px`,
                                top: `${h.pos.y}px`,
                                transform: 'translate(-50%, -50%)',
                                cursor: h.cursor,
                            }}
                            className={`w-3 h-3 rounded-xs border-2 shadow-lg absolute pointer-events-auto ${isCropping
                                    ? 'bg-[var(--accent-warning,#f59e0b)] border-black'
                                    : isAnimateMode
                                        ? 'bg-[var(--accent-danger,#f43f5e)] border-white'
                                        : 'bg-white border-[var(--accent-primary,#0088ff)]'
                                } hover:scale-125 transition-transform duration-100 ease-out`}
                        />
                ))}

            {/* INLINE TEXT EDITOR OR STATUS BADGES (unobstructed interior) */}
            {((isEditingInlineText && layer.kind === 'text') || isLocked || isCropping) && (
                <div
                    style={{
                        left: `${primaryProj.pCenter.x}px`,
                        top: `${primaryProj.pCenter.y}px`,
                        transform: 'translate(-50%, -50%)',
                    }}
                    className="absolute flex items-center justify-center pointer-events-auto"
                >
                    {isEditingInlineText && layer.kind === 'text' ? (
                        <div
                            className="p-1 z-40"
                            style={{ width: `${Math.max(220, frameWidth * 0.42)}px` }}
                        >
                            <textarea
                                autoFocus
                                value={(layer as TextLayer).content}
                                onChange={(e) =>
                                    updateLayer(activeShotId, layer.id, (l) =>
                                        l.kind === 'text' ? { ...l, content: e.target.value } : l
                                    )
                                }
                                onKeyDown={(e) => {
                                    e.stopPropagation();
                                    if (
                                        e.key === 'Escape' ||
                                        (e.key === 'Enter' && (e.metaKey || e.ctrlKey))
                                    ) {
                                        setIsEditingInlineText(false);
                                    }
                                }}
                                onBlur={() => setIsEditingInlineText(false)}
                                className="w-full bg-black/90 border-2 border-[var(--accent-primary,#0088ff)] rounded-lg p-2.5 text-white resize-none outline-none shadow-2xl leading-normal text-sm"
                            />
                        </div>
                    ) : isLocked ? (
                        <div className="px-2 py-1 rounded-full bg-amber-950/90 border border-amber-400/50 text-amber-300 text-[11px] font-mono flex items-center gap-1 shadow-lg">
                            <Lock className="w-3 h-3" /> Locked
                        </div>
                    ) : isCropping ? (
                        <div className="px-2.5 py-1 rounded-full bg-[var(--accent-warning,#f59e0b)] text-black text-[11px] font-semibold flex items-center gap-1 shadow-lg">
                            <Crop className="w-3 h-3" /> Drag Corners to Crop
                        </div>
                    ) : null}
                </div>
            )}
        </>
    );
};
