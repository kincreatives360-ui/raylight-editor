// src/stage/CanvasToolbar.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
    MousePointer,
    Move,
    Rotate3d,
    Circle,
    Square,
    Minus,
    Type,
    Sun,
    ChevronDown,
    Hand,
    Pentagon,
    ArrowRight,
    Camera,
    Spline,
    Shapes,
    Scissors,
    Tag,
    LayoutGrid,
    Volume2,
    Image as ImageIcon,
    Check,
    Crop,
    Smartphone,
    Laptop,
    Tablet,
    Monitor,
    Sparkles,
    Activity,
} from 'lucide-react';
import type { Layer } from '../model/types';
import { useSelectionStore, type CanvasTool } from '../store/useSelectionStore';
import { usePlayheadStore } from '../store/usePlayheadStore';
import { useProjectStore } from '../store/useProjectStore';

interface CanvasToolbarProps {
    selectedLayer: Layer | undefined;
    onOpenSceneEffects?: () => void;
    onToggleLightRig?: () => void;
    showSafeArea?: boolean;
    onToggleSafeArea?: () => void;
    onOpenShortcuts?: () => void;
    onSelectAudioClick?: () => void;
}

type MenuKey = 'pointer' | 'shape' | 'light' | 'components' | null;

export const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
    selectedLayer,
    onOpenSceneEffects: _onOpenSceneEffects,
    onToggleLightRig,
    showSafeArea = false,
    onToggleSafeArea,
    onOpenShortcuts: _onOpenShortcuts,
    onSelectAudioClick,
}) => {
    const {
        activeTool,
        isAnimateMode,
        isCropping,
        selectedShotId,
        setActiveTool,
        toggleAnimateMode,
        setIsCropping,
        setInspectorTab,
        selectLayer,
    } = useSelectionStore();

    const { currentTimeMs } = usePlayheadStore();
    const { project, updateShot, updateLayer, splitShotAtPlayhead, addLayerToShot } = useProjectStore();

    const [openMenu, setOpenMenu] = useState<MenuKey>(null);
    const [componentTab, setComponentTab] = useState<'motion' | 'devices'>('motion');
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const activeShot = project.shots.find((s) => s.id === selectedShotId) || project.shots[0];

    // Close menus on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setOpenMenu(null);
            }
        };
        if (openMenu) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [openMenu]);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 2400);
    };

    const toggleMenu = (key: MenuKey) => setOpenMenu((prev) => (prev === key ? null : key));

    const isPointerActive =
        activeTool === 'select' ||
        activeTool === 'move' ||
        activeTool === 'hand' ||
        activeTool === 'camera' ||
        activeTool === 'tilt';
    const isShapeActive =
        activeTool === 'ellipse' ||
        activeTool === 'rectangle' ||
        activeTool === 'line' ||
        activeTool === 'arrow' ||
        activeTool === 'polygon' ||
        activeTool === 'image';

    /* ── helpers ── */
    const handleSplitShot = () => {
        if (!activeShot) return;
        const result = splitShotAtPlayhead(activeShot.id, currentTimeMs);
        if (result) {
            showToast('Shot split at playhead');
        } else {
            showToast('Move playhead inside shot to split');
        }
        setOpenMenu(null);
    };

    const handleApplyPreset = (presetName: string) => {
        if (!activeShot) return;
        const targetLayer = selectedLayer || activeShot.layers[0];

        if (!targetLayer && presetName !== 'Camera Shake') {
            showToast('Please select a layer to apply preset');
            return;
        }

        const id = `blk-${crypto.randomUUID()}`;

        if (presetName === 'Float' && targetLayer) {
            updateLayer(activeShot.id, targetLayer.id, (l) => ({
                ...l,
                blocks: [
                    ...l.blocks,
                    {
                        id,
                        label: 'Float Hover',
                        property: 'position',
                        startMs: 0,
                        durationMs: 1600,
                        amount: { x: 0, y: 0.12, z: 0 },
                        easing: { kind: 'preset', name: 'ease-in-out' },
                    },
                ],
            }));
            showToast('Applied Float preset');
        } else if (presetName === 'Wobble' && targetLayer) {
            updateLayer(activeShot.id, targetLayer.id, (l) => ({
                ...l,
                blocks: [
                    ...l.blocks,
                    {
                        id,
                        label: '3D Wobble',
                        property: 'rotation',
                        startMs: 0,
                        durationMs: 1400,
                        amount: { x: 0.14, y: -0.2, z: 0.08 },
                        easing: { kind: 'spring', name: 'bouncy' },
                    },
                ],
            }));
            showToast('Applied 3D Wobble preset');
        } else if (presetName === '3D Parallax Tilt' && targetLayer) {
            updateLayer(activeShot.id, targetLayer.id, (l) => ({
                ...l,
                blocks: [
                    ...l.blocks,
                    {
                        id,
                        label: '3D Parallax Tilt',
                        property: 'tilt',
                        startMs: 0,
                        durationMs: 1800,
                        amount: { x: 0.22, y: -0.38, z: 0 },
                        easing: { kind: 'preset', name: 'ease-in-out' },
                    },
                ],
            }));
            showToast('Applied 3D Parallax Tilt preset');
        } else if (presetName === 'Camera Shake') {
            updateShot(activeShot.id, (s) => ({
                ...s,
                cameraBlocks: [
                    ...(s.cameraBlocks || []),
                    {
                        id: `cam-${crypto.randomUUID()}`,
                        mode: 'shake',
                        fromFramingId: 'default',
                        toFramingId: 'default',
                        startMs: 0,
                        durationMs: 1400,
                        easing: { kind: 'preset', name: 'ease' },
                        from: { anchorX: 0, anchorY: 0, zoom: 1, roll: 0, orbit: 0, tilt: 0 },
                        to: { anchorX: 0.04, anchorY: 0.03, zoom: 1.05, roll: 1.5, orbit: 2, tilt: 1 },
                    },
                ],
            }));
            showToast('Applied Camera Shake');
        } else if (presetName === 'Glitch In' && targetLayer) {
            updateLayer(activeShot.id, targetLayer.id, (l) => ({
                ...l,
                entrance: {
                    type: 'scale-out',
                    durationMs: 500,
                    delayMs: 0,
                    distance: 1,
                    easing: { kind: 'spring', name: 'snappy' },
                },
            }));
            showToast('Applied Glitch In entrance');
        } else if (presetName === 'Smooth Zoom' && targetLayer) {
            updateLayer(activeShot.id, targetLayer.id, (l) => ({
                ...l,
                blocks: [
                    ...l.blocks,
                    {
                        id,
                        label: 'Smooth Zoom Punch',
                        property: 'scale',
                        startMs: 0,
                        durationMs: 1500,
                        amount: 0.25,
                        easing: { kind: 'preset', name: 'ease-out' },
                    },
                ],
            }));
            showToast('Applied Smooth Zoom preset');
        }
    };

    const handleToggleAnimate = () => {
        toggleAnimateMode();
        if (selectedLayer) {
            setInspectorTab('layer');
        }
    };

    /* ── Preset Data & Handlers ── */
    const motionPresets = [
        {
            name: 'Float',
            label: 'Float Hover',
            desc: 'Gentle vertical oscillation hover',
            icon: Sparkles,
            color: 'text-sky-400',
            bg: 'bg-sky-500/10 border-sky-500/20',
        },
        {
            name: 'Wobble',
            label: '3D Wobble',
            desc: 'Dynamic spring rotation bounce',
            icon: Rotate3d,
            color: 'text-amber-400',
            bg: 'bg-amber-500/10 border-amber-500/20',
        },
        {
            name: '3D Parallax Tilt',
            label: 'Parallax Tilt',
            desc: 'Cinematic pitch & yaw depth',
            icon: Move,
            color: 'text-purple-400',
            bg: 'bg-purple-500/10 border-purple-500/20',
        },
        {
            name: 'Camera Shake',
            label: 'Camera Shake',
            desc: 'Realistic handheld camera vibration',
            icon: Camera,
            color: 'text-emerald-400',
            bg: 'bg-emerald-500/10 border-emerald-500/20',
        },
        {
            name: 'Smooth Zoom',
            label: 'Smooth Zoom Punch',
            desc: 'Punch-in focal emphasis scale',
            icon: Activity,
            color: 'text-rose-400',
            bg: 'bg-rose-500/10 border-rose-500/20',
        },
        {
            name: 'Glitch In',
            label: 'Glitch In Entrance',
            desc: 'Snappy spring scale-out reveal',
            icon: Spline,
            color: 'text-cyan-400',
            bg: 'bg-cyan-500/10 border-cyan-500/20',
        },
    ];

    const deviceMockups = [
        {
            name: 'iPhone 15 Pro',
            subtitle: 'Natural Titanium CAD',
            badge: 'Hardware',
            icon: Smartphone,
            color: 'from-blue-600/30 to-indigo-950/60',
            device: { type: 'iphone' as const, color: 'titanium' as const, gloss: 0.5, glare: 1.0 },
        },
        {
            name: 'iPhone 16 Pro',
            subtitle: 'Space Black Titanium',
            badge: 'Hardware',
            icon: Smartphone,
            color: 'from-zinc-800/50 to-black',
            device: { type: 'iphone' as const, color: 'space-black' as const, gloss: 0.6, glare: 1.0 },
        },
        {
            name: 'MacBook Pro 16"',
            subtitle: 'Space Black Unibody',
            badge: 'Laptop',
            icon: Laptop,
            color: 'from-slate-800/40 to-zinc-950',
            device: { type: 'macbook' as const, color: 'space-black' as const, gloss: 0.4, lidAngle: 110 },
        },
        {
            name: 'iPad Pro',
            subtitle: 'Silver Liquid Retina',
            badge: 'Tablet',
            icon: Tablet,
            color: 'from-cyan-900/30 to-blue-950',
            device: { type: 'ipad' as const, color: 'silver' as const, gloss: 0.4 },
        },
        {
            name: 'Studio Display',
            subtitle: 'Aluminum 5K Retina',
            badge: '5K Display',
            icon: Monitor,
            color: 'from-neutral-800/40 to-neutral-950',
            device: { type: 'display' as const, color: 'silver' as const, gloss: 0.3 },
        },
    ];

    const handleInsertDevice = (dev: (typeof deviceMockups)[0]) => {
        if (!activeShot) return;
        const created = addLayerToShot(activeShot.id, 'image', {
            name: dev.name,
            device: dev.device,
            receivesLight: true,
            position: { x: 0, y: 0, z: 0 },
            size:
                dev.device.type === 'macbook' || dev.device.type === 'display'
                    ? { width: 0.72, height: 0.48 }
                    : { width: 0.35, height: 0.7 },
        });
        setInspectorTab('layer');
        selectLayer(created.id);
        setOpenMenu(null);
        showToast(`Added ${dev.name} to scene`);
    };

    /* ── Pointer icon (reflects currently active sub-tool) ── */
    const PointerIcon = () => {
        switch (activeTool) {
            case 'move':
                return <Move className="w-3.5 h-3.5" />;
            case 'hand':
                return <Hand className="w-3.5 h-3.5" />;
            case 'camera':
                return <Camera className="w-3.5 h-3.5" />;
            case 'tilt':
                return <Rotate3d className="w-3.5 h-3.5" />;
            default:
                return <MousePointer className="w-3.5 h-3.5 fill-current" />;
        }
    };

    /* ── Shape icon (reflects currently active sub-tool) ── */
    const ShapeIcon = () => {
        switch (activeTool) {
            case 'ellipse':
                return <Circle className="w-3.5 h-3.5" />;
            case 'line':
                return <Minus className="w-3.5 h-3.5" />;
            case 'arrow':
                return <ArrowRight className="w-3.5 h-3.5" />;
            case 'polygon':
                return <Pentagon className="w-3.5 h-3.5" />;
            case 'image':
                return <ImageIcon className="w-3.5 h-3.5" />;
            default:
                return <Square className="w-3.5 h-3.5" />;
        }
    };

    /* ── Shared button style ── */
    const toolBtn = (active: boolean) =>
        `w-7 h-7 rounded-lg flex items-center justify-center transition-colors duration-100 cursor-pointer focus-visible:outline-none ${
            active
                ? 'bg-[var(--accent-primary,#0088ff)] text-white shadow-sm'
                : 'text-[#a1a1aa] hover:text-white hover:bg-white/5'
        }`;

    const chevronBtn =
        'px-0.5 py-1 text-[#a1a1aa] hover:text-white cursor-pointer rounded transition-colors';

    /* ── Dropdown menu items ── */
    const pointerItems: { id: CanvasTool; label: string; key: string; icon: React.FC<{ className?: string }> }[] = [
        { id: 'select', label: 'Select', key: 'V', icon: MousePointer },
        { id: 'hand', label: 'Hand', key: 'H', icon: Hand },
        { id: 'camera', label: 'Orbit', key: '⇧F', icon: Camera },
        { id: 'tilt', label: 'Tilt', key: 'Y', icon: Rotate3d },
        { id: 'move', label: 'Move', key: 'G', icon: Move },
    ];

    const shapeItems: { id: CanvasTool; label: string; key: string; icon: React.FC<{ className?: string }> }[] = [
        { id: 'rectangle', label: 'Rectangle', key: 'R', icon: Square },
        { id: 'ellipse', label: 'Ellipse', key: 'O', icon: Circle },
        { id: 'polygon', label: 'Polygon', key: '', icon: Pentagon },
        { id: 'line', label: 'Line', key: 'L', icon: Minus },
        { id: 'arrow', label: 'Arrow', key: '⇧L', icon: ArrowRight },
    ];

    const lightItems = [
        { id: 'spot', label: 'Spot', key: 'B', desc: 'Focused cone light' },
        { id: 'point', label: 'Point', key: '', desc: 'Omnidirectional source' },
        { id: 'area', label: 'Area', key: '', desc: 'Rectangular studio softbox' },
        { id: 'sun', label: 'Sun', key: '', desc: 'Global directional key light' },
    ];

    /* ── Render a flat dropdown menu ── */
    const DropdownMenu: React.FC<{
        children: React.ReactNode;
        align?: 'left' | 'right';
        className?: string;
    }> = ({ children, align = 'left', className = '' }) => (
        <div
            className={`absolute bottom-full mb-2 ${align === 'right' ? 'right-0' : 'left-0'} min-w-[10rem] rounded-xl bg-[#1e1e22]/95 border border-white/[0.08] shadow-2xl p-1 text-xs z-50 ${className}`}
            style={{ backdropFilter: 'blur(20px)' }}
        >
            {children}
        </div>
    );

    const MenuItem: React.FC<{
        icon: React.FC<{ className?: string }>;
        label: string;
        shortcut?: string;
        active?: boolean;
        accent?: string;
        onClick: () => void;
    }> = ({ icon: Icon, label, shortcut, active, accent, onClick }) => (
        <button
            type="button"
            onClick={onClick}
            className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-left cursor-pointer transition ${
                active
                    ? 'bg-[var(--accent-primary,#0088ff)] text-white'
                    : 'text-[#d4d4d8] hover:bg-white/5 hover:text-white'
            }`}
        >
            <div className="flex items-center gap-2">
                <Icon className={`w-3.5 h-3.5 ${accent ?? 'opacity-80'}`} />
                <span>{label}</span>
            </div>
            {shortcut && <span className="text-[10px] font-mono opacity-60">{shortcut}</span>}
        </button>
    );

    return (
        <div
            ref={menuRef}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-2 select-none"
        >
            {/* Transient Toast Notification */}
            {toastMessage && (
                <div className="px-3 py-1.5 rounded-lg bg-black/85 backdrop-blur-md border border-white/20 text-[11px] font-medium text-white shadow-2xl animate-fade-in">
                    {toastMessage}
                </div>
            )}

            {/* Floating Crop Pill (visible when Image/Video layer selected) */}
            {(selectedLayer?.kind === 'image' || selectedLayer?.kind === 'video') && (
                <button
                    onClick={() => setIsCropping(!isCropping)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border shadow-xl cursor-pointer transition-colors duration-100 ${
                        isCropping
                            ? 'bg-[var(--accent-primary,#0088ff)] text-white border-[#0077e6]'
                            : 'bg-[#161619]/95 hover:bg-[#242428] text-[#f4f4f5] border-white/[0.07]'
                    }`}
                >
                    {isCropping ? (
                        <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Done</span>
                        </>
                    ) : (
                        <>
                            <Crop className="w-3.5 h-3.5 text-[#a1a1aa]" />
                            <span>Crop</span>
                        </>
                    )}
                </button>
            )}

            {/* ═══ Main Floating Toolbar ═══ */}
            <div className="relative flex items-center gap-0.5 px-1.5 py-1 rounded-xl bg-[#161619]/95 backdrop-blur-xl border border-white/[0.08] shadow-2xl text-xs">

                {/* 1 ─ Select / Pointer ▼ */}
                <div className="relative flex items-center">
                    <button
                        type="button"
                        onClick={() => setActiveTool('select')}
                        aria-label="Select Tool (V)"
                        title="Select Tool (V)"
                        className={toolBtn(isPointerActive)}
                    >
                        <PointerIcon />
                    </button>
                    <button
                        type="button"
                        aria-label="Pointer tools"
                        aria-expanded={openMenu === 'pointer'}
                        onClick={() => toggleMenu('pointer')}
                        className={chevronBtn}
                    >
                        <ChevronDown className="w-3 h-3" />
                    </button>

                    {openMenu === 'pointer' && (
                        <DropdownMenu>
                            {pointerItems.map((item) => (
                                <MenuItem
                                    key={item.id}
                                    icon={item.icon}
                                    label={item.label}
                                    shortcut={item.key}
                                    active={activeTool === item.id}
                                    onClick={() => {
                                        setActiveTool(item.id);
                                        setOpenMenu(null);
                                    }}
                                />
                            ))}
                            <MenuItem
                                icon={Scissors}
                                label="Scissors"
                                shortcut="C"
                                accent="text-amber-300"
                                onClick={handleSplitShot}
                            />
                        </DropdownMenu>
                    )}
                </div>

                {/* 2 ─ Animate (Spline) */}
                <button
                    type="button"
                    onClick={handleToggleAnimate}
                    aria-label="Animate Mode (Shift+A)"
                    title="Animate (Shift+A)"
                    className={toolBtn(isAnimateMode)}
                >
                    <Spline className="w-3.5 h-3.5" />
                </button>

                {/* 3 ─ Shape ▼ */}
                <div className="relative flex items-center">
                    <button
                        type="button"
                        onClick={() =>
                            setActiveTool(
                                isShapeActive ? activeTool : 'rectangle'
                            )
                        }
                        aria-label="Shape Tool"
                        title="Shape Tool (R / O / L)"
                        className={toolBtn(isShapeActive)}
                    >
                        <ShapeIcon />
                    </button>
                    <button
                        type="button"
                        aria-label="Shape options"
                        aria-expanded={openMenu === 'shape'}
                        onClick={() => toggleMenu('shape')}
                        className={chevronBtn}
                    >
                        <ChevronDown className="w-3 h-3" />
                    </button>

                    {openMenu === 'shape' && (
                        <DropdownMenu>
                            {shapeItems.map((item) => (
                                <MenuItem
                                    key={item.id}
                                    icon={item.icon}
                                    label={item.label}
                                    shortcut={item.key}
                                    active={activeTool === item.id}
                                    onClick={() => {
                                        setActiveTool(item.id);
                                        setOpenMenu(null);
                                    }}
                                />
                            ))}
                            {/* separator */}
                            <div className="h-px bg-white/[0.06] my-0.5" />
                            <MenuItem
                                icon={ImageIcon}
                                label="Image or video"
                                shortcut="I"
                                onClick={() => {
                                    setActiveTool('image');
                                    setOpenMenu(null);
                                }}
                            />
                            {onSelectAudioClick && (
                                <MenuItem
                                    icon={Volume2}
                                    label="Audio"
                                    shortcut="⇧I"
                                    onClick={() => {
                                        onSelectAudioClick();
                                        setOpenMenu(null);
                                    }}
                                />
                            )}
                        </DropdownMenu>
                    )}
                </div>

                {/* 4 ─ Text (T) */}
                <button
                    type="button"
                    onClick={() => setActiveTool('text')}
                    aria-label="Text Tool (T)"
                    title="Text Tool (T)"
                    className={toolBtn(activeTool === 'text')}
                >
                    <Type className="w-3.5 h-3.5" />
                </button>

                {/* 5 ─ Tag / Label */}
                <button
                    type="button"
                    onClick={() => showToast('Tag tool — coming soon')}
                    aria-label="Tag Tool"
                    title="Tag / Label annotations"
                    className={toolBtn(false)}
                >
                    <Tag className="w-3.5 h-3.5" />
                </button>

                {/* 6 ─ Grid / Alignment */}
                <button
                    type="button"
                    onClick={() => {
                        if (onToggleSafeArea) {
                            onToggleSafeArea();
                        } else {
                            showToast('Alignment grid toggled');
                        }
                    }}
                    aria-label="Alignment Grid"
                    aria-pressed={showSafeArea}
                    title="Snap Grid & Alignment Guides ( ' )"
                    className={toolBtn(showSafeArea)}
                >
                    <LayoutGrid className="w-3.5 h-3.5" />
                </button>

                {/* 7 ─ Lighting ▼ */}
                <div className="relative flex items-center">
                    <button
                        type="button"
                        onClick={onToggleLightRig}
                        aria-label="Lighting Rig"
                        title="Scene Lighting Rig & Reflections"
                        className={toolBtn(false)}
                    >
                        <Sun className="w-3.5 h-3.5" />
                    </button>
                    <button
                        type="button"
                        aria-label="Lighting options"
                        aria-expanded={openMenu === 'light'}
                        onClick={() => toggleMenu('light')}
                        className={chevronBtn}
                    >
                        <ChevronDown className="w-3 h-3" />
                    </button>

                    {openMenu === 'light' && (
                        <DropdownMenu align="right">
                            {lightItems.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => {
                                        if (onToggleLightRig) onToggleLightRig();
                                        setOpenMenu(null);
                                        showToast(`Active lighting: ${item.label}`);
                                    }}
                                    className="w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-left cursor-pointer text-[#d4d4d8] hover:bg-white/5 hover:text-white transition"
                                >
                                    <div>
                                        <div className="font-medium text-white">{item.label}</div>
                                        <div className="text-[10px] text-[#71717a]">{item.desc}</div>
                                    </div>
                                    {item.key && <span className="text-[10px] font-mono opacity-60">{item.key}</span>}
                                </button>
                            ))}
                        </DropdownMenu>
                    )}
                </div>

                {/* 8 ─ Components & Motion Presets ▼ */}
                <div className="relative flex items-center">
                    <button
                        type="button"
                        onClick={() => toggleMenu('components')}
                        aria-label="Components and Motion Presets Library"
                        aria-expanded={openMenu === 'components'}
                        title="Component & Motion Presets Library"
                        className={toolBtn(openMenu === 'components')}
                    >
                        <Shapes className="w-3.5 h-3.5" />
                    </button>
                    <button
                        type="button"
                        aria-label="Component options"
                        aria-expanded={openMenu === 'components'}
                        onClick={() => toggleMenu('components')}
                        className={chevronBtn}
                    >
                        <ChevronDown className="w-3 h-3" />
                    </button>

                    {openMenu === 'components' && (
                        <DropdownMenu align="right" className="w-80 p-2.5">
                            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-white/[0.08]">
                                <div className="flex items-center gap-1.5 font-semibold text-white text-[12px]">
                                    <Shapes className="w-4 h-4 text-[var(--accent-primary,#0088ff)]" />
                                    <span>Library &amp; Presets</span>
                                </div>
                                <div className="flex items-center bg-white/[0.06] p-0.5 rounded-lg border border-white/[0.08]">
                                    <button
                                        type="button"
                                        onClick={() => setComponentTab('motion')}
                                        className={`px-2 py-0.5 rounded text-[10px] font-medium transition cursor-pointer ${
                                            componentTab === 'motion'
                                                ? 'bg-[var(--accent-primary,#0088ff)] text-white shadow-xs'
                                                : 'text-[#a1a1aa] hover:text-white'
                                        }`}
                                    >
                                        Motion
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setComponentTab('devices')}
                                        className={`px-2 py-0.5 rounded text-[10px] font-medium transition cursor-pointer ${
                                            componentTab === 'devices'
                                                ? 'bg-[var(--accent-primary,#0088ff)] text-white shadow-xs'
                                                : 'text-[#a1a1aa] hover:text-white'
                                        }`}
                                    >
                                        3D Devices
                                    </button>
                                </div>
                            </div>

                            {componentTab === 'motion' ? (
                                <div className="space-y-1 max-h-72 overflow-y-auto pr-0.5">
                                    <div className="text-[10px] uppercase font-mono tracking-wider text-[#71717a] px-1 py-0.5">
                                        Active Layer Presets
                                    </div>
                                    {motionPresets.map((preset) => {
                                        const Icon = preset.icon;
                                        return (
                                            <button
                                                key={preset.name}
                                                type="button"
                                                onClick={() => {
                                                    handleApplyPreset(preset.name);
                                                    setOpenMenu(null);
                                                }}
                                                className="w-full p-2 rounded-lg flex items-center justify-between text-left cursor-pointer hover:bg-white/[0.07] transition group border border-transparent hover:border-white/[0.06]"
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center border ${preset.bg} shrink-0`}>
                                                        <Icon className={`w-3.5 h-3.5 ${preset.color}`} />
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-white text-[11px] group-hover:text-[var(--accent-primary,#0088ff)] transition-colors">
                                                            {preset.label}
                                                        </div>
                                                        <div className="text-[10px] text-[#8e8e93] leading-tight">
                                                            {preset.desc}
                                                        </div>
                                                    </div>
                                                </div>
                                                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/[0.06] text-[#a1a1aa] group-hover:text-white group-hover:bg-[var(--accent-primary,#0088ff)] transition">
                                                    Apply
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-0.5">
                                    <div className="text-[10px] uppercase font-mono tracking-wider text-[#71717a] px-1 py-0.5">
                                        Insert 3D Hardware CAD
                                    </div>
                                    {deviceMockups.map((dev) => {
                                        const Icon = dev.icon;
                                        return (
                                            <button
                                                key={dev.name}
                                                type="button"
                                                onClick={() => handleInsertDevice(dev)}
                                                className="w-full p-2 rounded-lg flex items-center justify-between text-left cursor-pointer hover:bg-white/[0.07] transition group border border-transparent hover:border-white/[0.06]"
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${dev.color} border border-white/10 flex items-center justify-center shrink-0 shadow-sm`}>
                                                        <Icon className="w-4 h-4 text-white drop-shadow" />
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-white text-[11px] group-hover:text-[var(--accent-primary,#0088ff)] transition-colors">
                                                            {dev.name}
                                                        </div>
                                                        <div className="text-[10px] text-[#8e8e93]">
                                                            {dev.subtitle}
                                                        </div>
                                                    </div>
                                                </div>
                                                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/[0.06] text-[#a1a1aa] group-hover:text-white group-hover:bg-[var(--accent-primary,#0088ff)] transition">
                                                    Insert
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </DropdownMenu>
                    )}
                </div>

                {/* 9 ─ Upgrade CTA */}
                <button
                    type="button"
                    onClick={() => showToast('Upgrade to Pro: 4K 60fps exports & premium mockups')}
                    aria-label="Upgrade to Pro"
                    className="ml-1 px-3 py-1 rounded-lg text-[var(--accent-primary,#0088ff)] text-[11px] font-semibold hover:bg-[var(--accent-primary,#0088ff)]/10 transition cursor-pointer"
                >
                    Upgrade
                </button>
            </div>
        </div>
    );
};