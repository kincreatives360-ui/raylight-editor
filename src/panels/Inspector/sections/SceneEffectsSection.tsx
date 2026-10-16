// src/panels/Inspector/sections/SceneEffectsSection.tsx
import React from 'react';
import type { Shot, EffectKey } from '../../../model/types';
import { useProjectStore } from '../../../store/useProjectStore';
import { ScrubInput } from '../../../ui/ScrubInput';

interface SceneEffectsSectionProps {
    activeShot: Shot;
}

export const SceneEffectsSection: React.FC<SceneEffectsSectionProps> = ({
    activeShot,
}) => {
    const { updateShot } = useProjectStore();
    const eff = activeShot.effects;

    const toggleEffect = (key: EffectKey, enabled: boolean) => {
        updateShot(activeShot.id, (s) => ({
            ...s,
            effects: {
                ...s.effects,
                [key]: { ...s.effects[key], enabled },
            },
        }));
    };

    const patchEffect = (key: EffectKey, patch: Record<string, unknown>) => {
        updateShot(activeShot.id, (s) => ({
            ...s,
            effects: {
                ...s.effects,
                [key]: { ...s.effects[key], ...patch },
            },
        }));
    };

    return (
        <div className="p-3.5 space-y-3">
            <div className="text-[11px] font-medium text-[#e4e4e7]">
                Scene Effects
            </div>

            {/* Depth of Field */}
            <div className="space-y-2 p-2.5 rounded-xl bg-[#141418] border border-white/[0.05]">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] text-[#d4d4d8]">Depth of field</span>
                    <input
                        type="checkbox"
                        checked={eff.depthOfField.enabled}
                        onChange={(e) => toggleEffect('depthOfField', e.target.checked)}
                        className="accent-[#0088ff] cursor-pointer"
                    />
                </div>
                {eff.depthOfField.enabled && (
                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                        <ScrubInput
                            label="Focus Z"
                            value={Math.round(eff.depthOfField.target.z * 500)}
                            min={-1000}
                            max={1000}
                            step={10}
                            onChange={(zScaled) =>
                                patchEffect('depthOfField', {
                                    target: {
                                        ...eff.depthOfField.target,
                                        z: Number((zScaled / 500).toFixed(3)),
                                    },
                                })
                            }
                        />
                        <ScrubInput
                            label="Bokeh"
                            value={eff.depthOfField.bokehScale}
                            min={0}
                            max={15}
                            step={0.5}
                            decimals={1}
                            onChange={(bokehScale) =>
                                patchEffect('depthOfField', { bokehScale })
                            }
                        />
                    </div>
                )}
            </div>

            {/* Bloom & Film Grain */}
            <div className="space-y-2 p-2.5 rounded-xl bg-[#141418] border border-white/[0.05]">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] text-[#d4d4d8]">Bloom &amp; Grain</span>
                    <div className="flex items-center gap-2">
                        <label className="text-[10px] text-[#a1a1aa] flex items-center gap-1 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={eff.bloom.enabled}
                                onChange={(e) => toggleEffect('bloom', e.target.checked)}
                                className="accent-[#0088ff]"
                            />
                            Bloom
                        </label>
                        <label className="text-[10px] text-[#a1a1aa] flex items-center gap-1 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={eff.filmGrain.enabled}
                                onChange={(e) => toggleEffect('filmGrain', e.target.checked)}
                                className="accent-[#0088ff]"
                            />
                            Grain
                        </label>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <ScrubInput
                        label="Bloom"
                        value={Math.round(eff.bloom.intensity * 100)}
                        min={0}
                        max={200}
                        step={5}
                        unit="%"
                        onChange={(pct) =>
                            patchEffect('bloom', {
                                enabled: pct > 0,
                                intensity: Number((pct / 100).toFixed(2)),
                            })
                        }
                    />
                    <ScrubInput
                        label="Grain"
                        value={Math.round(eff.filmGrain.intensity * 1000)}
                        min={0}
                        max={150}
                        step={5}
                        onChange={(val) =>
                            patchEffect('filmGrain', {
                                enabled: val > 0,
                                intensity: Number((val / 1000).toFixed(3)),
                            })
                        }
                    />
                </div>
            </div>

            {/* Vignette & Color Grade */}
            <div className="space-y-2 p-2.5 rounded-xl bg-[#141418] border border-white/[0.05]">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] text-[#d4d4d8]">
                        Vignette &amp; Grade
                    </span>
                    <input
                        type="checkbox"
                        checked={eff.colorGrade.enabled}
                        onChange={(e) => toggleEffect('colorGrade', e.target.checked)}
                        className="accent-[#0088ff] cursor-pointer"
                    />
                </div>
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <ScrubInput
                        label="Vignette"
                        value={Math.round(eff.vignette.intensity * 100)}
                        min={0}
                        max={100}
                        step={2}
                        unit="%"
                        onChange={(pct) =>
                            patchEffect('vignette', {
                                enabled: pct > 0,
                                intensity: Number((pct / 100).toFixed(2)),
                            })
                        }
                    />
                    <ScrubInput
                        label="Exposure"
                        value={eff.colorGrade.exposure}
                        min={0.5}
                        max={1.8}
                        step={0.02}
                        decimals={2}
                        onChange={(exposure) => patchEffect('colorGrade', { exposure })}
                    />
                </div>
            </div>
        </div>
    );
};