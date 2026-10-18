// src/stage/OrientationGizmo.tsx
import React, { useMemo, useState } from 'react';
import * as THREE from 'three';
import { RotateCcw } from 'lucide-react';
import { radToDeg } from '../model/defaults';

interface OrientationGizmoProps {
    cameraRotation: { x: number; y: number; z: number };
    onSetOrientation: (orbitDeg: number, tiltDeg: number, rollDeg?: number) => void;
    onDragStart?: () => void;
    onDragOrientation?: (orbitDeg: number, tiltDeg: number, rollDeg?: number) => void;
    onDragEnd?: () => void;
    onResetCamera: () => void;
    currentZoom?: number;
}

export const OrientationGizmo: React.FC<OrientationGizmoProps> = ({
    cameraRotation,
    onSetOrientation,
    onDragStart,
    onDragOrientation,
    onDragEnd,
    onResetCamera,
    currentZoom = 1,
}) => {
    const [isHovered, setIsHovered] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
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
        const nextTilt = Math.max(-85, Math.min(85, Math.round(dragStartRef.current.startPitch + deltaTilt)));
        if (onDragOrientation) {
            onDragOrientation(nextOrbit, nextTilt);
        } else {
            onSetOrientation(nextOrbit, nextTilt);
        }
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!dragStartRef.current) return;
        setIsDragging(false);
        try {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                e.currentTarget.releasePointerCapture(e.pointerId);
            }
        } catch {
            // ignore
        }
        dragStartRef.current = null;
        onDragEnd?.();
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
                color: '#ef4444',
            },
            y: {
                px: vY.x * radius,
                py: -vY.y * radius,
                depth: vY.z,
                label: 'Y',
                color: '#10b981',
            },
            z: {
                px: vZ.x * radius,
                py: -vZ.y * radius,
                depth: vZ.z,
                label: 'Z',
                color: '#38bdf8',
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
            className="absolute top-3 right-3 z-35 flex flex-col items-end gap-1.5 select-none"
        >
            {/* Main Interactive Orbit Tripod Sphere (Drag to Orbit / Tilt) */}
            <div
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                title="Drag to orbit 3D camera (Yaw & Pitch) • Click axis to snap"
                className={`relative group flex items-center justify-center w-14 h-14 rounded-2xl bg-[#141417]/85 backdrop-blur-md border shadow-xl transition-all duration-150 touch-none ${
                    isDragging
                        ? 'cursor-grabbing border-sky-400 ring-2 ring-sky-400/50 shadow-sky-500/25 scale-105'
                        : 'cursor-grab border-white/10 hover:border-white/30 hover:scale-102'
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
                        stroke={isDragging ? 'rgba(56, 189, 248, 0.4)' : 'rgba(255, 255, 255, 0.08)'}
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
                                        fontSize="9"
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
                    isDragging ? 'bg-sky-400' : 'bg-white/70'
                }`} />
            </div>

            {/* Quick Snapping Perspective Presets (Shown on hover) */}
            <div
                className={`flex items-center gap-1 bg-[#141417]/90 backdrop-blur-md border border-white/10 rounded-xl px-1.5 py-1 shadow-lg transition-all duration-150 ${
                    isHovered
                        ? 'opacity-100 translate-y-0 pointer-events-auto'
                        : 'opacity-0 -translate-y-1 pointer-events-none'
                }`}
            >
                <button
                    type="button"
                    onClick={() => onSetOrientation(0, 0, 0)}
                    title="Front View (0°, 0°)"
                    className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium text-[#d4d4d8] hover:text-white hover:bg-white/10 cursor-pointer transition"
                >
                    Front
                </button>
                <button
                    type="button"
                    onClick={() => onSetOrientation(0, -85, 0)}
                    title="Top View (0°, -85°)"
                    className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium text-[#d4d4d8] hover:text-white hover:bg-white/10 cursor-pointer transition"
                >
                    Top
                </button>
                <button
                    type="button"
                    onClick={() => onSetOrientation(90, 0, 0)}
                    title="Right View (90°, 0°)"
                    className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium text-[#d4d4d8] hover:text-white hover:bg-white/10 cursor-pointer transition"
                >
                    Right
                </button>
                <button
                    type="button"
                    onClick={() => onSetOrientation(38, 22, 0)}
                    title="Isometric 3D View (38°, 22°)"
                    className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium text-[#38bdf8] hover:text-white hover:bg-white/10 cursor-pointer transition"
                >
                    Iso
                </button>
                <div className="w-px h-3 bg-white/15 mx-0.5" />
                <button
                    type="button"
                    onClick={onResetCamera}
                    title="Reset Camera Pose to Default"
                    className="p-1 rounded text-[#a1a1aa] hover:text-white hover:bg-white/10 cursor-pointer transition"
                >
                    <RotateCcw className="w-3 h-3" />
                </button>
            </div>

            {/* Readout pill */}
            <div className="px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm border border-white/[0.06] text-[9px] font-mono text-[#a1a1aa] tracking-tight pointer-events-none">
                {yawDeg}° / {pitchDeg}° • {Number(currentZoom.toFixed(2))}x
            </div>
        </div>
    );
};
