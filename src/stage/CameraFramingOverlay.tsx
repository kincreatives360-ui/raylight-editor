// src/stage/CameraFramingOverlay.tsx
import React, { useRef, useState } from 'react';
import type { Shot } from '../model/types';
import { Film } from 'lucide-react';
import { useProjectStore } from '../store/useProjectStore';

interface CameraFramingOverlayProps {
    shot: Shot;
    selectedCameraBlockId: string | null;
    frameWidth: number;
    frameHeight: number;
    cameraZoom: number;
    canvasZoom?: number;
}

type HandleDir = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

const RESIZE_HANDLES: { dir: HandleDir; cursor: string; style: React.CSSProperties }[] = [
    { dir: 'nw', cursor: 'nwse-resize', style: { left: 0, top: 0, transform: 'translate(-50%, -50%)' } },
    { dir: 'n', cursor: 'ns-resize', style: { left: '50%', top: 0, transform: 'translate(-50%, -50%)' } },
    { dir: 'ne', cursor: 'nesw-resize', style: { left: '100%', top: 0, transform: 'translate(-50%, -50%)' } },
    { dir: 'e', cursor: 'ew-resize', style: { left: '100%', top: '50%', transform: 'translate(-50%, -50%)' } },
    { dir: 'se', cursor: 'nwse-resize', style: { left: '100%', top: '100%', transform: 'translate(-50%, -50%)' } },
    { dir: 's', cursor: 'ns-resize', style: { left: '50%', top: '100%', transform: 'translate(-50%, -50%)' } },
    { dir: 'sw', cursor: 'nesw-resize', style: { left: 0, top: '100%', transform: 'translate(-50%, -50%)' } },
    { dir: 'w', cursor: 'ew-resize', style: { left: 0, top: '50%', transform: 'translate(-50%, -50%)' } },
];

export const CameraFramingOverlay: React.FC<CameraFramingOverlayProps> = ({
    shot,
    selectedCameraBlockId,
    frameWidth,
    frameHeight,
    cameraZoom,
    canvasZoom = 1,
}) => {
    const { updateShot, beginDragTransaction, commitDragTransaction } = useProjectStore();
    const [activeDrag, setActiveDrag] = useState<{
        which: 'from' | 'to';
        type: 'resize' | 'pan';
        dir?: HandleDir;
        currentZoom: number;
    } | null>(null);

    const dragSessionRef = useRef<{
        which: 'from' | 'to';
        type: 'resize' | 'pan';
        dir?: HandleDir;
        startX: number;
        startY: number;
        startZoom: number;
        startAnchorX: number;
        startAnchorY: number;
        startBoxW: number;
        startBoxH: number;
    } | null>(null);

    if (!selectedCameraBlockId) return null;

    const activeBlock = shot.cameraBlocks?.find(
        (b) => b.id === selectedCameraBlockId
    );
    if (!activeBlock) return null;

    const fromEp = activeBlock.from || {
        anchorX: 0,
        anchorY: 0,
        zoom: 1,
        roll: 0,
        orbit: 0,
        tilt: 0,
    };

    const toEp = activeBlock.to || {
        anchorX: 0,
        anchorY: 0,
        zoom: 1,
        roll: 0,
        orbit: 0,
        tilt: 0,
    };

    // Calculate bounding box dimensions relative to current frame
    // A framing zoom > 1 means the camera is zoomed in (smaller visible frame)
    const computeBox = (ep: typeof fromEp) => {
        const safeZoom = Math.max(0.2, ep.zoom);
        const w = frameWidth / safeZoom;
        const h = frameHeight / safeZoom;
        const cx = frameWidth / 2 + ep.anchorX * frameWidth;
        const cy = frameHeight / 2 + ep.anchorY * frameHeight;
        return {
            left: cx - w / 2,
            top: cy - h / 2,
            width: w,
            height: h,
            cx,
            cy,
        };
    };

    const fromBox = computeBox(fromEp);
    const toBox = computeBox(toEp);

    // ============================================================================
    // POINTER DRAG HANDLERS: 8-WAY SCALING AND ANCHOR PAN
    // ============================================================================
    const handleStartDrag = (
        e: React.PointerEvent,
        which: 'from' | 'to',
        type: 'resize' | 'pan',
        dir?: HandleDir
    ) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();

        try {
            e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
            // ignore
        }

        beginDragTransaction();
        const ep = which === 'from' ? fromEp : toEp;
        const box = which === 'from' ? fromBox : toBox;

        dragSessionRef.current = {
            which,
            type,
            dir,
            startX: e.clientX,
            startY: e.clientY,
            startZoom: ep.zoom,
            startAnchorX: ep.anchorX,
            startAnchorY: ep.anchorY,
            startBoxW: box.width,
            startBoxH: box.height,
        };

        setActiveDrag({
            which,
            type,
            dir,
            currentZoom: ep.zoom,
        });
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!dragSessionRef.current) return;
        e.preventDefault();
        e.stopPropagation();

        const s = dragSessionRef.current;
        const dx = (e.clientX - s.startX) / canvasZoom;
        const dy = (e.clientY - s.startY) / canvasZoom;

        if (s.type === 'pan') {
            // Pan moves the center anchor
            const deltaNormX = dx / frameWidth;
            const deltaNormY = dy / frameHeight;
            const nextAnchorX = Number((s.startAnchorX + deltaNormX).toFixed(4));
            const nextAnchorY = Number((s.startAnchorY + deltaNormY).toFixed(4));

            updateShot(
                shot.id,
                (shotData) => {
                    const blocks = (shotData.cameraBlocks || []).map((b) => {
                        if (b.id !== selectedCameraBlockId) return b;
                        const baseEp = s.which === 'from' ? fromEp : toEp;
                        return {
                            ...b,
                            [s.which]: {
                                ...baseEp,
                                ...b[s.which],
                                anchorX: nextAnchorX,
                                anchorY: nextAnchorY,
                            },
                        };
                    });
                    return { ...shotData, cameraBlocks: blocks };
                },
                { skipHistory: true }
            );
        } else if (s.type === 'resize' && s.dir) {
            // Proportional scaling from handles
            let deltaW = 0;
            const dir = s.dir;

            if (dir.includes('e')) deltaW += dx * 2;
            else if (dir.includes('w')) deltaW -= dx * 2;

            if (dir.includes('s')) deltaW += dy * 2 * (frameWidth / frameHeight);
            else if (dir.includes('n')) deltaW -= dy * 2 * (frameWidth / frameHeight);

            // Outward drag expands the rectangle -> Camera zooms out (lower zoom factor)
            // Inward drag shrinks the rectangle -> Camera zooms in (higher zoom factor)
            const nextBoxW = Math.max(50, s.startBoxW + deltaW);
            const nextZoom = Number(Math.max(0.2, Math.min(5.0, frameWidth / nextBoxW)).toFixed(3));

            setActiveDrag((prev) => prev ? { ...prev, currentZoom: nextZoom } : null);

            updateShot(
                shot.id,
                (shotData) => {
                    const blocks = (shotData.cameraBlocks || []).map((b) => {
                        if (b.id !== selectedCameraBlockId) return b;
                        const baseEp = s.which === 'from' ? fromEp : toEp;
                        return {
                            ...b,
                            [s.which]: {
                                ...baseEp,
                                ...b[s.which],
                                zoom: nextZoom,
                            },
                        };
                    });
                    return { ...shotData, cameraBlocks: blocks };
                },
                { skipHistory: true }
            );
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (!dragSessionRef.current) return;
        try {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                e.currentTarget.releasePointerCapture(e.pointerId);
            }
        } catch {
            // ignore
        }
        dragSessionRef.current = null;
        setActiveDrag(null);
        commitDragTransaction();
    };

    return (
        <div className="absolute inset-0 pointer-events-none z-26 overflow-visible select-none">
            {/* SVG Connecting Arc between From and To anchors */}
            <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none">
                <line
                    x1={fromBox.cx}
                    y1={fromBox.cy}
                    x2={toBox.cx}
                    y2={toBox.cy}
                    stroke="rgba(56, 189, 248, 0.4)"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                />
                <circle cx={fromBox.cx} cy={fromBox.cy} r="4.5" fill="#10b981" />
                <circle cx={toBox.cx} cy={toBox.cy} r="4.5" fill="#38bdf8" />
            </svg>

            {/* =============================================================== */}
            {/* 1. FROM FRAMING RECTANGLE (Emerald) WITH 8 RESIZE HANDLES       */}
            {/* =============================================================== */}
            <div
                style={{
                    left: `${fromBox.left}px`,
                    top: `${fromBox.top}px`,
                    width: `${fromBox.width}px`,
                    height: `${fromBox.height}px`,
                }}
                className={`absolute border-2 border-dashed border-emerald-400/80 bg-emerald-500/[0.03] rounded-lg pointer-events-none transition-shadow ${activeDrag?.which === 'from' ? 'ring-2 ring-emerald-400/40 shadow-lg shadow-emerald-500/10' : ''
                    }`}
            >
                {/* Header Chip / Drag Anchor Handle */}
                <div
                    onPointerDown={(e) => handleStartDrag(e, 'from', 'pan')}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-full bg-emerald-950/90 border border-emerald-400/50 text-[10px] font-mono text-emerald-300 flex items-center gap-1.5 shadow-md pointer-events-auto cursor-move hover:scale-105 transition-transform"
                    title="Drag to reposition From camera anchor"
                >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-semibold">From: {Number(fromEp.zoom.toFixed(2))}x</span>
                    {fromEp.orbit !== 0 && <span className="text-emerald-400/70">• {fromEp.orbit}°</span>}
                </div>

                {/* 8 Scaling Handles on all sides */}
                {RESIZE_HANDLES.map((h) => (
                    <div
                        key={`from-${h.dir}`}
                        style={{ ...h.style, cursor: h.cursor }}
                        onPointerDown={(e) => handleStartDrag(e, 'from', 'resize', h.dir)}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                        title={`Drag to scale From framing (${h.dir.toUpperCase()})`}
                        className="absolute w-3 h-3 rounded-xs bg-emerald-400 border-2 border-emerald-950 shadow-md hover:scale-130 active:scale-140 hover:bg-emerald-300 pointer-events-auto transition-transform touch-none"
                    />
                ))}

                {/* Live Zoom Tooltip while scaling */}
                {activeDrag?.which === 'from' && activeDrag.type === 'resize' && (
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-emerald-900/95 border border-emerald-400 text-[10px] font-mono text-emerald-200 shadow-xl pointer-events-none">
                        Zoom: {Number(activeDrag.currentZoom.toFixed(2))}x
                    </div>
                )}
            </div>

            {/* =============================================================== */}
            {/* 2. TO FRAMING RECTANGLE (Sky / Cyan) WITH 8 RESIZE HANDLES       */}
            {/* =============================================================== */}
            <div
                style={{
                    left: `${toBox.left}px`,
                    top: `${toBox.top}px`,
                    width: `${toBox.width}px`,
                    height: `${toBox.height}px`,
                }}
                className={`absolute border-2 border-dashed border-sky-400/90 bg-sky-500/[0.03] rounded-lg pointer-events-none transition-shadow ${activeDrag?.which === 'to' ? 'ring-2 ring-sky-400/40 shadow-lg shadow-sky-500/10' : ''
                    }`}
            >
                {/* Header Chip / Drag Anchor Handle */}
                <div
                    onPointerDown={(e) => handleStartDrag(e, 'to', 'pan')}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    className="absolute bottom-1.5 right-1.5 px-2 py-0.5 rounded-full bg-sky-950/90 border border-sky-400/50 text-[10px] font-mono text-sky-300 flex items-center gap-1.5 shadow-md pointer-events-auto cursor-move hover:scale-105 transition-transform"
                    title="Drag to reposition To camera anchor"
                >
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                    <span className="font-semibold">To: {Number(toEp.zoom.toFixed(2))}x ({activeBlock.mode})</span>
                    {toEp.orbit !== 0 && <span className="text-sky-400/70">• {toEp.orbit}°</span>}
                </div>

                {/* 8 Scaling Handles on all sides */}
                {RESIZE_HANDLES.map((h) => (
                    <div
                        key={`to-${h.dir}`}
                        style={{ ...h.style, cursor: h.cursor }}
                        onPointerDown={(e) => handleStartDrag(e, 'to', 'resize', h.dir)}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                        title={`Drag to scale To framing (${h.dir.toUpperCase()})`}
                        className="absolute w-3 h-3 rounded-xs bg-sky-400 border-2 border-sky-950 shadow-md hover:scale-130 active:scale-140 hover:bg-sky-300 pointer-events-auto transition-transform touch-none"
                    />
                ))}

                {/* Live Zoom Tooltip while scaling */}
                {activeDrag?.which === 'to' && activeDrag.type === 'resize' && (
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-sky-900/95 border border-sky-400 text-[10px] font-mono text-sky-200 shadow-xl pointer-events-none">
                        Zoom: {Number(activeDrag.currentZoom.toFixed(2))}x
                    </div>
                )}
            </div>

            {/* Move Info Chip in center connecting line */}
            <div
                style={{
                    left: `${(fromBox.cx + toBox.cx) / 2}px`,
                    top: `${(fromBox.cy + toBox.cy) / 2}px`,
                    transform: 'translate(-50%, -50%)',
                }}
                className="absolute px-2.5 py-0.5 rounded-full bg-[var(--bg-panel,#121216)]/95 border border-white/10 text-[10px] font-mono tabular-nums text-gray-300 shadow-xl flex items-center gap-1.5 pointer-events-none"
            >
                <Film className="w-2.5 h-2.5 text-sky-400" />
                <span>{(activeBlock.durationMs / 1000).toFixed(1)}s</span>
                <span className="text-gray-500">•</span>
                <span className="capitalize">{activeBlock.easing.kind === 'preset' ? activeBlock.easing.name : activeBlock.easing.kind}</span>
                <span className="text-gray-500">•</span>
                <span className="text-sky-300 font-semibold">{cameraZoom.toFixed(2)}x</span>
            </div>
        </div>
    );
};
