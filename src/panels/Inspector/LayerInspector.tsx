import { ColorField } from './ColorPicker';
// src/panels/Inspector/LayerInspector.tsx
import React, { useState } from 'react';
import {
    Sliders,
    Compass,
    Laptop,
    Image as ImageIcon,
    Shapes,
    Type,
    Sparkles,
    Sun,
    Palette,
    AlignLeft,
    AlignCenter,
    AlignRight,
    AlignCenterHorizontal,
    AlignCenterVertical,
    Upload,
    Plus,
    Trash2,
    Paintbrush,
    Moon,
    Flame,
} from 'lucide-react';
import type {
    Shot,
    Layer,
    BlendMode,
    ShapeLayer,
    DeviceFrame as DeviceFrameType,
} from '../../model/types';
import { degToRad, radToDeg } from '../../model/defaults';
import { useProjectStore } from '../../store/useProjectStore';
import { ScrubInput } from '../../ui/ScrubInput';

const ALL_BLEND_MODES: BlendMode[] = [
    'normal',
    'darken',
    'multiply',
    'lighten',
    'screen',
    'add',
    'difference',
];

const POPULAR_FONTS = [
    'Inter',
    'Roboto',
    'Outfit',
    'Montserrat',
    'Playfair Display',
    'Fira Code',
    'Plus Jakarta Sans',
    'Space Grotesk',
    'Cinzel',
    'Bebas Neue',
    'sans-serif',
    'serif',
    'monospace',
];

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

interface LayerInspectorProps {
    activeShot: Shot;
    selectedLayer: Layer | undefined;
    selectedLayerIds: string[];
}

export const LayerInspector: React.FC<LayerInspectorProps> = ({
    activeShot,
    selectedLayer,
    selectedLayerIds,
}) => {
    const { updateProject, updateShot, updateLayer, project } = useProjectStore();
    const [mode, setMode] = useState<'layer' | 'scene'>('layer');
    const [customFonts, setCustomFonts] = useState<string[]>([]);

    const handleFontFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedLayer || selectedLayer.kind !== 'text') return;
        const fontName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
        try {
            const buffer = await file.arrayBuffer();
            const fontFace = new FontFace(fontName, buffer);
            const loaded = await fontFace.load();
            (document.fonts as unknown as Set<FontFace>).add(loaded);
            setCustomFonts((prev) => (prev.includes(fontName) ? prev : [...prev, fontName]));
            updateLayer(activeShot.id, selectedLayer.id, (l) =>
                l.kind === 'text' ? { ...l, font: { ...l.font, family: fontName } } : l
            );
        } catch (err) {
            console.error('Failed to load custom font:', err);
        }
    };

    const handleQuickAlign = (axis: 'x' | 'y', targetVal: number) => {
        updateShot(activeShot.id, (s) => ({
            ...s,
            layers: s.layers.map((l) =>
                selectedLayerIds.includes(l.id) && !l.locked
                    ? {
                        ...l,
                        position: {
                            ...l.position,
                            [axis]: targetVal,
                        },
                    }
                    : l
            ),
        }));
    };

    const handleSetDeviceType = (type: 'none' | DeviceFrameType['type']) => {
        if (!selectedLayer || selectedLayer.kind !== 'image') return;
        updateLayer(activeShot.id, selectedLayer.id, (l) => {
            if (l.kind !== 'image') return l;
            if (type === 'none') {
                return { ...l, device: undefined };
            }
            const nextSize =
                type === 'iphone'
                    ? { width: 0.27, height: 0.56 }
                    : type === 'ipad'
                        ? { width: 0.48, height: 0.56 }
                        : { width: 0.64, height: 0.58 };

            return {
                ...l,
                size: nextSize,
                device: {
                    type,
                    color: l.device?.color || 'silver',
                    gloss: l.device?.gloss ?? 0.78,
                    lidAngle: l.device?.lidAngle ?? 100,
                    screenGlow: l.device?.screenGlow ?? 0.4,
                },
            };
        });
    };

    return (
        <aside className="w-80 border-l border-white/10 bg-[#0c0e17] flex flex-col shrink-0 text-xs select-none">
            {/* Top Mode Switcher: Selected Layer vs Scene & Light */}
            <div className="grid grid-cols-2 border-b border-white/10 p-1 gap-1 bg-[#08090f]">
                <button
                    onClick={() => setMode('layer')}
                    className={`py-1.5 rounded flex items-center justify-center gap-1.5 font-medium cursor-pointer transition ${mode === 'layer'
                            ? 'bg-indigo-600 text-white'
                            : 'text-gray-400 hover:text-white'
                        }`}
                >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Layer Inspector</span>
                </button>
                <button
                    onClick={() => setMode('scene')}
                    className={`py-1.5 rounded flex items-center justify-center gap-1.5 font-medium cursor-pointer transition ${mode === 'scene'
                            ? 'bg-indigo-600 text-white'
                            : 'text-gray-400 hover:text-white'
                        }`}
                >
                    <Sun className="w-3.5 h-3.5" />
                    <span>Shot &amp; Light</span>
                </button>
            </div>

            {/* =================================================================== */}
            {/* MODE 1: LAYER INSPECTOR                                             */}
            {/* =================================================================== */}
            {mode === 'layer' && (
                <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
                    {!selectedLayer ? (
                        <div className="text-gray-400 text-center py-8">
                            Select a layer on the stage or in the left list to inspect its
                            properties.
                        </div>
                    ) : (
                        <>
                            {/* Layer Name & Quick Stage Alignment */}
                            <div className="space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-400">
                                        {selectedLayerIds.length > 1
                                            ? `${selectedLayerIds.length} Layers Selected`
                                            : `${selectedLayer.kind} Layer`}
                                    </span>
                                    <span className="text-[10px] font-mono text-gray-500">
                                        Order #{selectedLayer.order}
                                    </span>
                                </div>

                                <input
                                    type="text"
                                    value={selectedLayer.name}
                                    onChange={(e) =>
                                        updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                            ...l,
                                            name: e.target.value,
                                        }))
                                    }
                                    className="w-full px-2.5 py-1.5 rounded-lg bg-black/50 border border-white/15 text-white font-medium outline-none focus:border-indigo-500"
                                />

                                {/* 6 Alignment Buttons */}
                                <div className="grid grid-cols-6 gap-1 pt-1">
                                    <button
                                        onClick={() => handleQuickAlign('x', -0.3)}
                                        title="Align Left"
                                        className="py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] cursor-pointer"
                                    >
                                        L
                                    </button>
                                    <button
                                        onClick={() => handleQuickAlign('x', 0)}
                                        title="Center X (0)"
                                        className="py-1 rounded bg-indigo-600/25 hover:bg-indigo-600/40 border border-indigo-500/40 text-indigo-200 flex items-center justify-center cursor-pointer"
                                    >
                                        <AlignCenterHorizontal className="w-3 h-3" />
                                    </button>
                                    <button
                                        onClick={() => handleQuickAlign('x', 0.3)}
                                        title="Align Right"
                                        className="py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] cursor-pointer"
                                    >
                                        R
                                    </button>
                                    <button
                                        onClick={() => handleQuickAlign('y', -0.3)}
                                        title="Align Top"
                                        className="py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] cursor-pointer"
                                    >
                                        T
                                    </button>
                                    <button
                                        onClick={() => handleQuickAlign('y', 0)}
                                        title="Middle Y (0)"
                                        className="py-1 rounded bg-indigo-600/25 hover:bg-indigo-600/40 border border-indigo-500/40 text-indigo-200 flex items-center justify-center cursor-pointer"
                                    >
                                        <AlignCenterVertical className="w-3 h-3" />
                                    </button>
                                    <button
                                        onClick={() => handleQuickAlign('y', 0.3)}
                                        title="Align Bottom"
                                        className="py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] cursor-pointer"
                                    >
                                        B
                                    </button>
                                </div>
                            </div>

                            {/* 1. 3D POSITION, TILT (DEGREES) & SCALE WITH SCRUB INPUTS */}
                            <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <span className="font-semibold text-gray-200 flex items-center gap-1.5">
                                        <Compass className="w-3.5 h-3.5 text-indigo-400" />
                                        3D Transform &amp; Tilt
                                    </span>
                                    <button
                                        onClick={() =>
                                            updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                ...l,
                                                rotation: { x: 0, y: 0, z: 0 },
                                            }))
                                        }
                                        className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/15 text-[10px] text-gray-300 cursor-pointer transition"
                                    >
                                        Reset Tilt
                                    </button>
                                </div>

                                <ScrubInput
                                    label="Position X (Frac)"
                                    value={selectedLayer.position.x}
                                    min={-0.8}
                                    max={0.8}
                                    step={0.01}
                                    decimals={2}
                                    onChange={(x) =>
                                        updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                            ...l,
                                            position: { ...l.position, x },
                                        }))
                                    }
                                />
                                <ScrubInput
                                    label="Position Y (Frac)"
                                    value={selectedLayer.position.y}
                                    min={-0.8}
                                    max={0.8}
                                    step={0.01}
                                    decimals={2}
                                    onChange={(y) =>
                                        updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                            ...l,
                                            position: { ...l.position, y },
                                        }))
                                    }
                                />
                                <ScrubInput
                                    label="3D Depth Z"
                                    value={selectedLayer.position.z}
                                    min={-1}
                                    max={1}
                                    step={0.02}
                                    decimals={2}
                                    onChange={(z) =>
                                        updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                            ...l,
                                            position: { ...l.position, z },
                                        }))
                                    }
                                />

                                <div className="border-t border-white/10 pt-2 space-y-2">
                                    <ScrubInput
                                        label="Pitch Tilt (Rotate X)"
                                        value={radToDeg(selectedLayer.rotation.x)}
                                        min={-85}
                                        max={85}
                                        step={1}
                                        decimals={1}
                                        unit="°"
                                        onChange={(deg) =>
                                            updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                ...l,
                                                rotation: { ...l.rotation, x: degToRad(deg) },
                                            }))
                                        }
                                    />
                                    <ScrubInput
                                        label="Yaw Swivel (Rotate Y)"
                                        value={radToDeg(selectedLayer.rotation.y)}
                                        min={-85}
                                        max={85}
                                        step={1}
                                        decimals={1}
                                        unit="°"
                                        onChange={(deg) =>
                                            updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                ...l,
                                                rotation: { ...l.rotation, y: degToRad(deg) },
                                            }))
                                        }
                                    />
                                    <ScrubInput
                                        label="Roll Spin (Rotate Z)"
                                        value={radToDeg(selectedLayer.rotation.z)}
                                        min={-180}
                                        max={180}
                                        step={1}
                                        decimals={1}
                                        unit="°"
                                        onChange={(deg) =>
                                            updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                ...l,
                                                rotation: { ...l.rotation, z: degToRad(deg) },
                                            }))
                                        }
                                    />
                                </div>

                                <div className="border-t border-white/10 pt-2 space-y-2">
                                    <ScrubInput
                                        label="Uniform Scale"
                                        value={selectedLayer.scale.x}
                                        min={0.1}
                                        max={3}
                                        step={0.02}
                                        decimals={2}
                                        unit="x"
                                        onChange={(s) =>
                                            updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                ...l,
                                                scale: { x: s, y: s, z: 1 },
                                            }))
                                        }
                                    />

                                    {selectedLayer.kind !== 'text' && (
                                        <>
                                            <ScrubInput
                                                label="Width (Frac 0..1)"
                                                value={selectedLayer.size.width}
                                                min={0.05}
                                                max={1.2}
                                                step={0.01}
                                                decimals={2}
                                                onChange={(width) =>
                                                    updateLayer(activeShot.id, selectedLayer.id, (l) =>
                                                        l.kind !== 'text'
                                                            ? { ...l, size: { ...l.size, width } }
                                                            : l
                                                    )
                                                }
                                            />
                                            <ScrubInput
                                                label="Height (Frac 0..1)"
                                                value={selectedLayer.size.height}
                                                min={0.05}
                                                max={1.2}
                                                step={0.01}
                                                decimals={2}
                                                onChange={(height) =>
                                                    updateLayer(activeShot.id, selectedLayer.id, (l) =>
                                                        l.kind !== 'text'
                                                            ? { ...l, size: { ...l.size, height } }
                                                            : l
                                                    )
                                                }
                                            />
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* 2A. IMAGE LAYER INSPECTOR (3D Device Frame, Crop, Corner Radius, Stroke) */}
                            {selectedLayer.kind === 'image' && (
                                <>
                                    <div className="p-3 rounded-xl bg-indigo-950/20 border border-indigo-500/30 space-y-2.5">
                                        <div className="font-semibold text-indigo-200 flex items-center gap-1.5">
                                            <Laptop className="w-3.5 h-3.5 text-indigo-400" />
                                            3D Device Frame
                                        </div>

                                        <div className="grid grid-cols-3 gap-1">
                                            {(
                                                [
                                                    'none',
                                                    'macbook',
                                                    'iphone',
                                                    'ipad',
                                                    'browser',
                                                ] as const
                                            ).map((devType) => (
                                                <button
                                                    key={devType}
                                                    onClick={() => handleSetDeviceType(devType)}
                                                    className={`py-1.5 px-2 rounded border text-[11px] capitalize cursor-pointer transition ${(selectedLayer.device?.type || 'none') === devType
                                                            ? 'bg-indigo-600 text-white border-indigo-400 font-medium'
                                                            : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                                                        }`}
                                                >
                                                    {devType === 'none' ? 'Bare' : devType}
                                                </button>
                                            ))}
                                        </div>

                                        {selectedLayer.device && (
                                            <div className="space-y-2 pt-2 border-t border-white/10">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-gray-400">Chassis Color</span>
                                                    <div className="flex gap-1">
                                                        {(['silver', 'black'] as const).map((clr) => (
                                                            <button
                                                                key={clr}
                                                                onClick={() =>
                                                                    updateLayer(
                                                                        activeShot.id,
                                                                        selectedLayer.id,
                                                                        (l) =>
                                                                            l.kind === 'image' && l.device
                                                                                ? {
                                                                                    ...l,
                                                                                    device: { ...l.device, color: clr },
                                                                                }
                                                                                : l
                                                                    )
                                                                }
                                                                className={`px-2 py-0.5 rounded text-[11px] capitalize border cursor-pointer ${selectedLayer.device?.color === clr
                                                                        ? 'bg-white/20 border-white text-white'
                                                                        : 'bg-white/5 border-white/10 text-gray-400'
                                                                    }`}
                                                            >
                                                                {clr}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                <ScrubInput
                                                    label="Surface Gloss"
                                                    value={selectedLayer.device.gloss}
                                                    min={0}
                                                    max={1}
                                                    step={0.02}
                                                    decimals={2}
                                                    onChange={(gloss) =>
                                                        updateLayer(activeShot.id, selectedLayer.id, (l) =>
                                                            l.kind === 'image' && l.device
                                                                ? { ...l, device: { ...l.device, gloss } }
                                                                : l
                                                        )
                                                    }
                                                />

                                                <ScrubInput
                                                    label="Screen Glow"
                                                    value={selectedLayer.device.screenGlow ?? 0.35}
                                                    min={0}
                                                    max={1}
                                                    step={0.02}
                                                    decimals={2}
                                                    onChange={(screenGlow) =>
                                                        updateLayer(activeShot.id, selectedLayer.id, (l) =>
                                                            l.kind === 'image' && l.device
                                                                ? {
                                                                    ...l,
                                                                    device: { ...l.device, screenGlow },
                                                                }
                                                                : l
                                                        )
                                                    }
                                                />

                                                {selectedLayer.device.type === 'macbook' && (
                                                    <ScrubInput
                                                        label="MacBook Lid Angle"
                                                        value={selectedLayer.device.lidAngle ?? 100}
                                                        min={35}
                                                        max={125}
                                                        step={1}
                                                        decimals={0}
                                                        unit="°"
                                                        onChange={(lidAngle) =>
                                                            updateLayer(
                                                                activeShot.id,
                                                                selectedLayer.id,
                                                                (l) =>
                                                                    l.kind === 'image' && l.device
                                                                        ? {
                                                                            ...l,
                                                                            device: { ...l.device, lidAngle },
                                                                        }
                                                                        : l
                                                            )
                                                        }
                                                    />
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Image Crop & Corner Radius */}
                                    <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-2">
                                        <div className="font-semibold text-gray-200 flex items-center gap-1.5">
                                            <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />
                                            Image Crop &amp; Corners
                                        </div>

                                        <ScrubInput
                                            label="Corner Radius (0..1)"
                                            value={selectedLayer.cornerRadius}
                                            min={0}
                                            max={0.5}
                                            step={0.01}
                                            decimals={2}
                                            onChange={(cornerRadius) =>
                                                updateLayer(activeShot.id, selectedLayer.id, (l) =>
                                                    l.kind === 'image' ? { ...l, cornerRadius } : l
                                                )
                                            }
                                        />

                                        {(['x', 'y', 'width', 'height'] as const).map((cropKey) => {
                                            const crop = selectedLayer.crop || {
                                                x: 0,
                                                y: 0,
                                                width: 1,
                                                height: 1,
                                            };
                                            return (
                                                <ScrubInput
                                                    key={cropKey}
                                                    label={`Crop ${cropKey.toUpperCase()}`}
                                                    value={crop[cropKey]}
                                                    min={
                                                        cropKey === 'width' || cropKey === 'height'
                                                            ? 0.1
                                                            : 0
                                                    }
                                                    max={
                                                        cropKey === 'width' || cropKey === 'height'
                                                            ? 1
                                                            : 0.8
                                                    }
                                                    step={0.01}
                                                    decimals={2}
                                                    onChange={(val) =>
                                                        updateLayer(activeShot.id, selectedLayer.id, (l) =>
                                                            l.kind === 'image'
                                                                ? {
                                                                    ...l,
                                                                    crop: {
                                                                        ...(l.crop || {
                                                                            x: 0,
                                                                            y: 0,
                                                                            width: 1,
                                                                            height: 1,
                                                                        }),
                                                                        [cropKey]: val,
                                                                    },
                                                                }
                                                                : l
                                                        )
                                                    }
                                                />
                                            );
                                        })}
                                    </div>

                                    {/* Image Border & Stroke */}
                                    <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-2.5">
                                        <div className="flex items-center justify-between">
                                            <div className="font-semibold text-gray-200 flex items-center gap-1.5">
                                                <Paintbrush className="w-3.5 h-3.5 text-cyan-400" />
                                                Border &amp; Stroke
                                            </div>
                                            <input
                                                type="checkbox"
                                                checked={Boolean(selectedLayer.stroke)}
                                                onChange={(e) => {
                                                    const hasStroke = e.target.checked;
                                                    updateLayer(activeShot.id, selectedLayer.id, (l) =>
                                                        l.kind === 'image'
                                                            ? {
                                                                ...l,
                                                                stroke: hasStroke
                                                                    ? {
                                                                        color: l.stroke?.color || '#818cf8',
                                                                        width: l.stroke?.width ?? 0.003,
                                                                        opacity: l.stroke?.opacity ?? 1,
                                                                    }
                                                                    : undefined,
                                                            }
                                                            : l
                                                    );
                                                }}
                                                className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
                                            />
                                        </div>

                                        {selectedLayer.stroke && (
                                            <div className="space-y-2 pt-1 border-t border-white/10">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-gray-400">Stroke Color</span>
                                                    <div className="flex items-center gap-2">
                                                        <ColorField
                                                            value={selectedLayer.stroke.color}
                                                            onChange={(e) => {
                                                                const color = e.target.value;
                                                                updateLayer(activeShot.id, selectedLayer.id, (l) =>
                                                                    l.kind === 'image'
                                                                        ? { ...l, stroke: { ...l.stroke!, color } }
                                                                        : l
                                                                );
                                                            }}
                                                            className="w-7 h-5 rounded cursor-pointer bg-transparent border border-white/20"
                                                        />
                                                        <input
                                                            type="text"
                                                            value={selectedLayer.stroke.color}
                                                            onChange={(e) => {
                                                                const color = e.target.value;
                                                                updateLayer(activeShot.id, selectedLayer.id, (l) =>
                                                                    l.kind === 'image'
                                                                        ? { ...l, stroke: { ...l.stroke!, color } }
                                                                        : l
                                                                );
                                                            }}
                                                            className="w-16 px-1.5 py-0.5 rounded bg-white/5 border border-white/15 text-white font-mono text-[10px] uppercase outline-none focus:border-cyan-400"
                                                        />
                                                    </div>
                                                </div>

                                                <ScrubInput
                                                    label="Stroke Width"
                                                    value={selectedLayer.stroke.width}
                                                    min={0.0005}
                                                    max={0.03}
                                                    step={0.0005}
                                                    decimals={4}
                                                    onChange={(width) =>
                                                        updateLayer(activeShot.id, selectedLayer.id, (l) =>
                                                            l.kind === 'image'
                                                                ? { ...l, stroke: { ...l.stroke!, width } }
                                                                : l
                                                        )
                                                    }
                                                />

                                                <ScrubInput
                                                    label="Stroke Opacity"
                                                    value={selectedLayer.stroke.opacity}
                                                    min={0}
                                                    max={1}
                                                    step={0.02}
                                                    decimals={2}
                                                    onChange={(opacity) =>
                                                        updateLayer(activeShot.id, selectedLayer.id, (l) =>
                                                            l.kind === 'image'
                                                                ? { ...l, stroke: { ...l.stroke!, opacity } }
                                                                : l
                                                        )
                                                    }
                                                />
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}

                            {/* Layer masking: assign any other layer as this layer's alpha-mask source. */}
                            <div className="p-3 rounded-xl bg-sky-950/20 border border-sky-500/25 space-y-2">
                                <div className="font-semibold text-sky-200 text-[11px]">Masking</div>
                                <label className="block text-[10px] text-gray-400">Mask source layer</label>
                                <select value={selectedLayer.maskLayerId || ''} onChange={(e) => updateLayer(activeShot.id, selectedLayer.id, (l) => ({ ...l, maskLayerId: e.target.value || undefined }))} className="w-full rounded-md bg-[#11131b] border border-white/10 px-2 py-1.5 text-[11px] text-white">
                                    <option value="">No mask</option>
                                    {activeShot.layers.filter((layer) => layer.id !== selectedLayer.id && (layer.kind === 'shape' || layer.id === selectedLayer.maskLayerId)).map((layer) => <option key={layer.id} value={layer.id}>{layer.name} ({layer.kind})</option>)}
                                </select>
                                <p className="text-[9px] leading-relaxed text-gray-500">Choose a shape layer as the mask source. Mask links are saved with the project and can be reassigned at any time.</p>
                            </div>

                            {/* 2B. SHAPE LAYER INSPECTOR */}
                            {selectedLayer.kind === 'shape' && (
                                <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/30 space-y-3">
                                    <div className="font-semibold text-purple-200 flex items-center gap-1.5">
                                        <Shapes className="w-3.5 h-3.5 text-purple-400" />
                                        Shape Geometry &amp; Fill
                                    </div>

                                    <div className="grid grid-cols-2 gap-1.5">
                                        {(
                                            ['rectangle', 'ellipse', 'line', 'arrow', 'polygon'] as Array<
                                                ShapeLayer['shape']
                                            >
                                        ).map((shp) => (
                                            <button
                                                key={shp}
                                                onClick={() =>
                                                    updateLayer(activeShot.id, selectedLayer.id, (l) =>
                                                        l.kind === 'shape' ? { ...l, shape: shp } : l
                                                    )
                                                }
                                                className={`py-1.5 px-2 rounded border text-[11px] capitalize cursor-pointer ${selectedLayer.shape === shp
                                                        ? 'bg-purple-600 text-white border-purple-400 font-medium'
                                                        : 'bg-white/5 border-white/10 text-gray-300'
                                                    }`}
                                            >
                                                {shp}
                                            </button>
                                        ))}
                                    </div>

                                    <ScrubInput
                                        label="Corner Radius"
                                        value={selectedLayer.cornerRadius}
                                        min={0}
                                        max={0.5}
                                        step={0.01}
                                        decimals={2}
                                        onChange={(cornerRadius) =>
                                            updateLayer(activeShot.id, selectedLayer.id, (l) =>
                                                l.kind === 'shape' ? { ...l, cornerRadius } : l
                                            )
                                        }
                                    />

                                    {/* Shape Fill Mode */}
                                    <div className="space-y-2 pt-1 border-t border-purple-500/20">
                                        <div className="flex items-center justify-between text-gray-300">
                                            <span className="font-medium text-[11px]">Fill Type</span>
                                            <div className="flex bg-white/5 p-0.5 rounded border border-white/10">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (selectedLayer.fill.kind === 'solid') return;
                                                        updateLayer(activeShot.id, selectedLayer.id, (l) =>
                                                            l.kind === 'shape'
                                                                ? {
                                                                    ...l,
                                                                    fill: {
                                                                        kind: 'solid',
                                                                        color: l.fill.kind === 'gradient' && l.fill.stops[0]?.color ? l.fill.stops[0].color : '#818cf8',
                                                                        opacity: 1,
                                                                    },
                                                                }
                                                                : l
                                                        );
                                                    }}
                                                    className={`px-2 py-0.5 rounded text-[10px] cursor-pointer ${
                                                        selectedLayer.fill.kind === 'solid'
                                                            ? 'bg-purple-600 text-white font-medium'
                                                            : 'text-gray-400 hover:text-white'
                                                    }`}
                                                >
                                                    Solid
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (selectedLayer.fill.kind === 'gradient') return;
                                                        const initialColor = selectedLayer.fill.color || '#818cf8';
                                                        updateLayer(activeShot.id, selectedLayer.id, (l) =>
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
                                                    className={`px-2 py-0.5 rounded text-[10px] cursor-pointer ${
                                                        selectedLayer.fill.kind === 'gradient'
                                                            ? 'bg-purple-600 text-white font-medium'
                                                            : 'text-gray-400 hover:text-white'
                                                    }`}
                                                >
                                                    Gradient
                                                </button>
                                            </div>
                                        </div>

                                        {selectedLayer.fill.kind === 'solid' && (
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-gray-400">Fill Color</span>
                                                    <div className="flex items-center gap-2">
                                                        <ColorField
                                                            value={selectedLayer.fill.color}
                                                            onChange={(e) => {
                                                                const color = e.target.value;
                                                                updateLayer(
                                                                    activeShot.id,
                                                                    selectedLayer.id,
                                                                    (l) =>
                                                                        l.kind === 'shape' && l.fill.kind === 'solid'
                                                                            ? {
                                                                                ...l,
                                                                                fill: { ...l.fill, color },
                                                                            }
                                                                            : l
                                                                );
                                                            }}
                                                            className="w-7 h-5 rounded cursor-pointer bg-transparent border border-white/20"
                                                        />
                                                        <input
                                                            type="text"
                                                            value={selectedLayer.fill.color}
                                                            onChange={(e) => {
                                                                const color = e.target.value;
                                                                updateLayer(
                                                                    activeShot.id,
                                                                    selectedLayer.id,
                                                                    (l) =>
                                                                        l.kind === 'shape' && l.fill.kind === 'solid'
                                                                            ? {
                                                                                ...l,
                                                                                fill: { ...l.fill, color },
                                                                            }
                                                                            : l
                                                                );
                                                            }}
                                                            className="w-16 px-1.5 py-0.5 rounded bg-white/5 border border-white/15 text-white font-mono text-[10px] uppercase outline-none focus:border-purple-400"
                                                        />
                                                    </div>
                                                </div>

                                                <ScrubInput
                                                    label="Fill Opacity"
                                                    value={selectedLayer.fill.opacity}
                                                    min={0}
                                                    max={1}
                                                    step={0.02}
                                                    decimals={2}
                                                    onChange={(opacity) =>
                                                        updateLayer(activeShot.id, selectedLayer.id, (l) =>
                                                            l.kind === 'shape' && l.fill.kind === 'solid'
                                                                ? { ...l, fill: { ...l.fill, opacity } }
                                                                : l
                                                        )
                                                    }
                                                />
                                            </div>
                                        )}

                                        {selectedLayer.fill.kind === 'gradient' && (
                                            <div className="space-y-2.5">
                                                <ScrubInput
                                                    label="Gradient Angle"
                                                    value={selectedLayer.fill.angle}
                                                    min={0}
                                                    max={360}
                                                    step={1}
                                                    decimals={0}
                                                    unit="°"
                                                    onChange={(angle) =>
                                                        updateLayer(activeShot.id, selectedLayer.id, (l) =>
                                                            l.kind === 'shape' && l.fill.kind === 'gradient'
                                                                ? { ...l, fill: { ...l.fill, angle } }
                                                                : l
                                                        )
                                                    }
                                                />

                                                {/* Gradient Preview Bar */}
                                                <div
                                                    className="w-full h-5 rounded-md border border-white/20"
                                                    style={{
                                                        background: `linear-gradient(${selectedLayer.fill.angle}deg, ${selectedLayer.fill.stops
                                                            .map((s) => `${s.color} ${(s.at * 100).toFixed(0)}%`)
                                                            .join(', ')})`,
                                                    }}
                                                />

                                                {/* Gradient Stops */}
                                                <div className="space-y-1.5">
                                                    <div className="flex items-center justify-between text-gray-400">
                                                        <span className="text-[10px]">Color Stops</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                if (selectedLayer.fill.kind !== 'gradient') return;
                                                                const stops = [...selectedLayer.fill.stops];
                                                                stops.push({ at: 0.5, color: '#ec4899' });
                                                                stops.sort((a, b) => a.at - b.at);
                                                                updateLayer(activeShot.id, selectedLayer.id, (l) =>
                                                                    l.kind === 'shape' && l.fill.kind === 'gradient'
                                                                        ? { ...l, fill: { ...l.fill, stops } }
                                                                        : l
                                                                );
                                                            }}
                                                            className="flex items-center gap-1 text-[10px] text-purple-400 hover:text-purple-300 cursor-pointer"
                                                        >
                                                            <Plus className="w-3 h-3" />
                                                            Add
                                                        </button>
                                                    </div>

                                                    {selectedLayer.fill.stops.map((stop, sIdx) => (
                                                        <div
                                                            key={sIdx}
                                                            className="flex items-center gap-1.5 bg-white/5 p-1 rounded border border-white/10"
                                                        >
                                                            <ColorField
                                                                value={stop.color}
                                                                onChange={(e) => {
                                                                    const color = e.target.value;
                                                                    updateLayer(activeShot.id, selectedLayer.id, (l) => {
                                                                        if (l.kind !== 'shape' || l.fill.kind !== 'gradient') return l;
                                                                        const nextStops = [...l.fill.stops];
                                                                        nextStops[sIdx] = { ...nextStops[sIdx], color };
                                                                        return { ...l, fill: { ...l.fill, stops: nextStops } };
                                                                    });
                                                                }}
                                                                className="w-5 h-5 rounded cursor-pointer bg-transparent border border-white/20 shrink-0"
                                                            />
                                                            <div className="flex-1">
                                                                <ScrubInput
                                                                    label={`Stop #${sIdx + 1}`}
                                                                    value={Math.round(stop.at * 100)}
                                                                    min={0}
                                                                    max={100}
                                                                    step={1}
                                                                    decimals={0}
                                                                    unit="%"
                                                                    onChange={(pct) => {
                                                                        updateLayer(activeShot.id, selectedLayer.id, (l) => {
                                                                            if (l.kind !== 'shape' || l.fill.kind !== 'gradient') return l;
                                                                            const nextStops = [...l.fill.stops];
                                                                            nextStops[sIdx] = { ...nextStops[sIdx], at: pct / 100 };
                                                                            nextStops.sort((a, b) => a.at - b.at);
                                                                            return { ...l, fill: { ...l.fill, stops: nextStops } };
                                                                        });
                                                                    }}
                                                                />
                                                            </div>
                                                            {selectedLayer.fill.kind === 'gradient' && selectedLayer.fill.stops.length > 2 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        updateLayer(activeShot.id, selectedLayer.id, (l) => {
                                                                            if (l.kind !== 'shape' || l.fill.kind !== 'gradient') return l;
                                                                            const nextStops = l.fill.stops.filter((_, i) => i !== sIdx);
                                                                            return { ...l, fill: { ...l.fill, stops: nextStops } };
                                                                        });
                                                                    }}
                                                                    className="p-1 rounded text-red-400 hover:bg-red-500/20 cursor-pointer"
                                                                >
                                                                    <Trash2 className="w-3 h-3" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Presets */}
                                                <div className="grid grid-cols-2 gap-1 pt-1">
                                                    {SHAPE_GRADIENT_PRESETS.map((preset) => (
                                                        <button
                                                            key={preset.name}
                                                            type="button"
                                                            onClick={() => {
                                                                updateLayer(activeShot.id, selectedLayer.id, (l) =>
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
                                                                );
                                                            }}
                                                            className="flex items-center gap-1.5 p-1 rounded bg-white/5 border border-white/10 hover:border-purple-400/50 cursor-pointer text-left"
                                                        >
                                                            <div
                                                                className="w-3.5 h-3.5 rounded shrink-0"
                                                                style={{
                                                                    background: `linear-gradient(${preset.angle}deg, ${preset.stops
                                                                        .map((s) => `${s.color} ${(s.at * 100).toFixed(0)}%`)
                                                                        .join(', ')})`,
                                                                }}
                                                            />
                                                            <span className="truncate text-[9px] text-gray-300">{preset.name}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Shape Border & Stroke */}
                                    <div className="space-y-2 pt-1 border-t border-purple-500/20">
                                        <div className="flex items-center justify-between">
                                            <div className="font-semibold text-gray-200 flex items-center gap-1.5">
                                                <Paintbrush className="w-3.5 h-3.5 text-cyan-400" />
                                                Border &amp; Stroke
                                            </div>
                                            <input
                                                type="checkbox"
                                                checked={Boolean(selectedLayer.stroke)}
                                                onChange={(e) => {
                                                    const hasStroke = e.target.checked;
                                                    updateLayer(activeShot.id, selectedLayer.id, (l) =>
                                                        l.kind === 'shape'
                                                            ? {
                                                                ...l,
                                                                stroke: hasStroke
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
                                                className="w-4 h-4 rounded accent-purple-600 cursor-pointer"
                                            />
                                        </div>

                                        {selectedLayer.stroke && (
                                            <div className="space-y-2 pt-1">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-gray-400">Stroke Color</span>
                                                    <div className="flex items-center gap-2">
                                                        <ColorField
                                                            value={selectedLayer.stroke.color}
                                                            onChange={(e) => {
                                                                const color = e.target.value;
                                                                updateLayer(activeShot.id, selectedLayer.id, (l) =>
                                                                    l.kind === 'shape'
                                                                        ? { ...l, stroke: { ...l.stroke!, color } }
                                                                        : l
                                                                );
                                                            }}
                                                            className="w-7 h-5 rounded cursor-pointer bg-transparent border border-white/20"
                                                        />
                                                        <input
                                                            type="text"
                                                            value={selectedLayer.stroke.color}
                                                            onChange={(e) => {
                                                                const color = e.target.value;
                                                                updateLayer(activeShot.id, selectedLayer.id, (l) =>
                                                                    l.kind === 'shape'
                                                                        ? { ...l, stroke: { ...l.stroke!, color } }
                                                                        : l
                                                                );
                                                            }}
                                                            className="w-16 px-1.5 py-0.5 rounded bg-white/5 border border-white/15 text-white font-mono text-[10px] uppercase outline-none focus:border-purple-400"
                                                        />
                                                    </div>
                                                </div>

                                                <ScrubInput
                                                    label="Stroke Width"
                                                    value={selectedLayer.stroke.width}
                                                    min={0.0005}
                                                    max={0.03}
                                                    step={0.0005}
                                                    decimals={4}
                                                    onChange={(width) =>
                                                        updateLayer(activeShot.id, selectedLayer.id, (l) =>
                                                            l.kind === 'shape'
                                                                ? { ...l, stroke: { ...l.stroke!, width } }
                                                                : l
                                                        )
                                                    }
                                                />

                                                <ScrubInput
                                                    label="Stroke Opacity"
                                                    value={selectedLayer.stroke.opacity}
                                                    min={0}
                                                    max={1}
                                                    step={0.02}
                                                    decimals={2}
                                                    onChange={(opacity) =>
                                                        updateLayer(activeShot.id, selectedLayer.id, (l) =>
                                                            l.kind === 'shape'
                                                                ? { ...l, stroke: { ...l.stroke!, opacity } }
                                                                : l
                                                        )
                                                    }
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* 2C. 3D TEXT LAYER INSPECTOR */}
                            {selectedLayer.kind === 'text' && (
                                <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 space-y-2.5">
                                    <div className="font-semibold text-amber-200 flex items-center gap-1.5">
                                        <Type className="w-3.5 h-3.5 text-amber-400" />
                                        3D Typography
                                    </div>

                                    <textarea
                                        rows={2}
                                        value={selectedLayer.content}
                                        onChange={(e) => {
                                            const content = e.target.value;
                                            updateLayer(activeShot.id, selectedLayer.id, (l) =>
                                                l.kind === 'text' ? { ...l, content } : l
                                            );
                                        }}
                                        className="w-full px-2.5 py-1.5 rounded bg-black/50 border border-white/15 text-white outline-none focus:border-amber-400 resize-none font-sans"
                                    />

                                    {/* Text Color */}
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-400">Text Color</span>
                                        <div className="flex items-center gap-2">
                                            <ColorField
                                                value={selectedLayer.font.color}
                                                onChange={(e) => {
                                                    const color = e.target.value;
                                                    updateLayer(activeShot.id, selectedLayer.id, (l) =>
                                                        l.kind === 'text' ? { ...l, font: { ...l.font, color } } : l
                                                    );
                                                }}
                                                className="w-7 h-5 rounded cursor-pointer bg-transparent border border-white/20"
                                            />
                                            <input
                                                type="text"
                                                value={selectedLayer.font.color}
                                                onChange={(e) => {
                                                    const color = e.target.value;
                                                    updateLayer(activeShot.id, selectedLayer.id, (l) =>
                                                        l.kind === 'text' ? { ...l, font: { ...l.font, color } } : l
                                                    );
                                                }}
                                                className="w-16 px-1.5 py-0.5 rounded bg-white/5 border border-white/15 text-white font-mono text-[10px] uppercase outline-none focus:border-amber-400"
                                            />
                                        </div>
                                    </div>

                                    {/* Font Family & Upload */}
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between text-gray-400">
                                            <span>Font Family</span>
                                            <label className="flex items-center gap-1 text-[10px] text-amber-400 hover:text-amber-300 cursor-pointer">
                                                <Upload className="w-3 h-3" />
                                                Upload Font
                                                <input
                                                    type="file"
                                                    accept=".woff2,.woff,.ttf,.otf"
                                                    onChange={handleFontFileUpload}
                                                    className="hidden"
                                                />
                                            </label>
                                        </div>
                                        <select
                                            value={selectedLayer.font.family}
                                            onChange={(e) => {
                                                const family = e.target.value;
                                                updateLayer(activeShot.id, selectedLayer.id, (l) =>
                                                    l.kind === 'text' ? { ...l, font: { ...l.font, family } } : l
                                                );
                                            }}
                                            className="w-full bg-white/5 border border-white/15 rounded px-2 py-1.5 text-white outline-none focus:border-amber-400 cursor-pointer text-xs"
                                        >
                                            <optgroup label="Curated Fonts">
                                                {POPULAR_FONTS.map((font) => (
                                                    <option key={font} value={font} className="bg-[#0c0e17]">
                                                        {font}
                                                    </option>
                                                ))}
                                            </optgroup>
                                            {customFonts.length > 0 && (
                                                <optgroup label="Uploaded Custom Fonts">
                                                    {customFonts.map((cf) => (
                                                        <option key={cf} value={cf} className="bg-[#0c0e17]">
                                                            {cf} (Custom)
                                                        </option>
                                                    ))}
                                                </optgroup>
                                            )}
                                        </select>
                                    </div>

                                    <ScrubInput
                                        label="Font Size (Frac)"
                                        value={selectedLayer.font.size}
                                        min={0.012}
                                        max={0.16}
                                        step={0.002}
                                        decimals={3}
                                        onChange={(size) =>
                                            updateLayer(activeShot.id, selectedLayer.id, (l) =>
                                                l.kind === 'text'
                                                    ? { ...l, font: { ...l.font, size } }
                                                    : l
                                            )
                                        }
                                    />

                                    <ScrubInput
                                        label="Font Weight"
                                        value={selectedLayer.font.weight}
                                        min={100}
                                        max={900}
                                        step={100}
                                        decimals={0}
                                        onChange={(weight) =>
                                            updateLayer(activeShot.id, selectedLayer.id, (l) =>
                                                l.kind === 'text'
                                                    ? {
                                                        ...l,
                                                        font: {
                                                            ...l.font,
                                                            weight: Math.round(weight / 100) * 100,
                                                        },
                                                    }
                                                    : l
                                            )
                                        }
                                    />

                                    <ScrubInput
                                        label="Letter Spacing"
                                        value={selectedLayer.font.letterSpacing}
                                        min={-0.08}
                                        max={0.3}
                                        step={0.005}
                                        decimals={3}
                                        unit="em"
                                        onChange={(letterSpacing) =>
                                            updateLayer(activeShot.id, selectedLayer.id, (l) =>
                                                l.kind === 'text'
                                                    ? { ...l, font: { ...l.font, letterSpacing } }
                                                    : l
                                            )
                                        }
                                    />

                                    <ScrubInput
                                        label="Max Box Width"
                                        value={selectedLayer.maxWidth}
                                        min={0.1}
                                        max={1}
                                        step={0.02}
                                        decimals={2}
                                        onChange={(maxWidth) =>
                                            updateLayer(activeShot.id, selectedLayer.id, (l) =>
                                                l.kind === 'text' ? { ...l, maxWidth } : l
                                            )
                                        }
                                    />

                                    <div className="flex items-center justify-between pt-1">
                                        <span className="text-gray-400">Text Align</span>
                                        <div className="flex gap-1">
                                            {(
                                                [
                                                    { id: 'left', icon: AlignLeft },
                                                    { id: 'center', icon: AlignCenter },
                                                    { id: 'right', icon: AlignRight },
                                                ] as const
                                            ).map((al) => {
                                                const Icon = al.icon;
                                                return (
                                                    <button
                                                        key={al.id}
                                                        onClick={() =>
                                                            updateLayer(
                                                                activeShot.id,
                                                                selectedLayer.id,
                                                                (l) =>
                                                                    l.kind === 'text'
                                                                        ? {
                                                                            ...l,
                                                                            font: { ...l.font, align: al.id },
                                                                        }
                                                                        : l
                                                            )
                                                        }
                                                        className={`p-1.5 rounded border cursor-pointer ${selectedLayer.font.align === al.id
                                                                ? 'bg-amber-500/30 border-amber-400 text-white'
                                                                : 'bg-white/5 border-white/10 text-gray-400'
                                                            }`}
                                                    >
                                                        <Icon className="w-3.5 h-3.5" />
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 3. COMPOSITING, BLUR, SHADOW & GLOW */}
                            <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-2.5">
                                <div className="font-semibold text-gray-200 flex items-center gap-1.5">
                                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                                    Compositing &amp; Blurs
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-gray-400">Blend Mode</span>
                                    <select
                                        value={selectedLayer.blendMode}
                                        onChange={(e) => {
                                            const blendMode = e.target.value as BlendMode;
                                            updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                ...l,
                                                blendMode,
                                            }));
                                        }}
                                        className="bg-white/5 border border-white/15 rounded px-2 py-1 text-white capitalize outline-none cursor-pointer"
                                    >
                                        {ALL_BLEND_MODES.map((bm) => (
                                            <option key={bm} value={bm} className="bg-[#0c0e17]">
                                                {bm}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <ScrubInput
                                    label="Layer Opacity"
                                    value={selectedLayer.opacity}
                                    min={0}
                                    max={1}
                                    step={0.02}
                                    decimals={2}
                                    onChange={(opacity) =>
                                        updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                            ...l,
                                            opacity,
                                        }))
                                    }
                                />

                                <ScrubInput
                                    label="Layer Blur"
                                    value={selectedLayer.effects.layerBlur ?? 0}
                                    min={0}
                                    max={0.25}
                                    step={0.005}
                                    decimals={3}
                                    onChange={(layerBlur) =>
                                        updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                            ...l,
                                            effects: { ...l.effects, layerBlur },
                                        }))
                                    }
                                />

                                <ScrubInput
                                    label="Backdrop Glass Blur"
                                    value={selectedLayer.effects.backdropBlur ?? 0}
                                    min={0}
                                    max={0.08}
                                    step={0.002}
                                    decimals={3}
                                    onChange={(backdropBlur) =>
                                        updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                            ...l,
                                            effects: { ...l.effects, backdropBlur },
                                        }))
                                    }
                                />
                            </div>

                            {/* 4. DROP SHADOW */}
                            <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <div className="font-semibold text-gray-200 flex items-center gap-1.5">
                                        <Moon className="w-3.5 h-3.5 text-indigo-400" />
                                        Drop Shadow
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={selectedLayer.effects.dropShadow?.enabled ?? false}
                                        onChange={(e) => {
                                            const enabled = e.target.checked;
                                            updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                ...l,
                                                effects: {
                                                    ...l.effects,
                                                    dropShadow: {
                                                        enabled,
                                                        color: l.effects.dropShadow?.color || '#000000',
                                                        opacity: l.effects.dropShadow?.opacity ?? 0.6,
                                                        blur: l.effects.dropShadow?.blur ?? 0.04,
                                                        offsetX: l.effects.dropShadow?.offsetX ?? 0,
                                                        offsetY: l.effects.dropShadow?.offsetY ?? 0.02,
                                                    },
                                                },
                                            }));
                                        }}
                                        className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
                                    />
                                </div>

                                {selectedLayer.effects.dropShadow?.enabled && (
                                    <div className="space-y-2 pt-1 border-t border-white/10">
                                        <div className="flex items-center justify-between">
                                            <span className="text-gray-400">Shadow Color</span>
                                            <div className="flex items-center gap-2">
                                                <ColorField
                                                    value={selectedLayer.effects.dropShadow.color}
                                                    onChange={(e) => {
                                                        const color = e.target.value;
                                                        updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                            ...l,
                                                            effects: {
                                                                ...l.effects,
                                                                dropShadow: { ...l.effects.dropShadow!, color },
                                                            },
                                                        }));
                                                    }}
                                                    className="w-7 h-5 rounded cursor-pointer bg-transparent border border-white/20"
                                                />
                                                <input
                                                    type="text"
                                                    value={selectedLayer.effects.dropShadow.color}
                                                    onChange={(e) => {
                                                        const color = e.target.value;
                                                        updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                            ...l,
                                                            effects: {
                                                                ...l.effects,
                                                                dropShadow: { ...l.effects.dropShadow!, color },
                                                            },
                                                        }));
                                                    }}
                                                    className="w-16 px-1.5 py-0.5 rounded bg-white/5 border border-white/15 text-white font-mono text-[10px] uppercase outline-none focus:border-indigo-400"
                                                />
                                            </div>
                                        </div>

                                        <ScrubInput
                                            label="Shadow Opacity"
                                            value={selectedLayer.effects.dropShadow.opacity}
                                            min={0}
                                            max={1}
                                            step={0.02}
                                            decimals={2}
                                            onChange={(opacity) =>
                                                updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                    ...l,
                                                    effects: {
                                                        ...l.effects,
                                                        dropShadow: { ...l.effects.dropShadow!, opacity },
                                                    },
                                                }))
                                            }
                                        />

                                        <ScrubInput
                                            label="Shadow Blur"
                                            value={selectedLayer.effects.dropShadow.blur}
                                            min={0}
                                            max={0.15}
                                            step={0.002}
                                            decimals={3}
                                            onChange={(blur) =>
                                                updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                    ...l,
                                                    effects: {
                                                        ...l.effects,
                                                        dropShadow: { ...l.effects.dropShadow!, blur },
                                                    },
                                                }))
                                            }
                                        />

                                        <ScrubInput
                                            label="Offset X"
                                            value={selectedLayer.effects.dropShadow.offsetX}
                                            min={-0.1}
                                            max={0.1}
                                            step={0.002}
                                            decimals={3}
                                            onChange={(offsetX) =>
                                                updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                    ...l,
                                                    effects: {
                                                        ...l.effects,
                                                        dropShadow: { ...l.effects.dropShadow!, offsetX },
                                                    },
                                                }))
                                            }
                                        />

                                        <ScrubInput
                                            label="Offset Y"
                                            value={selectedLayer.effects.dropShadow.offsetY}
                                            min={-0.1}
                                            max={0.1}
                                            step={0.002}
                                            decimals={3}
                                            onChange={(offsetY) =>
                                                updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                    ...l,
                                                    effects: {
                                                        ...l.effects,
                                                        dropShadow: { ...l.effects.dropShadow!, offsetY },
                                                    },
                                                }))
                                            }
                                        />
                                    </div>
                                )}
                            </div>

                            {/* 5. OUTER GLOW */}
                            <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <div className="font-semibold text-gray-200 flex items-center gap-1.5">
                                        <Flame className="w-3.5 h-3.5 text-amber-400" />
                                        Outer Glow
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={selectedLayer.effects.glow?.enabled ?? false}
                                        onChange={(e) => {
                                            const enabled = e.target.checked;
                                            updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                ...l,
                                                effects: {
                                                    ...l.effects,
                                                    glow: {
                                                        enabled,
                                                        color: l.effects.glow?.color || '#818cf8',
                                                        intensity: l.effects.glow?.intensity ?? 1.0,
                                                        radius: l.effects.glow?.radius ?? 0.05,
                                                    },
                                                },
                                            }));
                                        }}
                                        className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
                                    />
                                </div>

                                {selectedLayer.effects.glow?.enabled && (
                                    <div className="space-y-2 pt-1 border-t border-white/10">
                                        <div className="flex items-center justify-between">
                                            <span className="text-gray-400">Glow Color</span>
                                            <div className="flex items-center gap-2">
                                                <ColorField
                                                    value={selectedLayer.effects.glow.color}
                                                    onChange={(e) => {
                                                        const color = e.target.value;
                                                        updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                            ...l,
                                                            effects: {
                                                                ...l.effects,
                                                                glow: { ...l.effects.glow!, color },
                                                            },
                                                        }));
                                                    }}
                                                    className="w-7 h-5 rounded cursor-pointer bg-transparent border border-white/20"
                                                />
                                                <input
                                                    type="text"
                                                    value={selectedLayer.effects.glow.color}
                                                    onChange={(e) => {
                                                        const color = e.target.value;
                                                        updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                            ...l,
                                                            effects: {
                                                                ...l.effects,
                                                                glow: { ...l.effects.glow!, color },
                                                            },
                                                        }));
                                                    }}
                                                    className="w-16 px-1.5 py-0.5 rounded bg-white/5 border border-white/15 text-white font-mono text-[10px] uppercase outline-none focus:border-amber-400"
                                                />
                                            </div>
                                        </div>

                                        <ScrubInput
                                            label="Glow Intensity"
                                            value={selectedLayer.effects.glow.intensity}
                                            min={0}
                                            max={3.0}
                                            step={0.05}
                                            decimals={2}
                                            onChange={(intensity) =>
                                                updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                    ...l,
                                                    effects: {
                                                        ...l.effects,
                                                        glow: { ...l.effects.glow!, intensity },
                                                    },
                                                }))
                                            }
                                        />

                                        <ScrubInput
                                            label="Glow Radius"
                                            value={selectedLayer.effects.glow.radius}
                                            min={0}
                                            max={0.2}
                                            step={0.005}
                                            decimals={3}
                                            onChange={(radius) =>
                                                updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                    ...l,
                                                    effects: {
                                                        ...l.effects,
                                                        glow: { ...l.effects.glow!, radius },
                                                    },
                                                }))
                                            }
                                        />
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* =================================================================== */}
            {/* MODE 2: SHOT LIGHT & BACKGROUND INSPECTOR                           */}
            {/* =================================================================== */}
            {mode === 'scene' && (
                <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
                    <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-2.5">
                        <div className="font-semibold text-gray-200 flex items-center gap-1.5">
                            <Sun className="w-3.5 h-3.5 text-amber-400" />
                            Scene Light Rig ({activeShot.name})
                        </div>

                        <ScrubInput
                            label="Light X Position"
                            value={activeShot.light.position.x}
                            min={-0.6}
                            max={0.6}
                            step={0.02}
                            decimals={2}
                            onChange={(x) =>
                                updateShot(activeShot.id, (s) => ({
                                    ...s,
                                    light: {
                                        ...s.light,
                                        position: { ...s.light.position, x },
                                    },
                                }))
                            }
                        />
                        <ScrubInput
                            label="Light Y Position"
                            value={activeShot.light.position.y}
                            min={-0.6}
                            max={0.6}
                            step={0.02}
                            decimals={2}
                            onChange={(y) =>
                                updateShot(activeShot.id, (s) => ({
                                    ...s,
                                    light: {
                                        ...s.light,
                                        position: { ...s.light.position, y },
                                    },
                                }))
                            }
                        />
                        <ScrubInput
                            label="Light Intensity"
                            value={activeShot.light.intensity}
                            min={0}
                            max={2.5}
                            step={0.05}
                            decimals={2}
                            onChange={(intensity) =>
                                updateShot(activeShot.id, (s) => ({
                                    ...s,
                                    light: { ...s.light, intensity },
                                }))
                            }
                        />
                        <ScrubInput
                            label="Color Temp (Kelvin)"
                            value={activeShot.light.temperature}
                            min={2500}
                            max={9500}
                            step={100}
                            decimals={0}
                            unit="K"
                            onChange={(temperature) =>
                                updateShot(activeShot.id, (s) => ({
                                    ...s,
                                    light: { ...s.light, temperature },
                                }))
                            }
                        />
                        <ScrubInput
                            label="Ambient Fill"
                            value={activeShot.light.ambience}
                            min={0}
                            max={1}
                            step={0.02}
                            decimals={2}
                            onChange={(ambience) =>
                                updateShot(activeShot.id, (s) => ({
                                    ...s,
                                    light: { ...s.light, ambience },
                                }))
                            }
                        />
                    </div>

                    <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-2.5">
                        <div className="font-semibold text-gray-200 flex items-center gap-1.5">
                            <Palette className="w-3.5 h-3.5 text-indigo-400" />
                            Camera Lens Focal Length
                        </div>
                        <ScrubInput
                            label="Lens Focal Length"
                            value={project.defaultCamera?.focalLength ?? 50}
                            min={20}
                            max={120}
                            step={1}
                            decimals={0}
                            unit="mm"
                            onChange={(focalLength) =>
                                updateProject((p) => ({
                                    ...p,
                                    defaultCamera: {
                                        position: p.defaultCamera?.position ?? { x: 0, y: 0, z: 2.2 },
                                        rotation: p.defaultCamera?.rotation ?? { x: 0, y: 0, z: 0 },
                                        focalLength,
                                    },
                                }))
                            }
                        />
                    </div>
                </div>
            )}
        </aside>
    );
};