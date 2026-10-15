// src/panels/Inspector/EffectsInspector.tsx
import React from 'react';
import {
    Sparkles,
    ArrowUp,
    ArrowDown,
    Plus,
    Trash2,
    Eye,
    Zap,
    Layers,
    Sliders,
} from 'lucide-react';
import type { Shot, EffectKey, Effects, FocusBlock, PresetEasingName } from '../../model/types';
import { useProjectStore } from '../../store/useProjectStore';
import { ScrubInput } from '../../ui/ScrubInput';

interface EffectsInspectorProps {
    activeShot: Shot;
}

export const EffectsInspector: React.FC<EffectsInspectorProps> = ({ activeShot }) => {
    const { updateShot } = useProjectStore();

    const handleToggleEffect = (key: EffectKey, enabled: boolean) => {
        updateShot(activeShot.id, (s) => ({
            ...s,
            effects: {
                ...s.effects,
                [key]: { ...s.effects[key], enabled },
            },
        }));
    };

    const handleUpdateEffectParam = <K extends EffectKey>(
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

    const moveEffectOrder = (key: EffectKey, dir: -1 | 1) => {
        updateShot(activeShot.id, (s) => {
            const idx = s.effectsOrder.indexOf(key);
            if (idx < 0) return s;
            const targetIdx = idx + dir;
            if (targetIdx < 0 || targetIdx >= s.effectsOrder.length) return s;
            const copy = [...s.effectsOrder];
            const [item] = copy.splice(idx, 1);
            copy.splice(targetIdx, 0, item);
            return { ...s, effectsOrder: copy };
        });
    };

    // Rack Focus Blocks Handlers
    const focusBlocks = activeShot.focusBlocks || [];

    const handleAddFocusBlock = () => {
        const newBlock: FocusBlock = {
            id: `focus-blk-${Date.now()}`,
            label: `Rack Focus #${focusBlocks.length + 1}`,
            startMs: 400,
            durationMs: 2000,
            fromZ: activeShot.effects.depthOfField.target.z,
            toZ: Number((activeShot.effects.depthOfField.target.z + 0.35).toFixed(2)),
            easing: { kind: 'preset', name: 'ease-in-out' },
        };
        updateShot(activeShot.id, (s) => ({
            ...s,
            focusBlocks: [...(s.focusBlocks || []), newBlock],
        }));
    };

    const updateFocusBlock = (id: string, patch: Partial<FocusBlock>) => {
        updateShot(activeShot.id, (s) => ({
            ...s,
            focusBlocks: (s.focusBlocks || []).map((fb) =>
                fb.id === id ? { ...fb, ...patch } : fb
            ),
        }));
    };

    const deleteFocusBlock = (id: string) => {
        updateShot(activeShot.id, (s) => ({
            ...s,
            focusBlocks: (s.focusBlocks || []).filter((fb) => fb.id !== id),
        }));
    };

    const dof = activeShot.effects.depthOfField;
    const bloom = activeShot.effects.bloom;
    const vignette = activeShot.effects.vignette;
    const grain = activeShot.effects.filmGrain;
    const grade = activeShot.effects.colorGrade;
    const ca = activeShot.effects.chromaticAberration;
    const mb = activeShot.effects.motionBlur;
    const ghost = activeShot.effects.ghost;
    const edgeFade = activeShot.effects.edgeFade;
    const glitch = activeShot.effects.glitch;

    return (
        <aside className="w-80 shrink-0 overflow-y-auto border-l border-white/10 bg-[#0c0e17] p-4 flex flex-col gap-4 text-xs select-none">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Sparkles className="h-4 w-4 text-purple-400" />
                <span className="truncate">Cinematic Effects Rack: {activeShot.name}</span>
            </div>

            {/* 1. Depth of Field & Bokeh + Rack Focus */}
            <div className="rounded-xl border border-white/10 bg-black/40 p-3 space-y-3">
                <div className="flex items-center justify-between font-semibold text-gray-200">
                    <span className="flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5 text-purple-400" /> Depth of Field (Bokeh)
                    </span>
                    <input
                        type="checkbox"
                        checked={dof.enabled}
                        onChange={(e) => handleToggleEffect('depthOfField', e.target.checked)}
                        className="accent-purple-500 cursor-pointer"
                    />
                </div>

                {dof.enabled && (
                    <div className="space-y-2.5 pt-1 border-t border-white/10">
                        <div className="flex items-center justify-between">
                            <span className="text-gray-400">Bokeh Lens Shape</span>
                            <select
                                value={dof.bokehShape}
                                onChange={(e) =>
                                    handleUpdateEffectParam('depthOfField', {
                                        bokehShape: e.target.value as Effects['depthOfField']['bokehShape'],
                                    })
                                }
                                className="rounded border border-white/15 bg-[#11131c] px-2 py-1 text-white text-xs outline-none cursor-pointer"
                            >
                                <option value="anamorphic">Anamorphic</option>
                                <option value="spherical">Spherical</option>
                                <option value="vintage">Vintage</option>
                                <option value="portrait">Portrait</option>
                            </select>
                        </div>

                        {/* Target Focus Z Distance Slider */}
                        <ScrubInput
                            label="Target Focus (Z Distance)"
                            value={dof.target.z}
                            min={-1.5}
                            max={2.5}
                            step={0.02}
                            decimals={2}
                            onChange={(z) =>
                                handleUpdateEffectParam('depthOfField', {
                                    target: { ...dof.target, z },
                                })
                            }
                        />

                        {/* Quick Snap Focus to Layers */}
                        {activeShot.layers.length > 0 && (
                            <div className="space-y-1 pt-0.5">
                                <span className="text-[10px] text-gray-400 block">Snap Focus to Layer:</span>
                                <div className="flex flex-wrap gap-1">
                                    {activeShot.layers.map((l) => (
                                        <button
                                            key={l.id}
                                            onClick={() =>
                                                handleUpdateEffectParam('depthOfField', {
                                                    target: { ...dof.target, z: l.position.z },
                                                })
                                            }
                                            className={`px-1.5 py-0.5 rounded text-[10px] border transition ${Math.abs(dof.target.z - l.position.z) < 0.05
                                                    ? 'bg-purple-600/30 border-purple-500/50 text-purple-200'
                                                    : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                                                }`}
                                        >
                                            {l.name.slice(0, 14)} ({l.position.z.toFixed(2)})
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <ScrubInput
                            label="Aperture (f-stop)"
                            value={dof.aperture}
                            min={1.4}
                            max={16}
                            step={0.2}
                            decimals={1}
                            onChange={(aperture) =>
                                handleUpdateEffectParam('depthOfField', { aperture })
                            }
                        />

                        <ScrubInput
                            label="Bokeh Blur Scale"
                            value={dof.bokehScale}
                            min={1}
                            max={15}
                            step={0.5}
                            decimals={1}
                            onChange={(bokehScale) =>
                                handleUpdateEffectParam('depthOfField', { bokehScale })
                            }
                        />

                        <ScrubInput
                            label="Focus Range Zone"
                            value={dof.focusRange}
                            min={0.05}
                            max={1.5}
                            step={0.05}
                            decimals={2}
                            onChange={(focusRange) =>
                                handleUpdateEffectParam('depthOfField', { focusRange })
                            }
                        />

                        {/* Rack Focus Animation Blocks Sub-Panel */}
                        <div className="pt-2 border-t border-white/10 space-y-2">
                            <div className="flex items-center justify-between font-semibold text-gray-300">
                                <span className="text-[11px] flex items-center gap-1 text-purple-300">
                                    <Sliders className="w-3 h-3" /> Rack Focus Moves ({focusBlocks.length})
                                </span>
                                <button
                                    onClick={handleAddFocusBlock}
                                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-[10px] text-purple-200 transition cursor-pointer"
                                >
                                    <Plus className="w-3 h-3" /> Add Rack Pull
                                </button>
                            </div>

                            {focusBlocks.length === 0 ? (
                                <div className="text-[10px] text-gray-500 italic py-1">
                                    No focus pulls animated yet. Click Add Rack Pull to shift focus across layers mid-shot!
                                </div>
                            ) : (
                                <div className="space-y-2 pt-1">
                                    {focusBlocks.map((fb) => (
                                        <div
                                            key={fb.id}
                                            className="p-2 rounded-lg bg-white/5 border border-purple-500/20 space-y-2"
                                        >
                                            <div className="flex items-center justify-between">
                                                <input
                                                    type="text"
                                                    value={fb.label || ''}
                                                    onChange={(e) =>
                                                        updateFocusBlock(fb.id, { label: e.target.value })
                                                    }
                                                    placeholder="Rack Focus Move"
                                                    className="bg-transparent font-medium text-white text-[11px] outline-none border-b border-transparent focus:border-purple-400 px-0.5"
                                                />
                                                <button
                                                    onClick={() => deleteFocusBlock(fb.id)}
                                                    className="p-1 rounded hover:bg-rose-500/20 text-gray-400 hover:text-rose-400 cursor-pointer"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2">
                                                <ScrubInput
                                                    label="Start (ms)"
                                                    value={fb.startMs}
                                                    min={0}
                                                    max={Math.max(100, activeShot.durationMs - 200)}
                                                    step={50}
                                                    decimals={0}
                                                    onChange={(startMs) => updateFocusBlock(fb.id, { startMs })}
                                                />
                                                <ScrubInput
                                                    label="Duration (ms)"
                                                    value={fb.durationMs}
                                                    min={100}
                                                    max={10000}
                                                    step={50}
                                                    decimals={0}
                                                    onChange={(durationMs) =>
                                                        updateFocusBlock(fb.id, { durationMs })
                                                    }
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-2">
                                                <ScrubInput
                                                    label="From Focus Z"
                                                    value={fb.fromZ}
                                                    min={-1.5}
                                                    max={2.5}
                                                    step={0.02}
                                                    decimals={2}
                                                    onChange={(fromZ) => updateFocusBlock(fb.id, { fromZ })}
                                                />
                                                <ScrubInput
                                                    label="To Focus Z"
                                                    value={fb.toZ}
                                                    min={-1.5}
                                                    max={2.5}
                                                    step={0.02}
                                                    decimals={2}
                                                    onChange={(toZ) => updateFocusBlock(fb.id, { toZ })}
                                                />
                                            </div>

                                            <div className="flex items-center justify-between text-[10px]">
                                                <span className="text-gray-400">Easing Curve</span>
                                                <select
                                                    value={fb.easing.kind === 'preset' ? fb.easing.name : 'ease-in-out'}
                                                    onChange={(e) =>
                                                        updateFocusBlock(fb.id, {
                                                            easing: {
                                                                kind: 'preset',
                                                                name: e.target.value as PresetEasingName,
                                                            },
                                                        })
                                                    }
                                                    className="rounded border border-white/15 bg-[#11131c] px-2 py-0.5 text-white text-[10px] outline-none cursor-pointer"
                                                >
                                                    <option value="ease-in-out">Ease In Out</option>
                                                    <option value="ease-out">Ease Out (Smooth Stop)</option>
                                                    <option value="ease-in">Ease In (Accelerate)</option>
                                                    <option value="linear">Linear</option>
                                                </select>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* 2. Bloom Glow */}
            <div className="rounded-xl border border-white/10 bg-black/40 p-3 space-y-3">
                <div className="flex items-center justify-between font-semibold text-gray-200">
                    <span className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Bloom Glow
                    </span>
                    <input
                        type="checkbox"
                        checked={bloom.enabled}
                        onChange={(e) => handleToggleEffect('bloom', e.target.checked)}
                        className="accent-purple-500 cursor-pointer"
                    />
                </div>

                {bloom.enabled && (
                    <div className="space-y-2.5 pt-1 border-t border-white/10">
                        <ScrubInput
                            label="Bloom Intensity"
                            value={bloom.intensity}
                            min={0}
                            max={2.5}
                            step={0.05}
                            decimals={2}
                            onChange={(intensity) =>
                                handleUpdateEffectParam('bloom', { intensity })
                            }
                        />
                        <ScrubInput
                            label="Luminance Threshold"
                            value={bloom.threshold}
                            min={0}
                            max={1}
                            step={0.05}
                            decimals={2}
                            onChange={(threshold) =>
                                handleUpdateEffectParam('bloom', { threshold })
                            }
                        />
                    </div>
                )}
            </div>

            {/* 3. Vignette */}
            <div className="rounded-xl border border-white/10 bg-black/40 p-3 space-y-3">
                <div className="flex items-center justify-between font-semibold text-gray-200">
                    <span>Vignette (Corner Falloff)</span>
                    <input
                        type="checkbox"
                        checked={vignette.enabled}
                        onChange={(e) => handleToggleEffect('vignette', e.target.checked)}
                        className="accent-purple-500 cursor-pointer"
                    />
                </div>

                {vignette.enabled && (
                    <div className="pt-1 border-t border-white/10">
                        <ScrubInput
                            label="Vignette Intensity"
                            value={vignette.intensity}
                            min={0}
                            max={1}
                            step={0.02}
                            decimals={2}
                            onChange={(intensity) =>
                                handleUpdateEffectParam('vignette', { intensity })
                            }
                        />
                    </div>
                )}
            </div>

            {/* 4. Film Grain */}
            <div className="rounded-xl border border-white/10 bg-black/40 p-3 space-y-3">
                <div className="flex items-center justify-between font-semibold text-gray-200">
                    <span>35mm Film Grain</span>
                    <input
                        type="checkbox"
                        checked={grain.enabled}
                        onChange={(e) => handleToggleEffect('filmGrain', e.target.checked)}
                        className="accent-purple-500 cursor-pointer"
                    />
                </div>

                {grain.enabled && (
                    <div className="pt-1 border-t border-white/10">
                        <ScrubInput
                            label="Grain Opacity"
                            value={grain.intensity}
                            min={0}
                            max={0.15}
                            step={0.005}
                            decimals={3}
                            onChange={(intensity) =>
                                handleUpdateEffectParam('filmGrain', { intensity })
                            }
                        />
                    </div>
                )}
            </div>

            {/* 5. Color Grade (Exposure, Contrast, Saturation) */}
            <div className="rounded-xl border border-white/10 bg-black/40 p-3 space-y-3">
                <div className="flex items-center justify-between font-semibold text-gray-200">
                    <span>Color Grade (Exposure & Tone)</span>
                    <input
                        type="checkbox"
                        checked={grade.enabled}
                        onChange={(e) => handleToggleEffect('colorGrade', e.target.checked)}
                        className="accent-purple-500 cursor-pointer"
                    />
                </div>

                {grade.enabled && (
                    <div className="space-y-2.5 pt-1 border-t border-white/10">
                        <ScrubInput
                            label="Exposure (Brightness)"
                            value={grade.exposure}
                            min={0.5}
                            max={1.8}
                            step={0.02}
                            decimals={2}
                            onChange={(exposure) =>
                                handleUpdateEffectParam('colorGrade', { exposure })
                            }
                        />
                        <ScrubInput
                            label="Contrast"
                            value={grade.contrast}
                            min={0.5}
                            max={1.8}
                            step={0.02}
                            decimals={2}
                            onChange={(contrast) =>
                                handleUpdateEffectParam('colorGrade', { contrast })
                            }
                        />
                        <ScrubInput
                            label="Saturation"
                            value={grade.saturation}
                            min={0}
                            max={2.5}
                            step={0.05}
                            decimals={2}
                            onChange={(saturation) =>
                                handleUpdateEffectParam('colorGrade', { saturation })
                            }
                        />
                    </div>
                )}
            </div>

            {/* 6. Chromatic Aberration */}
            <div className="rounded-xl border border-white/10 bg-black/40 p-3 space-y-3">
                <div className="flex items-center justify-between font-semibold text-gray-200">
                    <span>Chromatic Aberration (RGB Shift)</span>
                    <input
                        type="checkbox"
                        checked={ca.enabled}
                        onChange={(e) =>
                            handleToggleEffect('chromaticAberration', e.target.checked)
                        }
                        className="accent-purple-500 cursor-pointer"
                    />
                </div>

                {ca.enabled && (
                    <div className="pt-1 border-t border-white/10">
                        <ScrubInput
                            label="Channel Offset"
                            value={ca.offset}
                            min={0}
                            max={0.01}
                            step={0.0005}
                            decimals={4}
                            onChange={(offset) =>
                                handleUpdateEffectParam('chromaticAberration', { offset })
                            }
                        />
                    </div>
                )}
            </div>

            {/* 7. Motion Blur (Cinematic Shutter) */}
            <div className="rounded-xl border border-white/10 bg-black/40 p-3 space-y-3">
                <div className="flex items-center justify-between font-semibold text-gray-200">
                    <span className="flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-blue-400" /> Motion Blur (Shutter Angle)
                    </span>
                    <input
                        type="checkbox"
                        checked={mb.enabled}
                        onChange={(e) => handleToggleEffect('motionBlur', e.target.checked)}
                        className="accent-purple-500 cursor-pointer"
                    />
                </div>

                {mb.enabled && (
                    <div className="space-y-2.5 pt-1 border-t border-white/10">
                        <ScrubInput
                            label="Shutter Angle (degrees)"
                            value={mb.shutterAngle}
                            min={0}
                            max={360}
                            step={10}
                            decimals={0}
                            onChange={(shutterAngle) =>
                                handleUpdateEffectParam('motionBlur', { shutterAngle })
                            }
                        />
                        <ScrubInput
                            label="Blur Samples"
                            value={mb.samples}
                            min={1}
                            max={32}
                            step={1}
                            decimals={0}
                            onChange={(samples) =>
                                handleUpdateEffectParam('motionBlur', { samples })
                            }
                        />
                    </div>
                )}
            </div>

            {/* 8. Ghost Echo */}
            <div className="rounded-xl border border-white/10 bg-black/40 p-3 space-y-3">
                <div className="flex items-center justify-between font-semibold text-gray-200">
                    <span className="flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-cyan-400" /> Ghost (Spectral Echo)
                    </span>
                    <input
                        type="checkbox"
                        checked={ghost.enabled}
                        onChange={(e) => handleToggleEffect('ghost', e.target.checked)}
                        className="accent-purple-500 cursor-pointer"
                    />
                </div>

                {ghost.enabled && (
                    <div className="space-y-2.5 pt-1 border-t border-white/10">
                        <ScrubInput
                            label="Ghost Opacity"
                            value={ghost.opacity}
                            min={0}
                            max={1}
                            step={0.05}
                            decimals={2}
                            onChange={(opacity) =>
                                handleUpdateEffectParam('ghost', { opacity })
                            }
                        />
                        <ScrubInput
                            label="Displacement Offset"
                            value={ghost.offset}
                            min={0}
                            max={0.1}
                            step={0.005}
                            decimals={3}
                            onChange={(offset) =>
                                handleUpdateEffectParam('ghost', { offset })
                            }
                        />
                        <ScrubInput
                            label="Ghost Blur (px)"
                            value={ghost.blur}
                            min={0}
                            max={30}
                            step={1}
                            decimals={0}
                            onChange={(blur) =>
                                handleUpdateEffectParam('ghost', { blur })
                            }
                        />
                    </div>
                )}
            </div>

            {/* 9. Edge Fade (Feathered Borders) */}
            <div className="rounded-xl border border-white/10 bg-black/40 p-3 space-y-3">
                <div className="flex items-center justify-between font-semibold text-gray-200">
                    <span>Edge Fade (Feather Vignette)</span>
                    <input
                        type="checkbox"
                        checked={edgeFade.enabled}
                        onChange={(e) => handleToggleEffect('edgeFade', e.target.checked)}
                        className="accent-purple-500 cursor-pointer"
                    />
                </div>

                {edgeFade.enabled && (
                    <div className="space-y-2.5 pt-1 border-t border-white/10">
                        <div className="grid grid-cols-2 gap-2">
                            <ScrubInput
                                label="Top Fade"
                                value={edgeFade.top}
                                min={0}
                                max={0.5}
                                step={0.02}
                                decimals={2}
                                onChange={(top) =>
                                    handleUpdateEffectParam('edgeFade', { top })
                                }
                            />
                            <ScrubInput
                                label="Bottom Fade"
                                value={edgeFade.bottom}
                                min={0}
                                max={0.5}
                                step={0.02}
                                decimals={2}
                                onChange={(bottom) =>
                                    handleUpdateEffectParam('edgeFade', { bottom })
                                }
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <ScrubInput
                                label="Left Fade"
                                value={edgeFade.left}
                                min={0}
                                max={0.5}
                                step={0.02}
                                decimals={2}
                                onChange={(left) =>
                                    handleUpdateEffectParam('edgeFade', { left })
                                }
                            />
                            <ScrubInput
                                label="Right Fade"
                                value={edgeFade.right}
                                min={0}
                                max={0.5}
                                step={0.02}
                                decimals={2}
                                onChange={(right) =>
                                    handleUpdateEffectParam('edgeFade', { right })
                                }
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* 10. Digital Glitch */}
            <div className="rounded-xl border border-white/10 bg-black/40 p-3 space-y-3">
                <div className="flex items-center justify-between font-semibold text-gray-200">
                    <span className="flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-rose-400" /> Digital Glitch (Signal Tear)
                    </span>
                    <input
                        type="checkbox"
                        checked={glitch.enabled}
                        onChange={(e) => handleToggleEffect('glitch', e.target.checked)}
                        className="accent-purple-500 cursor-pointer"
                    />
                </div>

                {glitch.enabled && (
                    <div className="pt-1 border-t border-white/10">
                        <ScrubInput
                            label="Glitch Intensity"
                            value={glitch.intensity}
                            min={0}
                            max={1}
                            step={0.05}
                            decimals={2}
                            onChange={(intensity) =>
                                handleUpdateEffectParam('glitch', { intensity })
                            }
                        />
                    </div>
                )}
            </div>

            {/* 11. Effect Pipeline Execution Order */}
            <div className="rounded-xl border border-white/10 bg-black/40 p-3 space-y-2.5">
                <div className="font-semibold text-gray-200">
                    Shader Execution Order (Pipeline)
                </div>
                <div className="space-y-1 font-mono text-[11px]">
                    {activeShot.effectsOrder.map((key, index) => {
                        const isEnabled = activeShot.effects[key]?.enabled;
                        return (
                            <div
                                key={key}
                                className={`p-2 rounded border flex items-center justify-between ${isEnabled
                                        ? 'bg-purple-950/20 border-purple-500/40 text-purple-200'
                                        : 'bg-white/5 border-white/10 text-gray-500 opacity-60'
                                    }`}
                            >
                                <span>
                                    #{index + 1} {key}
                                </span>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => moveEffectOrder(key, -1)}
                                        disabled={index === 0}
                                        className="p-0.5 hover:bg-white/10 rounded disabled:opacity-30 cursor-pointer"
                                    >
                                        <ArrowUp className="w-3 h-3" />
                                    </button>
                                    <button
                                        onClick={() => moveEffectOrder(key, 1)}
                                        disabled={index === activeShot.effectsOrder.length - 1}
                                        className="p-0.5 hover:bg-white/10 rounded disabled:opacity-30 cursor-pointer"
                                    >
                                        <ArrowDown className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </aside>
    );
};