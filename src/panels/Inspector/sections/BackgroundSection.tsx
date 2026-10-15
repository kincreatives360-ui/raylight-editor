// src/panels/Inspector/sections/BackgroundSection.tsx
import React from 'react';
import { Palette } from 'lucide-react';
import type { Shot } from '../../../model/types';
import { useProjectStore } from '../../../store/useProjectStore';

interface BackgroundSectionProps {
    activeShot: Shot;
}

const PRESET_COLORS = [
    { name: 'Midnight', color: '#07080d' },
    { name: 'Navy', color: '#030349' },
    { name: 'Slate', color: '#0f172a' },
    { name: 'Zinc Noir', color: '#09090b' },
    { name: 'Deep Violet', color: '#1e1035' },
    { name: 'Pure Black', color: '#000000' },
];

export const BackgroundSection: React.FC<BackgroundSectionProps> = () => {
    const { project, updateProject } = useProjectStore();
    const bg = project.background;

    const handleSetSolid = (color: string) => {
        updateProject((p) => ({
            ...p,
            background: { kind: 'solid', color },
        }));
    };

    return (
        <div className="p-3.5 space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-[11px] font-medium text-[#e4e4e7]">
                        Background
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={() =>
                            updateProject((p) => ({
                                ...p,
                                background: {
                                    kind: 'solid',
                                    color: p.background.kind === 'solid' ? p.background.color : '#070913',
                                },
                            }))
                        }
                        className={`px-2 py-0.5 rounded text-[10px] font-medium transition cursor-pointer ${
                            bg.kind === 'solid'
                                ? 'bg-[#0088ff] text-white'
                                : 'bg-[#1c1c1f] text-[#71717a] hover:text-white'
                        }`}
                    >
                        Solid
                    </button>
                    <button
                        type="button"
                        onClick={() =>
                            updateProject((p) => ({
                                ...p,
                                background: {
                                    kind: 'gradient',
                                    angle: 135,
                                    stops: [
                                        { at: 0, color: '#030349' },
                                        { at: 1, color: '#181824' },
                                    ],
                                },
                            }))
                        }
                        className={`px-2 py-0.5 rounded text-[10px] font-medium transition cursor-pointer ${
                            bg.kind === 'gradient'
                                ? 'bg-[#0088ff] text-white'
                                : 'bg-[#1c1c1f] text-[#71717a] hover:text-white'
                        }`}
                    >
                        Gradient
                    </button>
                </div>
            </div>

            {/* Solid Color Picker and Swatches */}
            {bg.kind === 'solid' ? (
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <input
                            type="color"
                            value={bg.color || '#070913'}
                            onChange={(e) => handleSetSolid(e.target.value)}
                            className="w-7 h-7 rounded-lg border border-white/10 bg-transparent cursor-pointer p-0.5 shrink-0"
                        />
                        <input
                            type="text"
                            value={bg.color || '#070913'}
                            onChange={(e) => handleSetSolid(e.target.value)}
                            className="flex-1 h-7 px-2.5 rounded-lg bg-[#1c1c1f] border border-white/[0.06] text-[11px] font-mono text-white outline-none focus:border-[#0088ff]"
                        />
                    </div>

                    <div className="grid grid-cols-6 gap-1 pt-1">
                        {PRESET_COLORS.map(({ name, color }) => (
                            <button
                                key={color}
                                type="button"
                                onClick={() => handleSetSolid(color)}
                                title={name}
                                className={`w-full h-6 rounded-md border transition cursor-pointer ${
                                    bg.color === color
                                        ? 'border-[#0088ff] scale-105 shadow-sm'
                                        : 'border-white/10 hover:border-white/30'
                                }`}
                                style={{ backgroundColor: color }}
                            />
                        ))}
                    </div>
                </div>
            ) : (
                <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-1.5">
                            <input
                                type="color"
                                value={bg.stops[0]?.color || '#030349'}
                                onChange={(e) => {
                                    const col = e.target.value;
                                    updateProject((p) => {
                                        const stops = p.background.kind === 'gradient' ? p.background.stops : [
                                            { at: 0, color: '#030349' },
                                            { at: 1, color: '#181824' },
                                        ];
                                        return {
                                            ...p,
                                            background: {
                                                kind: 'gradient',
                                                angle: p.background.kind === 'gradient' ? p.background.angle : 135,
                                                stops: [
                                                    { at: 0, color: col },
                                                    stops[1] || { at: 1, color: '#181824' },
                                                ],
                                            },
                                        };
                                    });
                                }}
                                className="w-6 h-6 rounded border border-white/10 bg-transparent cursor-pointer"
                            />
                            <span className="text-[10px] text-[#71717a]">Start</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <input
                                type="color"
                                value={bg.stops[1]?.color || '#181824'}
                                onChange={(e) => {
                                    const col = e.target.value;
                                    updateProject((p) => {
                                        const stops = p.background.kind === 'gradient' ? p.background.stops : [
                                            { at: 0, color: '#030349' },
                                            { at: 1, color: '#181824' },
                                        ];
                                        return {
                                            ...p,
                                            background: {
                                                kind: 'gradient',
                                                angle: p.background.kind === 'gradient' ? p.background.angle : 135,
                                                stops: [
                                                    stops[0] || { at: 0, color: '#030349' },
                                                    { at: 1, color: col },
                                                ],
                                            },
                                        };
                                    });
                                }}
                                className="w-6 h-6 rounded border border-white/10 bg-transparent cursor-pointer"
                            />
                            <span className="text-[10px] text-[#71717a]">End</span>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-[#71717a]">
                            <span>Angle</span>
                            <span className="font-mono text-white/80">{bg.angle}°</span>
                        </div>
                        <input
                            type="range"
                            min={0}
                            max={360}
                            value={bg.angle}
                            onChange={(e) =>
                                updateProject((p) => ({
                                    ...p,
                                    background: {
                                        ...p.background,
                                        angle: Number(e.target.value),
                                    },
                                }))
                            }
                            className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-[#1c1c1f] accent-[#0088ff]"
                        />
                    </div>
                </div>
            )}
        </div>
    );
};
