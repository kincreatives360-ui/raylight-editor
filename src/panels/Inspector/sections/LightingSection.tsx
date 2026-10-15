// src/panels/Inspector/sections/LightingSection.tsx
import React from 'react';
import { Sun, Crosshair } from 'lucide-react';
import type { Shot } from '../../../model/types';
import { useProjectStore } from '../../../store/useProjectStore';
import { ScrubInput } from '../../../ui/ScrubInput';
import { kelvinToRgb } from '../../../stage/Stage';

interface LightingSectionProps {
    activeShot: Shot;
}

export const LightingSection: React.FC<LightingSectionProps> = ({ activeShot }) => {
    const { updateShot } = useProjectStore();
    const light = activeShot.light;

    const kelvinColor = kelvinToRgb(light.temperature, 1).css;

    const updateLight = (patch: Partial<Shot['light']>) => {
        updateShot(activeShot.id, (s) => ({
            ...s,
            light: { ...s.light, ...patch },
        }));
    };

    return (
        <div className="p-3.5 space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    <Sun className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-[11px] font-medium text-[#e4e4e7]">
                        Physical Lighting
                    </span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div
                        className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-inner"
                        style={{ backgroundColor: kelvinColor }}
                        title={`${light.temperature}K`}
                    />
                    <span className="text-[10px] font-mono text-[#a1a1aa]">
                        {light.temperature}K
                    </span>
                </div>
            </div>

            {/* Sun / Key Light Position (X, Y) */}
            <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[#71717a]">Light Direction</span>
                    <button
                        type="button"
                        onClick={() =>
                            updateLight({ position: { x: 0.25, y: 0.45, z: light.position.z } })
                        }
                        title="Reset Sun Angle"
                        className="text-[#71717a] hover:text-white cursor-pointer"
                    >
                        <Crosshair className="w-3 h-3" />
                    </button>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                    <ScrubInput
                        label="X"
                        value={light.position.x}
                        min={-1}
                        max={1}
                        step={0.02}
                        decimals={2}
                        onChange={(x) =>
                            updateLight({
                                position: { ...light.position, x },
                            })
                        }
                    />
                    <ScrubInput
                        label="Y"
                        value={light.position.y}
                        min={-1}
                        max={1}
                        step={0.02}
                        decimals={2}
                        onChange={(y) =>
                            updateLight({
                                position: { ...light.position, y },
                            })
                        }
                    />
                </div>
            </div>

            {/* Intensity & Ambience */}
            <div className="grid grid-cols-2 gap-1.5">
                <ScrubInput
                    label="Intensity"
                    value={light.intensity}
                    min={0}
                    max={4}
                    step={0.05}
                    decimals={2}
                    onChange={(intensity) => updateLight({ intensity })}
                />
                <ScrubInput
                    label="Ambience"
                    value={light.ambience}
                    min={0}
                    max={1}
                    step={0.02}
                    decimals={2}
                    onChange={(ambience) => updateLight({ ambience })}
                />
            </div>

            {/* Color Temperature (Kelvin) Slider */}
            <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] text-[#71717a]">
                    <span>Temperature</span>
                    <span className="font-mono text-white/80">{light.temperature}K</span>
                </div>
                <input
                    type="range"
                    min={2000}
                    max={10000}
                    step={100}
                    value={light.temperature}
                    onChange={(e) =>
                        updateLight({ temperature: Number(e.target.value) })
                    }
                    className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-gradient-to-r from-amber-500 via-white to-sky-400 accent-[#0088ff]"
                />
            </div>
        </div>
    );
};
