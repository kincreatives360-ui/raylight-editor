import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { PerspectiveCamera } from 'three';
import type { EvaluatedProjectFrame } from '../engine/evaluateShot';
import type { Project } from '../model/types';
import type { SnapGuideLine } from './stageUtils';
import { Guides } from './Guides';
import { OrbitCameraFrustum } from './OrbitCameraOverlay';
import { CameraFramingOverlay } from './CameraFramingOverlay';
import { SelectionOverlay } from './SelectionOverlay';
import { DepthOfFieldFocusOverlay } from './DepthOfFieldFocusOverlay';
import { LightingOverlay } from './LightingOverlay';

interface OverlayBox {
    x: number;
    y: number;
    w: number;
    h: number;
}

interface MarqueeBox {
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
}

interface StageInteractionOverlayStackProps {
    frame: EvaluatedProjectFrame;
    effectiveViewportFrame: EvaluatedProjectFrame;
    frameWidth: number;
    frameHeight: number;
    canvasZoom: number;
    activeTool: string;
    selectedCameraBlockId: string | null;
    selectedLayerIds: string[];
    snapEnabled: boolean;
    showSafeArea: boolean;
    activeGuides: SnapGuideLine[];
    setActiveGuides: Dispatch<SetStateAction<SnapGuideLine[]>>;
    handleSelectLayer: (layerId: string, multiSelect?: boolean) => void;
    cameraRef: RefObject<PerspectiveCamera | null>;
    referenceCamera: NonNullable<Project['defaultCamera']>;
    drawBox: OverlayBox | null;
    marqueeBox: MarqueeBox | null;
    dofFocusActive: boolean;
    dofFocusIndicator: { x: number; y: number } | null;
    stageFrameRef: RefObject<HTMLDivElement | null>;
    onFocusClick: (event: React.MouseEvent<HTMLDivElement>) => void;
}

export function StageInteractionOverlayStack({
    frame,
    effectiveViewportFrame,
    frameWidth,
    frameHeight,
    canvasZoom,
    activeTool,
    selectedCameraBlockId,
    selectedLayerIds,
    snapEnabled,
    showSafeArea,
    activeGuides,
    setActiveGuides,
    handleSelectLayer,
    cameraRef,
    referenceCamera,
    drawBox,
    marqueeBox,
    dofFocusActive,
    dofFocusIndicator,
    stageFrameRef,
    onFocusClick,
}: StageInteractionOverlayStackProps) {
    return (
        <>
            <Guides
                guides={activeGuides}
                showSafeArea={showSafeArea}
                frameWidth={frameWidth}
                frameHeight={frameHeight}
                cameraZoom={frame.camera.zoom}
                cameraTargetX={frame.camera.target.x}
                cameraTargetY={frame.camera.target.y}
            />

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

            {activeTool === 'camera' && (
                <OrbitCameraFrustum
                    camera={frame.camera}
                    observer={effectiveViewportFrame.camera}
                    reference={referenceCamera}
                    width={frameWidth}
                    height={frameHeight}
                />
            )}

            <CameraFramingOverlay
                shot={frame.activeShot}
                selectedCameraBlockId={selectedCameraBlockId}
                frameWidth={frameWidth}
                frameHeight={frameHeight}
                canvasZoom={canvasZoom}
            />

            <SelectionOverlay
                frame={effectiveViewportFrame}
                selectedLayerIds={selectedLayerIds}
                frameWidth={frameWidth}
                frameHeight={frameHeight}
                snapEnabled={snapEnabled}
                onUpdateGuides={setActiveGuides}
                onSelectLayer={handleSelectLayer}
                cameraRef={cameraRef}
            />

            <DepthOfFieldFocusOverlay
                active={dofFocusActive}
                indicator={dofFocusIndicator}
                stageFrameRef={stageFrameRef}
                onFocusClick={onFocusClick}
            />

            <LightingOverlay
                frame={effectiveViewportFrame}
                frameWidth={frameWidth}
                frameHeight={frameHeight}
            />
        </>
    );
}
