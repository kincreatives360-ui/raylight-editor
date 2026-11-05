import React from 'react';
import type { Project } from '../model/types';
import type { EvaluatedProjectFrame } from '../engine/evaluateShot';
import type { CanvasTool } from '../store/useSelectionStore';
import { useSelectionStore } from '../store/useSelectionStore';
import { useProjectStore } from '../store/useProjectStore';
import { DEFAULT_CAMERA_Z, DEFAULT_FOCAL_LENGTH, evaluateCameraPose, getLayerProjectedCorners } from './webgl/cameraMath';
import { radToDeg } from '../model/defaults';

type ProjectState = ReturnType<typeof useProjectStore.getState>;
type SelectionState = ReturnType<typeof useSelectionStore.getState>;

interface StagePointerOptions {
    activeTool: CanvasTool;
    isSpaceHeld: boolean;
    frame: EvaluatedProjectFrame;
    project: Project;
    selectedCameraBlockId: string | null;
    canvasZoom: number;
    canvasPan: { x: number; y: number };
    frameWidth: number;
    frameHeight: number;
    isCreationTool: boolean;
    selectedLayerIds: string[];
    stageFrameRef: React.RefObject<HTMLDivElement | null>;
    onSelectLayer: (id: string, multi?: boolean) => void;
    beginDragTransaction: () => void;
    commitDragTransaction: () => void;
    updateActiveShotCamera: (patch: { orbit?: number; tilt?: number; roll?: number; targetX?: number; targetY?: number; targetZ?: number; zoom?: number; focalLength?: number }) => void;
    setCanvasPan: SelectionState['setCanvasPan'];
    setActiveTool: SelectionState['setActiveTool'];
    setDrawBox: React.Dispatch<React.SetStateAction<{ x: number; y: number; w: number; h: number } | null>>;
    setMarqueeBox: React.Dispatch<React.SetStateAction<{ startX: number; startY: number; currentX: number; currentY: number } | null>>;
    setSelectedLayerIds: SelectionState['setSelectedLayerIds'];
    clearLayerSelection: SelectionState['clearLayerSelection'];
    addLayerToShot: ProjectState['addLayerToShot'];
}

export const useStagePointerInteractions = ({ activeTool, isSpaceHeld, frame, project, selectedCameraBlockId, canvasZoom, canvasPan, frameWidth, frameHeight, isCreationTool, selectedLayerIds, stageFrameRef, onSelectLayer, beginDragTransaction, commitDragTransaction, updateActiveShotCamera, setCanvasPan, setActiveTool, setDrawBox, setMarqueeBox, setSelectedLayerIds, clearLayerSelection, addLayerToShot }: StagePointerOptions) => {
    const handleWorkspaceMouseDown = (e: React.MouseEvent) => {
        if (
            useSelectionStore.getState().isTransformDragging ||
            useProjectStore.getState().dragSnapshot !== null
        ) {
            return;
        }

        // 0. Dedicated Camera Navigation Tool (C) OR Alt + Drag in Select Tool
        // Left-drag: Orbit | Middle-drag (or Shift+Left-drag): Pan | Right-drag: Dolly
        const isCameraAction = activeTool === 'camera' || (e.altKey && !isSpaceHeld);
        if (isCameraAction) {
            e.preventDefault();
            e.stopPropagation();

            const isPanAction = e.button === 1 || (e.button === 0 && e.shiftKey);
            const isDollyAction = e.button === 2;
            const isOrbitAction = e.button === 0 && !e.shiftKey;

            const startX = e.clientX;
            const startY = e.clientY;

            const currentShot = frame.activeShot;
            const selectedCamBlock = currentShot.cameraBlocks?.find(
                (b) => b.id === selectedCameraBlockId
            );
            const midMs = selectedCamBlock
                ? selectedCamBlock.startMs + selectedCamBlock.durationMs / 2
                : 0;
            const which: 'from' | 'to' = frame.shotLocalTimeMs < midMs ? 'from' : 'to';
            const activeEp = selectedCamBlock ? selectedCamBlock[which] : null;

            const baseFraming = currentShot.framings?.[0];
            const startOrbit = activeEp
                ? activeEp.orbit
                : (baseFraming?.orbit ?? Math.round(radToDeg(frame.camera.rotation.y)));
            const startTilt = activeEp
                ? activeEp.tilt
                : (baseFraming?.tilt ?? Math.round(radToDeg(frame.camera.rotation.x)));
            const startTargetX = activeEp
                ? activeEp.anchorX
                : (baseFraming?.target.x ?? frame.camera.target.x);
            const startTargetY = activeEp
                ? activeEp.anchorY
                : (baseFraming?.target.y ?? frame.camera.target.y);
            const startZoom = activeEp
                ? activeEp.zoom
                : (baseFraming?.zoom ?? frame.camera.zoom);

            beginDragTransaction();

            const onMove = (moveEv: MouseEvent) => {
                const deltaX = moveEv.clientX - startX;
                const deltaY = moveEv.clientY - startY;

                if (isOrbitAction) {
                    const deltaOrbit = deltaX * 0.4;
                    const deltaTilt = -deltaY * 0.4;
                    const nextOrbit = Math.round(startOrbit + deltaOrbit);
                    const nextTilt = Math.max(
                        -85,
                        Math.min(85, Math.round(startTilt + deltaTilt))
                    );
                    updateActiveShotCamera({ orbit: nextOrbit, tilt: nextTilt });
                } else if (isPanAction) {
                    const panFactor = 1 / (Math.max(0.2, startZoom) * canvasZoom);
                    const deltaNormX = (deltaX / frameWidth) * panFactor;
                    const deltaNormY = (deltaY / frameHeight) * panFactor;
                    const nextTargetX = Number(
                        Math.max(-2.5, Math.min(2.5, startTargetX - deltaNormX)).toFixed(4)
                    );
                    const nextTargetY = Number(
                        Math.max(-2.5, Math.min(2.5, startTargetY - deltaNormY)).toFixed(4)
                    );
                    updateActiveShotCamera({ targetX: nextTargetX, targetY: nextTargetY });
                } else if (isDollyAction) {
                    const zoomFactor = Math.pow(1.006, -deltaY);
                    const nextZoom = Number(
                        Math.max(0.2, Math.min(5.0, startZoom * zoomFactor)).toFixed(3)
                    );
                    updateActiveShotCamera({ zoom: nextZoom });
                }
            };

            const onUp = () => {
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
                commitDragTransaction();
            };

            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
            return;
        }

        // 1. Hand Tool or Spacebar held or Middle-Click -> Pan Canvas
        if (activeTool === 'hand' || isSpaceHeld || e.button === 1) {
            e.preventDefault();
            const startX = e.clientX;
            const startY = e.clientY;
            const initPan = { ...canvasPan };

            const onMove = (moveEv: MouseEvent) => {
                setCanvasPan({
                    x: initPan.x + (moveEv.clientX - startX),
                    y: initPan.y + (moveEv.clientY - startY),
                });
            };
            const onUp = () => {
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
            };
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
            return;
        }

        // 2. Creation Tools (T, I, R, O, L): Click or Drag to Draw on Stage
        if (isCreationTool && stageFrameRef.current) {
            e.preventDefault();
            e.stopPropagation();
            const rect = stageFrameRef.current.getBoundingClientRect();
            const startX = (e.clientX - rect.left) / canvasZoom;
            const startY = (e.clientY - rect.top) / canvasZoom;

            setDrawBox({ x: startX, y: startY, w: 0, h: 0 });

            let latestBox = { x: startX, y: startY, w: 0, h: 0 };
            const strokePoints: { x: number; y: number }[] = [{ x: startX, y: startY }];

            const onMove = (moveEv: MouseEvent) => {
                const curX = (moveEv.clientX - rect.left) / canvasZoom;
                const curY = (moveEv.clientY - rect.top) / canvasZoom;
                strokePoints.push({ x: curX, y: curY });
                latestBox = {
                    x: Math.min(startX, curX),
                    y: Math.min(startY, curY),
                    w: Math.abs(curX - startX),
                    h: Math.abs(curY - startY),
                };
                setDrawBox(latestBox);
            };

            const onUp = () => {
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
                setDrawBox(null);

                const draggedEnough = latestBox.w > 16 || latestBox.h > 16;
                const centerX2D = draggedEnough
                    ? latestBox.x + latestBox.w / 2
                    : startX;
                const centerY2D = draggedEnough
                    ? latestBox.y + latestBox.h / 2
                    : startY;

                const fracX = Number((centerX2D / frameWidth - 0.5).toFixed(4));
                const fracY = Number((centerY2D / frameHeight - 0.5).toFixed(4));
                const fracW = draggedEnough
                    ? Number(Math.max(0.08, latestBox.w / frameWidth).toFixed(4))
                    : undefined;
                const fracH = draggedEnough
                    ? Number(Math.max(0.04, latestBox.h / frameHeight).toFixed(4))
                    : undefined;

                let created;
                if (activeTool === 'text') {
                    created = addLayerToShot(frame.activeShot.id, 'text', {
                        position: { x: fracX, y: fracY, z: 0.1 },
                        maxWidth: fracW || 0.45,
                        inMs: 0,
                        outMs: frame.activeShot.durationMs,
                    });
                } else if (activeTool === 'image') {
                    created = addLayerToShot(frame.activeShot.id, 'image', {
                        position: { x: fracX, y: fracY, z: 0 },
                        rotation: { x: 0, y: 0, z: 0 },
                        size: { width: fracW || 0.45, height: fracH || 0.3 },
                        inMs: 0,
                        outMs: frame.activeShot.durationMs,
                    });
                } else if (activeTool === 'pen') {
                    const xs = strokePoints.map((pt) => pt.x);
                    const ys = strokePoints.map((pt) => pt.y);
                    const minX = Math.min(...xs);
                    const maxX = Math.max(...xs);
                    const minY = Math.min(...ys);
                    const maxY = Math.max(...ys);
                    const boxW = Math.max(1, maxX - minX);
                    const boxH = Math.max(1, maxY - minY);
                    const penDraggedEnough = boxW > 16 || boxH > 16;
                    const penCenterX = minX + boxW / 2;
                    const penCenterY = minY + boxH / 2;
                    const penFracX = Number((penCenterX / frameWidth - 0.5).toFixed(4));
                    const penFracY = Number((penCenterY / frameHeight - 0.5).toFixed(4));
                    const penFracW = penDraggedEnough
                        ? Number(Math.max(0.08, boxW / frameWidth).toFixed(4))
                        : 0.28;
                    const penFracH = penDraggedEnough
                        ? Number(Math.max(0.04, boxH / frameHeight).toFixed(4))
                        : 0.18;

                    const strokeScale = Math.max(boxW, boxH);
                    let normalizedPoints = strokePoints.length > 1
                        ? strokePoints.map((pt) => ({
                            x: Number(Math.max(0, Math.min(1, (pt.x - minX) / boxW)).toFixed(3)),
                            y: Number(Math.max(0, Math.min(1, (pt.y - minY) / boxH)).toFixed(3)),
                        }))
                        : [{ x: 0, y: 0 }, { x: 1, y: 0.25 }, { x: 0.7, y: 1 }];

                    let polygonArea = 0;
                    if (strokePoints.length >= 3) {
                        let pixelArea = 0;
                        for (let i = 0; i < strokePoints.length; i++) {
                            const j = (i + 1) % strokePoints.length;
                            pixelArea += strokePoints[i].x * strokePoints[j].y - strokePoints[j].x * strokePoints[i].y;
                        }
                        polygonArea = Math.abs(pixelArea) / (2 * strokeScale * strokeScale);
                    }

                    if (strokePoints.length === 2) {
                        const p0 = normalizedPoints[0];
                        const p1 = normalizedPoints[1];
                        const dx = p1.x - p0.x;
                        const dy = p1.y - p0.y;
                        const len = Math.hypot(dx, dy) || 1;
                        const nx = (-dy / len) * 0.12;
                        const ny = (dx / len) * 0.12;
                        normalizedPoints = [
                            { x: Number(Math.max(0, Math.min(1, p0.x + nx)).toFixed(3)), y: Number(Math.max(0, Math.min(1, p0.y + ny)).toFixed(3)) },
                            { x: Number(Math.max(0, Math.min(1, p1.x + nx)).toFixed(3)), y: Number(Math.max(0, Math.min(1, p1.y + ny)).toFixed(3)) },
                            { x: Number(Math.max(0, Math.min(1, p1.x - nx)).toFixed(3)), y: Number(Math.max(0, Math.min(1, p1.y - ny)).toFixed(3)) },
                            { x: Number(Math.max(0, Math.min(1, p0.x - nx)).toFixed(3)), y: Number(Math.max(0, Math.min(1, p0.y - ny)).toFixed(3)) },
                        ];
                    } else if (strokePoints.length >= 3 && (polygonArea < 0.02 || Math.min(boxW, boxH) < 12)) {
                        const uniformBase = strokePoints.map((pt) => ({
                            x: boxW < 12
                                ? 0.5 + (pt.x - penCenterX) / strokeScale
                                : (pt.x - minX) / boxW,
                            y: boxH < 12
                                ? 0.5 + (pt.y - penCenterY) / strokeScale
                                : (pt.y - minY) / boxH,
                        }));
                        const pStart = uniformBase[0];
                        const pEnd = uniformBase[uniformBase.length - 1];
                        const dx = pEnd.x - pStart.x;
                        const dy = pEnd.y - pStart.y;
                        const len = Math.hypot(dx, dy) || 1;
                        if (len < 0.01) {
                            normalizedPoints = [{ x: 0, y: 0 }, { x: 1, y: 0.25 }, { x: 0.7, y: 1 }];
                        } else {
                            const nx = (-dy / len) * 0.1;
                            const ny = (dx / len) * 0.1;
                            const forward = uniformBase.map((p) => ({
                                x: Number(Math.max(0, Math.min(1, p.x + nx)).toFixed(3)),
                                y: Number(Math.max(0, Math.min(1, p.y + ny)).toFixed(3)),
                            }));
                            const backward = uniformBase.slice().reverse().map((p) => ({
                                x: Number(Math.max(0, Math.min(1, p.x - nx)).toFixed(3)),
                                y: Number(Math.max(0, Math.min(1, p.y - ny)).toFixed(3)),
                            }));
                            normalizedPoints = [...forward, ...backward];
                        }
                    }

                    created = addLayerToShot(frame.activeShot.id, 'shape', {
                        shape: 'polygon',
                        name: 'Pen path',
                        position: { x: penFracX, y: penFracY, z: 0.1 },
                        size: { width: penFracW, height: penFracH },
                        points: normalizedPoints,
                        inMs: 0,
                        outMs: frame.activeShot.durationMs,
                    });
                } else {
                    const shapeKind = activeTool === 'ellipse' ? 'ellipse' : activeTool === 'line' ? 'line' : activeTool === 'arrow' ? 'arrow' : activeTool === 'polygon' ? 'polygon' : 'rectangle';
                    created = addLayerToShot(frame.activeShot.id, 'shape', {
                        shape: shapeKind,
                        position: { x: fracX, y: fracY, z: 0.1 },
                        size: {
                            width: fracW || (shapeKind === 'line' ? 0.35 : 0.28),
                            height: fracH || (shapeKind === 'line' ? 0.015 : 0.18),
                        },
                        inMs: 0,
                        outMs: frame.activeShot.durationMs,
                    });
                }

                onSelectLayer(created.id, false);
                setActiveTool('select');
            };

            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
            return;
        }

        // 3. Select Tool (V): Dragging on empty stage frame initiates Marquee Multi-Selection
        if (activeTool === 'select' && stageFrameRef.current) {
            const rect = stageFrameRef.current.getBoundingClientRect();
            if (
                e.clientX >= rect.left &&
                e.clientX <= rect.right &&
                e.clientY >= rect.top &&
                e.clientY <= rect.bottom
            ) {
                const startX = (e.clientX - rect.left) / canvasZoom;
                const startY = (e.clientY - rect.top) / canvasZoom;
                const isMulti = e.shiftKey || e.metaKey || e.ctrlKey;

                setMarqueeBox({ startX, startY, currentX: startX, currentY: startY });
                let latestMarquee = { startX, startY, currentX: startX, currentY: startY };

                const onMove = (moveEv: MouseEvent) => {
                    const curX = (moveEv.clientX - rect.left) / canvasZoom;
                    const curY = (moveEv.clientY - rect.top) / canvasZoom;
                    latestMarquee = { startX, startY, currentX: curX, currentY: curY };
                    setMarqueeBox({ startX, startY, currentX: curX, currentY: curY });
                };

                const onUp = () => {
                    window.removeEventListener('mousemove', onMove);
                    window.removeEventListener('mouseup', onUp);
                    setMarqueeBox(null);

                    const left = Math.min(latestMarquee.startX, latestMarquee.currentX);
                    const right = Math.max(latestMarquee.startX, latestMarquee.currentX);
                    const top = Math.min(latestMarquee.startY, latestMarquee.currentY);
                    const bottom = Math.max(latestMarquee.startY, latestMarquee.currentY);
                    const w = right - left;
                    const h = bottom - top;

                    if (w < 8 && h < 8) {
                        if (
                            useSelectionStore.getState().isTransformDragging ||
                            useProjectStore.getState().dragSnapshot !== null
                        ) {
                            return;
                        }
                        if (!isMulti) clearLayerSelection();
                        return;
                    }

                    const aspect = frameWidth / Math.max(frameHeight, 1);
                    const defaultCam = project.defaultCamera || {
                        position: { x: 0, y: 0, z: DEFAULT_CAMERA_Z },
                        rotation: { x: 0, y: 0, z: 0 },
                        focalLength: DEFAULT_FOCAL_LENGTH,
                    };
                    const cameraPose = evaluateCameraPose(frame.camera, defaultCam, aspect);
                    const refCameraZ = defaultCam.position?.z ?? DEFAULT_CAMERA_Z;
                    const refFocalLength = defaultCam.focalLength ?? DEFAULT_FOCAL_LENGTH;
                    const hitLayerIds: string[] = [];

                    for (const l of frame.layers) {
                        if (!l.visible) continue;
                        const proj = getLayerProjectedCorners(
                            l,
                            frameWidth,
                            frameHeight,
                            aspect,
                            cameraPose,
                            refCameraZ,
                            refFocalLength
                        );
                        const inBox =
                            (proj.pCenter.x >= left && proj.pCenter.x <= right && proj.pCenter.y >= top && proj.pCenter.y <= bottom) ||
                            proj.corners.some((c) => c.x >= left && c.x <= right && c.y >= top && c.y <= bottom);
                        if (inBox) {
                            hitLayerIds.push(l.id);
                        }
                    }

                    if (hitLayerIds.length > 0) {
                        if (isMulti) {
                            const merged = Array.from(new Set([...selectedLayerIds, ...hitLayerIds]));
                            setSelectedLayerIds(merged);
                        } else {
                            setSelectedLayerIds(hitLayerIds);
                        }
                    } else if (!isMulti) {
                        if (
                            useSelectionStore.getState().isTransformDragging ||
                            useProjectStore.getState().dragSnapshot !== null
                        ) {
                            return;
                        }
                        clearLayerSelection();
                    }
                };

                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onUp);
                return;
            }
        }

        // 4. Clicking empty workspace deselects layers
        if (
            useSelectionStore.getState().isTransformDragging ||
            useProjectStore.getState().dragSnapshot !== null
        ) {
            return;
        }
        clearLayerSelection();
    };

    // Deep Select (Cmd + Click): cycles through layers stacked behind the clicked layer
    return handleWorkspaceMouseDown;
};
