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

            {/* Quick Effect Presets Bar */}
            <div className="space-y-1.5 p-2 rounded-xl bg-[#141418] border border-white/[0.05]">
                <span className="text-[10px] text-[#a1a1aa] font-medium block">Curated Style Presets</span>
                <div className="grid grid-cols-3 gap-1">
                    {[
                        {
                            id: 'neutral',
                            name: 'Neutral Clean',
                            apply: () => updateShot(activeShot.id, (s) => ({
                                ...s,
                                effects: {
                                    ...s.effects,
                                    depthOfField: { ...s.effects.depthOfField, enabled: false },
                                    bloom: { ...s.effects.bloom, enabled: false },
                                    vignette: { ...s.effects.vignette, enabled: false },
                                    filmGrain: { ...s.effects.filmGrain, enabled: false },
                                    chromaticAberration: { ...s.effects.chromaticAberration, enabled: false },
                                    glitch: { ...s.effects.glitch, enabled: false },
                                },
                            })),
                        },
                        {
                            id: 'cinema',
                            name: 'Cinema 2.39',
                            apply: () => updateShot(activeShot.id, (s) => ({
                                ...s,
                                effects: {
                                    ...s.effects,
                                    depthOfField: { ...s.effects.depthOfField, enabled: true, aperture: 2.8, bokehScale: 5, bokehShape: 'anamorphic' },
                                    bloom: { ...s.effects.bloom, enabled: true, intensity: 0.4 },
                                    vignette: { ...s.effects.vignette, enabled: true, intensity: 0.35 },
                                    chromaticAberration: { ...s.effects.chromaticAberration, enabled: true, offset: 0.003 },
                                    filmGrain: { ...s.effects.filmGrain, enabled: true, intensity: 0.02 },
                                },
                            })),
                        },
                        {
                            id: 'dreamy',
                            name: 'Dreamy Glow',
                            apply: () => updateShot(activeShot.id, (s) => ({
                                ...s,
                                effects: {
                                    ...s.effects,
                                    depthOfField: { ...s.effects.depthOfField, enabled: true, aperture: 1.8, bokehScale: 7 },
                                    bloom: { ...s.effects.bloom, enabled: true, intensity: 0.75, threshold: 0.6 },
                                    vignette: { ...s.effects.vignette, enabled: true, intensity: 0.25 },
                                    filmGrain: { ...s.effects.filmGrain, enabled: false },
                                },
                            })),
                        },
                        {
                            id: 'cyber',
                            name: 'Cyberpunk',
                            apply: () => updateShot(activeShot.id, (s) => ({
                                ...s,
                                effects: {
                                    ...s.effects,
                                    glitch: { ...s.effects.glitch, enabled: true, intensity: 0.35 },
                                    chromaticAberration: { ...s.effects.chromaticAberration, enabled: true, offset: 0.006 },
                                    bloom: { ...s.effects.bloom, enabled: true, intensity: 0.6 },
                                    vignette: { ...s.effects.vignette, enabled: true, intensity: 0.4 },
                                    filmGrain: { ...s.effects.filmGrain, enabled: true, intensity: 0.04 },
                                },
                            })),
                        },
                        {
                            id: 'noir',
                            name: 'Noir Film',
                            apply: () => updateShot(activeShot.id, (s) => ({
                                ...s,
                                effects: {
                                    ...s.effects,
                                    colorGrade: { ...s.effects.colorGrade, enabled: true, contrast: 1.25, saturation: 0 },
                                    vignette: { ...s.effects.vignette, enabled: true, intensity: 0.55 },
                                    filmGrain: { ...s.effects.filmGrain, enabled: true, intensity: 0.06 },
                                    bloom: { ...s.effects.bloom, enabled: false },
                                },
                            })),
                        },
                        {
                            id: 'vhs',
                            name: 'Vintage VHS',
                            apply: () => updateShot(activeShot.id, (s) => ({
                                ...s,
                                effects: {
                                    ...s.effects,
                                    chromaticAberration: { ...s.effects.chromaticAberration, enabled: true, offset: 0.005 },
                                    filmGrain: { ...s.effects.filmGrain, enabled: true, intensity: 0.05 },
                                    vignette: { ...s.effects.vignette, enabled: true, intensity: 0.3 },
                                    colorGrade: { ...s.effects.colorGrade, enabled: true, contrast: 1.12, warmth: 0.2 },
                                },
                            })),
                        },
                    ].map((preset) => (
                        <button
                            key={preset.id}
                            type="button"
                            onClick={preset.apply}
                            className="px-2 py-1.5 rounded-lg bg-[#18181b] hover:bg-[#27272a] hover:text-white text-[#d4d4d8] border border-white/5 text-[10px] font-medium transition cursor-pointer text-center truncate"
                        >
                            {preset.name}
                        </button>
                    ))}
                </div>
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