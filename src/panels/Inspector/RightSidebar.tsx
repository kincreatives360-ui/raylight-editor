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
    ChevronUp,
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
    CameraKeyframeEndpoint,
} from '../../model/types';
import { degToRad, radToDeg } from '../../model/defaults';
import { useProjectStore } from '../../store/useProjectStore';
import { useSelectionStore } from '../../store/useSelectionStore';
import { usePlayheadStore } from '../../store/usePlayheadStore';
import { ASPECT_RATIO_CONFIG } from '../../stage/Stage';
import { ScrubInput } from '../../ui/ScrubInput';
import { SceneEffectsSection } from './sections/SceneEffectsSection';
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
    const {
        selectedCameraBlockId,
        selectBlock,
        selectCameraBlock,
        clearLayerSelection,
    } = useSelectionStore();
    const { currentTimeMs } = usePlayheadStore();

    const [mainTab, setMainTab] = useState<'design' | 'animate'>('design');
    const [aspectLocked, setAspectLocked] = useState(true);
    const [addAnimMenuOpen, setAddAnimMenuOpen] = useState(false);
    const [swapMenuOpen, setSwapMenuOpen] = useState(false);
    const [projectPopoverOpen, setProjectPopoverOpen] = useState(false);
    const [shareToast, setShareToast] = useState(false);
    const [fromCollapsed, setFromCollapsed] = useState(false);
    const [toCollapsed, setToCollapsed] = useState(false);

    const refStageW = 1920;
    const refStageH = 1080;

    const sortedLayers = [...activeShot.layers].sort((a, b) => a.order - b.order);
    const isBottomLayerSelected =
        Boolean(selectedLayer) && sortedLayers[0]?.id === selectedLayer?.id;

    const activeCameraBlock: CameraBlock | undefined =
        activeShot.cameraBlocks?.find((cb) => cb.id === selectedCameraBlockId);

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
                    : property === 'cornerRadius'
                        ? 0.1
                        : property === 'layerBlur'
                            ? 12
                            : property === 'maskSweep' || property === 'shimmer'
                                ? 1
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

    const updateCameraBlock = (
        camBlockId: string,
        updater: (cb: CameraBlock) => CameraBlock
    ) => {
        updateShot(activeShot.id, (s) => ({
            ...s,
            cameraBlocks: s.cameraBlocks.map((cb) =>
                cb.id === camBlockId ? updater(cb) : cb
            ),
        }));
    };

    // Renders the From or To section for a selected Camera Block (Matching Screenshot 2026-10-15 202450.png)
    const renderCameraEndpointSection = (
        cb: CameraBlock,
        which: 'from' | 'to',
        collapsed: boolean,
        onToggleCollapse: () => void
    ) => {
        const fallback: CameraKeyframeEndpoint =
            which === 'from'
                ? { anchorX: -0.84, anchorY: 0.55, zoom: 1, roll: 0, orbit: 0, tilt: 0 }
                : {
                    anchorX: -0.795,
                    anchorY: 0.595,
                    zoom: 1.1,
                    roll: 0,
                    orbit: 0,
                    tilt: 0,
                };

        const ep: CameraKeyframeEndpoint = cb[which] || fallback;

        const patchEndpoint = (patch: Partial<CameraKeyframeEndpoint>) => {
            updateCameraBlock(cb.id, (curr) => ({
                ...curr,
                [which]: { ...(curr[which] || fallback), ...patch },
            }));
        };

        return (
            <div className="p-3.5 space-y-3">
                <div
                    onClick={onToggleCollapse}
                    className="flex items-center justify-between cursor-pointer"
                >
                    <span className="text-[11px] font-medium text-[#e4e4e7] capitalize">
                        {which}
                    </span>
                    {collapsed ? (
                        <ChevronDown className="w-3.5 h-3.5 text-[#71717a]" />
                    ) : (
                        <ChevronUp className="w-3.5 h-3.5 text-[#71717a]" />
                    )}
                </div>

                {!collapsed && (
                    <div className="space-y-3">
                        {/* Alignment 6-Icon Bar */}
                        <div className="space-y-1.5">
                            <span className="text-[10px] text-[#71717a] block">
                                Alignment
                            </span>
                            <div className="grid grid-cols-6 gap-0.5 bg-[#1c1c1f] p-0.5 rounded-lg">
                                <button
                                    onClick={() => patchEndpoint({ anchorX: -0.35 })}
                                    className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
                                >
                                    <AlignLeft className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={() => patchEndpoint({ anchorX: 0 })}
                                    className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
                                >
                                    <AlignCenterHorizontal className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={() => patchEndpoint({ anchorX: 0.35 })}
                                    className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
                                >
                                    <AlignRight className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={() => patchEndpoint({ anchorY: -0.35 })}
                                    className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
                                >
                                    <AlignStartVertical className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={() => patchEndpoint({ anchorY: 0 })}
                                    className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
                                >
                                    <AlignCenterVertical className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={() => patchEndpoint({ anchorY: 0.35 })}
                                    className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
                                >
                                    <AlignEndVertical className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>

                        {/* Anchor X & Y */}
                        <div className="space-y-1.5">
                            <span className="text-[10px] text-[#71717a] block">Anchor</span>
                            <div className="grid grid-cols-2 gap-1.5">
                                <ScrubInput
                                    label="X"
                                    value={Math.round(ep.anchorX * refStageW)}
                                    min={-3000}
                                    max={3000}
                                    step={10}
                                    onChange={(pxX) =>
                                        patchEndpoint({
                                            anchorX: Number((pxX / refStageW).toFixed(4)),
                                        })
                                    }
                                />
                                <ScrubInput
                                    label="Y"
                                    value={Math.round(ep.anchorY * refStageH)}
                                    min={-3000}
                                    max={3000}
                                    step={10}
                                    onChange={(pxY) =>
                                        patchEndpoint({
                                            anchorY: Number((pxY / refStageH).toFixed(4)),
                                        })
                                    }
                                />
                            </div>
                        </div>

                        {/* Zoom */}
                        <div className="space-y-1.5">
                            <span className="text-[10px] text-[#71717a] block">Zoom</span>
                            <ScrubInput
                                label="⊕"
                                value={ep.zoom}
                                min={0.25}
                                max={4}
                                step={0.05}
                                decimals={2}
                                unit="x"
                                onChange={(zoom) => patchEndpoint({ zoom })}
                            />
                        </div>

                        {/* Roll */}
                        <div className="space-y-1.5">
                            <span className="text-[10px] text-[#71717a] block">Roll</span>
                            <ScrubInput
                                label="∟"
                                value={ep.roll}
                                min={-180}
                                max={180}
                                step={1}
                                unit="°"
                                onChange={(roll) => patchEndpoint({ roll })}
                            />
                        </div>

                        {/* Orbit & tilt */}
                        <div className="space-y-1.5">
                            <span className="text-[10px] text-[#71717a] block">
                                Orbit &amp; tilt
                            </span>
                            <div className="grid grid-cols-2 gap-1.5">
                                <ScrubInput
                                    label="◎"
                                    value={ep.orbit}
                                    min={-85}
                                    max={85}
                                    step={1}
                                    unit="°"
                                    onChange={(orbit) => patchEndpoint({ orbit })}
                                />
                                <ScrubInput
                                    label="∠"
                                    value={ep.tilt}
                                    min={-85}
                                    max={85}
                                    step={1}
                                    unit="°"
                                    onChange={(tilt) => patchEndpoint({ tilt })}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <aside className="w-68 border-l border-white/[0.07] bg-[#0b0b0d] flex flex-col shrink-0 text-xs select-none h-full relative">
            {/* 1. TOP HEADER BAR */}
            <div className="h-11 px-3.5 flex items-center justify-between shrink-0">
                <div className="w-6 h-6 rounded-full bg-[#18181b] border border-white/10 flex items-center justify-center font-bold text-xs text-white">
                    R
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setProjectPopoverOpen((v) => !v)}
                        title="Project Settings"
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

            {/* =================================================================== */}
            {/* CAMERA BLOCK INSPECTOR (ONLY Shown When Camera Is Clicked or Added!) */}
            {/* Matches Screenshot 2026-10-15 202450.png & 202523.png 1-to-1!       */}
            {/* =================================================================== */}
            {activeCameraBlock ? (
                <div className="flex-1 overflow-y-auto divide-y divide-white/[0.06]">
                    <div className="px-3.5 py-2.5 flex items-center justify-between bg-emerald-950/20">
                        <span className="text-[11px] font-semibold text-emerald-300">
                            Camera Move
                        </span>
                        <button
                            onClick={() => selectCameraBlock(null)}
                            className="text-[10px] text-[#a1a1aa] hover:text-white cursor-pointer"
                        >
                            Done
                        </button>
                    </div>

                    {/* 1. FROM SECTION */}
                    {renderCameraEndpointSection(
                        activeCameraBlock,
                        'from',
                        fromCollapsed,
                        () => setFromCollapsed((v) => !v)
                    )}

                    {/* 2. TO SECTION */}
                    {renderCameraEndpointSection(
                        activeCameraBlock,
                        'to',
                        toCollapsed,
                        () => setToCollapsed((v) => !v)
                    )}

                    {/* 3. MOVE SECTION: [ Dolly | Zoom | Warp ] */}
                    <div className="p-3.5 space-y-2.5">
                        <span className="text-[11px] font-medium text-[#e4e4e7] block">
                            Move
                        </span>
                        <div className="grid grid-cols-3 gap-1 bg-[#161619] p-1 rounded-xl border border-white/[0.06]">
                            {(
                                [
                                    { id: 'dolly', label: 'Dolly' },
                                    { id: 'zoom', label: 'Zoom' },
                                    { id: 'dollyzoom', label: 'Warp' },
                                ] as const
                            ).map((m) => (
                                <button
                                    key={m.id}
                                    onClick={() =>
                                        updateCameraBlock(activeCameraBlock.id, (cb) => ({
                                            ...cb,
                                            mode: m.id,
                                        }))
                                    }
                                    className={`py-1.5 rounded-lg text-[11px] font-medium cursor-pointer transition ${activeCameraBlock.mode === m.id
                                            ? 'bg-[#2a2a30] text-white border border-white/15 shadow'
                                            : 'text-[#a1a1aa] hover:text-white'
                                        }`}
                                >
                                    {m.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 4. SHAKE SECTION: Amount [From 0%] [To 0%] */}
                    <div className="p-3.5 space-y-2.5">
                        <span className="text-[11px] font-medium text-[#e4e4e7] block">
                            Shake
                        </span>
                        <div className="space-y-1.5">
                            <span className="text-[10px] text-[#71717a] block">Amount</span>
                            <div className="grid grid-cols-2 gap-1.5">
                                <ScrubInput
                                    label="From"
                                    value={activeCameraBlock.shake?.from ?? 0}
                                    min={0}
                                    max={100}
                                    step={1}
                                    unit="%"
                                    onChange={(from) =>
                                        updateCameraBlock(activeCameraBlock.id, (cb) => ({
                                            ...cb,
                                            shake: { from, to: cb.shake?.to ?? 0 },
                                        }))
                                    }
                                />
                                <ScrubInput
                                    label="To"
                                    value={activeCameraBlock.shake?.to ?? 0}
                                    min={0}
                                    max={100}
                                    step={1}
                                    unit="%"
                                    onChange={(to) =>
                                        updateCameraBlock(activeCameraBlock.id, (cb) => ({
                                            ...cb,
                                            shake: { from: cb.shake?.from ?? 0, to },
                                        }))
                                    }
                                />
                            </div>
                        </div>
                    </div>

                    {/* 5. TIMING SECTION: Start & length + Easing */}
                    <div className="p-3.5 space-y-3">
                        <span className="text-[11px] font-medium text-[#e4e4e7] block">
                            Timing
                        </span>

                        <div className="space-y-1.5">
                            <span className="text-[10px] text-[#71717a] block">
                                Start &amp; length
                            </span>
                            <div className="grid grid-cols-2 gap-1.5">
                                <ScrubInput
                                    label="🕒"
                                    value={activeCameraBlock.startMs}
                                    min={0}
                                    max={activeShot.durationMs - 100}
                                    step={20}
                                    unit=" ms"
                                    onChange={(startMs) =>
                                        updateCameraBlock(activeCameraBlock.id, (cb) => ({
                                            ...cb,
                                            startMs,
                                        }))
                                    }
                                />
                                <ScrubInput
                                    label="⏱"
                                    value={activeCameraBlock.durationMs}
                                    min={100}
                                    max={activeShot.durationMs}
                                    step={20}
                                    unit=" ms"
                                    onChange={(durationMs) =>
                                        updateCameraBlock(activeCameraBlock.id, (cb) => ({
                                            ...cb,
                                            durationMs,
                                        }))
                                    }
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <span className="text-[10px] text-[#71717a] block">Easing</span>
                            <div className="flex items-center gap-1.5">
                                <select
                                    value={
                                        activeCameraBlock.easing.kind === 'bezier'
                                            ? 'bezier'
                                            : `${activeCameraBlock.easing.kind}:${activeCameraBlock.easing.name}`
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
                                        updateCameraBlock(activeCameraBlock.id, (cb) => ({
                                            ...cb,
                                            easing,
                                        }));
                                    }}
                                    className="flex-1 h-7 rounded-lg bg-[#1c1c1f] border border-white/[0.06] px-2.5 text-[11px] text-white outline-none cursor-pointer"
                                >
                                    <option value="preset:linear">Linear</option>
                                    <option value="preset:ease-in-out">Ease in and out</option>
                                    <option value="preset:ease-out">Ease out</option>
                                    <option value="preset:ease-out-expo">Ease out expo</option>
                                    <option value="spring:gentle">Spring: Gentle</option>
                                    <option value="bezier">Custom Cubic-Bezier</option>
                                </select>
                                <button
                                    onClick={() =>
                                        updateShot(activeShot.id, (s) => ({
                                            ...s,
                                            cameraBlocks: s.cameraBlocks.filter(
                                                (b) => b.id !== activeCameraBlock.id
                                            ),
                                        }))
                                    }
                                    title="Delete Camera Move"
                                    className="p-1.5 text-[#71717a] hover:text-rose-400 cursor-pointer"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    {/* 2. SUB-HEADER: [Design] | [Animate] Pill Tabs */}
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
                                className="px-2 py-0.5 rounded bg-white/[0.05] hover:bg-white/[0.1] text-[10px] text-[#a1a1aa] hover:text-white flex items-center gap-1 cursor-pointer transition"
                            >
                                <Film className="w-3 h-3 text-[#0088ff]" />
                                <span>{activeShot.name}</span>
                            </button>
                        )}
                    </div>

                    {/* =============================================================== */}
                    {/* TAB 1: DESIGN (WHEN A LAYER IS SELECTED)                        */}
                    {/* =============================================================== */}
                    {mainTab === 'design' && selectedLayer && (
                        <div className="flex-1 overflow-y-auto divide-y divide-white/[0.06]">
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
                                            >
                                                <ChevronDown className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>

                                    {swapMenuOpen && (
                                        <div className="p-1.5 rounded-xl bg-[#18181b] border border-white/10 space-y-1 text-[11px]">
                                            {(
                                                [
                                                    'none',
                                                    'iphone',
                                                    'ipad',
                                                    'macbook',
                                                    'browser',
                                                ] as const
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
                                                    {dev === 'none'
                                                        ? 'Bare Screenshot'
                                                        : `${dev} Frame`}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* POSITION */}
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
                                        >
                                            <AlignLeft className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => handleQuickAlign('x', 0)}
                                            className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
                                        >
                                            <AlignCenterHorizontal className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => handleQuickAlign('x', 0.32)}
                                            className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
                                        >
                                            <AlignRight className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => handleQuickAlign('y', -0.32)}
                                            className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
                                        >
                                            <AlignStartVertical className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => handleQuickAlign('y', 0)}
                                            className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
                                        >
                                            <AlignCenterVertical className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => handleQuickAlign('y', 0.32)}
                                            className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
                                        >
                                            <AlignEndVertical className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <span className="text-[10px] text-[#71717a] block">
                                        Position
                                    </span>
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
                                    <span className="text-[10px] text-[#71717a] block">
                                        Rotation
                                    </span>
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
                                            className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
                                        >
                                            <FlipVertical className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* TILT */}
                            <div className="p-3.5 space-y-3">
                                <div className="text-[11px] font-medium text-[#e4e4e7]">
                                    Tilt
                                </div>
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
                                <div className="grid grid-cols-3 gap-0.5 bg-[#1c1c1f] p-0.5 rounded-lg">
                                    <button
                                        onClick={() =>
                                            updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                ...l,
                                                rotation: { x: 0, y: 0, z: 0 },
                                            }))
                                        }
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
                                        className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
                                    >
                                        <Square className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>

                            {/* LAYOUT (Size W/H + Scale %) */}
                            <div className="p-3.5 space-y-3">
                                <div className="text-[11px] font-medium text-[#e4e4e7]">
                                    Layout
                                </div>

                                <div className="space-y-1.5">
                                    <span className="text-[10px] text-[#71717a] block">Size</span>
                                    {selectedLayer.kind !== 'text' ? (
                                        <div className="flex items-center gap-1.5">
                                            <div className="grid grid-cols-2 gap-1.5 flex-1">
                                                <ScrubInput
                                                    label="W"
                                                    value={Math.round(
                                                        selectedLayer.size.width * refStageW
                                                    )}
                                                    min={40}
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
                                                    value={Math.round(
                                                        selectedLayer.size.height * refStageH
                                                    )}
                                                    min={40}
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

                                {/* Scale X / Y % */}
                                <div className="space-y-1.5">
                                    <span className="text-[10px] text-[#71717a] block">
                                        Scale
                                    </span>
                                    <div className="grid grid-cols-2 gap-1.5 pr-6">
                                        <ScrubInput
                                            label="SX"
                                            value={Math.round(selectedLayer.scale.x * 100)}
                                            min={10}
                                            max={400}
                                            step={2}
                                            unit="%"
                                            onChange={(pct) =>
                                                updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                    ...l,
                                                    scale: {
                                                        ...l.scale,
                                                        x: Number((pct / 100).toFixed(2)),
                                                        y: aspectLocked
                                                            ? Number((pct / 100).toFixed(2))
                                                            : l.scale.y,
                                                    },
                                                }))
                                            }
                                        />
                                        <ScrubInput
                                            label="SY"
                                            value={Math.round(selectedLayer.scale.y * 100)}
                                            min={10}
                                            max={400}
                                            step={2}
                                            unit="%"
                                            onChange={(pct) =>
                                                updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                    ...l,
                                                    scale: {
                                                        ...l.scale,
                                                        y: Number((pct / 100).toFixed(2)),
                                                    },
                                                }))
                                            }
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* APPEARANCE */}
                            <div className="p-3.5 space-y-3">
                                <div className="text-[11px] font-medium text-[#e4e4e7]">
                                    Appearance
                                </div>
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

                            {isBottomLayerSelected && (
                                <>
                                    <BackgroundSection activeShot={activeShot} />
                                    <SceneEffectsSection activeShot={activeShot} />
                                </>
                            )}
                        </div>
                    )}

                    {/* =============================================================== */}
                    {/* TAB 1 (SHOT SELECTED — NO CAMERA UNLESS ADDED!)                 */}
                    {/* =============================================================== */}
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
                                    Background, Lighting &amp; Scene Effects
                                </span>
                            </div>

                            <BackgroundSection activeShot={activeShot} />
                            <LightingSection activeShot={activeShot} />
                            <SceneEffectsSection activeShot={activeShot} />
                            <SceneTransitionSection activeShot={activeShot} />
                        </div>
                    )}

                    {/* =============================================================== */}
                    {/* TAB 2: ANIMATE (ALL PARAMETERS ANIMATABLE!)                     */}
                    {/* =============================================================== */}
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
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                    </button>
                                </div>

                                {addAnimMenuOpen && (
                                    <div className="mt-2 p-1 rounded-xl bg-[#18181b] border border-white/10 shadow-2xl space-y-0.5 text-[11px]">
                                        {(
                                            [
                                                { id: 'position', label: 'Position & Depth (X, Y, Z)' },
                                                { id: 'tilt', label: '3D Tilt (Pitch & Yaw)' },
                                                { id: 'rotation', label: '2D Roll Rotation' },
                                                { id: 'scale', label: 'Scale Multiplier' },
                                                { id: 'size', label: 'Width & Height Size' },
                                                { id: 'opacity', label: 'Opacity Fade' },
                                                { id: 'cornerRadius', label: 'Corner Radius' },
                                                { id: 'layerBlur', label: 'Layer Blur' },
                                                { id: 'shimmer', label: 'Light Shimmer Sweep' },
                                                { id: 'maskSweep', label: 'Mask Reveal Sweep' },
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
                                                    max={30}
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

                                        {/* Timing (Start & Length) + Easing */}
                                        <div className="grid grid-cols-2 gap-1.5">
                                            <ScrubInput
                                                label="🕒"
                                                value={blk.startMs}
                                                min={0}
                                                max={activeShot.durationMs - 80}
                                                step={20}
                                                unit=" ms"
                                                onChange={(startMs) =>
                                                    handleUpdateBlock(blk.id, { startMs })
                                                }
                                            />
                                            <ScrubInput
                                                label="⏱"
                                                value={blk.durationMs}
                                                min={80}
                                                max={activeShot.durationMs}
                                                step={20}
                                                unit=" ms"
                                                onChange={(durationMs) =>
                                                    handleUpdateBlock(blk.id, { durationMs })
                                                }
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <span className="text-[10px] text-[#71717a] block">
                                                Easing
                                            </span>
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
                                                className="w-full h-7 rounded-lg bg-[#1c1c1f] border border-white/[0.06] px-2.5 text-[11px] text-white outline-none cursor-pointer"
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
                                            </select>
                                        </div>
                                    </div>
                                );
                            })}

                            {/* IN SECTION (With Duration & Delay Scrubbers!) */}
                            <div className="p-3.5 space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-medium text-[#e4e4e7]">
                                        In
                                    </span>
                                    <button
                                        onClick={() =>
                                            updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                ...l,
                                                entrance: {
                                                    ...l.entrance,
                                                    type: 'fade',
                                                    durationMs: 650,
                                                },
                                            }))
                                        }
                                        className="p-1 rounded hover:bg-white/10 text-[#a1a1aa] hover:text-white cursor-pointer"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                    </button>
                                </div>

                                {selectedLayer.entrance.type !== 'none' && (
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-1.5">
                                            <div className="flex-1 h-7 rounded-lg bg-[#1c1c1f] border border-white/[0.06] px-2.5 flex items-center gap-2">
                                                <Sparkles className="w-3 h-3 text-[#a1a1aa]" />
                                                <select
                                                    value={selectedLayer.entrance.type}
                                                    onChange={(e) =>
                                                        updateLayer(
                                                            activeShot.id,
                                                            selectedLayer.id,
                                                            (l) => ({
                                                                ...l,
                                                                entrance: {
                                                                    ...l.entrance,
                                                                    type: e.target.value as TransitionType,
                                                                },
                                                            })
                                                        )
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
                                                            durationMs:
                                                                l.entrance.durationMs === 0 ? 650 : 0,
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

                                        <div className="grid grid-cols-2 gap-1.5">
                                            <ScrubInput
                                                label="Delay"
                                                value={selectedLayer.entrance.delayMs || 0}
                                                min={0}
                                                max={activeShot.durationMs - 100}
                                                step={20}
                                                unit=" ms"
                                                onChange={(delayMs) =>
                                                    updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                        ...l,
                                                        entrance: { ...l.entrance, delayMs },
                                                    }))
                                                }
                                            />
                                            <ScrubInput
                                                label="Length"
                                                value={selectedLayer.entrance.durationMs}
                                                min={80}
                                                max={activeShot.durationMs}
                                                step={20}
                                                unit=" ms"
                                                onChange={(durationMs) =>
                                                    updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                        ...l,
                                                        entrance: { ...l.entrance, durationMs },
                                                    }))
                                                }
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* OUT SECTION (With Duration & Delay Scrubbers!) */}
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
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-1.5">
                                            <div className="flex-1 h-7 rounded-lg bg-[#1c1c1f] border border-white/[0.06] px-2.5 flex items-center gap-2">
                                                <Sparkles className="w-3 h-3 text-[#a1a1aa]" />
                                                <select
                                                    value={selectedLayer.exit.type}
                                                    onChange={(e) =>
                                                        updateLayer(
                                                            activeShot.id,
                                                            selectedLayer.id,
                                                            (l) => ({
                                                                ...l,
                                                                exit: {
                                                                    ...l.exit,
                                                                    type: e.target.value as TransitionType,
                                                                },
                                                            })
                                                        )
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

                                        <div className="grid grid-cols-2 gap-1.5">
                                            <ScrubInput
                                                label="Offset"
                                                value={selectedLayer.exit.delayMs || 0}
                                                min={0}
                                                max={activeShot.durationMs - 100}
                                                step={20}
                                                unit=" ms"
                                                onChange={(delayMs) =>
                                                    updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                        ...l,
                                                        exit: { ...l.exit, delayMs },
                                                    }))
                                                }
                                            />
                                            <ScrubInput
                                                label="Length"
                                                value={selectedLayer.exit.durationMs}
                                                min={80}
                                                max={activeShot.durationMs}
                                                step={20}
                                                unit=" ms"
                                                onChange={(durationMs) =>
                                                    updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                        ...l,
                                                        exit: { ...l.exit, durationMs },
                                                    }))
                                                }
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* TAB 2 (SHOT SELECTED): ADD CAMERA OR SCENE TRANSITION */}
                    {mainTab === 'animate' && !selectedLayer && (
                        <div className="flex-1 overflow-y-auto divide-y divide-white/[0.06]">
                            <div className="p-3.5 space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-medium text-[#e4e4e7]">
                                        Scene Camera
                                    </span>
                                    <button
                                        onClick={() => {
                                            const camId = `cam-blk-${Date.now()}`;
                                            updateShot(activeShot.id, (s) => ({
                                                ...s,
                                                cameraBlocks: [
                                                    ...(s.cameraBlocks || []),
                                                    {
                                                        id: camId,
                                                        label: 'Camera Move',
                                                        startMs: 0,
                                                        durationMs: s.durationMs,
                                                        fromFramingId: s.framings[0]?.id || 'f1',
                                                        toFramingId: s.framings[1]?.id || 'f2',
                                                        mode: 'dolly',
                                                        easing: { kind: 'preset', name: 'linear' },
                                                        from: {
                                                            anchorX: 0,
                                                            anchorY: 0,
                                                            zoom: 1,
                                                            roll: 0,
                                                            orbit: 0,
                                                            tilt: 0,
                                                        },
                                                        to: {
                                                            anchorX: -0.05,
                                                            anchorY: 0.02,
                                                            zoom: 1.15,
                                                            roll: 0,
                                                            orbit: 0,
                                                            tilt: 0,
                                                        },
                                                        shake: { from: 0, to: 0 },
                                                    },
                                                ],
                                            }));
                                            selectCameraBlock(camId);
                                        }}
                                        className="px-2.5 py-1 rounded-lg bg-[#0088ff] hover:bg-[#0077e6] text-white text-[10px] font-semibold cursor-pointer"
                                    >
                                        + Add Camera Move
                                    </button>
                                </div>
                                <p className="text-[10px] text-[#71717a] leading-relaxed">
                                    Add a Camera Move to unlock From / To anchors, Zoom, Orbit,
                                    Dolly/Warp modes, and Handheld Shake.
                                </p>
                            </div>

                            <SceneTransitionSection activeShot={activeShot} />
                        </div>
                    )}
                </>
            )}
        </aside>
    );
};