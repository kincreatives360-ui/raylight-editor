// src/panels/Inspector/sections/CameraBlockSection.tsx
import React, { useState } from 'react';
import {
    ChevronDown,
    ChevronUp,
    AlignLeft,
    AlignCenterHorizontal,
    AlignRight,
    AlignStartVertical,
    AlignCenterVertical,
    AlignEndVertical,
    Focus,
    X,
} from 'lucide-react';
import type {
    CameraBlock,
    CameraKeyframeEndpoint,
} from '../../../model/types';
import { easingFromSelection } from '../../../model/easingSelection';
import { useProjectStore } from '../../../store/useProjectStore';
import { useSelectionStore } from '../../../store/useSelectionStore';
import { ScrubInput } from '../../../ui/ScrubInput';
import { getArtboardDimensions } from '../../../stage/stageUtils';
import {
    CAMERA_PRESETS,
    calculateLayersBoundingFraming,
    detectMatchingPreset,
    applyCameraPreset,
    focalLengthToFov,
    LENS_PRESETS,
} from '../../../stage/webgl/cameraMath';

interface CameraBlockSectionProps {
    activeShotId: string;
    activeCameraBlock: CameraBlock;
    onDone: () => void;
}

export const CameraBlockSection: React.FC<CameraBlockSectionProps> = ({
    activeShotId,
    activeCameraBlock,
    onDone,
}) => {
    const { project, updateShot } = useProjectStore();
    const { selectedLayerIds } = useSelectionStore();
    const currentShot = project.shots.find((s) => s.id === activeShotId);
    const { width: artboardWidth, height: artboardHeight } = getArtboardDimensions(project.aspectRatio);
    const halfW = artboardWidth / 2;
    const halfH = artboardHeight / 2;
    const [fromCollapsed, setFromCollapsed] = useState(false);
    const [toCollapsed, setToCollapsed] = useState(false);


    const updateCameraBlock = (
        camBlockId: string,
        updater: (cb: CameraBlock) => CameraBlock
    ) => {
        updateShot(activeShotId, (s) => ({
            ...s,
            cameraBlocks: (s.cameraBlocks || []).map((cb) =>
                cb.id === camBlockId ? updater(cb) : cb
            ),
        }));
    };

    const renderCameraEndpoint = (
        which: 'from' | 'to',
        collapsed: boolean,
        onToggle: () => void
    ) => {
        const fallback: CameraKeyframeEndpoint =
            which === 'from'
                ? { anchorX: 0, anchorY: 0, anchorZ: 0, zoom: 1, roll: 0, orbit: 0, tilt: 0, focalLength: 50 }
                : {
                    anchorX: 0,
                    anchorY: 0,
                    anchorZ: 0,
                    zoom: 1.2,
                    roll: 0,
                    orbit: 0,
                    tilt: 0,
                    focalLength: 50,
                };
        const ep: CameraKeyframeEndpoint = activeCameraBlock[which] || fallback;
        const activePreset = detectMatchingPreset(ep);

        const patchEndpoint = (patch: Partial<CameraKeyframeEndpoint>) => {
            updateCameraBlock(activeCameraBlock.id, (curr) => ({
                ...curr,
                [which]: { ...(curr[which] || fallback), ...patch },
            }));
        };

        const badgeBorder = which === 'from'
            ? 'border-emerald-500/40 text-emerald-300 bg-emerald-950/60'
            : 'border-sky-500/40 text-sky-300 bg-sky-950/60';
        const activeBtnClass = which === 'from'
            ? 'bg-emerald-500 text-black font-semibold shadow-xs'
            : 'bg-sky-500 text-black font-semibold shadow-xs';

        return (
            <div className="p-3.5 space-y-3">
                <button
                    type="button"
                    onClick={onToggle}
                    aria-expanded={!collapsed}
                    aria-label={`Toggle ${which} camera endpoint settings`}
                    className="flex items-center justify-between cursor-pointer w-full text-left group"
                >
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-[#e4e4e7] capitalize">
                            {which}
                        </span>
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-mono border ${badgeBorder}`}>
                            {activePreset ? activePreset.name : 'Custom'}
                        </span>
                        <span className="text-[10px] text-zinc-400 font-mono">
                            {Number(ep.zoom.toFixed(2))}x
                        </span>
                        {(ep.focalLength ?? 50) !== 50 && (
                            <span className="text-[9px] text-zinc-400 font-mono">
                                • {Math.round(ep.focalLength ?? 50)}mm
                            </span>
                        )}
                    </div>
                    {collapsed ? (
                        <ChevronDown className="w-3.5 h-3.5 text-[#a1a1aa] group-hover:text-white transition-colors" />
                    ) : (
                        <ChevronUp className="w-3.5 h-3.5 text-[#a1a1aa] group-hover:text-white transition-colors" />
                    )}
                </button>

                {!collapsed && (
                    <div className="space-y-3">
                        {/* Alignment & Framing Toolbar */}
                        <div className="space-y-1.5">
                            <span className="text-[10px] text-[#a1a1aa] block font-medium">
                                Alignment &amp; Framing
                            </span>
                            <div className="grid grid-cols-7 gap-0.5 bg-[#1c1c1f] p-0.5 rounded-lg" role="toolbar" aria-label={`${which} endpoint alignment and framing`}>
                                <button
                                    type="button"
                                    onClick={() => patchEndpoint({ anchorX: Math.round(-halfW + halfW / Math.max(0.1, ep.zoom)) })}
                                    className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
                                    title="Align Left"
                                    aria-label="Align Left"
                                >
                                    <AlignLeft className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => patchEndpoint({ anchorX: 0 })}
                                    className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
                                    title="Center X"
                                    aria-label="Center X"
                                >
                                    <AlignCenterHorizontal className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => patchEndpoint({ anchorX: Math.round(halfW - halfW / Math.max(0.1, ep.zoom)) })}
                                    className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
                                    title="Align Right"
                                    aria-label="Align Right"
                                >
                                    <AlignRight className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => patchEndpoint({ anchorY: Math.round(halfH - halfH / Math.max(0.1, ep.zoom)) })}
                                    className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
                                    title="Align Top"
                                    aria-label="Align Top"
                                >
                                    <AlignStartVertical className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => patchEndpoint({ anchorY: 0 })}
                                    className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
                                    title="Center Y"
                                    aria-label="Center Y"
                                >
                                    <AlignCenterVertical className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => patchEndpoint({ anchorY: Math.round(-halfH + halfH / Math.max(0.1, ep.zoom)) })}
                                    className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
                                    title="Align Bottom"
                                    aria-label="Align Bottom"
                                >
                                    <AlignEndVertical className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const selectedLayers = (currentShot?.layers || []).filter((l) => selectedLayerIds.includes(l.id));
                                        const targetLayers = selectedLayers.length > 0
                                            ? selectedLayers
                                             : (currentShot?.layers || []).filter((l) => !l.hidden);
                                        if (targetLayers.length > 0) {
                                            const framing = calculateLayersBoundingFraming(targetLayers, { width: artboardWidth, height: artboardHeight });
                                            patchEndpoint({
                                                anchorX: framing.anchorX,
                                                anchorY: framing.anchorY,
                                                zoom: framing.zoom,
                                            });
                                        }
                                    }}
                                    className="h-6 rounded hover:bg-[#0088ff]/20 text-[#0088ff] hover:text-white flex items-center justify-center cursor-pointer transition-colors"
                                    title={selectedLayerIds.length > 0 ? "Frame Selected Layer(s)" : "Frame Scene Content"}
                                    aria-label={`Frame selection for ${which} endpoint`}
                                >
                                    <Focus className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>

                        {/* Camera Preset Selector */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] text-[#a1a1aa] block font-medium">
                                    Camera Presets
                                </span>
                                {activePreset && (
                                    <span className="text-[9px] text-zinc-400 truncate max-w-[170px]" title={activePreset.description}>
                                        {activePreset.description}
                                    </span>
                                )}
                            </div>

                            {/* Quick Preset Buttons */}
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
                                            onClick={() => {
                                                const next = applyCameraPreset(preset, ep);
                                                patchEndpoint(next);
                                            }}
                                            className={`px-1.5 py-1 rounded text-[10px] transition-all cursor-pointer truncate text-center ${
                                                isSelected
                                                    ? activeBtnClass
                                                    : 'bg-[#1c1c1f] hover:bg-white/10 text-[#d4d4d8] border border-white/5 hover:border-white/20'
                                            }`}
                                            title={preset.description}
                                        >
                                            {btn.label}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Full Preset Dropdown */}
                            <select
                                aria-label={`${which} camera preset`}
                                value={activePreset?.id ?? ''}
                                onChange={(e) => {
                                    const preset = CAMERA_PRESETS.find((p) => p.id === e.target.value);
                                    if (preset) {
                                        const next = applyCameraPreset(preset, ep);
                                        patchEndpoint(next);
                                    }
                                }}
                                className="w-full px-2 py-1.5 rounded-lg bg-[#1c1c1f] border border-white/10 text-xs text-[#d4d4d8] hover:border-white/20 focus:border-[#0088ff] focus:outline-none cursor-pointer"
                            >
                                <option value="" disabled>All Presets ({CAMERA_PRESETS.length})…</option>
                                <optgroup label="Axial Views">
                                    {CAMERA_PRESETS.filter((p) => p.category === 'axial').map((p) => (
                                        <option key={p.id} value={p.id}>{p.name} ({p.orbit}°, {p.tilt}°)</option>
                                    ))}
                                </optgroup>
                                <optgroup label="Axonometric">
                                    {CAMERA_PRESETS.filter((p) => p.category === 'axonometric').map((p) => (
                                        <option key={p.id} value={p.id}>{p.name} ({p.orbit}°, {p.tilt}°)</option>
                                    ))}
                                </optgroup>
                                <optgroup label="Cinematic">
                                    {CAMERA_PRESETS.filter((p) => p.category === 'cinematic').map((p) => (
                                        <option key={p.id} value={p.id}>{p.name} {p.zoom ? `(${p.zoom}x)` : ''} {p.focalLength ? `• ${p.focalLength}mm` : ''}</option>
                                    ))}
                                </optgroup>
                            </select>
                        </div>

                        {/* Anchor & 3D Depth */}
                        <div className="space-y-1.5">
                            <span className="text-[10px] text-[#a1a1aa] block font-medium">Anchor &amp; Depth</span>
                            <div className="grid grid-cols-3 gap-1.5">
                                <ScrubInput
                                    label="X"
                                    value={Math.round(ep.anchorX)}
                                    min={-10000}
                                    max={10000}
                                    step={1}
                                    onChange={(pxX) =>
                                        patchEndpoint({
                                            anchorX: Math.round(pxX),
                                        })
                                    }
                                />
                                <ScrubInput
                                    label="Y"
                                    value={Math.round(ep.anchorY)}
                                    min={-10000}
                                    max={10000}
                                    step={1}
                                    onChange={(pxY) =>
                                        patchEndpoint({
                                            anchorY: Math.round(pxY),
                                        })
                                    }
                                />
                                <ScrubInput
                                    label="Z"
                                    value={Math.round(ep.anchorZ ?? 0)}
                                    min={-2000}
                                    max={2000}
                                    step={5}
                                    unit="px"
                                    onChange={(pxZ) =>
                                        patchEndpoint({
                                            anchorZ: Math.round(pxZ),
                                        })
                                    }
                                />
                            </div>
                        </div>

                        {/* Zoom & Roll */}
                        <div className="grid grid-cols-2 gap-1.5">
                            <div className="space-y-1.5">
                                <span className="text-[10px] text-[#a1a1aa] block font-medium">Zoom</span>
                                <ScrubInput
                                    label="⊕"
                                    value={Number(ep.zoom.toFixed(2))}
                                    min={0.15}
                                    max={5}
                                    step={0.01}
                                    decimals={2}
                                    unit="x"
                                    onChange={(zoom) => patchEndpoint({ zoom: Number(zoom.toFixed(2)) })}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <span className="text-[10px] text-[#a1a1aa] block font-medium">Roll</span>
                                <ScrubInput
                                    label="∟"
                                    value={ep.roll}
                                    min={-180}
                                    max={180}
                                    step={1}
                                    unit="°"
                                    onChange={(roll) => patchEndpoint({ roll })}
                                />
                            </div>
                        </div>

                        {/* Orbit & Tilt */}
                        <div className="space-y-1.5">
                            <span className="text-[10px] text-[#a1a1aa] block font-medium">
                                Orbit &amp; Tilt
                            </span>
                            <div className="grid grid-cols-2 gap-1.5">
                                <ScrubInput
                                    label="◎"
                                    value={ep.orbit}
                                    min={-360}
                                    max={360}
                                    step={1}
                                    unit="°"
                                    onChange={(orbit) => patchEndpoint({ orbit })}
                                />
                                <ScrubInput
                                    label="∠"
                                    value={ep.tilt}
                                    min={-89}
                                    max={89}
                                    step={1}
                                    unit="°"
                                    onChange={(tilt) => patchEndpoint({ tilt })}
                                />
                            </div>
                        </div>

                        {/* Lens & Focal Length */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] text-[#a1a1aa] block font-medium">
                                    Lens Focal Length
                                </span>
                                <span className="text-[9px] text-zinc-400 font-mono">
                                    {focalLengthToFov(ep.focalLength ?? 50).toFixed(1)}° FOV
                                </span>
                            </div>
                            <div className="flex gap-1 mb-1">
                                {LENS_PRESETS.map((lens) => (
                                    <button
                                        key={lens.mm}
                                        type="button"
                                        onClick={() => patchEndpoint({ focalLength: lens.mm })}
                                        className={`flex-1 py-0.5 rounded text-[9px] font-mono transition-colors cursor-pointer text-center ${
                                            (ep.focalLength ?? 50) === lens.mm
                                                ? activeBtnClass
                                                : 'bg-[#1c1c1f] hover:bg-white/10 text-zinc-400 hover:text-white border border-white/5'
                                        }`}
                                        title={lens.label}
                                    >
                                        {lens.mm}mm
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
                                onChange={(focal) => patchEndpoint({ focalLength: Math.round(focal) })}
                            />
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex-1 overflow-y-auto divide-y divide-white/[0.06]">
            <div className="px-3.5 py-2.5 flex items-center justify-between bg-emerald-950/20">
                <span className="text-[11px] font-semibold text-emerald-300">
                    Camera Move
                </span>
                <button
                    type="button"
                    onClick={onDone}
                    aria-label="Close camera move settings"
                    className="text-[10px] text-[#a1a1aa] hover:text-white cursor-pointer px-2 py-0.5 rounded hover:bg-white/5"
                >
                    Done
                </button>
            </div>

            {/* 1. FROM SECTION */}
            {renderCameraEndpoint('from', fromCollapsed, () => setFromCollapsed((v) => !v))}

            {/* 2. TO SECTION */}
            {renderCameraEndpoint('to', toCollapsed, () => setToCollapsed((v) => !v))}

            {/* 3. MOVE SECTION: [ Dolly | Zoom | Warp ] */}
            <div className="p-3.5 space-y-2.5">
                <span className="text-[11px] font-medium text-[#e4e4e7] block">
                    Move
                </span>
                <div className="grid grid-cols-3 gap-1 bg-[#161619] p-1 rounded-xl border border-white/[0.06]" role="radiogroup" aria-label="Camera move mode">
                    {(
                        [
                            { id: 'dolly', label: 'Dolly' },
                            { id: 'zoom', label: 'Zoom' },
                            { id: 'dollyzoom', label: 'Warp' },
                        ] as const
                    ).map((m) => (
                        <button
                            key={m.id}
                            type="button"
                            role="radio"
                            aria-checked={activeCameraBlock.mode === m.id}
                            onClick={() =>
                                updateCameraBlock(activeCameraBlock.id, (cb) => ({
                                    ...cb,
                                    mode: m.id,
                                }))
                            }
                            className={`py-1.5 rounded-lg text-[11px] font-medium cursor-pointer transition ${activeCameraBlock.mode === m.id
                                ? 'bg-[#2a2a30] text-white border border-white/15 shadow'
                                : 'text-[#a1a1aa] hover:text-white'
                                }`}
                        >
                            {m.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* 4. SHAKE SECTION: Amount [From 0%] [To 0%] [Speed 1.0x] */}
            <div className="p-3.5 space-y-2.5">
                <span className="text-[11px] font-medium text-[#e4e4e7] block">
                    Shake
                </span>
                <div className="space-y-1.5">
                    <span className="text-[10px] text-[#a1a1aa] block font-medium">Intensity &amp; Speed</span>
                    <div className="grid grid-cols-3 gap-1.5">
                        <ScrubInput
                            label="From"
                            value={activeCameraBlock.shake?.from ?? 0}
                            min={0}
                            max={100}
                            step={1}
                            unit="%"
                            onChange={(from) =>
                                updateCameraBlock(activeCameraBlock.id, (cb) => ({
                                    ...cb,
                                    shake: {
                                        from,
                                        to: cb.shake?.to ?? 0,
                                        frequency: cb.shake?.frequency ?? 1.0,
                                    },
                                }))
                            }
                        />
                        <ScrubInput
                            label="To"
                            value={activeCameraBlock.shake?.to ?? 0}
                            min={0}
                            max={100}
                            step={1}
                            unit="%"
                            onChange={(to) =>
                                updateCameraBlock(activeCameraBlock.id, (cb) => ({
                                    ...cb,
                                    shake: {
                                        from: cb.shake?.from ?? 0,
                                        to,
                                        frequency: cb.shake?.frequency ?? 1.0,
                                    },
                                }))
                            }
                        />
                        <ScrubInput
                            label="Speed"
                            value={Math.round((activeCameraBlock.shake?.frequency ?? 1.0) * 10) / 10}
                            min={0.2}
                            max={5.0}
                            step={0.1}
                            decimals={1}
                            unit="x"
                            onChange={(frequency) =>
                                updateCameraBlock(activeCameraBlock.id, (cb) => ({
                                    ...cb,
                                    shake: {
                                        from: cb.shake?.from ?? 0,
                                        to: cb.shake?.to ?? 0,
                                        frequency: Number(frequency.toFixed(1)),
                                    },
                                }))
                            }
                        />
                    </div>
                </div>
            </div>

            {/* 5. TIMING SECTION: Start & length + Easing */}
            <div className="p-3.5 space-y-3">
                <span className="text-[11px] font-medium text-[#e4e4e7] block">
                    Timing
                </span>

                <div className="space-y-1.5">
                    <span className="text-[10px] text-[#a1a1aa] block">Start &amp; Length</span>
                    <div className="grid grid-cols-2 gap-1.5">
                        <ScrubInput
                            label="Start"
                            value={activeCameraBlock.startMs}
                            min={0}
                            max={30000}
                            step={50}
                            unit="ms"
                            onChange={(startMs) =>
                                updateCameraBlock(activeCameraBlock.id, (cb) => ({
                                    ...cb,
                                    startMs,
                                }))
                            }
                        />
                        <ScrubInput
                            label="Dur"
                            value={activeCameraBlock.durationMs}
                            min={100}
                            max={10000}
                            step={50}
                            unit="ms"
                            onChange={(durationMs) =>
                                updateCameraBlock(activeCameraBlock.id, (cb) => ({
                                    ...cb,
                                    durationMs,
                                }))
                            }
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <span className="text-[10px] text-[#a1a1aa] block">Easing</span>
                    <div className="flex items-center gap-1.5">
                        <select
                            aria-label="Camera move easing"
                            value={
                                activeCameraBlock.easing.kind === 'bezier'
                                    ? 'bezier'
                                    : `${activeCameraBlock.easing.kind}:${activeCameraBlock.easing.name}`
                            }
                            onChange={(e) => {
                                const val = e.target.value;
                                const easing = easingFromSelection(val, {
                                    x1: 0.16, y1: 1, x2: 0.3, y2: 1,
                                });
                                if (!easing) return;
                                updateCameraBlock(activeCameraBlock.id, (cb) => ({
                                    ...cb,
                                    easing,
                                }));
                            }}
                            className="flex-1 h-7 rounded-lg bg-[#1c1c1f] border border-white/[0.06] px-2.5 text-[11px] text-white outline-none cursor-pointer"
                        >
                            <optgroup label="Physics Springs">
                                <option value="spring:gentle">Spring: Gentle</option>
                                <option value="spring:quick">Spring: Quick</option>
                                <option value="spring:bouncy">Spring: Bouncy</option>
                                <option value="spring:slow">Spring: Slow</option>
                                <option value="spring:snappy">Spring: Snappy</option>
                                <option value="spring:stiff">Spring: Stiff</option>
                            </optgroup>
                            <optgroup label="Standard Presets">
                                <option value="preset:linear">Linear</option>
                                <option value="preset:ease">Standard Ease</option>
                                <option value="preset:ease-in">Ease In</option>
                                <option value="preset:ease-out">Ease Out</option>
                                <option value="preset:ease-in-out">Ease In-Out</option>
                                <option value="preset:ease-in-expo">Ease In Expo</option>
                                <option value="preset:ease-out-expo">Ease Out Expo</option>
                                <option value="preset:ease-in-back">Ease In Back</option>
                                <option value="preset:ease-out-back">Ease Out Back</option>
                                <option value="preset:bounce">Bounce</option>
                            </optgroup>
                            <optgroup label="Custom Curves">
                                <option value="bezier">Custom Cubic Bezier</option>
                            </optgroup>
                        </select>
                        <button
                            type="button"
                            onClick={() => {
                                updateShot(activeShotId, (s) => ({
                                    ...s,
                                    cameraBlocks: (s.cameraBlocks || []).filter(
                                        (b) => b.id !== activeCameraBlock.id
                                    ),
                                }));
                                onDone();
                            }}
                            title="Delete Camera Move"
                            aria-label="Delete Camera Move"
                            className="p-1.5 text-[#a1a1aa] hover:text-rose-400 cursor-pointer"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {/* Spring Physics Parameters Slider Tuning */}
                    {activeCameraBlock.easing.kind === 'spring' && (
                        <div className="p-2 rounded-lg bg-[#141416] border border-white/[0.06] space-y-1.5 mt-2">
                            <div className="flex items-center justify-between text-[10px] text-[#38bdf8] font-medium">
                                <span>Spring Physics Tuning</span>
                                <span className="text-[10px] text-[#a1a1aa] font-mono capitalize tracking-tight">{activeCameraBlock.easing.name}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-1">
                                <ScrubInput
                                    label="Stiff"
                                    value={activeCameraBlock.easing.config?.stiffness ?? 180}
                                    min={20}
                                    max={400}
                                    step={5}
                                    onChange={(stiffness) =>
                                        updateCameraBlock(activeCameraBlock.id, (cb) => ({
                                            ...cb,
                                            easing: {
                                                ...cb.easing,
                                                kind: 'spring',
                                                name: cb.easing.kind === 'spring' ? cb.easing.name : 'gentle',
                                                config: { ...(cb.easing.kind === 'spring' ? cb.easing.config : {}), stiffness },
                                            },
                                        }))
                                    }
                                />
                                <ScrubInput
                                    label="Damp"
                                    value={activeCameraBlock.easing.config?.damping ?? 18}
                                    min={1}
                                    max={50}
                                    step={1}
                                    onChange={(damping) =>
                                        updateCameraBlock(activeCameraBlock.id, (cb) => ({
                                            ...cb,
                                            easing: {
                                                ...cb.easing,
                                                kind: 'spring',
                                                name: cb.easing.kind === 'spring' ? cb.easing.name : 'gentle',
                                                config: { ...(cb.easing.kind === 'spring' ? cb.easing.config : {}), damping },
                                            },
                                        }))
                                    }
                                />
                                <ScrubInput
                                    label="Mass"
                                    value={Math.round((activeCameraBlock.easing.config?.mass ?? 1) * 10)}
                                    min={1}
                                    max={50}
                                    step={1}
                                    unit="x"
                                    onChange={(massVal) =>
                                        updateCameraBlock(activeCameraBlock.id, (cb) => ({
                                            ...cb,
                                            easing: {
                                                ...cb.easing,
                                                kind: 'spring',
                                                name: cb.easing.kind === 'spring' ? cb.easing.name : 'gentle',
                                                config: { ...(cb.easing.kind === 'spring' ? cb.easing.config : {}), mass: Number((massVal / 10).toFixed(1)) },
                                            },
                                        }))
                                    }
                                />
                            </div>
                        </div>
                    )}

                    {/* Bezier Handles Tuning */}
                    {activeCameraBlock.easing.kind === 'bezier' && (
                        <div className="p-2 rounded-lg bg-[#141416] border border-white/[0.06] space-y-1.5 mt-2">
                            <div className="flex items-center justify-between text-[10px] text-[#38bdf8] font-medium">
                                <span>Cubic Bezier Curve Handles</span>
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                                <ScrubInput
                                    label="X1"
                                    value={Math.round(activeCameraBlock.easing.x1 * 100)}
                                    min={0}
                                    max={100}
                                    step={1}
                                    unit="%"
                                    onChange={(val) => {
                                        const x1 = Number((val / 100).toFixed(2));
                                        updateCameraBlock(activeCameraBlock.id, (cb) => ({
                                            ...cb,
                                            easing: cb.easing.kind === 'bezier' ? { ...cb.easing, x1 } : cb.easing,
                                        }));
                                    }}
                                />
                                <ScrubInput
                                    label="Y1"
                                    value={Math.round(activeCameraBlock.easing.y1 * 100)}
                                    min={-100}
                                    max={200}
                                    step={1}
                                    unit="%"
                                    onChange={(val) => {
                                        const y1 = Number((val / 100).toFixed(2));
                                        updateCameraBlock(activeCameraBlock.id, (cb) => ({
                                            ...cb,
                                            easing: cb.easing.kind === 'bezier' ? { ...cb.easing, y1 } : cb.easing,
                                        }));
                                    }}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
