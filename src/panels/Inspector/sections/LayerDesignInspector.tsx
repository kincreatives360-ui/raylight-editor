import { ChevronDown, Eye, EyeOff, Image as ImageIcon, Lock, Trash2, Unlock } from 'lucide-react';
import React, { useState } from 'react';
import type { AnimationBlockProperty, BlendMode, Layer, Shot } from '../../../model/types';
import { ASPECT_RATIO_CONFIG } from '../../../stage/stageUtils';
import { useProjectStore } from '../../../store/useProjectStore';
import { useSelectionStore } from '../../../store/useSelectionStore';
import { FigmaSelect } from '../../../ui/FigmaSelect';
import { IconButton, InspectorRow } from '../../../ui/primitives';
import { ScrubInput } from '../../../ui/ScrubInput';
import { ColorPicker } from '../ColorPicker';
import { DesignSection } from './DesignSection';
import { DeviceFrameSection } from './DeviceFrameSection';
import { LayerEffectsSection } from './LayerEffectsSection';
import { LayerGeometrySections } from './LayerGeometrySections';
import { LayerMaterialSection } from './LayerMaterialSection';
import { LayerStrokeSection } from './LayerStrokeSection';
import './objectDesign.css';
import { ShapeSection } from './ShapeSection';
import { TypographySection } from './TypographySection';
const ALL_BLEND_MODES: BlendMode[] = ['normal', 'darken', 'multiply', 'lighten', 'screen', 'add', 'difference'];

interface Props { activeShot: Shot; selectedLayer: Layer; selectedLayerIds: string[]; onSwapImageClick: () => void; customFonts: string[]; onUploadFontClick: () => void; onAddAnimationBlock: (property: AnimationBlockProperty) => void; }
export const LayerDesignInspector = React.memo(function LayerDesignInspector({ activeShot, selectedLayer, selectedLayerIds, onSwapImageClick, customFonts, onUploadFontClick, onAddAnimationBlock }: Props) {
    const { project, updateLayer, deleteLayerFromShot } = useProjectStore();
    const [aspectLocked, setAspectLocked] = useState(selectedLayer.kind !== 'shape');
    const clearLayerSelection = useSelectionStore((state) => state.clearLayerSelection);
    const aspect = ASPECT_RATIO_CONFIG[project.aspectRatio];
    const media = selectedLayer.kind === 'image' || selectedLayer.kind === 'video' ? selectedLayer : null;
    const asset = media ? project.assets[media.assetId] : undefined;
    const svg = media?.kind === 'image' && (/svg/i.test(asset?.mimeType ?? '') || /\.svg$/i.test(asset?.name ?? ''));
    return <div className="object-design-inspector flex-1 min-h-0 overflow-y-auto" data-testid="object-design-inspector" data-kind={svg ? 'svg' : selectedLayer.kind}>
        {media && <DesignSection title={selectedLayer.kind === 'video' ? 'Video' : 'Image'}><div className="object-design-source">
            <div className="object-design-thumbnail">{asset?.dataUrl ? (asset.mimeType?.startsWith('video/') ? <video src={asset.dataUrl} muted /> : <img src={asset.dataUrl} alt={selectedLayer.name} />) : <ImageIcon />}</div>
            <button type="button" className="object-design-swap" onClick={onSwapImageClick}><ImageIcon />Swap source<span /><ChevronDown /></button>
        </div></DesignSection>}
        {selectedLayer.kind === 'text' && <DesignSection title="Content"><textarea aria-label="Text content" value={selectedLayer.content} rows={2} className="object-design-content" onChange={(event) => updateLayer(activeShot.id, selectedLayer.id, (l) => l.kind === 'text' ? { ...l, content: event.target.value } : l)} /></DesignSection>}
        <LayerGeometrySections shot={activeShot} layer={selectedLayer} selectedLayerIds={selectedLayerIds} aspectLocked={aspectLocked} onAspectLockedChange={setAspectLocked} />
        {selectedLayer.kind === 'shape' && <ShapeSection activeShotId={activeShot.id} layer={selectedLayer} onAddAnimationBlock={onAddAnimationBlock} />}
        {media && <LayerStrokeSection shotId={activeShot.id} layer={media} />}
        {media && <DeviceFrameSection projectAspect={aspect.widthRatio / aspect.heightRatio} layer={media} onChange={(deviceFrame) => updateLayer(activeShot.id, selectedLayer.id, (l) => (l.kind === 'image' || l.kind === 'video') ? { ...l, deviceFrame } : l)} />}
        {selectedLayer.kind !== 'shape' && <DesignSection title="Mask" collapsible defaultOpen={!!selectedLayer.maskLayerId}>                                {/* Layer Masking */}
            <div className="space-y-1 pt-1 border-t border-white/[0.06]">
                <span className="object-design-label">Alpha mask</span>
                <FigmaSelect
                    value={selectedLayer.maskLayerId || ''}
                    onChange={(e) =>
                        updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                            ...l,
                            maskLayerId: e.target.value || undefined,
                        }))
                    }
                    className="w-full h-7 rounded-lg bg-[#1c1c1f] border border-white/10 px-2 text-[11px] text-white outline-none cursor-pointer"
                >
                    <option value="">No Mask (Standard)</option>
                    {activeShot.layers
                        .filter(
                            (l) =>
                                l.id !== selectedLayer.id &&
                                (l.kind === 'shape' || l.id === selectedLayer.maskLayerId)
                        )
                        .map((l) => (
                            <option key={l.id} value={l.id}>
                                Mask with: {l.name}
                            </option>
                        ))}
                </FigmaSelect>
            </div></DesignSection>}
        {selectedLayer.kind !== 'text' && <DesignSection title="Staging" collapsible defaultOpen={false}><LayerMaterialSection shotId={activeShot.id} layer={selectedLayer} /></DesignSection>}
        <LayerEffectsSection activeShotId={activeShot.id} layer={selectedLayer} />
        {selectedLayer.kind === 'text' && <><TypographySection activeShotId={activeShot.id} layer={selectedLayer} customFonts={customFonts} onUploadFontClick={onUploadFontClick} /><DesignSection title="Fill"><ColorPicker showGradientMode={false} label="Text color" color={selectedLayer.font.color} onChange={(color) => updateLayer(activeShot.id, selectedLayer.id, (l) => l.kind === 'text' ? { ...l, font: { ...l.font, color } } : l)} /></DesignSection></>}
        <DesignSection title="Layer" collapsible defaultOpen={false} actions={<><IconButton label={selectedLayer.hidden ? 'Show Layer' : 'Hide Layer'} icon={selectedLayer.hidden ? <EyeOff /> : <Eye />} onClick={() => updateLayer(activeShot.id, selectedLayer.id, (l) => ({ ...l, hidden: !l.hidden }))} /><IconButton label={selectedLayer.locked ? 'Unlock Layer' : 'Lock Layer'} icon={selectedLayer.locked ? <Lock /> : <Unlock />} onClick={() => updateLayer(activeShot.id, selectedLayer.id, (l) => ({ ...l, locked: !l.locked }))} /><IconButton label="Delete Layer" icon={<Trash2 />} onClick={() => { deleteLayerFromShot(activeShot.id, selectedLayer.id); clearLayerSelection(); }} /></>}>
            <input aria-label="Layer name" className="object-design-input" value={selectedLayer.name} onChange={(event) => updateLayer(activeShot.id, selectedLayer.id, (l) => ({ ...l, name: event.target.value }))} />
            <InspectorRow label="Blend mode" stacked><FigmaSelect aria-label="Blend mode" value={selectedLayer.blendMode} className="object-design-input" onChange={(event) => updateLayer(activeShot.id, selectedLayer.id, (l) => ({ ...l, blendMode: event.target.value as BlendMode }))}>{ALL_BLEND_MODES.map((mode) => <option key={mode} value={mode}>{mode}</option>)}</FigmaSelect></InspectorRow>
            <InspectorRow label="Scale" stacked><div className="object-design-pair">{(['x', 'y'] as const).map((axis) => <ScrubInput key={axis} label={'S' + axis.toUpperCase()} value={Math.abs(selectedLayer.scale[axis]) * 100} min={1} max={1000} unit=" %" onChange={(value) => updateLayer(activeShot.id, selectedLayer.id, (l) => ({ ...l, scale: { ...l.scale, [axis]: (Math.sign(l.scale[axis]) || 1) * value / 100, ...(aspectLocked ? { [axis === 'x' ? 'y' : 'x']: (Math.sign(l.scale[axis === 'x' ? 'y' : 'x']) || 1) * value / 100 } : {}) } }))} />)}</div></InspectorRow>
            {selectedLayer.kind === 'text' && <> {/* 3D Lighting & Material Response */}
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
                                    : selectedLayer.kind !== 'text'
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

                    {(selectedLayer.receivesLight ?? (selectedLayer.kind !== 'text')) && (
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

            </>}
        </DesignSection>
    </div>;
});
