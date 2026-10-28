import { FigmaSelect } from '../../../ui/FigmaSelect';
import { EasingControl } from '../../../ui/EasingControl';
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
    Plus,
    Minus,
} from 'lucide-react';
import type {
    CameraBlock,
    CameraKeyframeEndpoint,
} from '../../../model/types';
import { createDefaultCameraBlock } from '../../../model/defaults';
import { useProjectStore } from '../../../store/useProjectStore';
import { useSelectionStore } from '../../../store/useSelectionStore';
import { ScrubInput } from '../../../ui/ScrubInput';
import { getArtboardDimensions } from '../../../stage/stageUtils';
import {
    CAMERA_PRESETS,
    CAMERA_MOVEMENT_PRESETS,
    calculateLayersBoundingFraming,
    detectMatchingPreset,
    applyCameraPreset,
    applyCameraMovementPreset,
    getMovementPresetIdByLabel,
    focalLengthToFov,
    LENS_PRESETS,
    type CameraMovementId,
    type CameraMovementCategory,
} from '../../../stage/webgl/cameraMath';

const MOVEMENT_GROUPS: { id: CameraMovementCategory; label: string }[] = [
    { id: 'zoom', label: 'Zoom' },
    { id: 'rotation', label: 'Pan & tilt' },
    { id: 'track', label: 'Dolly, truck & pedestal' },
    { id: 'special', label: 'Special moves' },
];

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
    const [movementFlyoutOpen, setMovementFlyoutOpen] = useState(false);


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
                        <span className="text-[10px] text-zinc-400 font-mono">
                            {Number(ep.zoom.toFixed(2))}x
                        </span>
                        {(ep.focalLength ?? 50) !== 50 && (
                            <span className="text-[10px] text-zinc-400 font-mono">
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
                                Alignment
                            </span>
                            <div className="grid grid-cols-2 gap-1.5" role="toolbar" aria-label={`${which} endpoint alignment and framing`}>
                                <div className="grid grid-cols-3 gap-0.5 bg-[#1c1c1f] p-0.5 rounded-lg">
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
                                </div>
                                <div className="grid grid-cols-3 gap-0.5 bg-[#1c1c1f] p-0.5 rounded-lg">
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
                                </div>
                            </div>
                        </div>

                        <details className="group space-y-2">
                            <summary className="cursor-pointer list-none text-[10px] font-medium text-[#a1a1aa] hover:text-white">Camera presets</summary>
                            <div className="flex justify-end">
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
                                            className={`px-1.5 py-1 rounded text-[10px] transition-all cursor-pointer truncate text-center ${isSelected
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
                            <FigmaSelect
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
                            </FigmaSelect>
                        </details>

                        {/* Anchor & 3D Depth */}
                        <div className="space-y-1.5">
                            <span className="text-[10px] text-[#a1a1aa] block font-medium">Anchor</span>
                            <div className="grid grid-cols-2 gap-1.5">
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

                            </div>
                            <details className="pt-1">
                                <summary className="cursor-pointer list-none text-[10px] text-[#a1a1aa] hover:text-white">Depth</summary>
                                <div className="pt-1">                                <ScrubInput
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
                                /></div>
                            </details>
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
                                Orbit &amp; tilt
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
                        <details className="space-y-1.5">
                            <summary className="cursor-pointer list-none text-[10px] font-medium text-[#a1a1aa] hover:text-white">Lens focal length</summary>
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-[#a1a1aa] block font-medium">
                                        Lens Focal Length
                                    </span>
                                    <span className="text-[10px] text-zinc-400 font-mono">
                                        {focalLengthToFov(ep.focalLength ?? 50).toFixed(1)}° FOV
                                    </span>
                                </div>
                                <div className="flex gap-1 mb-1">
                                    {LENS_PRESETS.map((lens) => (
                                        <button
                                            key={lens.mm}
                                            type="button"
                                            onClick={() => patchEndpoint({ focalLength: lens.mm })}
                                            className={`flex-1 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer text-center ${(ep.focalLength ?? 50) === lens.mm
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
                        </details>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex-1 overflow-y-auto divide-y divide-white/[0.06]">
            <div className="px-3.5 py-2.5 flex items-center justify-between bg-emerald-950/20">
                <div className="flex items-center gap-1">
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
                    <button
                        type="button"
                        onClick={onDone}
                        aria-label="Close camera move settings"
                        className="text-[10px] text-[#a1a1aa] hover:text-white cursor-pointer px-2 py-0.5 rounded hover:bg-white/5"
                    >
                        Done
                    </button>
                </div>
            </div>

            {/* 1. FROM SECTION */}
            {renderCameraEndpoint('from', fromCollapsed, () => setFromCollapsed((v) => !v))}

            {/* 2. TO SECTION */}
            {renderCameraEndpoint('to', toCollapsed, () => setToCollapsed((v) => !v))}

            {/* 3. MOVEMENT PRESETS & MOVE MODE */}
            <div className="p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-[#e4e4e7] block">
                        Move
                    </span>
                    <div className="flex items-center gap-1">
                        {(() => {
                            const selectedMovementId = getMovementPresetIdByLabel(activeCameraBlock.label);
                            return selectedMovementId ? (
                                <button
                                    type="button"
                                    aria-label="Remove applied camera movement preset"
                                    title="Remove applied preset"
                                    onClick={() => updateCameraBlock(activeCameraBlock.id, (cb) => {
                                        const defaults = createDefaultCameraBlock(cb.id, cb.startMs, cb.durationMs, cb.fromFramingId, cb.toFramingId, 'Custom Move');
                                        return { ...cb, label: defaults.label, mode: defaults.mode, from: defaults.from, to: defaults.to, shake: defaults.shake };
                                    })}
                                    className="h-6 w-6 rounded-md flex items-center justify-center bg-[#222226] border border-white/10 text-[#a1a1aa] hover:text-rose-300 hover:border-rose-400/40 cursor-pointer"
                                >
                                    <Minus className="w-3.5 h-3.5" />
                                </button>
                            ) : null;
                        })()}
                        <button
                            type="button"
                            aria-label="Add camera movement preset"
                            aria-expanded={movementFlyoutOpen}
                            onClick={() => setMovementFlyoutOpen((open) => !open)}
                            className={`h-6 w-6 rounded-md flex items-center justify-center border cursor-pointer transition-colors ${movementFlyoutOpen ? 'bg-sky-500 text-black border-sky-400' : 'bg-[#222226] border-white/10 text-[#a1a1aa] hover:text-white hover:border-white/20'}`}
                        >
                            <Plus className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                {movementFlyoutOpen && (
                    <div className="rounded-lg border border-white/10 bg-[#141416] p-2 space-y-2 shadow-xl" aria-label="Camera movement presets">
                        {MOVEMENT_GROUPS.map((group) => {
                            const presets = CAMERA_MOVEMENT_PRESETS.filter((preset) => preset.category === group.id);
                            return (
                                <div key={group.id} className="space-y-1">
                                    <span className="text-[10px] uppercase tracking-wide text-[#71717a]">{group.label}</span>
                                    <div className="grid grid-cols-2 gap-1">
                                        {presets.map((preset) => {
                                            const selected = getMovementPresetIdByLabel(activeCameraBlock.label) === preset.id;
                                            return <button
                                                key={preset.id}
                                                type="button"
                                                title={preset.description}
                                                aria-pressed={selected}
                                                onClick={() => {
                                                    updateCameraBlock(activeCameraBlock.id, (cb) => applyCameraMovementPreset(cb, preset.id as CameraMovementId, {
                                                        artboardDimensions: { width: artboardWidth, height: artboardHeight },
                                                        preserveDuration: true,
                                                    }));
                                                    setMovementFlyoutOpen(false);
                                                }}
                                                className={`min-h-7 px-2 rounded-md text-left text-[10px] transition-colors border cursor-pointer ${selected ? 'bg-sky-500/15 border-sky-400/40 text-sky-200' : 'bg-[#1c1c1f] border-white/[0.06] text-[#d4d4d8] hover:bg-white/10 hover:text-white'}`}
                                            >{preset.name}</button>;
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                <div className="space-y-1 pt-1 border-t border-white/5">
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
            </div>

            {/* 4. SHAKE SECTION: Amount [From 0%] [To 0%] [Speed 1.0x] */}
            <div className="p-3.5 space-y-2.5">
                <span className="text-[11px] font-medium text-[#e4e4e7] block">
                    Shake
                </span>
                <div className="space-y-1.5">
                    <span className="text-[10px] text-[#a1a1aa] block font-medium">Amount</span>
                    <div className="grid grid-cols-2 gap-1.5">
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
                        <details className="col-span-2">
                            <summary className="cursor-pointer list-none text-[10px] text-[#a1a1aa] hover:text-white">Speed</summary>
                            <div className="pt-1">                        <ScrubInput
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
                            /></div>
                        </details>

                    </div>
                </div>
            </div>

            {/* 5. TIMING SECTION: Start & length + Easing */}
            <div className="p-3.5 space-y-3">
                <span className="text-[11px] font-medium text-[#e4e4e7] block">
                    Timing
                </span>

                <div className="space-y-1.5">
                    <span className="text-[10px] text-[#a1a1aa] block">Start &amp; length</span>
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
                            label="Length"
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
                    <EasingControl
                        value={activeCameraBlock.easing}
                        onChange={(easing) =>
                            updateCameraBlock(activeCameraBlock.id, (cb) => ({
                                ...cb,
                                easing,
                            }))
                        }
                        selectAriaLabel="Camera move easing"
                        selectClassName="flex-1 h-7 rounded-lg bg-[#1c1c1f] border border-white/[0.06] px-2.5 text-[11px] text-white outline-none cursor-pointer"
                        bezierDefaults={{ x1: 0.16, y1: 1, x2: 0.3, y2: 1 }}
                        showCurvePreview
                        previewAriaLabel="Camera easing curve preview"
                        popoverButtonLabel="Easing settings"
                        showInlineTuning
                    />
                </div>
            </div>
        </div>
    );
};
