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
    Tag,
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
    Grid3X3,
    HelpCircle,
} from 'lucide-react';
import type { Layer } from '../model/types';
import { useSelectionStore, type CanvasTool } from '../store/useSelectionStore';
import { usePlayheadStore } from '../store/usePlayheadStore';

interface CanvasToolbarProps {
    selectedLayer: Layer | undefined;
    onOpenSceneEffects?: () => void;
    onToggleLightRig?: () => void;
    showSafeArea?: boolean;
    onToggleSafeArea?: () => void;
    onOpenShortcuts?: () => void;
}

export const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
    selectedLayer,
    onOpenSceneEffects,
    onToggleLightRig,
    showSafeArea = false,
    onToggleSafeArea,
    onOpenShortcuts,
}) => {
    const {
        activeTool,
        isAnimateMode,
        isCropping,
        setActiveTool,
        toggleAnimateMode,
        setIsCropping,
    } = useSelectionStore();

    const { isPlaying, togglePlay } = usePlayheadStore();

    const [pointerMenuOpen, setPointerMenuOpen] = useState(false);
    const [shapeMenuOpen, setShapeMenuOpen] = useState(false);

    const isPointerActive =
        activeTool === 'select' || activeTool === 'move' || activeTool === 'hand';
    const isShapeActive =
        activeTool === 'ellipse' ||
        activeTool === 'rectangle' ||
        activeTool === 'line' || activeTool === 'arrow' || activeTool === 'polygon';

    return (
        <div
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-2.5 select-none"
        >
            {/* Floating Crop Pill (Shown above toolbar when an Image or Video layer is selected) */}
            {(selectedLayer?.kind === 'image' || selectedLayer?.kind === 'video') && (
                <button
                    onClick={() => setIsCropping(!isCropping)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border shadow-xl cursor-pointer transition ${isCropping
                            ? 'bg-[#0088ff] text-white border-[#38bdf8]'
                            : 'bg-[#18181b]/95 hover:bg-[#222226] text-[#e4e4e7] border-white/10'
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

            {/* Main Floating Toolbar Pill */}
            <div className="relative flex items-center gap-1 px-1.5 py-1 rounded-xl bg-[#161619]/95 backdrop-blur-xl border border-white/[0.08] shadow-2xl">
                {/* 1. Select / Move / Hand Tool + Chevron */}
                <div className="relative flex items-center">
                    <button
                        type="button"
                        onClick={() => setActiveTool('select')}
                        aria-label="Select Tool (V) - Plane-aware move"
                        title="Select Tool (V) - Plane-aware move"
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#0088ff] ${isPointerActive
                                ? 'bg-[#0088ff] text-white shadow-sm'
                                : 'text-[#a1a1aa] hover:text-white hover:bg-white/5'
                            }`}
                    >
                        {activeTool === 'move' ? (
                            <Move className="w-3.5 h-3.5" />
                        ) : activeTool === 'hand' ? (
                            <Hand className="w-3.5 h-3.5" />
                        ) : (
                            <MousePointer className="w-3.5 h-3.5 fill-current" />
                        )}
                    </button>
                    <button
                        type="button"
                        aria-label="Selection tool options"
                        aria-haspopup="menu"
                        aria-expanded={pointerMenuOpen}
                        onClick={() => {
                            setPointerMenuOpen((v) => !v);
                            setShapeMenuOpen(false);
                        }}
                        className="px-1.5 py-1 text-[#a1a1aa] hover:text-white cursor-pointer rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#0088ff]"
                    >
                        <ChevronDown className="w-3 h-3" />
                    </button>

                    {pointerMenuOpen && (
                        <div className="absolute bottom-10 left-0 w-44 rounded-xl bg-[#18181b] border border-white/10 shadow-2xl p-1 text-xs z-50">
                            {(
                                [
                                    { id: 'select', label: 'Select (3D Plane)', key: 'V' },
                                    { id: 'move', label: 'Move (Screen Space)', key: 'G' },
                                    { id: 'hand', label: 'Hand Tool (Pan)', key: 'H' },
                                ] as { id: CanvasTool; label: string; key: string }[]
                            ).map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => {
                                        setActiveTool(item.id);
                                        setPointerMenuOpen(false);
                                    }}
                                    className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-left cursor-pointer ${activeTool === item.id
                                            ? 'bg-[#0088ff] text-white'
                                            : 'text-[#d4d4d8] hover:bg-white/5'
                                        }`}
                                >
                                    <span>{item.label}</span>
                                    <span className="text-[10px] font-mono opacity-60">
                                        {item.key}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* 2. 3D Tilt Tool (Y) */}
                <button
                    type="button"
                    onClick={() => setActiveTool('tilt')}
                    aria-label="3D Tilt Tool (Y) - Drag a layer to angle it in 3D"
                    title="3D Tilt Tool (Y) - Drag a layer to angle it in 3D"
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#0088ff] ${activeTool === 'tilt'
                            ? 'bg-[#0088ff] text-white'
                            : 'text-[#a1a1aa] hover:text-white hover:bg-white/5'
                        }`}
                >
                    <Rotate3d className="w-3.5 h-3.5" />
                </button>

                {/* 3. Shape Tool (Circle / Rectangle / Line) + Chevron */}
                <div className="relative flex items-center">
                    <button
                        type="button"
                        onClick={() =>
                            setActiveTool(
                                activeTool === 'rectangle' || activeTool === 'line' || activeTool === 'arrow' || activeTool === 'polygon'
                                    ? activeTool
                                    : 'ellipse'
                            )
                        }
                        aria-label="Shape Tool (O / R / L)"
                        title="Shape Tool (O / R / L)"
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#0088ff] ${isShapeActive
                                ? 'bg-[#0088ff] text-white'
                                : 'text-[#a1a1aa] hover:text-white hover:bg-white/5'
                            }`}
                    >
                        {activeTool === 'rectangle' ? <Square className="w-3.5 h-3.5" /> : activeTool === 'line' ? <Minus className="w-3.5 h-3.5" /> : activeTool === 'arrow' ? <ArrowRight className="w-3.5 h-3.5" /> : activeTool === 'polygon' ? <Pentagon className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                    </button>
                    <button
                        type="button"
                        aria-label="Shape tool options"
                        aria-haspopup="menu"
                        aria-expanded={shapeMenuOpen}
                        onClick={() => {
                            setShapeMenuOpen((v) => !v);
                            setPointerMenuOpen(false);
                        }}
                        className="px-1.5 py-1 text-[#a1a1aa] hover:text-white cursor-pointer rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#0088ff]"
                    >
                        <ChevronDown className="w-3 h-3" />
                    </button>

                    {shapeMenuOpen && (
                        <div className="absolute bottom-10 left-0 w-40 rounded-xl bg-[#18181b] border border-white/10 shadow-2xl p-1 text-xs z-50">
                            {(
                                [
                                    { id: 'ellipse', label: 'Oval / Ellipse', key: 'O' },
                                    { id: 'rectangle', label: 'Rectangle', key: 'R' },
                                    { id: 'line', label: 'Line', key: 'L' },
                                    { id: 'arrow', label: 'Arrow', key: 'A' },
                                    { id: 'polygon', label: 'Polygon', key: 'P' },
                                ] as { id: CanvasTool; label: string; key: string }[]
                            ).map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => {
                                        setActiveTool(item.id);
                                        setShapeMenuOpen(false);
                                    }}
                                    className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-left cursor-pointer ${activeTool === item.id
                                            ? 'bg-[#0088ff] text-white'
                                            : 'text-[#d4d4d8] hover:bg-white/5'
                                        }`}
                                >
                                    <span>{item.label}</span>
                                    <span className="text-[10px] font-mono opacity-60">
                                        {item.key}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Pen tool (P) for drawing editable vector paths */}
                <button
                    type="button"
                    onClick={() => setActiveTool('pen')}
                    aria-label="Pen Tool - create editable vector paths"
                    title="Pen Tool - create editable vector paths"
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#0088ff] ${activeTool === 'pen' ? 'bg-[#0088ff] text-white' : 'text-[#a1a1aa] hover:text-white hover:bg-white/5'}`}
                >
                    <Pen className="w-3.5 h-3.5" />
                </button>

                {/* 4. Text Tool (T) */}
                <button
                    type="button"
                    onClick={() => setActiveTool('text')}
                    aria-label="Text Tool (T) - Click or drag on canvas"
                    title="Text Tool (T) - Click or drag on canvas"
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#0088ff] ${activeTool === 'text'
                            ? 'bg-[#0088ff] text-white'
                            : 'text-[#a1a1aa] hover:text-white hover:bg-white/5'
                        }`}
                >
                    <Type className="w-3.5 h-3.5" />
                </button>

                {/* 5. Image / Media Placement Tool (I) */}
                <button
                    type="button"
                    onClick={() => setActiveTool('image')}
                    aria-label="Place Image or Card Frame (I)"
                    title="Place Image / Card Frame (I)"
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#0088ff] ${activeTool === 'image'
                            ? 'bg-[#0088ff] text-white'
                            : 'text-[#a1a1aa] hover:text-white hover:bg-white/5'
                        }`}
                >
                    <Tag className="w-3.5 h-3.5" />
                </button>

                {/* 6. Scene Key Light Button */}
                <button
                    type="button"
                    onClick={onToggleLightRig}
                    aria-label="Scene Key Light and Reflections"
                    title="Scene Key Light & Reflections"
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-[#a1a1aa] hover:text-white hover:bg-white/5 transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#0088ff]"
                >
                    <Sun className="w-3.5 h-3.5" />
                </button>

                {/* 7. Scene Effects Button */}
                <button
                    type="button"
                    onClick={onOpenSceneEffects}
                    aria-label="Scene Post-Processing Effects"
                    title="Scene Post-Processing Effects (Depth of Field, Bloom, Grain)"
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-[#a1a1aa] hover:text-white hover:bg-white/5 transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#0088ff]"
                >
                    <Sparkles className="w-3.5 h-3.5" />
                </button>

                {/* 8. Safe Zones & Rule of Thirds Grid Toggle */}
                {onToggleSafeArea && (
                    <button
                        type="button"
                        onClick={onToggleSafeArea}
                        aria-label="Toggle Safe Zones & Rule of Thirds Grid ( ' )"
                        title="Toggle Safe Zones & Rule of Thirds Grid ( ' )"
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#0088ff] ${
                            showSafeArea
                                ? 'bg-[#0088ff] text-white shadow-sm'
                                : 'text-[#a1a1aa] hover:text-white hover:bg-white/5'
                        }`}
                    >
                        <Grid3X3 className="w-3.5 h-3.5" />
                    </button>
                )}

                {/* 9. Keyboard Shortcuts Guide */}
                {onOpenShortcuts && (
                    <button
                        type="button"
                        onClick={onOpenShortcuts}
                        aria-label="Keyboard Shortcuts & Hotkeys Guide ( ? )"
                        title="Keyboard Shortcuts & Hotkeys Guide ( ? )"
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-[#a1a1aa] hover:text-white hover:bg-white/5 transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#0088ff]"
                    >
                        <HelpCircle className="w-3.5 h-3.5" />
                    </button>
                )}

                {/* 10. Right Sub-Pill: [Play | Waveform Animate Mode (Shift+A)] */}
                <div className="ml-1 pl-1 bg-[#232329] rounded-lg p-0.5 flex items-center gap-0.5 border border-white/[0.06]">
                    <button
                        type="button"
                        onClick={togglePlay}
                        aria-label={isPlaying ? "Pause playback (Space)" : "Play preview (Space)"}
                        title="Play / Pause Preview (Space)"
                        className="w-7 h-6 rounded-md flex items-center justify-center text-[#d4d4d8] hover:text-white hover:bg-white/10 transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#0088ff]"
                    >
                        {isPlaying ? (
                            <Pause className="w-3 h-3" />
                        ) : (
                            <Play className="w-3 h-3" />
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={toggleAnimateMode}
                        aria-label="Animate Tool - Toggle motion recording mode (Shift + A)"
                        title="Animate Tool (Shift + A): Turn on to record canvas edits as motion blocks ending at the playhead"
                        className={`w-7 h-6 rounded-md flex items-center justify-center transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#0088ff] ${isAnimateMode
                                ? 'bg-[#0088ff] text-white shadow-sm'
                                : 'text-[#a1a1aa] hover:text-white hover:bg-white/10'
                            }`}
                    >
                        <AudioWaveform className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        </div>
    );
};