// src/panels/Inspector/sections/BackgroundSection.tsx
import React, { useRef, useState } from 'react';
import {
    Palette,
    Compass,
    Plus,
    Trash2,
    Upload,
} from 'lucide-react';
import type { Background, GradientStop, Shot } from '../../../model/types';
import { resolveShotBackground, RAYLIGHT_COLOR_PALETTE } from '../../../model/types';
import { useProjectStore } from '../../../store/useProjectStore';
import { useSelectionStore } from '../../../store/useSelectionStore';
import { ColorPicker } from '../ColorPicker';
import { saveImageAsset } from '../imageAssetHelper';
import { ScrubInput } from '../../../ui/ScrubInput';
import {
    SHADER_PRESETS,
    SHADER_PRESET_METADATA,
    DEFAULT_SHADER_CONFIGS,
    isPaletteShader,
    shaderUsesBase,
    type ShaderPreset,
} from '../../../model/backgroundPresets';

export interface BackgroundSectionProps {
    scope?: 'project' | 'shot';
    activeShot?: Shot;
}

type MainTab = 'color' | 'shader' | 'image' | 'alpha';

const GRADIENT_PRESETS: { name: string; stops: GradientStop[]; angle: number }[] = [
    {
        name: 'Deep Studio',
        angle: 135,
        stops: [
            { at: 0, color: '#090a12' },
            { at: 1, color: '#141829' },
        ],
    },
    {
        name: 'Cyber Sunset',
        angle: 120,
        stops: [
            { at: 0, color: '#f43f5e' },
            { at: 0.5, color: '#8b5cf6' },
            { at: 1, color: '#06b6d4' },
        ],
    },
    {
        name: 'Clean Slate',
        angle: 145,
        stops: [
            { at: 0, color: '#1e293b' },
            { at: 1, color: '#0f172a' },
        ],
    },
    {
        name: 'Velvet Night',
        angle: 160,
        stops: [
            { at: 0, color: '#171727' },
            { at: 1, color: '#09090f' },
        ],
    },
    {
        name: 'Warm Amber',
        angle: 135,
        stops: [
            { at: 0, color: '#78350f' },
            { at: 1, color: '#1c1917' },
        ],
    },
    {
        name: 'Cool Azure',
        angle: 135,
        stops: [
            { at: 0, color: '#0369a1' },
            { at: 1, color: '#082f49' },
        ],
    },
    {
        name: 'Emerald Glow',
        angle: 140,
        stops: [
            { at: 0, color: '#10b981' },
            { at: 1, color: '#064e3b' },
        ],
    },
    {
        name: 'Neon Aura',
        angle: 110,
        stops: [
            { at: 0, color: '#a855f7' },
            { at: 0.5, color: '#ec4899' },
            { at: 1, color: '#f97316' },
        ],
    },
];

export const BackgroundSection: React.FC<BackgroundSectionProps> = ({
    scope = 'project',
    activeShot,
}) => {
    const { project, updateProject, updateShot } = useProjectStore();
    const {
        gradientEditorActive,
        setGradientEditor,
        setGradientEditorAngle,
    } = useSelectionStore();

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedStopIdx, setSelectedStopIdx] = useState<number>(0);
    const [colorSubTab, setColorSubTab] = useState<'solid' | 'gradient'>('solid');
    const [selectedPaletteIdx, setSelectedPaletteIdx] = useState<number>(0);

    const isShotScope = scope === 'shot' && Boolean(activeShot);
    const hasShotOverride = Boolean(
        isShotScope && activeShot?.useProjectBackground === false && activeShot?.background
    );

    const effectiveBg: Background = isShotScope && activeShot
        ? resolveShotBackground(project, activeShot)
        : project.background;

    const setBackground = (bg: Background) => {
        if (isShotScope && activeShot) {
            updateShot(activeShot.id, (shot) => ({
                ...shot,
                useProjectBackground: false,
                background: bg,
            }));
        } else {
            updateProject((p) => ({
                ...p,
                background: bg,
            }));
        }
    };

    const handleRevertToProject = () => {
        if (!isShotScope || !activeShot) return;
        updateShot(activeShot.id, (shot) => ({
            ...shot,
            useProjectBackground: true,
            background: undefined,
        }));
    };

    // Determine active main tab
    let mainTab: MainTab = 'color';
    if (effectiveBg.kind === 'transparent') {
        mainTab = 'alpha';
    } else if (effectiveBg.kind === 'shader') {
        mainTab = 'shader';
    } else if (effectiveBg.kind === 'image') {
        mainTab = 'image';
    } else if (effectiveBg.kind === 'gradient') {
        mainTab = 'color';
    }

    const handleTabChange = (tab: MainTab) => {
        if (tab === 'alpha') {
            setBackground({ kind: 'transparent' });
        } else if (tab === 'color') {
            if (colorSubTab === 'gradient' || effectiveBg.kind === 'gradient') {
                setBackground({
                    kind: 'gradient',
                    angle: 90,
                    gradientType: 'linear',
                    stops: [
                        { at: 0, color: '#090a12', opacity: 1 },
                        { at: 1, color: '#1e293b', opacity: 1 },
                    ],
                });
            } else {
                const col = effectiveBg.kind === 'solid' ? effectiveBg.color : '#0c0e17';
                setBackground({ kind: 'solid', color: col });
            }
        } else if (tab === 'shader') {
            const preset: ShaderPreset = 'silk';
            const cfg = DEFAULT_SHADER_CONFIGS[preset];
            setBackground({
                kind: 'shader',
                preset,
                color: cfg.color,
                colors: [...cfg.colors],
                backgroundColor: cfg.backgroundColor,
                speed: cfg.speed,
                waves: cfg.waves,
                focus: cfg.focus,
                glow: cfg.glow,
                shine: cfg.shine,
                angle: cfg.angle,
            });
        } else if (tab === 'image') {
            setBackground({
                kind: 'image',
                color: '#000000',
                fit: 'cover',
                dim: 0,
                blur: 0,
            });
        }
    };

    const handleSelectShaderPreset = (preset: ShaderPreset) => {
        const cfg = DEFAULT_SHADER_CONFIGS[preset];
        setBackground({
            kind: 'shader',
            preset,
            color: cfg.color,
            colors: [...cfg.colors],
            backgroundColor: cfg.backgroundColor,
            speed: effectiveBg.kind === 'shader' ? effectiveBg.speed : cfg.speed,
            waves: cfg.waves,
            focus: cfg.focus,
            glow: cfg.glow,
            shine: cfg.shine,
            angle: cfg.angle,
        });
    };

    const handlePickImage = (file: File | null) => {
        if (!file) return;
        saveImageAsset({
            file,
            updateProject,
            onSave: (assetId) => {
                setBackground({
                    kind: 'image',
                    assetId,
                    color: '#000000',
                    fit: 'cover',
                    dim: 0,
                    blur: 0,
                });
            },
        });
    };

    const currentShaderMeta = effectiveBg.kind === 'shader'
        ? (SHADER_PRESET_METADATA as Record<string, any>)[effectiveBg.preset]
        : undefined;

    return (
        <div className="flex flex-col gap-3 p-3 bg-[#141416] border-b border-white/[0.06] text-xs">
            {/* Header: Scope, Override Status */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-medium text-[#d4d4d8]">
                    <Palette className="w-3.5 h-3.5 text-[#0088ff]" />
                    <span>{isShotScope ? 'Shot Background' : 'Canvas Background'}</span>
                </div>

                {isShotScope && (
                    <div className="flex items-center gap-1.5">
                        {hasShotOverride ? (
                            <button
                                type="button"
                                onClick={handleRevertToProject}
                                className="text-[10px] text-[#0088ff] hover:underline cursor-pointer"
                                title="Revert to project background"
                            >
                                Reset to Project
                            </button>
                        ) : (
                            <span className="text-[10px] text-[#71717a]">Using Project</span>
                        )}
                    </div>
                )}
            </div>

            {/* Top Navigation Tabs: Color | Shader | Image | Alpha */}
            <div className="grid grid-cols-4 bg-[#1c1c1f] p-0.5 rounded-lg border border-white/[0.06] text-[11px]">
                {(['color', 'shader', 'image', 'alpha'] as const).map((tab) => {
                    const isActive = mainTab === tab;
                    return (
                        <button
                            key={tab}
                            type="button"
                            onClick={() => handleTabChange(tab)}
                            className={`py-1 rounded font-medium capitalize transition cursor-pointer text-center ${isActive
                                ? 'bg-[#2a2a2e] text-white shadow-sm'
                                : 'text-[#a1a1aa] hover:text-white'
                                }`}
                        >
                            {tab === 'alpha' ? 'Alpha' : tab}
                        </button>
                    );
                })}
            </div>

            {/* --- TAB 1: COLOR (SOLID / GRADIENT) --- */}
            {mainTab === 'color' && (
                <div className="flex flex-col gap-3">
                    {/* Sub-toggle: Solid vs Gradient */}
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] text-[#a1a1aa] font-medium">Style</span>
                        <div className="flex items-center gap-1 bg-[#1c1c1f] p-0.5 rounded-lg border border-white/[0.06]">
                            <button
                                type="button"
                                onClick={() => {
                                    setColorSubTab('solid');
                                    const col = effectiveBg.kind === 'gradient'
                                        ? effectiveBg.stops[0]?.color ?? '#0c0e17'
                                        : effectiveBg.kind === 'solid'
                                            ? effectiveBg.color
                                            : '#0c0e17';
                                    setBackground({ kind: 'solid', color: col });
                                }}
                                className={`px-2 py-0.5 rounded text-[10px] font-medium transition cursor-pointer ${effectiveBg.kind === 'solid'
                                    ? 'bg-[#2a2a2e] text-white shadow-sm'
                                    : 'text-[#a1a1aa] hover:text-white'
                                    }`}
                            >
                                Solid
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setColorSubTab('gradient');
                                    setBackground({
                                        kind: 'gradient',
                                        angle: 90,
                                        gradientType: 'linear',
                                        stops: [
                                            { at: 0, color: '#090a12', opacity: 1 },
                                            { at: 1, color: '#1e293b', opacity: 1 },
                                        ],
                                    });
                                }}
                                className={`px-2 py-0.5 rounded text-[10px] font-medium transition cursor-pointer ${effectiveBg.kind === 'gradient'
                                    ? 'bg-[#2a2a2e] text-white shadow-sm'
                                    : 'text-[#a1a1aa] hover:text-white'
                                    }`}
                            >
                                Gradient
                            </button>
                        </div>
                    </div>

                    {/* SOLID COLOR CONTROLS */}
                    {effectiveBg.kind === 'solid' && (
                        <div className="flex flex-col gap-2.5">
                            <ColorPicker
                                label="Fill Color"
                                color={effectiveBg.color}
                                onChange={(c) => setBackground({ ...effectiveBg, color: c })}
                            />
                            <ScrubInput
                                label="Opacity"
                                value={Math.round((effectiveBg.opacity ?? 1) * 100)}
                                min={0}
                                max={100}
                                step={1}
                                unit="%"
                                onChange={(val) => setBackground({ ...effectiveBg, opacity: val / 100 })}
                            />
                            <div className="flex items-center gap-1 pt-1 overflow-x-auto">
                                {RAYLIGHT_COLOR_PALETTE.map((hex) => (
                                    <button
                                        key={hex}
                                        type="button"
                                        onClick={() => setBackground({ ...effectiveBg, color: hex })}
                                        className="w-5 h-5 rounded-full border border-white/20 shrink-0 hover:scale-110 transition cursor-pointer shadow-sm"
                                        style={{ backgroundColor: hex }}
                                        title={hex}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* GRADIENT CONTROLS */}
                    {effectiveBg.kind === 'gradient' && (
                        <div className="flex flex-col gap-3">
                            {/* Gradient Type */}
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] text-[#a1a1aa] font-medium">Type</span>
                                <div className="flex items-center gap-1 bg-[#1c1c1f] p-0.5 rounded-lg border border-white/[0.06]">
                                    {(['linear', 'radial', 'angular'] as const).map((gt) => (
                                        <button
                                            key={gt}
                                            type="button"
                                            onClick={() => setBackground({ ...effectiveBg, gradientType: gt })}
                                            className={`px-2 py-0.5 rounded text-[10px] font-medium capitalize transition cursor-pointer ${(effectiveBg.gradientType ?? 'linear') === gt
                                                ? 'bg-[#2a2a2e] text-white shadow-sm'
                                                : 'text-[#a1a1aa] hover:text-white'
                                                }`}
                                        >
                                            {gt}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Angle Scrubber & On-Stage Compass */}
                            {effectiveBg.gradientType !== 'radial' && (
                                <div className="flex items-center gap-2">
                                    <div className="flex-1">
                                        <ScrubInput
                                            label="Angle"
                                            value={effectiveBg.angle ?? 90}
                                            min={0}
                                            max={360}
                                            step={1}
                                            unit="°"
                                            onChange={(a) => {
                                                setBackground({ ...effectiveBg, angle: a });
                                                setGradientEditorAngle(a);
                                            }}
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setGradientEditor(!gradientEditorActive)}
                                        className={`p-1.5 rounded-lg border border-white/[0.08] transition cursor-pointer ${gradientEditorActive
                                            ? 'bg-[#0088ff] text-white'
                                            : 'bg-[#1c1c1f] text-[#a1a1aa] hover:text-white'
                                            }`}
                                        title={gradientEditorActive ? 'Hide on-canvas compass' : 'Edit angle on canvas'}
                                    >
                                        <Compass className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            )}

                            {/* Multi-Stop Gradient Preview Bar */}
                            <div className="flex flex-col gap-1.5">
                                <div className="flex items-center justify-between text-[10px] text-[#a1a1aa]">
                                    <span>Color Stops</span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const stops = [...effectiveBg.stops];
                                            stops.push({ at: 0.5, color: '#38bdf8', opacity: 1 });
                                            stops.sort((a, b) => a.at - b.at);
                                            setBackground({ ...effectiveBg, stops });
                                        }}
                                        className="flex items-center gap-0.5 text-[#0088ff] hover:underline cursor-pointer"
                                    >
                                        <Plus className="w-3 h-3" />
                                        <span>Add Stop</span>
                                    </button>
                                </div>

                                <div
                                    className="h-4 rounded border border-white/20 relative cursor-pointer"
                                    style={{
                                        background: `linear-gradient(90deg, ${effectiveBg.stops
                                            .map((s) => `${s.color} ${(s.at * 100).toFixed(0)}%`)
                                            .join(', ')})`,
                                    }}
                                >
                                    {effectiveBg.stops.map((stop, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedStopIdx(idx);
                                            }}
                                            className={`absolute top-0 bottom-0 w-3 -ml-1.5 rounded-sm border shadow transition cursor-pointer ${selectedStopIdx === idx
                                                ? 'border-white bg-white scale-110 z-10'
                                                : 'border-black bg-white/70 hover:scale-105'
                                                }`}
                                            style={{ left: `${stop.at * 100}%` }}
                                            title={`Stop ${idx + 1}: ${Math.round(stop.at * 100)}%`}
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* Selected Stop Details */}
                            {effectiveBg.stops[selectedStopIdx] && (
                                <div className="flex items-center gap-2 p-2 bg-[#1c1c1f] rounded-lg border border-white/[0.06]">
                                    <div className="flex-1">
                                        <ColorPicker
                                            label={`Stop #${selectedStopIdx + 1}`}
                                            color={effectiveBg.stops[selectedStopIdx].color}
                                            onChange={(c) => {
                                                const stops = [...effectiveBg.stops];
                                                stops[selectedStopIdx] = { ...stops[selectedStopIdx], color: c };
                                                setBackground({ ...effectiveBg, stops });
                                            }}
                                        />
                                    </div>
                                    <div className="w-20">
                                        <ScrubInput
                                            label="Pos"
                                            value={Math.round(effectiveBg.stops[selectedStopIdx].at * 100)}
                                            min={0}
                                            max={100}
                                            step={1}
                                            unit="%"
                                            onChange={(val) => {
                                                const stops = [...effectiveBg.stops];
                                                stops[selectedStopIdx] = { ...stops[selectedStopIdx], at: val / 100 };
                                                setBackground({ ...effectiveBg, stops });
                                            }}
                                        />
                                    </div>
                                    {effectiveBg.stops.length > 2 && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const stops = effectiveBg.stops.filter((_, i) => i !== selectedStopIdx);
                                                setSelectedStopIdx(Math.max(0, selectedStopIdx - 1));
                                                setBackground({ ...effectiveBg, stops });
                                            }}
                                            className="p-1.5 text-[#ef4444] hover:bg-white/5 rounded cursor-pointer"
                                            title="Delete Stop"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Designer Gradient Presets */}
                            <div className="flex flex-col gap-1 pt-1">
                                <span className="text-[10px] text-[#71717a]">Presets</span>
                                <div className="grid grid-cols-4 gap-1.5">
                                    {GRADIENT_PRESETS.map((preset) => (
                                        <button
                                            key={preset.name}
                                            type="button"
                                            onClick={() =>
                                                setBackground({
                                                    kind: 'gradient',
                                                    angle: preset.angle,
                                                    gradientType: 'linear',
                                                    stops: preset.stops,
                                                })
                                            }
                                            className="h-6 rounded border border-white/10 hover:border-white/40 transition cursor-pointer shadow-sm relative group overflow-hidden"
                                            style={{
                                                background: `linear-gradient(${preset.angle}deg, ${preset.stops
                                                    .map((s) => `${s.color} ${(s.at * 100).toFixed(0)}%`)
                                                    .join(', ')})`,
                                            }}
                                            title={preset.name}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* --- TAB 2: PROCEDURAL WEBGL SHADER --- */}
            {mainTab === 'shader' && (
                <div className="flex flex-col gap-3">
                    {/* Preset Picker Grid */}
                    <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between text-[10px] text-[#a1a1aa]">
                            <span className="font-medium">Preset</span>
                            <span className="text-[#0088ff] font-semibold">
                                {currentShaderMeta?.label || 'Silk'}
                            </span>
                        </div>
                        <div className="grid grid-cols-3 gap-1 bg-[#101012] p-1 rounded-lg border border-white/[0.06] max-h-40 overflow-y-auto">
                            {SHADER_PRESETS.map((p) => {
                                const isCurrent = effectiveBg.kind === 'shader' && effectiveBg.preset === p;
                                const meta = (SHADER_PRESET_METADATA as Record<string, any>)[p];
                                const cfg = (DEFAULT_SHADER_CONFIGS as Record<string, any>)[p];
                                return (
                                    <button
                                        key={p}
                                        type="button"
                                        onClick={() => handleSelectShaderPreset(p)}
                                        className={`flex flex-col items-start p-1.5 rounded transition text-left cursor-pointer border ${isCurrent
                                            ? 'bg-[#242428] border-[#0088ff] text-white shadow-sm'
                                            : 'bg-[#18181b] border-transparent text-[#a1a1aa] hover:text-white hover:border-white/10'
                                            }`}
                                        title={meta?.description}
                                    >
                                        <div className="flex items-center gap-1 w-full">
                                            <div
                                                className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/20"
                                                style={{ backgroundColor: cfg?.color }}
                                            />
                                            <span className="text-[10px] font-semibold truncate flex-1">{meta?.label}</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                        {currentShaderMeta && (
                            <p className="text-[10px] text-[#71717a] italic">
                                {currentShaderMeta.description}
                            </p>
                        )}
                    </div>

                    {effectiveBg.kind === 'shader' && (
                        <>
                            {/* Color Controls: Accent vs Palette */}
                            {isPaletteShader(effectiveBg.preset) ? (
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-[10px] text-[#a1a1aa] font-medium">Palette Spots (5 max)</span>
                                    <div className="flex items-center gap-1.5 p-1.5 bg-[#1c1c1f] rounded-lg border border-white/[0.06]">
                                        {effectiveBg.colors.slice(0, 5).map((col, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => setSelectedPaletteIdx(idx)}
                                                className={`w-6 h-6 rounded-md border transition cursor-pointer shadow-sm ${selectedPaletteIdx === idx
                                                    ? 'border-white scale-110 ring-1 ring-[#0088ff]'
                                                    : 'border-white/20 hover:scale-105'
                                                    }`}
                                                style={{ backgroundColor: col }}
                                                title={`Palette color #${idx + 1}`}
                                            />
                                        ))}
                                    </div>
                                    {effectiveBg.colors[selectedPaletteIdx] && (
                                        <ColorPicker
                                            label={`Spot #${selectedPaletteIdx + 1}`}
                                            color={effectiveBg.colors[selectedPaletteIdx]}
                                            onChange={(c) => {
                                                const colors = [...effectiveBg.colors];
                                                colors[selectedPaletteIdx] = c;
                                                setBackground({ ...effectiveBg, colors });
                                            }}
                                        />
                                    )}
                                </div>
                            ) : (
                                <ColorPicker
                                    label="Accent Color"
                                    color={effectiveBg.color}
                                    onChange={(c) => setBackground({ ...effectiveBg, color: c })}
                                />
                            )}

                            {/* Base Color (if shader uses base) */}
                            {shaderUsesBase(effectiveBg.preset) && (
                                <ColorPicker
                                    label="Base Background"
                                    color={effectiveBg.backgroundColor}
                                    onChange={(c) => setBackground({ ...effectiveBg, backgroundColor: c })}
                                />
                            )}

                            {/* 2-Column Dynamic Scrubbers Grid */}
                            <div className="flex flex-col gap-2 pt-1 border-t border-white/[0.06]">
                                <span className="text-[10px] text-[#a1a1aa] font-medium">Uniform Parameters</span>
                                <div className="grid grid-cols-2 gap-2">
                                    {/* Speed */}
                                    <ScrubInput
                                        label="Speed"
                                        value={Math.round((effectiveBg.speed ?? 1) * 100)}
                                        min={0}
                                        max={300}
                                        step={5}
                                        unit="%"
                                        onChange={(val) => setBackground({ ...effectiveBg, speed: val / 100 })}
                                    />

                                    {/* Waves */}
                                    {currentShaderMeta?.knobs?.waves && (
                                        <ScrubInput
                                            label={currentShaderMeta.knobs.waves.label}
                                            value={Math.round((effectiveBg.waves ?? 1) * 100)}
                                            min={25}
                                            max={250}
                                            step={5}
                                            unit="%"
                                            onChange={(val) => setBackground({ ...effectiveBg, waves: val / 100 })}
                                        />
                                    )}

                                    {/* Focus */}
                                    {currentShaderMeta?.knobs?.focus && (
                                        <ScrubInput
                                            label={currentShaderMeta.knobs.focus.label}
                                            value={Math.round((effectiveBg.focus ?? 1) * 100)}
                                            min={20}
                                            max={200}
                                            step={5}
                                            unit="%"
                                            onChange={(val) => setBackground({ ...effectiveBg, focus: val / 100 })}
                                        />
                                    )}

                                    {/* Glow */}
                                    {currentShaderMeta?.knobs?.glow && (
                                        <ScrubInput
                                            label={currentShaderMeta.knobs.glow.label}
                                            value={Math.round((effectiveBg.glow ?? 1) * 100)}
                                            min={0}
                                            max={200}
                                            step={5}
                                            unit="%"
                                            onChange={(val) => setBackground({ ...effectiveBg, glow: val / 100 })}
                                        />
                                    )}

                                    {/* Shine */}
                                    {currentShaderMeta?.knobs?.shine && (
                                        <ScrubInput
                                            label={currentShaderMeta.knobs.shine.label}
                                            value={Math.round((effectiveBg.shine ?? 1) * 100)}
                                            min={0}
                                            max={200}
                                            step={5}
                                            unit="%"
                                            onChange={(val) => setBackground({ ...effectiveBg, shine: val / 100 })}
                                        />
                                    )}

                                    {/* Angle */}
                                    {currentShaderMeta?.knobs?.angle && (
                                        <ScrubInput
                                            label="Angle"
                                            value={effectiveBg.angle ?? 28}
                                            min={-90}
                                            max={90}
                                            step={1}
                                            unit="°"
                                            onChange={(val) => setBackground({ ...effectiveBg, angle: val })}
                                        />
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* --- TAB 3: IMAGE BACKGROUND --- */}
            {mainTab === 'image' && (
                <div className="flex flex-col gap-3">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) => handlePickImage(e.target.files?.[0] || null)}
                        className="hidden"
                    />

                    {effectiveBg.kind === 'image' && (effectiveBg.src || effectiveBg.assetId) ? (
                        <div className="flex flex-col gap-2.5">
                            <div className="flex items-center justify-between p-2 bg-[#1c1c1f] rounded-lg border border-white/[0.06]">
                                <div className="flex items-center gap-2">
                                    <div
                                        className="w-8 h-8 rounded bg-cover bg-center border border-white/10 shrink-0"
                                        style={{
                                            backgroundImage: `url(${effectiveBg.src || (effectiveBg.assetId ? project.assets[effectiveBg.assetId]?.dataUrl : '')
                                                })`,
                                        }}
                                    />
                                    <span className="text-[11px] text-[#e4e4e7] truncate max-w-[120px]">
                                        {effectiveBg.assetId
                                            ? project.assets[effectiveBg.assetId]?.name || 'Background Image'
                                            : 'Custom Image'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="px-2 py-1 bg-white/5 hover:bg-white/10 text-white rounded text-[10px] cursor-pointer"
                                    >
                                        Replace
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setBackground({ kind: 'image', color: '#000000', fit: 'cover' })}
                                        className="p-1 text-[#ef4444] hover:bg-white/5 rounded cursor-pointer"
                                        title="Clear Image"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>

                            {/* Fit Mode */}
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] text-[#a1a1aa] font-medium">Sizing Fit</span>
                                <div className="flex items-center gap-1 bg-[#1c1c1f] p-0.5 rounded-lg border border-white/[0.06]">
                                    {(['cover', 'contain'] as const).map((fit) => (
                                        <button
                                            key={fit}
                                            type="button"
                                            onClick={() => {
                                                if (effectiveBg.kind === 'image') {
                                                    setBackground({ ...effectiveBg, fit });
                                                }
                                            }}
                                            className={`px-2 py-0.5 rounded text-[10px] font-medium capitalize transition cursor-pointer ${(effectiveBg.kind === 'image' ? effectiveBg.fit ?? 'cover' : 'cover') === fit
                                                ? 'bg-[#2a2a2e] text-white shadow-sm'
                                                : 'text-[#a1a1aa] hover:text-white'
                                                }`}
                                        >
                                            {fit === 'cover' ? 'Fill' : 'Fit'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Backdrop letterbox color (when fit === contain) */}
                            {effectiveBg.kind === 'image' && effectiveBg.fit === 'contain' && (
                                <ColorPicker
                                    label="Backdrop Fill"
                                    color={effectiveBg.color || '#000000'}
                                    onChange={(c) => {
                                        if (effectiveBg.kind === 'image') {
                                            setBackground({ ...effectiveBg, color: c });
                                        }
                                    }}
                                />
                            )}

                            {/* Blur Scrubber */}
                            <ScrubInput
                                label="Blur"
                                value={Math.round(effectiveBg.kind === 'image' ? (effectiveBg.blur ?? 0) : 0)}
                                min={0}
                                max={100}
                                step={1}
                                unit="%"
                                onChange={(blur) => {
                                    if (effectiveBg.kind === 'image') {
                                        setBackground({ ...effectiveBg, blur });
                                    }
                                }}
                            />

                            {/* Dim Scrubber */}
                            <ScrubInput
                                label="Dim"
                                value={Math.round((effectiveBg.kind === 'image' ? effectiveBg.dim ?? 0 : 0) * 100)}
                                min={0}
                                max={100}
                                step={1}
                                unit="%"
                                onChange={(val) => {
                                    if (effectiveBg.kind === 'image') {
                                        setBackground({ ...effectiveBg, dim: val / 100 });
                                    }
                                }}
                            />
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-white/10 hover:border-[#0088ff]/50 rounded-lg transition cursor-pointer group"
                        >
                            <Upload className="w-5 h-5 text-[#a1a1aa] group-hover:text-[#0088ff] mb-1.5 transition" />
                            <span className="text-[11px] font-medium text-white">Upload Background Image</span>
                            <span className="text-[10px] text-[#71717a]">PNG, JPG, WebP supported</span>
                        </button>
                    )}
                </div>
            )}

            {/* --- TAB 4: ALPHA (TRANSPARENT CHECKERBOARD) --- */}
            {mainTab === 'alpha' && (
                <div className="flex flex-col items-center justify-center p-4 bg-[#101012] rounded-lg border border-white/[0.06] text-center gap-2">
                    <div
                        className="w-16 h-12 rounded border border-white/20 shadow-inner"
                        style={{
                            backgroundImage: `linear-gradient(45deg, #1c1c1f 25%, transparent 25%), linear-gradient(-45deg, #1c1c1f 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1c1c1f 75%), linear-gradient(-45deg, transparent 75%, #1c1c1f 75%)`,
                            backgroundSize: '12px 12px',
                            backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0px',
                            backgroundColor: '#0c0c0e',
                        }}
                    />
                    <span className="font-semibold text-white text-[11px]">Alpha Transparency Active</span>
                    <p className="text-[10px] text-[#71717a] max-w-[220px]">
                        The background is transparent. Exported videos and frame PNGs will retain full alpha channels.
                    </p>
                </div>
            )}
        </div>
    );
};

export default BackgroundSection;
