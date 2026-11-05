// src/panels/Inspector/sections/LightBlockInspector.tsx
import React, { useState } from 'react';
import {
    Sparkles,
    Trash2,
    X,
    Wand2,
} from 'lucide-react';
import type { LightAnimationBlock } from '../../../model/types';
import { useProjectStore } from '../../../store/useProjectStore';
import { EasingControl } from '../../../ui/EasingControl';
import { ScrubInput } from '../../../ui/ScrubInput';
import { IconButton } from '../../../ui/primitives';
import { InspectorDisclosure } from '../../../ui/InspectorDisclosure';
import { AnimationTimingFields } from '../../../ui/AnimationTimingFields';
import { AxisFields } from '../../../ui/AxisFields';
import { LIGHT_ANIMATION_PRESETS, applyLightAnimationPreset } from '../../../engine/lightingSystem';

interface LightBlockInspectorProps {
    activeShotId: string;
    activeLightBlock: LightAnimationBlock;
    onDone: () => void;
}

export const LightBlockInspector: React.FC<LightBlockInspectorProps> = ({
    activeShotId,
    activeLightBlock,
    onDone,
}) => {
    const { updateShot } = useProjectStore();
    const [timingOpen, setTimingOpen] = useState(true);
    const [positionOpen, setPositionOpen] = useState(true);
    const [intensityOpen, setIntensityOpen] = useState(true);
    const [temperatureOpen, setTemperatureOpen] = useState(true);
    const [presetsOpen, setPresetsOpen] = useState(false);

    const updateBlock = (updater: (lb: LightAnimationBlock) => LightAnimationBlock) => {
        updateShot(activeShotId, (s) => ({
            ...s,
            lightBlocks: (s.lightBlocks || []).map((lb) =>
                lb.id === activeLightBlock.id ? updater(lb) : lb
            ),
        }));
    };

    const handleDelete = () => {
        updateShot(activeShotId, (s) => ({
            ...s,
            lightBlocks: (s.lightBlocks || []).filter((lb) => lb.id !== activeLightBlock.id),
        }));
        onDone();
    };

    const handleApplyPreset = (presetId: string) => {
        updateBlock((block) => applyLightAnimationPreset(block, presetId));
    };

    const blockProperty = activeLightBlock.property;
    const isRoomAnimation = activeLightBlock.targetLightId === 'room';

    return (
        <div data-testid="light-block-inspector" className="flex-1 overflow-y-auto divide-y divide-white/[0.06]">
            {/* Header: Title + Done Button */}
            <div className="p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="w-5 h-5 rounded bg-amber-500/15 flex items-center justify-center text-amber-400 shrink-0">
                        <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                        <span className="text-[12px] font-semibold text-white tracking-wide block truncate">
                            {activeLightBlock.label || 'Light Animation'}
                        </span>
                        <span className="text-[11px] text-muted-foreground font-mono tabular-nums">
                            Target: {activeLightBlock.targetLightId ?? 'key'}
                        </span>
                    </div>
                </div>
                <IconButton
                    unstyled
                    tooltip={false}
                    label="Done"
                    onClick={onDone}
                    title="Done"
                    className="w-6 h-6 rounded-md hover:bg-subtle flex items-center justify-center text-muted-foreground hover:text-foreground transition cursor-pointer"
                    icon={<X className="w-3.5 h-3.5" />}
                />
            </div>

            {/* Movement Presets (Beyond Parity) */}
            {!isRoomAnimation && (
                <InspectorDisclosure
                    title={
                        <span className="flex items-center gap-1.5 text-sky-400">
                            <Wand2 className="w-3.5 h-3.5" />
                            <span>Movement Presets</span>
                        </span>
                    }
                    open={presetsOpen}
                    onOpenChange={setPresetsOpen}
                    defaultOpen={false}
                >
                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                        {LIGHT_ANIMATION_PRESETS.map((preset) => (
                            <button
                                key={preset.id}
                                type="button"
                                onClick={() => handleApplyPreset(preset.id)}
                                title={preset.description}
                                className="p-2 text-left rounded-lg bg-surface-elevated/70 hover:bg-surface-elevated border border-border/50 hover:border-sky-500/40 text-foreground transition group cursor-pointer"
                            >
                                <span className="text-[11px] font-medium block text-white group-hover:text-sky-300">
                                    {preset.label}
                                </span>
                                <span className="text-[9px] text-muted-foreground line-clamp-1">
                                    {preset.description}
                                </span>
                            </button>
                        ))}
                    </div>
                </InspectorDisclosure>
            )}

            {/* Timing Section */}
            <InspectorDisclosure
                title="Timing"
                open={timingOpen}
                onOpenChange={setTimingOpen}
            >
                <AnimationTimingFields
                    start={{
                        label: "Start",
                        value: activeLightBlock.startMs,
                        min: 0,
                        step: 50,
                        decimals: 0,
                        onChange: (val) => updateBlock((lb) => ({ ...lb, startMs: Math.max(0, val) })),
                    }}
                    duration={{
                        label: "Duration",
                        value: activeLightBlock.durationMs,
                        min: 50,
                        step: 50,
                        decimals: 0,
                        onChange: (val) => updateBlock((lb) => ({ ...lb, durationMs: Math.max(50, val) })),
                    }}
                />
            </InspectorDisclosure>

            {/* Position Section: From & To */}
            {(!blockProperty || blockProperty === 'position') && (
                <InspectorDisclosure
                    title="Position"
                    open={positionOpen}
                    onOpenChange={setPositionOpen}
                >
                    <div className="space-y-2">
                        <span className="text-[10px] text-muted-foreground font-mono">From (X, Y, Z)</span>
                        <AxisFields
                            fields={[
                                { key: "0", label: "From X", value: activeLightBlock.fromX, step: 0.05, decimals: 2, onChange: (val) => updateBlock((lb) => ({ ...lb, fromX: val })) },
                                { key: "1", label: "From Y", value: activeLightBlock.fromY, step: 0.05, decimals: 2, onChange: (val) => updateBlock((lb) => ({ ...lb, fromY: val })) },
                                { key: "2", label: "From Z", value: activeLightBlock.fromZ ?? 1.0, step: 0.05, decimals: 2, onChange: (val) => updateBlock((lb) => ({ ...lb, fromZ: val })) }
                            ]}
                        />

                        <span className="text-[10px] text-muted-foreground font-mono">To (X, Y, Z)</span>
                        <AxisFields
                            fields={[
                                { key: "0", label: "To X", value: activeLightBlock.toX, step: 0.05, decimals: 2, onChange: (val) => updateBlock((lb) => ({ ...lb, toX: val })) },
                                { key: "1", label: "To Y", value: activeLightBlock.toY, step: 0.05, decimals: 2, onChange: (val) => updateBlock((lb) => ({ ...lb, toY: val })) },
                                { key: "2", label: "To Z", value: activeLightBlock.toZ ?? 1.0, step: 0.05, decimals: 2, onChange: (val) => updateBlock((lb) => ({ ...lb, toZ: val })) }
                            ]}
                        />
                    </div>
                </InspectorDisclosure>
            )}

            {/* Intensity Section: From & To */}
            {(!blockProperty || blockProperty === 'intensity' || blockProperty === 'ambience') && (
                <InspectorDisclosure
                    title={isRoomAnimation ? 'Ambience' : 'Intensity'}
                    open={intensityOpen}
                    onOpenChange={setIntensityOpen}
                >
                    <div className="grid grid-cols-2 gap-2">
                        <ScrubInput
                            label={isRoomAnimation ? 'From' : 'From Int'}
                            value={activeLightBlock.fromIntensity}
                            min={0}
                            max={isRoomAnimation ? 1 : 10}
                            step={0.1}
                            decimals={2}
                            onChange={(val) => updateBlock((lb) => ({ ...lb, fromIntensity: Math.max(0, val) }))}
                        />
                        <ScrubInput
                            label={isRoomAnimation ? 'To' : 'To Int'}
                            value={activeLightBlock.toIntensity}
                            min={0}
                            max={isRoomAnimation ? 1 : 10}
                            step={0.1}
                            decimals={2}
                            onChange={(val) => updateBlock((lb) => ({ ...lb, toIntensity: Math.max(0, val) }))}
                        />
                    </div>
                </InspectorDisclosure>
            )}

            {/* Temperature Section */}
            {(!blockProperty || blockProperty === 'temperature') && (
                <InspectorDisclosure
                    title="Temperature"
                    open={temperatureOpen}
                    onOpenChange={setTemperatureOpen}
                >
                    <div className="grid grid-cols-2 gap-2">
                        <ScrubInput
                            label="From Temp"
                            value={activeLightBlock.fromTemperature ?? 6500}
                            min={2000}
                            max={10000}
                            step={100}
                            decimals={0}
                            onChange={(val) => updateBlock((lb) => ({ ...lb, fromTemperature: val }))}
                        />
                        <ScrubInput
                            label="To Temp"
                            value={activeLightBlock.toTemperature ?? 6500}
                            min={2000}
                            max={10000}
                            step={100}
                            decimals={0}
                            onChange={(val) => updateBlock((lb) => ({ ...lb, toTemperature: val }))}
                        />
                    </div>
                </InspectorDisclosure>
            )}

            {/* Easing Selection */}
            <div className="p-3.5 space-y-2">
                <span className="text-[11px] font-medium text-foreground">Transition Curve</span>
                <EasingControl
                    value={activeLightBlock.easing}
                    onChange={(easing) => updateBlock((lb) => ({ ...lb, easing }))}
                    selectAriaLabel="Transition curve"
                    selectClassName="flex-1 h-8 px-2.5 rounded-lg bg-surface-elevated border border-border/80 text-[11px] text-foreground outline-none cursor-pointer hover:border-border transition"
                    showCurvePreview
                    showInlineTuning
                />
            </div>

            {/* Delete Block */}
            <div className="p-3.5">
                <button
                    type="button"
                    onClick={handleDelete}
                    className="w-full py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 font-medium text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Block</span>
                </button>
            </div>
        </div>
    );
};
