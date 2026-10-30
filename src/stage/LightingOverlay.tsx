import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LightTypeIcon } from '../ui/LightTypeIcon';
import { SelectedLightGizmo, type UnifiedLight } from './SelectedLightGizmo';
import type { EvaluatedProjectFrame } from '../engine/evaluateShot';
import type { SceneLight } from '../model/types';
import { useProjectStore } from '../store/useProjectStore';
import { useSelectionStore } from '../store/useSelectionStore';
import {
    DEFAULT_CAMERA_Z,
    DEFAULT_FOCAL_LENGTH,
    evaluateCameraPose,
} from './webgl/cameraMath';
import {
    projectLightToScreen,
    unprojectScreenDeltaToLightDelta,
    calculateDepthDeltaFromScreen,
    lightToWorld,
    type Vec3Like,
} from './lightingMath';

interface LightingOverlayProps {
    frame: EvaluatedProjectFrame;
    frameWidth: number;
    frameHeight: number;
}

export const LightingOverlay: React.FC<LightingOverlayProps> = ({
    frame,
    frameWidth,
    frameHeight,
}) => {
    const { project, updateShot, beginDragTransaction, commitDragTransaction } = useProjectStore();
    const { selectedLightId, selectLight, canvasZoom } = useSelectionStore();

    const activeShot = frame.activeShot;
    const shotLight = activeShot.light;
    const showGizmos = shotLight?.showGizmos ?? true;

    // Camera pose evaluation
    const aspect = frameWidth / Math.max(1, frameHeight);
    const defaultCamera = useMemo(
        () => project.defaultCamera || {
            position: { x: 0, y: 0, z: DEFAULT_CAMERA_Z },
            rotation: { x: 0, y: 0, z: 0 },
            focalLength: DEFAULT_FOCAL_LENGTH,
        },
        [project.defaultCamera]
    );
    const cameraPose = useMemo(
        () => evaluateCameraPose(frame.camera, defaultCamera, aspect),
        [frame.camera, defaultCamera, aspect]
    );

    // Build unified lights array: Sun Key + extra Sources
    const allLights = useMemo<UnifiedLight[]>(() => {
        const keyLight: UnifiedLight = {
            id: 'sun-key',
            name: 'Sun Key',
            type: 'directional',
            position: shotLight?.position || { x: -0.28, y: 0.36, z: 0.9 },
            target: (shotLight as unknown as { target?: Vec3Like })?.target || { x: 0, y: 0, z: 0 },
            intensity: shotLight?.intensity ?? 1.2,
            color: '#ffffff',
            temperature: shotLight?.temperature ?? 6100,
        };

        const sources: UnifiedLight[] = (shotLight?.sources || []).map((s) => ({
            id: s.id,
            name: s.name || s.type,
            type: s.type,
            position: s.position,
            target: s.target || { x: 0, y: 0, z: 0 },
            intensity: s.intensity,
            color: s.color || '#ffffff',
            temperature: s.temperature,
            angle: s.angle ?? Math.PI / 6,
            penumbra: s.penumbra ?? 0.2,
            width: s.width ?? 3,
            height: s.height ?? 3,
            distance: s.distance ?? 5,
        }));

        return [keyLight, ...sources];
    }, [shotLight]);

    const selectedLight = useMemo(
        () => allLights.find((l) => l.id === selectedLightId),
        [allLights, selectedLightId]
    );

    const [activeDepthDrag, setActiveDepthDrag] = useState<number | null>(null);

    // Update light helper
    const updateLight = useCallback((patch: Partial<SceneLight>) => {
        if (!selectedLightId) return;

        const currentRig = activeShot.light || {
            position: { x: -0.28, y: 0.36, z: 0.9 },
            intensity: 1.2,
            temperature: 6100,
            ambience: 0.45,
        };

        if (selectedLightId === 'sun-key' || selectedLightId === 'key' || selectedLightId === 'sun') {
            updateShot(
                activeShot.id,
                {
                    light: {
                        ...currentRig,
                        ...patch,
                        position: patch.position ? { ...currentRig.position, ...patch.position } : currentRig.position,
                    },
                },
                { skipHistory: true }
            );
        } else {
            const currentSources = currentRig.sources || [];
            const nextSources = currentSources.map((s) => {
                if (s.id === selectedLightId) {
                    return {
                        ...s,
                        ...patch,
                        position: patch.position ? { ...s.position, ...patch.position } : s.position,
                        target: patch.target ? { ...(s.target || { x: 0, y: 0, z: 0 }), ...patch.target } : s.target,
                    };
                }
                return s;
            });
            updateShot(
                activeShot.id,
                {
                    light: {
                        ...currentRig,
                        sources: nextSources,
                    },
                },
                { skipHistory: true }
            );
        }
    }, [selectedLightId, activeShot, updateShot]);

    const activeDragCleanupRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        return () => {
            if (activeDragCleanupRef.current) {
                activeDragCleanupRef.current();
            }
        };
    }, []);

    const startDrag = useCallback(
        (onMove: (moveEv: PointerEvent) => void) => {
            if (activeDragCleanupRef.current) {
                activeDragCleanupRef.current();
            }

            beginDragTransaction();

            const cleanup = () => {
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', handleEnd);
                window.removeEventListener('pointercancel', handleEnd);
                activeDragCleanupRef.current = null;
                setActiveDepthDrag(null);
                commitDragTransaction();
            };

            const handleEnd = () => {
                cleanup();
            };

            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', handleEnd);
            window.addEventListener('pointercancel', handleEnd);
            activeDragCleanupRef.current = cleanup;
        },
        [beginDragTransaction, commitDragTransaction]
    );

    // Depth (Z) Drag Handler
    const handleDepthDragStart = useCallback((e: React.PointerEvent) => {
        if (!selectedLight) return;
        e.preventDefault();
        e.stopPropagation();

        const startClientY = e.clientY;
        const startZ = selectedLight.position.z ?? 1.0;
        setActiveDepthDrag(startZ);

        const onPointerMove = (moveEv: PointerEvent) => {
            const deltaPxY = (moveEv.clientY - startClientY) / canvasZoom;
            const nextZ = calculateDepthDeltaFromScreen(deltaPxY, startZ);
            setActiveDepthDrag(nextZ);
            updateLight({
                position: {
                    ...selectedLight.position,
                    z: nextZ,
                },
            });
        };

        startDrag(onPointerMove);
    }, [selectedLight, canvasZoom, startDrag, updateLight]);

    // Drag handlers
    const handleSourceDragStart = useCallback((e: React.PointerEvent) => {
        if (!selectedLight) return;
        e.preventDefault();
        e.stopPropagation();

        const startClientX = e.clientX;
        const startClientY = e.clientY;
        const startLightPos = { ...selectedLight.position };

        // Support Shift + Drag on source position handle for direct depth adjustment
        if (e.shiftKey) {
            handleDepthDragStart(e);
            return;
        }

        const onPointerMove = (moveEv: PointerEvent) => {
            const deltaScreenX = (moveEv.clientX - startClientX) / canvasZoom;
            const deltaScreenY = (moveEv.clientY - startClientY) / canvasZoom;

            const delta = unprojectScreenDeltaToLightDelta(
                deltaScreenX,
                deltaScreenY,
                startLightPos,
                cameraPose,
                frameWidth,
                frameHeight,
                aspect
            );

            updateLight({
                position: {
                    x: Number((startLightPos.x + delta.dx).toFixed(3)),
                    y: Number((startLightPos.y + delta.dy).toFixed(3)),
                    z: startLightPos.z,
                },
            });
        };

        startDrag(onPointerMove);
    }, [selectedLight, canvasZoom, cameraPose, frameWidth, frameHeight, aspect, handleDepthDragStart, startDrag, updateLight]);

    const handleTargetDragStart = useCallback((e: React.PointerEvent) => {
        if (!selectedLight) return;
        e.preventDefault();
        e.stopPropagation();

        const startClientX = e.clientX;
        const startClientY = e.clientY;
        const startTargetPos = { ...(selectedLight.target || { x: 0, y: 0, z: 0 }) };

        const onPointerMove = (moveEv: PointerEvent) => {
            const deltaScreenX = (moveEv.clientX - startClientX) / canvasZoom;
            const deltaScreenY = (moveEv.clientY - startClientY) / canvasZoom;

            const delta = unprojectScreenDeltaToLightDelta(
                deltaScreenX,
                deltaScreenY,
                startTargetPos,
                cameraPose,
                frameWidth,
                frameHeight,
                aspect
            );

            updateLight({
                target: {
                    x: Number((startTargetPos.x + delta.dx).toFixed(3)),
                    y: Number((startTargetPos.y + delta.dy).toFixed(3)),
                    z: startTargetPos.z,
                },
            });
        };

        startDrag(onPointerMove);
    }, [selectedLight, canvasZoom, cameraPose, frameWidth, frameHeight, aspect, startDrag, updateLight]);

    // Spot Cone Angle Drag
    const handleSpotConeDragStart = useCallback(
        (
            e: React.PointerEvent,
            targetScreenX: number,
            targetScreenY: number,
            handleScreenX?: number,
            handleScreenY?: number
        ) => {
            if (!selectedLight || selectedLight.type !== 'spot') return;
            e.preventDefault();
            e.stopPropagation();

            const pSrc = lightToWorld(selectedLight.position);
            const pTgt = lightToWorld(selectedLight.target || { x: 0, y: 0, z: 0 });
            const dist = Math.max(0.1, pSrc.distanceTo(pTgt));
            const startAngle = selectedLight.angle || Math.PI / 6;

            const startClientX = e.clientX;
            const startClientY = e.clientY;

            const hx = handleScreenX ?? targetScreenX + 50;
            const hy = handleScreenY ?? targetScreenY;
            const dx = hx - targetScreenX;
            const dy = hy - targetScreenY;
            const rScreen0 = Math.hypot(dx, dy) || 1;
            const ux = dx / rScreen0;
            const uy = dy / rScreen0;

            const onPointerMove = (moveEv: PointerEvent) => {
                const deltaPxX = (moveEv.clientX - startClientX) / canvasZoom;
                const deltaPxY = (moveEv.clientY - startClientY) / canvasZoom;
                const signedDeltaR = deltaPxX * ux + deltaPxY * uy;
                const deltaRadiusWorld = (signedDeltaR / frameWidth) * dist * 2;
                const newRadiusWorld = Math.max(0.05, dist * Math.tan(startAngle) + deltaRadiusWorld);
                const newAngle = Math.max(
                    0.08,
                    Math.min(Math.PI / 2 - 0.08, Math.atan2(newRadiusWorld, dist))
                );
                updateLight({ angle: Number(newAngle.toFixed(3)) });
            };

            startDrag(onPointerMove);
        },
        [selectedLight, canvasZoom, frameWidth, startDrag, updateLight]
    );

    // Area Size Resize Drag
    const handleAreaResizeDragStart = useCallback((e: React.PointerEvent) => {
        if (!selectedLight || selectedLight.type !== 'area') return;
        e.preventDefault();
        e.stopPropagation();

        const startClientX = e.clientX;
        const startClientY = e.clientY;
        const startW = selectedLight.width || 3;
        const startH = selectedLight.height || 3;

        const onPointerMove = (moveEv: PointerEvent) => {
            const deltaPxX = (moveEv.clientX - startClientX) / canvasZoom;
            const deltaPxY = (moveEv.clientY - startClientY) / canvasZoom;
            const scaleFactor = 0.01;

            const nextW = Math.max(0.4, Number((startW + deltaPxX * scaleFactor).toFixed(2)));
            const nextH = Math.max(0.4, Number((startH - deltaPxY * scaleFactor).toFixed(2)));

            updateLight({ width: nextW, height: nextH });
        };

        startDrag(onPointerMove);
    }, [selectedLight, canvasZoom, startDrag, updateLight]);

    // Point Reach Drag
    const handlePointReachDragStart = useCallback((e: React.PointerEvent) => {
        if (!selectedLight || selectedLight.type !== 'point') return;
        e.preventDefault();
        e.stopPropagation();

        const startClientX = e.clientX;
        const startDist = selectedLight.distance || 5;

        const onPointerMove = (moveEv: PointerEvent) => {
            const deltaPx = (moveEv.clientX - startClientX) / canvasZoom;
            const scaleFactor = 0.02;
            const nextDist = Math.max(0.5, Number((startDist + deltaPx * scaleFactor).toFixed(2)));
            updateLight({ distance: nextDist });
        };

        startDrag(onPointerMove);
    }, [selectedLight, canvasZoom, startDrag, updateLight]);

    if (!showGizmos && !selectedLightId) {
        return null;
    }

    return (
        <div
            data-testid="lighting-overlay"
            className="absolute inset-0 pointer-events-none select-none z-30"
            style={{ width: `${frameWidth}px`, height: `${frameHeight}px` }}
        >
            <svg
                className="w-full h-full pointer-events-none overflow-visible"
                viewBox={`0 0 ${frameWidth} ${frameHeight}`}
            >
                {/* 1. Unselected Light Badges */}
                {allLights.map((l) => {
                    if (l.id === selectedLightId) return null;
                    const posScreen = projectLightToScreen(l.position, cameraPose, frameWidth, frameHeight, aspect);

                    return (
                        <g
                            key={l.id}
                            data-testid={`light-handle-${l.id}`}
                            className="pointer-events-auto cursor-pointer group"
                            onClick={(e) => {
                                e.stopPropagation();
                                selectLight(l.id);
                            }}
                            transform={`translate(${posScreen.x}, ${posScreen.y})`}
                        >
                            <title>{l.name || 'Light'}</title>
                            <circle
                                r="14"
                                className="fill-[#161619]/90 stroke-[#f97316]/70 group-hover:stroke-[#f97316] group-hover:scale-110 transition-all duration-150"
                                strokeWidth="1.5"
                            />
                            <foreignObject x="-7" y="-7" width="14" height="14" className="pointer-events-none">
                                <div className="w-full h-full flex items-center justify-center opacity-80 group-hover:opacity-100">
                                    <LightTypeIcon type={l.type} className="w-3.5 h-3.5 text-white" />
                                </div>
                            </foreignObject>
                            <text
                                x="18"
                                y="4"
                                className="fill-white text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none drop-shadow"
                            >
                                {l.name || 'Light'}
                            </text>
                        </g>
                    );
                })}

                {/* 2. Selected Light Gizmo */}
                {selectedLight && (
                    <SelectedLightGizmo
                        key="selected-light-gizmo"
                        selectedLight={selectedLight}
                        cameraPose={cameraPose}
                        frameWidth={frameWidth}
                        frameHeight={frameHeight}
                        aspect={aspect}
                        activeDepthDrag={activeDepthDrag}
                        onTargetDragStart={handleTargetDragStart}
                        onSpotConeDragStart={handleSpotConeDragStart}
                        onAreaResizeDragStart={handleAreaResizeDragStart}
                        onPointReachDragStart={handlePointReachDragStart}
                        onDepthDragStart={handleDepthDragStart}
                        onSourceDragStart={handleSourceDragStart}
                    />
                )}
            </svg>
        </div>
    );
};
