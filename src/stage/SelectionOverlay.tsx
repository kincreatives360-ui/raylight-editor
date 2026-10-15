// src/stage/SelectionOverlay.tsx
import React, { useState } from 'react';
import { Move, RotateCw, Compass, Lock, Crop, Type } from 'lucide-react';
import type { Shot, TextLayer } from '../model/types';
import { degToRad, radToDeg } from '../model/defaults';
import type {
    EvaluatedLayerWithEffects,
    EvaluatedProjectFrame,
} from '../engine/evaluateShot';
import { useProjectStore } from '../store/useProjectStore';
import { useSelectionStore } from '../store/useSelectionStore';
import { computeSmartSnap, type SnapGuideLine } from './Guides';

interface SelectionOverlayProps {
    frame: EvaluatedProjectFrame;
    selectedLayerIds: string[];
    frameWidth: number;
    frameHeight: number;
    snapEnabled: boolean;
    onUpdateGuides: (guides: SnapGuideLine[]) => void;
    onSelectLayer: (layerId: string, multiSelect?: boolean) => void;
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
}) => {
    const {
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
    } = useSelectionStore();

    const [isEditingInlineText, setIsEditingInlineText] = useState(false);

    const activeShot: Shot = frame.activeShot;
    const selectedEvalLayers: EvaluatedLayerWithEffects[] = frame.layers.filter(
        (l) => selectedLayerIds.includes(l.id) && l.visible
    );

    if (selectedEvalLayers.length === 0) return null;

    const primaryEval = selectedEvalLayers[0];
    const { layer } = primaryEval;
    const isLocked = layer.locked;

    // Combine camera zoom and workspace canvasZoom so mouse deltas match screen pixels
    const cameraZoom = frame.camera.zoom;
    const effectiveZoom = cameraZoom * canvasZoom;
    const camOffsetX = -frame.camera.target.x * frameWidth * cameraZoom;
    const camOffsetY = -frame.camera.target.y * frameHeight * cameraZoom;

    const boxWidth =
        Math.max(24, primaryEval.size.width * frameWidth) *
        primaryEval.scale.x *
        cameraZoom;
    const boxHeight =
        Math.max(24, primaryEval.size.height * frameHeight) *
        primaryEval.scale.y *
        cameraZoom;

    const centerX =
        frameWidth / 2 + primaryEval.position.x * frameWidth * cameraZoom + camOffsetX;
    const centerY =
        frameHeight / 2 + primaryEval.position.y * frameHeight * cameraZoom + camOffsetY;

    const rotXDeg = radToDeg(primaryEval.rotation.x);
    const rotYDeg = radToDeg(primaryEval.rotation.y);
    const rotZDeg = radToDeg(primaryEval.rotation.z);

    // ============================================================================
    // 1. DRAG TO MOVE (Supports V Plane-Aware Move, G Screen Move, & Shift+A Rec!)
    // ============================================================================
    const handleStartMove = (e: React.MouseEvent) => {
        if (activeTool === 'hand') return; // Hand tool pans the canvas instead
        if (activeTool === 'tilt') {
            handleStart3DTilt(e);
            return;
        }
        e.stopPropagation();
        if (isLocked) return;

        beginDragTransaction();
        const startClientX = e.clientX;
        const startClientY = e.clientY;

        const startPositions: Record<string, { x: number; y: number; z: number }> = {};
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
            const dxPx = (moveEvent.clientX - startClientX) / effectiveZoom;
            const dyPx = (moveEvent.clientY - startClientY) / effectiveZoom;

            let rawDxFrac = dxPx / frameWidth;
            let rawDyFrac = dyPx / frameHeight;
            let rawDzFrac = 0;

            // V (Select Tool): Plane-Aware Dragging!
            // A tilted layer slides along its own 3D plane (adjusting Z depth with X/Y)
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

            // If Shift + A (Animate Mode) is ON, record movement as a Block ending at playhead!
            if (isAnimateMode) {
                const stepDx = appliedDeltaX - lastDxFrac;
                const stepDy = appliedDeltaY - lastDyFrac;
                const stepDz = appliedDeltaZ - lastDzFrac;
                lastDxFrac = appliedDeltaX;
                lastDyFrac = appliedDeltaY;
                lastDzFrac = appliedDeltaZ;

                if (
                    Math.abs(stepDx) > 0.0001 ||
                    Math.abs(stepDy) > 0.0001 ||
                    Math.abs(stepDz) > 0.0001
                ) {
                    const blkId = recordAnimatedBlockAtPlayhead(
                        activeShot.id,
                        layer.id,
                        'position',
                        { x: stepDx, y: stepDy, z: stepDz },
                        frame.shotLocalTimeMs,
                        'Move',
                        { skipHistory: true }
                    );
                    if (blkId) selectBlock(blkId, layer.id);
                }
                return;
            }

            // Standard Design Edit: changes how the layer sits at rest
            updateShot(
                activeShot.id,
                (s) => ({
                    ...s,
                    layers: s.layers.map((l) => {
                        const initPos = startPositions[l.id];
                        if (!initPos || l.locked) return l;
                        return {
                            ...l,
                            position: {
                                x: Number(
                                    Math.max(-1.2, Math.min(1.2, initPos.x + appliedDeltaX)).toFixed(4)
                                ),
                                y: Number(
                                    Math.max(-1.2, Math.min(1.2, initPos.y + appliedDeltaY)).toFixed(4)
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

        // On-Canvas Crop Mode for Image Layers
        if (isCropping && layer.kind === 'image') {
            const initCrop = layer.crop || { x: 0, y: 0, width: 1, height: 1 };
            const onCropMove = (moveEvent: MouseEvent) => {
                const dx = (moveEvent.clientX - startClientX) / (boxWidth * canvasZoom);
                const dy = (moveEvent.clientY - startClientY) / (boxHeight * canvasZoom);

                let nextX = initCrop.x;
                let nextY = initCrop.y;
                let nextW = initCrop.width;
                let nextH = initCrop.height;

                if (dir.includes('w')) {
                    nextX = Math.max(0, Math.min(initCrop.x + initCrop.width - 0.1, initCrop.x + dx));
                    nextW = initCrop.width - (nextX - initCrop.x);
                }
                if (dir.includes('e')) {
                    nextW = Math.max(0.1, Math.min(1 - initCrop.x, initCrop.width + dx));
                }
                if (dir.includes('n')) {
                    nextY = Math.max(0, Math.min(initCrop.y + initCrop.height - 0.1, initCrop.y + dy));
                    nextH = initCrop.height - (nextY - initCrop.y);
                }
                if (dir.includes('s')) {
                    nextH = Math.max(0.1, Math.min(1 - initCrop.y, initCrop.height + dy));
                }

                updateLayer(
                    activeShot.id,
                    layer.id,
                    (l) =>
                        l.kind === 'image'
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

        const initialPosX = layer.position.x;
        const initialPosY = layer.position.y;
        const initialW =
            layer.kind === 'text' ? layer.maxWidth : layer.size.width;
        const initialH =
            layer.kind === 'text' ? layer.font.size : layer.size.height;

        let lastDW = 0;
        let lastDH = 0;

        const onMouseMove = (moveEvent: MouseEvent) => {
            const dxFrac =
                (moveEvent.clientX - startClientX) / (frameWidth * effectiveZoom);
            const dyFrac =
                (moveEvent.clientY - startClientY) / (frameHeight * effectiveZoom);

            let nextW = initialW;
            let nextH = initialH;
            let nextPosX = initialPosX;
            let nextPosY = initialPosY;

            if (dir.includes('e')) {
                nextW = Math.max(0.06, initialW + dxFrac);
                nextPosX = initialPosX + (nextW - initialW) / 2;
            }
            if (dir.includes('w')) {
                nextW = Math.max(0.06, initialW - dxFrac);
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
                    if (blkId) selectBlock(blkId, layer.id);
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
    // 3. TOP 2D ROTATION KNOB (Rotate Z)
    // ============================================================================
    const handleStartRotateZ = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isLocked) return;

        beginDragTransaction();
        const startClientX = e.clientX;
        const initialZDeg = radToDeg(layer.rotation.z);
        let lastDeltaRad = 0;

        const onMouseMove = (moveEvent: MouseEvent) => {
            const deltaDeg = (moveEvent.clientX - startClientX) * 0.65;

            if (isAnimateMode) {
                const totalRad = degToRad(deltaDeg);
                const stepRad = totalRad - lastDeltaRad;
                lastDeltaRad = totalRad;
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
                    if (blkId) selectBlock(blkId, layer.id);
                }
                return;
            }

            const nextZDeg = Math.max(
                -180,
                Math.min(180, Math.round(initialZDeg + deltaDeg))
            );

            updateLayer(
                activeShot.id,
                layer.id,
                (l) => ({
                    ...l,
                    rotation: {
                        ...l.rotation,
                        z: degToRad(nextZDeg),
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

    // ============================================================================
    // 4. 3D TILT DRAG (Activated by Y Tilt Tool or Center 3D Tilt Pill)
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
                    if (blkId) selectBlock(blkId, layer.id);
                }
                return;
            }

            const nextXDeg = Math.max(
                -80,
                Math.min(80, Math.round(initialXDeg + deltaPitch))
            );
            const nextYDeg = Math.max(
                -80,
                Math.min(80, Math.round(initialYDeg + deltaYaw))
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

    const handles: {
        dir: ResizeHandleDir;
        className: string;
        cursor: string;
    }[] = [
            { dir: 'nw', className: '-top-1.5 -left-1.5', cursor: 'nwse-resize' },
            {
                dir: 'n',
                className: '-top-1.5 left-1/2 -translate-x-1/2',
                cursor: 'ns-resize',
            },
            { dir: 'ne', className: '-top-1.5 -right-1.5', cursor: 'nesw-resize' },
            {
                dir: 'e',
                className: 'top-1/2 -right-1.5 -translate-y-1/2',
                cursor: 'ew-resize',
            },
            { dir: 'se', className: '-bottom-1.5 -right-1.5', cursor: 'nwse-resize' },
            {
                dir: 's',
                className: '-bottom-1.5 left-1/2 -translate-x-1/2',
                cursor: 'ns-resize',
            },
            { dir: 'sw', className: '-bottom-1.5 -left-1.5', cursor: 'nesw-resize' },
            {
                dir: 'w',
                className: 'top-1/2 -left-1.5 -translate-y-1/2',
                cursor: 'ew-resize',
            },
        ];

    // Outline color reflects active mode (Rose = Shift+A Animate Rec, Amber = Crop/Locked, Sky/Indigo = Design)
    const borderColor = isLocked
        ? '1.5px dashed #f59e0b'
        : isCropping
            ? '2px dashed #fbbf24'
            : isAnimateMode
                ? '2px solid #f43f5e'
                : activeTool === 'tilt'
                    ? '2px solid #a855f7'
                    : '2px solid #38bdf8';

    return (
        <div className="absolute inset-0 pointer-events-none z-30 overflow-visible">
            {/* Secondary Multi-Selected Layer Outlines */}
            {selectedEvalLayers.slice(1).map((sec) => {
                const secW =
                    Math.max(24, sec.size.width * frameWidth) * sec.scale.x * cameraZoom;
                const secH =
                    Math.max(24, sec.size.height * frameHeight) * sec.scale.y * cameraZoom;
                const secCX =
                    frameWidth / 2 + sec.position.x * frameWidth * cameraZoom + camOffsetX;
                const secCY =
                    frameHeight / 2 + sec.position.y * frameHeight * cameraZoom + camOffsetY;
                const secRotZ = radToDeg(sec.rotation.z);

                return (
                    <div
                        key={sec.id}
                        onMouseDown={handleStartMove}
                        onClick={(e) => {
                            e.stopPropagation();
                            onSelectLayer(sec.id, e.shiftKey || e.metaKey || e.ctrlKey);
                        }}
                        className="absolute pointer-events-auto cursor-move border-2 border-dashed border-sky-400"
                        style={{
                            width: `${secW}px`,
                            height: `${secH}px`,
                            left: `${secCX - secW / 2}px`,
                            top: `${secCY - secH / 2}px`,
                            transform: `rotate(${secRotZ}deg)`,
                        }}
                    >
                        <span className="absolute -top-5 left-0 px-1.5 py-0.5 rounded bg-sky-600 text-white text-[9px] font-mono">
                            + {sec.name}
                        </span>
                    </div>
                );
            })}

            {/* Primary Selected Layer Gizmo Box */}
            <div
                onMouseDown={handleStartMove}
                onDoubleClick={(e) => {
                    if (layer.kind === 'text') {
                        e.stopPropagation();
                        setIsEditingInlineText(true);
                    }
                }}
                className={`absolute pointer-events-auto ${isLocked
                        ? 'cursor-not-allowed'
                        : activeTool === 'tilt'
                            ? 'cursor-grab active:cursor-grabbing'
                            : 'cursor-move'
                    }`}
                style={{
                    width: `${boxWidth}px`,
                    height: `${boxHeight}px`,
                    left: `${centerX - boxWidth / 2}px`,
                    top: `${centerY - boxHeight / 2}px`,
                    transform: `rotate(${rotZDeg}deg)`,
                    border: borderColor,
                    boxShadow: '0 0 0 1px rgba(0,0,0,0.5)',
                }}
            >
                {/* Top Lollipop 2D Rotation Handle (Rotate Z) */}
                {!isLocked && !isCropping && !isEditingInlineText && (
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex flex-col items-center">
                        <div
                            onMouseDown={handleStartRotateZ}
                            title="Drag left/right to spin 2D Roll (Rotate Z)"
                            className="w-5 h-5 rounded-full bg-sky-500 hover:bg-sky-400 border-2 border-white shadow-md flex items-center justify-center cursor-grab active:cursor-grabbing transition transform hover:scale-110"
                        >
                            <RotateCw className="w-2.5 h-2.5 text-white" />
                        </div>
                        <div className="w-0.5 h-3 bg-sky-400" />
                    </div>
                )}

                {/* Center Gizmo Pills / Inline Text Editor */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    {isEditingInlineText && layer.kind === 'text' ? (
                        <div className="absolute inset-0 p-1 pointer-events-auto z-40">
                            <textarea
                                autoFocus
                                value={(layer as TextLayer).content}
                                onChange={(e) =>
                                    updateLayer(activeShot.id, layer.id, (l) => ({
                                        ...l,
                                        content: e.target.value,
                                    }))
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
                                style={{
                                    fontFamily: (layer as TextLayer).font.family || 'Inter, sans-serif',
                                    fontSize: `${Math.max(12, (layer as TextLayer).font.size * frameHeight * cameraZoom)}px`,
                                    fontWeight: (layer as TextLayer).font.weight || 600,
                                    color: (layer as TextLayer).font.color || '#ffffff',
                                    textAlign: (layer as TextLayer).font.align || 'center',
                                    letterSpacing: `${(layer as TextLayer).font.letterSpacing || 0}em`,
                                }}
                                className="w-full h-full bg-black/85 border-2 border-sky-400 rounded-lg p-2 text-white resize-none outline-none shadow-2xl leading-normal"
                            />
                            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[9px] font-mono text-sky-300 bg-sky-950/90 px-2 py-0.5 rounded border border-sky-500/40 whitespace-nowrap shadow pointer-events-none">
                                Press Esc or ⌘+Enter to commit
                            </div>
                        </div>
                    ) : isLocked ? (
                        <div className="px-2 py-1 rounded-full bg-amber-950/90 border border-amber-400/50 text-amber-300 text-[10px] font-mono flex items-center gap-1 shadow-lg">
                            <Lock className="w-3 h-3" /> Locked
                        </div>
                    ) : isCropping ? (
                        <div className="px-2.5 py-1 rounded-full bg-amber-500 text-black text-[10px] font-semibold flex items-center gap-1 shadow-lg">
                            <Crop className="w-3 h-3" /> Drag Handles to Crop Image
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5 pointer-events-auto">
                            {layer.kind === 'text' && (
                                <button
                                    onMouseDown={(e) => {
                                        e.stopPropagation();
                                        setIsEditingInlineText(true);
                                    }}
                                    title="Edit text content (or double-click text box)"
                                    className="px-2 h-7 rounded-full bg-sky-600/95 hover:bg-sky-500 border border-white/80 shadow-lg flex items-center gap-1 cursor-pointer text-[10px] font-semibold text-white transition transform hover:scale-105"
                                >
                                    <Type className="w-3.5 h-3.5" />
                                    <span>Edit</span>
                                </button>
                            )}

                            <div
                                onMouseDown={handleStartMove}
                                title={
                                    activeTool === 'move'
                                        ? 'Move Tool (G): Drag in flat screen space'
                                        : 'Select Tool (V): Drag along layer 3D plane'
                                }
                                className="w-7 h-7 rounded-full bg-sky-500/90 hover:bg-sky-400 border border-white/80 shadow-lg flex items-center justify-center cursor-move transition transform hover:scale-105"
                            >
                                <Move className="w-3.5 h-3.5 text-white" />
                            </div>

                            <div
                                onMouseDown={handleStart3DTilt}
                                title="Drag in any direction to Tilt in 3D (Y)"
                                className="px-2.5 h-7 rounded-full bg-purple-600/95 hover:bg-purple-500 border border-white/80 shadow-lg flex items-center gap-1 cursor-grab active:cursor-grabbing text-[10px] font-semibold text-white transition transform hover:scale-105"
                            >
                                <Compass className="w-3.5 h-3.5" />
                                <span>3D Tilt</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* 8 Corner & Edge Resize / Crop Handles */}
                {!isLocked &&
                    !isEditingInlineText &&
                    handles.map((h) => (
                        <div
                            key={h.dir}
                            onMouseDown={(e) => handleStartResize(e, h.dir)}
                            style={{ cursor: h.cursor }}
                            className={`w-3 h-3 rounded-xs border-2 shadow absolute ${isCropping
                                    ? 'bg-amber-400 border-black'
                                    : isAnimateMode
                                        ? 'bg-rose-500 border-white'
                                        : 'bg-white border-sky-600'
                                } ${h.className} hover:scale-125 transition`}
                        />
                    ))}

                {/* Bottom HUD Coordinate & Mode Pill */}
                <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-0.5 rounded bg-black/85 border border-white/15 text-[10px] font-mono text-gray-200 shadow-lg pointer-events-none flex items-center gap-1.5">
                    {isAnimateMode && (
                        <span className="px-1.5 py-0.2 rounded bg-rose-600 text-white font-bold">
                            REC ⇧A
                        </span>
                    )}
                    <span>
                        Pos: ({primaryEval.position.x.toFixed(2)},{' '}
                        {primaryEval.position.y.toFixed(2)}, Z:{' '}
                        {primaryEval.position.z.toFixed(2)})
                    </span>
                    <span className="text-gray-500">|</span>
                    <span className="text-purple-300">
                        Tilt: {rotXDeg}° / {rotYDeg}° / {rotZDeg}°
                    </span>
                    {layer.kind === 'text' && !isEditingInlineText && (
                        <>
                            <span className="text-gray-500">|</span>
                            <span className="text-sky-300">Double-click to edit text</span>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};