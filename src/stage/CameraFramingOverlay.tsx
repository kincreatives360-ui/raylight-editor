import React, { useRef, useState } from 'react';
import type { Shot, CameraKeyframeEndpoint, CameraBlock } from '../model/types';
import { getArtboardDimensions, computeFramingBox } from './stageUtils';
import { useProjectStore } from '../store/useProjectStore';


interface CameraFramingOverlayProps {
    shot: Shot;
    selectedCameraBlockId: string | null;
    frameWidth: number;
    frameHeight: number;
    canvasZoom?: number;
}

type CornerDir = 'nw' | 'ne' | 'se' | 'sw';

const CORNER_HANDLES: { dir: CornerDir; cursor: string; style: React.CSSProperties }[] = [
    { dir: 'nw', cursor: 'nwse-resize', style: { left: 0, top: 0, transform: 'translate(-50%, -50%)' } },
    { dir: 'ne', cursor: 'nesw-resize', style: { left: '100%', top: 0, transform: 'translate(-50%, -50%)' } },
    { dir: 'se', cursor: 'nwse-resize', style: { left: '100%', top: '100%', transform: 'translate(-50%, -50%)' } },
    { dir: 'sw', cursor: 'nesw-resize', style: { left: 0, top: '100%', transform: 'translate(-50%, -50%)' } },
];

export const CameraFramingOverlay: React.FC<CameraFramingOverlayProps> = ({
    shot,
    selectedCameraBlockId,
    frameWidth,
    frameHeight,
    canvasZoom = 1,
}) => {
    const { project, updateShot, beginDragTransaction, commitDragTransaction } = useProjectStore();
    const { width: artboardWidth, height: artboardHeight } = getArtboardDimensions(project?.aspectRatio);
    const scaleX = frameWidth / artboardWidth;
    const scaleY = frameHeight / artboardHeight;

    const [activeDrag, setActiveDrag] = useState<{
        which: 'from' | 'to';
        type: 'resize' | 'pan';
        dir?: CornerDir;
        currentZoom: number;
    } | null>(null);

    const [snapGuides, setSnapGuides] = useState<{
        xLines: number[];
        yLines: number[];
    }>({ xLines: [], yLines: [] });

    const dragSessionRef = useRef<{
        which: 'from' | 'to';
        type: 'resize' | 'pan';
        dir?: CornerDir;
        startX: number;
        startY: number;
        startAnchorX: number;
        startAnchorY: number;
        rectCenterX: number;
        rectCenterY: number;
        startCornerX: number;
        startCornerY: number;
    } | null>(null);



    if (!selectedCameraBlockId) return null;

    const activeBlock = shot.cameraBlocks?.find(
        (b) => b.id === selectedCameraBlockId
    );
    if (!activeBlock) return null;

    const fromEp: CameraKeyframeEndpoint = activeBlock.from || {
        anchorX: 0,
        anchorY: 0,
        anchorZ: 0,
        zoom: 1,
        roll: 0,
        orbit: 0,
        tilt: 0,
        focalLength: 50,
    };

    const toEp: CameraKeyframeEndpoint = activeBlock.to || {
        anchorX: 0,
        anchorY: 0,
        anchorZ: 0,
        zoom: 1.2,
        roll: 0,
        orbit: 0,
        tilt: 0,
        focalLength: 50,
    };


    const patchEndpoint = (
        which: 'from' | 'to',
        patch: Partial<CameraKeyframeEndpoint>,
        skipHistory = false
    ) => {
        updateShot(
            shot.id,
            (shotData: Shot) => {
                const blocks = (shotData.cameraBlocks || []).map((b: CameraBlock) => {
                    if (b.id !== selectedCameraBlockId) return b;
                    const baseEp = which === 'from' ? fromEp : toEp;
                    return {
                        ...b,
                        [which]: {
                            ...baseEp,
                            ...b[which],
                            ...patch,
                        },
                    };
                });
                return { ...shotData, cameraBlocks: blocks };
            },
            skipHistory ? { skipHistory: true } : undefined
        );
    };


    // Calculate on-canvas rectangle derived strictly from numbers:
    // width = artboardW / zoom, height = artboardH / zoom, centred on the anchor.
    const computeBox = (ep: CameraKeyframeEndpoint) =>
        computeFramingBox(ep, frameWidth, frameHeight, artboardWidth, artboardHeight);

    const fromBox = computeBox(fromEp);
    const toBox = computeBox(toEp);

    // ============================================================================
    // POINTER DRAG HANDLERS: CORNER SCALING (SYMMETRIC) AND BODY PAN
    // ============================================================================
    const handleStartDrag = (
        e: React.PointerEvent,
        which: 'from' | 'to',
        type: 'resize' | 'pan',
        dir?: CornerDir
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

        let startCornerX = 0;
        let startCornerY = 0;
        if (type === 'resize' && dir) {
            startCornerX = dir === 'nw' || dir === 'sw' ? box.left : box.left + box.width;
            startCornerY = dir === 'nw' || dir === 'ne' ? box.top : box.top + box.height;
        }

        dragSessionRef.current = {
            which,
            type,
            dir,
            startX: e.clientX,
            startY: e.clientY,
            startAnchorX: ep.anchorX,
            startAnchorY: ep.anchorY,
            rectCenterX: box.cx,
            rectCenterY: box.cy,
            startCornerX,
            startCornerY,
        };

        setActiveDrag({
            which,
            type,
            dir,
            currentZoom: ep.zoom,
        });
        setSnapGuides({ xLines: [], yLines: [] });
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!dragSessionRef.current) return;
        e.preventDefault();
        e.stopPropagation();

        const s = dragSessionRef.current;
        const dx = (e.clientX - s.startX) / canvasZoom;
        const dy = (e.clientY - s.startY) / canvasZoom;

        if (s.type === 'pan') {
            const rawAnchorX = s.startAnchorX + dx / scaleX;
            const rawAnchorY = s.startAnchorY - dy / scaleY; // world Y is up, DOM dy > 0 is down

            const ep = s.which === 'from' ? fromEp : toEp;
            const rectW = artboardWidth / Math.max(0.15, ep.zoom);
            const rectH = artboardHeight / Math.max(0.15, ep.zoom);
            const hw = rectW / 2;
            const hh = rectH / 2;

            const halfW = artboardWidth / 2;
            const halfH = artboardHeight / 2;

            // Artboard targets in world coordinates:
            const artboardXTargets = [-halfW, 0, halfW];
            const artboardYTargets = [halfH, 0, -halfH];
            const snapThreshWorldX = 8 / scaleX;
            const snapThreshWorldY = 8 / scaleY;

            let snappedAnchorX = rawAnchorX;
            let activeSnapX: number | null = null;
            let minDiffX = snapThreshWorldX;

            const rectXLines = [rawAnchorX - hw, rawAnchorX, rawAnchorX + hw];
            for (const rX of rectXLines) {
                for (const aX of artboardXTargets) {
                    const diff = Math.abs(rX - aX);
                    if (diff < minDiffX) {
                        minDiffX = diff;
                        snappedAnchorX = rawAnchorX + (aX - rX);
                        activeSnapX = frameWidth / 2 + aX * scaleX;
                    }
                }
            }

            let snappedAnchorY = rawAnchorY;
            let activeSnapY: number | null = null;
            let minDiffY = snapThreshWorldY;

            const rectYLines = [rawAnchorY + hh, rawAnchorY, rawAnchorY - hh];
            for (const rY of rectYLines) {
                for (const aY of artboardYTargets) {
                    const diff = Math.abs(rY - aY);
                    if (diff < minDiffY) {
                        minDiffY = diff;
                        snappedAnchorY = rawAnchorY + (aY - rY);
                        activeSnapY = frameHeight / 2 - aY * scaleY;
                    }
                }
            }

            setSnapGuides({
                xLines: activeSnapX !== null ? [activeSnapX] : [],
                yLines: activeSnapY !== null ? [activeSnapY] : [],
            });

            const nextAnchorX = Math.round(snappedAnchorX);
            const nextAnchorY = Math.round(snappedAnchorY);

            patchEndpoint(s.which, { anchorX: nextAnchorX, anchorY: nextAnchorY }, true);
        } else if (s.type === 'resize' && s.dir) {
            const curCornerX = s.startCornerX + dx;
            const curCornerY = s.startCornerY + dy;
            const currentDist = Math.hypot(curCornerX - s.rectCenterX, curCornerY - s.rectCenterY);
            const dist1x = Math.hypot(frameWidth / 2, frameHeight / 2);

            const rawZoom = dist1x / Math.max(1, currentDist);
            const nextZoom = Number(Math.max(0.2, Math.min(5.0, rawZoom)).toFixed(2));

            setActiveDrag((prev) => (prev ? { ...prev, currentZoom: nextZoom } : null));

            patchEndpoint(s.which, { zoom: nextZoom }, true);
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
        setSnapGuides({ xLines: [], yLines: [] });
        commitDragTransaction();
    };


    return (
        <div className="absolute inset-0 pointer-events-none z-26 overflow-visible select-none">
            {/* SVG Connecting Arc and Snap Guides */}
            <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none">
                {/* Full-width / full-height green alignment snap lines */}
                {snapGuides.xLines.map((x, idx) => (
                    <line
                        key={`snap-x-${idx}`}
                        x1={x}
                        y1={0}
                        x2={x}
                        y2={frameHeight}
                        stroke="#10b981"
                        strokeWidth="1.5"
                    />
                ))}
                {snapGuides.yLines.map((y, idx) => (
                    <line
                        key={`snap-y-${idx}`}
                        x1={0}
                        y1={y}
                        x2={frameWidth}
                        y2={y}
                        stroke="#10b981"
                        strokeWidth="1.5"
                    />
                ))}

                <circle cx={toBox.cx} cy={toBox.cy} r="4.5" fill="#10b981" />
            </svg>

            {/* =============================================================== */}
            {/* 1. FROM FRAMING RECTANGLE (Emerald) WITH 4 CORNER HANDLES       */}
            {/* =============================================================== */}
            <div
                style={{
                    left: `${fromBox.left}px`,
                    top: `${fromBox.top}px`,
                    width: `${fromBox.width}px`,
                    height: `${fromBox.height}px`,
                }}
                onPointerDown={(e) => handleStartDrag(e, 'from', 'pan')}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onLostPointerCapture={handlePointerUp}
                className={`absolute border-2 border-dashed border-emerald-400/90 bg-emerald-500/[0.03] rounded-none pointer-events-auto cursor-move transition-shadow ${
                    activeDrag?.which === 'from' ? 'ring-2 ring-emerald-400/40 shadow-lg shadow-emerald-500/10' : ''
                }`}
                title="Drag body to reposition From camera anchor"
            >
                <span
                    data-camera-endpoint="from"
                    className="absolute -top-8 left-0 rounded-md bg-emerald-500 px-2 py-0.5 text-xs font-medium text-white shadow-sm pointer-events-none"
                >From</span>

                {/* 4 Corner Scaling Handles */}
                {CORNER_HANDLES.map((h) => (
                    <div
                        key={`from-${h.dir}`}
                        style={{ ...h.style, cursor: h.cursor }}
                        onPointerDown={(e) => handleStartDrag(e, 'from', 'resize', h.dir)}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                        onLostPointerCapture={handlePointerUp}
                        title={`Drag to scale From framing (${h.dir.toUpperCase()})`}
                        className="absolute w-3 h-3 rounded-xs bg-white border-2 border-emerald-400 shadow-md hover:scale-130 active:scale-140 hover:bg-emerald-300 pointer-events-auto transition-transform touch-none after:absolute after:-inset-4 after:content-['']"
                    />
                ))}

                {/* Live Zoom Tooltip while scaling */}
                {activeDrag?.which === 'from' && activeDrag.type === 'resize' && (
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-emerald-900/95 border border-emerald-400 text-[11px] font-mono tabular-nums text-emerald-200 shadow-xl pointer-events-none">
                        Zoom: {Number(activeDrag.currentZoom.toFixed(2))}x
                    </div>
                )}
            </div>

            {/* =============================================================== */}
            {/* 2. TO FRAMING RECTANGLE (Sky / Cyan) WITH 4 CORNER HANDLES       */}
            {/* =============================================================== */}
            <div
                style={{
                    left: `${toBox.left}px`,
                    top: `${toBox.top}px`,
                    width: `${toBox.width}px`,
                    height: `${toBox.height}px`,
                }}
                onPointerDown={(e) => handleStartDrag(e, 'to', 'pan')}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onLostPointerCapture={handlePointerUp}
                className={`absolute border-2 border-solid border-emerald-400/90 bg-emerald-500/[0.03] rounded-none pointer-events-auto cursor-move transition-shadow ${
                    activeDrag?.which === 'to' ? 'ring-2 ring-emerald-400/40 shadow-lg shadow-emerald-500/10' : ''
                }`}
                title="Drag body to reposition To camera anchor"
            >
                <span
                    data-camera-endpoint="to"
                    className="absolute -top-8 left-0 rounded-md bg-emerald-500 px-2 py-0.5 text-xs font-medium text-white shadow-sm pointer-events-none"
                >To</span>

                {/* 4 Corner Scaling Handles */}
                {CORNER_HANDLES.map((h) => (
                    <div
                        key={`to-${h.dir}`}
                        style={{ ...h.style, cursor: h.cursor }}
                        onPointerDown={(e) => handleStartDrag(e, 'to', 'resize', h.dir)}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                        onLostPointerCapture={handlePointerUp}
                        title={`Drag to scale To framing (${h.dir.toUpperCase()})`}
                        className="absolute w-3 h-3 rounded-xs bg-white border-2 border-emerald-400 shadow-md hover:scale-130 active:scale-140 hover:bg-white pointer-events-auto transition-transform touch-none after:absolute after:-inset-4 after:content-['']"
                    />
                ))}

                {/* Live Zoom Tooltip while scaling */}
                {activeDrag?.which === 'to' && activeDrag.type === 'resize' && (
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-sky-900/95 border border-sky-400 text-[11px] font-mono tabular-nums text-sky-200 shadow-xl pointer-events-none">
                        Zoom: {Number(activeDrag.currentZoom.toFixed(2))}x
                    </div>
                )}
            </div>


        </div>
    );
};
