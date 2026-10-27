import { Copy, Droplet, Eye, Layers, Minus, Plus, Spline, Zap } from 'lucide-react';
import type { Layer } from '../../../model/types';
import { useProjectStore } from '../../../store/useProjectStore';
import { FigmaSelect } from '../../../ui/FigmaSelect';
import { ScrubInput } from '../../../ui/ScrubInput';
import { ColorPicker } from '../ColorPicker';
const refStageW = 1920;
const refStageH = 1080;
export function LayerEffectsSection({ activeShotId, layer }: {
    activeShotId: string;
    layer: Layer;
}) {
    const { updateLayer } = useProjectStore();
    // Effects helpers
    const handleAddEffect = (effectId: string) => {
        updateLayer(activeShotId, layer.id, (l) => {
            const effects = { ...l.effects };
            if (effectId === 'dropShadow') {
                effects.dropShadow = {
                    enabled: true,
                    color: '#000000',
                    opacity: 0.5,
                    blur: 16 / refStageW,
                    offsetX: 0,
                    offsetY: 8 / refStageH,
                };
            }
            else if (effectId === 'glow') {
                effects.glow = {
                    enabled: true,
                    color: '#0088ff',
                    intensity: 1,
                    radius: 12 / refStageW,
                };
            }
            else if (effectId === 'backdropBlur') {
                effects.backdropBlur = 12 / 100;
            }
            else if (effectId === 'layerBlur') {
                effects.layerBlur = 12 / 100;
            }
            else if (effectId === 'liquidGlass') {
                effects.liquidGlass = {
                    enabled: true,
                    refraction: 0.5,
                    roughness: 0.1,
                    tint: '#ffffff',
                };
            }
            else if (effectId === 'warp') {
                effects.warp = {
                    enabled: true,
                    amount: 10,
                    frequency: 1,
                };
            }
            return { ...l, effects };
        });
    };
    const handleRemoveEffect = (effectId: string) => {
        updateLayer(activeShotId, layer.id, (l) => {
            const effects = { ...l.effects };
            if (effectId === 'dropShadow')
                delete effects.dropShadow;
            if (effectId === 'glow')
                delete effects.glow;
            if (effectId === 'backdropBlur')
                delete effects.backdropBlur;
            if (effectId === 'layerBlur')
                delete effects.layerBlur;
            if (effectId === 'liquidGlass')
                delete effects.liquidGlass;
            if (effectId === 'warp')
                delete effects.warp;
            return { ...l, effects };
        });
    };
    return <section aria-label="Layer effects">            {/* 8. LAYER EFFECTS */}
        <div className="p-3.5 space-y-2.5 relative">
            <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold text-[#e4e4e7]">
                    Layer effects
                </span>
                <FigmaSelect aria-label="Add layer effect" title="Add Layer Effect" className="object-design-effect-add" value="" onChange={(event) => handleAddEffect(event.target.value)}><option value=""><Plus /></option>{[{ id: 'dropShadow', label: 'Drop shadow' }, { id: 'glow', label: 'Glow' }, { id: 'backdropBlur', label: 'Backdrop blur' }, { id: 'layerBlur', label: 'Layer blur' }, { id: 'liquidGlass', label: 'Liquid glass' }, { id: 'warp', label: 'Warp' }].map(effect => <option key={effect.id} value={effect.id}>{effect.label}</option>)}</FigmaSelect>
            </div>

            {/* Active Effects Cards */}
            <div className="space-y-2">
                {/* Drop Shadow */}
                {layer.effects?.dropShadow?.enabled && (<details className="object-design-effect">
                    <summary className="flex items-center justify-between text-[11px] font-medium text-[#e4e4e7]">
                        <div className="flex items-center gap-1.5">
                            <Copy className="w-3.5 h-3.5 text-[#a1a1aa]" />
                            <span>Drop shadow</span>
                        </div>
                        <button type="button" onClick={(event) => { event.preventDefault(); handleRemoveEffect('dropShadow'); }} className="p-0.5 rounded hover:bg-white/10 text-[#a1a1aa] hover:text-white cursor-pointer" title="Remove Drop Shadow">
                            <Minus className="w-3 h-3" />
                        </button>
                    </summary>
                    <div className="grid grid-cols-2 gap-2"><ColorPicker label="Shadow color" color={layer.effects.dropShadow.color} onChange={(color) => updateLayer(activeShotId, layer.id, l => l.effects.dropShadow ? { ...l, effects: { ...l.effects, dropShadow: { ...l.effects.dropShadow, color } } } : l)} /><ScrubInput label="Opacity" value={Math.round(layer.effects.dropShadow.opacity * 100)} min={0} max={100} unit=" %" onChange={(v) => updateLayer(activeShotId, layer.id, l => l.effects.dropShadow ? { ...l, effects: { ...l.effects, dropShadow: { ...l.effects.dropShadow, opacity: v / 100 } } } : l)} /></div>                            <div className="grid grid-cols-3 gap-1.5">
                        <ScrubInput label="Blur" value={layer.effects.dropShadow.blur * refStageW} min={0} max={100} step={1} unit=" px" onChange={(blur) => updateLayer(activeShotId, layer.id, (l) => l.effects.dropShadow
                            ? {
                                ...l,
                                effects: {
                                    ...l.effects,
                                    dropShadow: { ...l.effects.dropShadow, blur: blur / refStageW },
                                },
                            }
                            : l)} />
                        <ScrubInput label="X" value={layer.effects.dropShadow.offsetX * refStageW} min={-100} max={100} step={1} unit=" px" onChange={(offsetX) => updateLayer(activeShotId, layer.id, (l) => l.effects.dropShadow
                            ? {
                                ...l,
                                effects: {
                                    ...l.effects,
                                    dropShadow: { ...l.effects.dropShadow, offsetX: offsetX / refStageW },
                                },
                            }
                            : l)} />
                        <ScrubInput label="Y" value={layer.effects.dropShadow.offsetY * refStageH} min={-100} max={100} step={1} unit=" px" onChange={(offsetY) => updateLayer(activeShotId, layer.id, (l) => l.effects.dropShadow
                            ? {
                                ...l,
                                effects: {
                                    ...l.effects,
                                    dropShadow: { ...l.effects.dropShadow, offsetY: offsetY / refStageH },
                                },
                            }
                            : l)} />
                    </div>
                </details>)}

                {/* Glow */}
                {layer.effects?.glow?.enabled && (<details className="object-design-effect">
                    <summary className="flex items-center justify-between text-[11px] font-medium text-[#e4e4e7]">
                        <div className="flex items-center gap-1.5">
                            <Zap className="w-3.5 h-3.5 text-[#a1a1aa]" />
                            <span>Glow</span>
                        </div>
                        <button type="button" onClick={(event) => { event.preventDefault(); handleRemoveEffect('glow'); }} className="p-0.5 rounded hover:bg-white/10 text-[#a1a1aa] hover:text-white cursor-pointer" title="Remove Glow">
                            <Minus className="w-3 h-3" />
                        </button>
                    </summary>
                    <ColorPicker label="Glow color" color={layer.effects.glow.color} onChange={(color) => updateLayer(activeShotId, layer.id, l => l.effects.glow ? { ...l, effects: { ...l.effects, glow: { ...l.effects.glow, color } } } : l)} />                            <div className="grid grid-cols-2 gap-1.5">
                        <ScrubInput label="Radius" value={layer.effects.glow.radius * refStageW} min={0} max={100} step={1} unit=" px" onChange={(radius) => updateLayer(activeShotId, layer.id, (l) => l.effects.glow
                            ? {
                                ...l,
                                effects: {
                                    ...l.effects,
                                    glow: { ...l.effects.glow, radius: radius / refStageW },
                                },
                            }
                            : l)} />
                        <ScrubInput label="Int" value={Math.round(layer.effects.glow.intensity * 100)} min={0} max={200} step={5} unit=" %" onChange={(int) => updateLayer(activeShotId, layer.id, (l) => l.effects.glow
                            ? {
                                ...l,
                                effects: {
                                    ...l.effects,
                                    glow: {
                                        ...l.effects.glow,
                                        intensity: Number((int / 100).toFixed(2)),
                                    },
                                },
                            }
                            : l)} />
                    </div>
                </details>)}

                {/* Backdrop Blur */}
                {(layer.effects?.backdropBlur ?? 0) > 0 && (<details className="object-design-effect">
                    <summary className="flex items-center justify-between text-[11px] font-medium text-[#e4e4e7]">
                        <div className="flex items-center gap-1.5">
                            <Eye className="w-3.5 h-3.5 text-[#a1a1aa]" />
                            <span>Backdrop blur</span>
                        </div>
                        <button type="button" onClick={(event) => { event.preventDefault(); handleRemoveEffect('backdropBlur'); }} className="p-0.5 rounded hover:bg-white/10 text-[#a1a1aa] hover:text-white cursor-pointer" title="Remove Backdrop Blur">
                            <Minus className="w-3 h-3" />
                        </button>
                    </summary>
                    <ScrubInput label="Blur" value={(layer.effects.backdropBlur ?? 0) * 100} min={0} max={100} step={1} unit=" px" onChange={(blur) => updateLayer(activeShotId, layer.id, (l) => ({
                        ...l,
                        effects: { ...l.effects, backdropBlur: blur / 100 },
                    }))} />
                </details>)}

                {/* Layer Blur */}
                {(layer.effects?.layerBlur ?? 0) > 0 && (<details className="object-design-effect">
                    <summary className="flex items-center justify-between text-[11px] font-medium text-[#e4e4e7]">
                        <div className="flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-[#a1a1aa]" />
                            <span>Layer blur</span>
                        </div>
                        <button type="button" onClick={(event) => { event.preventDefault(); handleRemoveEffect('layerBlur'); }} className="p-0.5 rounded hover:bg-white/10 text-[#a1a1aa] hover:text-white cursor-pointer" title="Remove Layer Blur">
                            <Minus className="w-3 h-3" />
                        </button>
                    </summary>
                    <ScrubInput label="Blur" value={(layer.effects.layerBlur ?? 0) * 100} min={0} max={100} step={1} unit=" px" onChange={(blur) => updateLayer(activeShotId, layer.id, (l) => ({
                        ...l,
                        effects: { ...l.effects, layerBlur: blur / 100 },
                    }))} />
                </details>)}

                {/* Liquid Glass */}
                {layer.effects?.liquidGlass?.enabled && (<details className="object-design-effect">
                    <summary className="flex items-center justify-between text-[11px] font-medium text-[#e4e4e7]">
                        <div className="flex items-center gap-1.5">
                            <Droplet className="w-3.5 h-3.5 text-[#a1a1aa]" />
                            <span>Liquid glass</span>
                        </div>
                        <button type="button" onClick={(event) => { event.preventDefault(); handleRemoveEffect('liquidGlass'); }} className="p-0.5 rounded hover:bg-white/10 text-[#a1a1aa] hover:text-white cursor-pointer" title="Remove Liquid Glass">
                            <Minus className="w-3 h-3" />
                        </button>
                    </summary>
                    <div className="grid grid-cols-2 gap-1.5">
                        <ScrubInput label="Refract" value={Math.round((layer.effects.liquidGlass.refraction ?? 0.5) * 100)} min={0} max={100} step={1} unit=" %" onChange={(refr) => updateLayer(activeShotId, layer.id, (l) => l.effects.liquidGlass
                            ? {
                                ...l,
                                effects: {
                                    ...l.effects,
                                    liquidGlass: {
                                        ...l.effects.liquidGlass,
                                        refraction: Number((refr / 100).toFixed(2)),
                                    },
                                },
                            }
                            : l)} />
                        <ScrubInput label="Rough" value={Math.round((layer.effects.liquidGlass.roughness ?? 0.1) * 100)} min={0} max={100} step={1} unit=" %" onChange={(rough) => updateLayer(activeShotId, layer.id, (l) => l.effects.liquidGlass
                            ? {
                                ...l,
                                effects: {
                                    ...l.effects,
                                    liquidGlass: {
                                        ...l.effects.liquidGlass,
                                        roughness: Number((rough / 100).toFixed(2)),
                                    },
                                },
                            }
                            : l)} />
                    </div>
                </details>)}

                {/* Warp */}
                {layer.effects?.warp?.enabled && (<details className="object-design-effect">
                    <summary className="flex items-center justify-between text-[11px] font-medium text-[#e4e4e7]">
                        <div className="flex items-center gap-1.5">
                            <Spline className="w-3.5 h-3.5 text-[#a1a1aa]" />
                            <span>Warp</span>
                        </div>
                        <button type="button" onClick={(event) => { event.preventDefault(); handleRemoveEffect('warp'); }} className="p-0.5 rounded hover:bg-white/10 text-[#a1a1aa] hover:text-white cursor-pointer" title="Remove Warp">
                            <Minus className="w-3 h-3" />
                        </button>
                    </summary>
                    <div className="grid grid-cols-2 gap-1.5">
                        <ScrubInput label="Amount" value={layer.effects.warp.amount ?? 10} min={0} max={100} step={1} unit=" px" onChange={(amount) => updateLayer(activeShotId, layer.id, (l) => l.effects.warp
                            ? {
                                ...l,
                                effects: {
                                    ...l.effects,
                                    warp: { ...l.effects.warp, amount },
                                },
                            }
                            : l)} />
                        <ScrubInput label="Freq" value={layer.effects.warp.frequency ?? 1} min={1} max={10} step={1} onChange={(frequency) => updateLayer(activeShotId, layer.id, (l) => l.effects.warp
                            ? {
                                ...l,
                                effects: {
                                    ...l.effects,
                                    warp: { ...l.effects.warp, frequency },
                                },
                            }
                            : l)} />
                    </div>
                </details>)}
            </div>
        </div>
    </section>;
}
