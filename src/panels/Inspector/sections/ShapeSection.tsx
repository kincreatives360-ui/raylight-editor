import { InspectorRow } from '../../../ui/primitives';
import { SegmentedControl, Switch } from '../../../ui/primitives';
import { IconButton } from '../../../ui/primitives';
import { LayerStrokeSection } from './LayerStrokeSection';
// src/panels/Inspector/sections/ShapeSection.tsx
import {
    Circle,
    Diamond,
    Feather,
    Minus,
    Plus,
    Spline,
    Square
} from 'lucide-react';
import React from 'react';
import type { AnimationBlockProperty } from '../../../model/schema';
import type { ShapeLayer, ShapeMask } from '../../../model/types';
import { useProjectStore } from '../../../store/useProjectStore';
import { ScrubInput } from '../../../ui/ScrubInput';
import { ColorPicker } from '../ColorPicker';


interface ShapeSectionProps {
    activeShotId: string;
    layer: ShapeLayer;
    onAddAnimationBlock?: (property: AnimationBlockProperty) => void;
}



export const ShapeSection: React.FC<ShapeSectionProps> = ({
    activeShotId,
    layer,
    onAddAnimationBlock,
}) => {
    const { updateLayer } = useProjectStore();

    // Fill helpers
    const hasFill =
        layer.fill.kind === 'solid'
            ? (layer.fill.opacity ?? 1) > 0 && layer.fill.color !== 'transparent'
            : true;

    const fillColor =
        layer.fill.kind === 'solid'
            ? layer.fill.color || '#D9D9D9'
            : layer.fill.stops[0]?.color || '#D9D9D9';

    const fillOpacity =
        layer.fill.kind === 'solid'
            ? layer.fill.opacity ?? 1
            : 1;

    // Mask helpers
    const mask = layer.mask || {
        enabled: false,
        shape: 'rectangle' as const,
        feather: 0,
        opacity: 1,
        grow: 0,
        invert: false,
        show: true,
    };

    const updateMask = (partial: Partial<ShapeMask>) => {
        updateLayer(activeShotId, layer.id, (l) => {
            if (l.kind !== 'shape') return l;
            return {
                ...l,
                mask: {
                    ...(l.mask || {
                        enabled: true,
                        shape: 'rectangle',
                        feather: 0,
                        opacity: 1,
                        grow: 0,
                        invert: false,
                        show: true,
                    }),
                    ...partial,
                },
            };
        });
    };

    return (
        <div className="divide-y divide-white/[0.06]">
            {/* 5. FILL */}
            <div role="region" aria-label="Fill" className="p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-[#e4e4e7]">
                        Fill
                    </span>
                    <IconButton
                        unstyled
                        tooltip={false}
                        label={hasFill ? 'Remove Fill' : 'Add Fill'}
                        icon={<>
                            {hasFill ? <Minus className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                        </>}
                        onClick={() => {
                            if (hasFill) {
                                // Remove / hide fill
                                updateLayer(activeShotId, layer.id, (l) =>
                                    l.kind === 'shape'
                                        ? {
                                            ...l,
                                            fill: {
                                                kind: 'solid',
                                                color: 'transparent',
                                                opacity: 0,
                                            },
                                        }
                                        : l
                                );
                            } else {
                                // Add default fill
                                updateLayer(activeShotId, layer.id, (l) =>
                                    l.kind === 'shape'
                                        ? {
                                            ...l,
                                            fill: {
                                                kind: 'solid',
                                                color: '#D9D9D9',
                                                opacity: 1,
                                            },
                                        }
                                        : l
                                );
                            }
                        }}
                        className="p-1 rounded hover:bg-white/10 text-[#a1a1aa] hover:text-white transition cursor-pointer"
                        title={hasFill ? 'Remove Fill' : 'Add Fill'}
                    />
                </div>

                {hasFill && (
                    <div className="object-design-color-row"><ColorPicker
                        color={fillColor}
                        gradientValue={layer.fill.kind === 'gradient' ? { angle: layer.fill.angle, stops: layer.fill.stops, gradientType: layer.fill.gradientType } : undefined}
                        onGradientChange={(gradient) => updateLayer(activeShotId, layer.id, (l) => l.kind === 'shape' ? { ...l, fill: { kind: 'gradient', angle: gradient.angle, stops: gradient.stops, gradientType: gradient.gradientType } } : l)}
                        onChange={(newColor) =>
                            updateLayer(activeShotId, layer.id, (l) => {
                                if (l.kind !== 'shape') return l;
                                return {
                                    ...l,
                                    fill: {
                                        kind: 'solid',
                                        color: newColor,
                                        opacity: l.fill.kind === 'solid' ? l.fill.opacity ?? 1 : 1,
                                    },
                                };
                            })
                        }
                        className="w-full h-8 px-2.5 rounded-lg bg-[#1c1c1f] hover:bg-[#242428] border border-white/[0.06] flex items-center justify-between cursor-pointer transition select-none"
                    >
                        <div className="flex items-center gap-2">
                            <div
                                className="w-5 h-5 rounded-md border border-white/10 shrink-0"
                                style={{ backgroundColor: fillColor }}
                            />
                            <span className="font-mono text-[11px] font-medium text-white tracking-wider">
                                {fillColor.replace(/^#/, '').toUpperCase()}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] text-[#a1a1aa]">
                                {Math.round(fillOpacity * 100)} %
                            </span>

                        </div>
                    </ColorPicker><IconButton
                        unstyled
                        tooltip={false}
                        label="Add Opacity Animation Block"
                        icon={<>
                            <Diamond className="w-3.5 h-3.5 fill-none" />
                            <span className="absolute -top-1 -right-1 text-[10px] font-bold leading-none select-none">
                                +
                            </span>
                        </>}
                        onClick={(e) => {
                            e.stopPropagation();
                            onAddAnimationBlock?.('opacity');
                        }}
                        title="Add Opacity Animation Block"
                        className="relative flex items-center justify-center text-[#a1a1aa] hover:text-white p-0.5 cursor-pointer transition"
                    /></div>
                )}
            </div>

            <LayerStrokeSection shotId={activeShotId} layer={layer} />
            {/* 7. MASK */}
            <div role="region" aria-label="Mask" className="p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-[#e4e4e7]">
                        Mask
                    </span>
                    <IconButton
                        unstyled
                        tooltip={false}
                        label={layer.mask?.enabled ? 'Disable Mask' : 'Add Mask'}
                        icon={<>
                            {layer.mask?.enabled ? <Minus className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                        </>}
                        onClick={() => {
                            if (layer.mask?.enabled) {
                                updateMask({ enabled: false });
                            } else {
                                updateMask({ enabled: true });
                            }
                        }}
                        className="p-1 rounded hover:bg-white/10 text-[#a1a1aa] hover:text-white transition cursor-pointer"
                        title={layer.mask?.enabled ? 'Disable Mask' : 'Add Mask'}
                    />
                </div>

                {layer.mask?.enabled && (
                    <div className="space-y-3 pt-0.5">
                        {/* Shape: 3 Segmented Buttons */}
                        <InspectorRow
                            unstyled
                            className="space-y-1.5"
                            labelTag="span"
                            labelClassName="text-[11px] text-[#a1a1aa] block"
                            label={<>Shape
                            </>}
                        >
                            <SegmentedControl
                                unstyled
                                ariaLabel="Mask shape"
                                value={mask.shape}
                                onChange={shape => updateMask({ shape })}
                                className="grid grid-cols-3 gap-0.5 bg-[#1c1c1f] p-0.5 rounded-lg border border-white/[0.06]"
                                buttonClassName={(_, selected) => `h-6 rounded flex items-center justify-center cursor-pointer transition ${selected ? 'bg-[#2a2a30] text-white' : 'text-[#a1a1aa] hover:text-white'}`}
                                options={[{ value: 'rectangle', ariaLabel: 'Rectangle', title: 'Rectangle', icon: <Square className="w-3.5 h-3.5 rounded-[3px]" /> }, { value: 'circle', ariaLabel: 'Circle', title: 'Circle', icon: <Circle className="w-3.5 h-3.5" /> }, { value: 'path', ariaLabel: 'Vector Path', title: 'Vector Path', icon: <Spline className="w-3.5 h-3.5" /> }]}
                            />
                        </InspectorRow>

                        {/* Feather */}
                        <InspectorRow
                            unstyled
                            className="space-y-1.5"
                            labelTag="span"
                            labelClassName="text-[11px] text-[#a1a1aa] block"
                            label={<>Feather
                            </>}
                        >
                            <ScrubInput
                                label={<Feather className="w-3.5 h-3.5 text-[#a1a1aa]" />}
                                value={mask.feather}
                                min={0}
                                max={100}
                                step={1}
                                unit=" px"
                                onChange={(feather) => updateMask({ feather })}
                            />
                        </InspectorRow>

                        {/* Opacity & grow */}
                        <InspectorRow
                            unstyled
                            className="space-y-1.5"
                            labelTag="span"
                            labelClassName="text-[11px] text-[#a1a1aa] block"
                            label={<>Opacity &amp; grow
                            </>}
                        >
                            <div className="grid grid-cols-2 gap-1.5">
                                <ScrubInput
                                    label="Opacity"
                                    value={Math.round(mask.opacity * 100)}
                                    min={0}
                                    max={100}
                                    step={1}
                                    unit=" %"
                                    onChange={(pct) =>
                                        updateMask({ opacity: Number((pct / 100).toFixed(2)) })
                                    }
                                />
                                <ScrubInput
                                    label="Grow"
                                    value={mask.grow}
                                    min={-50}
                                    max={50}
                                    step={1}
                                    unit=" px"
                                    onChange={(grow) => updateMask({ grow })}
                                />
                            </div>
                        </InspectorRow>

                        {/* Invert */}
                        <div className="flex items-center justify-between pt-0.5">
                            <span className="text-[11px] text-[#a1a1aa]">Invert</span>
                            <Switch ariaLabel="Invert mask"
                                checked={mask.invert}
                                onChange={(invert) => updateMask({ invert })}
                            />
                        </div>

                        {/* Show */}
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] text-[#a1a1aa]">Show</span>
                            <Switch ariaLabel="Show mask"
                                checked={mask.show}
                                onChange={(show) => updateMask({ show })}
                            />
                        </div>
                    </div>
                )}
            </div>


        </div>
    );
};
