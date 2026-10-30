import { GradientEditor } from './GradientEditor';
import { handleStageContextMenu } from './stageContextMenu';
import { useStageCameraFraming } from './useStageCameraFraming';
import { StageCameraHud } from './StageCameraHud';
import { StageCanvasContextMenu } from './StageCanvasContextMenu';
import { StageInteractionOverlayStack } from './StageInteractionOverlayStack';
import { useStageAssetDrop } from './useStageAssetDrop';
import { useStagePointerInteractions } from './useStagePointerInteractions';
import { useStageWheelNavigation } from './useStageWheelNavigation';
import { useStageViewportModel } from './useStageViewportModel';
import { useStageDofFocus } from './useStageDofFocus';
import { useStageCameraUpdate } from './useStageCameraUpdate';
import { useStageGlobalInteractions } from './useStageGlobalInteractions';

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { UploadCloud } from 'lucide-react';
import type { Project } from '../model/types';
import { evaluateProjectAtTime, type EvaluatedProjectFrame } from '../engine/evaluateShot';
import { useProjectStore } from '../store/useProjectStore';
import { usePlayheadStore } from '../store/usePlayheadStore';
import { useSelectionStore } from '../store/useSelectionStore';
import { type SnapGuideLine } from './stageUtils';
import { CanvasToolbar } from './CanvasToolbar';
import { ViewportCanvas } from './webgl/ViewportCanvas';
import * as THREE from 'three';
import { radToDeg } from '../model/defaults';
import {
    DEFAULT_CAMERA_Z,
    DEFAULT_FOCAL_LENGTH,
    getLayerProjectedCorners,
} from './webgl/cameraMath';

interface StageProps {
    project: Project;
    frame?: EvaluatedProjectFrame;
    selectedLayerIds: string[];
    onSelectLayer: (layerId: string, multiSelect?: boolean) => void;
    showSafeArea?: boolean;
    snapEnabled?: boolean;
    onToggleSafeArea?: () => void;
    onOpenShortcuts?: () => void;
}

const StageComponent: React.FC<StageProps> = ({
    project,
    frame: propFrame,
    selectedLayerIds,
    onSelectLayer,
    showSafeArea = true,
    snapEnabled = true,
    onToggleSafeArea,
    onOpenShortcuts,
}) => {
    const storeCurrentTimeMs = usePlayheadStore((s) => s.currentTimeMs);
    const storeHoverTimeMs = usePlayheadStore((s) => s.hoverTimeMs);
    const effectiveTimeMs = storeHoverTimeMs !== null ? storeHoverTimeMs : storeCurrentTimeMs;
    const evaluatedFrame = useMemo(
        () => propFrame ?? evaluateProjectAtTime(project, effectiveTimeMs),
        [propFrame, project, effectiveTimeMs]
    );
    const frame = evaluatedFrame;

    const {
        addLayerToShot,
        updateProject,
        updateShot,
        updateLayer,
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
        clearLayerSelection,
        gradientEditorActive,
        gradientEditorLayerId,
        cameraBookmarks,
        setCameraBookmark,
        setGradientEditorAngle,
        selectedCameraBlockId,
        dofFocusActive,
        dofFocusIndicator,
        setDofFocusActive,
        setDofFocusIndicator,
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

    const selectedLayerSet = useMemo(
        () => new Set(selectedLayerIds),
        [selectedLayerIds]
    );

    const handleFrameSelectedLayersRef = useRef<() => void>(() => {});
    const dismissContextMenu = useCallback(() => setContextMenu(null), []);
    useStageGlobalInteractions({
        containerRef,
        contextMenuOpen: contextMenu !== null,
        dismissContextMenu,
        setViewportSize,
        setIsSpaceHeld,
        frameSelectedLayersRef: handleFrameSelectedLayersRef,
    });

    // ============================================================================
    // 3D CAMERA RIG CONTROLLER (Cinema 4D / Blender Style Viewport Navigation)
    // ============================================================================
    const updateActiveShotCamera = useStageCameraUpdate({ frame, selectedCameraBlockId, updateShot });

    useStageWheelNavigation({
        containerRef,
        activeTool,
        frame,
        selectedCameraBlockId,
        beginDragTransaction,
        commitDragTransaction,
        updateActiveShotCamera,
        setCanvasZoom,
        setCanvasPan,
    });

    const isCameraSelected = Boolean(selectedCameraBlockId);
    const {
        targetAspect,
        frameWidth,
        frameHeight,
        effectiveViewportFrame,
        exteriorSilhouettes,
        effectiveBackground,
        gradientReferenceCamera,
        gradientCameraPose,
    } = useStageViewportModel({ project, frame, viewportSize, isCameraSelected, activeTool, isPlaying });
    const isTransparentBg = effectiveBackground.kind === 'transparent';
    const gradientShapeLayer = gradientEditorLayerId
        ? frame.activeShot.layers.find((layer) => layer.id === gradientEditorLayerId && layer.kind === 'shape')
        : undefined;
    const showShapeGradientAngleControl = gradientEditorActive
        && gradientShapeLayer?.kind === 'shape'
        && selectedLayerIds.includes(gradientShapeLayer.id)
        && gradientShapeLayer.fill.kind === 'gradient'
        && !['mesh', 'diamond'].includes(gradientShapeLayer.fill.gradientType ?? 'linear');
    const showGradientAngleControl = showShapeGradientAngleControl || (gradientEditorActive
        && !gradientEditorLayerId
        && effectiveBackground.kind === 'gradient'
);
    const gradientShapeFrameLayer = gradientEditorLayerId
        ? frame.layers.find((layer) => layer.id === gradientEditorLayerId)
        : undefined;
    const handleDofFocusClick = useStageDofFocus({
        stageFrameRef,
        frame,
        frameWidth,
        frameHeight,
        canvasZoom,
        targetAspect,
        cameraPose: gradientCameraPose,
        defaultCamera: gradientReferenceCamera,
        updateShot,
        setDofFocusIndicator,
        setDofFocusActive,
    });
    const isCreationTool = ['text', 'image', 'rectangle', 'ellipse', 'line', 'arrow', 'polygon', 'pen'].includes(
        activeTool
    );

    const handleSetOrientation = useCallback((
        orbitDeg: number,
        tiltDeg: number,
        rollDeg: number = 0,
        zoomVal?: number
    ) => {
        beginDragTransaction();
        updateActiveShotCamera({
            orbit: orbitDeg,
            tilt: tiltDeg,
            roll: rollDeg,
            ...(zoomVal !== undefined ? { zoom: zoomVal } : {}),
        });
        commitDragTransaction();
    }, [beginDragTransaction, updateActiveShotCamera, commitDragTransaction]);

    const handleResetCamera = useCallback(() => {
        beginDragTransaction();
        updateActiveShotCamera({
            orbit: 0,
            tilt: 0,
            roll: 0,
            targetX: 0,
            targetY: 0,
            zoom: 1,
        });
        commitDragTransaction();
    }, [beginDragTransaction, updateActiveShotCamera, commitDragTransaction]);

    const currentShotCameraBookmark = cameraBookmarks[frame.activeShot.id];
    const handlePinCameraView = useCallback(() => {
        if (useSelectionStore.getState().cameraBookmarks[frame.activeShot.id]) {
            setCameraBookmark(frame.activeShot.id, null);
            return;
        }
        const camera = frame.camera;
        setCameraBookmark(frame.activeShot.id, {
            orbit: radToDeg(camera.rotation.y),
            tilt: radToDeg(camera.rotation.x),
            roll: radToDeg(camera.rotation.z),
            zoom: camera.zoom,
            targetX: camera.target.x,
            targetY: camera.target.y,
            targetZ: camera.target.z,
            focalLength: camera.focalLength,
        });
    }, [frame.camera, frame.activeShot.id, setCameraBookmark]);

    const handleBackFromOrbitCamera = useCallback(() => {
        if (currentShotCameraBookmark) {
            beginDragTransaction();
            updateActiveShotCamera({
                orbit: currentShotCameraBookmark.orbit,
                tilt: currentShotCameraBookmark.tilt,
                roll: currentShotCameraBookmark.roll,
                targetX: currentShotCameraBookmark.targetX,
                targetY: currentShotCameraBookmark.targetY,
                targetZ: currentShotCameraBookmark.targetZ,
                zoom: currentShotCameraBookmark.zoom,
                focalLength: currentShotCameraBookmark.focalLength,
            });
            commitDragTransaction();
        }
        setActiveTool('select');
    }, [currentShotCameraBookmark, beginDragTransaction, updateActiveShotCamera, commitDragTransaction, setActiveTool]);

    const handleFrameSelectedLayers = useStageCameraFraming({
        frame,
        frameWidth,
        frameHeight,
        beginDragTransaction,
        commitDragTransaction,
        updateCamera: updateActiveShotCamera,
        resetCamera: handleResetCamera,
    });

    useEffect(() => {
        handleFrameSelectedLayersRef.current = handleFrameSelectedLayers;
    }, [handleFrameSelectedLayers]);

    // ============================================================================
    // WORKSPACE MOUSE DOWN: Camera Orbit/Pan/Dolly, Hand Pan, Drawing, or Deselect
    // ============================================================================
    const handleWorkspaceMouseDown = useStagePointerInteractions({
        activeTool, isSpaceHeld, frame, project, selectedCameraBlockId, canvasZoom,
        frameWidth, frameHeight, isCreationTool, selectedLayerIds, stageFrameRef, canvasPan,
        onSelectLayer, beginDragTransaction, commitDragTransaction, updateActiveShotCamera,
        setCanvasPan, setActiveTool, setDrawBox, setMarqueeBox, setSelectedLayerIds,
        clearLayerSelection, addLayerToShot,
    });
    const handleSelectLayerWithDeepSelect = (
        clickedLayerId: string,
        multiSelect?: boolean
    ) => {
        if (isCreationTool) return;
        onSelectLayer(clickedLayerId, multiSelect);
    };

    const selectedLayer = useMemo(
        () =>
            selectedLayerIds.length > 0
                ? frame.activeShot.layers.find((l) => selectedLayerSet.has(l.id))
                : undefined,
        [frame.activeShot.layers, selectedLayerIds.length, selectedLayerSet]
    );

    // ============================================================================
    const { handleCanvasDragOver, handleCanvasDragLeave, handleCanvasDrop } = useStageAssetDrop({ frame, project, stageFrameRef, frameWidth, frameHeight, isDraggingOver, setIsDraggingOver });

    // RIGHT-CLICK CONTEXT MENU (Audit Section 6.4)
    // ============================================================================
    const handleContextMenu = (event: React.MouseEvent) => handleStageContextMenu(event, {
        activeTool,
        selectedLayerIds,
        selectedLayerSet,
        selectLayer,
        setContextMenu,
    });

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

                    {showShapeGradientAngleControl && gradientShapeLayer?.kind === 'shape' && gradientShapeLayer.fill.kind === 'gradient' && gradientShapeFrameLayer && <GradientEditor
                        fill={gradientShapeLayer.fill}
                        corners={getLayerProjectedCorners(gradientShapeFrameLayer, frameWidth, frameHeight, targetAspect, gradientCameraPose, gradientReferenceCamera.position.z ?? DEFAULT_CAMERA_Z, gradientReferenceCamera.focalLength ?? DEFAULT_FOCAL_LENGTH).corners}
                        width={frameWidth} height={frameHeight}
                        begin={beginDragTransaction} commit={commitDragTransaction}
                        onChange={fill => { updateLayer(frame.activeShot.id, gradientShapeLayer.id, layer => layer.kind === 'shape' ? { ...layer, fill } : layer); setGradientEditorAngle(fill.angle); }}
                    />}
                    {showGradientAngleControl && !gradientEditorLayerId && effectiveBackground.kind === 'gradient' && <GradientEditor
                        fill={effectiveBackground}
                        corners={[{ x: 0, y: 0 }, { x: frameWidth, y: 0 }, { x: frameWidth, y: frameHeight }, { x: 0, y: frameHeight }]}
                        width={frameWidth} height={frameHeight} begin={beginDragTransaction} commit={commitDragTransaction}
                        onChange={fill => {
                            const background = { ...effectiveBackground, ...fill, gradientType: fill.gradientType === 'radial' || fill.gradientType === 'angular' ? fill.gradientType : 'linear' as const };
                            if (frame.activeShot.useProjectBackground === false) updateShot(frame.activeShot.id, shot => ({ ...shot, background }));
                            else updateProject(p => ({ ...p, background }));
                            setGradientEditorAngle(fill.angle);
                        }}
                    />}
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

                    <StageInteractionOverlayStack
                        frame={frame}
                        effectiveViewportFrame={effectiveViewportFrame}
                        frameWidth={frameWidth}
                        frameHeight={frameHeight}
                        canvasZoom={canvasZoom}
                        activeTool={activeTool}
                        selectedCameraBlockId={selectedCameraBlockId}
                        selectedLayerIds={selectedLayerIds}
                        snapEnabled={snapEnabled}
                        showSafeArea={showSafeArea}
                        activeGuides={activeGuides}
                        setActiveGuides={setActiveGuides}
                        handleSelectLayer={handleSelectLayerWithDeepSelect}
                        cameraRef={cameraRef}
                        referenceCamera={gradientReferenceCamera}
                        drawBox={drawBox}
                        marqueeBox={marqueeBox}
                        dofFocusActive={dofFocusActive}
                        dofFocusIndicator={dofFocusIndicator}
                        stageFrameRef={stageFrameRef}
                        onFocusClick={handleDofFocusClick}
                    />
                </div>
            </div>

            <StageCameraHud
                active={activeTool === 'camera'}
                rightSidebarOpen={rightSidebarOpen}
                pinned={Boolean(currentShotCameraBookmark)}
                zoom={canvasZoom}
                rotation={effectiveViewportFrame.camera.rotation}
                hasSelection={selectedLayerIds.length > 0}
                onSetOrientation={handleSetOrientation}
                onDragStart={beginDragTransaction}
                onDragOrientation={(orbit, tilt) => updateActiveShotCamera({ orbit, tilt })}
                onDragEnd={commitDragTransaction}
                onReset={handleResetCamera}
                onFrameSelection={handleFrameSelectedLayers}
                onPin={handlePinCameraView}
                onBack={handleBackFromOrbitCamera}
                onZoom={setCanvasZoom}
            />
            {/* Top-Center Active Animate Recording Pill (Raylight-style) */}
            {isAnimateMode && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-rose-600/90 backdrop-blur-md border border-rose-400/40 text-[11px] font-medium text-white flex items-center gap-2 shadow-lg animate-pulse motion-reduce:animate-none pointer-events-none z-30">
                    <span className="w-2 h-2 rounded-full bg-white" />
                    <span>REC (⇧A)</span>
                </div>
            )}

            {/* RAYLIGHT RIGHT-CLICK CONTEXT MENU (Audit Section 6.4) */}
            <StageCanvasContextMenu
                menu={contextMenu}
                layer={contextMenuLayer}
                frame={frame}
                selectedLayerIds={selectedLayerIds}
                selectedLayerSet={selectedLayerSet}
                targetAspect={targetAspect}
                effectiveTimeMs={effectiveTimeMs}
                onClose={() => setContextMenu(null)}
                onFrameSelection={handleFrameSelectedLayers}
            />
            {/* FLOATING BOTTOM CANVAS TOOLBAR */}
            <CanvasToolbar
                selectedLayer={selectedLayer}
                showSafeArea={showSafeArea}
                onToggleSafeArea={onToggleSafeArea}
                onOpenShortcuts={onOpenShortcuts}
                onFrameSelection={handleFrameSelectedLayers}
            />
        </div>
    );
};

export const Stage = React.memo(StageComponent);
