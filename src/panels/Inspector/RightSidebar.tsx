import { ColorField } from './ColorPicker';
// src/panels/Inspector/RightSidebar.tsx
import React, { useState, useRef, useEffect } from 'react';
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
    Type,
    Shapes,
    Trash2,
    Laptop,
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
    BlendMode,
    ShapeLayer,
} from '../../model/types';
import { isBlankProjectState } from '../../model/types';
import { degToRad, radToDeg } from '../../model/defaults';
import { useProjectStore } from '../../store/useProjectStore';
import { useSelectionStore } from '../../store/useSelectionStore';
import { usePlayheadStore } from '../../store/usePlayheadStore';
import { ASPECT_RATIO_CONFIG } from '../../stage/stageUtils';
import { ScrubInput } from '../../ui/ScrubInput';
import { SceneEffectsSection } from './sections/SceneEffectsSection';
import { BackgroundSection } from './sections/BackgroundSection';
import { SceneTransitionSection } from './sections/SceneTransitionSection';

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

const ALL_BLEND_MODES: BlendMode[] = [
    'normal',
    'darken',
    'multiply',
    'lighten',
    'screen',
    'add',
    'difference',
];

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
    const {
        project,
        updateProject,
        updateShot,
        updateLayer,
        deleteLayerFromShot,
    } = useProjectStore();
    const {
        selectedBlockId,
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
    const [customFonts, setCustomFonts] = useState<string[]>([]);

    const fontInputRef = useRef<HTMLInputElement>(null);
    const projectBgFileRef = useRef<HTMLInputElement>(null);

    const [bgColorDraft, setBgColorDraft] = useState(
        project.background.kind === 'solid' ? project.background.color : '#000000'
    );

    useEffect(() => {
        if (project.background.kind === 'solid') {
            setBgColorDraft(project.background.color);
        }
    }, [project.background]);

    const refStageW = 1920;
    const refStageH = 1080;

    const sortedLayers = [...activeShot.layers].sort((a, b) => a.order - b.order);
    const isBlankState = isBlankProjectState(project);
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
                    lidAngle: l.device?.lidAngle ?? 100,
                    screenGlow: l.device?.screenGlow ?? 0.4,
                },
            };
        });
    };

    const handleFontFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedLayer || selectedLayer.kind !== 'text') return;
        const fontName = file.name
            .replace(/\.[^/.]+$/, '')
            .replace(/[^a-zA-Z0-9_-]/g, '_');
        try {
            const buffer = await file.arrayBuffer();
            const fontFace = new FontFace(fontName, buffer);
            const loaded = await fontFace.load();
            (document.fonts as unknown as Set<FontFace>).add(loaded);
            setCustomFonts((prev) =>
                prev.includes(fontName) ? prev : [...prev, fontName]
            );
            updateLayer(activeShot.id, selectedLayer.id, (l) =>
                l.kind === 'text' ? { ...l, font: { ...l.font, family: fontName } } : l
            );
        } catch (err) {
            console.error('Failed to load custom font:', err);
        }
    };

    const handlePickProjectBgImage = (file: File | null) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = reader.result as string;
            const assetId = `bg-asset-${Date.now()}`;
            updateProject((p) => ({
                ...p,
                assets: {
                    ...p.assets,
                    [assetId]: {
                        id: assetId,
                        name: file.name,
                        mimeType: file.type || 'image/png',
                        dataUrl,
                        width: 0,
                        height: 0,
                    },
                },
                background: { kind: 'image', assetId },
            }));
        };
        reader.readAsDataURL(file);
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
                    : property === 'size'
                        ? { x: 0.1, y: 0.1, z: 0 }
                        : property === 'cornerRadius'
                            ? 0.1
                            : property === 'layerBlur'
                                ? 0.15
                                : property === 'maskSweep' || property === 'shimmer'
                                    ? 1
                                    : property === 'tilt' || property === 'rotation'
                                        ? { x: degToRad(15), y: degToRad(-20), z: 0 }
                                        : { x: -0.55, y: 0, z: 0 };

        const newBlock: AnimationBlock = {
            id,
            label: `${property.charAt(0).toUpperCase() + property.slice(1)} animation`,
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
        if (selectedBlockId === blockId) {
            selectBlock(null);
        }
    };

    const handleDeleteSelectedLayer = () => {
        if (!selectedLayer) return;
        deleteLayerFromShot(activeShot.id, selectedLayer.id);
        clearLayerSelection();
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
                                    title="Align Left"
                                >
                                    <AlignLeft className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={() => patchEndpoint({ anchorX: 0 })}
                                    className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
                                    title="Center X"
                                >
                                    <AlignCenterHorizontal className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={() => patchEndpoint({ anchorX: 0.35 })}
                                    className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
                                    title="Align Right"
                                >
                                    <AlignRight className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={() => patchEndpoint({ anchorY: -0.35 })}
                                    className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
                                    title="Align Top"
                                >
                                    <AlignStartVertical className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={() => patchEndpoint({ anchorY: 0 })}
                                    className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
                                    title="Center Y"
                                >
                                    <AlignCenterVertical className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={() => patchEndpoint({ anchorY: 0.35 })}
                                    className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
                                    title="Align Bottom"
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
        <aside className="w-64 border-l border-white/[0.07] bg-[#0b0b0d] flex flex-col shrink-0 text-xs select-none h-full relative">
            <input
                ref={fontInputRef}
                type="file"
                accept=".ttf,.otf,.woff,.woff2"
                onChange={handleFontFileUpload}
                className="hidden"
            />
            <input
                ref={projectBgFileRef}
                type="file"
                accept="image/*"
                onChange={(e) => handlePickProjectBgImage(e.target.files?.[0] || null)}
                className="hidden"
            />

            {/* 1. TOP HEADER BAR */}
            <div className="h-12 px-3 flex items-center justify-between shrink-0 border-b border-white/[0.06]">
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

            {/* PROJECT SETTINGS POPOVER */}
            {projectPopoverOpen && (
                <div className="mx-3 mt-2 mb-2 p-3 rounded-xl bg-[#16161a] border border-white/10 space-y-2.5 shadow-2xl z-30">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-white">
                        <span>Project</span>
                        <button
                            onClick={() => setProjectPopoverOpen(false)}
                            className="text-[#71717a] hover:text-white cursor-pointer"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {/* Name */}
                    <div className="space-y-1">
                        <span className="text-[10px] text-[#71717a]">Name</span>
                        <input
                            type="text"
                            value={project.name}
                            onChange={(e) =>
                                updateProject((p) => ({ ...p, name: e.target.value }))
                            }
                            className="w-full h-7 px-2.5 rounded-lg bg-[#1c1c1f] border border-white/10 text-[11px] text-white outline-none"
                        />
                    </div>

                    {/* Aspect Ratio */}
                    <div className="space-y-1">
                        <span className="text-[10px] text-[#71717a]">Aspect Ratio</span>
                        <select
                            value={project.aspectRatio}
                            onChange={(e) =>
                                updateProject((p) => ({
                                    ...p,
                                    aspectRatio: e.target.value as AspectRatio,
                                }))
                            }
                            className="w-full h-7 bg-[#1c1c1f] border border-white/10 rounded-lg px-2 text-[11px] text-white outline-none cursor-pointer"
                        >
                            {(Object.keys(ASPECT_RATIO_CONFIG) as AspectRatio[]).map((r) => (
                                <option key={r} value={r}>
                                    {r === '16:9'
                                        ? 'Landscape 16:9'
                                        : r === '9:16'
                                            ? 'Portrait 9:16'
                                            : r}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Lens (focal length) */}
                    <div className="space-y-1">
                        <span className="text-[10px] text-[#71717a]">Lens</span>
                        <ScrubInput
                            label="F"
                            value={project.defaultCamera?.focalLength ?? 50}
                            min={14}
                            max={200}
                            step={1}
                            unit="mm"
                            onChange={(mm) =>
                                updateProject((p) => ({
                                    ...p,
                                    defaultCamera: {
                                        position: p.defaultCamera?.position ?? {
                                            x: 0,
                                            y: 0,
                                            z: 2.65,
                                        },
                                        rotation: p.defaultCamera?.rotation ?? {
                                            x: 0,
                                            y: 0,
                                            z: 0,
                                        },
                                        focalLength: Math.max(14, Math.min(200, mm)),
                                    },
                                }))
                            }
                        />
                    </div>

                    {/* Background type + color */}
                    <div className="space-y-1.5">
                        <span className="text-[10px] text-[#71717a]">Background</span>
                        <div className="flex items-center gap-1 bg-[#1c1c1f] p-0.5 rounded-lg border border-white/[0.06]">
                            {(
                                [
                                    { key: 'solid', label: 'Color' },
                                    { key: 'image', label: 'Image' },
                                    { key: 'gradient', label: 'Shader' },
                                ] as const
                            ).map(({ key, label }) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => {
                                        if (key === 'solid') {
                                            const color =
                                                project.background.kind === 'solid'
                                                    ? project.background.color
                                                    : project.background.kind === 'gradient'
                                                        ? project.background.stops[0]?.color ??
                                                        '#0A0A0C'
                                                        : '#0A0A0C';
                                            updateProject((p) => ({
                                                ...p,
                                                background: { kind: 'solid', color },
                                            }));
                                        } else if (key === 'gradient') {
                                            const color =
                                                project.background.kind === 'solid'
                                                    ? project.background.color
                                                    : '#0a0a0c';
                                            updateProject((p) => ({
                                                ...p,
                                                background: {
                                                    kind: 'gradient',
                                                    angle: 135,
                                                    stops: [
                                                        { at: 0, color },
                                                        { at: 1, color: '#000000' },
                                                    ],
                                                },
                                            }));
                                        } else {
                                            updateProject((p) => ({
                                                ...p,
                                                background: {
                                                    kind: 'image',
                                                    assetId:
                                                        p.background.kind === 'image'
                                                            ? p.background.assetId
                                                            : '',
                                                },
                                            }));
                                        }
                                    }}
                                    className={`flex-1 px-2 py-1 rounded-md text-[10px] font-medium transition cursor-pointer ${(key === 'solid' && project.background.kind === 'solid') ||
                                        (key === 'gradient' &&
                                            project.background.kind === 'gradient') ||
                                        (key === 'image' && project.background.kind === 'image')
                                        ? 'bg-[#2a2a2e] text-white shadow-sm'
                                        : 'text-[#71717a] hover:text-white'
                                        }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>

                        {project.background.kind === 'solid' && (
                            <div className="flex items-center gap-2 pt-0.5">
                                <div className="relative shrink-0">
                                    <ColorField

                                        value={project.background.color}
                                        onChange={(e) =>
                                            updateProject((p) => ({
                                                ...p,
                                                background: {
                                                    kind: 'solid',
                                                    color: e.target.value,
                                                },
                                            }))
                                        }
                                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                                    />
                                    <div
                                        className="w-7 h-7 rounded-lg border border-white/10"
                                        style={{ backgroundColor: project.background.color }}
                                    />
                                </div>
                                <input
                                    type="text"
                                    value={bgColorDraft}
                                    onChange={(e) => {
                                        const raw = e.target.value;
                                        setBgColorDraft(raw);
                                        let v = raw.trim();
                                        if (!v.startsWith('#')) v = `#${v}`;
                                        if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)) {
                                            updateProject((p) => ({
                                                ...p,
                                                background: { kind: 'solid', color: v },
                                            }));
                                        }
                                    }}
                                    onBlur={() => {
                                        let v = bgColorDraft.trim();
                                        if (!v.startsWith('#')) v = `#${v}`;
                                        if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)) {
                                            updateProject((p) => ({
                                                ...p,
                                                background: { kind: 'solid', color: v },
                                            }));
                                            setBgColorDraft(v);
                                        } else if (project.background.kind === 'solid') {
                                            setBgColorDraft(project.background.color);
                                        }
                                    }}
                                    className="flex-1 h-7 px-2.5 rounded-lg bg-[#1c1c1f] border border-white/[0.06] text-[11px] font-mono text-white outline-none"
                                    spellCheck={false}
                                />
                            </div>
                        )}

                        {project.background.kind === 'gradient' && (
                            <div className="space-y-2 pt-1">
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1.5 flex-1">
                                        <ColorField

                                            value={project.background.stops[0]?.color ?? '#0a0a0c'}
                                            onChange={(e) => {
                                                if (project.background.kind !== 'gradient') return;
                                                const stops = [...project.background.stops];
                                                if (!stops[0]) stops[0] = { at: 0, color: '#0a0a0c' };
                                                stops[0] = {
                                                    ...stops[0],
                                                    at: 0,
                                                    color: e.target.value,
                                                };
                                                updateProject((p) => {
                                                    if (p.background.kind !== 'gradient') return p;
                                                    return {
                                                        ...p,
                                                        background: {
                                                            ...p.background,
                                                            stops,
                                                        },
                                                    };
                                                });
                                            }}
                                            className="w-6 h-6 rounded border border-white/10 cursor-pointer"
                                            title="Start Color"
                                        />
                                        <ColorField

                                            value={project.background.stops[1]?.color ?? '#000000'}
                                            onChange={(e) => {
                                                if (project.background.kind !== 'gradient') return;
                                                const stops = [...project.background.stops];
                                                if (!stops[1]) stops[1] = { at: 1, color: '#000000' };
                                                stops[1] = {
                                                    ...stops[1],
                                                    at: 1,
                                                    color: e.target.value,
                                                };
                                                updateProject((p) => {
                                                    if (p.background.kind !== 'gradient') return p;
                                                    return {
                                                        ...p,
                                                        background: {
                                                            ...p.background,
                                                            stops,
                                                        },
                                                    };
                                                });
                                            }}
                                            className="w-6 h-6 rounded border border-white/10 cursor-pointer"
                                            title="End Color"
                                        />
                                    </div>
                                    <div className="w-24">
                                        <ScrubInput
                                            label="∠"
                                            value={project.background.angle ?? 135}
                                            min={0}
                                            max={360}
                                            step={5}
                                            unit="°"
                                            onChange={(angle) =>
                                                updateProject((p) => {
                                                    if (p.background.kind !== 'gradient') return p;
                                                    return {
                                                        ...p,
                                                        background: {
                                                            ...p.background,
                                                            angle,
                                                        },
                                                    };
                                                })
                                            }
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {project.background.kind === 'image' && (
                            <div className="space-y-2 pt-1">
                                {project.background.assetId &&
                                    project.assets[project.background.assetId]?.dataUrl ? (
                                    <div className="relative w-full h-16 rounded-lg overflow-hidden border border-white/10 group">
                                        <img
                                            src={project.assets[project.background.assetId].dataUrl}
                                            alt="Background"
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition">
                                            <button
                                                type="button"
                                                onClick={() => projectBgFileRef.current?.click()}
                                                className="px-2 py-1 rounded bg-[#1c1c1f] text-[10px] text-white hover:bg-white/20"
                                            >
                                                Change
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    updateProject((p) => ({
                                                        ...p,
                                                        background: { kind: 'image', assetId: '' },
                                                    }))
                                                }
                                                className="p-1 rounded bg-rose-500/80 text-white"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => projectBgFileRef.current?.click()}
                                        className="w-full h-12 rounded-lg border border-dashed border-white/20 hover:border-[#0088ff] text-[#71717a] hover:text-white flex items-center justify-center gap-1.5 transition text-[11px]"
                                    >
                                        <Upload className="w-3.5 h-3.5" />
                                        <span>Upload Background Image</span>
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* FPS */}
                    <div className="space-y-1">
                        <span className="text-[10px] text-[#71717a]">Frame Rate</span>
                        <select
                            value={project.fps}
                            onChange={(e) =>
                                updateProject((p) => ({
                                    ...p,
                                    fps: Number(e.target.value) as 30 | 60,
                                }))
                            }
                            className="w-full bg-[#1c1c1f] border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white outline-none cursor-pointer"
                        >
                            <option value={60}>60 FPS (Silky Smooth)</option>
                            <option value={30}>30 FPS (Standard)</option>
                        </select>
                    </div>
                </div>
            )}

            {/* =================================================================== */}
            {/* CAMERA BLOCK INSPECTOR (When Camera Move is Selected)               */}
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
                                    max={Math.max(0, activeShot.durationMs - 100)}
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
                                    onClick={() => {
                                        updateShot(activeShot.id, (s) => ({
                                            ...s,
                                            cameraBlocks: s.cameraBlocks.filter(
                                                (b) => b.id !== activeCameraBlock.id
                                            ),
                                        }));
                                        selectCameraBlock(null);
                                    }}
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
                    <div className={`${isBlankState ? 'hidden' : 'h-9 border-b border-white/[0.07] px-3.5 flex items-center justify-between shrink-0'}`}>
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
                                title="Click to view Shot settings"
                                className="px-2 py-0.5 rounded bg-white/[0.05] hover:bg-white/[0.1] text-[10px] text-[#a1a1aa] hover:text-white flex items-center gap-1 cursor-pointer transition"
                            >
                                <Film className="w-3 h-3 text-[#0088ff]" />
                                <span>{activeShot.name || 'Shot'}</span>
                            </button>
                        )}
                    </div>

                    {/* =============================================================== */}
                    {/* TAB 1: DESIGN (WHEN A LAYER IS SELECTED)                        */}
                    {/* =============================================================== */}
                    {mainTab === 'design' && selectedLayer && (
                        <div className="flex-1 overflow-y-auto divide-y divide-white/[0.06]">
                            {/* LAYER HEADER: Name, Lock, Hide, Delete */}
                            <div className="p-3.5 space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        <span className="px-1.5 py-0.5 rounded bg-white/[0.07] text-[9px] font-semibold uppercase tracking-wider text-[#0088ff]">
                                            {selectedLayer.kind}
                                        </span>
                                        <span className="text-[10px] text-[#71717a]">
                                            #{selectedLayer.order}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                    ...l,
                                                    hidden: !l.hidden,
                                                }))
                                            }
                                            title={selectedLayer.hidden ? 'Show Layer' : 'Hide Layer'}
                                            className="p-1 rounded hover:bg-white/10 text-[#71717a] hover:text-white"
                                        >
                                            {selectedLayer.hidden ? (
                                                <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                                            ) : (
                                                <Eye className="w-3.5 h-3.5" />
                                            )}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                    ...l,
                                                    locked: !l.locked,
                                                }))
                                            }
                                            title={selectedLayer.locked ? 'Unlock Layer' : 'Lock Layer'}
                                            className="p-1 rounded hover:bg-white/10 text-[#71717a] hover:text-white"
                                        >
                                            {selectedLayer.locked ? (
                                                <Lock className="w-3.5 h-3.5 text-amber-400" />
                                            ) : (
                                                <Unlock className="w-3.5 h-3.5" />
                                            )}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleDeleteSelectedLayer}
                                            title="Delete Layer"
                                            className="p-1 rounded hover:bg-white/10 text-[#71717a] hover:text-rose-400"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
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
                                    className="w-full h-7 px-2 rounded-lg bg-[#1c1c1f] border border-white/10 text-[11px] text-white font-medium outline-none focus:border-[#0088ff]"
                                    placeholder="Layer name"
                                />
                            </div>

                            {/* 1. LAYER KIND SPECIFIC SECTIONS */}

                            {/* TEXT LAYER: Typography Controls */}
                            {selectedLayer.kind === 'text' && (
                                <div className="p-3.5 space-y-3">
                                    <div className="text-[11px] font-medium text-[#e4e4e7] flex items-center justify-between">
                                        <span className="flex items-center gap-1.5">
                                            <Type className="w-3.5 h-3.5 text-amber-400" />
                                            Typography
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => fontInputRef.current?.click()}
                                            title="Upload Custom Font (.ttf, .otf, .woff2)"
                                            className="text-[10px] text-[#0088ff] hover:underline flex items-center gap-1"
                                        >
                                            <Upload className="w-3 h-3" />
                                            <span>Upload font</span>
                                        </button>
                                    </div>

                                    {/* Content textarea */}
                                    <div className="space-y-1">
                                        <span className="text-[10px] text-[#71717a]">Text Content</span>
                                        <textarea
                                            rows={2}
                                            value={selectedLayer.content}
                                            onChange={(e) =>
                                                updateLayer(activeShot.id, selectedLayer.id, (l) =>
                                                    l.kind === 'text' ? { ...l, content: e.target.value } : l
                                                )
                                            }
                                            className="w-full p-2 rounded-lg bg-[#1c1c1f] border border-white/10 text-[11px] text-white outline-none focus:border-amber-400 resize-none font-sans"
                                        />
                                    </div>

                                    {/* Font Family */}
                                    <div className="space-y-1">
                                        <span className="text-[10px] text-[#71717a]">Font Family</span>
                                        <select
                                            value={selectedLayer.font.family}
                                            onChange={(e) =>
                                                updateLayer(activeShot.id, selectedLayer.id, (l) =>
                                                    l.kind === 'text'
                                                        ? { ...l, font: { ...l.font, family: e.target.value } }
                                                        : l
                                                )
                                            }
                                            className="w-full h-7 rounded-lg bg-[#1c1c1f] border border-white/10 px-2 text-[11px] text-white outline-none cursor-pointer"
                                        >
                                            {[...POPULAR_FONTS, ...customFonts].map((f) => (
                                                <option key={f} value={f}>
                                                    {f}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Color & Size */}
                                    <div className="grid grid-cols-2 gap-1.5">
                                        <div className="space-y-1">
                                            <span className="text-[10px] text-[#71717a]">Color</span>
                                            <div className="flex items-center gap-1.5 h-7 px-1.5 rounded-lg bg-[#1c1c1f] border border-white/10">
                                                <ColorField

                                                    value={selectedLayer.font.color}
                                                    onChange={(e) =>
                                                        updateLayer(activeShot.id, selectedLayer.id, (l) =>
                                                            l.kind === 'text'
                                                                ? { ...l, font: { ...l.font, color: e.target.value } }
                                                                : l
                                                        )
                                                    }
                                                    className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                                                />
                                                <input
                                                    type="text"
                                                    value={selectedLayer.font.color}
                                                    onChange={(e) => {
                                                        let val = e.target.value.trim();
                                                        if (!val.startsWith('#')) val = `#${val}`;
                                                        updateLayer(activeShot.id, selectedLayer.id, (l) =>
                                                            l.kind === 'text'
                                                                ? { ...l, font: { ...l.font, color: val } }
                                                                : l
                                                        );
                                                    }}
                                                    className="w-full bg-transparent text-[10px] font-mono text-white outline-none"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] text-[#71717a]">Size</span>
                                            <ScrubInput
                                                label="A"
                                                value={Math.round(selectedLayer.font.size * refStageH)}
                                                min={8}
                                                max={300}
                                                step={1}
                                                unit="px"
                                                onChange={(sizePx) =>
                                                    updateLayer(activeShot.id, selectedLayer.id, (l) =>
                                                        l.kind === 'text'
                                                            ? { ...l, font: { ...l.font, size: sizePx / refStageH } }
                                                            : l
                                                    )
                                                }
                                            />
                                        </div>
                                    </div>

                                    {/* Weight & Letter Spacing */}
                                    <div className="grid grid-cols-2 gap-1.5">
                                        <div className="space-y-1">
                                            <span className="text-[10px] text-[#71717a]">Weight</span>
                                            <select
                                                value={selectedLayer.font.weight}
                                                onChange={(e) =>
                                                    updateLayer(activeShot.id, selectedLayer.id, (l) =>
                                                        l.kind === 'text'
                                                            ? {
                                                                ...l,
                                                                font: {
                                                                    ...l.font,
                                                                    weight: Number(e.target.value),
                                                                },
                                                            }
                                                            : l
                                                    )
                                                }
                                                className="w-full h-7 rounded-lg bg-[#1c1c1f] border border-white/10 px-2 text-[11px] text-white outline-none cursor-pointer"
                                            >
                                                <option value={300}>300 Light</option>
                                                <option value={400}>400 Regular</option>
                                                <option value={500}>500 Medium</option>
                                                <option value={600}>600 SemiBold</option>
                                                <option value={700}>700 Bold</option>
                                                <option value={800}>800 ExtraBold</option>
                                                <option value={900}>900 Black</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] text-[#71717a]">Spacing</span>
                                            <ScrubInput
                                                label="↔"
                                                value={selectedLayer.font.letterSpacing}
                                                min={-5}
                                                max={30}
                                                step={0.5}
                                                decimals={1}
                                                onChange={(letterSpacing) =>
                                                    updateLayer(activeShot.id, selectedLayer.id, (l) =>
                                                        l.kind === 'text'
                                                            ? { ...l, font: { ...l.font, letterSpacing } }
                                                            : l
                                                    )
                                                }
                                            />
                                        </div>
                                    </div>

                                    {/* Text Alignment */}
                                    <div className="space-y-1">
                                        <span className="text-[10px] text-[#71717a]">Align</span>
                                        <div className="grid grid-cols-3 gap-0.5 bg-[#1c1c1f] p-0.5 rounded-lg border border-white/[0.06]">
                                            {(['left', 'center', 'right'] as const).map((al) => (
                                                <button
                                                    key={al}
                                                    type="button"
                                                    onClick={() =>
                                                        updateLayer(activeShot.id, selectedLayer.id, (l) =>
                                                            l.kind === 'text'
                                                                ? { ...l, font: { ...l.font, align: al } }
                                                                : l
                                                        )
                                                    }
                                                    className={`h-6 rounded text-[10px] capitalize flex items-center justify-center transition cursor-pointer ${selectedLayer.font.align === al
                                                        ? 'bg-[#2a2a30] text-white font-medium'
                                                        : 'text-[#71717a] hover:text-white'
                                                        }`}
                                                >
                                                    {al}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* SHAPE LAYER: Geometry, Fill & Stroke */}
                            {selectedLayer.kind === 'shape' && (
                                <div className="p-3.5 space-y-3">
                                    <div className="text-[11px] font-medium text-[#e4e4e7] flex items-center gap-1.5">
                                        <Shapes className="w-3.5 h-3.5 text-purple-400" />
                                        Shape &amp; Fill
                                    </div>

                                    {/* Geometry */}
                                    <div className="grid grid-cols-5 gap-0.5 bg-[#1c1c1f] p-0.5 rounded-lg border border-white/[0.06]">
                                        {(
                                            ['rectangle', 'ellipse', 'line', 'arrow', 'polygon'] as Array<
                                                ShapeLayer['shape']
                                            >
                                        ).map((shp) => (
                                            <button
                                                key={shp}
                                                type="button"
                                                onClick={() =>
                                                    updateLayer(activeShot.id, selectedLayer.id, (l) =>
                                                        l.kind === 'shape' ? { ...l, shape: shp } : l
                                                    )
                                                }
                                                className={`h-6 rounded text-[10px] capitalize flex items-center justify-center transition cursor-pointer ${selectedLayer.shape === shp
                                                    ? 'bg-[#2a2a30] text-white font-medium'
                                                    : 'text-[#71717a] hover:text-white'
                                                    }`}
                                            >
                                                {shp === 'rectangle' ? 'Rect' : shp === 'ellipse' ? 'Circle' : shp}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Fill Mode */}
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] text-[#71717a]">Fill</span>
                                            <div className="flex bg-[#1c1c1f] p-0.5 rounded border border-white/[0.06]">
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
                                                    className={`px-2 py-0.5 rounded text-[10px] cursor-pointer ${selectedLayer.fill.kind === 'solid'
                                                        ? 'bg-[#2a2a30] text-white font-medium'
                                                        : 'text-[#71717a] hover:text-white'
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
                                                    className={`px-2 py-0.5 rounded text-[10px] cursor-pointer ${selectedLayer.fill.kind === 'gradient'
                                                        ? 'bg-[#2a2a30] text-white font-medium'
                                                        : 'text-[#71717a] hover:text-white'
                                                        }`}
                                                >
                                                    Shader
                                                </button>
                                            </div>
                                        </div>

                                        {selectedLayer.fill.kind === 'solid' ? (
                                            <div className="flex items-center gap-2 pt-0.5">
                                                <div className="relative shrink-0">
                                                    <ColorField

                                                        value={selectedLayer.fill.color}
                                                        onChange={(e) => {
                                                            const color = e.target.value;
                                                            updateLayer(activeShot.id, selectedLayer.id, (l) =>
                                                                l.kind === 'shape' && l.fill.kind === 'solid'
                                                                    ? { ...l, fill: { ...l.fill, color } }
                                                                    : l
                                                            );
                                                        }}
                                                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                                                    />
                                                    <div
                                                        className="w-7 h-7 rounded-lg border border-white/10"
                                                        style={{ backgroundColor: selectedLayer.fill.color }}
                                                    />
                                                </div>
                                                <input
                                                    type="text"
                                                    value={selectedLayer.fill.color}
                                                    onChange={(e) => {
                                                        let color = e.target.value.trim();
                                                        if (!color.startsWith('#')) color = `#${color}`;
                                                        updateLayer(activeShot.id, selectedLayer.id, (l) =>
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

                                                        value={selectedLayer.fill.stops[0]?.color ?? '#818cf8'}
                                                        onChange={(e) => {
                                                            const color = e.target.value;
                                                            updateLayer(activeShot.id, selectedLayer.id, (l) => {
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

                                                        value={selectedLayer.fill.stops[1]?.color ?? '#4f46e5'}
                                                        onChange={(e) => {
                                                            const color = e.target.value;
                                                            updateLayer(activeShot.id, selectedLayer.id, (l) => {
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
                                                            value={selectedLayer.fill.angle}
                                                            min={0}
                                                            max={360}
                                                            step={5}
                                                            unit="°"
                                                            onChange={(angle) =>
                                                                updateLayer(activeShot.id, selectedLayer.id, (l) =>
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
                                                            <span className="truncate text-[9px] text-[#a1a1aa]">
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
                                            <span className="text-[10px] text-[#71717a]">Border &amp; Stroke</span>
                                            <input
                                                type="checkbox"
                                                checked={Boolean(selectedLayer.stroke)}
                                                onChange={(e) => {
                                                    const enabled = e.target.checked;
                                                    updateLayer(activeShot.id, selectedLayer.id, (l) =>
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

                                        {selectedLayer.stroke && (
                                            <div className="space-y-1.5">
                                                <div className="flex items-center gap-2">
                                                    <ColorField

                                                        value={selectedLayer.stroke.color}
                                                        onChange={(e) => {
                                                            const color = e.target.value;
                                                            updateLayer(activeShot.id, selectedLayer.id, (l) =>
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
                                                            value={Math.round(selectedLayer.stroke.width * 1000)}
                                                            min={1}
                                                            max={30}
                                                            step={1}
                                                            unit="px"
                                                            onChange={(w) =>
                                                                updateLayer(activeShot.id, selectedLayer.id, (l) =>
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
                            )}

                            {/* IMAGE LAYER: Source, Device Frame & Crop */}
                            {selectedLayer.kind === 'image' && (
                                <div className="p-3.5 space-y-3 relative">
                                    <div className="text-[11px] font-medium text-[#e4e4e7] flex items-center justify-between">
                                        <span>Image &amp; Frame</span>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={onSwapImageClick}
                                                className="h-6 px-2 rounded-l-md bg-[#1c1c1f] hover:bg-[#252529] text-[10px] text-[#e4e4e7] flex items-center gap-1 cursor-pointer transition"
                                            >
                                                <ImageIcon className="w-3 h-3 text-[#0088ff]" />
                                                <span>Swap</span>
                                            </button>
                                            <button
                                                onClick={() => setSwapMenuOpen((v) => !v)}
                                                className="h-6 px-1 rounded-r-md bg-[#1c1c1f] hover:bg-[#252529] text-[#a1a1aa] cursor-pointer transition border-l border-black/40"
                                            >
                                                <ChevronDown className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2.5">
                                        <div className="w-10 h-12 rounded-lg bg-[#18181b] border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
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
                                        <div className="flex-1 text-[11px] text-[#a1a1aa]">
                                            <div className="text-white font-medium capitalize">
                                                {selectedLayer.device?.type
                                                    ? `${selectedLayer.device.type} Frame`
                                                    : 'Bare Screenshot'}
                                            </div>
                                            <div className="text-[10px] text-[#71717a]">
                                                {project.assets[selectedLayer.assetId]?.name ||
                                                    'Active asset'}
                                            </div>
                                        </div>
                                    </div>

                                    {swapMenuOpen && (
                                        <div className="p-1 rounded-xl bg-[#18181b] border border-white/10 space-y-0.5 text-[11px] shadow-2xl z-20">
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
                                                    className={`w-full px-2 py-1.5 rounded-lg text-left capitalize cursor-pointer transition ${(!selectedLayer.device && dev === 'none') ||
                                                        selectedLayer.device?.type === dev
                                                        ? 'bg-[#0088ff] text-white font-medium'
                                                        : 'text-[#d4d4d8] hover:bg-white/5'
                                                        }`}
                                                >
                                                    {dev === 'none'
                                                        ? 'Bare Screenshot'
                                                        : `${dev} 3D Frame`}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* 3D Device Frame Settings */}
                                    {selectedLayer.device && (
                                        <div className="p-2.5 rounded-xl bg-[#161619] border border-white/[0.06] space-y-2 pt-2">
                                            <div className="flex items-center justify-between text-[10px] text-[#71717a]">
                                                <span className="flex items-center gap-1 text-[#e4e4e7]">
                                                    <Laptop className="w-3 h-3 text-[#0088ff]" />
                                                    Frame Details
                                                </span>
                                                <div className="flex items-center gap-1 bg-[#1c1c1f] p-0.5 rounded">
                                                    {(['silver', 'black'] as const).map((clr) => (
                                                        <button
                                                            key={clr}
                                                            type="button"
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
                                                            className={`px-1.5 py-0.5 rounded text-[9px] capitalize cursor-pointer ${selectedLayer.device?.color === clr
                                                                ? 'bg-[#2a2a30] text-white font-medium'
                                                                : 'text-[#71717a] hover:text-white'
                                                                }`}
                                                        >
                                                            {clr}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-1.5">
                                                <ScrubInput
                                                    label="Gloss"
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
                                                    label="Glow"
                                                    value={selectedLayer.device.screenGlow ?? 0.4}
                                                    min={0}
                                                    max={1}
                                                    step={0.02}
                                                    decimals={2}
                                                    onChange={(screenGlow) =>
                                                        updateLayer(activeShot.id, selectedLayer.id, (l) =>
                                                            l.kind === 'image' && l.device
                                                                ? { ...l, device: { ...l.device, screenGlow } }
                                                                : l
                                                        )
                                                    }
                                                />
                                            </div>

                                            {selectedLayer.device.type === 'macbook' && (
                                                <ScrubInput
                                                    label="Lid"
                                                    value={selectedLayer.device.lidAngle ?? 100}
                                                    min={35}
                                                    max={125}
                                                    step={1}
                                                    unit="°"
                                                    onChange={(lidAngle) =>
                                                        updateLayer(activeShot.id, selectedLayer.id, (l) =>
                                                            l.kind === 'image' && l.device
                                                                ? { ...l, device: { ...l.device, lidAngle } }
                                                                : l
                                                        )
                                                    }
                                                />
                                            )}
                                        </div>
                                    )}

                                    {/* Image Border & Stroke */}
                                    <div className="space-y-1.5 pt-1">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] text-[#71717a]">Border &amp; Stroke</span>
                                            <input
                                                type="checkbox"
                                                checked={Boolean(selectedLayer.stroke)}
                                                onChange={(e) => {
                                                    const enabled = e.target.checked;
                                                    updateLayer(activeShot.id, selectedLayer.id, (l) =>
                                                        l.kind === 'image'
                                                            ? {
                                                                ...l,
                                                                stroke: enabled
                                                                    ? {
                                                                        color: l.stroke?.color || '#0088ff',
                                                                        width: l.stroke?.width ?? 0.002,
                                                                        opacity: l.stroke?.opacity ?? 0.8,
                                                                    }
                                                                    : undefined,
                                                            }
                                                            : l
                                                    );
                                                }}
                                                className="w-3.5 h-3.5 rounded accent-[#0088ff] cursor-pointer"
                                            />
                                        </div>

                                        {selectedLayer.stroke && (
                                            <div className="flex items-center gap-1.5">
                                                <ColorField

                                                    value={selectedLayer.stroke.color}
                                                    onChange={(e) => {
                                                        const color = e.target.value;
                                                        updateLayer(activeShot.id, selectedLayer.id, (l) =>
                                                            l.kind === 'image' && l.stroke
                                                                ? { ...l, stroke: { ...l.stroke, color } }
                                                                : l
                                                        );
                                                    }}
                                                    className="w-6 h-6 rounded border border-white/10 cursor-pointer"
                                                />
                                                <div className="flex-1">
                                                    <ScrubInput
                                                        label="W"
                                                        value={Math.round(selectedLayer.stroke.width * 1000)}
                                                        min={1}
                                                        max={20}
                                                        step={1}
                                                        unit="px"
                                                        onChange={(w) =>
                                                            updateLayer(activeShot.id, selectedLayer.id, (l) =>
                                                                l.kind === 'image' && l.stroke
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
                                        )}
                                    </div>
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
                                            title="Align Left"
                                        >
                                            <AlignLeft className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => handleQuickAlign('x', 0)}
                                            className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
                                            title="Center X"
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
                                            title="Center Y"
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
                                    <span className="text-[10px] text-[#71717a] block">
                                        Coordinates
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
                                            title="Center Position (0, 0)"
                                            className="p-1.5 text-[#71717a] hover:text-white cursor-pointer"
                                        >
                                            <Crosshair className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <span className="text-[10px] text-[#71717a] block">
                                        Depth &amp; Roll
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
                                        Transform
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
                                            title="Rotate 90° Clockwise"
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
                                            title="Flip Horizontally"
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
                                            title="Flip Vertically"
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
                                    3D Tilt &amp; Swivel
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
                                        title="Reset Tilt (0°)"
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
                                        title="Invert Yaw Angle"
                                        className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
                                    >
                                        <FlipHorizontal className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        onClick={() =>
                                            updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                ...l,
                                                rotation: {
                                                    x: degToRad(-35),
                                                    y: degToRad(20),
                                                    z: degToRad(15),
                                                },
                                            }))
                                        }
                                        title="Isometric 3D Preset"
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
                                                className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition ${aspectLocked
                                                    ? 'bg-[#1c1c1f] text-white border border-white/10'
                                                    : 'text-[#71717a] hover:text-white'
                                                    }`}
                                                title={aspectLocked ? 'Aspect Ratio Locked' : 'Aspect Ratio Unlocked'}
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
                                            label="Max W"
                                            value={Math.round(selectedLayer.maxWidth * refStageW)}
                                            min={200}
                                            max={1920}
                                            step={20}
                                            unit="px"
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
                                            value={Math.round(Math.abs(selectedLayer.scale.x) * 100)}
                                            min={10}
                                            max={400}
                                            step={2}
                                            unit="%"
                                            onChange={(pct) => {
                                                const signX = Math.sign(selectedLayer.scale.x) || 1;
                                                const signY = Math.sign(selectedLayer.scale.y) || 1;
                                                const newVal = Number((pct / 100).toFixed(2));
                                                updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                    ...l,
                                                    scale: {
                                                        ...l.scale,
                                                        x: signX * newVal,
                                                        y: aspectLocked ? signY * newVal : l.scale.y,
                                                    },
                                                }));
                                            }}
                                        />
                                        <ScrubInput
                                            label="SY"
                                            value={Math.round(Math.abs(selectedLayer.scale.y) * 100)}
                                            min={10}
                                            max={400}
                                            step={2}
                                            unit="%"
                                            onChange={(pct) => {
                                                const signX = Math.sign(selectedLayer.scale.x) || 1;
                                                const signY = Math.sign(selectedLayer.scale.y) || 1;
                                                const newVal = Number((pct / 100).toFixed(2));
                                                updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                    ...l,
                                                    scale: {
                                                        ...l.scale,
                                                        x: aspectLocked ? signX * newVal : l.scale.x,
                                                        y: signY * newVal,
                                                    },
                                                }));
                                            }}
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

                                {/* Blend Mode */}
                                <div className="space-y-1">
                                    <span className="text-[10px] text-[#71717a]">Blend Mode</span>
                                    <select
                                        value={selectedLayer.blendMode}
                                        onChange={(e) =>
                                            updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                ...l,
                                                blendMode: e.target.value as BlendMode,
                                            }))
                                        }
                                        className="w-full h-7 rounded-lg bg-[#1c1c1f] border border-white/10 px-2 text-[11px] text-white capitalize outline-none cursor-pointer"
                                    >
                                        {ALL_BLEND_MODES.map((bm) => (
                                            <option key={bm} value={bm}>
                                                {bm}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Drop Shadow */}
                                <div className="space-y-2 pt-1 border-t border-white/[0.06]">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] text-[#71717a]">Drop Shadow</span>
                                        <input
                                            type="checkbox"
                                            checked={Boolean(selectedLayer.effects?.dropShadow?.enabled)}
                                            onChange={(e) => {
                                                const enabled = e.target.checked;
                                                updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                    ...l,
                                                    effects: {
                                                        ...l.effects,
                                                        dropShadow: {
                                                            enabled,
                                                            color: l.effects?.dropShadow?.color || '#000000',
                                                            opacity: l.effects?.dropShadow?.opacity ?? 0.6,
                                                            blur: l.effects?.dropShadow?.blur ?? 0.04,
                                                            offsetX: l.effects?.dropShadow?.offsetX ?? 0,
                                                            offsetY: l.effects?.dropShadow?.offsetY ?? 0.02,
                                                        },
                                                    },
                                                }));
                                            }}
                                            className="w-3.5 h-3.5 rounded accent-[#0088ff] cursor-pointer"
                                        />
                                    </div>

                                    {selectedLayer.effects?.dropShadow?.enabled && (
                                        <div className="space-y-1.5 p-2 rounded-lg bg-[#161619] border border-white/[0.05]">
                                            <div className="flex items-center gap-2">
                                                <ColorField

                                                    value={selectedLayer.effects.dropShadow.color}
                                                    onChange={(e) => {
                                                        const color = e.target.value;
                                                        updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                            ...l,
                                                            effects: {
                                                                ...l.effects,
                                                                dropShadow: {
                                                                    ...l.effects.dropShadow!,
                                                                    color,
                                                                },
                                                            },
                                                        }));
                                                    }}
                                                    className="w-6 h-6 rounded border border-white/10 cursor-pointer"
                                                />
                                                <div className="flex-1">
                                                    <ScrubInput
                                                        label="Opacity"
                                                        value={Math.round(
                                                            selectedLayer.effects.dropShadow.opacity * 100
                                                        )}
                                                        min={0}
                                                        max={100}
                                                        step={2}
                                                        unit="%"
                                                        onChange={(pct) =>
                                                            updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                                ...l,
                                                                effects: {
                                                                    ...l.effects,
                                                                    dropShadow: {
                                                                        ...l.effects.dropShadow!,
                                                                        opacity: Number((pct / 100).toFixed(2)),
                                                                    },
                                                                },
                                                            }))
                                                        }
                                                    />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-1">
                                                <ScrubInput
                                                    label="Blur"
                                                    value={Math.round(selectedLayer.effects.dropShadow.blur * 500)}
                                                    min={0}
                                                    max={100}
                                                    step={1}
                                                    onChange={(b) =>
                                                        updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                            ...l,
                                                            effects: {
                                                                ...l.effects,
                                                                dropShadow: {
                                                                    ...l.effects.dropShadow!,
                                                                    blur: Number((b / 500).toFixed(3)),
                                                                },
                                                            },
                                                        }))
                                                    }
                                                />
                                                <ScrubInput
                                                    label="X"
                                                    value={Math.round(selectedLayer.effects.dropShadow.offsetX * 500)}
                                                    min={-100}
                                                    max={100}
                                                    step={1}
                                                    onChange={(x) =>
                                                        updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                            ...l,
                                                            effects: {
                                                                ...l.effects,
                                                                dropShadow: {
                                                                    ...l.effects.dropShadow!,
                                                                    offsetX: Number((x / 500).toFixed(3)),
                                                                },
                                                            },
                                                        }))
                                                    }
                                                />
                                                <ScrubInput
                                                    label="Y"
                                                    value={Math.round(selectedLayer.effects.dropShadow.offsetY * 500)}
                                                    min={-100}
                                                    max={100}
                                                    step={1}
                                                    onChange={(y) =>
                                                        updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                            ...l,
                                                            effects: {
                                                                ...l.effects,
                                                                dropShadow: {
                                                                    ...l.effects.dropShadow!,
                                                                    offsetY: Number((y / 500).toFixed(3)),
                                                                },
                                                            },
                                                        }))
                                                    }
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Layer Masking */}
                                <div className="space-y-1 pt-1 border-t border-white/[0.06]">
                                    <span className="text-[10px] text-[#71717a]">Alpha Mask</span>
                                    <select
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
                                    </select>
                                </div>
                            </div>

                            {/* SCENE BACKGROUND & EFFECTS (WHEN BOTTOM LAYER IS SELECTED) */}
                            {isBottomLayerSelected && (
                                <div className="divide-y divide-white/[0.06] bg-black/20">
                                    <div className="p-3 bg-white/[0.02]">
                                        <span className="text-[10px] font-medium text-[#71717a] uppercase tracking-wider block">
                                            Stage Background &amp; Effects
                                        </span>
                                    </div>
                                    <BackgroundSection activeShot={activeShot} />
                                    <SceneEffectsSection activeShot={activeShot} />
                                </div>
                            )}
                        </div>
                    )}

                    {/* =============================================================== */}
                    {/* TAB 1: DESIGN (WHEN NO LAYER IS SELECTED — SHOT SETTINGS)       */}
                    {/* =============================================================== */}
                    {mainTab === 'design' && !selectedLayer && (
                        <div className="flex-1 overflow-y-auto bg-[#101012]">
                    <div className={`px-3.5 ${isBlankState ? 'pt-1 space-y-2' : 'pt-3 space-y-4'} pb-4`}>
                                <div className="text-[13px] font-medium text-[#d4d4d8]">Project</div>

                                <label className="block space-y-1.5">
                                    <span className="block text-[11px] text-[#a1a1aa]">Name</span>
                                    <input
                                        aria-label="Project name"
                                        value={project.name}
                                        onChange={(e) => updateProject((p) => ({ ...p, name: e.target.value }))}
                                        className="w-full h-[30px] rounded-lg bg-[#1d1d20] border border-white/[0.06] px-2.5 text-[12px] text-white outline-none focus:border-[#0088ff]/70"
                                    />
                                </label>

                                <label className="block space-y-1.5">
                                    <span className="block text-[11px] text-[#a1a1aa]">Aspect Ratio</span>
                                    <select
                                        aria-label="Project aspect ratio"
                                        value={project.aspectRatio}
                                        onChange={(e) => updateProject((p) => ({ ...p, aspectRatio: e.target.value as AspectRatio }))}
                                        className="w-full h-[30px] rounded-lg bg-[#1d1d20] border border-white/[0.06] px-2.5 text-[12px] text-white outline-none focus:border-[#0088ff]/70"
                                    >
                                        <option value="16:9">Landscape 16:9</option>
                                        <option value="4:3">Classic 4:3</option>
                                        <option value="3:2">Landscape 3:2</option>
                                        <option value="21:9">Ultrawide 21:9</option>
                                        <option value="1:1">Square 1:1</option>
                                        <option value="9:16">Portrait 9:16</option>
                                        <option value="3:4">Portrait 3:4</option>
                                        <option value="2:3">Portrait 2:3</option>
                                        <option value="4:5">Portrait 4:5</option>
                                    </select>
                                </label>

                                <label className="block space-y-1.5">
                                    <span className="block text-[11px] text-[#a1a1aa]">Lens</span>
                                    <div className="h-[30px] rounded-lg bg-[#1d1d20] border border-white/[0.06] px-2.5 flex items-center text-[12px] text-[#d4d4d8]">
                                        <span className="text-[#a1a1aa] mr-2">F</span>50 mm
                                    </div>
                                </label>

                                <div className="space-y-2">
                                    <span className="block text-[11px] text-[#a1a1aa]">Background</span>
                                    <div className="grid grid-cols-3 gap-1 rounded-lg bg-[#1d1d20] p-0.5">
                                        <button
                                            onClick={() => updateProject((p) => ({ ...p, background: { kind: 'solid', color: p.background.kind === 'solid' ? p.background.color : '#0A0A0C' } }))}
                                            className={`h-7 rounded-md text-[11px] ${project.background.kind === 'solid' ? 'bg-[#39393d] text-white border border-white/10' : 'text-[#a1a1aa] hover:text-white'}`}
                                        >Color</button>
                                        <button
                                            onClick={() => projectBgFileRef.current?.click()}
                                            className={`h-7 rounded-md text-[11px] ${project.background.kind === 'image' ? 'bg-[#39393d] text-white border border-white/10' : 'text-[#a1a1aa] hover:text-white'}`}
                                        >Image</button>
                                        <button
                                            onClick={() => updateProject((p) => ({ ...p, background: { kind: 'gradient', source: 'shader', gradientType: 'radial', angle: 135, stops: [{ at: 0, color: '#17172b' }, { at: 1, color: '#050507' }] } }))}
                                            className={`h-7 rounded-md text-[11px] ${project.background.kind === 'gradient' && project.background.source === 'shader' ? 'bg-[#39393d] text-white border border-white/10' : 'text-[#a1a1aa] hover:text-white'}`}
                                        >Shader</button>
                                    </div>

                                    {project.background.kind === 'solid' && (
                                        <label className="h-[30px] rounded-lg bg-[#1d1d20] border border-white/[0.06] px-2 flex items-center gap-2">
                                            <ColorField
                                                aria-label="Background color"
                                                value={project.background.color}
                                                onChange={(e) => updateProject((p) => ({ ...p, background: { kind: 'solid', color: e.target.value.toUpperCase() } }))}
                                                className="w-5 h-5 rounded border-0 bg-transparent p-0 cursor-pointer"
                                            />
                                            <input
                                                aria-label="Background color hex"
                                                value={project.background.color.replace('#', '').toUpperCase()}
                                                onChange={(e) => {
                                                    const hex = e.target.value.replace(/[^0-9a-f]/gi, '').slice(0, 6);
                                                    if (hex.length === 6) updateProject((p) => ({ ...p, background: { kind: 'solid', color: `#${hex.toUpperCase()}` } }));
                                                }}
                                                className="min-w-0 flex-1 bg-transparent text-[11px] text-[#d4d4d8] outline-none"
                                            />
                                        </label>
                                    )}
                                    {project.background.kind === 'image' && (
                                        <button onClick={() => projectBgFileRef.current?.click()} className="w-full h-[30px] rounded-lg bg-[#1d1d20] border border-white/[0.06] text-[11px] text-[#d4d4d8] hover:bg-[#262629]">Choose background image…</button>
                                    )}
                                    {project.background.kind === 'gradient' && (
                                        <div className="h-[30px] rounded-lg border border-white/[0.06] bg-gradient-to-r from-[#17172b] to-[#050507] px-2 flex items-center text-[11px] text-[#d4d4d8]">Shader background</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* =============================================================== */}
                    {/* TAB 2: ANIMATE (WHEN A LAYER IS SELECTED)                       */}
                    {/* =============================================================== */}
                    {mainTab === 'animate' && selectedLayer && (
                        <div className="flex-1 overflow-y-auto divide-y divide-white/[0.06]">
                            <div className="p-3.5 relative">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-medium text-[#e4e4e7]">
                                        Keyframe Blocks
                                    </span>
                                    <button
                                        onClick={() => setAddAnimMenuOpen((v) => !v)}
                                        className="px-2 py-1 rounded-md bg-[#0088ff]/15 hover:bg-[#0088ff]/25 text-[#0088ff] hover:text-white flex items-center gap-1 text-[10px] font-medium cursor-pointer transition"
                                    >
                                        <Plus className="w-3 h-3" />
                                        <span>Add</span>
                                    </button>
                                </div>

                                {addAnimMenuOpen && (
                                    <div className="mt-2 p-1 rounded-xl bg-[#18181b] border border-white/10 shadow-2xl space-y-0.5 text-[11px] z-20">
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

                            {/* ANIMATION BLOCKS LIST */}
                            {selectedLayer.blocks.map((blk) => {
                                const isVec = typeof blk.amount === 'object';
                                const isAngle =
                                    blk.property === 'tilt' || blk.property === 'rotation';
                                const isSize = blk.property === 'size';
                                const scaleFactor = isAngle ? 1 : refStageW;
                                const isSelectedBlock = selectedBlockId === blk.id;

                                return (
                                    <div
                                        key={blk.id}
                                        onClick={() => selectBlock(blk.id, selectedLayer.id)}
                                        className={`p-3.5 space-y-3 transition cursor-pointer ${isSelectedBlock
                                            ? 'bg-[#0088ff]/5 border-l-2 border-l-[#0088ff]'
                                            : 'hover:bg-white/[0.01]'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-medium text-[#e4e4e7] capitalize flex items-center gap-1.5">
                                                <span className={`w-1.5 h-1.5 rounded-full ${isSelectedBlock ? 'bg-[#0088ff]' : 'bg-[#71717a]'}`} />
                                                {blk.label || `${blk.property} animation`}
                                            </span>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteBlock(blk.id);
                                                }}
                                                className="p-1 rounded hover:bg-white/10 text-[#71717a] hover:text-rose-400 cursor-pointer"
                                                title="Delete Animation Block"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>

                                        <div className="space-y-1.5">
                                            <span className="text-[10px] text-[#71717a] block capitalize">
                                                Delta Amount
                                            </span>
                                            {isVec ? (
                                                <div className={`grid gap-1.5 ${isSize ? 'grid-cols-2' : 'grid-cols-3'}`}>
                                                    <ScrubInput
                                                        label={isSize ? 'ΔW' : 'X'}
                                                        value={
                                                            isAngle
                                                                ? radToDeg((blk.amount as any).x)
                                                                : Math.round((blk.amount as any).x * scaleFactor)
                                                        }
                                                        min={-3000}
                                                        max={3000}
                                                        step={isAngle ? 1 : 10}
                                                        unit={isAngle ? '°' : isSize ? 'px' : ''}
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
                                                        label={isSize ? 'ΔH' : 'Y'}
                                                        value={
                                                            isAngle
                                                                ? radToDeg((blk.amount as any).y)
                                                                : Math.round((blk.amount as any).y * refStageH)
                                                        }
                                                        min={-3000}
                                                        max={3000}
                                                        step={isAngle ? 1 : 10}
                                                        unit={isAngle ? '°' : isSize ? 'px' : ''}
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
                                                    {!isSize && (
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
                                                    )}
                                                </div>
                                            ) : (
                                                <ScrubInput
                                                    label="Δ"
                                                    value={blk.amount as number}
                                                    min={blk.property === 'opacity' ? -1 : -2}
                                                    max={blk.property === 'opacity' ? 1 : 30}
                                                    step={0.05}
                                                    decimals={2}
                                                    onChange={(amount) =>
                                                        handleUpdateBlock(blk.id, { amount })
                                                    }
                                                />
                                            )}
                                        </div>

                                        {/* DIRECTION BUTTONS (ONLY FOR POSITION) */}
                                        {isVec && blk.property === 'position' && (
                                            <div className="space-y-1.5">
                                                <span className="text-[10px] text-[#71717a] block">
                                                    Direction
                                                </span>
                                                <div className="grid grid-cols-2 gap-1 bg-[#161619] p-0.5 rounded-lg border border-white/[0.05]">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleUpdateBlock(blk.id, {
                                                                amount: {
                                                                    ...(blk.amount as any),
                                                                    x: -Math.abs((blk.amount as any).x || 0.35),
                                                                },
                                                            });
                                                        }}
                                                        className={`h-6 rounded-md flex items-center justify-center cursor-pointer transition ${(blk.amount as any).x <= 0
                                                            ? 'bg-[#27272c] text-white'
                                                            : 'text-[#71717a] hover:text-white'
                                                            }`}
                                                        title="Left Direction"
                                                    >
                                                        <ArrowLeft className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleUpdateBlock(blk.id, {
                                                                amount: {
                                                                    ...(blk.amount as any),
                                                                    x: Math.abs((blk.amount as any).x || 0.35),
                                                                },
                                                            });
                                                        }}
                                                        className={`h-6 rounded-md flex items-center justify-center cursor-pointer transition ${(blk.amount as any).x > 0
                                                            ? 'bg-[#27272c] text-white'
                                                            : 'text-[#71717a] hover:text-white'
                                                            }`}
                                                        title="Right Direction"
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
                                                max={Math.max(0, activeShot.durationMs - 80)}
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

                            {/* IN SECTION (Entrance Transition) */}
                            <div className="p-3.5 space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-medium text-[#e4e4e7]">
                                        In (Entrance)
                                    </span>
                                    <button
                                        onClick={() =>
                                            updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                ...l,
                                                entrance: {
                                                    ...l.entrance,
                                                    type: l.entrance.type === 'none' ? 'fade' : l.entrance.type,
                                                    durationMs: l.entrance.durationMs || 650,
                                                },
                                            }))
                                        }
                                        title="Add / Configure Entrance"
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
                                                title={selectedLayer.entrance.durationMs === 0 ? 'Enable' : 'Disable'}
                                                className="p-1 text-[#71717a] hover:text-white cursor-pointer"
                                            >
                                                {selectedLayer.entrance.durationMs === 0 ? (
                                                    <EyeOff className="w-3.5 h-3.5 text-amber-400" />
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
                                                title="Remove Entrance"
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
                                                max={Math.max(0, activeShot.durationMs - 100)}
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
                                                min={0}
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

                            {/* OUT SECTION (Exit Transition) */}
                            <div className="p-3.5 space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-medium text-[#e4e4e7]">
                                        Out (Exit)
                                    </span>
                                    <button
                                        onClick={() =>
                                            updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                ...l,
                                                exit: {
                                                    ...l.exit,
                                                    type: l.exit.type === 'none' ? 'fade' : l.exit.type,
                                                    durationMs: l.exit.durationMs || 550,
                                                },
                                            }))
                                        }
                                        title="Add / Configure Exit"
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
                                                    <option value="float-out" className="bg-[#18181b]">
                                                        Float Out
                                                    </option>
                                                    <option value="scale-out" className="bg-[#18181b]">
                                                        Scale Out
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
                                                        exit: {
                                                            ...l.exit,
                                                            durationMs:
                                                                l.exit.durationMs === 0 ? 550 : 0,
                                                        },
                                                    }))
                                                }
                                                title={selectedLayer.exit.durationMs === 0 ? 'Enable' : 'Disable'}
                                                className="p-1 text-[#71717a] hover:text-white cursor-pointer"
                                            >
                                                {selectedLayer.exit.durationMs === 0 ? (
                                                    <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                                                ) : (
                                                    <Eye className="w-3.5 h-3.5" />
                                                )}
                                            </button>

                                            <button
                                                onClick={() =>
                                                    updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                        ...l,
                                                        exit: { ...l.exit, type: 'none' },
                                                    }))
                                                }
                                                title="Remove Exit"
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
                                                max={Math.max(0, activeShot.durationMs - 100)}
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
                                                min={0}
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

                    {/* =============================================================== */}
                    {/* TAB 2: ANIMATE (WHEN NO LAYER IS SELECTED — SCENE CAMERA)       */}
                    {/* =============================================================== */}
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
                                        className="px-2.5 py-1 rounded-lg bg-[#0088ff] hover:bg-[#0077e6] text-white text-[10px] font-semibold cursor-pointer transition"
                                    >
                                        + Add Camera Move
                                    </button>
                                </div>

                                {/* List existing camera moves */}
                                {activeShot.cameraBlocks && activeShot.cameraBlocks.length > 0 && (
                                    <div className="space-y-1.5 pt-1">
                                        {activeShot.cameraBlocks.map((cb, idx) => (
                                            <div
                                                key={cb.id}
                                                onClick={() => selectCameraBlock(cb.id)}
                                                className={`p-2.5 rounded-lg bg-[#161619] border transition flex items-center justify-between cursor-pointer ${selectedCameraBlockId === cb.id
                                                    ? 'border-[#0088ff]/60 bg-[#0088ff]/10'
                                                    : 'border-white/[0.06] hover:border-white/20'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <Film className="w-3.5 h-3.5 text-emerald-400" />
                                                    <div>
                                                        <div className="text-[11px] font-medium text-white">
                                                            {cb.label || `Camera Move #${idx + 1}`}
                                                        </div>
                                                        <div className="text-[9px] text-[#71717a]">
                                                            {cb.startMs}ms – {cb.startMs + cb.durationMs}ms ({cb.mode})
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        updateShot(activeShot.id, (s) => ({
                                                            ...s,
                                                            cameraBlocks: s.cameraBlocks.filter((b) => b.id !== cb.id),
                                                        }));
                                                        if (selectedCameraBlockId === cb.id) {
                                                            selectCameraBlock(null);
                                                        }
                                                    }}
                                                    className="p-1 text-[#71717a] hover:text-rose-400 cursor-pointer"
                                                    title="Delete Move"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <p className="text-[10px] text-[#71717a] leading-relaxed">
                                    Add a Camera Move to unlock From / To keyframes, Zoom, Orbit,
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
