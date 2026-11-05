import React from 'react';
import { AlignLeft, AlignCenterHorizontal, AlignRight, AlignStartVertical, AlignCenterVertical, AlignEndVertical, Focus } from 'lucide-react';
import type { CameraBlock, CameraKeyframeEndpoint, Shot } from '../../../model/types';
import { AxisFields } from '../../../ui/AxisFields';
import { InspectorDisclosure } from '../../../ui/InspectorDisclosure';
import { InspectorRow, IconButton } from '../../../ui/primitives';
import { FigmaSelect } from '../../../ui/FigmaSelect';
import { ScrubInput } from '../../../ui/ScrubInput';
import {
    CAMERA_PRESETS,
    calculateLayersBoundingFraming,
    detectMatchingPreset,
    applyCameraPreset,
    focalLengthToFov,
    LENS_PRESETS,
} from '../../../stage/webgl/cameraMath';

interface CameraEndpointEditorProps {
    which: 'from' | 'to';
    collapsed: boolean;
    onToggle: () => void;
    activeCameraBlock: CameraBlock;
    currentShot?: Shot;
    selectedLayerIds: string[];
    artboardWidth: number;
    artboardHeight: number;
    halfW: number;
    halfH: number;
    updateCameraBlock: (id: string, updater: (block: CameraBlock) => CameraBlock) => void;
}

export const CameraEndpointEditor: React.FC<CameraEndpointEditorProps> = ({
    which, collapsed, onToggle, activeCameraBlock, currentShot, selectedLayerIds,
    artboardWidth, artboardHeight, halfW, halfH, updateCameraBlock,
}) => {
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
            <InspectorDisclosure
                title={which}
                headerContent={<div className="flex items-center gap-2">
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
                </div>}
                toggleLabel={`Toggle ${which} camera endpoint settings`}
                open={!collapsed}
                onOpenChange={onToggle}
                headerClassName="flex items-center justify-between cursor-pointer w-full text-left group"
            >
                    <div className="space-y-3">
                        {/* Alignment & Framing Toolbar */}
                        <InspectorRow
                            unstyled
                            className="space-y-1.5"
                            labelTag="span"
                            labelClassName="text-[10px] text-[#a1a1aa] block font-medium"
                            label={<>Alignment
                            </>}
                        >
                            <div className="grid grid-cols-2 gap-1.5" role="toolbar" aria-label={`${which} endpoint alignment and framing`}>
                                <div className="grid grid-cols-3 gap-0.5 bg-[#1c1c1f] p-0.5 rounded-lg">
                                    <IconButton
                                        unstyled
                                        tooltip={false}
                                        label="Align Left"
                                        icon={<>
                                            <AlignLeft className="w-3.5 h-3.5" />
                                        </>}
                                        onClick={() => patchEndpoint({ anchorX: Math.round(-halfW + halfW / Math.max(0.1, ep.zoom)) })}
                                        className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
                                        title="Align Left"
                                    />
                                    <IconButton
                                        unstyled
                                        tooltip={false}
                                        label="Center X"
                                        icon={<>
                                            <AlignCenterHorizontal className="w-3.5 h-3.5" />
                                        </>}
                                        onClick={() => patchEndpoint({ anchorX: 0 })}
                                        className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
                                        title="Center X"
                                    />
                                    <IconButton
                                        unstyled
                                        tooltip={false}
                                        label="Align Right"
                                        icon={<>
                                            <AlignRight className="w-3.5 h-3.5" />
                                        </>}
                                        onClick={() => patchEndpoint({ anchorX: Math.round(halfW - halfW / Math.max(0.1, ep.zoom)) })}
                                        className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
                                        title="Align Right"
                                    />
                                </div>
                                <div className="grid grid-cols-3 gap-0.5 bg-[#1c1c1f] p-0.5 rounded-lg">
                                    <IconButton
                                        unstyled
                                        tooltip={false}
                                        label="Align Top"
                                        icon={<>
                                            <AlignStartVertical className="w-3.5 h-3.5" />
                                        </>}
                                        onClick={() => patchEndpoint({ anchorY: Math.round(halfH - halfH / Math.max(0.1, ep.zoom)) })}
                                        className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
                                        title="Align Top"
                                    />
                                    <IconButton
                                        unstyled
                                        tooltip={false}
                                        label="Center Y"
                                        icon={<>
                                            <AlignCenterVertical className="w-3.5 h-3.5" />
                                        </>}
                                        onClick={() => patchEndpoint({ anchorY: 0 })}
                                        className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
                                        title="Center Y"
                                    />
                                    <IconButton
                                        unstyled
                                        tooltip={false}
                                        label="Align Bottom"
                                        icon={<>
                                            <AlignEndVertical className="w-3.5 h-3.5" />
                                        </>}
                                        onClick={() => patchEndpoint({ anchorY: Math.round(-halfH + halfH / Math.max(0.1, ep.zoom)) })}
                                        className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
                                        title="Align Bottom"
                                    />
                                </div>
                            </div>
                        </InspectorRow>

                        <details className="group space-y-2">
                            <summary className="cursor-pointer list-none text-[10px] font-medium text-[#a1a1aa] hover:text-white">Camera presets</summary>
                            <div className="flex justify-end">
                                <IconButton
                                    unstyled
                                    tooltip={false}
                                    label={`Frame selection for ${which} endpoint`}
                                    icon={<>
                                        <Focus className="w-3.5 h-3.5" />
                                    </>}
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
                                />
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
                            <AxisFields
                                className="grid grid-cols-2 gap-1.5"
                                fields={[{ key: "0", "label": "X", "value": Math.round(ep.anchorX), "min": -10000, "max": 10000, "step": 1, "onChange": (pxX) =>
                                patchEndpoint({
                                    anchorX: Math.round(pxX),
                                }) }, { key: "1", "label": "Y", "value": Math.round(ep.anchorY), "min": -10000, "max": 10000, "step": 1, "onChange": (pxY) =>
                                patchEndpoint({
                                    anchorY: Math.round(pxY),
                                }) }]}
                            />
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
                            <InspectorRow
                                unstyled
                                className="space-y-1.5"
                                labelTag="span"
                                labelClassName="text-[10px] text-[#a1a1aa] block font-medium"
                                label={<>Zoom</>}
                            >
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

                            </InspectorRow>
                            <InspectorRow
                                unstyled
                                className="space-y-1.5"
                                labelTag="span"
                                labelClassName="text-[10px] text-[#a1a1aa] block font-medium"
                                label={<>Roll</>}
                            >
                                <ScrubInput
                                    label="∟"
                                    value={ep.roll}
                                    min={-180}
                                    max={180}
                                    step={1}
                                    unit="°"
                                    onChange={(roll) => patchEndpoint({ roll })}
                                />
                            </InspectorRow>
                        </div>

                        {/* Orbit & Tilt */}
                        <InspectorRow
                            unstyled
                            className="space-y-1.5"
                            labelTag="span"
                            labelClassName="text-[10px] text-[#a1a1aa] block font-medium"
                            label={<>Orbit &amp; tilt
                            </>}
                        >
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
                        </InspectorRow>

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
                </InspectorDisclosure>
        );
};