import React from 'react';
import { OrbitCameraControls } from './OrbitCameraOverlay';
import { OrientationGizmo } from './OrientationGizmo';
import { FocusDistanceHud } from './FocusDistanceHud';

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
    /** Live camera optics */
    focalLengthMm?: number;
    /** DOF state from active shot */
    dofEnabled?: boolean;
    focusDistance?: number;
    focusRange?: number;
    aperture?: number;
    focusMode?: 'manual' | 'target' | 'selection';
    onFocusDistanceChange?: (value: number) => void;
    onBeginFocusPick?: () => void;
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
    focalLengthMm,
    dofEnabled,
    focusDistance,
    focusRange,
    aperture,
    focusMode,
    onFocusDistanceChange,
    onBeginFocusPick,
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
        {/* Optical HUD – only while editing, never baked into export */}
        {dofEnabled && focusDistance != null && aperture != null && (
            <FocusDistanceHud
                enabled={dofEnabled}
                focusDistance={focusDistance}
                focusRange={focusRange ?? 0.85}
                aperture={aperture}
                focalLength={focalLengthMm ?? 50}
                focusMode={focusMode}
                onFocusDistanceChange={onFocusDistanceChange}
                onBeginFocusPick={onBeginFocusPick}
            />
        )}
        {/* Focal length readout when DOF is off but camera is active */}
        {!dofEnabled && focalLengthMm != null && (
            <div
                style={{
                    position: 'absolute',
                    left: 12,
                    bottom: 12,
                    zIndex: 40,
                    pointerEvents: 'none',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                    fontSize: 11,
                    color: 'rgba(255,255,255,0.9)',
                    textShadow: '0 1px 2px rgba(0,0,0,0.7)',
                    background: 'rgba(8,10,14,0.5)',
                    backdropFilter: 'blur(8px)',
                    borderRadius: 8,
                    padding: '6px 10px',
                    border: '1px solid rgba(255,255,255,0.08)',
                }}
            >
                <span style={{ opacity: 0.65, marginRight: 6 }}>FL</span>
                <span style={{ fontWeight: 600 }}>{Math.round(focalLengthMm)}mm</span>
            </div>
        )}
    </>
);
