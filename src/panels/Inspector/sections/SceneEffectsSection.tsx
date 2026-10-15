// src/panels/Inspector/sections/SceneEffectsSection.tsx
import React, { useState } from 'react';
import {
    Sparkles,
    ChevronDown,
    ChevronRight,
    Eye,
    EyeOff,
    Sliders,
    Camera,
    Sun,
    Film,
} from 'lucide-react';
import type { Shot, EffectKey, Effects } from '../../../model/types';
import { useProjectStore } from '../../../store/useProjectStore';
import { ScrubInput } from '../../../ui/ScrubInput';

interface SceneEffectsSectionProps {
    activeShot: Shot;
}

export const SceneEffectsSection: React.FC<SceneEffectsSectionProps> = ({ activeShot }) => {
    const { updateShot } = useProjectStore();
    const [expandedEffect, setExpandedEffect] = useState<string | null>(null);

    const toggleEffect = (key: EffectKey, e: React.MouseEvent) => {
        e.stopPropagation();
        updateShot(activeShot.id, (s) => ({
            ...s,
            effects: {
                ...s.effects,
                [key]: {
                    ...s.effects[key],
                    enabled: !s.effects[key].enabled,
                },
            },
        }));
    };

    const updateEffectParam = <K extends EffectKey>(
        key: K,
        patch: Partial<Effects[K]>
    ) => {
        updateShot(activeShot.id, (s) => ({
            ...s,
            effects: {
                ...s.effects,
                [key]: { ...s.effects[key], ...patch },
            },
        }));
    };

    const eff = activeShot.effects;

    const effectList: {
        key: EffectKey;
        name: string;
        icon: React.ReactNode;
        enabled: boolean;
    }[] = [
        {
            key: 'depthOfField',
            name: 'Depth of field',
            icon: <Camera className="w-3.5 h-3.5 text-indigo-400" />,
            enabled: eff.depthOfField.enabled,
        },
        {
            key: 'bloom',
            name: 'Bloom',
            icon: <Sun className="w-3.5 h-3.5 text-amber-400" />,
            enabled: eff.bloom.enabled,
        },
        {
            key: 'vignette',
            name: 'Vignette',
            icon: <Sliders className="w-3.5 h-3.5 text-sky-400" />,
            enabled: eff.vignette.enabled,
        },
        {
            key: 'colorGrade',
            name: 'Color grade',
            icon: <Sparkles className="w-3.5 h-3.5 text-emerald-400" />,
            enabled: eff.colorGrade.enabled,
        },
        {
            key: 'chromaticAberration',
            name: 'Color split',
            icon: <Sliders className="w-3.5 h-3.5 text-fuchsia-400" />,
            enabled: eff.chromaticAberration.enabled,
        },
        {
            key: 'edgeFade',
            name: 'Edge fade',
            icon: <Film className="w-3.5 h-3.5 text-rose-400" />,
            enabled: eff.edgeFade.enabled,
        },
        {
            key: 'filmGrain',
            name: 'Film grain',
            icon: <Film className="w-3.5 h-3.5 text-zinc-400" />,
            enabled: !!eff.filmGrain?.enabled,
        },
    ];

    return (
        <div className="p-3.5 space-y-2">
            <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-[#e4e4e7]">
                    Scene effects
                </span>
                <span className="text-[10px] text-[#71717a]">
                    {effectList.filter((e) => e.enabled).length} active
                </span>
            </div>

            <div className="space-y-1.5 pt-0.5">
                {effectList.map(({ key, name, icon, enabled }) => {
                    const isExpanded = expandedEffect === key;

                    return (
                        <div
                            key={key}
                            className={`rounded-lg border transition ${
                                enabled
                                    ? 'bg-[#161619] border-white/[0.08]'
                                    : 'bg-[#121215]/50 border-white/[0.04]'
                            }`}
                        >
                            {/* Effect Row Header */}
                            <div
                                onClick={() =>
                                    setExpandedEffect(isExpanded ? null : key)
                                }
                                className="h-8 px-2.5 flex items-center justify-between cursor-pointer group"
                            >
                                <div className="flex items-center gap-2">
                                    {isExpanded ? (
                                        <ChevronDown className="w-3 h-3 text-[#71717a]" />
                                    ) : (
                                        <ChevronRight className="w-3 h-3 text-[#71717a]" />
                                    )}
                                    <span className="shrink-0">{icon}</span>
                                    <span
                                        className={`text-[11px] font-medium transition ${
                                            enabled
                                                ? 'text-[#e4e4e7]'
                                                : 'text-[#71717a] group-hover:text-[#a1a1aa]'
                                        }`}
                                    >
                                        {name}
                                    </span>
                                </div>

                                <div className="flex items-center gap-1.5">
                                    <button
                                        type="button"
                                        onClick={(e) => toggleEffect(key, e)}
                                        title={enabled ? 'Disable' : 'Enable'}
                                        className={`p-1 rounded cursor-pointer transition ${
                                            enabled
                                                ? 'text-[#0088ff] hover:bg-white/10'
                                                : 'text-[#52525b] hover:text-[#a1a1aa]'
                                        }`}
                                    >
                                        {enabled ? (
                                            <Eye className="w-3.5 h-3.5" />
                                        ) : (
                                            <EyeOff className="w-3.5 h-3.5" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Effect Expanded Sub-Panel */}
                            {isExpanded && (
                                <div className="px-2.5 pb-2.5 pt-1 border-t border-white/[0.04] space-y-2">
                                    {key === 'depthOfField' && (
                                        <div className="space-y-2 pt-1">
                                            <div className="grid grid-cols-2 gap-1.5">
                                                <ScrubInput
                                                    label="F-Stop"
                                                    value={eff.depthOfField.aperture}
                                                    min={1.0}
                                                    max={22.0}
                                                    step={0.2}
                                                    decimals={1}
                                                    unit="ƒ"
                                                    onChange={(aperture) =>
                                                        updateEffectParam('depthOfField', { aperture })
                                                    }
                                                />
                                                <ScrubInput
                                                    label="Bokeh"
                                                    value={eff.depthOfField.bokehScale}
                                                    min={0}
                                                    max={10}
                                                    step={0.5}
                                                    decimals={1}
                                                    onChange={(bokehScale) =>
                                                        updateEffectParam('depthOfField', { bokehScale })
                                                    }
                                                />
                                            </div>
                                            <ScrubInput
                                                label="Focus Range"
                                                value={eff.depthOfField.focusRange}
                                                min={0.05}
                                                max={2.0}
                                                step={0.05}
                                                decimals={2}
                                                onChange={(focusRange) =>
                                                    updateEffectParam('depthOfField', { focusRange })
                                                }
                                            />
                                        </div>
                                    )}

                                    {key === 'bloom' && (
                                        <div className="grid grid-cols-2 gap-1.5 pt-1">
                                            <ScrubInput
                                                label="Intensity"
                                                value={eff.bloom.intensity}
                                                min={0}
                                                max={3}
                                                step={0.1}
                                                decimals={2}
                                                onChange={(intensity) =>
                                                    updateEffectParam('bloom', { intensity })
                                                }
                                            />
                                            <ScrubInput
                                                label="Threshold"
                                                value={eff.bloom.threshold}
                                                min={0}
                                                max={1}
                                                step={0.05}
                                                decimals={2}
                                                onChange={(threshold) =>
                                                    updateEffectParam('bloom', { threshold })
                                                }
                                            />
                                        </div>
                                    )}

                                    {key === 'vignette' && (
                                        <div className="pt-1">
                                            <ScrubInput
                                                label="Intensity"
                                                value={eff.vignette.intensity}
                                                min={0}
                                                max={1}
                                                step={0.05}
                                                decimals={2}
                                                onChange={(intensity) =>
                                                    updateEffectParam('vignette', { intensity })
                                                }
                                            />
                                        </div>
                                    )}

                                    {key === 'colorGrade' && (
                                        <div className="space-y-1.5 pt-1">
                                            <div className="grid grid-cols-2 gap-1.5">
                                                <ScrubInput
                                                    label="Exposure"
                                                    value={eff.colorGrade.exposure}
                                                    min={0.2}
                                                    max={2.5}
                                                    step={0.05}
                                                    decimals={2}
                                                    onChange={(exposure) =>
                                                        updateEffectParam('colorGrade', { exposure })
                                                    }
                                                />
                                                <ScrubInput
                                                    label="Contrast"
                                                    value={eff.colorGrade.contrast}
                                                    min={0.5}
                                                    max={2.0}
                                                    step={0.05}
                                                    decimals={2}
                                                    onChange={(contrast) =>
                                                        updateEffectParam('colorGrade', { contrast })
                                                    }
                                                />
                                            </div>
                                            <ScrubInput
                                                label="Saturation"
                                                value={eff.colorGrade.saturation}
                                                min={0}
                                                max={3}
                                                step={0.05}
                                                decimals={2}
                                                onChange={(saturation) =>
                                                    updateEffectParam('colorGrade', { saturation })
                                                }
                                            />
                                        </div>
                                    )}

                                    {key === 'chromaticAberration' && (
                                        <div className="pt-1">
                                            <ScrubInput
                                                label="Offset (Split)"
                                                value={eff.chromaticAberration.offset}
                                                min={0}
                                                max={30}
                                                step={0.5}
                                                decimals={1}
                                                unit="px"
                                                onChange={(offset) =>
                                                    updateEffectParam('chromaticAberration', { offset })
                                                }
                                            />
                                        </div>
                                    )}

                                    {key === 'edgeFade' && (
                                        <div className="grid grid-cols-2 gap-1.5 pt-1">
                                            <ScrubInput
                                                label="Top"
                                                value={eff.edgeFade.top}
                                                min={0}
                                                max={1}
                                                step={0.05}
                                                decimals={2}
                                                onChange={(top) =>
                                                    updateEffectParam('edgeFade', { top })
                                                }
                                            />
                                            <ScrubInput
                                                label="Bottom"
                                                value={eff.edgeFade.bottom}
                                                min={0}
                                                max={1}
                                                step={0.05}
                                                decimals={2}
                                                onChange={(bottom) =>
                                                    updateEffectParam('edgeFade', { bottom })
                                                }
                                            />
                                        </div>
                                    )}

                                    {key === 'filmGrain' && (
                                        <div className="pt-1">
                                            <ScrubInput
                                                label="Grain"
                                                value={eff.filmGrain?.intensity ?? 0.02}
                                                min={0}
                                                max={0.2}
                                                step={0.01}
                                                decimals={3}
                                                onChange={(intensity) =>
                                                    updateEffectParam('filmGrain', {
                                                        intensity,
                                                        enabled: true,
                                                        size: 1.0,
                                                    })
                                                }
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
