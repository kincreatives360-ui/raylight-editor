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
    const { updateShot, beginDragTransaction, commitDragTransaction } = useProjectStore();
    const { selectedLightBlockId, selectLightBlock, setTimelineView } = useSelectionStore();
    const { light } = activeShot;
    const selectedLightBlock = (activeShot.lightBlocks || []).find(
        (b) => b.id === selectedLightBlockId
    );

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-white">Light Sources</span>
                <select aria-label="Add light source type" className="rounded-md bg-[#18181b] border border-white/10 px-2 py-1 text-[10px] text-white" defaultValue="" onChange={(e) => {
                    if (!e.target.value) return;
                    const type = e.target.value as import('../../../model/types').LightSourceType;
                    updateShot(activeShot.id, (shot) => ({ ...shot, light: { ...shot.light, sources: [...(shot.light.sources || []), { id: `light-${Date.now()}`, name: `${type[0].toUpperCase()}${type.slice(1)} Light`, type, enabled: true, position: { ...shot.light.position }, intensity: 1, color: '#ffffff', temperature: 6100, distance: 8, angle: Math.PI / 5, penumbra: 0.35, width: 2, height: 2 }] } }));
                    e.currentTarget.value = ''; 
                }}>
                    <option value="">+ Add light source…</option><option value="point">Point light</option><option value="directional">Directional light</option><option value="spot">Spot light</option><option value="area">Area light</option><option value="ambient">Ambient light</option>
                </select>
            </div>
            {(activeShot.light.sources || []).map((source) => <div key={source.id} className="rounded-lg border border-white/10 p-2 space-y-2">
                <div className="flex items-center justify-between text-[10px] text-white"><span>{source.name} · {source.type}</span><div className="flex gap-2"><input aria-label={`${source.name} color`} type="color" value={source.color} onChange={(e) => updateShot(activeShot.id, (shot) => ({ ...shot, light: { ...shot.light, sources: (shot.light.sources || []).map((l) => l.id === source.id ? { ...l, color: e.target.value } : l) } }))} /><button type="button" className="text-rose-300" onClick={() => updateShot(activeShot.id, (shot) => ({ ...shot, light: { ...shot.light, sources: (shot.light.sources || []).filter((l) => l.id !== source.id) } }))}>Remove</button></div></div>
                <label className="flex items-center gap-2 text-[10px] text-gray-300"><input type="checkbox" checked={source.enabled} onChange={(e) => updateShot(activeShot.id, (shot) => ({ ...shot, light: { ...shot.light, sources: (shot.light.sources || []).map((l) => l.id === source.id ? { ...l, enabled: e.target.checked } : l) } }))}/> Enabled</label>
                <div className="space-y-1">
                    <span className="text-[9px] text-gray-400">Position</span>
                    <div className="grid grid-cols-3 gap-1.5">
                        <label className="text-[9px] text-gray-400">
                            X:
                            <input
                                type="number"
                                step="0.05"
                                className="w-full rounded bg-[#11131b] border border-white/10 px-1.5 py-0.5 text-[10px] text-white"
                                value={source.position?.x ?? 0}
                                onChange={(e) => {
                                    const val = Number(e.target.value);
                                    updateShot(activeShot.id, (shot) => ({
                                        ...shot,
                                        light: {
                                            ...shot.light,
                                            sources: (shot.light.sources || []).map((l) =>
                                                l.id === source.id
                                                    ? { ...l, position: { ...(l.position || { x: 0, y: 0, z: 0 }), x: val } }
                                                    : l
                                            ),
                                        },
                                    }));
                                }}
                            />
                        </label>
                        <label className="text-[9px] text-gray-400">
                            Y:
                            <input
                                type="number"
                                step="0.05"
                                className="w-full rounded bg-[#11131b] border border-white/10 px-1.5 py-0.5 text-[10px] text-white"
                                value={source.position?.y ?? 0}
                                onChange={(e) => {
                                    const val = Number(e.target.value);
                                    updateShot(activeShot.id, (shot) => ({
                                        ...shot,
                                        light: {
                                            ...shot.light,
                                            sources: (shot.light.sources || []).map((l) =>
                                                l.id === source.id
                                                    ? { ...l, position: { ...(l.position || { x: 0, y: 0, z: 0 }), y: val } }
                                                    : l
                                            ),
                                        },
                                    }));
                                }}
                            />
                        </label>
                        <label className="text-[9px] text-gray-400">
                            Z:
                            <input
                                type="number"
                                step="0.05"
                                className="w-full rounded bg-[#11131b] border border-white/10 px-1.5 py-0.5 text-[10px] text-white"
                                value={source.position?.z ?? 0}
                                onChange={(e) => {
                                    const val = Number(e.target.value);
                                    updateShot(activeShot.id, (shot) => ({
                                        ...shot,
                                        light: {
                                            ...shot.light,
                                            sources: (shot.light.sources || []).map((l) =>
                                                l.id === source.id
                                                    ? { ...l, position: { ...(l.position || { x: 0, y: 0, z: 0 }), z: val } }
                                                    : l
                                            ),
                                        },
                                    }));
                                }}
                            />
                        </label>
                    </div>
                </div>
                <label className="block text-[10px] text-gray-400">Intensity <input className="w-full" type="range" min="0" max="5" step="0.1" value={source.intensity} onPointerDown={() => beginDragTransaction()} onPointerUp={() => commitDragTransaction()} onChange={(e) => updateShot(activeShot.id, (shot) => ({ ...shot, light: { ...shot.light, sources: (shot.light.sources || []).map((l) => l.id === source.id ? { ...l, intensity: Number(e.target.value) } : l) } }))}/></label>
            </div>)}

        <div className="p-3.5 space-y-3">
            <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-[#e4e4e7]">Lighting</span>
                <button
                    type="button"
                    onClick={() => {
                        const newLightId = `light-blk-${Date.now()}`;
                        updateShot(activeShot.id, (s) => ({
                            ...s,
                            lightBlocks: [
                                ...(s.lightBlocks || []),
                                {
                                    id: newLightId,
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
                        selectLightBlock(newLightId);
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

            {selectedLightBlock && (
                <div className="pt-2 border-t border-white/[0.08] space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium text-amber-300">
                            {selectedLightBlock.label || 'Light Sweep Block'}
                        </span>
                        <button
                            type="button"
                            onClick={() => {
                                updateShot(activeShot.id, (s) => ({
                                    ...s,
                                    lightBlocks: (s.lightBlocks || []).filter(
                                        (b) => b.id !== selectedLightBlock.id
                                    ),
                                }));
                                selectLightBlock(null);
                            }}
                            className="text-[10px] text-rose-400 hover:text-rose-300 cursor-pointer"
                        >
                            Delete
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                        <ScrubInput
                            label="🕒"
                            value={selectedLightBlock.startMs}
                            min={0}
                            max={activeShot.durationMs - 100}
                            step={20}
                            unit=" ms"
                            onChange={(startMs) =>
                                updateShot(activeShot.id, (s) => ({
                                    ...s,
                                    lightBlocks: (s.lightBlocks || []).map((b) =>
                                        b.id === selectedLightBlock.id ? { ...b, startMs } : b
                                    ),
                                }))
                            }
                        />
                        <ScrubInput
                            label="⏱"
                            value={selectedLightBlock.durationMs}
                            min={100}
                            max={activeShot.durationMs}
                            step={20}
                            unit=" ms"
                            onChange={(durationMs) =>
                                updateShot(activeShot.id, (s) => ({
                                    ...s,
                                    lightBlocks: (s.lightBlocks || []).map((b) =>
                                        b.id === selectedLightBlock.id ? { ...b, durationMs } : b
                                    ),
                                }))
                            }
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                        <ScrubInput
                            label="From X"
                            value={Math.round(selectedLightBlock.fromX * 100)}
                            min={-100}
                            max={100}
                            step={2}
                            unit="%"
                            onChange={(val) =>
                                updateShot(activeShot.id, (s) => ({
                                    ...s,
                                    lightBlocks: (s.lightBlocks || []).map((b) =>
                                        b.id === selectedLightBlock.id
                                            ? { ...b, fromX: Number((val / 100).toFixed(2)) }
                                            : b
                                    ),
                                }))
                            }
                        />
                        <ScrubInput
                            label="To X"
                            value={Math.round(selectedLightBlock.toX * 100)}
                            min={-100}
                            max={100}
                            step={2}
                            unit="%"
                            onChange={(val) =>
                                updateShot(activeShot.id, (s) => ({
                                    ...s,
                                    lightBlocks: (s.lightBlocks || []).map((b) =>
                                        b.id === selectedLightBlock.id
                                            ? { ...b, toX: Number((val / 100).toFixed(2)) }
                                            : b
                                    ),
                                }))
                            }
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                        <ScrubInput
                            label="From Y"
                            value={Math.round(selectedLightBlock.fromY * 100)}
                            min={-100}
                            max={100}
                            step={2}
                            unit="%"
                            onChange={(val) =>
                                updateShot(activeShot.id, (s) => ({
                                    ...s,
                                    lightBlocks: (s.lightBlocks || []).map((b) =>
                                        b.id === selectedLightBlock.id
                                            ? { ...b, fromY: Number((val / 100).toFixed(2)) }
                                            : b
                                    ),
                                }))
                            }
                        />
                        <ScrubInput
                            label="To Y"
                            value={Math.round(selectedLightBlock.toY * 100)}
                            min={-100}
                            max={100}
                            step={2}
                            unit="%"
                            onChange={(val) =>
                                updateShot(activeShot.id, (s) => ({
                                    ...s,
                                    lightBlocks: (s.lightBlocks || []).map((b) =>
                                        b.id === selectedLightBlock.id
                                            ? { ...b, toY: Number((val / 100).toFixed(2)) }
                                            : b
                                    ),
                                }))
                            }
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                        <ScrubInput
                            label="From Int"
                            value={Math.round(selectedLightBlock.fromIntensity * 100)}
                            min={0}
                            max={250}
                            step={5}
                            unit="%"
                            onChange={(val) =>
                                updateShot(activeShot.id, (s) => ({
                                    ...s,
                                    lightBlocks: (s.lightBlocks || []).map((b) =>
                                        b.id === selectedLightBlock.id
                                            ? { ...b, fromIntensity: Number((val / 100).toFixed(2)) }
                                            : b
                                    ),
                                }))
                            }
                        />
                        <ScrubInput
                            label="To Int"
                            value={Math.round(selectedLightBlock.toIntensity * 100)}
                            min={0}
                            max={250}
                            step={5}
                            unit="%"
                            onChange={(val) =>
                                updateShot(activeShot.id, (s) => ({
                                    ...s,
                                    lightBlocks: (s.lightBlocks || []).map((b) =>
                                        b.id === selectedLightBlock.id
                                            ? { ...b, toIntensity: Number((val / 100).toFixed(2)) }
                                            : b
                                    ),
                                }))
                            }
                        />
                    </div>
                </div>
            )}
        </div>
        </div>
    );
};