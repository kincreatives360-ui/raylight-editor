// src/panels/Inspector/ShotInspector.tsx
import React from 'react';
import { Film, Sun, Scissors, Palette, Plus, Trash2 } from 'lucide-react';
import type { Shot } from '../../model/types';
import { useProjectStore } from '../../store/useProjectStore';
import { ScrubInput } from '../../ui/ScrubInput';

interface ShotInspectorProps {
    activeShot: Shot;
}

const SOLID_PRESETS = [
    { name: 'Midnight', color: '#07080d' },
    { name: 'Slate Dark', color: '#0f172a' },
    { name: 'Zinc Noir', color: '#09090b' },
    { name: 'Deep Violet', color: '#1e1035' },
    { name: 'Navy Blue', color: '#0c1222' },
    { name: 'Pure Black', color: '#000000' },
];

const GRADIENT_PRESETS = [
    {
        name: 'Deep Space',
        angle: 135,
        stops: [
            { at: 0, color: '#0f172a' },
            { at: 1, color: '#020617' },
        ],
    },
    {
        name: 'Violet Nebula',
        angle: 135,
        stops: [
            { at: 0, color: '#1e1b4b' },
            { at: 1, color: '#0f172a' },
        ],
    },
    {
        name: 'Cyber Night',
        angle: 90,
        stops: [
            { at: 0, color: '#111827' },
            { at: 1, color: '#1f2937' },
        ],
    },
    {
        name: 'Sunset Noir',
        angle: 135,
        stops: [
            { at: 0, color: '#3b0764' },
            { at: 1, color: '#18181b' },
        ],
    },
    {
        name: 'Emerald Abyss',
        angle: 145,
        stops: [
            { at: 0, color: '#064e3b' },
            { at: 1, color: '#022c22' },
        ],
    },
];

export const ShotInspector: React.FC<ShotInspectorProps> = ({ activeShot }) => {
    const { updateShot, project, updateProject } = useProjectStore();

    const background = project.background;

    const handleSetSolid = (color: string) => {
        updateProject((p) => ({
            ...p,
            background: { kind: 'solid', color },
        }));
    };

    const handleSetGradientMode = () => {
        if (background.kind === 'gradient') return;
        const startColor = background.kind === 'solid' ? background.color : '#0f172a';
        updateProject((p) => ({
            ...p,
            background: {
                kind: 'gradient',
                angle: 135,
                stops: [
                    { at: 0, color: startColor },
                    { at: 1, color: '#020617' },
                ],
            },
        }));
    };

    const handleSetSolidMode = () => {
        if (background.kind === 'solid') return;
        const initialColor =
            background.kind === 'gradient' ? background.stops[0]?.color || '#07080d' : '#07080d';
        updateProject((p) => ({
            ...p,
            background: { kind: 'solid', color: initialColor },
        }));
    };

    const handleUpdateGradientAngle = (angle: number) => {
        if (background.kind !== 'gradient') return;
        updateProject((p) => ({
            ...p,
            background: { ...background, angle },
        }));
    };

    const handleUpdateStopColor = (index: number, color: string) => {
        if (background.kind !== 'gradient') return;
        const stops = [...background.stops];
        stops[index] = { ...stops[index], color };
        updateProject((p) => ({
            ...p,
            background: { ...background, stops },
        }));
    };

    const handleUpdateStopPosition = (index: number, at: number) => {
        if (background.kind !== 'gradient') return;
        const stops = [...background.stops];
        stops[index] = { ...stops[index], at };
        // Keep stops sorted by position
        stops.sort((a, b) => a.at - b.at);
        updateProject((p) => ({
            ...p,
            background: { ...background, stops },
        }));
    };

    const handleAddStop = () => {
        if (background.kind !== 'gradient') return;
        const stops = [...background.stops];
        const newAt = stops.length > 0 ? (stops[stops.length - 1].at + (stops[0].at || 0)) / 2 : 0.5;
        stops.push({ at: Math.min(0.95, Math.max(0.05, newAt)), color: '#38bdf8' });
        stops.sort((a, b) => a.at - b.at);
        updateProject((p) => ({
            ...p,
            background: { ...background, stops },
        }));
    };

    const handleRemoveStop = (index: number) => {
        if (background.kind !== 'gradient' || background.stops.length <= 2) return;
        const stops = background.stops.filter((_, i) => i !== index);
        updateProject((p) => ({
            ...p,
            background: { ...background, stops },
        }));
    };

    const handleApplyGradientPreset = (preset: (typeof GRADIENT_PRESETS)[0]) => {
        updateProject((p) => ({
            ...p,
            background: {
                kind: 'gradient',
                angle: preset.angle,
                stops: preset.stops.map((s) => ({ ...s })),
            },
        }));
    };

    return (
        <aside className="w-80 border-l border-white/10 bg-[#0c0e17] p-4 flex flex-col gap-4 overflow-y-auto shrink-0 text-xs select-none">
            <div className="font-semibold text-sm text-white flex items-center gap-2">
                <Film className="w-4 h-4 text-indigo-400" />
                <span className="truncate">Shot Settings: {activeShot.name}</span>
            </div>

            {/* STAGE BACKGROUND SECTION */}
            <section className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-3">
                <div className="font-semibold text-gray-200 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                        <Palette className="w-3.5 h-3.5 text-indigo-400" />
                        Stage Background
                    </span>
                    <span className="text-[10px] text-gray-400 capitalize">{background.kind}</span>
                </div>

                {/* Mode Selector */}
                <div className="grid grid-cols-2 gap-1 bg-white/5 p-0.5 rounded-lg border border-white/10">
                    <button
                        type="button"
                        onClick={handleSetSolidMode}
                        className={`py-1 rounded text-[11px] font-medium transition cursor-pointer ${
                            background.kind === 'solid'
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        Solid Color
                    </button>
                    <button
                        type="button"
                        onClick={handleSetGradientMode}
                        className={`py-1 rounded text-[11px] font-medium transition cursor-pointer ${
                            background.kind === 'gradient'
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        Linear Gradient
                    </button>
                </div>

                {/* Solid Color Controls */}
                {background.kind === 'solid' && (
                    <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                            <span className="text-gray-400">Background Color</span>
                            <div className="flex items-center gap-2">
                                <input
                                    type="color"
                                    value={background.color}
                                    onChange={(e) => handleSetSolid(e.target.value)}
                                    className="w-7 h-5 rounded cursor-pointer bg-transparent border border-white/20"
                                />
                                <input
                                    type="text"
                                    value={background.color}
                                    onChange={(e) => handleSetSolid(e.target.value)}
                                    className="w-20 px-2 py-0.5 rounded bg-white/5 border border-white/15 text-white font-mono text-[11px] uppercase outline-none focus:border-indigo-400"
                                />
                            </div>
                        </div>

                        {/* Solid Presets */}
                        <div>
                            <span className="text-[10px] text-gray-500 block mb-1">Color Presets</span>
                            <div className="flex flex-wrap gap-1.5">
                                {SOLID_PRESETS.map((preset) => (
                                    <button
                                        key={preset.name}
                                        type="button"
                                        onClick={() => handleSetSolid(preset.color)}
                                        title={`${preset.name} (${preset.color})`}
                                        className={`w-6 h-6 rounded-md border transition cursor-pointer ${
                                            background.color.toLowerCase() === preset.color.toLowerCase()
                                                ? 'border-indigo-400 scale-110 shadow-sm shadow-indigo-500/50'
                                                : 'border-white/20 hover:border-white/50'
                                        }`}
                                        style={{ backgroundColor: preset.color }}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Gradient Controls */}
                {background.kind === 'gradient' && (
                    <div className="space-y-3">
                        <ScrubInput
                            label="Gradient Angle"
                            value={background.angle}
                            min={0}
                            max={360}
                            step={1}
                            decimals={0}
                            unit="°"
                            onChange={handleUpdateGradientAngle}
                        />

                        {/* Gradient Preview Bar */}
                        <div
                            className="w-full h-6 rounded-lg border border-white/20 shadow-inner"
                            style={{
                                background: `linear-gradient(${background.angle}deg, ${background.stops
                                    .map((s) => `${s.color} ${(s.at * 100).toFixed(0)}%`)
                                    .join(', ')})`,
                            }}
                        />

                        {/* Gradient Stops */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-gray-400">
                                <span>Color Stops</span>
                                <button
                                    type="button"
                                    onClick={handleAddStop}
                                    className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 cursor-pointer"
                                >
                                    <Plus className="w-3 h-3" />
                                    Add Stop
                                </button>
                            </div>

                            <div className="space-y-1.5">
                                {background.stops.map((stop, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center justify-between gap-2 bg-white/5 p-1.5 rounded-lg border border-white/10"
                                    >
                                        <input
                                            type="color"
                                            value={stop.color}
                                            onChange={(e) => handleUpdateStopColor(index, e.target.value)}
                                            className="w-6 h-5 rounded cursor-pointer bg-transparent border border-white/20 shrink-0"
                                        />
                                        <div className="flex-1">
                                            <ScrubInput
                                                label={`Stop #${index + 1}`}
                                                value={Math.round(stop.at * 100)}
                                                min={0}
                                                max={100}
                                                step={1}
                                                decimals={0}
                                                unit="%"
                                                onChange={(pct) => handleUpdateStopPosition(index, pct / 100)}
                                            />
                                        </div>
                                        {background.stops.length > 2 && (
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveStop(index)}
                                                className="p-1 rounded text-red-400 hover:bg-red-500/20 transition cursor-pointer shrink-0"
                                                title="Delete stop"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Gradient Presets */}
                        <div>
                            <span className="text-[10px] text-gray-500 block mb-1.5">Gradient Presets</span>
                            <div className="grid grid-cols-2 gap-1.5">
                                {GRADIENT_PRESETS.map((preset) => (
                                    <button
                                        key={preset.name}
                                        type="button"
                                        onClick={() => handleApplyGradientPreset(preset)}
                                        className="flex items-center gap-2 p-1.5 rounded bg-white/5 border border-white/10 hover:border-indigo-400/50 transition cursor-pointer text-left"
                                    >
                                        <div
                                            className="w-4 h-4 rounded shrink-0 border border-white/20"
                                            style={{
                                                background: `linear-gradient(${preset.angle}deg, ${preset.stops
                                                    .map((s) => `${s.color} ${(s.at * 100).toFixed(0)}%`)
                                                    .join(', ')})`,
                                            }}
                                        />
                                        <span className="truncate text-[10px] text-gray-300">{preset.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </section>

            {/* SHOT-TO-SHOT TRANSITION */}
            <section className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-3">
                <div className="font-semibold text-gray-200 flex items-center gap-1.5">
                    <Scissors className="w-3.5 h-3.5 text-indigo-400" />
                    Shot-to-Shot Transition
                </div>
                <label className="flex items-center justify-between gap-3 text-gray-400">
                    <span>Transition Type</span>
                    <select
                        value={activeShot.transition.type}
                        onChange={(e) =>
                            updateShot(activeShot.id, (shot) => ({
                                ...shot,
                                transition: {
                                    ...shot.transition,
                                    type: e.target.value as Shot['transition']['type'],
                                },
                            }))
                        }
                        className="max-w-40 bg-white/5 border border-white/15 rounded px-2 py-1.5 text-white outline-none"
                    >
                        <option value="cut" className="bg-[#0c0e17]">
                            Cut
                        </option>
                        <option value="crossfade" className="bg-[#0c0e17]">
                            Crossfade
                        </option>
                        <option value="push" className="bg-[#0c0e17]">
                            Push
                        </option>
                        <option value="slide" className="bg-[#0c0e17]">
                            Slide
                        </option>
                    </select>
                </label>

                {activeShot.transition.type !== 'cut' && (
                    <ScrubInput
                        label="Transition Duration"
                        value={activeShot.transition.durationMs}
                        min={100}
                        max={2000}
                        step={50}
                        decimals={0}
                        unit="ms"
                        onChange={(durationMs) =>
                            updateShot(activeShot.id, (shot) => ({
                                ...shot,
                                transition: { ...shot.transition, durationMs },
                            }))
                        }
                    />
                )}
                <p className="text-[10px] leading-relaxed text-gray-500">
                    This setting is stored on the selected shot and used by the stage transition evaluator. A
                    transition is most visible when playback reaches the beginning of this shot.
                </p>
            </section>

            {/* SCENE LIGHT RIG */}
            <section className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-3">
                <div className="font-semibold text-gray-200 flex items-center gap-1.5">
                    <Sun className="w-3.5 h-3.5 text-amber-400" />
                    Scene Light Rig
                </div>
                <ScrubInput
                    label="Light X Position"
                    value={activeShot.light.position.x}
                    min={-0.6}
                    max={0.6}
                    step={0.02}
                    decimals={2}
                    onChange={(x) =>
                        updateShot(activeShot.id, (shot) => ({
                            ...shot,
                            light: { ...shot.light, position: { ...shot.light.position, x } },
                        }))
                    }
                />
                <ScrubInput
                    label="Light Y Position"
                    value={activeShot.light.position.y}
                    min={-0.6}
                    max={0.6}
                    step={0.02}
                    decimals={2}
                    onChange={(y) =>
                        updateShot(activeShot.id, (shot) => ({
                            ...shot,
                            light: { ...shot.light, position: { ...shot.light.position, y } },
                        }))
                    }
                />
                <ScrubInput
                    label="Light Intensity"
                    value={activeShot.light.intensity}
                    min={0}
                    max={2.5}
                    step={0.05}
                    decimals={2}
                    onChange={(intensity) =>
                        updateShot(activeShot.id, (shot) => ({ ...shot, light: { ...shot.light, intensity } }))
                    }
                />
                <ScrubInput
                    label="Color Temp (Kelvin)"
                    value={activeShot.light.temperature}
                    min={2500}
                    max={9500}
                    step={100}
                    decimals={0}
                    unit="K"
                    onChange={(temperature) =>
                        updateShot(activeShot.id, (shot) => ({ ...shot, light: { ...shot.light, temperature } }))
                    }
                />
            </section>
        </aside>
    );
};
