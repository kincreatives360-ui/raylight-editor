import { LIGHT_TYPE_META } from '../ui/lightTypes';
import { IconButton } from '../ui/primitives';
import { useFloatingPanel } from '../ui/useFloatingPanel';
import { DropdownMenu, MenuItem } from '../ui/Menu';
// src/stage/CanvasToolbar.tsx
import React, { useState, useRef } from 'react';
import { MousePointer, Move, Rotate3d, Circle, Square, Minus, Type, Sun, ChevronDown, Hand, Pentagon, ArrowRight, Camera, Spline, Shapes, Scissors, LayoutGrid, Volume2, Image as ImageIcon, Check, Crop, Sparkles, Activity, Focus, Feather } from 'lucide-react';
import type { Layer } from '../model/types';
import { useSelectionStore, type CanvasTool } from '../store/useSelectionStore';
import { usePlayheadStore } from '../store/usePlayheadStore';
import { useProjectStore } from '../store/useProjectStore';
import { CAMERA_TOOL_SHORTCUT, SCISSORS_SHORTCUT } from '../utils/cameraShortcuts';
import { SHAPE_TOOL_ITEMS } from './canvasToolItems';
import type { CanvasToolbarPlacement } from './canvasToolbarLayout';

interface CanvasToolbarProps {
    selectedLayer: Layer | undefined;
    defaultOpenMenu?: MenuKey;
    onOpenSceneEffects?: () => void;
    onToggleLightRig?: () => void;
    showSafeArea?: boolean;
    onToggleSafeArea?: () => void;
    onOpenShortcuts?: () => void;
    onSelectAudioClick?: () => void;
    onFrameSelection?: () => void;
    placement?: CanvasToolbarPlacement;
}

type MenuKey = 'pointer' | 'shape' | 'light' | 'components' | null;

const PointerIcon: React.FC<{ activeTool: CanvasTool }> = ({ activeTool }) => {
    switch (activeTool) {
        case 'move': return <Move className="w-3.5 h-3.5" />;
        case 'hand': return <Hand className="w-3.5 h-3.5" />;
        case 'camera': return <Camera className="w-3.5 h-3.5" />;
        case 'tilt': return <Rotate3d className="w-3.5 h-3.5" />;
        default: return <MousePointer className="w-3.5 h-3.5 fill-current" />;
    }
};

const ShapeIcon: React.FC<{ activeTool: CanvasTool }> = ({ activeTool }) => {
    switch (activeTool) {
        case 'ellipse': return <Circle className="w-3.5 h-3.5" />;
        case 'line': return <Minus className="w-3.5 h-3.5" />;
        case 'arrow': return <ArrowRight className="w-3.5 h-3.5" />;
        case 'polygon': return <Pentagon className="w-3.5 h-3.5" />;
        case 'pen': return <Feather className="w-3.5 h-3.5" />;
        case 'image': return <ImageIcon className="w-3.5 h-3.5" />;
        default: return <Square className="w-3.5 h-3.5" />;
    }
};





export const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
    selectedLayer,
    defaultOpenMenu,
    onOpenSceneEffects: _onOpenSceneEffects,
    onToggleLightRig,
    showSafeArea = false,
    onToggleSafeArea,
    onOpenShortcuts: _onOpenShortcuts,
    onSelectAudioClick,
    onFrameSelection,
    placement = 'bottom',
}) => {
    const {
        activeTool,
        isAnimateMode,
        isCropping,
        selectedShotId,
        selectedLightId,
        activeLightTool,
        selectLight,
        setActiveLightTool,
        setActiveTool,
        toggleAnimateMode,
        setIsCropping,
        setInspectorTab,
    } = useSelectionStore();

    const { currentTimeMs } = usePlayheadStore();
    const { project, addCameraBlockToShot, updateLayer, updateShot, splitShotAtPlayhead } = useProjectStore();

    const [openMenu, setOpenMenu] = useState<MenuKey>(defaultOpenMenu ?? null);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const activeShot = project.shots.find((s) => s.id === selectedShotId) || project.shots[0];

    // Close menus on outside click
    useFloatingPanel({ open: !!openMenu, surfaceRef: menuRef, onClose: () => setOpenMenu(null), outsideEvent: 'mousedown', escape: true });

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
        activeTool === 'pen' ||
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
        const targetLayer = selectedLayer;

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
            addCameraBlockToShot(activeShot.id, {
                label: 'Camera Shake',
                mode: 'shake',
                startMs: 0,
                durationMs: 1400,
                easing: { kind: 'preset', name: 'ease' },
                from: { anchorX: 0, anchorY: 0, zoom: 1, roll: 0, orbit: 0, tilt: 0 },
                to: { anchorX: 0.04, anchorY: 0.03, zoom: 1.05, roll: 1.5, orbit: 2, tilt: 1 },
            });
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

    const handleToggleLightButton = () => {
        if (selectedLightId) {
            selectLight(null);
        } else {
            if (activeShot?.light?.keyLightEnabled === false && activeShot) {
                updateShot(activeShot.id, (shot) => ({
                    ...shot,
                    light: { ...shot.light, keyLightEnabled: true },
                }));
            }
            selectLight('sun-key');
        }
        if (onToggleLightRig) onToggleLightRig();
    };

    const handleSelectOrCreateLight = (type: 'directional' | 'spot' | 'point' | 'area') => {
        if (!activeShot) return;
        selectLight(null);
        setActiveTool('select');
        setActiveLightTool(type);
        setOpenMenu(null);
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

    /* ── Shared button style ── */
    const toolBtn = (active: boolean) =>
        `w-9 h-9 rounded-lg flex items-center justify-center transition-colors duration-100 cursor-pointer focus-visible:outline-none ${
            active
                ? 'bg-brand-blue text-white shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
        }`;

    const chevronBtn =
        'px-1 py-2 text-muted-foreground hover:text-foreground cursor-pointer rounded transition-colors';

    /* ── Dropdown menu items ── */
    const pointerItems: { id: CanvasTool; label: string; key: string; icon: React.FC<{ className?: string }> }[] = [
        { id: 'select', label: 'Select', key: 'V', icon: MousePointer },
        { id: 'hand', label: 'Hand', key: 'H', icon: Hand },
        { id: 'camera', label: 'Orbit', key: CAMERA_TOOL_SHORTCUT.label, icon: Camera },
        { id: 'tilt', label: 'Tilt', key: 'Y', icon: Rotate3d },
        { id: 'move', label: 'Move', key: 'G', icon: Move },
    ];

    return (
        <div
            ref={menuRef}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            data-canvas-toolbar-positioner=""
            className={`absolute ${placement === 'top' ? 'top-3' : 'bottom-3'} left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-2 select-none max-w-[calc(100%-24px)]`}
        >
            {/* Transient Toast Notification */}
            {toastMessage && (
                <div className="px-3 py-1.5 rounded-lg bg-black/85 backdrop-blur-md border border-white/20 text-[11px] font-medium text-white shadow-2xl animate-fade-in">
                    {toastMessage}
                </div>
            )}

            {/* Contextual Floating Toolbar (Image / Video Layer Actions: Crop) */}
            {activeTool !== 'camera' && (selectedLayer?.kind === 'image' || selectedLayer?.kind === 'video') && (
                <div
                    id="raylight-context-toolbar"
                    className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl bg-surface/95 backdrop-blur-xl border border-subtle shadow-2xl text-xs shrink-0 animate-fade-in"
                >
                    <button
                        onClick={() => setIsCropping(!isCropping)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors duration-150 ${
                            isCropping
                                ? 'bg-brand-blue text-white shadow-xs'
                                : 'hover:bg-subtle text-foreground'
                        }`}
                        title="Crop Image / Video"
                    >
                        {isCropping ? (
                            <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Done</span>
                            </>
                        ) : (
                            <>
                                <Crop className="w-3.5 h-3.5 text-muted-foreground" />
                                <span>Crop</span>
                            </>
                        )}
                    </button>
                </div>
            )}

            {/* ═══ Main Floating Toolbar ═══ */}
            <div id="raylight-canvas-toolbar" className="raylight-floating-toolbar relative flex flex-wrap items-center justify-center gap-2 px-3 py-2 rounded-xl bg-surface/95 backdrop-blur-xl border border-subtle shadow-2xl text-xs max-w-full shrink-0">
                {/* 1 ─ Select / Pointer ▼ */}
                <div className="relative flex items-center">
                    <IconButton
                        unstyled
                        tooltip={false}
                        label="Select Tool (V)"
                        icon={<>
                            <PointerIcon activeTool={activeTool} />
                        </>}
                        onClick={() => setActiveTool('select')}
                        title="Select Tool (V)"
                        className={toolBtn(isPointerActive)}
                    />
                    <IconButton
                        unstyled
                        tooltip={false}
                        label="Pointer tools"
                        icon={<>
                            <ChevronDown className="w-3 h-3" />
                        </>}
                        aria-expanded={openMenu === 'pointer'}
                        onClick={() => toggleMenu('pointer')}
                        className={chevronBtn}
                    />

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
                                shortcut={SCISSORS_SHORTCUT.label}
                                accent="text-amber-300"
                                onClick={handleSplitShot}
                            />
                            {onFrameSelection && (
                                <MenuItem
                                    icon={Focus}
                                    label="Frame Selection"
                                    shortcut="F"
                                    onClick={() => {
                                        onFrameSelection();
                                        setOpenMenu(null);
                                    }}
                                />
                            )}
                        </DropdownMenu>
                    )}
                </div>

                {/* 2 ─ Animate (Spline) */}
                <IconButton
                    unstyled
                    tooltip={false}
                    label="Animate Mode (Shift+A)"
                    icon={<>
                        <Spline className="w-3.5 h-3.5" />
                    </>}
                    onClick={handleToggleAnimate}
                    title="Animate (Shift+A)"
                    className={toolBtn(isAnimateMode)}
                />

                {/* 3 ─ Shape ▼ */}
                <div className="relative flex items-center">
                    <IconButton
                        unstyled
                        tooltip={false}
                        label="Shape Tool"
                        icon={<>
                            <ShapeIcon activeTool={activeTool} />
                        </>}
                        onClick={() =>
                            setActiveTool(
                                isShapeActive ? activeTool : 'rectangle'
                            )
                        }
                        title="Shape tools (R / O / P / L / A)"
                        className={toolBtn(isShapeActive)}
                    />
                    <IconButton
                        unstyled
                        tooltip={false}
                        label="Shape options"
                        icon={<>
                            <ChevronDown className="w-3 h-3" />
                        </>}
                        aria-expanded={openMenu === 'shape'}
                        onClick={() => toggleMenu('shape')}
                        className={chevronBtn}
                    />

                    {openMenu === 'shape' && (
                        <DropdownMenu>
                            {SHAPE_TOOL_ITEMS.map((item) => (
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
                <IconButton
                    unstyled
                    tooltip={false}
                    label="Text Tool (T)"
                    icon={<>
                        <Type className="w-3.5 h-3.5" />
                    </>}
                    onClick={() => setActiveTool('text')}
                    title="Text Tool (T)"
                    className={toolBtn(activeTool === 'text')}
                />



                {/* 6 ─ Grid / Alignment */}
                <IconButton
                    unstyled
                    tooltip={false}
                    label="Alignment Grid"
                    icon={<>
                        <LayoutGrid className="w-3.5 h-3.5" />
                    </>}
                    onClick={() => {
                        if (onToggleSafeArea) {
                            onToggleSafeArea();
                        } else {
                            showToast('Alignment grid toggled');
                        }
                    }}
                    aria-pressed={showSafeArea}
                    title="Snap Grid & Alignment Guides ( ' )"
                    className={toolBtn(showSafeArea)}
                />

                {/* 7 ─ Lighting ▼ */}
                <div className="relative flex items-center">
                    <IconButton
                        unstyled
                        tooltip={false}
                        label="Lighting Rig"
                        icon={<>
                            <Sun className="w-3.5 h-3.5" />
                        </>}
                        onClick={handleToggleLightButton}
                        title="Scene Lighting Rig & Reflections"
                        className={toolBtn(selectedLightId !== null || activeLightTool !== null || openMenu === 'light')}
                    />
                    <IconButton
                        unstyled
                        tooltip={false}
                        label="Lighting options"
                        icon={<>
                            <ChevronDown className="w-3 h-3" />
                        </>}
                        aria-expanded={openMenu === 'light'}
                        onClick={() => toggleMenu('light')}
                        className={chevronBtn}
                    />

                    {openMenu === 'light' && (
                        <DropdownMenu>
                            <MenuItem
                                icon={LIGHT_TYPE_META.directional.icon}
                                label="Sun Light"
                                active={selectedLightId === 'sun-key'}
                                onClick={() => handleSelectOrCreateLight('directional')}
                            />
                            <MenuItem
                                icon={LIGHT_TYPE_META.spot.icon}
                                label="Spot Light"
                                active={Boolean(selectedLightId && activeShot?.light?.sources?.some(s => s.id === selectedLightId && s.type === 'spot'))}
                                onClick={() => handleSelectOrCreateLight('spot')}
                            />
                            <MenuItem
                                icon={LIGHT_TYPE_META.point.icon}
                                label="Point Light"
                                active={Boolean(selectedLightId && activeShot?.light?.sources?.some(s => s.id === selectedLightId && s.type === 'point'))}
                                onClick={() => handleSelectOrCreateLight('point')}
                            />
                            <MenuItem
                                icon={LIGHT_TYPE_META.area.icon}
                                label="Area Light"
                                active={Boolean(selectedLightId && activeShot?.light?.sources?.some(s => s.id === selectedLightId && s.type === 'area'))}
                                onClick={() => handleSelectOrCreateLight('area')}
                            />
                        </DropdownMenu>
                    )}
                </div>

                {/* 8 ─ Components & Motion Presets ▼ */}
                <div className="relative flex items-center">
                    <IconButton
                        unstyled
                        tooltip={false}
                        label="Components and Motion Presets Library"
                        icon={<>
                            <Shapes className="w-3.5 h-3.5" />
                        </>}
                        onClick={() => toggleMenu('components')}
                        aria-expanded={openMenu === 'components'}
                        title="Component & Motion Presets Library"
                        className={toolBtn(openMenu === 'components')}
                    />
                    <IconButton
                        unstyled
                        tooltip={false}
                        label="Component options"
                        icon={<>
                            <ChevronDown className="w-3 h-3" />
                        </>}
                        aria-expanded={openMenu === 'components'}
                        onClick={() => toggleMenu('components')}
                        className={chevronBtn}
                    />

                    {openMenu === 'components' && (
                        <DropdownMenu align="right" className="w-80 p-2.5">
                            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-subtle">
                                <div className="flex items-center gap-1.5 font-semibold text-foreground text-[12px]">
                                    <Shapes className="w-4 h-4 text-brand-blue" />
                                    <span>Library &amp; Presets</span>
                                </div>
                            </div>

                            <div className="space-y-1 max-h-72 overflow-y-auto pr-0.5">
                                    <div className="text-[11px] uppercase font-mono tracking-wider text-muted-foreground px-1 py-0.5">
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
                                                className="w-full p-2 rounded-lg flex items-center justify-between text-left cursor-pointer hover:bg-subtle transition group border border-transparent hover:border-subtle"
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center border ${preset.bg} shrink-0`}>
                                                        <Icon className={`w-3.5 h-3.5 ${preset.color}`} />
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-foreground text-[11px] group-hover:text-brand-blue transition-colors">
                                                            {preset.label}
                                                        </div>
                                                        <div className="text-[11px] text-muted-foreground leading-tight">
                                                            {preset.desc}
                                                        </div>
                                                    </div>
                                                </div>
                                                <span className="text-[11px] font-mono tabular-nums px-1.5 py-0.5 rounded bg-surface text-muted-foreground group-hover:text-white group-hover:bg-brand-blue transition">
                                                    Apply
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                        </DropdownMenu>
                    )}
                </div>


            </div>
        </div>
    );
};
