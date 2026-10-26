import React, { useRef, useState } from 'react';
import type { Shot, CameraKeyframeEndpoint, CameraBlock } from '../model/types';
import { Film, Focus, SlidersHorizontal, X } from 'lucide-react';
import { getArtboardDimensions, computeFramingBox } from './stageUtils';
import { useProjectStore } from '../store/useProjectStore';
import { useSelectionStore } from '../store/useSelectionStore';
import { ScrubInput } from '../ui/ScrubInput';
import {
    CAMERA_PRESETS,
    CAMERA_MOVEMENT_PRESETS,
    calculateLayersBoundingFraming,
    detectMatchingPreset,
    applyCameraPreset,
    applyCameraMovementPreset,
    focalLengthToFov,
    LENS_PRESETS,
    type CameraPreset,
    type CameraMovementId,
} from './webgl/cameraMath';

interface CameraFramingOverlayProps {
    shot: Shot;
    selectedCameraBlockId: string | null;
    frameWidth: number;
    frameHeight: number;
    cameraZoom: number;
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
    cameraZoom,
    canvasZoom = 1,
}) => {
    const { project, updateShot, beginDragTransaction, commitDragTransaction } = useProjectStore();
    const { selectedLayerIds } = useSelectionStore();
    const { width: artboardWidth, height: artboardHeight } = getArtboardDimensions(project?.aspectRatio);
    const scaleX = frameWidth / artboardWidth;
    const scaleY = frameHeight / artboardHeight;
    const [popoverEndpoint, setPopoverEndpoint] = useState<'from' | 'to' | null>(null);
    const [movementMenuOpen, setMovementMenuOpen] = useState(false);

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
        startZoom: number;
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

    const activeFromPreset = detectMatchingPreset(fromEp);
    const activeToPreset = detectMatchingPreset(toEp);

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

    const handleFrameContent = (which: 'from' | 'to') => {
        const selectedLayers = (shot.layers || []).filter((l) => selectedLayerIds.includes(l.id));
        const targetLayers = selectedLayers.length > 0
            ? selectedLayers
            : (shot.layers || []).filter((l) => !l.hidden);
        if (targetLayers.length > 0) {
            const framing = calculateLayersBoundingFraming(targetLayers, { width: artboardWidth, height: artboardHeight });
            patchEndpoint(which, {
                anchorX: framing.anchorX,
                anchorY: framing.anchorY,
                zoom: framing.zoom,
            });
        }
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
            startZoom: ep.zoom,
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

    const renderEndpointPopover = (which: 'from' | 'to') => {
        if (popoverEndpoint !== which) return null;
        const ep = which === 'from' ? fromEp : toEp;
        const activePreset = which === 'from' ? activeFromPreset : activeToPreset;
        const box = which === 'from' ? fromBox : toBox;
        const isEmerald = which === 'from';
        const accentClass = isEmerald ? 'text-emerald-400' : 'text-sky-400';
        const activeBtnClass = isEmerald
            ? 'bg-emerald-500 text-black font-semibold'
            : 'bg-sky-500 text-black font-semibold';
        const borderClass = isEmerald ? 'border-emerald-500/30' : 'border-sky-500/30';

        const handleApplyPreset = (preset: CameraPreset) => {
            const next = applyCameraPreset(preset, ep);
            patchEndpoint(which, next);
        };

        const showAbove = box.top > 320;

        return (
            <div
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                style={{
                    position: 'absolute',
                    left: 4,
                    ...(showAbove ? { bottom: 'calc(100% + 8px)' } : { top: 'calc(100% + 8px)' }),
                }}
                className={`w-72 bg-[#121216]/95 backdrop-blur-md border ${borderClass} rounded-xl shadow-2xl p-3 z-30 pointer-events-auto space-y-2.5 text-xs text-[#e4e4e7] animate-in fade-in zoom-in-95 duration-100 select-none`}
            >
                {/* Popover Header */}
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${isEmerald ? 'bg-emerald-400' : 'bg-sky-400'}`} />
                        <span className="font-semibold capitalize text-white">
                            {which} Camera Controls
                        </span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${isEmerald ? 'bg-emerald-950 text-emerald-300' : 'bg-sky-950 text-sky-300'}`}>
                            {activePreset ? activePreset.name : 'Custom'}
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setPopoverEndpoint(null)}
                        className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer"
                        title="Close"
                        aria-label="Close"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>

                {/* Presets Quick Grid */}
                <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-zinc-400">
                        <span>Camera Presets</span>
                        <button
                            type="button"
                            onClick={() => handleFrameContent(which)}
                            className={`flex items-center gap-1 ${accentClass} hover:underline cursor-pointer`}
                            title="Frame content or selection"
                        >
                            <Focus className="w-3 h-3" />
                            <span>Focus</span>
                        </button>
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                        {[
                            { id: 'front', label: 'Front' },
                            { id: 'top', label: 'Top' },
                            { id: 'right', label: 'Right' },
                            { id: 'isometric', label: 'Iso' },
                            { id: 'dimetric', label: 'Studio' },
                            { id: 'hero-low', label: 'Hero' },
                            { id: 'dutch-tilt', label: 'Dutch' },
                            { id: 'close-up', label: 'Close-Up' },
                        ].map((btn) => {
                            const preset = CAMERA_PRESETS.find((p) => p.id === btn.id);
                            if (!preset) return null;
                            const isSelected = activePreset?.id === preset.id;
                            return (
                                <button
                                    key={btn.id}
                                    type="button"
                                    onClick={() => handleApplyPreset(preset)}
                                    className={`px-1 py-1 rounded text-[10px] transition-colors cursor-pointer truncate text-center ${
                                        isSelected
                                            ? activeBtnClass
                                            : 'bg-[#1c1c21] hover:bg-white/10 text-[#d4d4d8] border border-white/5'
                                    }`}
                                    title={preset.description}
                                >
                                    {btn.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Full Presets Dropdown */}
                <select
                    aria-label={`${which} camera preset`}
                    value={activePreset?.id ?? ''}
                    onChange={(e) => {
                        const preset = CAMERA_PRESETS.find((p) => p.id === e.target.value);
                        if (preset) handleApplyPreset(preset);
                    }}
                    className="w-full px-2 py-1 rounded bg-[#1c1c21] border border-white/10 text-[11px] text-[#d4d4d8] hover:border-white/20 focus:outline-none cursor-pointer"
                >
                    <option value="" disabled>All Presets ({CAMERA_PRESETS.length})…</option>
                    <optgroup label="Shot Types">
                        {CAMERA_PRESETS.filter((p) => p.category === 'shot-type').map((p) => (
                            <option key={p.id} value={p.id}>{p.name} {p.zoom ? `(${p.zoom}x)` : ''} {p.focalLength ? `• ${p.focalLength}mm` : ''}</option>
                        ))}
                    </optgroup>
                    <optgroup label="Camera Angles">
                        {CAMERA_PRESETS.filter((p) => p.category === 'angle').map((p) => (
                            <option key={p.id} value={p.id}>{p.name} ({p.orbit}°, {p.tilt}°) {p.focalLength ? `• ${p.focalLength}mm` : ''}</option>
                        ))}
                    </optgroup>
                    <optgroup label="Axonometric">
                        {CAMERA_PRESETS.filter((p) => p.category === 'axonometric').map((p) => (
                            <option key={p.id} value={p.id}>{p.name} ({p.orbit}°, {p.tilt}°)</option>
                        ))}
                    </optgroup>
                    <optgroup label="Axial Views">
                        {CAMERA_PRESETS.filter((p) => p.category === 'axial').map((p) => (
                            <option key={p.id} value={p.id}>{p.name} ({p.orbit}°, {p.tilt}°)</option>
                        ))}
                    </optgroup>
                </select>

                {/* Overall Camera Movement Preset */}
                <div className="space-y-1 pt-1 border-t border-white/5">
                    <div className="flex items-center justify-between text-[10px] text-zinc-400">
                        <span>Movement Preset</span>
                        <span className="font-mono text-sky-400 font-semibold">{activeBlock.label || `${activeBlock.mode.toUpperCase()}`}</span>
                    </div>
                    <select
                        aria-label="Movement preset"
                        value={CAMERA_MOVEMENT_PRESETS.some((m) => m.name === activeBlock.label) ? CAMERA_MOVEMENT_PRESETS.find((m) => m.name === activeBlock.label)?.id : ''}
                        onChange={(e) => {
                            const moveId = e.target.value as CameraMovementId;
                            if (!moveId) return;
                            const artboardDimensions = { width: artboardWidth, height: artboardHeight };
                            const updated = applyCameraMovementPreset(activeBlock, moveId, { artboardDimensions, preserveDuration: true });
                            updateShot(shot.id, (s) => ({
                                ...s,
                                cameraBlocks: (s.cameraBlocks || []).map((b) => (b.id === activeBlock.id ? updated : b)),
                            }));
                        }}
                        className="w-full px-2 py-1 rounded bg-[#1c1c21] border border-white/10 text-[11px] text-[#d4d4d8] hover:border-white/20 focus:outline-none cursor-pointer"
                    >
                        <option value="" disabled>Change Movement Preset…</option>
                        <optgroup label="Zoom Moves">
                            {CAMERA_MOVEMENT_PRESETS.filter((m) => m.category === 'zoom').map((m) => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </optgroup>
                        <optgroup label="Tripod Pan & Tilt">
                            {CAMERA_MOVEMENT_PRESETS.filter((m) => m.category === 'rotation').map((m) => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </optgroup>
                        <optgroup label="Dolly, Truck & Pedestal">
                            {CAMERA_MOVEMENT_PRESETS.filter((m) => m.category === 'track').map((m) => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </optgroup>
                        <optgroup label="Special FX & Vertigo">
                            {CAMERA_MOVEMENT_PRESETS.filter((m) => m.category === 'special').map((m) => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </optgroup>
                    </select>
                </div>

                {/* Camera Parameters Grid */}
                <div className="space-y-1.5 pt-1 border-t border-white/5">
                    {/* Anchor X, Y, Z */}
                    <div className="grid grid-cols-3 gap-1">
                        <ScrubInput
                            label="X"
                            value={Math.round(ep.anchorX)}
                            min={-10000}
                            max={10000}
                            step={1}
                            onChange={(pxX) => patchEndpoint(which, { anchorX: Math.round(pxX) })}
                        />
                        <ScrubInput
                            label="Y"
                            value={Math.round(ep.anchorY)}
                            min={-10000}
                            max={10000}
                            step={1}
                            onChange={(pxY) => patchEndpoint(which, { anchorY: Math.round(pxY) })}
                        />
                        <ScrubInput
                            label="Z"
                            value={Math.round(ep.anchorZ ?? 0)}
                            min={-2000}
                            max={2000}
                            step={5}
                            unit="px"
                            onChange={(pxZ) => patchEndpoint(which, { anchorZ: Math.round(pxZ) })}
                        />
                    </div>

                    {/* Zoom & Roll */}
                    <div className="grid grid-cols-2 gap-1">
                        <ScrubInput
                            label="⊕"
                            value={Number(ep.zoom.toFixed(2))}
                            min={0.15}
                            max={5}
                            step={0.01}
                            decimals={2}
                            unit="x"
                            onChange={(zoom) => patchEndpoint(which, { zoom: Number(zoom.toFixed(2)) })}
                        />
                        <ScrubInput
                            label="∟"
                            value={ep.roll}
                            min={-180}
                            max={180}
                            step={1}
                            unit="°"
                            onChange={(roll) => patchEndpoint(which, { roll })}
                        />
                    </div>

                    {/* Orbit & Tilt */}
                    <div className="grid grid-cols-2 gap-1">
                        <ScrubInput
                            label="◎"
                            value={ep.orbit}
                            min={-360}
                            max={360}
                            step={1}
                            unit="°"
                            onChange={(orbit) => patchEndpoint(which, { orbit })}
                        />
                        <ScrubInput
                            label="∠"
                            value={ep.tilt}
                            min={-89}
                            max={89}
                            step={1}
                            unit="°"
                            onChange={(tilt) => patchEndpoint(which, { tilt })}
                        />
                    </div>

                    {/* Lens mm */}
                    <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-zinc-400">
                            <span>Lens Focal Length</span>
                            <span className="font-mono text-zinc-500">
                                {focalLengthToFov(ep.focalLength ?? 50).toFixed(1)}° FOV
                            </span>
                        </div>
                        <div className="flex gap-1">
                            {LENS_PRESETS.map((lens) => (
                                <button
                                    key={lens.mm}
                                    type="button"
                                    onClick={() => patchEndpoint(which, { focalLength: lens.mm })}
                                    className={`flex-1 py-0.5 rounded text-[9px] font-mono transition-colors cursor-pointer text-center ${
                                        (ep.focalLength ?? 50) === lens.mm
                                            ? activeBtnClass
                                            : 'bg-[#1c1c21] hover:bg-white/10 text-zinc-400 hover:text-white border border-white/5'
                                    }`}
                                    title={lens.label}
                                >
                                    {lens.mm}
                                </button>
                            ))}
                        </div>
                        <ScrubInput
                            label="Lens"
                            value={Math.round(ep.focalLength ?? 50)}
                            min={12}
                            max={200}
                            step={1}
                            unit="mm"
                            onChange={(focal) => patchEndpoint(which, { focalLength: Math.round(focal) })}
                        />
                    </div>
                </div>
            </div>
        );
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

                {/* Dotted path line from From centre to To centre redraws live */}
                <line
                    x1={fromBox.cx}
                    y1={fromBox.cy}
                    x2={toBox.cx}
                    y2={toBox.cy}
                    stroke="rgba(56, 189, 248, 0.45)"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                />
                <circle cx={fromBox.cx} cy={fromBox.cy} r="4.5" fill="#10b981" />
                <circle cx={toBox.cx} cy={toBox.cy} r="4.5" fill="#38bdf8" />
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
                className={`absolute border-2 border-dashed border-emerald-400/80 bg-emerald-500/[0.03] rounded-lg pointer-events-auto cursor-move transition-shadow ${
                    activeDrag?.which === 'from' ? 'ring-2 ring-emerald-400/40 shadow-lg shadow-emerald-500/10' : ''
                }`}
                title="Drag body to reposition From camera anchor"
            >
                {/* Header Chip */}
                <div
                    className="absolute top-1.5 left-1.5 pl-2 pr-1 py-0.5 rounded-full bg-emerald-950/90 border border-emerald-400/50 text-[10px] font-mono text-emerald-300 flex items-center gap-1.5 shadow-md pointer-events-auto"
                >
                    <div
                        onPointerDown={(e) => handleStartDrag(e, 'from', 'pan')}
                        className="flex items-center gap-1.5 cursor-move"
                        title="Drag to reposition From camera anchor"
                    >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse motion-reduce:animate-none" />
                        <span className="font-semibold">From: {Number(fromEp.zoom.toFixed(2))}x</span>
                        <span className="px-1 py-0.2 rounded bg-emerald-900/60 text-emerald-200 text-[9px]">
                            {activeFromPreset ? activeFromPreset.name : 'Custom'}
                        </span>
                        {fromEp.orbit !== 0 && <span className="text-emerald-400/70">• {fromEp.orbit}°</span>}
                        {(fromEp.focalLength ?? 50) !== 50 && (
                            <span className="text-emerald-400/70">• {Math.round(fromEp.focalLength ?? 50)}mm</span>
                        )}
                    </div>

                    <div className="flex items-center gap-0.5 border-l border-emerald-400/30 pl-1 ml-0.5">
                        <button
                            type="button"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                                e.stopPropagation();
                                handleFrameContent('from');
                            }}
                            className="p-1 rounded hover:bg-emerald-500/20 text-emerald-300 hover:text-white cursor-pointer transition-colors"
                            title="Frame Selection (Focus)"
                            aria-label="Frame Selection for From camera"
                        >
                            <Focus className="w-3 h-3" />
                        </button>
                        <button
                            type="button"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                                e.stopPropagation();
                                setPopoverEndpoint((curr) => (curr === 'from' ? null : 'from'));
                            }}
                            className={`p-1 rounded hover:bg-emerald-500/20 text-emerald-300 hover:text-white cursor-pointer transition-colors ${
                                popoverEndpoint === 'from' ? 'bg-emerald-500/30 text-white' : ''
                            }`}
                            title="Edit From Camera Controls & Presets"
                            aria-label="Edit From Camera Controls & Presets"
                        >
                            <SlidersHorizontal className="w-3 h-3" />
                        </button>
                    </div>
                </div>

                {/* Inline Controls Popover */}
                {renderEndpointPopover('from')}

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
                className={`absolute border-2 border-dashed border-sky-400/90 bg-sky-500/[0.03] rounded-lg pointer-events-auto cursor-move transition-shadow ${
                    activeDrag?.which === 'to' ? 'ring-2 ring-sky-400/40 shadow-lg shadow-sky-500/10' : ''
                }`}
                title="Drag body to reposition To camera anchor"
            >
                {/* Header Chip */}
                <div
                    className="absolute bottom-1.5 right-1.5 pl-2 pr-1 py-0.5 rounded-full bg-sky-950/90 border border-sky-400/50 text-[10px] font-mono text-sky-300 flex items-center gap-1.5 shadow-md pointer-events-auto"
                >
                    <div
                        onPointerDown={(e) => handleStartDrag(e, 'to', 'pan')}
                        className="flex items-center gap-1.5 cursor-move"
                        title="Drag to reposition To camera anchor"
                    >
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse motion-reduce:animate-none" />
                        <span className="font-semibold">To: {Number(toEp.zoom.toFixed(2))}x ({activeBlock.mode})</span>
                        <span className="px-1 py-0.2 rounded bg-sky-900/60 text-sky-200 text-[9px]">
                            {activeToPreset ? activeToPreset.name : 'Custom'}
                        </span>
                        {toEp.orbit !== 0 && <span className="text-sky-400/70">• {toEp.orbit}°</span>}
                        {(toEp.focalLength ?? 50) !== 50 && (
                            <span className="text-sky-400/70">• {Math.round(toEp.focalLength ?? 50)}mm</span>
                        )}
                    </div>

                    <div className="flex items-center gap-0.5 border-l border-sky-400/30 pl-1 ml-0.5">
                        <button
                            type="button"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                                e.stopPropagation();
                                handleFrameContent('to');
                            }}
                            className="p-1 rounded hover:bg-sky-500/20 text-sky-300 hover:text-white cursor-pointer transition-colors"
                            title="Frame Selection (Focus)"
                            aria-label="Frame Selection for To camera"
                        >
                            <Focus className="w-3 h-3" />
                        </button>
                        <button
                            type="button"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                                e.stopPropagation();
                                setPopoverEndpoint((curr) => (curr === 'to' ? null : 'to'));
                            }}
                            className={`p-1 rounded hover:bg-sky-500/20 text-sky-300 hover:text-white cursor-pointer transition-colors ${
                                popoverEndpoint === 'to' ? 'bg-sky-500/30 text-white' : ''
                            }`}
                            title="Edit To Camera Controls & Presets"
                            aria-label="Edit To Camera Controls & Presets"
                        >
                            <SlidersHorizontal className="w-3 h-3" />
                        </button>
                    </div>
                </div>

                {/* Inline Controls Popover */}
                {renderEndpointPopover('to')}

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

            {/* Interactive Move Info Chip in center connecting line */}
            <div
                style={{
                    left: `${(fromBox.cx + toBox.cx) / 2}px`,
                    top: `${(fromBox.cy + toBox.cy) / 2}px`,
                    transform: 'translate(-50%, -50%)',
                }}
                className="absolute z-35 pointer-events-auto"
            >
                <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                        e.stopPropagation();
                        setMovementMenuOpen((v) => !v);
                        setPopoverEndpoint(null);
                    }}
                    className={`px-2.5 py-1 rounded-full bg-[#121216]/95 backdrop-blur-md border text-[10px] font-mono tabular-nums shadow-xl flex items-center gap-1.5 cursor-pointer transition hover:bg-white/10 ${
                        movementMenuOpen
                            ? 'border-sky-400 text-sky-200 ring-2 ring-sky-400/30'
                            : 'border-white/15 text-gray-200 hover:text-white'
                    }`}
                    title="Click to change Camera Movement Preset"
                >
                    <Film className="w-3 h-3 text-sky-400" />
                    <span className="font-semibold text-white">
                        {activeBlock.label || `${activeBlock.mode.toUpperCase()} MOVE`}
                    </span>
                    <span className="text-gray-500">•</span>
                    <span>{(activeBlock.durationMs / 1000).toFixed(1)}s</span>
                    <span className="text-gray-500">•</span>
                    <span className="capitalize">
                        {activeBlock.easing.kind === 'preset' ? activeBlock.easing.name : activeBlock.easing.kind}
                    </span>
                    <span className="text-gray-500">•</span>
                    <span className="text-sky-300 font-semibold">{cameraZoom.toFixed(2)}x</span>
                </button>

                {/* Floating Movement Preset Popover */}
                {movementMenuOpen && (
                    <div
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                        className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-80 bg-[#121216]/95 backdrop-blur-xl border border-sky-500/30 rounded-xl shadow-2xl p-3 z-40 space-y-2.5 text-xs text-[#e4e4e7] animate-in fade-in zoom-in-95 duration-100 select-none text-left"
                    >
                        <div className="flex items-center justify-between border-b border-white/10 pb-2">
                            <div className="flex items-center gap-1.5">
                                <Film className="w-3.5 h-3.5 text-sky-400" />
                                <span className="font-semibold text-white">Camera Movement</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setMovementMenuOpen(false)}
                                className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer"
                                title="Close"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        {/* Presets Select Dropdown */}
                        <select
                            value={CAMERA_MOVEMENT_PRESETS.some((m) => m.name === activeBlock.label) ? CAMERA_MOVEMENT_PRESETS.find((m) => m.name === activeBlock.label)?.id : ''}
                            onChange={(e) => {
                                const moveId = e.target.value as CameraMovementId;
                                if (!moveId) return;
                                const artboardDimensions = { width: artboardWidth, height: artboardHeight };
                                const updated = applyCameraMovementPreset(activeBlock, moveId, { artboardDimensions, preserveDuration: true });
                                updateShot(shot.id, (s) => ({
                                    ...s,
                                    cameraBlocks: (s.cameraBlocks || []).map((b) => (b.id === activeBlock.id ? updated : b)),
                                }));
                            }}
                            className="w-full px-2 py-1 rounded bg-[#1c1c21] border border-white/10 text-[11px] text-[#d4d4d8] hover:border-white/20 focus:outline-none cursor-pointer"
                        >
                            <option value="" disabled>Choose Movement Preset…</option>
                            <optgroup label="Zoom Moves">
                                {CAMERA_MOVEMENT_PRESETS.filter((m) => m.category === 'zoom').map((m) => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                            </optgroup>
                            <optgroup label="Tripod Pan & Tilt">
                                {CAMERA_MOVEMENT_PRESETS.filter((m) => m.category === 'rotation').map((m) => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                            </optgroup>
                            <optgroup label="Dolly, Truck & Pedestal (3D Space)">
                                {CAMERA_MOVEMENT_PRESETS.filter((m) => m.category === 'track').map((m) => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                            </optgroup>
                            <optgroup label="Special FX & Vertigo">
                                {CAMERA_MOVEMENT_PRESETS.filter((m) => m.category === 'special').map((m) => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                            </optgroup>
                        </select>

                        {/* Quick 1-Click Move Buttons */}
                        <div className="space-y-1">
                            <span className="text-[10px] text-zinc-400 font-medium">Quick Moves</span>
                            <div className="grid grid-cols-4 gap-1">
                                {[
                                    { id: 'zoom-in', label: 'Zoom In' },
                                    { id: 'zoom-out', label: 'Zoom Out' },
                                    { id: 'pan-left', label: 'Pan L' },
                                    { id: 'pan-right', label: 'Pan R' },
                                    { id: 'tilt-up', label: 'Tilt Up' },
                                    { id: 'tilt-down', label: 'Tilt Down' },
                                    { id: 'dolly-in', label: 'Dolly In' },
                                    { id: 'dolly-out', label: 'Dolly Out' },
                                    { id: 'truck-left', label: 'Truck L' },
                                    { id: 'truck-right', label: 'Truck R' },
                                    { id: 'pedestal-up', label: 'Ped Up' },
                                    { id: 'pedestal-down', label: 'Ped Down' },
                                ].map((btn) => (
                                    <button
                                        key={btn.id}
                                        type="button"
                                        onClick={() => {
                                            const artboardDimensions = { width: artboardWidth, height: artboardHeight };
                                            const updated = applyCameraMovementPreset(activeBlock, btn.id as CameraMovementId, { artboardDimensions, preserveDuration: true });
                                            updateShot(shot.id, (s) => ({
                                                ...s,
                                                cameraBlocks: (s.cameraBlocks || []).map((b) => (b.id === activeBlock.id ? updated : b)),
                                            }));
                                        }}
                                        className={`py-1 rounded text-[10px] font-mono transition-colors cursor-pointer text-center truncate ${
                                            activeBlock.label === btn.label || (btn.id === 'pan-left' && activeBlock.label === 'Pan Left') || (btn.id === 'pan-right' && activeBlock.label === 'Pan Right') || (btn.id === 'tilt-up' && activeBlock.label === 'Tilt Up') || (btn.id === 'tilt-down' && activeBlock.label === 'Tilt Down') || (btn.id === 'dolly-in' && activeBlock.label === 'Dolly In') || (btn.id === 'dolly-out' && activeBlock.label === 'Dolly Out') || (btn.id === 'truck-left' && activeBlock.label === 'Truck Left') || (btn.id === 'truck-right' && activeBlock.label === 'Truck Right') || (btn.id === 'pedestal-up' && activeBlock.label === 'Pedestal Up') || (btn.id === 'pedestal-down' && activeBlock.label === 'Pedestal Down') || (btn.id === 'zoom-in' && activeBlock.label === 'Zoom In') || (btn.id === 'zoom-out' && activeBlock.label === 'Zoom Out')
                                                ? 'bg-sky-500 text-black font-semibold'
                                                : 'bg-[#1c1c21] hover:bg-white/10 text-zinc-400 hover:text-white border border-white/5'
                                        }`}
                                    >
                                        {btn.label}
                                    </button>
                                ))}
                            </div>
                            <div className="grid grid-cols-2 gap-1 pt-0.5">
                                {[
                                    { id: 'dolly-zoom-in', label: 'Vertigo (Dolly Zoom)' },
                                    { id: 'handheld-sway', label: 'Handheld Sway' },
                                ].map((btn) => (
                                    <button
                                        key={btn.id}
                                        type="button"
                                        onClick={() => {
                                            const artboardDimensions = { width: artboardWidth, height: artboardHeight };
                                            const updated = applyCameraMovementPreset(activeBlock, btn.id as CameraMovementId, { artboardDimensions, preserveDuration: true });
                                            updateShot(shot.id, (s) => ({
                                                ...s,
                                                cameraBlocks: (s.cameraBlocks || []).map((b) => (b.id === activeBlock.id ? updated : b)),
                                            }));
                                        }}
                                        className="py-1 px-1 rounded text-[10px] font-mono bg-[#1c1c21] hover:bg-white/10 text-zinc-400 hover:text-white border border-white/5 cursor-pointer text-center truncate"
                                    >
                                        {btn.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
