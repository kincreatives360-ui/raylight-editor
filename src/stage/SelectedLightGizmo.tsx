import React from 'react';
import { LightTypeIcon } from '../ui/LightTypeIcon';
import type { LightSourceType } from '../model/types';
import { evaluateCameraPose } from './webgl/cameraMath';
import {
    projectLightToScreen,
    calculateSpotConeOverlay,
    calculateAreaRectOverlay,
    calculatePointReachOverlay,
    calculateLightGroundProjection,
    type Vec3Like,
} from './lightingMath';

export interface UnifiedLight {
    id: string;
    name: string;
    type: LightSourceType;
    position: Vec3Like;
    target?: Vec3Like;
    intensity: number;
    color: string;
    temperature?: number;
    angle?: number;
    penumbra?: number;
    width?: number;
    height?: number;
    distance?: number;
}

interface SelectedLightGizmoProps {
    selectedLight: UnifiedLight;
    cameraPose: ReturnType<typeof evaluateCameraPose>;
    frameWidth: number;
    frameHeight: number;
    aspect: number;
    activeDepthDrag: number | null;
    onTargetDragStart: (e: React.PointerEvent) => void;
    onSpotConeDragStart: (
        e: React.PointerEvent,
        targetScreenX: number,
        targetScreenY: number,
        handleScreenX?: number,
        handleScreenY?: number
    ) => void;
    onAreaResizeDragStart: (e: React.PointerEvent) => void;
    onPointReachDragStart: (e: React.PointerEvent) => void;
    onDepthDragStart: (e: React.PointerEvent) => void;
    onSourceDragStart: (e: React.PointerEvent) => void;
}


export const SelectedLightGizmo: React.FC<SelectedLightGizmoProps> = ({
    selectedLight,
    cameraPose,
    frameWidth,
    frameHeight,
    aspect,
    activeDepthDrag,
    onTargetDragStart,
    onSpotConeDragStart,
    onAreaResizeDragStart,
    onPointReachDragStart,
    onDepthDragStart,
    onSourceDragStart,
}) => {
    const srcScreen = projectLightToScreen(
        selectedLight.position,
        cameraPose,
        frameWidth,
        frameHeight,
        aspect
    );

    const hasTarget = selectedLight.type === 'spot' || selectedLight.type === 'directional' || selectedLight.type === 'area';
    const targetPos = selectedLight.target || { x: 0, y: 0, z: 0 };
    const tgtScreen = hasTarget
        ? projectLightToScreen(targetPos, cameraPose, frameWidth, frameHeight, aspect)
        : null;

    const ground = calculateLightGroundProjection(
        selectedLight.position,
        cameraPose,
        frameWidth,
        frameHeight,
        aspect
    );

    const spotCone = selectedLight.type === 'spot'
        ? calculateSpotConeOverlay(
            selectedLight.position,
            targetPos,
            selectedLight.angle || Math.PI / 6,
            cameraPose,
            frameWidth,
            frameHeight,
            aspect
        )
        : null;

    const areaRect = selectedLight.type === 'area'
        ? calculateAreaRectOverlay(
            selectedLight.position,
            selectedLight.target,
            selectedLight.width || 3,
            selectedLight.height || 3,
            cameraPose,
            frameWidth,
            frameHeight,
            aspect
        )
        : null;

    const pointReach = selectedLight.type === 'point'
        ? calculatePointReachOverlay(
            selectedLight.position,
            selectedLight.distance || 5,
            cameraPose,
            frameWidth,
            frameHeight,
            aspect
        )
        : null;

    return (
        <g key="selected-light-gizmo">
            {/* Ground Plane Projection Drop-line and Shadow Ellipse */}
            <g key="ground-projection" data-testid="selected-light-ground-projection">
                <line
                    x1={srcScreen.x}
                    y1={srcScreen.y}
                    x2={ground.groundScreen.x}
                    y2={ground.groundScreen.y}
                    stroke="#f97316"
                    strokeWidth="1.5"
                    strokeDasharray="3,3"
                    strokeOpacity="0.45"
                />
                <ellipse
                    cx={ground.groundScreen.x}
                    cy={ground.groundScreen.y}
                    rx={ground.radiusX}
                    ry={ground.radiusY}
                    fill="rgba(249, 115, 22, 0.08)"
                    stroke="#f97316"
                    strokeWidth="1.5"
                    strokeDasharray="2,2"
                    strokeOpacity="0.5"
                />
            </g>
            {/* Aim Target Dashed Line */}
            {tgtScreen && (
                <>
                    <line
                        x1={srcScreen.x}
                        y1={srcScreen.y}
                        x2={tgtScreen.x}
                        y2={tgtScreen.y}
                        stroke="#f97316"
                        strokeWidth="2"
                        strokeDasharray="5,4"
                        strokeOpacity="0.85"
                    />

                    {/* Aim At Target Handle */}
                    <g
                        data-testid="selected-light-target-handle"
                        className="pointer-events-auto cursor-grab active:cursor-grabbing group"
                        onPointerDown={onTargetDragStart}
                        transform={`translate(${tgtScreen.x}, ${tgtScreen.y})`}
                    >
                        <circle
                            r="11"
                            className="fill-[#161619] stroke-[#f97316] group-hover:scale-125 transition-transform"
                            strokeWidth="2"
                        />
                        <circle r="4" className="fill-[#f97316]" />
                    </g>
                </>
            )}

            {/* Spot Light Cone Overlay */}
            {spotCone && (
                <g key="spot-cone">
                    {/* Cone rim polygon */}
                    <polygon
                        points={spotCone.rimPoints.map((p) => `${p.x},${p.y}`).join(' ')}
                        fill="rgba(249, 115, 22, 0.08)"
                        stroke="#f97316"
                        strokeWidth="1.5"
                        strokeDasharray="4,4"
                        strokeOpacity="0.7"
                    />

                    {/* Tangent boundary lines */}
                    {spotCone.rimPoints.length > 4 && (
                        <>
                            <line
                                x1={srcScreen.x}
                                y1={srcScreen.y}
                                x2={spotCone.rimPoints[0].x}
                                y2={spotCone.rimPoints[0].y}
                                stroke="#f97316"
                                strokeWidth="1.5"
                                strokeOpacity="0.5"
                            />
                            <line
                                x1={srcScreen.x}
                                y1={srcScreen.y}
                                x2={spotCone.rimPoints[Math.floor(spotCone.rimPoints.length / 2)].x}
                                y2={spotCone.rimPoints[Math.floor(spotCone.rimPoints.length / 2)].y}
                                stroke="#f97316"
                                strokeWidth="1.5"
                                strokeOpacity="0.5"
                            />
                        </>
                    )}

                    {/* Spot Cone Angle Resize Handle on Rim */}
                    {spotCone.rimPoints.length > 0 && (
                        <g
                            data-testid="spot-cone-handle"
                            className="pointer-events-auto cursor-ew-resize group"
                            onPointerDown={(e) =>
                                onSpotConeDragStart(
                                    e,
                                    tgtScreen?.x || 0,
                                    tgtScreen?.y || 0,
                                    spotCone.rimPoints[0].x,
                                    spotCone.rimPoints[0].y
                                )
                            }
                            transform={`translate(${spotCone.rimPoints[0].x}, ${spotCone.rimPoints[0].y})`}
                        >
                            <circle
                                r="7"
                                className="fill-[#f97316] stroke-white group-hover:scale-125 transition-transform"
                                strokeWidth="2"
                            />
                        </g>
                    )}
                </g>
            )}

            {/* Area Light Rectangular Wireframe */}
            {areaRect && (
                <g key="area-wireframe">
                    <polygon
                        points={`${areaRect.corners[0].x},${areaRect.corners[0].y} ${areaRect.corners[1].x},${areaRect.corners[1].y} ${areaRect.corners[2].x},${areaRect.corners[2].y} ${areaRect.corners[3].x},${areaRect.corners[3].y}`}
                        fill="rgba(249, 115, 22, 0.12)"
                        stroke="#f97316"
                        strokeWidth="2"
                    />

                    {/* Area Corner Resize Handle */}
                    <g
                        data-testid="area-resize-handle"
                        className="pointer-events-auto cursor-nwse-resize group"
                        onPointerDown={onAreaResizeDragStart}
                        transform={`translate(${areaRect.corners[1].x}, ${areaRect.corners[1].y})`}
                    >
                        <rect
                            x="-5"
                            y="-5"
                            width="10"
                            height="10"
                            className="fill-[#f97316] stroke-white group-hover:scale-125 transition-transform"
                            strokeWidth="2"
                        />
                    </g>
                </g>
            )}

            {/* Point Light Reach Circle */}
            {pointReach && (
                <g key="point-reach">
                    <circle
                        cx={pointReach.centerScreen.x}
                        cy={pointReach.centerScreen.y}
                        r={pointReach.radiusScreen}
                        fill="rgba(249, 115, 22, 0.05)"
                        stroke="#f97316"
                        strokeWidth="1.5"
                        strokeDasharray="4,4"
                        strokeOpacity="0.75"
                    />

                    {/* Point Reach Perimeter Handle */}
                    <g
                        data-testid="point-reach-handle"
                        className="pointer-events-auto cursor-ew-resize group"
                        onPointerDown={onPointReachDragStart}
                        transform={`translate(${pointReach.edgeScreen.x}, ${pointReach.edgeScreen.y})`}
                    >
                        <circle
                            r="7"
                            className="fill-[#f97316] stroke-white group-hover:scale-125 transition-transform"
                            strokeWidth="2"
                        />
                    </g>
                </g>
            )}

            {/* Dedicated Depth (Z) Handle */}
            <g
                data-testid="selected-light-depth-handle"
                className="pointer-events-auto cursor-ns-resize group"
                onPointerDown={onDepthDragStart}
                transform={`translate(${srcScreen.x}, ${srcScreen.y - 32})`}
            >
                <line
                    x1="0"
                    y1="14"
                    x2="0"
                    y2="0"
                    stroke="#0088ff"
                    strokeWidth="1.5"
                    strokeDasharray="2,2"
                />
                <rect
                    x="-12"
                    y="-10"
                    width="24"
                    height="18"
                    rx="5"
                    className="fill-[#18181b] stroke-[#0088ff] group-hover:stroke-white group-hover:scale-110 shadow-md transition-all"
                    strokeWidth="1.5"
                />
                <text
                    x="0"
                    y="3"
                    textAnchor="middle"
                    className="fill-[#0088ff] group-hover:fill-white text-[10px] font-bold pointer-events-none select-none transition-colors"
                >
                    ↕Z
                </text>
                {activeDepthDrag !== null && (
                    <g transform="translate(18, -2)">
                        <rect
                            x="-4"
                            y="-10"
                            width="48"
                            height="18"
                            rx="4"
                            className="fill-[#0088ff] text-white shadow-lg"
                        />
                        <text
                            x="20"
                            y="3"
                            textAnchor="middle"
                            className="fill-white text-[10px] font-semibold select-none"
                        >
                            {`${activeDepthDrag.toFixed(2)}m`}
                        </text>
                    </g>
                )}
            </g>

            {/* Prominent Selected Light Source Handle */}
            <g
                data-testid="selected-light-source-handle"
                className="pointer-events-auto cursor-grab active:cursor-grabbing group"
                onPointerDown={onSourceDragStart}
                transform={`translate(${srcScreen.x}, ${srcScreen.y})`}
            >
                <circle
                    r="18"
                    className="fill-[#f97316] stroke-white shadow-xl group-hover:scale-110 transition-transform"
                    strokeWidth="2.5"
                    style={{
                        filter: 'drop-shadow(0 0 10px rgba(249, 115, 22, 0.7))',
                    }}
                />
                <foreignObject x="-9" y="-9" width="18" height="18" className="pointer-events-none">
                    <div className="w-full h-full flex items-center justify-center">
                        <LightTypeIcon type={selectedLight.type} className="w-3.5 h-3.5 text-white" />
                    </div>
                </foreignObject>
            </g>
        </g>
    );
};
