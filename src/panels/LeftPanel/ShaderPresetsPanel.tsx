import React from 'react';
import { SHADER_PRESETS, SHADER_PRESET_METADATA, DEFAULT_SHADER_CONFIGS } from '../../model/backgroundPresets';
import { useProjectStore } from '../../store/useProjectStore';

interface ShaderPresetsPanelProps {
    assetCategory: 'shaders';
}

export const ShaderPresetsPanel: React.FC<ShaderPresetsPanelProps> = ({ assetCategory }) => {
    const updateProject = useProjectStore((state) => state.updateProject);

    return (
        <>                    {assetCategory === 'shaders' && (
                        <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
                            <div className="text-[10px] text-[#71717a] px-0.5 flex justify-between items-center">
                                <span>Animated Shader Presets</span>
                                <span>{SHADER_PRESETS.length} presets</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                {SHADER_PRESETS.map((p) => {
                                    const meta = SHADER_PRESET_METADATA[p];
                                    const cfg = DEFAULT_SHADER_CONFIGS[p];
                                    const pColors = cfg?.colors?.length ? cfg.colors : [cfg?.color || '#3b82f6', cfg?.backgroundColor || '#05050a'];
                                    const c1 = pColors[0];
                                    const c2 = pColors[1] || pColors[0];

                                    return (
                                        <button
                                            key={p}
                                            type="button"
                                            onClick={() => {
                                                updateProject((proj) => ({
                                                    ...proj,
                                                    background: {
                                                        kind: 'shader',
                                                        preset: p,
                                                        color: c1,
                                                        backgroundColor: c2,
                                                        color1: c1,
                                                        color2: c2,
                                                        color3: pColors[2] || '#06b6d4',
                                                        colors: pColors,
                                                        speed: cfg?.speed ?? 1,
                                                        waves: cfg?.waves ?? 1,
                                                        noiseScale: cfg?.waves ?? 1,
                                                        focus: cfg?.focus ?? 1,
                                                        glow: cfg?.glow ?? 1,
                                                        shine: cfg?.shine ?? 1,
                                                        angle: cfg?.angle ?? 28,
                                                    },
                                                }));
                                            }}
                                            className="p-2 rounded-xl bg-surface hover:bg-subtle border border-subtle hover:border-brand-blue text-left transition cursor-pointer flex flex-col gap-1.5 group shadow-xs"
                                        >
                                            <div
                                                className="w-full h-12 rounded-lg border border-subtle relative overflow-hidden group-hover:scale-105 transition-transform"
                                                style={{
                                                    background: `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`,
                                                }}
                                            />
                                            <div>
                                                <div className="text-[11px] font-semibold text-foreground truncate group-hover:text-brand-blue transition-colors">
                                                    {meta?.label || p}
                                                </div>
                                                <div className="text-[10px] text-disabled truncate">
                                                    Procedural GLSL
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}        </>
    );
};
