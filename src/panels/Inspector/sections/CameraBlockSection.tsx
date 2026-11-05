import { AnimationTimingFields } from '../../../ui/AnimationTimingFields';
import { SegmentedControl } from '../../../ui/primitives';
import { EasingControl } from '../../../ui/EasingControl';
import { IconButton, InspectorRow } from '../../../ui/primitives';
// src/panels/Inspector/sections/CameraBlockSection.tsx
import React, { useState } from 'react';
import { CameraEndpointEditor } from './CameraEndpointEditor';
import { X, Plus, Minus } from 'lucide-react';
import type {
    CameraBlock,
} from '../../../model/types';
import { createDefaultCameraBlock } from '../../../model/defaults';
import { useProjectStore } from '../../../store/useProjectStore';
import { useSelectionStore } from '../../../store/useSelectionStore';
import { ScrubInput } from '../../../ui/ScrubInput';
import { getArtboardDimensions } from '../../../stage/stageUtils';
import {
    CAMERA_MOVEMENT_PRESETS,
    applyCameraMovementPreset,
    getMovementPresetIdByLabel,
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
    const [activeEndpointTab, setActiveEndpointTab] = useState<'from' | 'to'>('from');
    const [movementFlyoutOpen, setMovementFlyoutOpen] = useState(false);

    const handleSwapEndpoints = () => {
        updateCameraBlock(activeCameraBlock.id, (cb) => {
            if (!cb.from || !cb.to) return cb;
            return {
                ...cb,
                from: { ...cb.to },
                to: { ...cb.from },
            };
        });
    };


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

    return (
        <div className="flex-1 overflow-y-auto divide-y divide-white/[0.06]">
            <div className="px-3.5 py-2.5 flex items-center justify-between bg-emerald-950/20">
                <div className="flex items-center gap-1">
                    <IconButton
                        unstyled
                        tooltip={false}
                        label="Delete Camera Move"
                        icon={<>
                            <X className="w-3.5 h-3.5" />
                        </>}
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
                        className="p-1.5 text-muted-foreground hover:text-rose-400 cursor-pointer transition"
                    />
                    <button
                        type="button"
                        onClick={onDone}
                        aria-label="Close camera move settings"
                        className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer px-2 py-0.5 rounded hover:bg-subtle font-medium transition"
                    >
                        Done
                    </button>
                </div>
            </div>

            {/* ENDPOINT SEGMENTED SELECTOR [ From | To | Swap ⇄ ] */}
            <div className="p-3 pb-0">
                <div className="flex items-center gap-1.5 p-1 bg-[#141416] rounded-lg border border-white/[0.08]">
                    <button
                        type="button"
                        aria-pressed={activeEndpointTab === 'from'}
                        onClick={() => setActiveEndpointTab('from')}
                        className={`flex-1 py-1 rounded-md text-[11px] font-medium transition cursor-pointer text-center ${
                            activeEndpointTab === 'from'
                                ? 'bg-[#222226] text-emerald-400 border border-emerald-500/30 shadow-xs'
                                : 'text-zinc-400 hover:text-white'
                        }`}
                    >
                        From (Start)
                    </button>
                    <button
                        type="button"
                        aria-pressed={activeEndpointTab === 'to'}
                        onClick={() => setActiveEndpointTab('to')}
                        className={`flex-1 py-1 rounded-md text-[11px] font-medium transition cursor-pointer text-center ${
                            activeEndpointTab === 'to'
                                ? 'bg-[#222226] text-sky-400 border border-sky-500/30 shadow-xs'
                                : 'text-zinc-400 hover:text-white'
                        }`}
                    >
                        To (End)
                    </button>
                    <button
                        type="button"
                        aria-label="Swap from and to endpoints"
                        onClick={handleSwapEndpoints}
                        title="Swap Start and End Framing"
                        className="px-2 py-1 rounded-md text-[11px] text-zinc-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                    >
                        ⇄
                    </button>
                </div>
            </div>

            {/* ACTIVE ENDPOINT SECTION */}
            <CameraEndpointEditor
                which={activeEndpointTab}
                collapsed={false}
                onToggle={() => {}}
                activeCameraBlock={activeCameraBlock}
                currentShot={currentShot}
                selectedLayerIds={selectedLayerIds}
                artboardWidth={artboardWidth}
                artboardHeight={artboardHeight}
                halfW={halfW}
                halfH={halfH}
                updateCameraBlock={updateCameraBlock}
            />

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
                                <IconButton
                                    unstyled
                                    tooltip={false}
                                    label="Remove applied camera movement preset"
                                    icon={<>
                                        <Minus className="w-3.5 h-3.5" />
                                    </>}
                                    title="Remove applied preset"
                                    onClick={() => updateCameraBlock(activeCameraBlock.id, (cb) => {
                                        const defaults = createDefaultCameraBlock(cb.id, cb.startMs, cb.durationMs, cb.fromFramingId, cb.toFramingId, 'Custom Move');
                                        return { ...cb, label: defaults.label, mode: defaults.mode, from: defaults.from, to: defaults.to, shake: defaults.shake };
                                    })}
                                    className="h-6 w-6 rounded-md flex items-center justify-center bg-[#222226] border border-white/10 text-[#a1a1aa] hover:text-rose-300 hover:border-rose-400/40 cursor-pointer"
                                />
                            ) : null;
                        })()}
                        <IconButton
                            unstyled
                            tooltip={false}
                            label="Add camera movement preset"
                            icon={<>
                                <Plus className="w-3.5 h-3.5" />
                            </>}
                            aria-expanded={movementFlyoutOpen}
                            onClick={() => setMovementFlyoutOpen((open) => !open)}
                            className={`h-6 w-6 rounded-md flex items-center justify-center border cursor-pointer transition-colors ${movementFlyoutOpen ? 'bg-sky-500 text-black border-sky-400' : 'bg-[#222226] border-white/10 text-[#a1a1aa] hover:text-white hover:border-white/20'}`}
                        />
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
                    <SegmentedControl
                        unstyled
                        ariaLabel="Camera move mode"
                        value={activeCameraBlock.mode}
                        onChange={mode => updateCameraBlock(activeCameraBlock.id, cb => ({ ...cb, mode }))}
                        className="grid grid-cols-3 gap-1 bg-[#161619] p-1 rounded-xl border border-white/[0.06]"
                        buttonClassName={(_, selected) => `py-1.5 rounded-lg text-[11px] font-medium cursor-pointer transition ${selected ? 'bg-[#2a2a30] text-white border border-white/15 shadow' : 'text-[#a1a1aa] hover:text-white'}`}
                        options={[{ value: 'dolly', label: 'Dolly' }, { value: 'zoom', label: 'Zoom' }, { value: 'dollyzoom', label: 'Warp' }]}
                    />
                </div>
            </div>

            {/* 4. SHAKE SECTION: Amount [From 0%] [To 0%] [Speed 1.0x] */}
            <div className="p-3.5 space-y-2.5">
                <span className="text-[11px] font-medium text-[#e4e4e7] block">
                    Shake
                </span>
                <InspectorRow
                    unstyled
                    className="space-y-1.5"
                    labelTag="span"
                    labelClassName="text-[10px] text-[#a1a1aa] block font-medium"
                    label={<>Amount</>}
                >
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
                </InspectorRow>
            </div>

            {/* 5. TIMING SECTION: Start & length + Easing */}
            <div className="p-3.5 space-y-3">
                <span className="text-[11px] font-medium text-[#e4e4e7] block">
                    Timing
                </span>

                <InspectorRow
                    unstyled
                    className="space-y-1.5"
                    labelTag="span"
                    labelClassName="text-[10px] text-[#a1a1aa] block"
                    label={<>Start &amp; length</>}
                >
                    <AnimationTimingFields
                        className="grid grid-cols-2 gap-1.5"
                        start={{"label": "Start", "value": activeCameraBlock.startMs, "min": 0, "max": 30000, "step": 50, "unit": "ms", "onChange": (startMs) =>
                        updateCameraBlock(activeCameraBlock.id, (cb) => ({
                            ...cb,
                            startMs,
                        }))}}
                        duration={{"label": "Length", "value": activeCameraBlock.durationMs, "min": 100, "max": 10000, "step": 50, "unit": "ms", "onChange": (durationMs) =>
                        updateCameraBlock(activeCameraBlock.id, (cb) => ({
                            ...cb,
                            durationMs,
                        }))}}
                    />
                </InspectorRow>

                <InspectorRow
                    unstyled
                    className="space-y-1.5"
                    labelTag="span"
                    labelClassName="text-[10px] text-[#a1a1aa] block"
                    label={<>Easing</>}
                >
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
                </InspectorRow>
            </div>
        </div>
    );
};
