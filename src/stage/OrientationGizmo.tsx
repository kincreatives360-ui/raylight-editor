// src/stage/OrientationGizmo.tsx
import React, { useMemo, useState } from 'react';
import * as THREE from 'three';
import { RotateCcw, Focus, ChevronDown, ChevronUp } from 'lucide-react';
import { radToDeg } from '../model/defaults';
import { CAMERA_PRESETS } from './webgl/cameraMath';

interface OrientationGizmoProps {
    cameraRotation: { x: number; y: number; z: number };
    onSetOrientation: (orbitDeg: number, tiltDeg: number, rollDeg?: number, zoom?: number) => void;
    onDragStart?: () => void;
    onDragOrientation?: (orbitDeg: number, tiltDeg: number, rollDeg?: number) => void;
    onDragEnd?: () => void;
    onResetCamera: () => void;
    onFrameSelection?: () => void;
    hasSelection?: boolean;
    currentZoom?: number;
    topInset?: number;
}

export const OrientationGizmo: React.FC<OrientationGizmoProps> = ({
    cameraRotation,
    onSetOrientation,
    onDragStart,
    onDragOrientation,
    onDragEnd,
    onResetCamera,
    onFrameSelection,
    hasSelection = false,
    currentZoom = 1,
    topInset = 12,
}) => {
    const [isHovered, setIsHovered] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const dragStartRef = React.useRef<{
        x: number;
        y: number;
        startYaw: number;
        startPitch: number;
        hasMoved: boolean;
    } | null>(null);

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        try {
            e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
            // ignore
        }
        setIsDragging(true);
        dragStartRef.current = {
            x: e.clientX,
            y: e.clientY,
            startYaw: radToDeg(cameraRotation.y),
            startPitch: radToDeg(cameraRotation.x),
            hasMoved: false,
        };
        onDragStart?.();
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!dragStartRef.current) return;
        e.preventDefault();
        e.stopPropagation();
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;
        if (Math.hypot(dx, dy) > 2) {
            dragStartRef.current.hasMoved = true;
        }

        const deltaOrbit = dx * 0.75;
        const deltaTilt = -dy * 0.75;
        const nextOrbit = Math.round((dragStartRef.current.startYaw + deltaOrbit + 3600) % 360);
        const nextTilt = Math.max(-89, Math.min(89, Math.round(dragStartRef.current.startPitch + deltaTilt)));
        if (onDragOrientation) {
            onDragOrientation(nextOrbit, nextTilt);
        } else {
            onSetOrientation(nextOrbit, nextTilt);
        }
    };

    const endDrag = () => {
        if (!dragStartRef.current) return;
        setIsDragging(false);
        dragStartRef.current = null;
        onDragEnd?.();
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        try {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                e.currentTarget.releasePointerCapture(e.pointerId);
            }
        } catch {
            // ignore
        }
        endDrag();
    };

    const handleLostPointerCapture = (_e: React.PointerEvent<HTMLDivElement>) => {
        endDrag();
    };

    // Compute projected 2D coordinates for the unit axes (X, Y, Z)
    const axes = useMemo(() => {
        const euler = new THREE.Euler(
            cameraRotation.x,
            cameraRotation.y,
            cameraRotation.z,
            'YXZ'
        );
        const matrix = new THREE.Matrix4().makeRotationFromEuler(euler);

        // Unit vectors for world axes
        const vX = new THREE.Vector3(1, 0, 0).applyMatrix4(matrix);
        const vY = new THREE.Vector3(0, 1, 0).applyMatrix4(matrix);
        const vZ = new THREE.Vector3(0, 0, 1).applyMatrix4(matrix);

        const radius = 22; // px radius on HUD

        return {
            x: {
                px: vX.x * radius,
                py: -vX.y * radius,
                depth: vX.z,
                label: 'X',
                color: 'var(--accent-danger, #f43f5e)',
            },
            y: {
                px: vY.x * radius,
                py: -vY.y * radius,
                depth: vY.z,
                label: 'Y',
                color: 'var(--accent-success, #10b981)',
            },
            z: {
                px: vZ.x * radius,
                py: -vZ.y * radius,
                depth: vZ.z,
                label: 'Z',
                color: 'var(--accent-primary, #0088ff)',
            },
        };
    }, [cameraRotation.x, cameraRotation.y, cameraRotation.z]);

    // Current angles in degrees for tooltip / readout
    const pitchDeg = Math.round(radToDeg(cameraRotation.x));
    const yawDeg = Math.round(radToDeg(cameraRotation.y));

    return (
        <div
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="absolute right-3 z-35 flex flex-col items-end gap-1.5 select-none"
            style={{ top: topInset }}
        >
            {/* Main Interactive Orbit Tripod Sphere (Drag to Orbit / Tilt) */}
            <div
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onLostPointerCapture={handleLostPointerCapture}
                title="Drag to orbit 3D camera (Yaw & Pitch) • Click axis to snap"
                className={`relative group flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--bg-surface,#161619)]/90 backdrop-blur-md border shadow-xl touch-none ${
                    isDragging
                        ? 'cursor-grabbing border-[var(--border-focus,#0088ff)] ring-2 ring-[var(--accent-glow,rgba(0,136,255,0.25))] shadow-lg scale-105 transition-none'
                        : 'cursor-grab border-[var(--border-subtle,rgba(255,255,255,0.07))] hover:border-[var(--border-medium,rgba(255,255,255,0.12))] hover:scale-102 transition-[transform,border-color,box-shadow] duration-100 ease-out'
                }`}
            >
                <svg
                    width="48"
                    height="48"
                    viewBox="-24 -24 48 48"
                    className="overflow-visible pointer-events-none"
                >
                    {/* Background sphere grid / horizon circle */}
                    <circle
                        cx="0"
                        cy="0"
                        r="20"
                        fill="rgba(255, 255, 255, 0.02)"
                        stroke={isDragging ? 'var(--accent-primary, #0088ff)' : 'rgba(255, 255, 255, 0.08)'}
                        strokeWidth={isDragging ? 1.5 : 1}
                    />

                    {/* Axes drawn back-to-front by depth */}
                    {[axes.x, axes.y, axes.z]
                        .sort((a, b) => a.depth - b.depth)
                        .map((axis) => {
                            const isPositive = axis.depth >= -0.2;
                            return (
                                <g key={axis.label} opacity={isPositive ? 1 : 0.45}>
                                    <line
                                        x1="0"
                                        y1="0"
                                        x2={axis.px}
                                        y2={axis.py}
                                        stroke={axis.color}
                                        strokeWidth={isPositive ? 2 : 1.25}
                                        strokeDasharray={isPositive ? 'none' : '2 2'}
                                    />
                                    <circle
                                        cx={axis.px}
                                        cy={axis.py}
                                        r={isPositive ? 3.5 : 2.5}
                                        fill={axis.color}
                                    />
                                    <text
                                        x={axis.px * 1.3}
                                        y={axis.py * 1.3 + 3}
                                        fill={axis.color}
                                        fontSize="10.5"
                                        fontWeight="bold"
                                        textAnchor="middle"
                                        fontFamily="Inter, monospace"
                                    >
                                        {axis.label}
                                    </text>
                                </g>
                            );
                        })}
                </svg>

                {/* Subtle Center Pivot Point */}
                <div className={`absolute w-1.5 h-1.5 rounded-full pointer-events-none transition-colors ${
                    isDragging ? 'bg-[var(--accent-primary,#0088ff)]' : 'bg-white/70'
                }`} />
            </div>

            {/* Quick Snapping Perspective Presets & Framing (Shown on hover or when menu open) */}
            <div
                className={`flex items-center gap-1 bg-[var(--bg-muted,#242428)]/95 backdrop-blur-md border border-[var(--border-subtle,rgba(255,255,255,0.07))] rounded-xl px-1.5 py-1 shadow-lg transition-[opacity,transform] duration-150 ease-out ${
                    isHovered || menuOpen
                        ? 'opacity-100 translate-y-0 pointer-events-auto'
                        : 'opacity-0 -translate-y-1 pointer-events-none'
                }`}
            >
                {/* Framing / Focus Button */}
                {onFrameSelection && (
                    <button
                        type="button"
                        onClick={onFrameSelection}
                        title={hasSelection ? "Frame Selected Layer(s) [F]" : "Frame All Visible Content [F]"}
                        className={`p-1 rounded cursor-pointer transition-colors ${
                            hasSelection
                                ? 'text-[var(--accent-primary,#0088ff)] hover:text-white hover:bg-white/10'
                                : 'text-[var(--text-muted,#a1a1aa)] hover:text-white hover:bg-white/10'
                        }`}
                    >
                        <Focus className="w-3 h-3" />
                    </button>
                )}

                {onFrameSelection && <div className="w-px h-3 bg-white/15 mx-0.5" />}

                {/* Primary Quick Snap Buttons */}
                <button
                    type="button"
                    onClick={() => onSetOrientation(0, 0, 0)}
                    title="Front View (0°, 0°)"
                    className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium text-[var(--text-secondary,#d4d4d8)] hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
                >
                    Front
                </button>
                <button
                    type="button"
                    onClick={() => onSetOrientation(0, -89, 0)}
                    title="Top View (0°, -89°)"
                    className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium text-[var(--text-secondary,#d4d4d8)] hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
                >
                    Top
                </button>
                <button
                    type="button"
                    onClick={() => onSetOrientation(90, 0, 0)}
                    title="Right View (90°, 0°)"
                    className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium text-[var(--text-secondary,#d4d4d8)] hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
                >
                    Right
                </button>
                <button
                    type="button"
                    onClick={() => onSetOrientation(45, 35.26, 0)}
                    title="Isometric 3D View (45°, 35°)"
                    className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium text-[var(--accent-primary,#0088ff)] hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
                >
                    Iso
                </button>

                {/* Dropdown toggle for full preset categories */}
                <button
                    type="button"
                    onClick={() => setMenuOpen((prev) => !prev)}
                    title="All Camera Presets (Axial, Axonometric, Cinematic)"
                    className={`p-1 rounded cursor-pointer transition-colors ${
                        menuOpen ? 'bg-white/15 text-white' : 'text-[var(--text-muted,#a1a1aa)] hover:text-white hover:bg-white/10'
                    }`}
                >
                    {menuOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>

                <div className="w-px h-3 bg-white/15 mx-0.5" />
                <button
                    type="button"
                    onClick={onResetCamera}
                    title="Reset Camera Pose to Default"
                    className="p-1 rounded text-[var(--text-muted,#a1a1aa)] hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
                >
                    <RotateCcw className="w-3 h-3" />
                </button>
            </div>

            {/* Expanded Presets Popover Menu */}
            {menuOpen && (
                <div
                    className="flex flex-col gap-2 w-48 p-2 rounded-xl bg-[var(--bg-surface,#161619)]/95 backdrop-blur-xl border border-[var(--border-subtle,rgba(255,255,255,0.1))] shadow-2xl z-40 text-left pointer-events-auto select-none"
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    {(['axial', 'axonometric', 'cinematic'] as const).map((cat) => {
                        const items = CAMERA_PRESETS.filter((p) => p.category === cat);
                        const catLabel = cat === 'axial' ? 'Axial Views' : cat === 'axonometric' ? 'Axonometric' : 'Cinematic';
                        return (
                            <div key={cat} className="space-y-0.5">
                                <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--text-muted,#71717a)] px-1.5 py-0.5">
                                    {catLabel}
                                </div>
                                <div className="grid grid-cols-2 gap-0.5">
                                    {items.map((preset) => (
                                        <button
                                            key={preset.id}
                                            type="button"
                                            onClick={() => {
                                                onSetOrientation(preset.orbit, preset.tilt, preset.roll, preset.zoom);
                                                setMenuOpen(false);
                                            }}
                                            title={preset.description}
                                            className="px-1.5 py-1 rounded text-[10px] font-mono text-left text-[var(--text-secondary,#d4d4d8)] hover:text-white hover:bg-white/10 truncate transition-colors cursor-pointer"
                                        >
                                            {preset.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Readout pill */}
            <div className="px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm border border-[var(--border-subtle,rgba(255,255,255,0.07))] text-[10px] font-mono tabular-nums text-[var(--text-muted,#a1a1aa)] tracking-tight pointer-events-none">
                {yawDeg}° / {pitchDeg}° • {Number(currentZoom.toFixed(2))}x
            </div>
        </div>
    );
};
