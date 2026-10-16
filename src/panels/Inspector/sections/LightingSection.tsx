// src/panels/Inspector/sections/LightingSection.tsx
import React from 'react';
import { Plus } from 'lucide-react';
import type { Shot } from '../../../model/types';
import { useProjectStore } from '../../../store/useProjectStore';
import { useSelectionStore } from '../../../store/useSelectionStore';
import { ScrubInput } from '../../../ui/ScrubInput';

interface LightingSectionProps {
    activeShot: Shot;
}

export const LightingSection: React.FC<LightingSectionProps> = ({
    activeShot,
}) => {
    const { updateShot } = useProjectStore();
    const { setTimelineView } = useSelectionStore();
    const { light } = activeShot;

    return (
        <div className="p-3.5 space-y-3">
            <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-[#e4e4e7]">Lighting</span>
                <button
                    type="button"
                    onClick={() => {
                        updateShot(activeShot.id, (s) => ({
                            ...s,
                            lightBlocks: [
                                ...(s.lightBlocks || []),
                                {
                                    id: `light-blk-${Date.now()}`,
                                    label: 'Light Sweep',
                                    startMs: 0,
                                    durationMs: s.durationMs,
                                    fromX: -0.35,
                                    fromY: 0.35,
                                    toX: 0.35,
                                    toY: 0.25,
                                    fromIntensity: s.light.intensity,
                                    toIntensity: s.light.intensity,
                                    easing: { kind: 'preset', name: 'ease-in-out' },
                                },
                            ],
                        }));
                        setTimelineView('scene');
                    }}
                    title="Animate Light Sweep on Timeline"
                    className="px-2 py-0.5 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-[10px] flex items-center gap-1 cursor-pointer transition"
                >
                    <Plus className="w-3 h-3" />
                    <span>Animate</span>
                </button>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
                <ScrubInput
                    label="X"
                    value={Math.round(light.position.x * 100)}
                    min={-100}
                    max={100}
                    step={2}
                    unit="%"
                    onChange={(pctX) =>
                        updateShot(activeShot.id, (s) => ({
                            ...s,
                            light: {
                                ...s.light,
                                position: {
                                    ...s.light.position,
                                    x: Number((pctX / 100).toFixed(2)),
                                },
                            },
                        }))
                    }
                />
                <ScrubInput
                    label="Y"
                    value={Math.round(light.position.y * 100)}
                    min={-100}
                    max={100}
                    step={2}
                    unit="%"
                    onChange={(pctY) =>
                        updateShot(activeShot.id, (s) => ({
                            ...s,
                            light: {
                                ...s.light,
                                position: {
                                    ...s.light.position,
                                    y: Number((pctY / 100).toFixed(2)),
                                },
                            },
                        }))
                    }
                />
            </div>

            <div className="grid grid-cols-2 gap-1.5">
                <ScrubInput
                    label="Intensity"
                    value={Math.round(light.intensity * 100)}
                    min={0}
                    max={250}
                    step={5}
                    unit="%"
                    onChange={(pct) =>
                        updateShot(activeShot.id, (s) => ({
                            ...s,
                            light: { ...s.light, intensity: Number((pct / 100).toFixed(2)) },
                        }))
                    }
                />
                <ScrubInput
                    label="Temp"
                    value={light.temperature}
                    min={2500}
                    max={9500}
                    step={100}
                    unit="K"
                    onChange={(temperature) =>
                        updateShot(activeShot.id, (s) => ({
                            ...s,
                            light: { ...s.light, temperature },
                        }))
                    }
                />
            </div>
        </div>
    );
};