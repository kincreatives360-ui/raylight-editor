// src/stage/OrientationGizmo.tsx
import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import * as THREE from 'three';
import { RotateCcw, Focus, ChevronDown } from 'lucide-react';
import { radToDeg } from '../model/defaults';

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
    const orientationHelpId = useId();
    const quickViewsId = useId();
    const quickViewsTriggerRef = React.useRef<HTMLButtonElement>(null);
    const closeQuickViews = () => {
        setMenuOpen(false);
        quickViewsTriggerRef.current?.focus();
    };
    const dragStartRef = React.useRef<{
        x: number;
        y: number;
        startYaw: number;
        startPitch: number;
        pointerId: number;
        element: HTMLDivElement;
    } | null>(null);

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        if (dragStartRef.current) return;
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
            pointerId: e.pointerId,
            element: e.currentTarget,
        };
        onDragStart?.();
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!dragStartRef.current || dragStartRef.current.pointerId !== e.pointerId) return;
        e.preventDefault();
        e.stopPropagation();
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;

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

    const endDrag = useCallback((pointerId?: number) => {
        const drag = dragStartRef.current;
        if (!drag || (pointerId !== undefined && drag.pointerId !== pointerId)) return;
        dragStartRef.current = null;
        try {
            if (drag.element.hasPointerCapture(drag.pointerId)) {
                drag.element.releasePointerCapture(drag.pointerId);
            }
        } catch {
            // Capture may already have been released by the browser.
        }
        setIsDragging(false);
        onDragEnd?.();
    }, [onDragEnd]);

    useEffect(() => {
        const handleWindowBlur = () => endDrag();
        window.addEventListener('blur', handleWindowBlur);
        return () => window.removeEventListener('blur', handleWindowBlur);
    }, [endDrag]);

    const handleOrientationKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        const step = e.shiftKey ? 15 : e.altKey ? 1 : 5;
        let orbit = radToDeg(cameraRotation.y);
        let tilt = radToDeg(cameraRotation.x);

        switch (e.key) {
            case 'ArrowLeft': orbit -= step; break;
            case 'ArrowRight': orbit += step; break;
            case 'ArrowUp': tilt += step; break;
            case 'ArrowDown': tilt -= step; break;
            default: return;
        }

        e.preventDefault();
        e.stopPropagation();
        onSetOrientation(
            ((Math.round(orbit) % 360) + 360) % 360,
            Math.max(-89, Math.min(89, Math.round(tilt))),
            radToDeg(cameraRotation.z),
        );
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        endDrag(e.pointerId);
    };

    const handleLostPointerCapture = (e: React.PointerEvent<HTMLDivElement>) => {
        endDrag(e.pointerId);
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
            className="absolute right-3 z-35 flex flex-col items-center gap-1.5 select-none"
            style={{ top: topInset }}
        >
            {/* 3D Trackball Sphere (The Ball Method) */}
            <div
                role="group"
                tabIndex={0}
                aria-label="Camera orientation"
                aria-describedby={orientationHelpId}
                onKeyDown={handleOrientationKeyDown}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onLostPointerCapture={handleLostPointerCapture}
                title="Drag to orbit; focus and use arrow keys to rotate the camera"
                className={`relative group flex items-center justify-center w-13 h-13 rounded-full border touch-none cursor-grab active:cursor-grabbing transition-[transform,border-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                    isDragging
                        ? 'cursor-grabbing border-sky-400 ring-2 ring-sky-500/30 scale-105 shadow-2xl'
                        : 'border-white/15 hover:border-white/30 hover:scale-105 shadow-xl'
                }`}
                style={{
                    background: 'radial-gradient(circle at 35% 35%, rgba(255, 255, 255, 0.16) 0%, rgba(255, 255, 255, 0.05) 40%, rgba(0, 0, 0, 0.55) 85%, rgba(0, 0, 0, 0.85) 100%), #141418',
                    boxShadow: isDragging
                        ? 'inset 0 1px 2px rgba(255,255,255,0.35), inset 0 -3px 6px rgba(0,0,0,0.8), 0 8px 20px rgba(0,0,0,0.6)'
                        : 'inset 0 1px 1px rgba(255,255,255,0.25), inset 0 -2px 4px rgba(0,0,0,0.7), 0 4px 14px rgba(0,0,0,0.5)',
                }}
            >
                <svg
                    width="44"
                    height="44"
                    viewBox="-22 -22 44 44"
                    className="overflow-visible pointer-events-none"
                >
                    {/* Equatorial & Meridian latitude circles on the sphere */}
                    <circle
                        cx="0"
                        cy="0"
                        r="18"
                        fill="none"
                        stroke="rgba(255, 255, 255, 0.12)"
                        strokeWidth="1"
                    />
                    <ellipse
                        cx="0"
                        cy="0"
                        rx="18"
                        ry={Math.max(1, 18 * Math.abs(Math.sin(cameraRotation.x)))}
                        fill="none"
                        stroke="rgba(255, 255, 255, 0.1)"
                        strokeWidth="0.75"
                        strokeDasharray="2 2"
                    />
                    <ellipse
                        cx="0"
                        cy="0"
                        rx={Math.max(1, 18 * Math.abs(Math.cos(cameraRotation.y)))}
                        ry="18"
                        fill="none"
                        stroke="rgba(255, 255, 255, 0.1)"
                        strokeWidth="0.75"
                        strokeDasharray="2 2"
                    />

                    {/* Projected 3D Axes drawn back-to-front */}
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
                                        strokeWidth={isPositive ? 2 : 1}
                                        strokeDasharray={isPositive ? 'none' : '2 2'}
                                    />
                                    <circle
                                        cx={axis.px}
                                        cy={axis.py}
                                        r={isPositive ? 3.5 : 2}
                                        fill={axis.color}
                                    />
                                    <text
                                        x={axis.px * 1.3}
                                        y={axis.py * 1.3 + 3}
                                        fill={axis.color}
                                        fontSize="10"
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

                {/* Subtle core jewel center */}
                <div className={`absolute w-1.5 h-1.5 rounded-full pointer-events-none transition-colors ${
                    isDragging ? 'bg-sky-400 ring-2 ring-sky-400/40' : 'bg-white/80'
                }`} />
            </div>

            <span id={orientationHelpId} className="sr-only">
                Drag to orbit the camera. When focused, use the arrow keys to rotate in 5 degree steps, Shift plus an arrow for 15 degree steps, or Alt plus an arrow for 1 degree steps.
            </span>

            {/* Minimalist Controls Under the Ball: Single Reset Button & Settings toggle */}
            <div className="relative flex items-center gap-1">
                <button
                    type="button"
                    onClick={onResetCamera}
                    aria-label="Reset camera pose to default"
                    title="Reset Camera Pose to Default"
                    className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#18181c]/90 hover:bg-[#25252b] border border-white/10 hover:border-white/20 text-[#a1a1aa] hover:text-white text-[11px] font-mono cursor-pointer transition shadow-sm"
                >
                    <RotateCcw className="w-2.5 h-2.5" />
                    <span>Reset</span>
                </button>

                {/* Screen settings trigger for presets and framing */}
                <button
                    type="button"
                    ref={quickViewsTriggerRef}
                    onClick={() => setMenuOpen((prev) => !prev)}
                    aria-label="Camera angles and framing presets"
                    aria-expanded={menuOpen}
                    aria-controls={quickViewsId}
                    title="Camera angles and framing presets"
                    className={`p-1 rounded-full bg-[#18181c]/90 hover:bg-[#25252b] border border-white/10 text-[#a1a1aa] hover:text-white cursor-pointer transition shadow-sm ${
                        menuOpen ? 'bg-white/20 text-white' : ''
                    }`}
                >
                    <ChevronDown className={`w-2.5 h-2.5 transition-transform duration-150 ${menuOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Quick Views reveals below the gizmo controls without shifting the canvas. */}
                <div
                    id={quickViewsId}
                    aria-hidden={!menuOpen}
                    inert={!menuOpen}
                    className={`absolute right-0 top-full mt-1.5 flex w-44 origin-top-right flex-col gap-1.5 rounded-xl border border-white/10 bg-[#141418]/95 p-2 text-left text-white/90 shadow-2xl backdrop-blur-xl z-40 pointer-events-auto select-none transition-[opacity,transform,visibility] ${
                        menuOpen
                            ? 'visible translate-y-0 scale-100 opacity-100 duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)]'
                            : 'invisible pointer-events-none translate-y-1 scale-[.98] opacity-0 duration-100 ease-in'
                    }`}
                    onPointerDown={(e) => e.stopPropagation()}
                    onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                            event.preventDefault();
                            event.stopPropagation();
                            closeQuickViews();
                        }
                    }}
                >
                    <div className="text-[11px] font-semibold text-white/50 uppercase tracking-wider px-1">
                        Quick Views
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                        <button
                            type="button"
                            onClick={() => { onSetOrientation(0, 0, 0); closeQuickViews(); }}
                            className="px-2 py-1 rounded bg-white/[0.05] hover:bg-white/10 text-[11px] text-[#d4d4d8] hover:text-white font-mono cursor-pointer transition text-left"
                        >
                            Front
                        </button>
                        <button
                            type="button"
                            onClick={() => { onSetOrientation(0, -89, 0); closeQuickViews(); }}
                            className="px-2 py-1 rounded bg-white/[0.05] hover:bg-white/10 text-[11px] text-[#d4d4d8] hover:text-white font-mono cursor-pointer transition text-left"
                        >
                            Top
                        </button>
                        <button
                            type="button"
                            onClick={() => { onSetOrientation(90, 0, 0); closeQuickViews(); }}
                            className="px-2 py-1 rounded bg-white/[0.05] hover:bg-white/10 text-[11px] text-[#d4d4d8] hover:text-white font-mono cursor-pointer transition text-left"
                        >
                            Right
                        </button>
                        <button
                            type="button"
                            onClick={() => { onSetOrientation(45, 35.26, 0); closeQuickViews(); }}
                            className="px-2 py-1 rounded bg-sky-500/10 hover:bg-sky-500/20 text-[11px] text-sky-400 hover:text-sky-300 font-mono cursor-pointer transition text-left"
                        >
                            Iso
                        </button>
                    </div>

                    {onFrameSelection && (
                        <button
                            type="button"
                            onClick={() => { onFrameSelection(); closeQuickViews(); }}
                            className="mt-1 w-full flex items-center justify-between px-2 py-1 rounded bg-white/[0.05] hover:bg-white/10 text-[11px] text-[#d4d4d8] hover:text-white cursor-pointer transition"
                        >
                            <span className="flex items-center gap-1.5">
                                <Focus className="w-3 h-3 text-sky-400" />
                                <span>{hasSelection ? 'Frame Selection' : 'Frame Scene'}</span>
                            </span>
                            <kbd className="text-[10px] text-white/40 font-mono">F</kbd>
                        </button>
                    )}
                </div>
            </div>

            {/* Readout Pill (Visible on hover/drag to keep canvas clean) */}
            <div className={`px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 text-[11px] font-mono tabular-nums text-[#a1a1aa] tracking-tight pointer-events-none transition-opacity duration-150 ${
                isHovered || isDragging ? 'opacity-100' : 'opacity-0'
            }`}>
                {yawDeg}° / {pitchDeg}° • {Number(currentZoom.toFixed(2))}x
            </div>
        </div>
    );
};
