import type { Layer } from '../../../model/types';
import { useProjectStore } from '../../../store/useProjectStore';
import { ScrubInput } from '../../../ui/ScrubInput';
export function LayerMaterialSection({ shotId, layer: selectedLayer }: { shotId: string; layer: Layer }) {    
const { updateLayer } = useProjectStore(); const activeShot = { id: shotId }; return <>                                {/* 3D Lighting & Material Response */}
        <div className="space-y-2 pt-2 border-t border-white/[0.06]">
            <div className="flex items-center justify-between">
                <div className="flex flex-col">
                    <span className="text-[11px] font-medium text-white">Receives 3D Light</span>
                    <span className="text-[10px] text-[#a1a1aa] tracking-tight">
                        {selectedLayer.kind === 'text' ? 'Unlit preserves flat, crisp typography' : 'Shades surface with scene lighting'}
                    </span>
                </div>
                <input
                    type="checkbox"
                    checked={
                        selectedLayer.receivesLight !== undefined
                            ? selectedLayer.receivesLight
                            : selectedLayer.kind === 'image' || selectedLayer.kind === 'video'
                    }
                    onChange={(e) => {
                        const receivesLight = e.target.checked;
                        updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                            ...l,
                            receivesLight,
                        }));
                    }}
                    className="w-3.5 h-3.5 rounded accent-amber-500 cursor-pointer"
                />
            </div>

            {(selectedLayer.receivesLight ?? (selectedLayer.kind === 'image' || selectedLayer.kind === 'video')) && (
                <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between gap-1 text-[10px] text-[#a1a1aa] tracking-tight">
                        <span>Material Presets:</span>
                        <div className="flex gap-1">
                            <button
                                type="button"
                                onClick={() =>
                                    updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                        ...l,
                                        material: { roughness: 0.08, metalness: 0.12 },
                                    }))
                                }
                                className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-white cursor-pointer"
                            >
                                Glass
                            </button>
                            <button
                                type="button"
                                onClick={() =>
                                    updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                        ...l,
                                        material: { roughness: 0.5, metalness: 0.02 },
                                    }))
                                }
                                className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-white cursor-pointer"
                            >
                                Matte
                            </button>
                            <button
                                type="button"
                                onClick={() =>
                                    updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                        ...l,
                                        material: { roughness: 0.22, metalness: 0.92 },
                                    }))
                                }
                                className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-white cursor-pointer"
                            >
                                Metal
                            </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                        <ScrubInput
                            label="Roughness"
                            value={Math.round((selectedLayer.material?.roughness ?? (selectedLayer.kind === 'text' ? 0.45 : 0.24)) * 100)}
                            min={0}
                            max={100}
                            step={2}
                            unit="%"
                            onChange={(pct) =>
                                updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                    ...l,
                                    material: {
                                        ...l.material,
                                        roughness: Number((pct / 100).toFixed(2)),
                                    },
                                }))
                            }
                        />
                        <ScrubInput
                            label="Metalness"
                            value={Math.round((selectedLayer.material?.metalness ?? 0.06) * 100)}
                            min={0}
                            max={100}
                            step={2}
                            unit="%"
                            onChange={(pct) =>
                                updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                    ...l,
                                    material: {
                                        ...l.material,
                                        metalness: Number((pct / 100).toFixed(2)),
                                    },
                                }))
                            }
                        />
                    </div>
                </div>
            )}
        </div>

    </>;
}
