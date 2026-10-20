// src/stage/CanvasToolbar.tsx
import React, { useState } from 'react';
import {
    MousePointer,
    Move,
    Rotate3d,
    Circle,
    Square,
    Minus,
    Type,
    Sun,
    Sparkles,
    Play,
    Pause,
    AudioWaveform,
    Crop,
    Check,
    ChevronDown,
    Hand,
    Pen,
    Pentagon,
    ArrowRight,
    Camera,
    Spline,
    Shapes,
    Scissors,
    Volume2,
    Image as ImageIcon,
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

export const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
    selectedLayer,
    onOpenSceneEffects,
    onToggleLightRig,
    showSafeArea: _showSafeArea = false,
    onToggleSafeArea: _onToggleSafeArea,
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
    } = useSelectionStore();

    const { isPlaying, togglePlay, currentTimeMs } = usePlayheadStore();
    const { project, updateShot, updateLayer, splitShotAtPlayhead } = useProjectStore();

    const [pointerMenuOpen, setPointerMenuOpen] = useState(false);
    const [shapeMenuOpen, setShapeMenuOpen] = useState(false);
    const [lightMenuOpen, setLightMenuOpen] = useState(false);
    const [presetsMenuOpen, setPresetsMenuOpen] = useState(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    const activeShot = project.shots.find((s) => s.id === selectedShotId) || project.shots[0];

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 2400);
    };

    const isPointerActive =
        activeTool === 'select' || activeTool === 'move' || activeTool === 'hand' || activeTool === 'camera' || activeTool === 'tilt';
    const isShapeActive =
        activeTool === 'ellipse' ||
        activeTool === 'rectangle' ||
        activeTool === 'line' || activeTool === 'arrow' || activeTool === 'polygon' || activeTool === 'image';

    const handleSplitShot = () => {
        if (!activeShot) return;
        const result = splitShotAtPlayhead(activeShot.id, currentTimeMs);
        if (result) {
            showToast('Shot split at playhead');
        } else {
            showToast('Move playhead inside shot to split');
        }
        setPointerMenuOpen(false);
    };

    const handleApplyPreset = (presetName: string) => {
        if (!activeShot) return;
        const targetLayer = selectedLayer || activeShot.layers[0];

        if (!targetLayer && presetName !== 'Camera Shake') {
            showToast('Please select a layer to apply preset');
            setPresetsMenuOpen(false);
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

        setPresetsMenuOpen(false);
    };

    const handleToggleAnimate = () => {
        toggleAnimateMode();
        if (selectedLayer) {
            setInspectorTab('layer');
        }
    };

    return (
        <div
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

            {/* Floating Crop Pill (Shown above toolbar when an Image or Video layer is selected) */}
            {(selectedLayer?.kind === 'image' || selectedLayer?.kind === 'video') && (
                <button
                    onClick={() => setIsCropping(!isCropping)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border shadow-xl cursor-pointer transition-colors duration-100 ${isCropping
                            ? 'bg-[#0088ff] text-white border-[#0077e6]'
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

            {/* Main Floating Toolbar Pill matching Raylight exact layout */}
            <div className="relative flex items-center gap-1 px-1.5 py-1 rounded-xl bg-[#161619]/95 backdrop-blur-xl border border-white/[0.08] shadow-2xl text-xs">
                {/* 1. Pointer Tool Dropdown (Select V, Hand H, Orbit ⇧F, Tilt Y, Move G, Scissors C) */}
                <div className="relative flex items-center">
                    <button
                        type="button"
                        onClick={() => setActiveTool('select')}
                        aria-label="Select Tool (V) - Plane-aware move"
                        title="Select Tool (V) - Plane-aware move"
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors duration-100 cursor-pointer focus-visible:outline-none ${isPointerActive
                                ? 'bg-[#0088ff] text-white shadow-sm'
                                : 'text-[#a1a1aa] hover:text-white hover:bg-white/5'
                            }`}
                    >
                        {activeTool === 'move' ? (
                            <Move className="w-3.5 h-3.5" />
                        ) : activeTool === 'hand' ? (
                            <Hand className="w-3.5 h-3.5" />
                        ) : activeTool === 'camera' ? (
                            <Camera className="w-3.5 h-3.5" />
                        ) : activeTool === 'tilt' ? (
                            <Rotate3d className="w-3.5 h-3.5" />
                        ) : (
                            <MousePointer className="w-3.5 h-3.5 fill-current" />
                        )}
                    </button>
                    <button
                        type="button"
                        aria-label="Pointer tools"
                        aria-expanded={pointerMenuOpen}
                        onClick={() => {
                            setPointerMenuOpen((v) => !v);
                            setShapeMenuOpen(false);
                            setLightMenuOpen(false);
                            setPresetsMenuOpen(false);
                        }}
                        className="px-1 py-1 text-[#a1a1aa] hover:text-white cursor-pointer rounded"
                    >
                        <ChevronDown className="w-3 h-3" />
                    </button>

                    {pointerMenuOpen && (
                        <div className="absolute bottom-10 left-0 w-44 rounded-xl bg-[#222226] border border-white/10 shadow-2xl p-1 text-xs z-50 divide-y divide-white/[0.06]">
                            <div className="space-y-0.5 pb-1">
                                {[
                                    { id: 'select', label: 'Select', key: 'V', icon: MousePointer },
                                    { id: 'hand', label: 'Hand', key: 'H', icon: Hand },
                                    { id: 'camera', label: 'Orbit', key: '⇧F', icon: Camera },
                                    { id: 'tilt', label: 'Tilt', key: 'Y', icon: Rotate3d },
                                    { id: 'move', label: 'Move', key: 'G', icon: Move },
                                ].map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => {
                                            setActiveTool(item.id as CanvasTool);
                                            setPointerMenuOpen(false);
                                        }}
                                        className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-left cursor-pointer transition ${
                                            activeTool === item.id
                                                ? 'bg-[#0088ff] text-white'
                                                : 'text-[#d4d4d8] hover:bg-white/5'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <item.icon className="w-3.5 h-3.5 opacity-80" />
                                            <span>{item.label}</span>
                                        </div>
                                        <span className="text-[10px] font-mono opacity-60">{item.key}</span>
                                    </button>
                                ))}
                            </div>
                            <div className="pt-1">
                                <button
                                    type="button"
                                    onClick={handleSplitShot}
                                    className="w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-left cursor-pointer text-[#d4d4d8] hover:bg-white/5 transition"
                                >
                                    <div className="flex items-center gap-2 text-amber-300">
                                        <Scissors className="w-3.5 h-3.5" />
                                        <span>Scissors (Split)</span>
                                    </div>
                                    <span className="text-[10px] font-mono opacity-60">C</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* 2. Animate Tool (Spline Curve Icon) */}
                <button
                    type="button"
                    onClick={handleToggleAnimate}
                    aria-label="Animate Mode (Shift+A)"
                    title="Animate (Shift+A) - Toggle motion recording mode"
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors duration-100 cursor-pointer ${isAnimateMode
                            ? 'bg-[#0088ff] text-white shadow-sm ring-1 ring-[#0088ff]/40'
                            : 'text-[#a1a1aa] hover:text-white hover:bg-white/5'
                        }`}
                >
                    <Spline className="w-3.5 h-3.5" />
                </button>

                {/* 3. Shape Dropdown (Rectangle, Ellipse, Polygon, Line, Arrow, Image, Audio) */}
                <div className="relative flex items-center">
                    <button
                        type="button"
                        onClick={() =>
                            setActiveTool(
                                activeTool === 'rectangle' || activeTool === 'line' || activeTool === 'arrow' || activeTool === 'polygon'
                                    ? activeTool
                                    : 'rectangle'
                            )
                        }
                        aria-label="Shape Tool"
                        title="Shape Tool (R / O / L / P)"
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors duration-100 cursor-pointer ${isShapeActive
                                ? 'bg-[#0088ff] text-white shadow-sm'
                                : 'text-[#a1a1aa] hover:text-white hover:bg-white/5'
                            }`}
                    >
                        {activeTool === 'ellipse' ? (
                            <Circle className="w-3.5 h-3.5" />
                        ) : activeTool === 'line' ? (
                            <Minus className="w-3.5 h-3.5" />
                        ) : activeTool === 'arrow' ? (
                            <ArrowRight className="w-3.5 h-3.5" />
                        ) : activeTool === 'polygon' ? (
                            <Pentagon className="w-3.5 h-3.5" />
                        ) : activeTool === 'image' ? (
                            <ImageIcon className="w-3.5 h-3.5" />
                        ) : (
                            <Square className="w-3.5 h-3.5" />
                        )}
                    </button>
                    <button
                        type="button"
                        aria-label="Shape options"
                        aria-expanded={shapeMenuOpen}
                        onClick={() => {
                            setShapeMenuOpen((v) => !v);
                            setPointerMenuOpen(false);
                            setLightMenuOpen(false);
                            setPresetsMenuOpen(false);
                        }}
                        className="px-1 py-1 text-[#a1a1aa] hover:text-white cursor-pointer rounded"
                    >
                        <ChevronDown className="w-3 h-3" />
                    </button>

                    {shapeMenuOpen && (
                        <div className="absolute bottom-10 left-0 w-44 rounded-xl bg-[#222226] border border-white/10 shadow-2xl p-1 text-xs z-50 divide-y divide-white/[0.06]">
                            <div className="space-y-0.5 pb-1">
                                {[
                                    { id: 'rectangle', label: 'Rectangle', key: 'R', icon: Square },
                                    { id: 'ellipse', label: 'Ellipse', key: 'O', icon: Circle },
                                    { id: 'polygon', label: 'Polygon', key: 'P', icon: Pentagon },
                                    { id: 'line', label: 'Line', key: 'L', icon: Minus },
                                    { id: 'arrow', label: 'Arrow', key: 'A', icon: ArrowRight },
                                ].map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => {
                                            setActiveTool(item.id as CanvasTool);
                                            setShapeMenuOpen(false);
                                        }}
                                        className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-left cursor-pointer transition ${
                                            activeTool === item.id
                                                ? 'bg-[#0088ff] text-white'
                                                : 'text-[#d4d4d8] hover:bg-white/5'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <item.icon className="w-3.5 h-3.5 opacity-80" />
                                            <span>{item.label}</span>
                                        </div>
                                        <span className="text-[10px] font-mono opacity-60">{item.key}</span>
                                    </button>
                                ))}
                            </div>
                            <div className="space-y-0.5 pt-1">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setActiveTool('image');
                                        setShapeMenuOpen(false);
                                    }}
                                    className="w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-left cursor-pointer text-[#d4d4d8] hover:bg-white/5 transition"
                                >
                                    <div className="flex items-center gap-2">
                                        <ImageIcon className="w-3.5 h-3.5 opacity-80" />
                                        <span>Image or video</span>
                                    </div>
                                    <span className="text-[10px] font-mono opacity-60">I</span>
                                </button>
                                {onSelectAudioClick && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onSelectAudioClick();
                                            setShapeMenuOpen(false);
                                        }}
                                        className="w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-left cursor-pointer text-[#d4d4d8] hover:bg-white/5 transition"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Volume2 className="w-3.5 h-3.5 opacity-80" />
                                            <span>Audio</span>
                                        </div>
                                        <span className="text-[10px] font-mono opacity-60">⇧I</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* 4. Text Tool (T) */}
                <button
                    type="button"
                    onClick={() => setActiveTool('text')}
                    aria-label="Text Tool (T)"
                    title="Text Tool (T) - Click or drag on canvas"
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors duration-100 cursor-pointer ${activeTool === 'text'
                            ? 'bg-[#0088ff] text-white shadow-sm'
                            : 'text-[#a1a1aa] hover:text-white hover:bg-white/5'
                        }`}
                >
                    <Type className="w-3.5 h-3.5" />
                </button>

                {/* 5. Pen Tool (Pen) */}
                <button
                    type="button"
                    onClick={() => setActiveTool('pen')}
                    aria-label="Pen Tool - Vector path creator"
                    title="Pen Tool - Vector path and bezier mask creator"
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors duration-100 cursor-pointer ${activeTool === 'pen'
                            ? 'bg-[#0088ff] text-white shadow-sm'
                            : 'text-[#a1a1aa] hover:text-white hover:bg-white/5'
                        }`}
                >
                    <Pen className="w-3.5 h-3.5" />
                </button>

                {/* 6. Effects Tool (Sparkles) */}
                <button
                    type="button"
                    onClick={onOpenSceneEffects}
                    aria-label="Scene Effects"
                    title="Scene Post-Processing Effects (Depth of Field, Bloom, Grain)"
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-[#a1a1aa] hover:text-white hover:bg-white/5 transition cursor-pointer"
                >
                    <Sparkles className="w-3.5 h-3.5" />
                </button>

                {/* 7. Light Dropdown (Spot, Point, Area, Sun) */}
                <div className="relative flex items-center">
                    <button
                        type="button"
                        onClick={onToggleLightRig}
                        aria-label="Lighting Rig"
                        title="Scene Lighting Rig & Reflections"
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-[#a1a1aa] hover:text-white hover:bg-white/5 transition cursor-pointer"
                    >
                        <Sun className="w-3.5 h-3.5" />
                    </button>
                    <button
                        type="button"
                        aria-label="Lighting options"
                        aria-expanded={lightMenuOpen}
                        onClick={() => {
                            setLightMenuOpen((v) => !v);
                            setPointerMenuOpen(false);
                            setShapeMenuOpen(false);
                            setPresetsMenuOpen(false);
                        }}
                        className="px-1 py-1 text-[#a1a1aa] hover:text-white cursor-pointer rounded"
                    >
                        <ChevronDown className="w-3 h-3" />
                    </button>

                    {lightMenuOpen && (
                        <div className="absolute bottom-10 left-0 w-44 rounded-xl bg-[#222226] border border-white/10 shadow-2xl p-1 text-xs z-50 space-y-0.5">
                            {[
                                { id: 'spot', label: 'Spot', key: 'B', desc: 'Focused cone light' },
                                { id: 'point', label: 'Point', key: '', desc: 'Omnidirectional source' },
                                { id: 'area', label: 'Area', key: '', desc: 'Rectangular studio softbox' },
                                { id: 'sun', label: 'Sun', key: '', desc: 'Global directional key light' },
                            ].map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => {
                                        if (onToggleLightRig) onToggleLightRig();
                                        setLightMenuOpen(false);
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
                        </div>
                    )}
                </div>

                {/* 8. Presets Tool (△○✕□ Shapes) */}
                <div className="relative flex items-center">
                    <button
                        type="button"
                        onClick={() => {
                            setPresetsMenuOpen((v) => !v);
                            setPointerMenuOpen(false);
                            setShapeMenuOpen(false);
                            setLightMenuOpen(false);
                        }}
                        aria-label="Motion Presets"
                        title="Presets (△○✕□) - Instant motion presets: Float, Wobble, Tilt, Camera Shake, Glitch In, Zoom"
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition cursor-pointer ${presetsMenuOpen
                                ? 'bg-[#0088ff] text-white shadow-sm'
                                : 'text-[#a1a1aa] hover:text-white hover:bg-white/5'
                            }`}
                    >
                        <Shapes className="w-3.5 h-3.5" />
                    </button>

                    {presetsMenuOpen && (
                        <div className="absolute bottom-10 left-0 w-48 rounded-xl bg-[#222226] border border-white/10 shadow-2xl p-1 text-xs z-50 space-y-0.5">
                            <div className="px-2.5 py-1 text-[10px] font-semibold text-[#71717a] uppercase tracking-wider">
                                Instant Presets
                            </div>
                            {[
                                { name: 'Float', desc: 'Gentle floating hover bobbing' },
                                { name: 'Wobble', desc: '3D rotation wobble oscillation' },
                                { name: '3D Parallax Tilt', desc: 'Dynamic 3D perspective sweep' },
                                { name: 'Camera Shake', desc: 'Cinematic handheld camera pulse' },
                                { name: 'Glitch In', desc: 'Cybernetic glitch entrance' },
                                { name: 'Smooth Zoom', desc: 'Cinematic smooth zoom punch' },
                            ].map((preset) => (
                                <button
                                    key={preset.name}
                                    type="button"
                                    onClick={() => handleApplyPreset(preset.name)}
                                    className="w-full px-2.5 py-1.5 rounded-lg flex flex-col text-left cursor-pointer text-[#d4d4d8] hover:bg-white/5 hover:text-white transition"
                                >
                                    <span className="font-medium text-white text-[11px]">{preset.name}</span>
                                    <span className="text-[10px] text-[#71717a] truncate">{preset.desc}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* 9. Divider */}
                <div className="w-px h-5 bg-white/10 mx-0.5" />

                {/* 10. Play / Pause Button */}
                <button
                    type="button"
                    onClick={togglePlay}
                    aria-label={isPlaying ? 'Pause preview (Space)' : 'Play preview (Space)'}
                    title="Play / Pause Preview (Space)"
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-[#d4d4d8] hover:text-white hover:bg-white/10 transition cursor-pointer"
                >
                    {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                </button>

                {/* 11. Audio Waveform Button */}
                <button
                    type="button"
                    onClick={onSelectAudioClick}
                    aria-label="Audio Waveform & Sound Stems"
                    title="Audio Tracks & Sound FX Library"
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-[#a1a1aa] hover:text-white hover:bg-white/10 transition cursor-pointer"
                >
                    <AudioWaveform className="w-3.5 h-3.5" />
                </button>

                {/* 12. Upgrade CTA Pill */}
                <button
                    type="button"
                    onClick={() => showToast('Upgrade to Pro: 4K 60fps exports & premium mockups')}
                    className="ml-0.5 px-2.5 py-1 rounded-lg bg-gradient-to-r from-[#0088ff] to-[#6366f1] text-white text-[11px] font-semibold hover:brightness-110 shadow-sm transition cursor-pointer flex items-center gap-1"
                >
                    <span>Upgrade</span>
                </button>
            </div>
        </div>
    );
};