import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
    RotateCcw,
    UploadCloud,
    Copy,
    Trash2,
    FolderPlus,
    FolderMinus,
    ChevronsUp,
    ChevronsDown,
    ChevronUp,
    ChevronDown,
    Lock,
    Unlock,
    Eye,
    EyeOff,
    Type,
    Square,
    Circle,
    Layers,
    Camera,
} from 'lucide-react';
import type { Project } from '../model/types';
import { resolveShotBackground } from '../model/types';
import type { EvaluatedProjectFrame } from '../engine/evaluateShot';
import type { EvaluatedCamera } from '../engine/evaluateCamera';
import { useProjectStore } from '../store/useProjectStore';
import { usePlayheadStore } from '../store/usePlayheadStore';
import { useSelectionStore } from '../store/useSelectionStore';
import { readImageFileWithThumbnail, parseFigmaSvgToLayers } from '../engine/figmaSvgImporter';
import { SelectionOverlay } from './SelectionOverlay';
import { Guides } from './Guides';
import { OrientationGizmo } from './OrientationGizmo';
import { CameraFramingOverlay } from './CameraFramingOverlay';
import { ASPECT_RATIO_CONFIG, type SnapGuideLine } from './stageUtils';
import { CanvasToolbar } from './CanvasToolbar';
import { ViewportCanvas } from './webgl/ViewportCanvas';
import * as THREE from 'three';
import { radToDeg } from '../model/defaults';
import {
    DEFAULT_CAMERA_Z,
    DEFAULT_FOCAL_LENGTH,
    evaluateCameraPose,
    getLayerProjectedCorners,
} from './webgl/cameraMath';

interface StageProps {
    project: Project;
    frame: EvaluatedProjectFrame;
    selectedLayerIds: string[];
    onSelectLayer: (layerId: string, multiSelect?: boolean) => void;
    showSafeArea?: boolean;
    snapEnabled?: boolean;
    onToggleSafeArea?: () => void;
    onOpenShortcuts?: () => void;
}

const StageComponent: React.FC<StageProps> = ({
    project,
    frame,
    selectedLayerIds,
    onSelectLayer,
    showSafeArea = true,
    snapEnabled = true,
    onToggleSafeArea,
    onOpenShortcuts,
}) => {
    const {
        addLayerToShot,
        updateProject,
        updateShot,
        addMultipleLayersToShot,
        deleteLayerFromShot,
        duplicateLayerInShot,
        restackLayerInShot,
        updateLayer,
        createGroupFromLayers,
        ungroupInShot,
        beginDragTransaction,
        commitDragTransaction,
    } = useProjectStore();
    const {
        activeTool,
        isAnimateMode,
        canvasZoom,
        canvasPan,
        rightSidebarOpen,
        selectLayer,
        setSelectedLayerIds,
        setActiveTool,
        setCanvasZoom,
        setCanvasPan,
        resetCanvasView,
        clearLayerSelection,
        gradientEditorActive,
        gradientEditorAngle,
        setGradientEditorAngle,
        selectedCameraBlockId,
    } = useSelectionStore();

    const isPlaying = usePlayheadStore((s) => s.isPlaying);

    const containerRef = useRef<HTMLDivElement | null>(null);
    const stageFrameRef = useRef<HTMLDivElement | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

    const [viewportSize, setViewportSize] = useState({ width: 880, height: 540 });
    const [activeGuides, setActiveGuides] = useState<SnapGuideLine[]>([]);
    const [isSpaceHeld, setIsSpaceHeld] = useState(false);
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const [contextMenu, setContextMenu] = useState<{
        x: number;
        y: number;
        layerId: string | null;
    } | null>(null);
    const [drawBox, setDrawBox] = useState<{
        x: number;
        y: number;
        w: number;
        h: number;
    } | null>(null);
    const [marqueeBox, setMarqueeBox] = useState<{
        startX: number;
        startY: number;
        currentX: number;
        currentY: number;
    } | null>(null);

    // Dismiss context menu on click outside or Escape
    useEffect(() => {
        if (!contextMenu) return;
        const handleDismiss = () => setContextMenu(null);
        window.addEventListener('click', handleDismiss);
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !e.defaultPrevented) {
                e.preventDefault();
                setContextMenu(null);
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => {
            window.removeEventListener('click', handleDismiss);
            window.removeEventListener('keydown', handleKey);
        };
    }, [contextMenu]);



    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (!entry) return;
            setViewportSize({
                width: Math.max(240, entry.contentRect.width - 16),
                height: Math.max(200, entry.contentRect.height - 74),
            });
        });

        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    // Track Spacebar hold for temporary Hand panning and C/V/H/Y tool shortcuts
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.defaultPrevented) return;
            const el = document.activeElement as HTMLElement | null;
            if (!el) return;
            const tag = el.tagName;
            if (
                tag === 'INPUT' ||
                tag === 'TEXTAREA' ||
                tag === 'SELECT' ||
                el.isContentEditable ||
                el.getAttribute('role') === 'spinbutton' ||
                el.getAttribute('role') === 'textbox'
            ) {
                return;
            }
            if (e.code === 'Space') setIsSpaceHeld(true);
            if (!e.metaKey && !e.ctrlKey) {
                if (e.key === 'c' || e.key === 'C') setActiveTool('camera');
                if (e.key === 'v' || e.key === 'V') setActiveTool('select');
                if (e.key === 'h' || e.key === 'H') setActiveTool('hand');
                if (e.key === 'y' || e.key === 'Y') setActiveTool('tilt');
            }
        };
        const onKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'Space') setIsSpaceHeld(false);
        };
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
        };
    }, [setActiveTool]);

    // ============================================================================
    // 3D CAMERA RIG CONTROLLER (Cinema 4D / Blender Style Viewport Navigation)
    // ============================================================================
    const updateActiveShotCamera = useCallback((patch: {
        orbit?: number;
        tilt?: number;
        targetX?: number;
        targetY?: number;
        zoom?: number;
    }) => {
        const currentShot = frame.activeShot;
        const selectedCamBlock = currentShot.cameraBlocks?.find(
            (b) => b.id === selectedCameraBlockId
        );

        if (selectedCamBlock) {
            const midMs = selectedCamBlock.startMs + selectedCamBlock.durationMs / 2;
            const which: 'from' | 'to' = frame.shotLocalTimeMs < midMs ? 'from' : 'to';
            const ep = selectedCamBlock[which] || {
                anchorX: 0,
                anchorY: 0,
                zoom: 1,
                roll: 0,
                orbit: 0,
                tilt: 0,
            };

            updateShot(
                currentShot.id,
                (s) => ({
                    ...s,
                    cameraBlocks: (s.cameraBlocks || []).map((cb) =>
                        cb.id === selectedCamBlock.id
                            ? {
                                ...cb,
                                [which]: {
                                    ...ep,
                                    anchorX: patch.targetX !== undefined ? patch.targetX : ep.anchorX,
                                    anchorY: patch.targetY !== undefined ? patch.targetY : ep.anchorY,
                                    zoom: patch.zoom !== undefined ? patch.zoom : ep.zoom,
                                    orbit: patch.orbit !== undefined ? patch.orbit : ep.orbit,
                                    tilt: patch.tilt !== undefined ? patch.tilt : ep.tilt,
                                },
                            }
                            : cb
                    ),
                }),
                { skipHistory: true }
            );
        } else {
            updateShot(
                currentShot.id,
                (s) => {
                    const framings = [...(s.framings || [])];
                    const baseF = framings[0] || {
                        id: 'default',
                        name: 'Default',
                        target: { x: 0, y: 0, z: 0 },
                        zoom: 1,
                        roll: 0,
                        orbit: 0,
                        tilt: 0,
                    };

                    const updatedF = {
                        ...baseF,
                        target: {
                            ...baseF.target,
                            x: patch.targetX !== undefined ? patch.targetX : baseF.target.x,
                            y: patch.targetY !== undefined ? patch.targetY : baseF.target.y,
                        },
                        zoom: patch.zoom !== undefined ? patch.zoom : baseF.zoom,
                        orbit: patch.orbit !== undefined ? patch.orbit : (baseF.orbit ?? 0),
                        tilt: patch.tilt !== undefined ? patch.tilt : (baseF.tilt ?? 0),
                    };

                    framings[0] = updatedF;
                    return { ...s, framings };
                },
                { skipHistory: true }
            );
        }
    }, [frame.activeShot, selectedCameraBlockId, frame.shotLocalTimeMs, updateShot]);

    // Wheel handler: In camera tool or Alt held -> 3D camera dolly; Cmd/Ctrl zooms canvas; plain scroll pans canvas
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();

            // 1. Camera Navigation Tool (C) or Alt + Wheel: 3D Camera Dolly (Physical Z push)
            if (activeTool === 'camera' || e.altKey) {
                const zoomFactor = e.deltaY < 0 ? 1.06 : 0.94;
                const currentShot = frame.activeShot;
                const selectedCamBlock = currentShot.cameraBlocks?.find(
                    (b) => b.id === selectedCameraBlockId
                );
                let baseZoom = currentShot.framings?.[0]?.zoom ?? frame.camera.zoom;
                if (selectedCamBlock) {
                    const midMs = selectedCamBlock.startMs + selectedCamBlock.durationMs / 2;
                    const which: 'from' | 'to' = frame.shotLocalTimeMs < midMs ? 'from' : 'to';
                    baseZoom = selectedCamBlock[which]?.zoom ?? baseZoom;
                }
                const nextZoom = Number(
                    Math.max(0.2, Math.min(5.0, baseZoom * zoomFactor)).toFixed(3)
                );
                beginDragTransaction();
                updateActiveShotCamera({ zoom: nextZoom });
                commitDragTransaction();
                return;
            }

            // 2. 2D Workspace Canvas Pan & Zoom
            if (e.metaKey || e.ctrlKey) {
                const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
                setCanvasZoom((prev) => prev * zoomFactor);
            } else {
                setCanvasPan((prev) => ({
                    x: prev.x - e.deltaX,
                    y: prev.y - e.deltaY,
                }));
            }
        };

        el.addEventListener('wheel', handleWheel, { passive: false });
        return () => el.removeEventListener('wheel', handleWheel);
    }, [
        setCanvasZoom,
        setCanvasPan,
        activeTool,
        frame.activeShot,
        selectedCameraBlockId,
        frame.camera.zoom,
        frame.shotLocalTimeMs,
        beginDragTransaction,
        commitDragTransaction,
        updateActiveShotCamera,
    ]);

    const ratioSpec = ASPECT_RATIO_CONFIG[project.aspectRatio];
    const targetAspect = ratioSpec.widthRatio / ratioSpec.heightRatio;
    const availableAspect = viewportSize.width / viewportSize.height;

    let frameWidth: number;
    let frameHeight: number;

    if (availableAspect > targetAspect) {
        frameHeight = viewportSize.height;
        frameWidth = Math.round(frameHeight * targetAspect);
    } else {
        frameWidth = viewportSize.width;
        frameHeight = Math.round(frameWidth / targetAspect);
    }

    const isCameraSelected = Boolean(selectedCameraBlockId);

    const effectiveViewportFrame = useMemo(() => {
        if (isCameraSelected) {
            const designCamera: EvaluatedCamera = {
                target: { x: 0, y: 0, z: 0 },
                rotation: { x: 0, y: 0, z: 0 },
                zoom: 1,
                fovDegrees: 27.0006,
                focalLength: 50,
                activeMode: 'static',
            };
            return {
                ...frame,
                camera: designCamera,
            };
        }
        return frame;
    }, [frame, isCameraSelected]);

    const exteriorSilhouettes = useMemo(() => {
        if (isPlaying) {
            return [];
        }

        const defaultCamera = project.defaultCamera || {
            position: { x: 0, y: 0, z: DEFAULT_CAMERA_Z },
            rotation: { x: 0, y: 0, z: 0 },
            focalLength: DEFAULT_FOCAL_LENGTH,
        };
        const activeCamera = effectiveViewportFrame.camera;
        const cameraPose = evaluateCameraPose(activeCamera, defaultCamera, targetAspect);
        const refCameraZ = defaultCamera.position?.z ?? DEFAULT_CAMERA_Z;
        const refFocalLength = defaultCamera.focalLength ?? DEFAULT_FOCAL_LENGTH;

        const silhouettes: { id: string; points: string }[] = [];

        for (const evalLayer of frame.layers) {
            if (evalLayer.visible === false || (evalLayer.opacity ?? 1) <= 0) continue;
            const proj = getLayerProjectedCorners(
                evalLayer,
                frameWidth,
                frameHeight,
                targetAspect,
                cameraPose,
                refCameraZ,
                refFocalLength
            );

            const isOutside = proj.corners.some(
                (c) => c.x < -0.5 || c.x > frameWidth + 0.5 || c.y < -0.5 || c.y > frameHeight + 0.5
            );

            if (isOutside) {
                const pointsStr = proj.corners
                    .map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`)
                    .join(' ');
                silhouettes.push({ id: evalLayer.id, points: pointsStr });
            }
        }
        return silhouettes;
    }, [
        isPlaying,
        frame.layers,
        effectiveViewportFrame.camera,
        project.defaultCamera,
        targetAspect,
        frameWidth,
        frameHeight,
    ]);

    const eff = frame.effects.state;
    const effectiveBackground = resolveShotBackground(project, frame.activeShot);
    const isTransparentBg = effectiveBackground.kind === 'transparent';
    const showGradientAngleControl = gradientEditorActive
        && effectiveBackground.kind === 'gradient'
        && effectiveBackground.gradientType !== 'radial';

    const updateGradientAngleFromPointer = (event: React.PointerEvent<SVGGElement>) => {
        event.stopPropagation();
        const svgEl = event.currentTarget.ownerSVGElement;
        if (!svgEl) return;
        const rect = svgEl.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const x = ((event.clientX - rect.left) / rect.width) * frameWidth - frameWidth / 2;
        const y = ((event.clientY - rect.top) / rect.height) * frameHeight - frameHeight / 2;
        if (Math.hypot(x, y) < 8) return;
        const angle = Math.round((Math.atan2(x, -y) * 180 / Math.PI + 360) % 360);
        setGradientEditorAngle(angle);

        const halfLen = Math.hypot(frameWidth, frameHeight) / 2;
        const rad = (angle * Math.PI) / 180;
        const dx = Math.sin(rad) * halfLen;
        const dy = -Math.cos(rad) * halfLen;
        const cx = frameWidth / 2;
        const cy = frameHeight / 2;
        const handles = {
            start: { x: (cx - dx) / frameWidth, y: (cy - dy) / frameHeight },
            end: { x: (cx + dx) / frameWidth, y: (cy + dy) / frameHeight },
        };

        const currentShot = frame.activeShot;
        if (currentShot.useProjectBackground === false && currentShot.background?.kind === 'gradient') {
            updateShot(currentShot.id, (s) => ({
                ...s,
                background: s.background?.kind === 'gradient'
                    ? { ...s.background, angle, handles }
                    : s.background,
            }));
        } else if (project.background.kind === 'gradient') {
            updateProject((p) => ({
                ...p,
                background: p.background.kind === 'gradient'
                    ? { ...p.background, angle, handles }
                    : p.background,
            }));
        }
    };

    const handleGradientAnglePointerDown = (event: React.PointerEvent<SVGGElement>) => {
        event.preventDefault();
        beginDragTransaction();
        updateGradientAngleFromPointer(event);
        event.currentTarget.setPointerCapture(event.pointerId);
    };

    const handleGradientAnglePointerMove = (event: React.PointerEvent<SVGGElement>) => {
        if (event.buttons === 1) updateGradientAngleFromPointer(event);
    };

    const handleGradientAnglePointerUp = (event: React.PointerEvent<SVGGElement>) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        commitDragTransaction();
    };

    const handleGradientAnglePointerCancel = (event: React.PointerEvent<SVGGElement>) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        commitDragTransaction();
    };
    const colorGradeCss = eff.colorGrade.enabled
        ? `brightness(${eff.colorGrade.exposure}) contrast(${eff.colorGrade.contrast}) saturate(${eff.colorGrade.saturation})`
        : undefined;

    const isCreationTool = ['text', 'image', 'rectangle', 'ellipse', 'line', 'arrow', 'polygon', 'pen'].includes(
        activeTool
    );

    const handleSetOrientation = (orbitDeg: number, tiltDeg: number) => {
        beginDragTransaction();
        updateActiveShotCamera({ orbit: orbitDeg, tilt: tiltDeg });
        commitDragTransaction();
    };

    const handleResetCamera = () => {
        beginDragTransaction();
        updateActiveShotCamera({
            orbit: 0,
            tilt: 0,
            targetX: 0,
            targetY: 0,
            zoom: 1,
        });
        commitDragTransaction();
    };

    // ============================================================================
    // WORKSPACE MOUSE DOWN: Camera Orbit/Pan/Dolly, Hand Pan, Drawing, or Deselect
    // ============================================================================
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
    const handleSelectLayerWithDeepSelect = (
        clickedLayerId: string,
        multiSelect?: boolean
    ) => {
        if (isCreationTool) return;
        onSelectLayer(clickedLayerId, multiSelect);
    };

    const selectedLayer = frame.activeShot.layers.find((l) =>
        selectedLayerIds.includes(l.id)
    );

    // ============================================================================
    // DRAG AND DROP ON CANVAS: Drop external desktop files or assets library items
    // ============================================================================
    const handleCanvasDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        if (!isDraggingOver) setIsDraggingOver(true);
    };

    const handleCanvasDragLeave = (e: React.DragEvent) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setIsDraggingOver(false);
        }
    };

    const handleCanvasDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);

        const frameRect = stageFrameRef.current?.getBoundingClientRect();
        let dropX = 0;
        let dropY = 0;
        if (frameRect) {
            dropX = Math.max(
                -0.95,
                Math.min(
                    0.95,
                    Number(((e.clientX - frameRect.left) / frameRect.width - 0.5).toFixed(3))
                )
            );
            dropY = Math.max(
                -0.95,
                Math.min(
                    0.95,
                    Number(((e.clientY - frameRect.top) / frameRect.height - 0.5).toFixed(3))
                )
            );
        }

        // Helper: compute fitted image dimensions preserving aspect ratio
        const computeFittedImageDimensions = (assetWidth?: number, assetHeight?: number) => {
            const assetAspect = (assetWidth || 1920) / (assetHeight || 1080);
            const frameAspect = frameWidth / frameHeight;
            let w = 0.55;
            let h = (w * frameAspect) / assetAspect;
            if (h > 0.8) {
                h = 0.8;
                w = (h * assetAspect) / frameAspect;
            }
            return { width: Number(w.toFixed(3)), height: Number(h.toFixed(3)) };
        };

        // 1. Dragged from LeftPanel Assets library
        const assetId = e.dataTransfer.getData('application/x-raylight-asset-id');
        if (assetId && project.assets[assetId]) {
            const asset = project.assets[assetId];
            const size = computeFittedImageDimensions(asset.width, asset.height);

            const newLayer = addLayerToShot(frame.activeShot.id, 'image', {
                name: asset.name,
                assetId: asset.id,
                position: { x: dropX, y: dropY, z: 0 },
                size,
                rotation: { x: 0, y: 0, z: 0 },
            });
            selectLayer(newLayer.id, false);
            return;
        }

        // 2. Desktop Files (Images, SVGs)
        const files = Array.from(e.dataTransfer.files || []);
        if (files.length === 0) return;

        for (const file of files) {
            if (file.name.endsWith('.svg') || file.type === 'image/svg+xml') {
                try {
                    const svgText = await file.text();
                    const parsed = parseFigmaSvgToLayers(
                        svgText,
                        frame.activeShot.durationMs,
                        frame.activeShot.layers.length
                    );
                    if (parsed.layers.length > 0) {
                        addMultipleLayersToShot(
                            frame.activeShot.id,
                            parsed.layers,
                            parsed.assets
                        );
                        setSelectedLayerIds(parsed.layers.map((l) => l.id));
                    }
                } catch (err) {
                    console.error('Failed to parse dropped SVG:', err);
                }
            } else if (file.type.startsWith('image/')) {
                try {
                    const assetRecord = await readImageFileWithThumbnail(file);
                    updateProject(
                        (p) => ({
                            ...p,
                            assets: { ...p.assets, [assetRecord.id]: assetRecord },
                        }),
                        { skipHistory: true }
                    );

                    const size = computeFittedImageDimensions(assetRecord.width, assetRecord.height);

                    const newLayer = addLayerToShot(frame.activeShot.id, 'image', {
                        name: file.name.replace(/\.[^/.]+$/, '') || 'Dropped image',
                        assetId: assetRecord.id,
                        position: { x: dropX, y: dropY, z: 0 },
                        size,
                        rotation: { x: 0, y: 0, z: 0 },
                    });
                    selectLayer(newLayer.id, false);
                } catch (err) {
                    console.error('Failed to load dropped image:', err);
                }
            }
        }
    };

    // ============================================================================
    // RIGHT-CLICK CONTEXT MENU (Audit Section 6.4)
    // ============================================================================
    const handleContextMenu = (e: React.MouseEvent) => {
        if (activeTool === 'camera' || e.altKey) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        e.preventDefault();
        e.stopPropagation();

        const targetEl = e.target as HTMLElement;
        const layerEl = targetEl.closest('[data-layer-id]');
        const clickedLayerId = layerEl?.getAttribute('data-layer-id');

        if (clickedLayerId) {
            if (!selectedLayerIds.includes(clickedLayerId)) {
                selectLayer(clickedLayerId, false);
            }
            setContextMenu({
                x: e.clientX,
                y: e.clientY,
                layerId: clickedLayerId,
            });
        } else if (selectedLayerIds.length > 0) {
            setContextMenu({
                x: e.clientX,
                y: e.clientY,
                layerId: selectedLayerIds[0],
            });
        } else {
            setContextMenu({
                x: e.clientX,
                y: e.clientY,
                layerId: null,
            });
        }
    };

    const contextMenuLayer = contextMenu?.layerId
        ? frame.activeShot.layers.find((l) => l.id === contextMenu.layerId) || null
        : null;

    return (
        <div
            ref={containerRef}
            onMouseDown={handleWorkspaceMouseDown}
            onContextMenu={handleContextMenu}
            onDragOver={handleCanvasDragOver}
            onDragLeave={handleCanvasDragLeave}
            onDrop={handleCanvasDrop}
            className={`flex-1 bg-[var(--canvas-workspace,#080a10)] relative flex items-center justify-center overflow-hidden select-none ${activeTool === 'hand' || isSpaceHeld
                    ? 'cursor-grab active:cursor-grabbing'
                    : activeTool === 'camera'
                        ? 'cursor-move active:cursor-grabbing'
                        : isCreationTool
                            ? 'cursor-crosshair'
                            : 'cursor-default'
                }`}
        >
            {/* PAN & ZOOM WORKSPACE TRANSFORM WRAPPER */}
            <div
                style={{
                    transform: `translate3d(${canvasPan.x}px, ${canvasPan.y}px, 0) scale(${canvasZoom})`,
                    transformOrigin: 'center center',
                }}
                className="relative flex items-center justify-center"
            >
                {/* THE STAGE FRAME */}
                <div
                    ref={stageFrameRef}
                    className={`relative overflow-visible ${isTransparentBg
                        ? 'bg-[repeating-conic-gradient(#1c1c21_0%_25%,#101014_0%_50%)] bg-[size:20px_20px]'
                        : 'bg-[var(--bg-canvas,#07080d)]'
                        }`}
                    style={{
                        width: `${frameWidth}px`,
                        height: `${frameHeight}px`,
                        filter: colorGradeCss,
                        boxShadow: 'none',
                    }}
                >
                    {/* EXTERIOR SILHOUETTES: Rendered on editor background outside the artboard */}
                    {exteriorSilhouettes.length > 0 && (
                        <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none z-10">
                            <defs>
                                <mask id="outside-artboard-mask">
                                    <rect x="-50000" y="-50000" width="100000" height="100000" fill="white" />
                                    <rect x="0" y="0" width={frameWidth} height={frameHeight} fill="black" />
                                </mask>
                            </defs>
                            <g mask="url(#outside-artboard-mask)">
                                {exteriorSilhouettes.map((sil) => (
                                    <polygon
                                        key={`sil-${sil.id}`}
                                        points={sil.points}
                                        fill="#52525b"
                                        fillOpacity={0.4}
                                    />
                                ))}
                            </g>
                        </svg>
                    )}

                    {/* PRIMARY 3D VIEWPORT CANVAS (Three.js / React Three Fiber - Raylight Engine) */}
                    <div className="absolute inset-0 overflow-hidden pointer-events-auto border border-black/80 shadow-2xl">
                        <ViewportCanvas
                            project={project}
                            canvasZoom={canvasZoom}
                            frameWidth={frameWidth}
                            frameHeight={frameHeight}
                            frame={effectiveViewportFrame}
                            selectedLayerIds={selectedLayerIds}
                            onSelectLayer={handleSelectLayerWithDeepSelect}
                            onPointerMissed={() => {
                                if (
                                    useSelectionStore.getState().isTransformDragging ||
                                    useProjectStore.getState().dragSnapshot !== null
                                ) {
                                    return;
                                }
                                clearLayerSelection();
                            }}
                            cameraRef={cameraRef}
                        />
                    </div>

                    {showGradientAngleControl && (
                        <svg
                            aria-label="Drag to set gradient direction"
                            className="absolute inset-0 z-40 h-full w-full overflow-visible touch-none pointer-events-none"
                            viewBox={`0 0 ${frameWidth} ${frameHeight}`}
                        >
                            {(() => {
                                const radians = gradientEditorAngle * Math.PI / 180;
                                const halfLength = Math.hypot(frameWidth, frameHeight) / 2;
                                const dx = Math.sin(radians) * halfLength;
                                const dy = -Math.cos(radians) * halfLength;
                                const cx = frameWidth / 2;
                                const cy = frameHeight / 2;
                                const x1 = cx - dx;
                                const y1 = cy - dy;
                                const x2 = cx + dx;
                                const y2 = cy + dy;
                                return (
                                    <g
                                        className="pointer-events-auto"
                                        onPointerDown={handleGradientAnglePointerDown}
                                        onPointerMove={handleGradientAnglePointerMove}
                                        onPointerUp={handleGradientAnglePointerUp}
                                        onPointerCancel={handleGradientAnglePointerCancel}
                                    >
                                        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth="24" className="cursor-crosshair pointer-events-auto" />
                                        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="white" strokeWidth="1.5" className="pointer-events-none drop-shadow" />
                                        <circle cx={x1} cy={y1} r="7" fill="#0b0b0e" stroke="var(--accent-primary,#0088ff)" strokeWidth="2.5" className="cursor-crosshair pointer-events-auto" />
                                        <circle cx={x2} cy={y2} r="7" fill="#0b0b0e" stroke="var(--accent-primary,#0088ff)" strokeWidth="2.5" className="cursor-crosshair pointer-events-auto" />
                                        <text x={frameWidth / 2 + 10} y={frameHeight / 2 - 10} fill="white" fontSize="11" className="pointer-events-none" paintOrder="stroke" stroke="#111" strokeWidth="3">{Math.round(gradientEditorAngle)}°</text>
                                    </g>
                                );
                            })()}
                        </svg>
                    )}

                    {/* Drag & Drop Target Glow Overlay */}
                    {isDraggingOver && (
                        <div className="absolute inset-0 z-50 bg-[var(--accent-primary,#0088ff)]/15 border-2 border-dashed border-[var(--accent-primary,#0088ff)] rounded-xl flex flex-col items-center justify-center gap-2 backdrop-blur-[2px] pointer-events-none animate-pulse motion-reduce:animate-none">
                            <div className="w-12 h-12 rounded-full bg-[var(--accent-primary,#0088ff)]/20 border border-[var(--accent-primary,#0088ff)]/40 flex items-center justify-center text-[var(--accent-primary,#0088ff)]">
                                <UploadCloud className="w-6 h-6" />
                            </div>
                            <span className="text-sm font-semibold text-white drop-shadow">
                                Drop image or SVG to add to scene
                            </span>
                            <span className="text-[11px] text-sky-200/80">
                                Places layer at cursor with natural dimensions
                            </span>
                        </div>
                    )}

                    {/* SCENE POST-PROCESSING OVERLAYS (Vignette, Edge Fade, Film Grain) */}
                    <div className="absolute inset-0 overflow-hidden pointer-events-none z-20">
                        {eff.vignette.enabled && (
                            <div
                                className="absolute inset-0"
                                style={{
                                    boxShadow: `inset 0 0 ${Math.round(
                                        Math.min(frameWidth, frameHeight) * 0.45
                                    )}px rgba(0, 0, 0, ${eff.vignette.intensity})`,
                                }}
                            />
                        )}

                        {eff.edgeFade.enabled && (
                            <div
                                className="absolute inset-0"
                                style={{
                                    boxShadow: `inset 0 ${Math.round(
                                        eff.edgeFade.top * 120
                                    )}px 60px -20px #05060a, inset 0 -${Math.round(
                                        eff.edgeFade.bottom * 120
                                    )}px 60px -20px #05060a`,
                                }}
                            />
                        )}

                        {eff.filmGrain.enabled && (
                            <div
                                className="absolute inset-0 mix-blend-overlay pointer-events-none"
                                style={{
                                    opacity: Math.min(0.35, (eff.filmGrain?.intensity ?? 0.02) * 2.5),
                                }}
                            >
                                <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                                    <filter id="cinematic-film-grain">
                                        <feTurbulence
                                            type="fractalNoise"
                                            baseFrequency="0.8"
                                            numOctaves="3"
                                            stitchTiles="stitch"
                                            seed={frame.frameNumber % 100}
                                        />
                                        <feColorMatrix type="saturate" values="0" />
                                    </filter>
                                    <rect width="100%" height="100%" filter="url(#cinematic-film-grain)" />
                                </svg>
                            </div>
                        )}
                    </div>

                    {/* MIDDLE SURFACE: Smart Alignment Snapping Guides & Safe Area */}
                    <Guides
                        guides={activeGuides}
                        showSafeArea={showSafeArea}
                        frameWidth={frameWidth}
                        frameHeight={frameHeight}
                        cameraZoom={frame.camera.zoom}
                        cameraTargetX={frame.camera.target.x}
                        cameraTargetY={frame.camera.target.y}
                    />

                    {/* Rubber-band Draw Box when dragging to create a new layer */}
                    {drawBox && (
                        <div
                            className="absolute border-2 border-[var(--accent-primary,#0088ff)] bg-[var(--accent-primary,#0088ff)]/15 rounded pointer-events-none z-40"
                            style={{
                                left: `${drawBox.x}px`,
                                top: `${drawBox.y}px`,
                                width: `${drawBox.w}px`,
                                height: `${drawBox.h}px`,
                            }}
                        />
                    )}

                    {/* On-Canvas Marquee Box Multi-Selection */}
                    {marqueeBox && (
                        <div
                            className="absolute border-2 border-dashed border-[var(--accent-primary,#0088ff)] bg-[var(--accent-primary,#0088ff)]/15 rounded pointer-events-none z-40"
                            style={{
                                left: `${Math.min(marqueeBox.startX, marqueeBox.currentX)}px`,
                                top: `${Math.min(marqueeBox.startY, marqueeBox.currentY)}px`,
                                width: `${Math.abs(marqueeBox.currentX - marqueeBox.startX)}px`,
                                height: `${Math.abs(marqueeBox.currentY - marqueeBox.startY)}px`,
                            }}
                        />
                    )}

                    {/* Visual Camera Move Framing Rectangles (From/To) */}
                    <CameraFramingOverlay
                        shot={frame.activeShot}
                        selectedCameraBlockId={selectedCameraBlockId}
                        frameWidth={frameWidth}
                        frameHeight={frameHeight}
                        cameraZoom={frame.camera.zoom}
                        canvasZoom={canvasZoom}
                    />

                    {/* TOP SURFACE: 3D-Aware Selection Gizmo & Multi-Select Overlay */}
                    <SelectionOverlay
                        frame={effectiveViewportFrame}
                        selectedLayerIds={selectedLayerIds}
                        frameWidth={frameWidth}
                        frameHeight={frameHeight}
                        snapEnabled={snapEnabled}
                        onUpdateGuides={setActiveGuides}
                        onSelectLayer={handleSelectLayerWithDeepSelect}
                        cameraRef={cameraRef}
                    />
                </div>
            </div>

            {/* Top-Right 3D Interactive Orientation Gizmo HUD */}
            <OrientationGizmo
                topInset={rightSidebarOpen ? 12 : 56}
                cameraRotation={effectiveViewportFrame.camera.rotation}
                onSetOrientation={handleSetOrientation}
                onDragStart={beginDragTransaction}
                onDragOrientation={(orbit, tilt) => updateActiveShotCamera({ orbit, tilt })}
                onDragEnd={commitDragTransaction}
                onResetCamera={handleResetCamera}
                currentZoom={effectiveViewportFrame.camera.zoom}
            />

            {/* Top-Center Camera Tool Floating Pill (when camera tool is active) */}
            {activeTool === 'camera' && !isAnimateMode && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-[var(--bg-surface,#161619)]/95 backdrop-blur-xl border border-[var(--border-subtle,rgba(255,255,255,0.07))] text-[11px] font-medium text-[var(--text-primary,#f4f4f5)] flex items-center gap-3 shadow-2xl z-30 pointer-events-auto">
                    <div className="flex items-center gap-1.5 text-[var(--accent-primary,#0088ff)]">
                        <Camera className="w-3.5 h-3.5" />
                        <span className="font-semibold">Camera Tool (C)</span>
                    </div>
                    <div className="text-[10px] text-gray-400 font-mono hidden sm:flex items-center gap-2">
                        <span>Left-drag: Orbit</span>
                        <span>•</span>
                        <span>Middle: Pan</span>
                        <span>•</span>
                        <span>Right: Dolly</span>
                    </div>
                    <button
                        type="button"
                        onClick={handleResetCamera}
                        className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[10px] text-gray-200 cursor-pointer transition flex items-center gap-1"
                        title="Reset Camera Pose to Default"
                    >
                        <RotateCcw className="w-2.5 h-2.5" />
                        <span>Reset</span>
                    </button>
                </div>
            )}

            {/* Top-Center Active Animate Recording Pill (Raylight-style) */}
            {isAnimateMode && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-rose-600/90 backdrop-blur-md border border-rose-400/40 text-[11px] font-medium text-white flex items-center gap-2 shadow-lg animate-pulse motion-reduce:animate-none pointer-events-none z-30">
                    <span className="w-2 h-2 rounded-full bg-white" />
                    <span>REC (⇧A)</span>
                </div>
            )}

            {/* RAYLIGHT RIGHT-CLICK CONTEXT MENU (Audit Section 6.4) */}
            {contextMenu && (
                <div
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        left: `${Math.min(contextMenu.x, window.innerWidth - 232)}px`,
                        top: `${Math.min(
                            contextMenu.y,
                            window.innerHeight - (contextMenuLayer ? 390 : 220)
                        )}px`,
                    }}
                    className="fixed z-50 w-56 bg-[var(--bg-muted,#242428)]/98 backdrop-blur-xl border border-[var(--border-subtle,rgba(255,255,255,0.07))] shadow-2xl rounded-xl p-1 text-xs text-[var(--text-secondary,#d4d4d8)] flex flex-col gap-0.5 select-none"
                >
                    {contextMenuLayer ? (
                        <>
                            <div className="px-2.5 py-1 text-[10px] font-mono text-gray-400 uppercase tracking-wider truncate border-b border-white/10 mb-0.5">
                                {contextMenuLayer.name}
                            </div>
                            <button
                                onClick={() => {
                                    const dup = duplicateLayerInShot(
                                        frame.activeShot.id,
                                        contextMenuLayer.id
                                    );
                                    if (dup) selectLayer(dup.id, false);
                                    setContextMenu(null);
                                }}
                                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-sky-500/20 hover:text-white text-gray-300 transition text-left cursor-pointer group"
                            >
                                <div className="flex items-center gap-2">
                                    <Copy className="w-3.5 h-3.5 text-gray-400 group-hover:text-sky-300" />
                                    <span>Duplicate</span>
                                </div>
                                <span className="text-[10px] font-mono text-gray-500 group-hover:text-gray-300">
                                    ⌘D
                                </span>
                            </button>
                            <button
                                onClick={() => {
                                    const idsToGroup = selectedLayerIds.includes(
                                        contextMenuLayer.id
                                    )
                                        ? selectedLayerIds
                                        : [contextMenuLayer.id];
                                    createGroupFromLayers(frame.activeShot.id, idsToGroup);
                                    setContextMenu(null);
                                }}
                                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-sky-500/20 hover:text-white text-gray-300 transition text-left cursor-pointer group"
                            >
                                <div className="flex items-center gap-2">
                                    <FolderPlus className="w-3.5 h-3.5 text-gray-400 group-hover:text-sky-300" />
                                    <span>Group</span>
                                </div>
                                <span className="text-[10px] font-mono text-gray-500 group-hover:text-gray-300">
                                    ⌘G
                                </span>
                            </button>
                            {contextMenuLayer.groupId && (
                                <button
                                    onClick={() => {
                                        if (contextMenuLayer.groupId) {
                                            ungroupInShot(
                                                frame.activeShot.id,
                                                contextMenuLayer.groupId
                                            );
                                        }
                                        setContextMenu(null);
                                    }}
                                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-amber-500/20 hover:text-white text-gray-300 transition text-left cursor-pointer group"
                                >
                                    <div className="flex items-center gap-2">
                                        <FolderMinus className="w-3.5 h-3.5 text-amber-400" />
                                        <span>Ungroup</span>
                                    </div>
                                    <span className="text-[10px] font-mono text-gray-500 group-hover:text-gray-300">
                                        ⌘⇧G
                                    </span>
                                </button>
                            )}
                            <div className="my-1 border-t border-white/10" />
                            <button
                                onClick={() => {
                                    restackLayerInShot(
                                        frame.activeShot.id,
                                        contextMenuLayer.id,
                                        'front'
                                    );
                                    setContextMenu(null);
                                }}
                                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-sky-500/20 hover:text-white text-gray-300 transition text-left cursor-pointer group"
                            >
                                <div className="flex items-center gap-2">
                                    <ChevronsUp className="w-3.5 h-3.5 text-gray-400 group-hover:text-sky-300" />
                                    <span>Bring to Front</span>
                                </div>
                                <span className="text-[10px] font-mono text-gray-500 group-hover:text-gray-300">
                                    ⌘⇧]
                                </span>
                            </button>
                            <button
                                onClick={() => {
                                    restackLayerInShot(
                                        frame.activeShot.id,
                                        contextMenuLayer.id,
                                        'forward'
                                    );
                                    setContextMenu(null);
                                }}
                                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-sky-500/20 hover:text-white text-gray-300 transition text-left cursor-pointer group"
                            >
                                <div className="flex items-center gap-2">
                                    <ChevronUp className="w-3.5 h-3.5 text-gray-400 group-hover:text-sky-300" />
                                    <span>Bring Forward</span>
                                </div>
                                <span className="text-[10px] font-mono text-gray-500 group-hover:text-gray-300">
                                    ⌘]
                                </span>
                            </button>
                            <button
                                onClick={() => {
                                    restackLayerInShot(
                                        frame.activeShot.id,
                                        contextMenuLayer.id,
                                        'backward'
                                    );
                                    setContextMenu(null);
                                }}
                                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-sky-500/20 hover:text-white text-gray-300 transition text-left cursor-pointer group"
                            >
                                <div className="flex items-center gap-2">
                                    <ChevronDown className="w-3.5 h-3.5 text-gray-400 group-hover:text-sky-300" />
                                    <span>Send Backward</span>
                                </div>
                                <span className="text-[10px] font-mono text-gray-500 group-hover:text-gray-300">
                                    ⌘[
                                </span>
                            </button>
                            <button
                                onClick={() => {
                                    restackLayerInShot(
                                        frame.activeShot.id,
                                        contextMenuLayer.id,
                                        'back'
                                    );
                                    setContextMenu(null);
                                }}
                                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-sky-500/20 hover:text-white text-gray-300 transition text-left cursor-pointer group"
                            >
                                <div className="flex items-center gap-2">
                                    <ChevronsDown className="w-3.5 h-3.5 text-gray-400 group-hover:text-sky-300" />
                                    <span>Send to Back</span>
                                </div>
                                <span className="text-[10px] font-mono text-gray-500 group-hover:text-gray-300">
                                    ⌘⇧[
                                </span>
                            </button>
                            <div className="my-1 border-t border-white/10" />
                            <button
                                onClick={() => {
                                    updateLayer(
                                        frame.activeShot.id,
                                        contextMenuLayer.id,
                                        (l) => ({ ...l, locked: !l.locked })
                                    );
                                    setContextMenu(null);
                                }}
                                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-gray-300 transition text-left cursor-pointer group"
                            >
                                <div className="flex items-center gap-2">
                                    {contextMenuLayer.locked ? (
                                        <Unlock className="w-3.5 h-3.5 text-amber-400" />
                                    ) : (
                                        <Lock className="w-3.5 h-3.5 text-gray-400 group-hover:text-sky-300" />
                                    )}
                                    <span>
                                        {contextMenuLayer.locked ? 'Unlock Layer' : 'Lock Layer'}
                                    </span>
                                </div>
                            </button>
                            <button
                                onClick={() => {
                                    updateLayer(
                                        frame.activeShot.id,
                                        contextMenuLayer.id,
                                        (l) => ({ ...l, hidden: !l.hidden })
                                    );
                                    setContextMenu(null);
                                }}
                                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-gray-300 transition text-left cursor-pointer group"
                            >
                                <div className="flex items-center gap-2">
                                    {contextMenuLayer.hidden ? (
                                        <Eye className="w-3.5 h-3.5 text-emerald-400" />
                                    ) : (
                                        <EyeOff className="w-3.5 h-3.5 text-gray-400 group-hover:text-sky-300" />
                                    )}
                                    <span>
                                        {contextMenuLayer.hidden ? 'Show Layer' : 'Hide Layer'}
                                    </span>
                                </div>
                                <span className="text-[10px] font-mono text-gray-500 group-hover:text-gray-300">
                                    ⌘⇧H
                                </span>
                            </button>
                            <div className="my-1 border-t border-white/10" />
                            <button
                                onClick={() => {
                                    deleteLayerFromShot(
                                        frame.activeShot.id,
                                        contextMenuLayer.id
                                    );
                                    setContextMenu(null);
                                }}
                                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 transition text-left cursor-pointer group"
                            >
                                <div className="flex items-center gap-2">
                                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                                    <span>Delete</span>
                                </div>
                                <span className="text-[10px] font-mono text-rose-400/70">
                                    Del
                                </span>
                            </button>
                        </>
                    ) : (
                        <>
                            <div className="px-2.5 py-1 text-[10px] font-mono text-gray-400 uppercase tracking-wider border-b border-white/10 mb-0.5">
                                Canvas
                            </div>
                            <button
                                onClick={() => {
                                    const l = addLayerToShot(frame.activeShot.id, 'text', {
                                        position: { x: 0, y: 0, z: 0 },
                                    });
                                    selectLayer(l.id, false);
                                    setContextMenu(null);
                                }}
                                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-sky-500/20 hover:text-white text-gray-300 transition text-left cursor-pointer group"
                            >
                                <div className="flex items-center gap-2">
                                    <Type className="w-3.5 h-3.5 text-sky-400" />
                                    <span>Add Text</span>
                                </div>
                                <span className="text-[10px] font-mono text-gray-500 group-hover:text-gray-300">
                                    T
                                </span>
                            </button>
                            <button
                                onClick={() => {
                                    const l = addLayerToShot(frame.activeShot.id, 'shape', {
                                        shape: 'rectangle',
                                        position: { x: 0, y: 0, z: 0 },
                                    });
                                    selectLayer(l.id, false);
                                    setContextMenu(null);
                                }}
                                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-sky-500/20 hover:text-white text-gray-300 transition text-left cursor-pointer group"
                            >
                                <div className="flex items-center gap-2">
                                    <Square className="w-3.5 h-3.5 text-amber-400" />
                                    <span>Add Rectangle</span>
                                </div>
                                <span className="text-[10px] font-mono text-gray-500 group-hover:text-gray-300">
                                    R
                                </span>
                            </button>
                            <button
                                onClick={() => {
                                    const l = addLayerToShot(frame.activeShot.id, 'shape', {
                                        shape: 'ellipse',
                                        position: { x: 0, y: 0, z: 0 },
                                    });
                                    selectLayer(l.id, false);
                                    setContextMenu(null);
                                }}
                                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-sky-500/20 hover:text-white text-gray-300 transition text-left cursor-pointer group"
                            >
                                <div className="flex items-center gap-2">
                                    <Circle className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>Add Ellipse</span>
                                </div>
                                <span className="text-[10px] font-mono text-gray-500 group-hover:text-gray-300">
                                    O
                                </span>
                            </button>
                            <div className="my-1 border-t border-white/10" />
                            <button
                                onClick={() => {
                                    setSelectedLayerIds(
                                        frame.activeShot.layers.map((l) => l.id)
                                    );
                                    setContextMenu(null);
                                }}
                                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-sky-500/20 hover:text-white text-gray-300 transition text-left cursor-pointer group"
                            >
                                <div className="flex items-center gap-2">
                                    <Layers className="w-3.5 h-3.5 text-gray-400 group-hover:text-sky-300" />
                                    <span>Select All Layers</span>
                                </div>
                                <span className="text-[10px] font-mono text-gray-500 group-hover:text-gray-300">
                                    ⌘A
                                </span>
                            </button>
                            <button
                                onClick={() => {
                                    resetCanvasView();
                                    setContextMenu(null);
                                }}
                                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-white/10 hover:text-white text-gray-300 transition text-left cursor-pointer group"
                            >
                                <div className="flex items-center gap-2">
                                    <RotateCcw className="w-3.5 h-3.5 text-gray-400 group-hover:text-sky-300" />
                                    <span>Reset View to Fit</span>
                                </div>
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* FLOATING BOTTOM CANVAS TOOLBAR */}
            <CanvasToolbar
                selectedLayer={selectedLayer}
                showSafeArea={showSafeArea}
                onToggleSafeArea={onToggleSafeArea}
                onOpenShortcuts={onOpenShortcuts}
            />
        </div>
    );
};

export const Stage = React.memo(StageComponent);
