// src/stage/SelectionOverlay.tsx
import React, { useRef, useState } from 'react';
import * as THREE from 'three';
import { Move, RotateCw, Compass, Lock, Crop, Type, Sparkles } from 'lucide-react';
import type { Shot, TextLayer, ImageLayer, VideoLayer } from '../model/types';
import { degToRad, radToDeg } from '../model/defaults';
import {
    isLayerEffectivelyLocked,
    type EvaluatedLayerWithEffects,
    type EvaluatedProjectFrame,
} from '../engine/evaluateShot';
import { useProjectStore } from '../store/useProjectStore';
import { useSelectionStore } from '../store/useSelectionStore';
import { computeSmartSnap, type SnapGuideLine } from './stageUtils';
import {
    DEFAULT_CAMERA_Z,
    DEFAULT_FOCAL_LENGTH,
    evaluateCameraPose,
    getLayerProjectedCorners,
} from './webgl/cameraMath';

interface SelectionOverlayProps {
    frame: EvaluatedProjectFrame;
    selectedLayerIds: string[];
    frameWidth: number;
    frameHeight: number;
    snapEnabled: boolean;
    onUpdateGuides: (guides: SnapGuideLine[]) => void;
    onSelectLayer: (layerId: string, multiSelect?: boolean) => void;
    cameraRef?: React.MutableRefObject<THREE.PerspectiveCamera | null>;
}

type ResizeHandleDir = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export const SelectionOverlay: React.FC<SelectionOverlayProps> = ({
    frame,
    selectedLayerIds,
    frameWidth,
    frameHeight,
    snapEnabled,
    onUpdateGuides,
    onSelectLayer,
    cameraRef: _cameraRef,
}) => {
    const {
        project,
        updateLayer,
        updateShot,
        recordAnimatedBlockAtPlayhead,
        beginDragTransaction,
        commitDragTransaction,
    } = useProjectStore();

    const {
        activeTool,
        isAnimateMode,
        isCropping,
        canvasZoom,
        selectBlock,
        setTimelineLayerExpanded,
    } = useSelectionStore();

    const overlayRootRef = useRef<HTMLDivElement | null>(null);
    const [isEditingInlineText, setIsEditingInlineText] = useState(false);

    const activeShot: Shot = frame.activeShot;
    const selectedEvalLayers: EvaluatedLayerWithEffects[] = frame.layers.filter(
        (l) => selectedLayerIds.includes(l.id)
    );

    if (selectedEvalLayers.length === 0) return null;

    const primaryEval = selectedEvalLayers[0];
    const { layer } = primaryEval;
    const isLocked = isLayerEffectivelyLocked(layer, activeShot.groups);

    const aspect = frameWidth / Math.max(frameHeight, 1);
    const defaultCamera = project.defaultCamera || {
        position: { x: 0, y: 0, z: DEFAULT_CAMERA_Z },
        rotation: { x: 0, y: 0, z: 0 },
        focalLength: DEFAULT_FOCAL_LENGTH,
    };
    const cameraPose = evaluateCameraPose(frame.camera, defaultCamera, aspect);
    const refCameraZ = defaultCamera.position?.z ?? DEFAULT_CAMERA_Z;
    const refFocalLength = defaultCamera.focalLength ?? DEFAULT_FOCAL_LENGTH;
    const zoom = Math.max(0.15, frame.camera.zoom || 1);

    const primaryProj = getLayerProjectedCorners(
        primaryEval,
        frameWidth,
        frameHeight,
        aspect,
        cameraPose,
        refCameraZ,
        refFocalLength
    );

    const rotXDeg = radToDeg(primaryEval.rotation.x);
    const rotYDeg = radToDeg(primaryEval.rotation.y);
    const rotZDeg = radToDeg(primaryEval.rotation.z);

    // ============================================================================
    // 1. DRAG TO MOVE (Supports V Plane-Aware Move, G Screen Move, & Shift+A Rec!)
    // ============================================================================
    const handleStartMove = (e: React.MouseEvent) => {
        if (activeTool === 'hand') return;
        if (activeTool === 'tilt') {
            handleStart3DTilt(e);
            return;
        }
        e.stopPropagation();
        if (isLocked) return;

        beginDragTransaction();
        const startClientX = e.clientX;
        const startClientY = e.clientY;

        const startPositions: Record<string, { x: number; y: number; z: number }> =
            {};
        for (const item of activeShot.layers) {
            if (selectedLayerIds.includes(item.id)) {
                startPositions[item.id] = {
                    x: item.position.x,
                    y: item.position.y,
                    z: item.position.z,
                };
            }
        }

        const primaryStart = startPositions[layer.id] || {
            x: layer.position.x,
            y: layer.position.y,
            z: layer.position.z,
        };

        const otherUnselectedLayers = frame.layers.filter(
            (l) => !selectedLayerIds.includes(l.id) && l.visible
        );

        let lastDxFrac = 0;
        let lastDyFrac = 0;
        let lastDzFrac = 0;

        const onMouseMove = (moveEvent: MouseEvent) => {
            const dxPx = (moveEvent.clientX - startClientX) / (canvasZoom * zoom);
            const dyPx = (moveEvent.clientY - startClientY) / (canvasZoom * zoom);

            const rawDxFrac = dxPx / frameWidth;
            const rawDyFrac = dyPx / frameHeight;
            let rawDzFrac = 0;

            if (activeTool === 'select') {
                const rx = primaryEval.rotation.x;
                const ry = primaryEval.rotation.y;
                rawDzFrac =
                    -rawDxFrac * Math.sin(ry) * 0.6 + rawDyFrac * Math.sin(rx) * 0.6;
            }

            let targetPrimaryX = primaryStart.x + rawDxFrac;
            let targetPrimaryY = primaryStart.y + rawDyFrac;

            if (snapEnabled && !moveEvent.altKey) {
                const snapResult = computeSmartSnap(
                    targetPrimaryX,
                    targetPrimaryY,
                    primaryEval.size.width,
                    primaryEval.size.height,
                    otherUnselectedLayers
                );
                targetPrimaryX = snapResult.snappedX;
                targetPrimaryY = snapResult.snappedY;
                onUpdateGuides(snapResult.guides);
            } else {
                onUpdateGuides([]);
            }

            const appliedDeltaX = targetPrimaryX - primaryStart.x;
            const appliedDeltaY = targetPrimaryY - primaryStart.y;
            const appliedDeltaZ = rawDzFrac;

            if (isAnimateMode) {
                const stepX = appliedDeltaX - lastDxFrac;
                const stepY = appliedDeltaY - lastDyFrac;
                const stepZ = appliedDeltaZ - lastDzFrac;
                lastDxFrac = appliedDeltaX;
                lastDyFrac = appliedDeltaY;
                lastDzFrac = appliedDeltaZ;

                if (Math.abs(stepX) > 0.0005 || Math.abs(stepY) > 0.0005) {
                    const blkId = recordAnimatedBlockAtPlayhead(
                        activeShot.id,
                        layer.id,
                        'position',
                        { x: stepX, y: stepY, z: stepZ },
                        frame.shotLocalTimeMs,
                        'Move',
                        { skipHistory: true }
                    );
                    if (blkId) {
                        setTimelineLayerExpanded(layer.id, true);
                        selectBlock(blkId, layer.id);
                    }
                }
                return;
            }

            updateShot(
                activeShot.id,
                (s) => ({
                    ...s,
                    layers: s.layers.map((l) => {
                        const initPos = startPositions[l.id];
                        if (!initPos || isLayerEffectivelyLocked(l, s.groups)) return l;
                        return {
                            ...l,
                            position: {
                                x: Number(
                                    Math.max(-1.5, Math.min(1.5, initPos.x + appliedDeltaX)).toFixed(4)
                                ),
                                y: Number(
                                    Math.max(-1.5, Math.min(1.5, initPos.y + appliedDeltaY)).toFixed(4)
                                ),
                                z: Number(
                                    Math.max(-2, Math.min(2, initPos.z + appliedDeltaZ)).toFixed(4)
                                ),
                            },
                        };
                    }),
                }),
                { skipHistory: true }
            );
        };

        const onMouseUp = () => {
            onUpdateGuides([]);
            commitDragTransaction();
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    // ============================================================================
    // 2. CORNER & EDGE RESIZE OR ON-CANVAS CROP HANDLES
    // ============================================================================
    const handleStartResize = (e: React.MouseEvent, dir: ResizeHandleDir) => {
        e.stopPropagation();
        if (isLocked) return;

        beginDragTransaction();
        const startClientX = e.clientX;
        const startClientY = e.clientY;

        // On-Canvas Crop Mode for Image & Video Layers
        if (isCropping && (layer.kind === 'image' || layer.kind === 'video')) {
            const initCrop = (layer as ImageLayer | VideoLayer).crop || { x: 0, y: 0, width: 1, height: 1 };
            const boxW = Math.max(40, primaryEval.size.width * frameWidth * canvasZoom);
            const boxH = Math.max(40, primaryEval.size.height * frameHeight * canvasZoom);

            const onCropMove = (moveEvent: MouseEvent) => {
                const dx = (moveEvent.clientX - startClientX) / boxW;
                const dy = (moveEvent.clientY - startClientY) / boxH;

                let nextX = initCrop.x;
                let nextY = initCrop.y;
                let nextW = initCrop.width;
                let nextH = initCrop.height;

                if (dir.includes('w')) {
                    nextX = Math.max(
                        0,
                        Math.min(initCrop.x + initCrop.width - 0.1, initCrop.x + dx)
                    );
                    nextW = initCrop.width - (nextX - initCrop.x);
                }
                if (dir.includes('e')) {
                    nextW = Math.max(0.1, Math.min(1 - initCrop.x, initCrop.width + dx));
                }
                if (dir.includes('n')) {
                    nextY = Math.max(
                        0,
                        Math.min(initCrop.y + initCrop.height - 0.1, initCrop.y + dy)
                    );
                    nextH = initCrop.height - (nextY - initCrop.y);
                }
                if (dir.includes('s')) {
                    nextH = Math.max(0.1, Math.min(1 - initCrop.y, initCrop.height + dy));
                }

                updateLayer(
                    activeShot.id,
                    layer.id,
                    (l) =>
                        (l.kind === 'image' || l.kind === 'video')
                            ? {
                                ...l,
                                crop: {
                                    x: Number(nextX.toFixed(3)),
                                    y: Number(nextY.toFixed(3)),
                                    width: Number(nextW.toFixed(3)),
                                    height: Number(nextH.toFixed(3)),
                                },
                            }
                            : l,
                    { skipHistory: true }
                );
            };

            const onCropUp = () => {
                commitDragTransaction();
                window.removeEventListener('mousemove', onCropMove);
                window.removeEventListener('mouseup', onCropUp);
            };

            window.addEventListener('mousemove', onCropMove);
            window.addEventListener('mouseup', onCropUp);
            return;
        }

        const initialW =
            layer.kind === 'text' ? (layer as TextLayer).maxWidth : layer.size.width;
        const initialH =
            layer.kind === 'text'
                ? (layer as TextLayer).font.size
                : layer.size.height;
        const initialPosX = layer.position.x;
        const initialPosY = layer.position.y;

        let lastDW = 0;
        let lastDH = 0;

        const onMouseMove = (moveEvent: MouseEvent) => {
            const dxFrac =
                (moveEvent.clientX - startClientX) / (frameWidth * canvasZoom * zoom);
            const dyFrac =
                (moveEvent.clientY - startClientY) / (frameHeight * canvasZoom * zoom);

            let nextW = initialW;
            let nextH = initialH;
            let nextPosX = initialPosX;
            let nextPosY = initialPosY;

            if (dir.includes('e')) {
                nextW = Math.max(0.04, initialW + dxFrac);
                nextPosX = initialPosX + (nextW - initialW) / 2;
            }
            if (dir.includes('w')) {
                nextW = Math.max(0.04, initialW - dxFrac);
                nextPosX = initialPosX - (nextW - initialW) / 2;
            }
            if (dir.includes('s')) {
                nextH = Math.max(0.02, initialH + dyFrac);
                nextPosY = initialPosY + (nextH - initialH) / 2;
            }
            if (dir.includes('n')) {
                nextH = Math.max(0.02, initialH - dyFrac);
                nextPosY = initialPosY - (nextH - initialH) / 2;
            }

            if (isAnimateMode && layer.kind !== 'text') {
                const dW = nextW - initialW;
                const dH = nextH - initialH;
                const stepW = dW - lastDW;
                const stepH = dH - lastDH;
                lastDW = dW;
                lastDH = dH;

                if (Math.abs(stepW) > 0.0005 || Math.abs(stepH) > 0.0005) {
                    const blkId = recordAnimatedBlockAtPlayhead(
                        activeShot.id,
                        layer.id,
                        'size',
                        { x: stepW, y: stepH, z: 0 },
                        frame.shotLocalTimeMs,
                        'Resize',
                        { skipHistory: true }
                    );
                    if (blkId) {
                        setTimelineLayerExpanded(layer.id, true);
                        selectBlock(blkId, layer.id);
                    }
                }
                return;
            }

            updateLayer(
                activeShot.id,
                layer.id,
                (l) => {
                    if (l.kind === 'text') {
                        return {
                            ...l,
                            maxWidth: Number(nextW.toFixed(4)),
                            font: {
                                ...l.font,
                                size:
                                    dir.includes('n') || dir.includes('s')
                                        ? Number(Math.max(0.012, Math.min(0.18, nextH)).toFixed(4))
                                        : l.font.size,
                            },
                            position: {
                                ...l.position,
                                x: Number(nextPosX.toFixed(4)),
                                y: Number(nextPosY.toFixed(4)),
                            },
                        };
                    }
                    return {
                        ...l,
                        size: {
                            width: Number(nextW.toFixed(4)),
                            height: Number(nextH.toFixed(4)),
                        },
                        position: {
                            ...l.position,
                            x: Number(nextPosX.toFixed(4)),
                            y: Number(nextPosY.toFixed(4)),
                        },
                    };
                },
                { skipHistory: true }
            );
        };

        const onMouseUp = () => {
            commitDragTransaction();
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    // ============================================================================
    // 3. TOP 2D ROTATION KNOB (Rotate Z - Fixed Stage-Relative Angle!)
    // ============================================================================
    const handleStartRotateZ = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isLocked) return;

        const rect = overlayRootRef.current?.getBoundingClientRect();
        if (!rect) return;

        beginDragTransaction();
        // Convert projected center from stage-local pixels to screen client pixels
        const centerClientX = rect.left + primaryProj.pCenter.x * canvasZoom;
        const centerClientY = rect.top + primaryProj.pCenter.y * canvasZoom;

        const startAngle = Math.atan2(
            e.clientY - centerClientY,
            e.clientX - centerClientX
        );
        const initialZRad = layer.rotation.z;
        let prevAngle = startAngle;
        let accumulatedDelta = 0;
        let lastDeltaRad = 0;

        const onMouseMove = (moveEvent: MouseEvent) => {
            const currentAngle = Math.atan2(
                moveEvent.clientY - centerClientY,
                moveEvent.clientX - centerClientX
            );
            let diff = currentAngle - prevAngle;
            while (diff > Math.PI) diff -= 2 * Math.PI;
            while (diff < -Math.PI) diff += 2 * Math.PI;
            prevAngle = currentAngle;
            accumulatedDelta += diff;

            if (isAnimateMode) {
                const stepRad = accumulatedDelta - lastDeltaRad;
                lastDeltaRad = accumulatedDelta;
                if (Math.abs(stepRad) > 0.001) {
                    const blkId = recordAnimatedBlockAtPlayhead(
                        activeShot.id,
                        layer.id,
                        'rotation',
                        { x: 0, y: 0, z: stepRad },
                        frame.shotLocalTimeMs,
                        'Roll',
                        { skipHistory: true }
                    );
                    if (blkId) {
                        setTimelineLayerExpanded(layer.id, true);
                        selectBlock(blkId, layer.id);
                    }
                }
                return;
            }

            updateLayer(
                activeShot.id,
                layer.id,
                (l) => ({
                    ...l,
                    rotation: { ...l.rotation, z: initialZRad + accumulatedDelta },
                }),
                { skipHistory: true }
            );
        };

        const onMouseUp = () => {
            commitDragTransaction();
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    // ============================================================================
    // 4. 3D TILT DRAG (Pitch & Yaw - X and Y Rotations + Shift+A Rec!)
    // ============================================================================
    const handleStart3DTilt = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isLocked) return;

        beginDragTransaction();
        const startClientX = e.clientX;
        const startClientY = e.clientY;
        const initialXDeg = radToDeg(layer.rotation.x);
        const initialYDeg = radToDeg(layer.rotation.y);

        let lastPitchRad = 0;
        let lastYawRad = 0;

        const onMouseMove = (moveEvent: MouseEvent) => {
            const deltaYaw = (moveEvent.clientX - startClientX) * 0.45;
            const deltaPitch = -(moveEvent.clientY - startClientY) * 0.45;

            if (isAnimateMode) {
                const pitchRad = degToRad(deltaPitch);
                const yawRad = degToRad(deltaYaw);
                const stepX = pitchRad - lastPitchRad;
                const stepY = yawRad - lastYawRad;
                lastPitchRad = pitchRad;
                lastYawRad = yawRad;

                if (Math.abs(stepX) > 0.001 || Math.abs(stepY) > 0.001) {
                    const blkId = recordAnimatedBlockAtPlayhead(
                        activeShot.id,
                        layer.id,
                        'tilt',
                        { x: stepX, y: stepY, z: 0 },
                        frame.shotLocalTimeMs,
                        '3D Tilt',
                        { skipHistory: true }
                    );
                    if (blkId) {
                        setTimelineLayerExpanded(layer.id, true);
                        selectBlock(blkId, layer.id);
                    }
                }
                return;
            }

            const nextXDeg = Math.max(
                -85,
                Math.min(85, Math.round(initialXDeg + deltaPitch))
            );
            const nextYDeg = Math.max(
                -85,
                Math.min(85, Math.round(initialYDeg + deltaYaw))
            );

            updateLayer(
                activeShot.id,
                layer.id,
                (l) => ({
                    ...l,
                    rotation: {
                        ...l.rotation,
                        x: degToRad(nextXDeg),
                        y: degToRad(nextYDeg),
                    },
                }),
                { skipHistory: true }
            );
        };

        const onMouseUp = () => {
            commitDragTransaction();
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    const handleItems: {
        dir: ResizeHandleDir;
        pos: { x: number; y: number };
        cursor: string;
    }[] = [
            { dir: 'nw', pos: primaryProj.pNW, cursor: 'nwse-resize' },
            { dir: 'n', pos: primaryProj.pN, cursor: 'ns-resize' },
            { dir: 'ne', pos: primaryProj.pNE, cursor: 'nesw-resize' },
            { dir: 'e', pos: primaryProj.pE, cursor: 'ew-resize' },
            { dir: 'se', pos: primaryProj.pSE, cursor: 'nwse-resize' },
            { dir: 's', pos: primaryProj.pS, cursor: 'ns-resize' },
            { dir: 'sw', pos: primaryProj.pSW, cursor: 'nesw-resize' },
            { dir: 'w', pos: primaryProj.pW, cursor: 'ew-resize' },
        ];

    const borderColor = isLocked
        ? 'var(--accent-warning, #f59e0b)'
        : isCropping
            ? 'var(--accent-warning, #f59e0b)'
            : isAnimateMode
                ? 'var(--accent-danger, #f43f5e)'
                : 'var(--accent-primary, #0088ff)';

    return (
        <div
            ref={overlayRootRef}
            className="absolute inset-0 pointer-events-none z-30 overflow-visible select-none"
        >
            <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none">
                {selectedEvalLayers.slice(1).map((sec) => {
                    const secProj = getLayerProjectedCorners(
                        sec,
                        frameWidth,
                        frameHeight,
                        aspect,
                        cameraPose,
                        refCameraZ,
                        refFocalLength
                    );
                    const pts = `${secProj.pNW.x},${secProj.pNW.y} ${secProj.pNE.x},${secProj.pNE.y} ${secProj.pSE.x},${secProj.pSE.y} ${secProj.pSW.x},${secProj.pSW.y}`;
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
                                onMouseDown={handleStartMove}
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

                        <polygon
                            points={`${primaryProj.pNW.x},${primaryProj.pNW.y} ${primaryProj.pNE.x},${primaryProj.pNE.y} ${primaryProj.pSE.x},${primaryProj.pSE.y} ${primaryProj.pSW.x},${primaryProj.pSW.y}`}
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
                            onMouseDown={handleStartMove}
                            onDoubleClick={(e) => {
                                if (layer.kind === 'text') {
                                    e.stopPropagation();
                                    setIsEditingInlineText(true);
                                }
                            }}
                        />
                    </g>
                )}
            </svg>

            {/* TOP 2D ROTATION LOLLIPOP KNOB */}
            {!isLocked && !isCropping && !isEditingInlineText && (
                <div
                    style={{
                        left: `${primaryProj.pRot.x}px`,
                        top: `${primaryProj.pRot.y}px`,
                        transform: 'translate(-50%, -50%)',
                    }}
                    onMouseDown={handleStartRotateZ}
                    title="Drag around object to Spin / Rotate (Roll Z)"
                    className="absolute pointer-events-auto w-5 h-5 rounded-full bg-[var(--accent-primary,#0088ff)] hover:bg-[var(--accent-hover,#0077e6)] border-2 border-white shadow-xl flex items-center justify-center cursor-grab active:cursor-grabbing transition-transform duration-100 ease-out hover:scale-110"
                >
                    <RotateCw className="w-2.5 h-2.5 text-white" />
                </div>
            )}

            {/* 8 RESIZE / CROP HANDLES */}
            {!isLocked &&
                !isEditingInlineText &&
                handleItems.map((h) =>
                    h.dir === 'ne' ? (
                        <div
                            key={h.dir}
                            onMouseDown={(e) => handleStartResize(e, h.dir)}
                            style={{
                                left: `${h.pos.x}px`,
                                top: `${h.pos.y}px`,
                                transform: 'translate(-50%, -50%)',
                                cursor: h.cursor,
                            }}
                            title={isCropping ? "Crop handle" : "Scale handle"}
                            className={`w-5 h-5 rounded-full ${
                                isCropping
                                    ? 'bg-[var(--accent-warning,#f59e0b)] border-black'
                                    : isAnimateMode
                                        ? 'bg-[var(--accent-danger,#f43f5e)] border-white'
                                        : 'bg-[#0088ff] border-white'
                            } border-2 shadow-xl flex items-center justify-center absolute pointer-events-auto hover:scale-125 transition-transform duration-100 ease-out z-20`}
                        >
                            <Sparkles className="w-2.5 h-2.5 text-white" />
                        </div>
                    ) : (
                        <div
                            key={h.dir}
                            onMouseDown={(e) => handleStartResize(e, h.dir)}
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
                    )
                )}

            {/* INLINE TEXT EDITOR OR CENTER PILLS */}
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
                                updateLayer(activeShot.id, layer.id, (l) =>
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
                    <div className="px-2 py-1 rounded-full bg-amber-950/90 border border-amber-400/50 text-amber-300 text-[10px] font-mono flex items-center gap-1 shadow-lg">
                        <Lock className="w-3 h-3" /> Locked
                    </div>
                ) : isCropping ? (
                    <div className="px-2.5 py-1 rounded-full bg-[var(--accent-warning,#f59e0b)] text-black text-[10px] font-semibold flex items-center gap-1 shadow-lg">
                        <Crop className="w-3 h-3" /> Drag Corners to Crop
                    </div>
                ) : (
                    <div className="flex items-center gap-1.5 opacity-85 hover:opacity-100 transition-opacity duration-100">
                        {layer.kind === 'text' && (
                            <button
                                onMouseDown={(e) => {
                                    e.stopPropagation();
                                    setIsEditingInlineText(true);
                                }}
                                className="px-2 h-6 rounded-full bg-[var(--bg-surface,#161619)]/90 hover:bg-[var(--accent-primary,#0088ff)] border border-white/25 shadow-lg flex items-center gap-1 cursor-pointer text-[10px] font-medium text-white transition-colors duration-100"
                            >
                                <Type className="w-3 h-3" />
                                <span>Edit</span>
                            </button>
                        )}

                        <div
                            onMouseDown={handleStartMove}
                            title="Drag to move in 3D space"
                            className="w-6 h-6 rounded-full bg-[var(--accent-primary,#0088ff)] hover:bg-[var(--accent-hover,#0077e6)] border border-white/80 shadow-lg flex items-center justify-center cursor-move transition-colors duration-100"
                        >
                            <Move className="w-3 h-3 text-white" />
                        </div>

                        <div
                            onMouseDown={handleStart3DTilt}
                            title="Drag in any direction to Tilt in 3D (Pitch & Yaw)"
                            className="px-2 h-6 rounded-full bg-[var(--bg-surface,#161619)]/90 hover:bg-[var(--bg-muted,#242428)] border border-[var(--border-medium,rgba(255,255,255,0.12))] shadow-lg flex items-center gap-1 cursor-grab active:cursor-grabbing text-[10px] font-medium text-white transition-colors duration-100"
                        >
                            <Compass className="w-3 h-3" />
                            <span>Tilt</span>
                        </div>
                    </div>
                )}
            </div>

            {/* FLOATING CROP PILL BUTTON DIRECTLY BENEATH SELECTED ELEMENT */}
            {(layer.kind === 'image' || layer.kind === 'video') && !isLocked && !isEditingInlineText && (
                <div
                    style={{
                        left: `${primaryProj.pS.x}px`,
                        top: `${primaryProj.pS.y + 12}px`,
                        transform: 'translate(-50%, 0)',
                    }}
                    className="absolute pointer-events-auto z-40"
                >
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            useSelectionStore.getState().setIsCropping(!isCropping);
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium shadow-xl cursor-pointer transition border ${
                            isCropping
                                ? 'bg-[#0088ff] text-white border-white'
                                : 'bg-[#18181b]/95 hover:bg-[#27272a] text-white border-white/15'
                        }`}
                        title="Crop image or video"
                    >
                        <Crop className="w-3 h-3" />
                        <span>{isCropping ? 'Done' : 'Crop'}</span>
                    </button>
                </div>
            )}

            {/* BOTTOM HUD COORDINATE PILL */}
            {!isEditingInlineText && (
                <div
                    style={{
                        left: `${primaryProj.pS.x}px`,
                        top: `${primaryProj.pS.y + ((layer.kind === 'image' || layer.kind === 'video') && !isLocked ? 44 : 12)}px`,
                        transform: 'translate(-50%, 0)',
                    }}
                    className="absolute whitespace-nowrap px-2 py-0.5 rounded-full bg-[var(--bg-surface,#161619)]/90 border border-[var(--border-subtle,rgba(255,255,255,0.07))] text-[10px] font-mono tabular-nums text-[var(--text-muted,#a1a1aa)] shadow-xl pointer-events-none flex items-center gap-1.5"
                >
                    {isAnimateMode && (
                        <span className="px-1.5 py-0.2 rounded bg-[var(--accent-danger,#f43f5e)] text-white font-bold">
                            REC ⇧A
                        </span>
                    )}
                    <span>
                        {Math.round(primaryEval.position.x * 1920)},{' '}
                        {Math.round(primaryEval.position.y * 1080)}, Z:{' '}
                        {Math.round(primaryEval.position.z * 500)}
                    </span>
                    <span className="text-[var(--text-disabled,#71717a)]">|</span>
                    <span className="text-[var(--accent-primary,#0088ff)]">
                        {rotXDeg}° / {rotYDeg}° / {rotZDeg}°
                    </span>
                </div>
            )}
        </div>
    );
};
