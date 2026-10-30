import React from 'react';
import { OrbitCameraControls } from './OrbitCameraOverlay';
import { OrientationGizmo } from './OrientationGizmo';

interface StageCameraHudProps {
    active: boolean;
    rightSidebarOpen: boolean;
    pinned: boolean;
    zoom: number;
    rotation: { x: number; y: number; z: number };
    hasSelection: boolean;
    onSetOrientation: (orbit: number, tilt: number, roll?: number, zoom?: number) => void;
    onDragStart: () => void;
    onDragOrientation: (orbit: number, tilt: number) => void;
    onDragEnd: () => void;
    onReset: () => void;
    onFrameSelection: () => void;
    onPin: () => void;
    onBack: () => void;
    onZoom: (zoom: number) => void;
}

export const StageCameraHud: React.FC<StageCameraHudProps> = ({
    active,
    rightSidebarOpen,
    pinned,
    zoom,
    rotation,
    hasSelection,
    onSetOrientation,
    onDragStart,
    onDragOrientation,
    onDragEnd,
    onReset,
    onFrameSelection,
    onPin,
    onBack,
    onZoom,
}) => (
    <>
        {!active && (
            <OrientationGizmo
                topInset={rightSidebarOpen ? 12 : 56}
                cameraRotation={rotation}
                onSetOrientation={onSetOrientation}
                onDragStart={onDragStart}
                onDragOrientation={onDragOrientation}
                onDragEnd={onDragEnd}
                onResetCamera={onReset}
                onFrameSelection={onFrameSelection}
                hasSelection={hasSelection}
                currentZoom={zoom}
            />
        )}
        {active && (
            <OrbitCameraControls
                pinned={pinned}
                zoom={zoom}
                onAngle={onSetOrientation}
                onPin={onPin}
                onBack={onBack}
                onZoom={onZoom}
            />
        )}
    </>
);
