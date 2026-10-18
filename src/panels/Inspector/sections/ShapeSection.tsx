// src/panels/Inspector/sections/ShapeSection.tsx
import React from 'react';
import { Shapes } from 'lucide-react';
import type { ShapeLayer } from '../../../model/types';
import { useProjectStore } from '../../../store/useProjectStore';
import { ColorField } from '../ColorPicker';
import { ScrubInput } from '../../../ui/ScrubInput';

const SHAPE_GRADIENT_PRESETS = [
    {
        name: 'Violet Glow',
        angle: 135,
        stops: [
            { at: 0, color: '#818cf8' },
            { at: 1, color: '#4f46e5' },
        ],
    },
    {
        name: 'Neon Mint',
        angle: 135,
        stops: [
            { at: 0, color: '#34d399' },
            { at: 1, color: '#059669' },
        ],
    },
    {
        name: 'Sunset Flare',
        angle: 90,
        stops: [
            { at: 0, color: '#f43f5e' },
            { at: 1, color: '#fb923c' },
        ],
    },
    {
        name: 'Cyan Frost',
        angle: 135,
        stops: [
            { at: 0, color: '#38bdf8' },
            { at: 1, color: '#1d4ed8' },
        ],
    },
];

interface ShapeSectionProps {
    activeShotId: string;
    layer: ShapeLayer;
}

export const ShapeSection: React.FC<ShapeSectionProps> = ({
    activeShotId,
    layer,
}) => {
    const { updateLayer } = useProjectStore();

    return (
        <div className="p-3.5 space-y-3">
            <div className="text-[11px] font-medium text-[#e4e4e7] flex items-center gap-1.5">
                <Shapes className="w-3.5 h-3.5 text-purple-400" />
                Shape &amp; Fill
            </div>

            {/* Geometry */}
            <div className="grid grid-cols-5 gap-0.5 bg-[#1c1c1f] p-0.5 rounded-lg border border-white/[0.06]" role="radiogroup" aria-label="Shape geometry">
                {(
                    ['rectangle', 'ellipse', 'line', 'arrow', 'polygon'] as Array<
                        ShapeLayer['shape']
                    >
                ).map((shp) => (
                    <button
                        key={shp}
                        type="button"
                        role="radio"
                        aria-checked={layer.shape === shp}
                        aria-label={shp}
                        onClick={() =>
                            updateLayer(activeShotId, layer.id, (l) =>
                                l.kind === 'shape' ? { ...l, shape: shp } : l
                            )
                        }
                        className={`h-6 rounded text-[10px] capitalize flex items-center justify-center transition cursor-pointer ${layer.shape === shp
                            ? 'bg-[#2a2a30] text-white font-medium'
                            : 'text-[#a1a1aa] hover:text-white'
                            }`}
                    >
                        {shp === 'rectangle' ? 'Rect' : shp === 'ellipse' ? 'Circle' : shp}
                    </button>
                ))}
            </div>

            {/* Fill Mode */}
            <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[#a1a1aa]">Fill</span>
                    <div className="flex bg-[#1c1c1f] p-0.5 rounded border border-white/[0.06]">
                        <button
                            type="button"
                            onClick={() => {
                                if (layer.fill.kind === 'solid') return;
                                updateLayer(activeShotId, layer.id, (l) =>
                                    l.kind === 'shape'
                                        ? {
                                            ...l,
                                            fill: {
                                                kind: 'solid',
                                                color:
                                                    l.fill.kind === 'gradient' &&
                                                        l.fill.stops[0]?.color
                                                        ? l.fill.stops[0].color
                                                        : '#818cf8',
                                                opacity: 1,
                                            },
                                        }
                                        : l
                                );
                            }}
                            className={`px-2 py-0.5 rounded text-[10px] cursor-pointer ${layer.fill.kind === 'solid'
                                ? 'bg-[#2a2a30] text-white font-medium'
                                : 'text-[#a1a1aa] hover:text-white'
                                }`}
                        >
                            Solid
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                if (layer.fill.kind === 'gradient') return;
                                const initialColor = layer.fill.color || '#818cf8';
                                updateLayer(activeShotId, layer.id, (l) =>
                                    l.kind === 'shape'
                                        ? {
                                            ...l,
                                            fill: {
                                                kind: 'gradient',
                                                angle: 135,
                                                stops: [
                                                    { at: 0, color: initialColor },
                                                    { at: 1, color: '#4f46e5' },
                                                ],
                                            },
                                        }
                                        : l
                                );
                            }}
                            className={`px-2 py-0.5 rounded text-[10px] cursor-pointer ${layer.fill.kind === 'gradient'
                                ? 'bg-[#2a2a30] text-white font-medium'
                                : 'text-[#a1a1aa] hover:text-white'
                                }`}
                        >
                            Shader
                        </button>
                    </div>
                </div>

                {layer.fill.kind === 'solid' ? (
                    <div className="flex items-center gap-2 pt-0.5">
                        <div className="relative shrink-0">
                            <ColorField
                                aria-label="Shape solid fill color"
                                value={layer.fill.color}
                                onChange={(e) => {
                                    const color = e.target.value;
                                    updateLayer(activeShotId, layer.id, (l) =>
                                        l.kind === 'shape' && l.fill.kind === 'solid'
                                            ? { ...l, fill: { ...l.fill, color } }
                                            : l
                                    );
                                }}
                                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                            />
                            <div
                                className="w-7 h-7 rounded-lg border border-white/10"
                                style={{ backgroundColor: layer.fill.color }}
                            />
                        </div>
                        <input
                            type="text"
                            aria-label="Fill color hex"
                            value={layer.fill.color}
                            onChange={(e) => {
                                let color = e.target.value.trim();
                                if (!color.startsWith('#')) color = `#${color}`;
                                updateLayer(activeShotId, layer.id, (l) =>
                                    l.kind === 'shape' && l.fill.kind === 'solid'
                                        ? { ...l, fill: { ...l.fill, color } }
                                        : l
                                );
                            }}
                            className="flex-1 h-7 px-2.5 rounded-lg bg-[#1c1c1f] border border-white/[0.06] text-[11px] font-mono text-white outline-none"
                        />
                    </div>
                ) : (
                    <div className="space-y-2 pt-1">
                        <div className="flex items-center gap-2">
                            <ColorField
                                aria-label="Gradient color 1"
                                value={layer.fill.stops[0]?.color ?? '#818cf8'}
                                onChange={(e) => {
                                    const color = e.target.value;
                                    updateLayer(activeShotId, layer.id, (l) => {
                                        if (l.kind !== 'shape' || l.fill.kind !== 'gradient') return l;
                                        const stops = [...l.fill.stops];
                                        stops[0] = { ...stops[0], at: 0, color };
                                        return { ...l, fill: { ...l.fill, stops } };
                                    });
                                }}
                                className="w-6 h-6 rounded border border-white/10 cursor-pointer"
                                title="Color 1"
                            />
                            <ColorField
                                aria-label="Gradient color 2"
                                value={layer.fill.stops[1]?.color ?? '#4f46e5'}
                                onChange={(e) => {
                                    const color = e.target.value;
                                    updateLayer(activeShotId, layer.id, (l) => {
                                        if (l.kind !== 'shape' || l.fill.kind !== 'gradient') return l;
                                        const stops = [...l.fill.stops];
                                        if (!stops[1]) stops[1] = { at: 1, color };
                                        stops[1] = { ...stops[1], at: 1, color };
                                        return { ...l, fill: { ...l.fill, stops } };
                                    });
                                }}
                                className="w-6 h-6 rounded border border-white/10 cursor-pointer"
                                title="Color 2"
                            />
                            <div className="flex-1">
                                <ScrubInput
                                    label="∠"
                                    value={layer.fill.angle}
                                    min={0}
                                    max={360}
                                    step={5}
                                    unit="°"
                                    onChange={(angle) =>
                                        updateLayer(activeShotId, layer.id, (l) =>
                                            l.kind === 'shape' && l.fill.kind === 'gradient'
                                                ? { ...l, fill: { ...l.fill, angle } }
                                                : l
                                        )
                                    }
                                />
                            </div>
                        </div>

                        {/* Gradient Presets */}
                        <div className="grid grid-cols-2 gap-1 pt-1">
                            {SHAPE_GRADIENT_PRESETS.map((preset) => (
                                <button
                                    key={preset.name}
                                    type="button"
                                    onClick={() =>
                                        updateLayer(activeShotId, layer.id, (l) =>
                                            l.kind === 'shape'
                                                ? {
                                                    ...l,
                                                    fill: {
                                                        kind: 'gradient',
                                                        angle: preset.angle,
                                                        stops: preset.stops.map((s) => ({ ...s })),
                                                    },
                                                }
                                                : l
                                        )
                                    }
                                    className="flex items-center gap-1.5 p-1 rounded bg-[#1c1c1f] hover:bg-white/10 text-left cursor-pointer border border-white/[0.06]"
                                >
                                    <div
                                        className="w-3.5 h-3.5 rounded shrink-0"
                                        style={{
                                            background: `linear-gradient(${preset.angle}deg, ${preset.stops[0].color}, ${preset.stops[1].color})`,
                                        }}
                                    />
                                    <span className="truncate text-[10px] text-[#a1a1aa] tracking-tight">
                                        {preset.name}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Stroke / Border */}
            <div className="space-y-2 pt-1 border-t border-white/[0.06]">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[#a1a1aa]">Border &amp; Stroke</span>
                    <input
                        type="checkbox"
                        aria-label="Enable shape stroke border"
                        checked={Boolean(layer.stroke)}
                        onChange={(e) => {
                            const enabled = e.target.checked;
                            updateLayer(activeShotId, layer.id, (l) =>
                                l.kind === 'shape'
                                    ? {
                                        ...l,
                                        stroke: enabled
                                            ? {
                                                color: l.stroke?.color || '#a855f7',
                                                width: l.stroke?.width ?? 0.003,
                                                opacity: l.stroke?.opacity ?? 1,
                                            }
                                            : undefined,
                                    }
                                    : l
                            );
                        }}
                        className="w-3.5 h-3.5 rounded accent-[#0088ff] cursor-pointer"
                    />
                </div>

                {layer.stroke && (
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                            <ColorField
                                aria-label="Stroke color"
                                value={layer.stroke.color}
                                onChange={(e) => {
                                    const color = e.target.value;
                                    updateLayer(activeShotId, layer.id, (l) =>
                                        l.kind === 'shape' && l.stroke
                                            ? { ...l, stroke: { ...l.stroke, color } }
                                            : l
                                    );
                                }}
                                className="w-6 h-6 rounded border border-white/10 cursor-pointer"
                            />
                            <div className="flex-1">
                                <ScrubInput
                                    label="W"
                                    value={Math.round(layer.stroke.width * 1000)}
                                    min={1}
                                    max={30}
                                    step={1}
                                    unit="px"
                                    onChange={(w) =>
                                        updateLayer(activeShotId, layer.id, (l) =>
                                            l.kind === 'shape' && l.stroke
                                                ? {
                                                    ...l,
                                                    stroke: {
                                                        ...l.stroke,
                                                        width: Number((w / 1000).toFixed(4)),
                                                    },
                                                }
                                                : l
                                        )
                                    }
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
