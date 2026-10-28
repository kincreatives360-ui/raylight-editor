// src/panels/Inspector/sections/LightBlockInspector.tsx
import React, { useState } from 'react';
import {
    ChevronDown,
    ChevronUp,
    Sparkles,
    Trash2,
    X,
} from 'lucide-react';
import type { LightAnimationBlock } from '../../../model/types';
import { useProjectStore } from '../../../store/useProjectStore';
import { EasingControl } from '../../../ui/EasingControl';
import { ScrubInput } from '../../../ui/ScrubInput';

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
    const [timingCollapsed, setTimingCollapsed] = useState(false);
    const [posCollapsed, setPosCollapsed] = useState(false);
    const [intensityCollapsed, setIntensityCollapsed] = useState(false);
    const [tempCollapsed, setTempCollapsed] = useState(false);

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

    const blockProperty = activeLightBlock.property;
    const isRoomAnimation = activeLightBlock.targetLightId === 'room';

    return (
        <div data-testid="light-block-inspector" className="flex-1 overflow-y-auto divide-y divide-white/[0.06]">
            {/* Header: Title + Done Button */}
            <div className="p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded bg-[#f59e0b]/15 flex items-center justify-center text-[#f59e0b]">
                        <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <div>
                        <span className="text-[12px] font-semibold text-white tracking-wide block">
                            {activeLightBlock.label || 'Light Animation'}
                        </span>
                        <span className="text-[10px] text-[#a1a1aa] font-mono">
                            Target: {activeLightBlock.targetLightId ?? 'key'}
                        </span>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onDone}
                    title="Done"
                    className="w-6 h-6 rounded-md hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white transition cursor-pointer"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Timing Section */}
            <div className="p-3.5 space-y-3">
                <button
                    type="button"
                    onClick={() => setTimingCollapsed(!timingCollapsed)}
                    className="flex items-center justify-between cursor-pointer w-full text-left"
                >
                    <span className="text-[11px] font-medium text-[#e4e4e7]">Timing</span>
                    {timingCollapsed ? (
                        <ChevronDown className="w-3.5 h-3.5 text-[#a1a1aa]" />
                    ) : (
                        <ChevronUp className="w-3.5 h-3.5 text-[#a1a1aa]" />
                    )}
                </button>
                {!timingCollapsed && (
                    <div className="grid grid-cols-2 gap-2">
                        <ScrubInput
                            label="Start"
                            value={activeLightBlock.startMs}
                            min={0}
                            step={50}
                            decimals={0}
                            onChange={(val) => updateBlock((lb) => ({ ...lb, startMs: Math.max(0, val) }))}
                        />
                        <ScrubInput
                            label="Duration"
                            value={activeLightBlock.durationMs}
                            min={50}
                            step={50}
                            decimals={0}
                            onChange={(val) => updateBlock((lb) => ({ ...lb, durationMs: Math.max(50, val) }))}
                        />
                    </div>
                )}
            </div>

            {/* Position Section: From & To */}
            {(!blockProperty || blockProperty === 'position') && <div className="p-3.5 space-y-3">
                <button
                    type="button"
                    onClick={() => setPosCollapsed(!posCollapsed)}
                    className="flex items-center justify-between cursor-pointer w-full text-left"
                >
                    <span className="text-[11px] font-medium text-[#e4e4e7]">Position</span>
                    {posCollapsed ? (
                        <ChevronDown className="w-3.5 h-3.5 text-[#a1a1aa]" />
                    ) : (
                        <ChevronUp className="w-3.5 h-3.5 text-[#a1a1aa]" />
                    )}
                </button>
                {!posCollapsed && (
                    <div className="space-y-2">
                        <span className="text-[10px] text-[#a1a1aa] font-mono">From (X, Y, Z)</span>
                        <div className="grid grid-cols-3 gap-2">
                            <ScrubInput
                                label="From X"
                                value={activeLightBlock.fromX}
                                step={0.05}
                                decimals={2}
                                onChange={(val) => updateBlock((lb) => ({ ...lb, fromX: val }))}
                            />
                            <ScrubInput
                                label="From Y"
                                value={activeLightBlock.fromY}
                                step={0.05}
                                decimals={2}
                                onChange={(val) => updateBlock((lb) => ({ ...lb, fromY: val }))}
                            />
                            <ScrubInput
                                label="From Z"
                                value={activeLightBlock.fromZ ?? 1.0}
                                step={0.05}
                                decimals={2}
                                onChange={(val) => updateBlock((lb) => ({ ...lb, fromZ: val }))}
                            />
                        </div>

                        <span className="text-[10px] text-[#a1a1aa] font-mono">To (X, Y, Z)</span>
                        <div className="grid grid-cols-3 gap-2">
                            <ScrubInput
                                label="To X"
                                value={activeLightBlock.toX}
                                step={0.05}
                                decimals={2}
                                onChange={(val) => updateBlock((lb) => ({ ...lb, toX: val }))}
                            />
                            <ScrubInput
                                label="To Y"
                                value={activeLightBlock.toY}
                                step={0.05}
                                decimals={2}
                                onChange={(val) => updateBlock((lb) => ({ ...lb, toY: val }))}
                            />
                            <ScrubInput
                                label="To Z"
                                value={activeLightBlock.toZ ?? 1.0}
                                step={0.05}
                                decimals={2}
                                onChange={(val) => updateBlock((lb) => ({ ...lb, toZ: val }))}
                            />
                        </div>
                    </div>
                )}
            </div>}

            {/* Intensity Section: From & To */}
            {(!blockProperty || blockProperty === 'intensity' || blockProperty === 'ambience') && <div className="p-3.5 space-y-3">
                <button
                    type="button"
                    onClick={() => setIntensityCollapsed(!intensityCollapsed)}
                    className="flex items-center justify-between cursor-pointer w-full text-left"
                >
                    <span className="text-[11px] font-medium text-[#e4e4e7]">{isRoomAnimation ? 'Ambience' : 'Intensity'}</span>
                    {intensityCollapsed ? (
                        <ChevronDown className="w-3.5 h-3.5 text-[#a1a1aa]" />
                    ) : (
                        <ChevronUp className="w-3.5 h-3.5 text-[#a1a1aa]" />
                    )}
                </button>
                {!intensityCollapsed && (
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
                )}
            </div>}

            {/* Temperature Section */}
            {(!blockProperty || blockProperty === 'temperature') && <div className="p-3.5 space-y-3">
                <button
                    type="button"
                    onClick={() => setTempCollapsed(!tempCollapsed)}
                    className="flex items-center justify-between cursor-pointer w-full text-left"
                >
                    <span className="text-[11px] font-medium text-[#e4e4e7]">Temperature</span>
                    {tempCollapsed ? (
                        <ChevronDown className="w-3.5 h-3.5 text-[#a1a1aa]" />
                    ) : (
                        <ChevronUp className="w-3.5 h-3.5 text-[#a1a1aa]" />
                    )}
                </button>
                {!tempCollapsed && (
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
                )}
            </div>}

            {/* Easing Selection */}
            <div className="p-3.5 space-y-2">
                <span className="text-[11px] font-medium text-[#e4e4e7]">Transition Curve</span>
                <EasingControl
                    value={activeLightBlock.easing}
                    onChange={(easing) => updateBlock((lb) => ({ ...lb, easing }))}
                    selectAriaLabel="Transition curve"
                    selectClassName="flex-1 h-8 px-2.5 rounded-lg bg-[#1c1c1f] border border-white/10 text-[11px] text-white outline-none cursor-pointer hover:border-white/20 transition"
                    showCurvePreview
                    showInlineTuning
                />
            </div>

            {/* Delete Block */}
            <div className="p-3.5">
                <button
                    type="button"
                    onClick={handleDelete}
                    className="w-full py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 font-medium text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Block</span>
                </button>
            </div>
        </div>
    );
};
