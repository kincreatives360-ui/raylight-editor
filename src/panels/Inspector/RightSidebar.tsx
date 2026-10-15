// src/panels/Inspector/RightSidebar.tsx
import React, { useState } from 'react';
import {
    AlignLeft,
    AlignCenterHorizontal,
    AlignRight,
    AlignStartVertical,
    AlignCenterVertical,
    AlignEndVertical,
    RotateCcw,
    FlipHorizontal,
    FlipVertical,
    Lock,
    Unlock,
    Crosshair,
    ChevronDown,
    Plus,
    X,
    Eye,
    EyeOff,
    Minus,
    ArrowLeft,
    ArrowRight,
    SlidersHorizontal,
    Upload,
    Sparkles,
    Image as ImageIcon,
    Square,
    Film,
} from 'lucide-react';
import type {
    Shot,
    Layer,
    DeviceFrame as DeviceFrameType,
    TransitionType,
    AnimationBlock,
    AnimationBlockProperty,
    Easing,
    AspectRatio,
    CameraBlock,
} from '../../model/types';
import { degToRad, radToDeg } from '../../model/defaults';
import { useProjectStore } from '../../store/useProjectStore';
import { useSelectionStore } from '../../store/useSelectionStore';
import { usePlayheadStore } from '../../store/usePlayheadStore';
import { ASPECT_RATIO_CONFIG } from '../../stage/Stage';
import { ScrubInput } from '../../ui/ScrubInput';
import { SceneEffectsSection } from './sections/SceneEffectsSection';
import { CameraSection } from './sections/CameraSection';
import { LightingSection } from './sections/LightingSection';
import { BackgroundSection } from './sections/BackgroundSection';
import { SceneTransitionSection } from './sections/SceneTransitionSection';

interface RightSidebarProps {
    activeShot: Shot;
    selectedLayer: Layer | undefined;
    selectedLayerIds: string[];
    onSwapImageClick: () => void;
    onOpenExportModal: () => void;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({
    activeShot,
    selectedLayer,
    selectedLayerIds,
    onSwapImageClick,
    onOpenExportModal,
}) => {
    const { project, updateProject, updateShot, updateLayer } = useProjectStore();
    const { selectBlock, clearLayerSelection } = useSelectionStore();
    const { currentTimeMs } = usePlayheadStore();

    const [mainTab, setMainTab] = useState<'design' | 'animate'>('design');
    const [aspectLocked, setAspectLocked] = useState(true);
    const [addAnimMenuOpen, setAddAnimMenuOpen] = useState(false);
    const [swapMenuOpen, setSwapMenuOpen] = useState(false);
    const [projectPopoverOpen, setProjectPopoverOpen] = useState(false);
    const [shareToast, setShareToast] = useState(false);

    const refStageW = 1920;
    const refStageH = 1080;

    // In Raylight: Scene Effects & Background appear when the Scene itself OR its bottom layer is selected
    const sortedLayers = [...activeShot.layers].sort((a, b) => a.order - b.order);
    const isBottomLayerSelected =
        Boolean(selectedLayer) && sortedLayers[0]?.id === selectedLayer?.id;

    const handleQuickAlign = (axis: 'x' | 'y', targetVal: number) => {
        updateShot(activeShot.id, (s) => ({
            ...s,
            layers: s.layers.map((l) =>
                selectedLayerIds.includes(l.id) && !l.locked
                    ? { ...l, position: { ...l.position, [axis]: targetVal } }
                    : l
            ),
        }));
    };

    const handleSetDeviceType = (type: 'none' | DeviceFrameType['type']) => {
        if (!selectedLayer || selectedLayer.kind !== 'image') return;
        updateLayer(activeShot.id, selectedLayer.id, (l) => {
            if (l.kind !== 'image') return l;
            if (type === 'none') return { ...l, device: undefined };
            const defaultSize =
                type === 'iphone'
                    ? { width: 0.28, height: 0.58 }
                    : type === 'ipad'
                        ? { width: 0.48, height: 0.56 }
                        : { width: 0.64, height: 0.56 };
            return {
                ...l,
                size: defaultSize,
                device: {
                    type,
                    color: l.device?.color || 'silver',
                    gloss: l.device?.gloss ?? 0.78,
                    lidAngle: 100,
                    screenGlow: 0.4,
                },
            };
        });
    };

    const handleAddAnimationBlock = (property: AnimationBlockProperty) => {
        if (!selectedLayer) return;
        const shotLocalMs = Math.max(
            0,
            Math.min(activeShot.durationMs - 800, currentTimeMs - activeShot.startMs)
        );
        const id = `blk-${Date.now()}`;
        const defaultAmount =
            property === 'opacity'
                ? -0.5
                : property === 'scale'
                    ? 0.25
                    : property === 'tilt' || property === 'rotation'
                        ? { x: degToRad(15), y: degToRad(-20), z: 0 }
                        : { x: -0.55, y: 0, z: 0 };

        const newBlock: AnimationBlock = {
            id,
            label: `${property.charAt(0).toUpperCase() + property.slice(1)
                } animation`,
            property,
            startMs: Math.round(shotLocalMs),
            durationMs: 1200,
            easing: { kind: 'preset', name: 'ease-in-out' },
            amount: defaultAmount,
        };

        updateLayer(activeShot.id, selectedLayer.id, (l) => ({
            ...l,
            blocks: [...l.blocks, newBlock],
        }));
        selectBlock(id, selectedLayer.id);
        setAddAnimMenuOpen(false);
    };

    const handleUpdateBlock = (
        blockId: string,
        patch: Partial<AnimationBlock>
    ) => {
        if (!selectedLayer) return;
        updateLayer(activeShot.id, selectedLayer.id, (l) => ({
            ...l,
            blocks: l.blocks.map((b) => (b.id === blockId ? { ...b, ...patch } : b)),
        }));
    };

    const handleDeleteBlock = (blockId: string) => {
        if (!selectedLayer) return;
        updateLayer(activeShot.id, selectedLayer.id, (l) => ({
            ...l,
            blocks: l.blocks.filter((b) => b.id !== blockId),
        }));
    };

    return (
        <aside className="w-68 border-l border-white/[0.07] bg-[#0b0b0d] flex flex-col shrink-0 text-xs select-none h-full relative">
            {/* 1. TOP HEADER BAR: [R] Logo on Left | [Settings] [Export] [Share] on Right */}
            <div className="h-11 px-3.5 flex items-center justify-between shrink-0">
                <div className="w-6 h-6 rounded-full bg-[#18181b] border border-white/10 flex items-center justify-center font-bold text-xs text-white">
                    R
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setProjectPopoverOpen((v) => !v)}
                        title="Project Settings (Name, Aspect Ratio, FPS)"
                        className={`p-1.5 rounded-lg hover:bg-white/5 cursor-pointer transition ${projectPopoverOpen
                                ? 'text-[#0088ff] bg-white/5'
                                : 'text-[#a1a1aa] hover:text-white'
                            }`}
                    >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                    </button>

                    <button
                        onClick={onOpenExportModal}
                        title="Export MP4 Video or GIF"
                        className="p-1.5 rounded-lg hover:bg-white/5 text-[#a1a1aa] hover:text-white cursor-pointer transition"
                    >
                        <Upload className="w-3.5 h-3.5" />
                    </button>

                    <button
                        onClick={() => {
                            setShareToast(true);
                            setTimeout(() => setShareToast(false), 2000);
                            onOpenExportModal();
                        }}
                        className="px-3 py-1 rounded-lg bg-[#0088ff] hover:bg-[#0077e6] text-white font-semibold text-[11px] cursor-pointer transition shadow-sm"
                    >
                        {shareToast ? 'Copied!' : 'Share'}
                    </button>
                </div>
            </div>

            {/* Project-Level Settings Popover (Project Name, Aspect Ratio, FPS) */}
            {projectPopoverOpen && (
                <div className="mx-3 mb-2 p-3 rounded-xl bg-[#16161a] border border-white/10 space-y-2.5 shadow-2xl">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-white">
                        <span>Project Settings</span>
                        <button
                            onClick={() => setProjectPopoverOpen(false)}
                            className="text-[#71717a] hover:text-white cursor-pointer"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    <input
                        type="text"
                        value={project.name}
                        onChange={(e) =>
                            updateProject((p) => ({ ...p, name: e.target.value }))
                        }
                        className="w-full h-7 px-2 rounded-lg bg-[#1c1c1f] border border-white/10 text-[11px] text-white outline-none"
                        placeholder="Project Name"
                    />
                    <div className="grid grid-cols-2 gap-2">
                        <select
                            value={project.aspectRatio}
                            onChange={(e) =>
                                updateProject((p) => ({
                                    ...p,
                                    aspectRatio: e.target.value as AspectRatio,
                                }))
                            }
                            className="bg-[#1c1c1f] border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white outline-none"
                        >
                            {(Object.keys(ASPECT_RATIO_CONFIG) as AspectRatio[]).map((r) => (
                                <option key={r} value={r}>
                                    {r}
                                </option>
                            ))}
                        </select>
                        <select
                            value={project.fps}
                            onChange={(e) =>
                                updateProject((p) => ({
                                    ...p,
                                    fps: Number(e.target.value) as 30 | 60,
                                }))
                            }
                            className="bg-[#1c1c1f] border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white outline-none"
                        >
                            <option value={60}>60 FPS</option>
                            <option value={30}>30 FPS</option>
                        </select>
                    </div>
                </div>
            )}

            {/* 2. SUB-HEADER: [Design] | [Animate] Pill Tabs + Quick Scene Switcher */}
            <div className="h-9 border-y border-white/[0.07] px-3.5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={() => setMainTab('design')}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${mainTab === 'design'
                                ? 'bg-[#1f1f23] text-white'
                                : 'text-[#71717a] hover:text-[#d4d4d8]'
                            }`}
                    >
                        Design
                    </button>
                    <button
                        onClick={() => setMainTab('animate')}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${mainTab === 'animate'
                                ? 'bg-[#1f1f23] text-white'
                                : 'text-[#71717a] hover:text-[#d4d4d8]'
                            }`}
                    >
                        Animate
                    </button>
                </div>

                {selectedLayer && (
                    <button
                        onClick={() => clearLayerSelection()}
                        title="Inspect current Shot / Scene settings (Camera, Light, Background, Effects)"
                        className="px-2 py-0.5 rounded bg-white/[0.05] hover:bg-white/[0.1] text-[10px] text-[#a1a1aa] hover:text-white flex items-center gap-1 cursor-pointer transition"
                    >
                        <Film className="w-3 h-3 text-[#0088ff]" />
                        <span>{activeShot.name}</span>
                    </button>
                )}
            </div>

            {/* =================================================================== */}
            {/* TAB 1: DESIGN (WHEN A LAYER IS SELECTED)                            */}
            {/* =================================================================== */}
            {mainTab === 'design' && selectedLayer && (
                <div className="flex-1 overflow-y-auto divide-y divide-white/[0.06]">
                    {/* SECTION 1: IMAGE & SWAP SOURCE */}
                    {selectedLayer.kind === 'image' && (
                        <div className="p-3.5 space-y-2.5 relative">
                            <div className="text-[11px] font-medium text-[#e4e4e7]">
                                Image
                            </div>
                            <div className="flex items-center justify-between gap-2">
                                <div className="w-8 h-10 rounded bg-[#18181b] border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                                    {project.assets[selectedLayer.assetId]?.dataUrl ? (
                                        <img
                                            src={project.assets[selectedLayer.assetId].dataUrl}
                                            alt={selectedLayer.name}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <ImageIcon className="w-4 h-4 text-[#0088ff]" />
                                    )}
                                </div>

                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={onSwapImageClick}
                                        className="h-7 px-2.5 rounded-l-lg bg-[#1c1c1f] hover:bg-[#252529] text-[11px] text-[#e4e4e7] flex items-center gap-1.5 cursor-pointer transition"
                                    >
                                        <ImageIcon className="w-3 h-3 text-[#a1a1aa]" />
                                        <span>Swap source</span>
                                    </button>
                                    <button
                                        onClick={() => setSwapMenuOpen((v) => !v)}
                                        className="h-7 px-1.5 rounded-r-lg bg-[#1c1c1f] hover:bg-[#252529] text-[#a1a1aa] cursor-pointer transition border-l border-black/40"
                                        title="Choose 3D Device Mockup Frame"
                                    >
                                        <ChevronDown className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>

                            {swapMenuOpen && (
                                <div className="p-1.5 rounded-xl bg-[#18181b] border border-white/10 space-y-1 text-[11px]">
                                    <div className="px-2 py-0.5 text-[10px] text-[#71717a]">
                                        Device Mockup Frame
                                    </div>
                                    {(
                                        ['none', 'iphone', 'ipad', 'macbook', 'browser'] as const
                                    ).map((dev) => (
                                        <button
                                            key={dev}
                                            onClick={() => {
                                                handleSetDeviceType(dev);
                                                setSwapMenuOpen(false);
                                            }}
                                            className={`w-full px-2 py-1 rounded text-left capitalize cursor-pointer ${(selectedLayer.device?.type || 'none') === dev
                                                    ? 'bg-[#0088ff] text-white'
                                                    : 'text-[#d4d4d8] hover:bg-white/5'
                                                }`}
                                        >
                                            {dev === 'none' ? 'Bare Screenshot' : `${dev} Frame`}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* SECTION 2: POSITION */}
                    <div className="p-3.5 space-y-3">
                        <div className="text-[11px] font-medium text-[#e4e4e7]">
                            Position
                        </div>

                        <div className="space-y-1.5">
                            <span className="text-[10px] text-[#71717a] block">
                                Alignment
                            </span>
                            <div className="grid grid-cols-6 gap-0.5 bg-[#1c1c1f] p-0.5 rounded-lg">
                                <button
                                    onClick={() => handleQuickAlign('x', -0.32)}
                                    className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
                                    title="Align Left"
                                >
                                    <AlignLeft className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={() => handleQuickAlign('x', 0)}
                                    className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
                                    title="Align Center"
                                >
                                    <AlignCenterHorizontal className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={() => handleQuickAlign('x', 0.32)}
                                    className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
                                    title="Align Right"
                                >
                                    <AlignRight className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={() => handleQuickAlign('y', -0.32)}
                                    className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
                                    title="Align Top"
                                >
                                    <AlignStartVertical className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={() => handleQuickAlign('y', 0)}
                                    className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
                                    title="Align Middle"
                                >
                                    <AlignCenterVertical className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={() => handleQuickAlign('y', 0.32)}
                                    className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
                                    title="Align Bottom"
                                >
                                    <AlignEndVertical className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <span className="text-[10px] text-[#71717a] block">Position</span>
                            <div className="flex items-center gap-1.5">
                                <div className="grid grid-cols-2 gap-1.5 flex-1">
                                    <ScrubInput
                                        label="X"
                                        value={Math.round(selectedLayer.position.x * refStageW)}
                                        min={-3000}
                                        max={3000}
                                        step={10}
                                        onChange={(pxX) =>
                                            updateLayer(activeShot.id, selectedLayer.id, (l) => ({
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
                                        value={Math.round(selectedLayer.position.y * refStageH)}
                                        min={-3000}
                                        max={3000}
                                        step={10}
                                        onChange={(pxY) =>
                                            updateLayer(activeShot.id, selectedLayer.id, (l) => ({
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
                                    onClick={() =>
                                        updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                            ...l,
                                            position: { ...l.position, x: 0, y: 0 },
                                        }))
                                    }
                                    title="Center on Stage (0, 0)"
                                    className="p-1.5 text-[#71717a] hover:text-white cursor-pointer"
                                >
                                    <Crosshair className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <span className="text-[10px] text-[#71717a] block">
                                Depth &amp; rotation
                            </span>
                            <div className="grid grid-cols-2 gap-1.5 pr-6">
                                <ScrubInput
                                    label="Z"
                                    value={Math.round(selectedLayer.position.z * 500)}
                                    min={-1500}
                                    max={1500}
                                    step={10}
                                    onChange={(zScaled) =>
                                        updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                            ...l,
                                            position: {
                                                ...l.position,
                                                z: Number((zScaled / 500).toFixed(4)),
                                            },
                                        }))
                                    }
                                />
                                <ScrubInput
                                    label="∟"
                                    value={radToDeg(selectedLayer.rotation.z)}
                                    min={-180}
                                    max={180}
                                    step={1}
                                    unit="°"
                                    onChange={(deg) =>
                                        updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                            ...l,
                                            rotation: { ...l.rotation, z: degToRad(deg) },
                                        }))
                                    }
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <span className="text-[10px] text-[#71717a] block">Rotation</span>
                            <div className="grid grid-cols-3 gap-0.5 bg-[#1c1c1f] p-0.5 rounded-lg">
                                <button
                                    onClick={() =>
                                        updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                            ...l,
                                            rotation: {
                                                ...l.rotation,
                                                z: degToRad((radToDeg(l.rotation.z) + 90) % 360),
                                            },
                                        }))
                                    }
                                    title="Rotate 90°"
                                    className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={() =>
                                        updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                            ...l,
                                            scale: { ...l.scale, x: l.scale.x * -1 },
                                        }))
                                    }
                                    title="Flip Horizontal"
                                    className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
                                >
                                    <FlipHorizontal className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={() =>
                                        updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                            ...l,
                                            scale: { ...l.scale, y: l.scale.y * -1 },
                                        }))
                                    }
                                    title="Flip Vertical"
                                    className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
                                >
                                    <FlipVertical className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* SECTION 3: TILT */}
                    <div className="p-3.5 space-y-3">
                        <div className="text-[11px] font-medium text-[#e4e4e7]">Tilt</div>

                        <div className="space-y-1.5">
                            <span className="text-[10px] text-[#71717a] block">Tilt</span>
                            <div className="grid grid-cols-2 gap-1.5">
                                <ScrubInput
                                    label="X"
                                    value={radToDeg(selectedLayer.rotation.x)}
                                    min={-85}
                                    max={85}
                                    step={1}
                                    unit="°"
                                    onChange={(deg) =>
                                        updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                            ...l,
                                            rotation: { ...l.rotation, x: degToRad(deg) },
                                        }))
                                    }
                                />
                                <ScrubInput
                                    label="Y"
                                    value={radToDeg(selectedLayer.rotation.y)}
                                    min={-85}
                                    max={85}
                                    step={1}
                                    unit="°"
                                    onChange={(deg) =>
                                        updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                            ...l,
                                            rotation: { ...l.rotation, y: degToRad(deg) },
                                        }))
                                    }
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-0.5 bg-[#1c1c1f] p-0.5 rounded-lg">
                            <button
                                onClick={() =>
                                    updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                        ...l,
                                        rotation: { x: 0, y: 0, z: 0 },
                                    }))
                                }
                                title="Reset 3D Tilt to Flat (0°)"
                                className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={() =>
                                    updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                        ...l,
                                        rotation: {
                                            ...l.rotation,
                                            y: degToRad(-radToDeg(l.rotation.y)),
                                        },
                                    }))
                                }
                                title="Mirror Y Tilt Angle"
                                className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
                            >
                                <FlipHorizontal className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={() =>
                                    updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                        ...l,
                                        rotation: {
                                            x: degToRad(-40),
                                            y: degToRad(0),
                                            z: degToRad(0),
                                        },
                                    }))
                                }
                                title="Apply Hero -40° Perspective Tilt"
                                className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
                            >
                                <Square className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* SECTION 4: LAYOUT */}
                    <div className="p-3.5 space-y-3">
                        <div className="text-[11px] font-medium text-[#e4e4e7]">Layout</div>

                        <div className="space-y-1.5">
                            <span className="text-[10px] text-[#71717a] block">Size</span>
                            {selectedLayer.kind !== 'text' ? (
                                <div className="flex items-center gap-1.5">
                                    <div className="grid grid-cols-2 gap-1.5 flex-1">
                                        <ScrubInput
                                            label="W"
                                            value={Math.round(selectedLayer.size.width * refStageW)}
                                            min={60}
                                            max={4000}
                                            step={10}
                                            onChange={(pxW) => {
                                                const nextW = Number((pxW / refStageW).toFixed(4));
                                                const ratio =
                                                    selectedLayer.size.height /
                                                    Math.max(0.01, selectedLayer.size.width);
                                                updateLayer(activeShot.id, selectedLayer.id, (l) =>
                                                    l.kind !== 'text'
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
                                            value={Math.round(selectedLayer.size.height * refStageH)}
                                            min={60}
                                            max={4000}
                                            step={10}
                                            onChange={(pxH) => {
                                                const nextH = Number((pxH / refStageH).toFixed(4));
                                                const ratio =
                                                    selectedLayer.size.width /
                                                    Math.max(0.01, selectedLayer.size.height);
                                                updateLayer(activeShot.id, selectedLayer.id, (l) =>
                                                    l.kind !== 'text'
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
                                        onClick={() => setAspectLocked((v) => !v)}
                                        title="Constrain Proportions"
                                        className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer ${aspectLocked
                                                ? 'bg-[#1c1c1f] text-white'
                                                : 'text-[#71717a] hover:text-white'
                                            }`}
                                    >
                                        {aspectLocked ? (
                                            <Lock className="w-3.5 h-3.5" />
                                        ) : (
                                            <Unlock className="w-3.5 h-3.5" />
                                        )}
                                    </button>
                                </div>
                            ) : (
                                <ScrubInput
                                    label="W"
                                    value={Math.round(selectedLayer.maxWidth * refStageW)}
                                    min={200}
                                    max={1920}
                                    step={20}
                                    onChange={(pxW) =>
                                        updateLayer(activeShot.id, selectedLayer.id, (l) =>
                                            l.kind === 'text'
                                                ? {
                                                    ...l,
                                                    maxWidth: Number((pxW / refStageW).toFixed(3)),
                                                }
                                                : l
                                        )
                                    }
                                />
                            )}
                        </div>
                    </div>

                    {/* SECTION 5: APPEARANCE */}
                    <div className="p-3.5 space-y-3">
                        <div className="text-[11px] font-medium text-[#e4e4e7]">
                            Appearance
                        </div>

                        <div className="space-y-1.5">
                            <span className="text-[10px] text-[#71717a] block">Opacity</span>
                            <div className="grid grid-cols-2 gap-1.5 pr-6">
                                <ScrubInput
                                    label="[]"
                                    value={Math.round(selectedLayer.opacity * 100)}
                                    min={0}
                                    max={100}
                                    step={1}
                                    unit="%"
                                    onChange={(pct) =>
                                        updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                            ...l,
                                            opacity: Number((pct / 100).toFixed(2)),
                                        }))
                                    }
                                />
                                {selectedLayer.kind !== 'text' && (
                                    <ScrubInput
                                        label="╭"
                                        value={selectedLayer.cornerRadius}
                                        min={0}
                                        max={0.5}
                                        step={0.01}
                                        decimals={2}
                                        onChange={(cornerRadius) =>
                                            updateLayer(activeShot.id, selectedLayer.id, (l) =>
                                                l.kind !== 'text' ? { ...l, cornerRadius } : l
                                            )
                                        }
                                    />
                                )}
                            </div>
                        </div>

                        {selectedLayer.kind === 'text' && (
                            <div className="pt-2 space-y-2">
                                <span className="text-[10px] text-[#71717a] block">
                                    Text Content
                                </span>
                                <input
                                    type="text"
                                    value={selectedLayer.content}
                                    onChange={(e) => {
                                        const content = e.target.value;
                                        updateLayer(activeShot.id, selectedLayer.id, (l) =>
                                            l.kind === 'text' ? { ...l, content } : l
                                        );
                                    }}
                                    className="w-full h-7 px-2.5 rounded-lg bg-[#1c1c1f] text-[11px] text-white outline-none focus:border border-[#0088ff]"
                                />
                            </div>
                        )}
                    </div>

                    {/* Per Raylight Academy: Select the scene itself, or its bottom layer, to show Scene Effects & Background */}
                    {isBottomLayerSelected && (
                        <>
                            <BackgroundSection activeShot={activeShot} />
                            <SceneEffectsSection activeShot={activeShot} />
                        </>
                    )}
                </div>
            )}

            {/* =================================================================== */}
            {/* TAB 1 (SHOT / SCENE SELECTED): SHOT DESIGN HIERARCHY                */}
            {/* =================================================================== */}
            {mainTab === 'design' && !selectedLayer && (
                <div className="flex-1 overflow-y-auto divide-y divide-white/[0.06]">
                    <div className="p-3.5 space-y-1">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-white">
                                {activeShot.name || 'Shot 1'}
                            </span>
                            <span className="text-[10px] font-mono text-[#0088ff] bg-[#0088ff]/10 px-1.5 py-0.5 rounded">
                                {(activeShot.durationMs / 1000).toFixed(2)}s
                            </span>
                        </div>
                        <span className="text-[10px] text-[#71717a] block">
                            Shot Camera, Lighting, Background &amp; Scene Effects
                        </span>
                    </div>

                    <CameraSection activeShot={activeShot} />
                    <LightingSection activeShot={activeShot} />
                    <BackgroundSection activeShot={activeShot} />
                    <SceneEffectsSection activeShot={activeShot} />
                    <SceneTransitionSection activeShot={activeShot} />

                    <div className="p-3.5">
                        <button
                            type="button"
                            onClick={onOpenExportModal}
                            className="w-full py-2 px-3 rounded-xl bg-[#1c1c1f] hover:bg-[#252529] border border-white/[0.08] text-white font-medium text-xs flex items-center justify-center gap-2 cursor-pointer transition shadow-sm"
                        >
                            <Upload className="w-3.5 h-3.5 text-[#0088ff]" />
                            <span>Export shot</span>
                        </button>
                    </div>
                </div>
            )}

            {/* =================================================================== */}
            {/* TAB 2: ANIMATE (WHEN A LAYER IS SELECTED)                           */}
            {/* =================================================================== */}
            {mainTab === 'animate' && selectedLayer && (
                <div className="flex-1 overflow-y-auto divide-y divide-white/[0.06]">
                    <div className="p-3.5 relative">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-medium text-[#e4e4e7]">
                                Animations
                            </span>
                            <button
                                onClick={() => setAddAnimMenuOpen((v) => !v)}
                                className="p-1 rounded hover:bg-white/10 text-[#a1a1aa] hover:text-white cursor-pointer"
                                title="Add Animation Block"
                            >
                                <Plus className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        {addAnimMenuOpen && (
                            <div className="mt-2 p-1 rounded-xl bg-[#18181b] border border-white/10 shadow-2xl space-y-0.5 text-[11px]">
                                {(
                                    [
                                        { id: 'position', label: 'Position animation' },
                                        { id: 'tilt', label: 'Tilt animation' },
                                        { id: 'scale', label: 'Scale animation' },
                                        { id: 'rotation', label: 'Rotation animation' },
                                        { id: 'opacity', label: 'Opacity animation' },
                                        { id: 'shimmer', label: 'Light Shimmer' },
                                    ] as { id: AnimationBlockProperty; label: string }[]
                                ).map((item) => (
                                    <button
                                        key={item.id}
                                        onClick={() => handleAddAnimationBlock(item.id)}
                                        className="w-full px-2.5 py-1.5 rounded-lg text-left text-[#e4e4e7] hover:bg-[#0088ff] hover:text-white cursor-pointer transition"
                                    >
                                        + {item.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {selectedLayer.blocks.map((blk) => {
                        const isVec = typeof blk.amount === 'object';
                        const isAngle =
                            blk.property === 'tilt' || blk.property === 'rotation';
                        const scaleFactor = isAngle ? 1 : refStageW;

                        return (
                            <div key={blk.id} className="p-3.5 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-medium text-[#e4e4e7] capitalize">
                                        {blk.property} animation
                                    </span>
                                    <button
                                        onClick={() => handleDeleteBlock(blk.id)}
                                        className="p-1 rounded hover:bg-white/10 text-[#71717a] hover:text-white cursor-pointer"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>

                                <div className="space-y-1.5">
                                    <span className="text-[10px] text-[#71717a] block capitalize">
                                        {blk.property}
                                    </span>
                                    {isVec ? (
                                        <div className="grid grid-cols-3 gap-1.5">
                                            <ScrubInput
                                                label="X"
                                                value={
                                                    isAngle
                                                        ? radToDeg((blk.amount as any).x)
                                                        : Math.round((blk.amount as any).x * scaleFactor)
                                                }
                                                min={-3000}
                                                max={3000}
                                                step={isAngle ? 1 : 10}
                                                unit={isAngle ? '°' : ''}
                                                onChange={(v) =>
                                                    handleUpdateBlock(blk.id, {
                                                        amount: {
                                                            ...(blk.amount as any),
                                                            x: isAngle
                                                                ? degToRad(v)
                                                                : Number((v / scaleFactor).toFixed(4)),
                                                        },
                                                    })
                                                }
                                            />
                                            <ScrubInput
                                                label="Y"
                                                value={
                                                    isAngle
                                                        ? radToDeg((blk.amount as any).y)
                                                        : Math.round((blk.amount as any).y * refStageH)
                                                }
                                                min={-3000}
                                                max={3000}
                                                step={isAngle ? 1 : 10}
                                                unit={isAngle ? '°' : ''}
                                                onChange={(v) =>
                                                    handleUpdateBlock(blk.id, {
                                                        amount: {
                                                            ...(blk.amount as any),
                                                            y: isAngle
                                                                ? degToRad(v)
                                                                : Number((v / refStageH).toFixed(4)),
                                                        },
                                                    })
                                                }
                                            />
                                            <ScrubInput
                                                label="Z"
                                                value={
                                                    isAngle
                                                        ? radToDeg((blk.amount as any).z)
                                                        : Math.round((blk.amount as any).z * 500)
                                                }
                                                min={-1500}
                                                max={1500}
                                                step={isAngle ? 1 : 10}
                                                unit={isAngle ? '°' : ''}
                                                onChange={(v) =>
                                                    handleUpdateBlock(blk.id, {
                                                        amount: {
                                                            ...(blk.amount as any),
                                                            z: isAngle
                                                                ? degToRad(v)
                                                                : Number((v / 500).toFixed(4)),
                                                        },
                                                    })
                                                }
                                            />
                                        </div>
                                    ) : (
                                        <ScrubInput
                                            label="Δ"
                                            value={blk.amount as number}
                                            min={-2}
                                            max={2}
                                            step={0.05}
                                            decimals={2}
                                            onChange={(amount) =>
                                                handleUpdateBlock(blk.id, { amount })
                                            }
                                        />
                                    )}
                                </div>

                                {isVec && (
                                    <div className="space-y-1.5">
                                        <span className="text-[10px] text-[#71717a] block">
                                            Direction
                                        </span>
                                        <div className="grid grid-cols-2 gap-1 bg-[#161619] p-0.5 rounded-lg border border-white/[0.05]">
                                            <button
                                                onClick={() =>
                                                    handleUpdateBlock(blk.id, {
                                                        amount: {
                                                            ...(blk.amount as any),
                                                            x: -Math.abs((blk.amount as any).x || 0.35),
                                                        },
                                                    })
                                                }
                                                className={`h-6 rounded-md flex items-center justify-center cursor-pointer transition ${(blk.amount as any).x <= 0
                                                        ? 'bg-[#27272c] text-white'
                                                        : 'text-[#71717a] hover:text-white'
                                                    }`}
                                            >
                                                <ArrowLeft className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() =>
                                                    handleUpdateBlock(blk.id, {
                                                        amount: {
                                                            ...(blk.amount as any),
                                                            x: Math.abs((blk.amount as any).x || 0.35),
                                                        },
                                                    })
                                                }
                                                className={`h-6 rounded-md flex items-center justify-center cursor-pointer transition ${(blk.amount as any).x > 0
                                                        ? 'bg-[#27272c] text-white'
                                                        : 'text-[#71717a] hover:text-white'
                                                    }`}
                                            >
                                                <ArrowRight className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-1.5">
                                    <span className="text-[10px] text-[#71717a] block">
                                        Easing
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                        <select
                                            value={
                                                blk.easing.kind === 'bezier'
                                                    ? 'bezier'
                                                    : `${blk.easing.kind}:${blk.easing.name}`
                                            }
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                const easing: Easing =
                                                    val === 'bezier'
                                                        ? {
                                                            kind: 'bezier',
                                                            x1: 0.16,
                                                            y1: 1,
                                                            x2: 0.3,
                                                            y2: 1,
                                                        }
                                                        : val.startsWith('spring:')
                                                            ? {
                                                                kind: 'spring',
                                                                name: val.split(':')[1] as any,
                                                            }
                                                            : {
                                                                kind: 'preset',
                                                                name: val.split(':')[1] as any,
                                                            };
                                                handleUpdateBlock(blk.id, { easing });
                                            }}
                                            className="flex-1 h-7 rounded-lg bg-[#1c1c1f] border border-white/[0.06] px-2.5 text-[11px] text-white outline-none cursor-pointer"
                                        >
                                            <option value="preset:ease-in-out">
                                                Ease in and out
                                            </option>
                                            <option value="preset:ease-out">Ease out</option>
                                            <option value="preset:ease-out-expo">
                                                Ease out expo
                                            </option>
                                            <option value="preset:ease-out-back">
                                                Ease out back
                                            </option>
                                            <option value="spring:gentle">Spring: Gentle</option>
                                            <option value="spring:quick">Spring: Quick</option>
                                            <option value="spring:bouncy">Spring: Bouncy</option>
                                            <option value="preset:linear">Linear</option>
                                            <option value="bezier">Custom Cubic-Bezier</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {/* IN SECTION */}
                    <div className="p-3.5 space-y-2.5">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-medium text-[#e4e4e7]">In</span>
                            <button
                                onClick={() =>
                                    updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                        ...l,
                                        entrance: { ...l.entrance, type: 'fade', durationMs: 650 },
                                    }))
                                }
                                className="p-1 rounded hover:bg-white/10 text-[#a1a1aa] hover:text-white cursor-pointer"
                            >
                                <Plus className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        {selectedLayer.entrance.type !== 'none' && (
                            <div className="flex items-center gap-1.5">
                                <div className="flex-1 h-7 rounded-lg bg-[#1c1c1f] border border-white/[0.06] px-2.5 flex items-center gap-2">
                                    <Sparkles className="w-3 h-3 text-[#a1a1aa]" />
                                    <select
                                        value={selectedLayer.entrance.type}
                                        onChange={(e) =>
                                            updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                ...l,
                                                entrance: {
                                                    ...l.entrance,
                                                    type: e.target.value as TransitionType,
                                                },
                                            }))
                                        }
                                        className="w-full bg-transparent text-[11px] text-white outline-none cursor-pointer capitalize"
                                    >
                                        <option value="fade" className="bg-[#18181b]">
                                            Fade
                                        </option>
                                        <option value="slide-up" className="bg-[#18181b]">
                                            Slide Up
                                        </option>
                                        <option value="slide-down" className="bg-[#18181b]">
                                            Slide Down
                                        </option>
                                        <option value="slide-left" className="bg-[#18181b]">
                                            Slide Left
                                        </option>
                                        <option value="slide-right" className="bg-[#18181b]">
                                            Slide Right
                                        </option>
                                        <option value="scale-out" className="bg-[#18181b]">
                                            Scale In
                                        </option>
                                        <option value="mask-sweep" className="bg-[#18181b]">
                                            Mask Sweep
                                        </option>
                                    </select>
                                </div>

                                <button
                                    onClick={() =>
                                        updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                            ...l,
                                            entrance: {
                                                ...l.entrance,
                                                durationMs: l.entrance.durationMs === 0 ? 650 : 0,
                                            },
                                        }))
                                    }
                                    className="p-1 text-[#71717a] hover:text-white cursor-pointer"
                                >
                                    {selectedLayer.entrance.durationMs === 0 ? (
                                        <EyeOff className="w-3.5 h-3.5" />
                                    ) : (
                                        <Eye className="w-3.5 h-3.5" />
                                    )}
                                </button>

                                <button
                                    onClick={() =>
                                        updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                            ...l,
                                            entrance: { ...l.entrance, type: 'none' },
                                        }))
                                    }
                                    className="p-1 text-[#71717a] hover:text-white cursor-pointer"
                                >
                                    <Minus className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* OUT SECTION */}
                    <div className="p-3.5 space-y-2.5">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-medium text-[#e4e4e7]">
                                Out
                            </span>
                            <button
                                onClick={() =>
                                    updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                        ...l,
                                        exit: { ...l.exit, type: 'fade', durationMs: 550 },
                                    }))
                                }
                                className="p-1 rounded hover:bg-white/10 text-[#a1a1aa] hover:text-white cursor-pointer"
                            >
                                <Plus className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        {selectedLayer.exit.type !== 'none' && (
                            <div className="flex items-center gap-1.5">
                                <div className="flex-1 h-7 rounded-lg bg-[#1c1c1f] border border-white/[0.06] px-2.5 flex items-center gap-2">
                                    <Sparkles className="w-3 h-3 text-[#a1a1aa]" />
                                    <select
                                        value={selectedLayer.exit.type}
                                        onChange={(e) =>
                                            updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                ...l,
                                                exit: {
                                                    ...l.exit,
                                                    type: e.target.value as TransitionType,
                                                },
                                            }))
                                        }
                                        className="w-full bg-transparent text-[11px] text-white outline-none cursor-pointer capitalize"
                                    >
                                        <option value="fade" className="bg-[#18181b]">
                                            Fade
                                        </option>
                                        <option value="float-out" className="bg-[#18181b]">
                                            Float Out
                                        </option>
                                        <option value="scale-out" className="bg-[#18181b]">
                                            Scale Out
                                        </option>
                                        <option value="slide-down" className="bg-[#18181b]">
                                            Slide Down
                                        </option>
                                    </select>
                                </div>

                                <button
                                    onClick={() =>
                                        updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                            ...l,
                                            exit: { ...l.exit, type: 'none' },
                                        }))
                                    }
                                    className="p-1 text-[#71717a] hover:text-white cursor-pointer"
                                >
                                    <Minus className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* =================================================================== */}
            {/* TAB 2 (SHOT / SCENE SELECTED): SHOT CAMERA & TRANSITION ANIMATION   */}
            {/* =================================================================== */}
            {mainTab === 'animate' && !selectedLayer && (
                <div className="flex-1 overflow-y-auto divide-y divide-white/[0.06]">
                    <div className="p-3.5 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-medium text-[#e4e4e7]">
                                Camera Moves ({activeShot.cameraBlocks?.length || 0})
                            </span>
                            <button
                                type="button"
                                onClick={() => {
                                    const f1 = activeShot.framings?.[0]?.id || 'f1';
                                    const f2 = activeShot.framings?.[1]?.id || f1;
                                    const newBlock: CameraBlock = {
                                        id: `cam-blk-${Date.now()}`,
                                        label: `Camera Move ${(activeShot.cameraBlocks?.length || 0) + 1
                                            }`,
                                        startMs: 200,
                                        durationMs: 2000,
                                        fromFramingId: f1,
                                        toFramingId: f2,
                                        mode: 'dolly',
                                        easing: { kind: 'preset', name: 'ease-out-expo' },
                                    };
                                    updateShot(activeShot.id, (s) => ({
                                        ...s,
                                        cameraBlocks: [...(s.cameraBlocks || []), newBlock],
                                    }));
                                }}
                                className="p-1 rounded hover:bg-white/10 text-[#a1a1aa] hover:text-white cursor-pointer"
                                title="Add Camera Move"
                            >
                                <Plus className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        {!activeShot.cameraBlocks ||
                            activeShot.cameraBlocks.length === 0 ? (
                            <div className="text-[11px] text-[#71717a] py-3 text-center bg-[#141418] rounded-lg border border-white/[0.04]">
                                No camera moves animated. Click + to add dynamic camera motions!
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {activeShot.cameraBlocks.map((cb) => (
                                    <div
                                        key={cb.id}
                                        className="p-2.5 rounded-lg bg-[#161619] border border-white/[0.06] space-y-2"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-medium text-white">
                                                {cb.label || 'Camera Move'}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    updateShot(activeShot.id, (s) => ({
                                                        ...s,
                                                        cameraBlocks: s.cameraBlocks.filter(
                                                            (b) => b.id !== cb.id
                                                        ),
                                                    }))
                                                }
                                                className="text-[#71717a] hover:text-rose-400 p-0.5 cursor-pointer"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-1.5">
                                            <ScrubInput
                                                label="Start"
                                                value={cb.startMs}
                                                min={0}
                                                max={activeShot.durationMs}
                                                step={50}
                                                unit="ms"
                                                onChange={(startMs) =>
                                                    updateShot(activeShot.id, (s) => ({
                                                        ...s,
                                                        cameraBlocks: s.cameraBlocks.map((b) =>
                                                            b.id === cb.id ? { ...b, startMs } : b
                                                        ),
                                                    }))
                                                }
                                            />
                                            <ScrubInput
                                                label="Duration"
                                                value={cb.durationMs}
                                                min={200}
                                                max={activeShot.durationMs}
                                                step={50}
                                                unit="ms"
                                                onChange={(durationMs) =>
                                                    updateShot(activeShot.id, (s) => ({
                                                        ...s,
                                                        cameraBlocks: s.cameraBlocks.map((b) =>
                                                            b.id === cb.id ? { ...b, durationMs } : b
                                                        ),
                                                    }))
                                                }
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <SceneTransitionSection activeShot={activeShot} />
                </div>
            )}
        </aside>
    );
};