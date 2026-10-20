// src/panels/Inspector/sections/ShapeSection.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
    AlignLeft,
    AlignCenterHorizontal,
    AlignRight,
    AlignStartVertical,
    AlignCenterVertical,
    AlignEndVertical,
    Crosshair,
    RotateCcw,
    RotateCw,
    FlipHorizontal,
    FlipVertical,
    Maximize2,
    Lock,
    Unlock,
    Square,
    Circle,
    Spline,
    CircleDot,
    AlignJustify,
    SlidersHorizontal,
    Feather,
    Plus,
    Minus,
    Diamond,
    Copy,
    Zap,
    Eye,
    Layers,
    Droplet,
    ChevronDown,
} from 'lucide-react';
import type { ShapeLayer, ShapeMask } from '../../../model/types';
import type { AnimationBlockProperty } from '../../../model/schema';
import { useProjectStore } from '../../../store/useProjectStore';
import { ColorPicker } from '../ColorPicker';
import { ScrubInput } from '../../../ui/ScrubInput';

import { degToRad, radToDeg } from '../../../model/defaults';

interface ShapeSectionProps {
    activeShotId: string;
    layer: ShapeLayer;
    onAddAnimationBlock?: (property: AnimationBlockProperty) => void;
}

const refStageW = 1920;
const refStageH = 1080;

const ToggleSwitch: React.FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({
    checked,
    onChange,
}) => (
    <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer flex items-center ${
            checked ? 'bg-[#0088ff]' : 'bg-[#27272a]'
        }`}
    >
        <div
            className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                checked ? 'translate-x-4' : 'translate-x-0'
            }`}
        />
    </button>
);

export const ShapeSection: React.FC<ShapeSectionProps> = ({
    activeShotId,
    layer,
    onAddAnimationBlock,
}) => {
    const { updateLayer } = useProjectStore();
    const [aspectLocked, setAspectLocked] = useState(false);
    const [effectsMenuOpen, setEffectsMenuOpen] = useState(false);
    const [strokeAlignOpen, setStrokeAlignOpen] = useState(false);
    const effectsMenuRef = useRef<HTMLDivElement>(null);
    const strokeAlignRef = useRef<HTMLDivElement>(null);

    // Close menus on outside click
    useEffect(() => {
        if (!effectsMenuOpen && !strokeAlignOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Node;
            if (effectsMenuOpen && effectsMenuRef.current && !effectsMenuRef.current.contains(target)) {
                setEffectsMenuOpen(false);
            }
            if (strokeAlignOpen && strokeAlignRef.current && !strokeAlignRef.current.contains(target)) {
                setStrokeAlignOpen(false);
            }
        };
        window.addEventListener('mousedown', handleClickOutside);
        return () => window.removeEventListener('mousedown', handleClickOutside);
    }, [effectsMenuOpen, strokeAlignOpen]);

    const handleQuickAlign = (axis: 'x' | 'y', targetNorm: number) => {
        updateLayer(activeShotId, layer.id, (l) => ({
            ...l,
            position: {
                ...l.position,
                [axis]: targetNorm,
            },
        }));
    };

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

    // Stroke helpers
    const hasStroke = Boolean(layer.stroke && layer.stroke.width > 0);
    const strokeColor = layer.stroke?.color || '#D9D9D9';
    const strokeOpacity = layer.stroke?.opacity ?? 1;

    const updateStroke = (partial: Partial<NonNullable<ShapeLayer['stroke']>>) => {
        updateLayer(activeShotId, layer.id, (l) => {
            if (l.kind !== 'shape') return l;
            return {
                ...l,
                stroke: {
                    color: l.stroke?.color || '#D9D9D9',
                    width: l.stroke?.width ?? 0.002,
                    opacity: l.stroke?.opacity ?? 1,
                    align: l.stroke?.align || 'inside',
                    style: l.stroke?.style || 'solid',
                    ...partial,
                },
            };
        });
    };

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

    // Effects helpers
    const handleAddEffect = (effectId: string) => {
        updateLayer(activeShotId, layer.id, (l) => {
            if (l.kind !== 'shape') return l;
            const effects = { ...l.effects };
            if (effectId === 'dropShadow') {
                effects.dropShadow = {
                    enabled: true,
                    color: '#000000',
                    opacity: 0.5,
                    blur: 16,
                    offsetX: 0,
                    offsetY: 8,
                };
            } else if (effectId === 'glow') {
                effects.glow = {
                    enabled: true,
                    color: '#0088ff',
                    intensity: 1,
                    radius: 12,
                };
            } else if (effectId === 'backdropBlur') {
                effects.backdropBlur = 12;
            } else if (effectId === 'layerBlur') {
                effects.layerBlur = 12;
            } else if (effectId === 'liquidGlass') {
                effects.liquidGlass = {
                    enabled: true,
                    refraction: 0.5,
                    roughness: 0.1,
                    tint: '#ffffff',
                };
            } else if (effectId === 'warp') {
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
            if (l.kind !== 'shape') return l;
            const effects = { ...l.effects };
            if (effectId === 'dropShadow') delete effects.dropShadow;
            if (effectId === 'glow') delete effects.glow;
            if (effectId === 'backdropBlur') delete effects.backdropBlur;
            if (effectId === 'layerBlur') delete effects.layerBlur;
            if (effectId === 'liquidGlass') delete effects.liquidGlass;
            if (effectId === 'warp') delete effects.warp;
            return { ...l, effects };
        });
    };

    return (
        <div className="divide-y divide-white/[0.06]">
            {/* 1. POSITION */}
            <div className="p-3.5 space-y-3">
                <div className="text-[13px] font-semibold text-[#e4e4e7]">
                    Position
                </div>

                {/* Alignment 6-button grid */}
                <div className="space-y-1.5">
                    <span className="text-[11px] text-[#a1a1aa] block">
                        Alignment
                    </span>
                    <div className="grid grid-cols-6 gap-0.5 bg-[#1c1c1f] p-0.5 rounded-lg border border-white/[0.06]">
                        <button
                            type="button"
                            onClick={() => handleQuickAlign('x', -0.32)}
                            className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer transition"
                            title="Align Left"
                        >
                            <AlignLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => handleQuickAlign('x', 0)}
                            className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer transition"
                            title="Center Horizontal"
                        >
                            <AlignCenterHorizontal className="w-3.5 h-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => handleQuickAlign('x', 0.32)}
                            className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer transition"
                            title="Align Right"
                        >
                            <AlignRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => handleQuickAlign('y', -0.32)}
                            className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer transition"
                            title="Align Top"
                        >
                            <AlignStartVertical className="w-3.5 h-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => handleQuickAlign('y', 0)}
                            className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer transition"
                            title="Center Vertical"
                        >
                            <AlignCenterVertical className="w-3.5 h-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => handleQuickAlign('y', 0.32)}
                            className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer transition"
                            title="Align Bottom"
                        >
                            <AlignEndVertical className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                {/* Position X, Y + Center Crosshair */}
                <div className="space-y-1.5">
                    <span className="text-[11px] text-[#a1a1aa] block">
                        Position
                    </span>
                    <div className="flex items-center gap-1.5">
                        <div className="grid grid-cols-2 gap-1.5 flex-1">
                            <ScrubInput
                                label="X"
                                value={Math.round(layer.position.x * refStageW)}
                                min={-3000}
                                max={3000}
                                step={10}
                                onChange={(pxX) =>
                                    updateLayer(activeShotId, layer.id, (l) => ({
                                        ...l,
                                        position: {
                                            ...l.position,
                                            x: Number((pxX / refStageW).toFixed(4)),
                                        },
                                    }))
                                }
                            />
                            <ScrubInput
                                label="Y"
                                value={Math.round(layer.position.y * refStageH)}
                                min={-3000}
                                max={3000}
                                step={10}
                                onChange={(pxY) =>
                                    updateLayer(activeShotId, layer.id, (l) => ({
                                        ...l,
                                        position: {
                                            ...l.position,
                                            y: Number((pxY / refStageH).toFixed(4)),
                                        },
                                    }))
                                }
                            />
                        </div>
                        <button
                            type="button"
                            onClick={() =>
                                updateLayer(activeShotId, layer.id, (l) => ({
                                    ...l,
                                    position: { ...l.position, x: 0, y: 0 },
                                }))
                            }
                            title="Center Position (0, 0)"
                            className="w-7 h-7 rounded-lg bg-[#1c1c1f] hover:bg-white/10 border border-white/[0.06] flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer transition shrink-0"
                        >
                            <Crosshair className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                {/* Depth & rotation */}
                <div className="space-y-1.5">
                    <span className="text-[11px] text-[#a1a1aa] block">
                        Depth &amp; rotation
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                        <ScrubInput
                            label="Z"
                            value={Math.round(layer.position.z * 500)}
                            min={-1500}
                            max={1500}
                            step={10}
                            onChange={(z) =>
                                updateLayer(activeShotId, layer.id, (l) => ({
                                    ...l,
                                    position: {
                                        ...l.position,
                                        z: Number((z / 500).toFixed(4)),
                                    },
                                }))
                            }
                        />
                        <ScrubInput
                            label="∟"
                            value={radToDeg(layer.rotation.z)}
                            min={-180}
                            max={180}
                            step={1}
                            unit="°"
                            onChange={(deg) =>
                                updateLayer(activeShotId, layer.id, (l) => ({
                                    ...l,
                                    rotation: { ...l.rotation, z: degToRad(deg) },
                                }))
                            }
                        />
                    </div>
                </div>

                {/* Rotation: 3 button pill + reset button */}
                <div className="space-y-1.5">
                    <span className="text-[11px] text-[#a1a1aa] block">
                        Rotation
                    </span>
                    <div className="flex items-center gap-1.5">
                        <div className="grid grid-cols-3 gap-0.5 bg-[#1c1c1f] p-0.5 rounded-lg border border-white/[0.06] flex-1">
                            <button
                                type="button"
                                onClick={() =>
                                    updateLayer(activeShotId, layer.id, (l) => ({
                                        ...l,
                                        rotation: {
                                            ...l.rotation,
                                            z: degToRad((radToDeg(l.rotation.z) + 90) % 360),
                                        },
                                    }))
                                }
                                title="Rotate 90° Clockwise"
                                className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer transition"
                            >
                                <RotateCw className="w-3.5 h-3.5" />
                            </button>
                            <button
                                type="button"
                                onClick={() =>
                                    updateLayer(activeShotId, layer.id, (l) => ({
                                        ...l,
                                        scale: { ...l.scale, x: l.scale.x * -1 },
                                    }))
                                }
                                title="Flip Horizontally"
                                className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer transition"
                            >
                                <FlipHorizontal className="w-3.5 h-3.5" />
                            </button>
                            <button
                                type="button"
                                onClick={() =>
                                    updateLayer(activeShotId, layer.id, (l) => ({
                                        ...l,
                                        scale: { ...l.scale, y: l.scale.y * -1 },
                                    }))
                                }
                                title="Flip Vertically"
                                className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer transition"
                            >
                                <FlipVertical className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        <button
                            type="button"
                            onClick={() =>
                                updateLayer(activeShotId, layer.id, (l) => ({
                                    ...l,
                                    rotation: { ...l.rotation, z: 0 },
                                    scale: {
                                        ...l.scale,
                                        x: Math.abs(l.scale.x),
                                        y: Math.abs(l.scale.y),
                                    },
                                }))
                            }
                            title="Reset Rotation & Flip"
                            className="w-7 h-7 rounded-lg bg-[#1c1c1f] hover:bg-white/10 border border-white/[0.06] flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer transition shrink-0"
                        >
                            <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* 2. TILT */}
            <div className="p-3.5 space-y-3">
                <div className="text-[13px] font-semibold text-[#e4e4e7]">
                    Tilt
                </div>

                <div className="space-y-1.5">
                    <span className="text-[11px] text-[#a1a1aa] block">
                        Tilt
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                        <ScrubInput
                            label="X"
                            value={radToDeg(layer.rotation.x)}
                            min={-85}
                            max={85}
                            step={1}
                            unit="°"
                            onChange={(deg) =>
                                updateLayer(activeShotId, layer.id, (l) => ({
                                    ...l,
                                    rotation: { ...l.rotation, x: degToRad(deg) },
                                }))
                            }
                        />
                        <ScrubInput
                            label="Y"
                            value={radToDeg(layer.rotation.y)}
                            min={-85}
                            max={85}
                            step={1}
                            unit="°"
                            onChange={(deg) =>
                                updateLayer(activeShotId, layer.id, (l) => ({
                                    ...l,
                                    rotation: { ...l.rotation, y: degToRad(deg) },
                                }))
                            }
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <span className="text-[11px] text-[#a1a1aa] block">
                        Tilt
                    </span>
                    <div className="grid grid-cols-3 gap-0.5 bg-[#1c1c1f] p-0.5 rounded-lg border border-white/[0.06]">
                        <button
                            type="button"
                            onClick={() =>
                                updateLayer(activeShotId, layer.id, (l) => ({
                                    ...l,
                                    rotation: { ...l.rotation, x: 0, y: 0 },
                                }))
                            }
                            title="Reset Tilt (0°)"
                            className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer transition"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={() =>
                                updateLayer(activeShotId, layer.id, (l) => ({
                                    ...l,
                                    rotation: {
                                        ...l.rotation,
                                        y: degToRad(-radToDeg(l.rotation.y)),
                                    },
                                }))
                            }
                            title="Invert Yaw Angle"
                            className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer transition"
                        >
                            <FlipHorizontal className="w-3.5 h-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={() =>
                                updateLayer(activeShotId, layer.id, (l) => ({
                                    ...l,
                                    rotation: {
                                        x: degToRad(-35),
                                        y: degToRad(20),
                                        z: degToRad(15),
                                    },
                                }))
                            }
                            title="Isometric 3D Preset"
                            className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer transition"
                        >
                            <Square className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* 3. LAYOUT */}
            <div className="p-3.5 space-y-3">
                <div className="text-[13px] font-semibold text-[#e4e4e7]">
                    Layout
                </div>

                {/* Size W & H + Aspect Lock */}
                <div className="space-y-1.5">
                    <span className="text-[11px] text-[#a1a1aa] block">
                        Size
                    </span>
                    <div className="flex items-center gap-1.5">
                        <div className="grid grid-cols-2 gap-1.5 flex-1">
                            <ScrubInput
                                label="W"
                                value={Math.round(layer.size.width * refStageW)}
                                min={20}
                                max={4000}
                                step={10}
                                onChange={(pxW) => {
                                    const nextW = Number((pxW / refStageW).toFixed(4));
                                    const ratio =
                                        layer.size.height / Math.max(0.01, layer.size.width);
                                    updateLayer(activeShotId, layer.id, (l) =>
                                        l.kind === 'shape'
                                            ? {
                                                ...l,
                                                size: {
                                                    width: nextW,
                                                    height: aspectLocked
                                                        ? Number((nextW * ratio).toFixed(4))
                                                        : l.size.height,
                                                },
                                            }
                                            : l
                                    );
                                }}
                            />
                            <ScrubInput
                                label="H"
                                value={Math.round(layer.size.height * refStageH)}
                                min={20}
                                max={4000}
                                step={10}
                                onChange={(pxH) => {
                                    const nextH = Number((pxH / refStageH).toFixed(4));
                                    const ratio =
                                        layer.size.width / Math.max(0.01, layer.size.height);
                                    updateLayer(activeShotId, layer.id, (l) =>
                                        l.kind === 'shape'
                                            ? {
                                                ...l,
                                                size: {
                                                    width: aspectLocked
                                                        ? Number((nextH * ratio).toFixed(4))
                                                        : l.size.width,
                                                    height: nextH,
                                                },
                                            }
                                            : l
                                    );
                                }}
                            />
                        </div>
                        <button
                            type="button"
                            onClick={() => setAspectLocked((v) => !v)}
                            title={aspectLocked ? 'Aspect Ratio Locked' : 'Aspect Ratio Unlocked'}
                            className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition border border-white/[0.06] shrink-0 ${
                                aspectLocked
                                    ? 'bg-[#1c1c1f] text-white border-white/20'
                                    : 'bg-[#1c1c1f] text-[#a1a1aa] hover:text-white'
                            }`}
                        >
                            {aspectLocked ? (
                                <Lock className="w-3.5 h-3.5" />
                            ) : (
                                <Unlock className="w-3.5 h-3.5" />
                            )}
                        </button>
                    </div>
                </div>

                {/* Depth */}
                <div className="space-y-1.5">
                    <span className="text-[11px] text-[#a1a1aa] block">
                        Depth
                    </span>
                    <ScrubInput
                        label="D"
                        value={layer.depth ?? 0}
                        min={-500}
                        max={500}
                        step={1}
                        onChange={(d) =>
                            updateLayer(activeShotId, layer.id, (l) =>
                                l.kind === 'shape' ? { ...l, depth: d } : l
                            )
                        }
                    />
                </div>
            </div>

            {/* 4. APPEARANCE */}
            <div className="p-3.5 space-y-3">
                <div className="text-[13px] font-semibold text-[#e4e4e7]">
                    Appearance
                </div>

                <div className="space-y-1.5">
                    <span className="text-[11px] text-[#a1a1aa] block">
                        Opacity
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                        <ScrubInput
                            label={<CircleDot className="w-3.5 h-3.5 text-[#a1a1aa]" />}
                            value={Math.round(layer.opacity * 100)}
                            min={0}
                            max={100}
                            step={1}
                            unit=" %"
                            onChange={(pct) =>
                                updateLayer(activeShotId, layer.id, (l) => ({
                                    ...l,
                                    opacity: Number((pct / 100).toFixed(2)),
                                }))
                            }
                        />
                        <ScrubInput
                            label={<Square className="w-3.5 h-3.5 rounded-[3px] text-[#a1a1aa]" />}
                            value={Math.round(layer.cornerRadius * 100)}
                            min={0}
                            max={100}
                            step={1}
                            unit=" %"
                            onChange={(pct) =>
                                updateLayer(activeShotId, layer.id, (l) =>
                                    l.kind === 'shape'
                                        ? { ...l, cornerRadius: Number((pct / 100).toFixed(2)) }
                                        : l
                                )
                            }
                        />
                    </div>
                </div>
            </div>

            {/* 5. FILL */}
            <div className="p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-[#e4e4e7]">
                        Fill
                    </span>
                    <button
                        type="button"
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
                    >
                        {hasFill ? <Minus className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                    </button>
                </div>

                {hasFill && (
                    <ColorPicker
                        color={fillColor}
                        onChange={(newColor) =>
                            updateLayer(activeShotId, layer.id, (l) =>
                                l.kind === 'shape'
                                    ? {
                                        ...l,
                                        fill: {
                                            kind: 'solid',
                                            color: newColor,
                                            opacity: l.fill.kind === 'solid' ? (l.fill.opacity || 1) : 1,
                                        },
                                    }
                                    : l
                            )
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
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onAddAnimationBlock?.('opacity');
                                }}
                                title="Add Opacity Animation Block"
                                className="relative flex items-center justify-center text-[#a1a1aa] hover:text-white p-0.5 cursor-pointer transition"
                            >
                                <Diamond className="w-3.5 h-3.5 fill-none" />
                                <span className="absolute -top-1 -right-1 text-[10px] font-bold leading-none select-none">
                                    +
                                </span>
                            </button>
                        </div>
                    </ColorPicker>
                )}
            </div>

            {/* 6. STROKE */}
            <div className="p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-[#e4e4e7]">
                        Stroke
                    </span>
                    <button
                        type="button"
                        onClick={() => {
                            if (hasStroke) {
                                updateLayer(activeShotId, layer.id, (l) =>
                                    l.kind === 'shape' ? { ...l, stroke: undefined } : l
                                );
                            } else {
                                updateStroke({
                                    color: '#D9D9D9',
                                    width: 0.002,
                                    opacity: 1,
                                    align: 'inside',
                                    style: 'solid',
                                });
                            }
                        }}
                        className="p-1 rounded hover:bg-white/10 text-[#a1a1aa] hover:text-white transition cursor-pointer"
                        title={hasStroke ? 'Remove Stroke' : 'Add Stroke'}
                    >
                        {hasStroke ? <Minus className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                    </button>
                </div>

                {hasStroke && (
                    <div className="space-y-2.5">
                        {/* Figma Color Pill */}
                        <ColorPicker
                            color={strokeColor}
                            onChange={(newColor) => updateStroke({ color: newColor })}
                            className="w-full h-8 px-2.5 rounded-lg bg-[#1c1c1f] hover:bg-[#242428] border border-white/[0.06] flex items-center justify-between cursor-pointer transition select-none"
                        >
                            <div className="flex items-center gap-2">
                                <div
                                    className="w-5 h-5 rounded-md border border-white/10 shrink-0"
                                    style={{ backgroundColor: strokeColor }}
                                />
                                <span className="font-mono text-[11px] font-medium text-white tracking-wider">
                                    {strokeColor.replace(/^#/, '').toUpperCase()}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-[11px] text-[#a1a1aa]">
                                    {Math.round(strokeOpacity * 100)} %
                                </span>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onAddAnimationBlock?.('opacity');
                                    }}
                                    title="Add Opacity Animation Block"
                                    className="relative flex items-center justify-center text-[#a1a1aa] hover:text-white p-0.5 cursor-pointer transition"
                                >
                                    <Diamond className="w-3.5 h-3.5 fill-none" />
                                    <span className="absolute -top-1 -right-1 text-[10px] font-bold leading-none select-none">
                                        +
                                    </span>
                                </button>
                            </div>
                        </ColorPicker>

                        {/* Width & Align & Style */}
                        <div className="space-y-1.5">
                            <span className="text-[11px] text-[#a1a1aa] block">Width</span>
                            <div className="flex items-center gap-1.5">
                                <div className="relative" ref={strokeAlignRef}>
                                    <button
                                        type="button"
                                        onClick={() => setStrokeAlignOpen((v) => !v)}
                                        className="h-7 px-2.5 rounded-lg bg-[#1c1c1f] hover:bg-[#252529] border border-white/[0.06] flex items-center gap-1.5 text-[11px] text-white cursor-pointer transition select-none"
                                    >
                                        <span className="capitalize">{layer.stroke?.align || 'inside'}</span>
                                        <ChevronDown className="w-3 h-3 text-[#a1a1aa]" />
                                    </button>
                                    {strokeAlignOpen && (
                                        <div className="absolute left-0 top-8 z-30 w-24 rounded-xl bg-[#18181b] border border-white/10 p-1 shadow-2xl space-y-0.5">
                                            {(['inside', 'center', 'outside'] as const).map((mode) => (
                                                <button
                                                    key={mode}
                                                    type="button"
                                                    onClick={() => {
                                                        updateStroke({ align: mode });
                                                        setStrokeAlignOpen(false);
                                                    }}
                                                    className={`w-full px-2 py-1 rounded-lg text-left text-[11px] capitalize cursor-pointer transition ${
                                                        (layer.stroke?.align || 'inside') === mode
                                                            ? 'bg-[#0088ff] text-white font-medium'
                                                            : 'text-[#e4e4e7] hover:bg-white/10 hover:text-white'
                                                    }`}
                                                >
                                                    {mode}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="flex-1">
                                    <ScrubInput
                                        label={<AlignJustify className="w-3 h-3 text-[#a1a1aa]" />}
                                        value={Math.round((layer.stroke?.width || 0.002) * 1000)}
                                        min={1}
                                        max={50}
                                        step={1}
                                        unit=" px"
                                        onChange={(w) =>
                                            updateStroke({
                                                width: Number((w / 1000).toFixed(4)),
                                            })
                                        }
                                    />
                                </div>

                                <button
                                    type="button"
                                    onClick={() => {
                                        const styles: Array<'solid' | 'dashed' | 'dotted'> = [
                                            'solid',
                                            'dashed',
                                            'dotted',
                                        ];
                                        const curStyle = layer.stroke?.style || 'solid';
                                        const nextStyle =
                                            styles[(styles.indexOf(curStyle) + 1) % styles.length];
                                        updateStroke({ style: nextStyle });
                                    }}
                                    title={`Stroke style: ${layer.stroke?.style || 'solid'}`}
                                    className="w-7 h-7 rounded-lg bg-[#1c1c1f] hover:bg-white/10 border border-white/[0.06] flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer transition shrink-0"
                                >
                                    <SlidersHorizontal className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 7. MASK */}
            <div className="p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-[#e4e4e7]">
                        Mask
                    </span>
                    <button
                        type="button"
                        onClick={() => {
                            if (layer.mask?.enabled) {
                                updateMask({ enabled: false });
                            } else {
                                updateMask({ enabled: true });
                            }
                        }}
                        className="p-1 rounded hover:bg-white/10 text-[#a1a1aa] hover:text-white transition cursor-pointer"
                        title={layer.mask?.enabled ? 'Disable Mask' : 'Add Mask'}
                    >
                        {layer.mask?.enabled ? <Minus className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                    </button>
                </div>

                {layer.mask?.enabled && (
                    <div className="space-y-3 pt-0.5">
                        {/* Shape: 3 Segmented Buttons */}
                        <div className="space-y-1.5">
                            <span className="text-[11px] text-[#a1a1aa] block">
                                Shape
                            </span>
                            <div className="grid grid-cols-3 gap-0.5 bg-[#1c1c1f] p-0.5 rounded-lg border border-white/[0.06]">
                                <button
                                    type="button"
                                    onClick={() => updateMask({ shape: 'rectangle' })}
                                    className={`h-6 rounded flex items-center justify-center cursor-pointer transition ${
                                        mask.shape === 'rectangle'
                                            ? 'bg-[#2a2a30] text-white'
                                            : 'text-[#a1a1aa] hover:text-white'
                                    }`}
                                    title="Rectangle"
                                >
                                    <Square className="w-3.5 h-3.5 rounded-[3px]" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => updateMask({ shape: 'circle' })}
                                    className={`h-6 rounded flex items-center justify-center cursor-pointer transition ${
                                        mask.shape === 'circle'
                                            ? 'bg-[#2a2a30] text-white'
                                            : 'text-[#a1a1aa] hover:text-white'
                                    }`}
                                    title="Circle"
                                >
                                    <Circle className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => updateMask({ shape: 'path' })}
                                    className={`h-6 rounded flex items-center justify-center cursor-pointer transition ${
                                        mask.shape === 'path'
                                            ? 'bg-[#2a2a30] text-white'
                                            : 'text-[#a1a1aa] hover:text-white'
                                    }`}
                                    title="Vector Path"
                                >
                                    <Spline className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>

                        {/* Feather */}
                        <div className="space-y-1.5">
                            <span className="text-[11px] text-[#a1a1aa] block">
                                Feather
                            </span>
                            <ScrubInput
                                label={<Feather className="w-3.5 h-3.5 text-[#a1a1aa]" />}
                                value={mask.feather}
                                min={0}
                                max={100}
                                step={1}
                                unit=" px"
                                onChange={(feather) => updateMask({ feather })}
                            />
                        </div>

                        {/* Opacity & grow */}
                        <div className="space-y-1.5">
                            <span className="text-[11px] text-[#a1a1aa] block">
                                Opacity &amp; grow
                            </span>
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
                        </div>

                        {/* Invert */}
                        <div className="flex items-center justify-between pt-0.5">
                            <span className="text-[11px] text-[#a1a1aa]">Invert</span>
                            <ToggleSwitch
                                checked={mask.invert}
                                onChange={(invert) => updateMask({ invert })}
                            />
                        </div>

                        {/* Show */}
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] text-[#a1a1aa]">Show</span>
                            <ToggleSwitch
                                checked={mask.show}
                                onChange={(show) => updateMask({ show })}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* 8. LAYER EFFECTS */}
            <div className="p-3.5 space-y-2.5 relative">
                <div className="flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-[#e4e4e7]">
                        Layer effects
                    </span>
                    <button
                        type="button"
                        onClick={() => setEffectsMenuOpen((v) => !v)}
                        className="p-1 rounded hover:bg-white/10 text-[#a1a1aa] hover:text-white transition cursor-pointer"
                        title="Add Layer Effect"
                    >
                        <Plus className="w-3.5 h-3.5" />
                    </button>
                </div>

                {/* Floating effects popover menu */}
                {effectsMenuOpen && (
                    <div
                        ref={effectsMenuRef}
                        className="absolute right-3.5 top-9 z-30 w-44 rounded-xl bg-[#18181b] border border-white/10 p-1.5 shadow-2xl space-y-0.5 backdrop-blur-md"
                    >
                        {[
                            { id: 'dropShadow', label: 'Drop shadow', icon: Copy },
                            { id: 'glow', label: 'Glow', icon: Zap },
                            { id: 'backdropBlur', label: 'Backdrop blur', icon: Eye },
                            { id: 'layerBlur', label: 'Layer blur', icon: Layers },
                            { id: 'liquidGlass', label: 'Liquid glass', icon: Droplet },
                            { id: 'warp', label: 'Warp', icon: Spline },
                        ].map((effect) => {
                            const Icon = effect.icon;
                            return (
                                <button
                                    key={effect.id}
                                    type="button"
                                    onClick={() => {
                                        handleAddEffect(effect.id);
                                        setEffectsMenuOpen(false);
                                    }}
                                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[11px] text-[#e4e4e7] hover:text-white hover:bg-white/10 text-left transition cursor-pointer"
                                >
                                    <Icon className="w-3.5 h-3.5 text-[#a1a1aa]" />
                                    <span>{effect.label}</span>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Active Effects Cards */}
                <div className="space-y-2">
                    {/* Drop Shadow */}
                    {layer.effects?.dropShadow?.enabled && (
                        <div className="p-2 rounded-lg bg-[#1c1c1f] border border-white/[0.06] space-y-2">
                            <div className="flex items-center justify-between text-[11px] font-medium text-[#e4e4e7]">
                                <div className="flex items-center gap-1.5">
                                    <Copy className="w-3.5 h-3.5 text-[#a1a1aa]" />
                                    <span>Drop shadow</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleRemoveEffect('dropShadow')}
                                    className="p-0.5 rounded hover:bg-white/10 text-[#a1a1aa] hover:text-white cursor-pointer"
                                    title="Remove Drop Shadow"
                                >
                                    <Minus className="w-3 h-3" />
                                </button>
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                                <ScrubInput
                                    label="Blur"
                                    value={layer.effects.dropShadow.blur}
                                    min={0}
                                    max={100}
                                    step={1}
                                    unit=" px"
                                    onChange={(blur) =>
                                        updateLayer(activeShotId, layer.id, (l) =>
                                            l.kind === 'shape' && l.effects.dropShadow
                                                ? {
                                                    ...l,
                                                    effects: {
                                                        ...l.effects,
                                                        dropShadow: { ...l.effects.dropShadow, blur },
                                                    },
                                                }
                                                : l
                                        )
                                    }
                                />
                                <ScrubInput
                                    label="Y"
                                    value={layer.effects.dropShadow.offsetY}
                                    min={-100}
                                    max={100}
                                    step={1}
                                    unit=" px"
                                    onChange={(offsetY) =>
                                        updateLayer(activeShotId, layer.id, (l) =>
                                            l.kind === 'shape' && l.effects.dropShadow
                                                ? {
                                                    ...l,
                                                    effects: {
                                                        ...l.effects,
                                                        dropShadow: { ...l.effects.dropShadow, offsetY },
                                                    },
                                                }
                                                : l
                                        )
                                    }
                                />
                            </div>
                        </div>
                    )}

                    {/* Glow */}
                    {layer.effects?.glow?.enabled && (
                        <div className="p-2 rounded-lg bg-[#1c1c1f] border border-white/[0.06] space-y-2">
                            <div className="flex items-center justify-between text-[11px] font-medium text-[#e4e4e7]">
                                <div className="flex items-center gap-1.5">
                                    <Zap className="w-3.5 h-3.5 text-[#a1a1aa]" />
                                    <span>Glow</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleRemoveEffect('glow')}
                                    className="p-0.5 rounded hover:bg-white/10 text-[#a1a1aa] hover:text-white cursor-pointer"
                                    title="Remove Glow"
                                >
                                    <Minus className="w-3 h-3" />
                                </button>
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                                <ScrubInput
                                    label="Radius"
                                    value={layer.effects.glow.radius}
                                    min={0}
                                    max={100}
                                    step={1}
                                    unit=" px"
                                    onChange={(radius) =>
                                        updateLayer(activeShotId, layer.id, (l) =>
                                            l.kind === 'shape' && l.effects.glow
                                                ? {
                                                    ...l,
                                                    effects: {
                                                        ...l.effects,
                                                        glow: { ...l.effects.glow, radius },
                                                    },
                                                }
                                                : l
                                        )
                                    }
                                />
                                <ScrubInput
                                    label="Int"
                                    value={Math.round(layer.effects.glow.intensity * 100)}
                                    min={0}
                                    max={200}
                                    step={5}
                                    unit=" %"
                                    onChange={(int) =>
                                        updateLayer(activeShotId, layer.id, (l) =>
                                            l.kind === 'shape' && l.effects.glow
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
                                                : l
                                        )
                                    }
                                />
                            </div>
                        </div>
                    )}

                    {/* Backdrop Blur */}
                    {typeof layer.effects?.backdropBlur === 'number' && (
                        <div className="p-2 rounded-lg bg-[#1c1c1f] border border-white/[0.06] space-y-2">
                            <div className="flex items-center justify-between text-[11px] font-medium text-[#e4e4e7]">
                                <div className="flex items-center gap-1.5">
                                    <Eye className="w-3.5 h-3.5 text-[#a1a1aa]" />
                                    <span>Backdrop blur</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleRemoveEffect('backdropBlur')}
                                    className="p-0.5 rounded hover:bg-white/10 text-[#a1a1aa] hover:text-white cursor-pointer"
                                    title="Remove Backdrop Blur"
                                >
                                    <Minus className="w-3 h-3" />
                                </button>
                            </div>
                            <ScrubInput
                                label="Blur"
                                value={layer.effects.backdropBlur}
                                min={0}
                                max={100}
                                step={1}
                                unit=" px"
                                onChange={(blur) =>
                                    updateLayer(activeShotId, layer.id, (l) =>
                                        l.kind === 'shape'
                                            ? {
                                                ...l,
                                                effects: { ...l.effects, backdropBlur: blur },
                                            }
                                            : l
                                    )
                                }
                            />
                        </div>
                    )}

                    {/* Layer Blur */}
                    {typeof layer.effects?.layerBlur === 'number' && (
                        <div className="p-2 rounded-lg bg-[#1c1c1f] border border-white/[0.06] space-y-2">
                            <div className="flex items-center justify-between text-[11px] font-medium text-[#e4e4e7]">
                                <div className="flex items-center gap-1.5">
                                    <Layers className="w-3.5 h-3.5 text-[#a1a1aa]" />
                                    <span>Layer blur</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleRemoveEffect('layerBlur')}
                                    className="p-0.5 rounded hover:bg-white/10 text-[#a1a1aa] hover:text-white cursor-pointer"
                                    title="Remove Layer Blur"
                                >
                                    <Minus className="w-3 h-3" />
                                </button>
                            </div>
                            <ScrubInput
                                label="Blur"
                                value={layer.effects.layerBlur}
                                min={0}
                                max={100}
                                step={1}
                                unit=" px"
                                onChange={(blur) =>
                                    updateLayer(activeShotId, layer.id, (l) =>
                                        l.kind === 'shape'
                                            ? {
                                                ...l,
                                                effects: { ...l.effects, layerBlur: blur },
                                            }
                                            : l
                                    )
                                }
                            />
                        </div>
                    )}

                    {/* Liquid Glass */}
                    {layer.effects?.liquidGlass?.enabled && (
                        <div className="p-2 rounded-lg bg-[#1c1c1f] border border-white/[0.06] space-y-2">
                            <div className="flex items-center justify-between text-[11px] font-medium text-[#e4e4e7]">
                                <div className="flex items-center gap-1.5">
                                    <Droplet className="w-3.5 h-3.5 text-[#a1a1aa]" />
                                    <span>Liquid glass</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleRemoveEffect('liquidGlass')}
                                    className="p-0.5 rounded hover:bg-white/10 text-[#a1a1aa] hover:text-white cursor-pointer"
                                    title="Remove Liquid Glass"
                                >
                                    <Minus className="w-3 h-3" />
                                </button>
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                                <ScrubInput
                                    label="Refract"
                                    value={Math.round((layer.effects.liquidGlass.refraction ?? 0.5) * 100)}
                                    min={0}
                                    max={100}
                                    step={1}
                                    unit=" %"
                                    onChange={(refr) =>
                                        updateLayer(activeShotId, layer.id, (l) =>
                                            l.kind === 'shape' && l.effects.liquidGlass
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
                                                : l
                                        )
                                    }
                                />
                                <ScrubInput
                                    label="Rough"
                                    value={Math.round((layer.effects.liquidGlass.roughness ?? 0.1) * 100)}
                                    min={0}
                                    max={100}
                                    step={1}
                                    unit=" %"
                                    onChange={(rough) =>
                                        updateLayer(activeShotId, layer.id, (l) =>
                                            l.kind === 'shape' && l.effects.liquidGlass
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
                                                : l
                                        )
                                    }
                                />
                            </div>
                        </div>
                    )}

                    {/* Warp */}
                    {layer.effects?.warp?.enabled && (
                        <div className="p-2 rounded-lg bg-[#1c1c1f] border border-white/[0.06] space-y-2">
                            <div className="flex items-center justify-between text-[11px] font-medium text-[#e4e4e7]">
                                <div className="flex items-center gap-1.5">
                                    <Spline className="w-3.5 h-3.5 text-[#a1a1aa]" />
                                    <span>Warp</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleRemoveEffect('warp')}
                                    className="p-0.5 rounded hover:bg-white/10 text-[#a1a1aa] hover:text-white cursor-pointer"
                                    title="Remove Warp"
                                >
                                    <Minus className="w-3 h-3" />
                                </button>
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                                <ScrubInput
                                    label="Amount"
                                    value={layer.effects.warp.amount ?? 10}
                                    min={0}
                                    max={100}
                                    step={1}
                                    unit=" px"
                                    onChange={(amount) =>
                                        updateLayer(activeShotId, layer.id, (l) =>
                                            l.kind === 'shape' && l.effects.warp
                                                ? {
                                                    ...l,
                                                    effects: {
                                                        ...l.effects,
                                                        warp: { ...l.effects.warp, amount },
                                                    },
                                                }
                                                : l
                                        )
                                    }
                                />
                                <ScrubInput
                                    label="Freq"
                                    value={layer.effects.warp.frequency ?? 1}
                                    min={1}
                                    max={10}
                                    step={1}
                                    onChange={(frequency) =>
                                        updateLayer(activeShotId, layer.id, (l) =>
                                            l.kind === 'shape' && l.effects.warp
                                                ? {
                                                    ...l,
                                                    effects: {
                                                        ...l.effects,
                                                        warp: { ...l.effects.warp, frequency },
                                                    },
                                                }
                                                : l
                                        )
                                    }
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
