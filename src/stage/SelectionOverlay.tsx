// src/stage/SelectionOverlay.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { SelectionOverlayVisuals, type ResizeHandleDir } from './SelectionOverlayVisuals';
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
    getLayerProjectedCorners,
    getReferencePlaneDimensions,
} from './webgl/cameraMath';
import { useCameraPose } from './CameraPoseContext';
import { getDevicePlacementSize, isFixedDeviceFrame, resizeDeviceFromHandle, SCREEN_PLANE_Z } from '../model/deviceFrame';
import { createPointerDragLifecycle } from './selectionDragLifecycle';
import { unionRects, type Rect } from './selectionGeometry';
import { createVirtualCamera, unprojectScreenToWorldPlane } from './lightingMath';

interface SelectionOverlayProps {
    frame: EvaluatedProjectFrame;
    selectedLayerIds: string[];
    frameWidth: number;
    frameHeight: number;
    snapEnabled: boolean;
    onUpdateGuides: (guides: SnapGuideLine[]) => void;
    onSelectLayer: (layerId: string, multiSelect?: boolean, shiftKey?: boolean) => void;
}

interface GroupTransformAnimationState {
    lastPositionDeltas: Map<string, { x: number; y: number }>;
    lastScaleX: number;
    lastScaleY: number;
    lastRotationDelta: number;
}

function createGroupTransformAnimationState(): GroupTransformAnimationState {
    return {
        lastPositionDeltas: new Map(),
        lastScaleX: 1,
        lastScaleY: 1,
        lastRotationDelta: 0,
    };
}

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
        project,
        updateLayer,
        updateShot,
        recordAnimatedBlockAtPlayhead,
        beginDragTransaction,
        commitDragTransaction,
        cancelDragTransaction,
    } = useProjectStore();

    const {
        activeTool,
        isAnimateMode,
        isCropping,
        canvasZoom,
        selectBlock,
        selectedBlockId,
        setTimelineLayerExpanded,
    } = useSelectionStore();

    const overlayRootRef = useRef<HTMLDivElement | null>(null);
    const cancelActiveDragRef = useRef<(() => void) | null>(null);
    const [isEditingInlineText, setIsEditingInlineText] = useState(false);
    const { cameraPose, targetAspect: aspect, evaluateCustomPose } = useCameraPose();
    useEffect(() => () => cancelActiveDragRef.current?.(), []);

    const activeShot: Shot = frame.activeShot;
    const selectedLayerSet = useMemo(() => new Set(selectedLayerIds), [selectedLayerIds]);
    const selectedEvalLayers: EvaluatedLayerWithEffects[] = frame.layers.filter(
        (l) => selectedLayerSet.has(l.id)
    );

    if (selectedEvalLayers.length === 0) return null;

    const primaryEval = selectedEvalLayers[0];
    const { layer } = primaryEval;
    const isLocked = isLayerEffectivelyLocked(layer, activeShot.groups);
    const refCameraZ = evaluateCustomPose({
        position: { x: 0, y: 0, z: 2.65 },
        rotation: { x: 0, y: 0, z: 0 },
        focalLength: 50,
    }).position?.z ?? 2.65;
    const refFocalLength = 50;
    const zoom = Math.max(0.15, frame.camera.zoom || 1);

    // The shared layout projects the resolved body; crop handles use the display aperture.
    const projectCorners = (ev: EvaluatedLayerWithEffects) => {
        return getLayerProjectedCorners(
            ev,
            frameWidth,
            frameHeight,
            aspect,
            cameraPose,
            refCameraZ,
            refFocalLength,
            isCropping ? 'screen' : 'body'
        );
    };

    const primaryProj = projectCorners(primaryEval);
    const projectedLayerRects: Rect[] = selectedEvalLayers.map((selectedLayer) => {
        const points = projectCorners(selectedLayer).corners;
        return {
            left: Math.min(...points.map((point) => point.x)),
            top: Math.min(...points.map((point) => point.y)),
            right: Math.max(...points.map((point) => point.x)),
            bottom: Math.max(...points.map((point) => point.y)),
        };
    });
    const groupBounds = unionRects(projectedLayerRects);
    const isGroupSelection = selectedEvalLayers.length > 1;

    const selectedBlock = layer?.blocks?.find((b) => b.id === selectedBlockId);
    const isMotionBlock = Boolean(selectedBlock && (selectedBlock.property === 'position' || selectedBlock.property === 'followPath'));
    const motionAmt = selectedBlock
        ? typeof selectedBlock.amount === 'object'
            ? selectedBlock.amount
            : { x: selectedBlock.amount, y: 0, z: 0 }
        : { x: 0, y: 0, z: 0 };
    const motionDeltaX = motionAmt.x * frameWidth * zoom;
    const motionDeltaY = motionAmt.y * frameHeight * zoom;
    const motionStartPoint = primaryProj.pCenter;
    const motionEndPoint = {
        x: primaryProj.pCenter.x + motionDeltaX,
        y: primaryProj.pCenter.y + motionDeltaY,
    };
    const motionMidControl = {
        x: (motionStartPoint.x + motionEndPoint.x) / 2,
        y: (motionStartPoint.y + motionEndPoint.y) / 2 - 25,
    };

    const handleStartDragMotionEnd = (e: React.PointerEvent) => {
        e.stopPropagation();
        e.preventDefault();
        if (!selectedBlock) return;
        const startX = e.clientX;
        const startY = e.clientY;
        const initAmtX = motionAmt.x;
        const initAmtY = motionAmt.y;

        bindPointerDrag(
            e,
            (moveEvent) => {
                const dxPx = (moveEvent.clientX - startX) / (canvasZoom * zoom);
                const dyPx = (moveEvent.clientY - startY) / (canvasZoom * zoom);
                const deltaFracX = dxPx / frameWidth;
                const deltaFracY = dyPx / frameHeight;
                const nextX = Number((initAmtX + deltaFracX).toFixed(4));
                const nextY = Number((initAmtY + deltaFracY).toFixed(4));

                updateShot(
                    activeShot.id,
                    (s) => ({
                        ...s,
                        layers: s.layers.map((l) =>
                            l.id === layer.id
                                ? {
                                    ...l,
                                    blocks: l.blocks.map((b) =>
                                        b.id === selectedBlock.id
                                            ? { ...b, amount: { ...motionAmt, x: nextX, y: nextY } }
                                            : b
                                    ),
                                }
                                : l
                        ),
                    }),
                    { skipHistory: true }
                );
            }
        );
    };

    const bindPointerDrag = (
        e: React.PointerEvent | React.MouseEvent,
        onMove: (moveEvent: PointerEvent | MouseEvent) => void,
        onEnd?: () => void
    ) => {
        cancelActiveDragRef.current?.();
        const target = e.currentTarget as Element;
        const pointerId = 'pointerId' in e ? e.pointerId : null;
        cancelActiveDragRef.current = createPointerDragLifecycle({
            pointerId,
            target,
            begin: beginDragTransaction,
            commit: commitDragTransaction,
            cancel: cancelDragTransaction,
            onMove,
            onEnd: () => {
                if (cancelActiveDragRef.current) cancelActiveDragRef.current = null;
                onEnd?.();
            },
        });
    };

    const applyGroupTransform = (
        scaleX: number,
        scaleY: number,
        anchor: { x: number; y: number },
        rotationDelta = 0,
        animationState = createGroupTransformAnimationState()
    ) => {
        if (!groupBounds) return;
        const initialLayers = new Map(activeShot.layers.map((item) => [item.id, item]));
        const projectedCenters = new Map(selectedEvalLayers.map((item) => [
            item.id,
            projectCorners(item).pCenter,
        ]));
        const virtualCamera = createVirtualCamera(cameraPose, aspect, refCameraZ, refFocalLength);
        const { planeW, planeH } = getReferencePlaneDimensions(aspect, refCameraZ, refFocalLength);
        const cos = Math.cos(rotationDelta);
        const sin = Math.sin(rotationDelta);
        const transformedLayers = new Map<string, (typeof activeShot.layers)[number]>();

        const recordAnimatedTransform = (
            layerId: string,
            property: 'size' | 'position' | 'rotation',
            amount: { x: number; y: number; z: number },
            label: string
        ) => {
            if (Math.abs(amount.x) <= 0.0005 && Math.abs(amount.y) <= 0.0005 && Math.abs(amount.z) <= 0.0005) return;
            const blockId = recordAnimatedBlockAtPlayhead(
                activeShot.id,
                layerId,
                property,
                amount,
                frame.shotLocalTimeMs,
                label,
                { skipHistory: true }
            );
            if (blockId) {
                setTimelineLayerExpanded(layerId, true);
                selectBlock(blockId, layerId);
            }
        };

        for (const evaluated of selectedEvalLayers) {
            const initial = initialLayers.get(evaluated.id);
            const center = projectedCenters.get(evaluated.id);
            if (
                !initial ||
                !center ||
                !selectedLayerSet.has(evaluated.id) ||
                isLayerEffectivelyLocked(initial, activeShot.groups)
            ) {
                continue;
            }

            let targetX = anchor.x + (center.x - anchor.x) * scaleX;
            let targetY = anchor.y + (center.y - anchor.y) * scaleY;
            if (rotationDelta !== 0) {
                const offsetX = center.x - anchor.x;
                const offsetY = center.y - anchor.y;
                targetX = anchor.x + offsetX * cos - offsetY * sin;
                targetY = anchor.y + offsetX * sin + offsetY * cos;
            }

            const localCenterOffset = new THREE.Vector3(
                0,
                0,
                SCREEN_PLANE_Z * (evaluated.scale.z || 1)
            ).applyEuler(new THREE.Euler(
                -evaluated.rotation.x,
                evaluated.rotation.y,
                -(evaluated.rotation.z + rotationDelta),
                'XYZ'
            ));
            const worldPosition = unprojectScreenToWorldPlane(
                targetX,
                targetY,
                evaluated.position.z * 0.85 + localCenterOffset.z,
                virtualCamera,
                frameWidth,
                frameHeight
            );
            const nextX = (worldPosition.x - localCenterOffset.x) / planeW;
            const nextY = -(worldPosition.y - localCenterOffset.y) / planeH;
            const position = {
                ...initial.position,
                x: Number((initial.position.x + nextX - evaluated.position.x).toFixed(4)),
                y: Number((initial.position.y + nextY - evaluated.position.y).toFixed(4)),
            };
            const rotation = {
                ...initial.rotation,
                z: initial.rotation.z + rotationDelta,
            };

            if (initial.kind === 'text') {
                transformedLayers.set(initial.id, {
                    ...initial,
                    position,
                    rotation,
                    maxWidth: Number(Math.max(0.04, initial.maxWidth * scaleX).toFixed(4)),
                    font: {
                        ...initial.font,
                        size: Number(Math.max(0.012, initial.font.size * scaleY).toFixed(4)),
                    },
                });
            } else {
                transformedLayers.set(initial.id, {
                    ...initial,
                    position,
                    rotation,
                    size: {
                        width: Number(Math.max(0.04, initial.size.width * scaleX).toFixed(4)),
                        height: Number(Math.max(0.02, initial.size.height * scaleY).toFixed(4)),
                    },
                });
            }

            if (isAnimateMode) {
                const previousPositionDelta = animationState.lastPositionDeltas.get(initial.id) ?? { x: 0, y: 0 };
                const positionDelta = {
                    x: Number((position.x - initial.position.x).toFixed(4)),
                    y: Number((position.y - initial.position.y).toFixed(4)),
                };
                recordAnimatedTransform(
                    initial.id,
                    'position',
                    {
                        x: Number((positionDelta.x - previousPositionDelta.x).toFixed(4)),
                        y: Number((positionDelta.y - previousPositionDelta.y).toFixed(4)),
                        z: 0,
                    },
                    'Move'
                );
                animationState.lastPositionDeltas.set(initial.id, positionDelta);
                recordAnimatedTransform(
                    initial.id,
                    'size',
                    {
                        x: Number((evaluated.size.width * (scaleX - animationState.lastScaleX)).toFixed(4)),
                        y: Number((evaluated.size.height * (scaleY - animationState.lastScaleY)).toFixed(4)),
                        z: 0,
                    },
                    'Resize'
                );
                recordAnimatedTransform(
                    initial.id,
                    'rotation',
                    { x: 0, y: 0, z: Number((rotationDelta - animationState.lastRotationDelta).toFixed(4)) },
                    'Roll'
                );
            }
        }

        if (isAnimateMode) {
            animationState.lastScaleX = scaleX;
            animationState.lastScaleY = scaleY;
            animationState.lastRotationDelta = rotationDelta;
            return;
        }

        updateShot(
            activeShot.id,
            (shot) => ({
                ...shot,
                layers: shot.layers.map((item) => transformedLayers.get(item.id) ?? item),
            }),
            { skipHistory: true }
        );
    };

    const getGroupResizeTransform = (
        dir: ResizeHandleDir,
        deltaX: number,
        deltaY: number,
        symmetric: boolean,
        aspectLocked: boolean
    ) => {
        if (!groupBounds) return null;
        const width = Math.max(1, groupBounds.right - groupBounds.left);
        const height = Math.max(1, groupBounds.bottom - groupBounds.top);
        const multiplier = symmetric ? 2 : 1;
        let scaleX = 1;
        let scaleY = 1;

        if (dir.includes('e')) scaleX = Math.max(0.01, 1 + (deltaX * multiplier) / width);
        if (dir.includes('w')) scaleX = Math.max(0.01, 1 - (deltaX * multiplier) / width);
        if (dir.includes('s')) scaleY = Math.max(0.01, 1 + (deltaY * multiplier) / height);
        if (dir.includes('n')) scaleY = Math.max(0.01, 1 - (deltaY * multiplier) / height);

        if (aspectLocked) {
            const scale = Math.abs(scaleX - 1) >= Math.abs(scaleY - 1) ? scaleX : scaleY;
            scaleX = scale;
            scaleY = scale;
        }

        const center = {
            x: (groupBounds.left + groupBounds.right) / 2,
            y: (groupBounds.top + groupBounds.bottom) / 2,
        };
        return {
            scaleX,
            scaleY,
            anchor: symmetric
                ? center
                : {
                    x: dir.includes('w') ? groupBounds.right : dir.includes('e') ? groupBounds.left : center.x,
                    y: dir.includes('n') ? groupBounds.bottom : dir.includes('s') ? groupBounds.top : center.y,
                },
        };
    };

    const handleResizeByKeyboard = (dir: ResizeHandleDir, key: string) => {
        const delta = 10;
        const deltaX = dir.includes('e') || dir.includes('w')
            ? key === 'ArrowRight' ? delta : key === 'ArrowLeft' ? -delta : 0
            : 0;
        const deltaY = dir.includes('n') || dir.includes('s')
            ? key === 'ArrowDown' ? delta : key === 'ArrowUp' ? -delta : 0
            : 0;
        if (deltaX === 0 && deltaY === 0) return;
        if (isCropping && (layer.kind === 'image' || layer.kind === 'video')) {
            const initCrop = layer.crop || { x: 0, y: 0, width: 1, height: 1 };
            const boxW = Math.max(40, primaryEval.size.width * frameWidth * canvasZoom);
            const boxH = Math.max(40, primaryEval.size.height * frameHeight * canvasZoom);
            const dx = deltaX / boxW;
            const dy = deltaY / boxH;
            let nextX = initCrop.x;
            let nextY = initCrop.y;
            let nextW = initCrop.width;
            let nextH = initCrop.height;
            if (dir.includes('w')) {
                nextX = Math.max(0, Math.min(initCrop.x + initCrop.width - 0.1, initCrop.x + dx));
                nextW = initCrop.width - (nextX - initCrop.x);
            }
            if (dir.includes('e')) nextW = Math.max(0.1, Math.min(1 - initCrop.x, initCrop.width + dx));
            if (dir.includes('n')) {
                nextY = Math.max(0, Math.min(initCrop.y + initCrop.height - 0.1, initCrop.y + dy));
                nextH = initCrop.height - (nextY - initCrop.y);
            }
            if (dir.includes('s')) nextH = Math.max(0.1, Math.min(1 - initCrop.y, initCrop.height + dy));

            beginDragTransaction();
            updateLayer(
                activeShot.id,
                layer.id,
                (item) => item.kind === 'image' || item.kind === 'video'
                    ? {
                        ...item,
                        crop: {
                            x: Number(nextX.toFixed(3)),
                            y: Number(nextY.toFixed(3)),
                            width: Number(nextW.toFixed(3)),
                            height: Number(nextH.toFixed(3)),
                        },
                    }
                    : item,
                { skipHistory: true }
            );
            commitDragTransaction();
            return;
        }
        const transform = getGroupResizeTransform(dir, deltaX, deltaY, false, false);
        if (!transform) return;
        beginDragTransaction();
        applyGroupTransform(transform.scaleX, transform.scaleY, transform.anchor);
        commitDragTransaction();
    };

    const handleRotateByKeyboard = (key: string) => {
        if (!groupBounds) return;
        const rotationDelta = key === 'ArrowRight' ? Math.PI / 36 : -Math.PI / 36;
        if (!isGroupSelection) {
            beginDragTransaction();
            if (isAnimateMode) {
                const blockId = recordAnimatedBlockAtPlayhead(
                    activeShot.id,
                    layer.id,
                    'rotation',
                    { x: 0, y: 0, z: rotationDelta },
                    frame.shotLocalTimeMs,
                    'Roll',
                    { skipHistory: true }
                );
                if (blockId) {
                    setTimelineLayerExpanded(layer.id, true);
                    selectBlock(blockId, layer.id);
                }
            } else {
                updateLayer(
                    activeShot.id,
                    layer.id,
                    (item) => ({
                        ...item,
                        rotation: { ...item.rotation, z: item.rotation.z + rotationDelta },
                    }),
                    { skipHistory: true }
                );
            }
            commitDragTransaction();
            return;
        }
        const center = {
            x: (groupBounds.left + groupBounds.right) / 2,
            y: (groupBounds.top + groupBounds.bottom) / 2,
        };
        beginDragTransaction();
        applyGroupTransform(1, 1, center, rotationDelta);
        commitDragTransaction();
    };

    // ============================================================================
    // 1. DRAG TO MOVE (Supports V Plane-Aware Move, G Screen Move, & Shift+A Rec!)
    // ============================================================================
    const handleStartMove = (e: React.PointerEvent | React.MouseEvent) => {
        if (activeTool === 'hand') return;
        if (activeTool === 'tilt') {
            handleStart3DTilt(e);
            return;
        }
        e.stopPropagation();
        if (isLocked) return;

        const startClientX = e.clientX;
        const startClientY = e.clientY;

        const startPositions: Record<string, { x: number; y: number; z: number }> =
            {};
        for (const item of activeShot.layers) {
            if (selectedLayerSet.has(item.id)) {
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
            (l) => !selectedLayerSet.has(l.id) && l.visible
        );

        let lastDxFrac = 0;
        let lastDyFrac = 0;
        let lastDzFrac = 0;

        const onMouseMove = (moveEvent: PointerEvent | MouseEvent) => {
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

        bindPointerDrag(e, onMouseMove, () => {
            onUpdateGuides([]);
            commitDragTransaction();
        });
    };

    // ============================================================================
    // 2. CORNER & EDGE RESIZE OR ON-CANVAS CROP HANDLES
    // ============================================================================
    const handleStartResize = (e: React.PointerEvent | React.MouseEvent, dir: ResizeHandleDir) => {
        e.stopPropagation();
        if (isLocked) return;

        const startClientX = e.clientX;
        const startClientY = e.clientY;

        if (isGroupSelection && !isCropping && groupBounds) {
            const animationState = createGroupTransformAnimationState();
            const onGroupResize = (moveEvent: PointerEvent | MouseEvent) => {
                const deltaX = (moveEvent.clientX - startClientX) / canvasZoom;
                const deltaY = (moveEvent.clientY - startClientY) / canvasZoom;
                const transform = getGroupResizeTransform(
                    dir,
                    deltaX,
                    deltaY,
                    Boolean(moveEvent.altKey),
                    Boolean(moveEvent.shiftKey)
                );
                if (transform) {
                    applyGroupTransform(transform.scaleX, transform.scaleY, transform.anchor, 0, animationState);
                }
            };
            bindPointerDrag(e, onGroupResize);
            return;
        }

        // On-Canvas Crop Mode for Image & Video Layers
        if (isCropping && (layer.kind === 'image' || layer.kind === 'video')) {
            const initCrop = (layer as ImageLayer | VideoLayer).crop || { x: 0, y: 0, width: 1, height: 1 };
            const boxW = Math.max(40, primaryEval.size.width * frameWidth * canvasZoom);
            const boxH = Math.max(40, primaryEval.size.height * frameHeight * canvasZoom);

            const onCropMove = (moveEvent: PointerEvent | MouseEvent) => {
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

            bindPointerDrag(e, onCropMove);
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
        const rotZ = primaryEval.rotation.z || 0;
        const cosZ = Math.cos(rotZ);
        const sinZ = Math.sin(rotZ);
        const safeAspect = initialH > 0.0001 ? initialW / initialH : 1;

        let lastDW = 0;
        let lastDH = 0;

        const onMouseMove = (moveEvent: PointerEvent | MouseEvent) => {
            const screenDxPx =
                (moveEvent.clientX - startClientX) / (canvasZoom * zoom);
            const screenDyPx =
                (moveEvent.clientY - startClientY) / (canvasZoom * zoom);

            // Project pointer delta onto the layer's local rotated axes
            const localDxPx = screenDxPx * cosZ + screenDyPx * sinZ;
            const localDyPx = -screenDxPx * sinZ + screenDyPx * cosZ;
            const dxFrac = localDxPx / frameWidth;
            const dyFrac = localDyPx / frameHeight;

            const isSymmetric = Boolean(moveEvent.altKey);
            const isAspectLocked = Boolean(moveEvent.shiftKey);
            const mult = isSymmetric ? 2 : 1;

            let nextW = initialW;
            let nextH = initialH;

            if (dir.includes('e')) {
                nextW = Math.max(0.04, initialW + dxFrac * mult);
            }
            if (dir.includes('w')) {
                nextW = Math.max(0.04, initialW - dxFrac * mult);
            }
            if (dir.includes('s')) {
                nextH = Math.max(0.02, initialH + dyFrac * mult);
            }
            if (dir.includes('n')) {
                nextH = Math.max(0.02, initialH - dyFrac * mult);
            }

            if (isAspectLocked && layer.kind !== 'text') {
                if ((dir === 'e' || dir === 'w') || (dir.length === 2 && Math.abs(dxFrac) >= Math.abs(dyFrac))) {
                    nextH = Math.max(0.02, nextW / safeAspect);
                } else {
                    nextW = Math.max(0.04, nextH * safeAspect);
                }
            }

            let localShiftFracX = 0;
            let localShiftFracY = 0;
            if (!isSymmetric) {
                if (dir.includes('e')) localShiftFracX = (nextW - initialW) / 2;
                if (dir.includes('w')) localShiftFracX = -(nextW - initialW) / 2;
                if (dir.includes('s')) localShiftFracY = (nextH - initialH) / 2;
                if (dir.includes('n')) localShiftFracY = -(nextH - initialH) / 2;
            }

            // Rotate the local center shift back into world space so the opposite edge/corner stays pinned
            const localShiftPxX = localShiftFracX * frameWidth;
            const localShiftPxY = localShiftFracY * frameHeight;
            const worldShiftPxX = localShiftPxX * cosZ - localShiftPxY * sinZ;
            const worldShiftPxY = localShiftPxX * sinZ + localShiftPxY * cosZ;

            let nextPosX = initialPosX + worldShiftPxX / frameWidth;
            let nextPosY = initialPosY + worldShiftPxY / frameHeight;

            const isMedia = layer.kind === 'image' || layer.kind === 'video';
            const mediaDeviceFrame = isMedia ? (layer as ImageLayer | VideoLayer).deviceFrame : undefined;
            if (mediaDeviceFrame?.enabled && isFixedDeviceFrame(mediaDeviceFrame)) {
                const initialSize = { width: initialW, height: initialH };
                const visibleSize = getDevicePlacementSize(initialSize, mediaDeviceFrame, aspect, primaryEval.scale);
                const resized = resizeDeviceFromHandle(initialSize, visibleSize, dir, dxFrac, dyFrac, {
                    // Body handles now follow screen-space bounds, including mirrored devices.
                    x: 1, y: 1,
                });
                nextW = resized.size.width;
                nextH = resized.size.height;
                nextPosX = initialPosX + resized.centerOffset.x;
                nextPosY = initialPosY + resized.centerOffset.y;
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

        bindPointerDrag(e, onMouseMove);
    };

    // ============================================================================
    // 3. TOP 2D ROTATION KNOB (Rotate Z - Fixed Stage-Relative Angle!)
    // ============================================================================
    const handleStartRotateZ = (e: React.PointerEvent | React.MouseEvent) => {
        e.stopPropagation();
        if (isLocked) return;

        if (isGroupSelection && groupBounds) {
            const rect = overlayRootRef.current?.getBoundingClientRect();
            if (!rect) return;
            const center = {
                x: (groupBounds.left + groupBounds.right) / 2,
                y: (groupBounds.top + groupBounds.bottom) / 2,
            };
            const centerClientX = rect.left + center.x * canvasZoom;
            const centerClientY = rect.top + center.y * canvasZoom;
            const startAngle = Math.atan2(
                e.clientY - centerClientY,
                e.clientX - centerClientX
            );
            let prevAngle = startAngle;
            let accumulatedDelta = 0;
            const animationState = createGroupTransformAnimationState();

            const onGroupRotate = (moveEvent: PointerEvent | MouseEvent) => {
                const currentAngle = Math.atan2(
                    moveEvent.clientY - centerClientY,
                    moveEvent.clientX - centerClientX
                );
                let diff = currentAngle - prevAngle;
                while (diff > Math.PI) diff -= 2 * Math.PI;
                while (diff < -Math.PI) diff += 2 * Math.PI;
                prevAngle = currentAngle;
                accumulatedDelta += diff;
                applyGroupTransform(
                    1,
                    1,
                    center,
                    accumulatedDelta,
                    animationState
                );
            };

            bindPointerDrag(e, onGroupRotate);
            return;
        }

        const rect = overlayRootRef.current?.getBoundingClientRect();
        if (!rect) return;

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

        const onMouseMove = (moveEvent: PointerEvent | MouseEvent) => {
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

        bindPointerDrag(e, onMouseMove);
    };

    // ============================================================================
    // 4. 3D TILT DRAG (Pitch & Yaw - X and Y Rotations + Shift+A Rec!)
    // ============================================================================
    const handleStart3DTilt = (e: React.PointerEvent | React.MouseEvent) => {
        e.stopPropagation();
        if (isLocked) return;

        const startClientX = e.clientX;
        const startClientY = e.clientY;
        const initialXDeg = radToDeg(layer.rotation.x);
        const initialYDeg = radToDeg(layer.rotation.y);

        let lastPitchRad = 0;
        let lastYawRad = 0;

        const onMouseMove = (moveEvent: PointerEvent | MouseEvent) => {
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
                -360,
                Math.min(360, Math.round(initialXDeg + deltaPitch))
            );
            const nextYDeg = Math.max(
                -360,
                Math.min(360, Math.round(initialYDeg + deltaYaw))
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

        bindPointerDrag(e, onMouseMove);
    };

    const handleItems: {
        dir: ResizeHandleDir;
        pos: { x: number; y: number };
        cursor: string;
    }[] = isGroupSelection && !isCropping && groupBounds ? [
            { dir: 'nw', pos: { x: groupBounds.left, y: groupBounds.top }, cursor: 'nwse-resize' },
            { dir: 'n', pos: { x: (groupBounds.left + groupBounds.right) / 2, y: groupBounds.top }, cursor: 'ns-resize' },
            { dir: 'ne', pos: { x: groupBounds.right, y: groupBounds.top }, cursor: 'nesw-resize' },
            { dir: 'e', pos: { x: groupBounds.right, y: (groupBounds.top + groupBounds.bottom) / 2 }, cursor: 'ew-resize' },
            { dir: 'se', pos: { x: groupBounds.right, y: groupBounds.bottom }, cursor: 'nwse-resize' },
            { dir: 's', pos: { x: (groupBounds.left + groupBounds.right) / 2, y: groupBounds.bottom }, cursor: 'ns-resize' },
            { dir: 'sw', pos: { x: groupBounds.left, y: groupBounds.bottom }, cursor: 'nesw-resize' },
            { dir: 'w', pos: { x: groupBounds.left, y: (groupBounds.top + groupBounds.bottom) / 2 }, cursor: 'ew-resize' },
        ] : [
            { dir: 'nw', pos: primaryProj.pNW, cursor: 'nwse-resize' },
            { dir: 'n', pos: primaryProj.pN, cursor: 'ns-resize' },
            { dir: 'ne', pos: primaryProj.pNE, cursor: 'nesw-resize' },
            { dir: 'e', pos: primaryProj.pE, cursor: 'ew-resize' },
            { dir: 'se', pos: primaryProj.pSE, cursor: 'nwse-resize' },
            { dir: 's', pos: primaryProj.pS, cursor: 'ns-resize' },
            { dir: 'sw', pos: primaryProj.pSW, cursor: 'nesw-resize' },
            { dir: 'w', pos: primaryProj.pW, cursor: 'ew-resize' },
        ];
    const rotationHandleItems = isGroupSelection && groupBounds
        ? [
            { id: 'rot-nw', pos: { x: groupBounds.left - 10, y: groupBounds.top - 10 }, label: 'Rotate selection from northwest corner' },
            { id: 'rot-ne', pos: { x: groupBounds.right + 10, y: groupBounds.top - 10 }, label: 'Rotate selection from northeast corner' },
            { id: 'rot-se', pos: { x: groupBounds.right + 10, y: groupBounds.bottom + 10 }, label: 'Rotate selection from southeast corner' },
            { id: 'rot-sw', pos: { x: groupBounds.left - 10, y: groupBounds.bottom + 10 }, label: 'Rotate selection from southwest corner' },
        ]
        : [
            { id: 'rot-nw', pos: { x: primaryProj.pNW.x - 10, y: primaryProj.pNW.y - 10 }, label: 'Rotate selection from northwest corner' },
            { id: 'rot-ne', pos: { x: primaryProj.pNE.x + 10, y: primaryProj.pNE.y - 10 }, label: 'Rotate selection from northeast corner' },
            { id: 'rot-se', pos: { x: primaryProj.pSE.x + 10, y: primaryProj.pSE.y + 10 }, label: 'Rotate selection from southeast corner' },
            { id: 'rot-sw', pos: { x: primaryProj.pSW.x - 10, y: primaryProj.pSW.y + 10 }, label: 'Rotate selection from southwest corner' },
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
            data-selection-overlay=""
            onMouseDown={(e) => e.stopPropagation()}
            className="absolute inset-0 pointer-events-none z-30 overflow-visible select-none"
        >
            <SelectionOverlayVisuals
                selectedEvalLayers={selectedEvalLayers}
                projectCorners={projectCorners}
                primaryProj={primaryProj}
                groupBounds={isGroupSelection && !isCropping ? groupBounds : null}
                layer={layer}
                activeShotId={activeShot.id}
                frameWidth={frameWidth}
                isLocked={isLocked}
                isCropping={isCropping}
                isAnimateMode={isAnimateMode}
                isEditingInlineText={isEditingInlineText}
                setIsEditingInlineText={setIsEditingInlineText}
                activeTool={activeTool}
                borderColor={borderColor}
                isMotionBlock={isMotionBlock}
                motionStartPoint={motionStartPoint}
                motionEndPoint={motionEndPoint}
                motionMidControl={motionMidControl}
                motionAmount={motionAmt}
                handleItems={handleItems}
                rotationHandleItems={rotationHandleItems}
                onMoveStart={handleStartMove}
                onMotionEndStart={handleStartDragMotionEnd}
                onRotateStart={handleStartRotateZ}
                onResizeStart={handleStartResize}
                onRotateByKeyboard={handleRotateByKeyboard}
                onResizeByKeyboard={handleResizeByKeyboard}
                onSelectLayer={onSelectLayer}
                updateLayer={updateLayer}
                onPointerDrag={bindPointerDrag}
            />
        </div>
    );
};
