// src/panels/Inspector/BlockInspector.tsx
import React, { useRef, useCallback } from 'react';
import {
    Film,
    Sliders,
    Plus,
    Trash2,
    Move3d,
    Sparkles,
    Type,
    Square,
    Image as ImageIcon,
    Activity,
    Layers,
} from 'lucide-react';
import type {
    Shot,
    Layer,
    AnimationBlock,
    AnimationBlockProperty,
    Easing,
    Vec3,
} from '../../model/types';
import { radToDeg, degToRad } from '../../model/defaults';
import { useProjectStore } from '../../store/useProjectStore';
import { useSelectionStore } from '../../store/useSelectionStore';
import { ScrubInput } from '../../ui/ScrubInput';

interface BlockInspectorProps {
    activeShot: Shot;
    selectedLayer?: Layer;
}

// Preset curves for instant 1-click selection in the Bezier editor
const BEZIER_PRESETS: { name: string; x1: number; y1: number; x2: number; y2: number }[] = [
    { name: 'Expo Out', x1: 0.16, y1: 1, x2: 0.3, y2: 1 },
    { name: 'Snappy', x1: 0.2, y1: 0.9, x2: 0.3, y2: 1 },
    { name: 'Anticipate', x1: 0.34, y1: 1.56, x2: 0.64, y2: 1 },
    { name: 'Smooth Ease', x1: 0.42, y1: 0, x2: 0.58, y2: 1 },
];

export const BlockInspector: React.FC<BlockInspectorProps> = ({
    activeShot,
    selectedLayer,
}) => {
    const { updateLayer } = useProjectStore();
    const { selectedBlockId, selectBlock } = useSelectionStore();
    const svgRef = useRef<SVGSVGElement | null>(null);
    const draggingHandleRef = useRef<'p1' | 'p2' | null>(null);

    // If activeBlockId doesn't match any block on selectedLayer, fallback to first block if any
    const activeBlock =
        selectedLayer?.blocks.find((b) => b.id === selectedBlockId) ||
        (selectedLayer?.blocks.length ? selectedLayer.blocks[0] : undefined);

    // Helper: Add a new block to current layer
    const handleAddBlock = (presetProperty: AnimationBlockProperty = 'position') => {
        if (!selectedLayer) return;
        const newId = `block-${Date.now()}`;
        const isRot = presetProperty === 'rotation' || presetProperty === 'tilt';

        let initialAmount: Vec3 | number;
        if (isRot) {
            initialAmount = { x: 0, y: degToRad(15), z: 0 };
        } else if (presetProperty === 'scale') {
            initialAmount = { x: 0.1, y: 0.1, z: 0.1 };
        } else if (presetProperty === 'size') {
            initialAmount = { x: 0.05, y: 0.05, z: 0 };
        } else if (presetProperty === 'opacity') {
            initialAmount = -0.4;
        } else if (presetProperty === 'counter') {
            initialAmount = 100;
        } else if (presetProperty === 'glow') {
            initialAmount = 0.5;
        } else if (presetProperty === 'pathReveal' || presetProperty === 'maskSweep') {
            initialAmount = 1;
        } else {
            initialAmount = { x: 0.15, y: 0, z: 0 };
        }

        const newBlock: AnimationBlock = {
            id: newId,
            label: `${presetProperty.charAt(0).toUpperCase() + presetProperty.slice(1)} Block`,
            property: presetProperty,
            startMs: Math.min(selectedLayer.outMs, selectedLayer.inMs + 200),
            durationMs: Math.max(100, Math.min(1200, selectedLayer.outMs - Math.min(selectedLayer.outMs, selectedLayer.inMs + 200))),
            easing: { kind: 'preset', name: 'ease-out' },
            amount: initialAmount,
        };

        updateLayer(activeShot.id, selectedLayer.id, (layer) => ({
            ...layer,
            blocks: [...layer.blocks, newBlock],
        }));
        selectBlock(newId, selectedLayer.id);
    };

    // Helper: Delete active block
    const handleDeleteBlock = () => {
        if (!selectedLayer || !activeBlock) return;
        const remaining = selectedLayer.blocks.filter((b) => b.id !== activeBlock.id);
        updateLayer(activeShot.id, selectedLayer.id, (layer) => ({
            ...layer,
            blocks: remaining,
        }));
        selectBlock(remaining.length > 0 ? remaining[0].id : null, selectedLayer.id);
    };

    // Helper: Partial update active block
    const handleUpdateBlock = (patch: Partial<AnimationBlock>) => {
        if (!selectedLayer || !activeBlock) return;
        updateLayer(activeShot.id, selectedLayer.id, (layer) => ({
            ...layer,
            blocks: layer.blocks.map((b) =>
                b.id === activeBlock.id ? { ...b, ...patch } : b
            ),
        }));
    };

    // Helper: Change target property safely
    const handlePropertyChange = (newProperty: AnimationBlockProperty) => {
        if (!activeBlock) return;
        const isNewVector =
            newProperty === 'position' ||
            newProperty === 'rotation' ||
            newProperty === 'tilt' ||
            newProperty === 'scale' ||
            newProperty === 'size' ||
            newProperty === 'followPath';

        let nextAmount = activeBlock.amount;
        if (isNewVector) {
            if (typeof activeBlock.amount === 'number') {
                if (newProperty === 'rotation' || newProperty === 'tilt') {
                    nextAmount = { x: 0, y: degToRad(15), z: 0 };
                } else if (newProperty === 'size') {
                    nextAmount = { x: 0.05, y: 0.05, z: 0 };
                } else {
                    nextAmount = { x: activeBlock.amount, y: 0, z: 0 };
                }
            } else if (newProperty === 'rotation' || newProperty === 'tilt') {
                // If switching into rotation/tilt from linear position, provide degrees default
                if (Math.abs(activeBlock.amount.x) < 0.001 && Math.abs(activeBlock.amount.y) < 0.001) {
                    nextAmount = { x: 0, y: degToRad(15), z: 0 };
                }
            }
        } else {
            // New is scalar
            if (typeof activeBlock.amount === 'object') {
                if (newProperty === 'counter') {
                    nextAmount = 100;
                } else if (newProperty === 'opacity') {
                    nextAmount = -0.5;
                } else if (newProperty === 'glow') {
                    nextAmount = 0.5;
                } else {
                    nextAmount = 1;
                }
            }
        }

        handleUpdateBlock({
            property: newProperty,
            amount: nextAmount,
            label: `${newProperty.charAt(0).toUpperCase() + newProperty.slice(1)} Drift`,
        });
    };

    // Helper: Easing update
    const handleUpdateEasing = (easing: Easing) => {
        handleUpdateBlock({ easing });
    };

    // Bezier interactive pointer drag handler
    const handlePointerDown = (handle: 'p1' | 'p2', e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        draggingHandleRef.current = handle;
    };

    const handlePointerMove = useCallback(
        (e: React.PointerEvent) => {
            if (!draggingHandleRef.current || !svgRef.current || !activeBlock) return;
            if (activeBlock.easing.kind !== 'bezier') return;

            const rect = svgRef.current.getBoundingClientRect();
            const relX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            // Invert Y so bottom is 0 and top is 1
            const relY = (rect.bottom - e.clientY) / rect.height;

            const clampedX = Number(relX.toFixed(2));
            const clampedY = Number(Math.max(-0.5, Math.min(1.8, relY)).toFixed(2));

            if (draggingHandleRef.current === 'p1') {
                handleUpdateEasing({
                    kind: 'bezier',
                    x1: clampedX,
                    y1: clampedY,
                    x2: activeBlock.easing.x2,
                    y2: activeBlock.easing.y2,
                });
            } else {
                handleUpdateEasing({
                    kind: 'bezier',
                    x1: activeBlock.easing.x1,
                    y1: activeBlock.easing.y1,
                    x2: clampedX,
                    y2: clampedY,
                });
            }
        },
        [activeBlock]
    );

    const handlePointerUp = (e: React.PointerEvent) => {
        draggingHandleRef.current = null;
        try {
            (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        } catch {
            // Ignore if pointer capture already released
        }
    };

    // If no layer is selected at all
    if (!selectedLayer) {
        return (
            <aside className="w-80 shrink-0 border-l border-white/10 bg-[#0c0e17] p-5 text-xs text-gray-400 select-none flex flex-col items-center justify-center text-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400">
                    <Layers className="w-5 h-5" />
                </div>
                <div className="font-semibold text-gray-200">No Layer Selected</div>
                <p className="text-[11px] text-gray-400 leading-relaxed max-w-[220px]">
                    Select any layer from the timeline or layer panel to inspect and add relative animation blocks.
                </p>
            </aside>
        );
    }

    // Layer Icon helper
    const LayerIcon =
        selectedLayer.kind === 'text'
            ? Type
            : selectedLayer.kind === 'shape'
                ? Square
                : ImageIcon;

    return (
        <aside className="w-80 shrink-0 overflow-y-auto border-l border-white/10 bg-[#0c0e17] p-4 flex flex-col gap-4 text-xs select-none flex-1 min-h-0">
            {/* Layer Context Bar */}
            <div className="rounded-xl border border-white/10 bg-black/40 p-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded bg-fuchsia-500/15 border border-fuchsia-500/30 flex items-center justify-center text-fuchsia-300 shrink-0">
                        <LayerIcon className="w-3.5 h-3.5" />
                    </div>
                    <div className="truncate">
                        <div className="font-semibold text-white text-[11px] truncate">
                            {selectedLayer.name}
                        </div>
                        <div className="text-[9px] text-gray-400">
                            {selectedLayer.blocks.length} Animation{' '}
                            {selectedLayer.blocks.length === 1 ? 'Block' : 'Blocks'}
                        </div>
                    </div>
                </div>
                <button
                    onClick={() => handleAddBlock('position')}
                    className="px-2.5 py-1 rounded-md bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-medium text-[10px] flex items-center gap-1 shadow transition"
                    title="Add Animation Block to this layer"
                >
                    <Plus className="w-3 h-3" /> Add Block
                </button>
            </div>

            {/* Block Carousel / Tabs if layer has multiple blocks */}
            {selectedLayer.blocks.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    {selectedLayer.blocks.map((block, idx) => {
                        const isActive = block.id === activeBlock?.id;
                        return (
                            <button
                                key={block.id}
                                onClick={() => selectBlock(block.id, selectedLayer.id)}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition shrink-0 border flex items-center gap-1.5 ${
                                    isActive
                                        ? 'bg-fuchsia-500/20 border-fuchsia-500 text-fuchsia-200 shadow-sm'
                                        : 'bg-white/[0.03] border-white/10 text-gray-400 hover:text-white hover:bg-white/[0.06]'
                                }`}
                            >
                                <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-400" />
                                <span className="truncate max-w-[90px]">
                                    {block.label || `Block ${idx + 1}`}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Empty State when layer has NO blocks */}
            {selectedLayer.blocks.length === 0 && (
                <div className="rounded-xl border border-dashed border-white/15 bg-black/30 p-5 flex flex-col items-center justify-center text-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/20 flex items-center justify-center text-fuchsia-400">
                        <Film className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="font-semibold text-gray-200 text-xs">
                            No Animation Blocks
                        </div>
                        <p className="text-[10px] text-gray-400 leading-relaxed mt-1 max-w-[210px]">
                            Animate 3D position drift, rotation swing, scale pulse, metric counter, or path reveal.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 w-full mt-1">
                        <button
                            onClick={() => handleAddBlock('position')}
                            className="px-2 py-1.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 text-[10px] flex items-center justify-center gap-1 transition"
                        >
                            <Move3d className="w-3 h-3 text-cyan-400" /> + Position
                        </button>
                        <button
                            onClick={() => handleAddBlock('tilt')}
                            className="px-2 py-1.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 text-[10px] flex items-center justify-center gap-1 transition"
                        >
                            <Activity className="w-3 h-3 text-fuchsia-400" /> + 3D Tilt
                        </button>
                        <button
                            onClick={() => handleAddBlock('scale')}
                            className="px-2 py-1.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 text-[10px] flex items-center justify-center gap-1 transition"
                        >
                            <Sparkles className="w-3 h-3 text-amber-400" /> + Scale
                        </button>
                        <button
                            onClick={() => handleAddBlock('counter')}
                            className="px-2 py-1.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 text-[10px] flex items-center justify-center gap-1 transition"
                        >
                            <Plus className="w-3 h-3 text-emerald-400" /> + Counter
                        </button>
                    </div>
                </div>
            )}

            {/* Active Block Inspector Controls */}
            {activeBlock && (
                <>
                    {/* Header with Title and Trash / Delete Button */}
                    <div className="flex items-center justify-between text-sm font-semibold text-white pt-1">
                        <div className="flex items-center gap-2 min-w-0">
                            <Film className="h-4 w-4 text-fuchsia-400 shrink-0" />
                            <span className="truncate">{activeBlock.label}</span>
                        </div>
                        <button
                            onClick={handleDeleteBlock}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/20 text-rose-400 hover:text-rose-300 transition shrink-0"
                            title="Delete Animation Block"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {/* Block Label & Target Property */}
                    <div className="rounded-xl border border-white/10 bg-black/40 p-3 space-y-3">
                        <div className="font-semibold text-gray-200 flex items-center gap-1.5">
                            <Sliders className="h-3.5 w-3.5 text-fuchsia-400" />
                            Target Property &amp; Timing
                        </div>

                        <div className="space-y-1">
                            <label className="text-gray-400 text-[10px] uppercase font-mono tracking-wider">
                                Block Label
                            </label>
                            <input
                                type="text"
                                value={activeBlock.label}
                                onChange={(e) => handleUpdateBlock({ label: e.target.value })}
                                className="w-full px-2.5 py-1.5 rounded bg-black/60 border border-white/15 text-white outline-none focus:border-fuchsia-500 text-xs"
                            />
                        </div>

                        {/* Property Dropdown Selector */}
                        <div className="space-y-1">
                            <label className="text-gray-400 text-[10px] uppercase font-mono tracking-wider">
                                Target Property
                            </label>
                            <select
                                value={activeBlock.property}
                                onChange={(e) =>
                                    handlePropertyChange(e.target.value as AnimationBlockProperty)
                                }
                                className="w-full rounded border border-white/15 bg-[#11131c] px-2.5 py-1.5 text-white text-xs outline-none cursor-pointer focus:border-fuchsia-500 font-medium"
                            >
                                <optgroup label="Transform & Motion" className="bg-[#0c0e17]">
                                    <option value="position">Position (3D Translation)</option>
                                    <option value="rotation">Rotation (3D Angles)</option>
                                    <option value="tilt">Tilt (3D Perspective)</option>
                                    <option value="scale">Scale (Size & Depth)</option>
                                    <option value="followPath">Follow Curved Path</option>
                                </optgroup>
                                <optgroup label="Styling & Appearance" className="bg-[#0c0e17]">
                                    <option value="opacity">Opacity (Fade)</option>
                                    <option value="size">Size (Width & Height)</option>
                                    <option value="glow">Glow Intensity</option>
                                </optgroup>
                                <optgroup label="Reveals & Effects" className="bg-[#0c0e17]">
                                    <option value="maskSweep">Mask Sweep (Wipe)</option>
                                    <option value="pathReveal">Path Reveal (Stroke Draw)</option>
                                    <option value="shimmer">Shimmer (Light Sweep)</option>
                                    <option value="counter">Counter (Numeric Increment)</option>
                                </optgroup>
                            </select>
                        </div>

                        <ScrubInput
                            label="Start Time"
                            value={activeBlock.startMs}
                            min={0}
                            max={Math.max(100, activeShot.durationMs - 200)}
                            step={50}
                            unit="ms"
                            decimals={0}
                            onChange={(startMs) => handleUpdateBlock({ startMs })}
                        />

                        <ScrubInput
                            label="Duration"
                            value={activeBlock.durationMs}
                            min={100}
                            max={10000}
                            step={50}
                            unit="ms"
                            decimals={0}
                            onChange={(durationMs) => handleUpdateBlock({ durationMs })}
                        />
                    </div>

                    {/* Easing Selector & Cubic-Bezier Graph */}
                    <div className="rounded-xl border border-white/10 bg-black/40 p-3 space-y-3">
                        <div className="font-semibold text-gray-200 flex items-center justify-between">
                            <span>Animation Feel (Easing)</span>
                            {activeBlock.easing.kind === 'bezier' && (
                                <span className="text-[10px] font-mono text-fuchsia-400">
                                    Cubic-Bezier
                                </span>
                            )}
                        </div>

                        <select
                            value={
                                activeBlock.easing.kind === 'bezier'
                                    ? 'bezier'
                                    : `${activeBlock.easing.kind}:${activeBlock.easing.name}`
                            }
                            onChange={(e) => {
                                const val = e.target.value;
                                if (val === 'bezier') {
                                    handleUpdateEasing({
                                        kind: 'bezier',
                                        x1: 0.16,
                                        y1: 1,
                                        x2: 0.3,
                                        y2: 1,
                                    });
                                } else if (val.startsWith('spring:')) {
                                    handleUpdateEasing({
                                        kind: 'spring',
                                        name: val.split(':')[1] as any,
                                    });
                                } else {
                                    handleUpdateEasing({
                                        kind: 'preset',
                                        name: val.split(':')[1] as any,
                                    });
                                }
                            }}
                            className="w-full rounded border border-white/15 bg-[#11131c] px-2.5 py-1.5 text-white outline-none cursor-pointer text-xs focus:border-fuchsia-500"
                        >
                            <optgroup label="Custom Graph" className="bg-[#0c0e17]">
                                <option value="bezier">Custom Cubic-Bezier Graph</option>
                            </optgroup>
                            <optgroup label="Physics Springs" className="bg-[#0c0e17]">
                                <option value="spring:gentle">Spring: Gentle</option>
                                <option value="spring:quick">Spring: Quick</option>
                                <option value="spring:bouncy">Spring: Bouncy</option>
                                <option value="spring:slow">Spring: Slow</option>
                            </optgroup>
                            <optgroup label="Standard Presets" className="bg-[#0c0e17]">
                                <option value="preset:ease-out">Ease Out</option>
                                <option value="preset:ease-in-out">Ease In-Out</option>
                                <option value="preset:ease-out-expo">Ease Out Expo</option>
                                <option value="preset:ease-out-back">Ease Out Back</option>
                                <option value="preset:bounce">Bounce</option>
                                <option value="preset:linear">Linear</option>
                                <option value="preset:hold">Hold Step</option>
                            </optgroup>
                        </select>

                        {/* Interactive Cubic-Bezier Editor when bezier is selected */}
                        {activeBlock.easing.kind === 'bezier' && (
                            <div className="space-y-2.5 pt-1">
                                {/* SVG Interactive Curve Canvas */}
                                <div className="rounded-lg bg-[#070913] border border-white/10 p-2 relative select-none">
                                    <svg
                                        ref={svgRef}
                                        viewBox="0 0 100 100"
                                        className="w-full h-28 overflow-visible cursor-crosshair touch-none"
                                        onPointerMove={handlePointerMove}
                                        onPointerUp={handlePointerUp}
                                    >
                                        <defs>
                                            <linearGradient
                                                id="bezierCurveGrad"
                                                x1="0%"
                                                y1="100%"
                                                x2="100%"
                                                y2="0%"
                                            >
                                                <stop offset="0%" stopColor="#e879f9" />
                                                <stop offset="50%" stopColor="#818cf8" />
                                                <stop offset="100%" stopColor="#22d3ee" />
                                            </linearGradient>
                                        </defs>

                                        {/* Background Grid */}
                                        <line x1="0" y1="25" x2="100" y2="25" stroke="rgba(255,255,255,0.06)" strokeDasharray="2 2" />
                                        <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(255,255,255,0.06)" strokeDasharray="2 2" />
                                        <line x1="0" y1="75" x2="100" y2="75" stroke="rgba(255,255,255,0.06)" strokeDasharray="2 2" />
                                        <line x1="25" y1="0" x2="25" y2="100" stroke="rgba(255,255,255,0.06)" strokeDasharray="2 2" />
                                        <line x1="50" y1="0" x2="50" y2="100" stroke="rgba(255,255,255,0.06)" strokeDasharray="2 2" />
                                        <line x1="75" y1="0" x2="75" y2="100" stroke="rgba(255,255,255,0.06)" strokeDasharray="2 2" />

                                        {/* Diagonal Linear Baseline */}
                                        <line x1="0" y1="100" x2="100" y2="0" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />

                                        {/* Tangent Handle Lines */}
                                        <line
                                            x1="0"
                                            y1="100"
                                            x2={activeBlock.easing.x1 * 100}
                                            y2={(1 - activeBlock.easing.y1) * 100}
                                            stroke="#e879f9"
                                            strokeWidth="1.5"
                                            strokeOpacity="0.75"
                                        />
                                        <line
                                            x1="100"
                                            y1="0"
                                            x2={activeBlock.easing.x2 * 100}
                                            y2={(1 - activeBlock.easing.y2) * 100}
                                            stroke="#22d3ee"
                                            strokeWidth="1.5"
                                            strokeOpacity="0.75"
                                        />

                                        {/* Cubic Bezier Path */}
                                        <path
                                            d={`M 0 100 C ${activeBlock.easing.x1 * 100} ${
                                                (1 - activeBlock.easing.y1) * 100
                                            }, ${activeBlock.easing.x2 * 100} ${
                                                (1 - activeBlock.easing.y2) * 100
                                            }, 100 0`}
                                            fill="none"
                                            stroke="url(#bezierCurveGrad)"
                                            strokeWidth="3"
                                            strokeLinecap="round"
                                        />

                                        {/* Control Handle 1 (P1) */}
                                        <circle
                                            cx={activeBlock.easing.x1 * 100}
                                            cy={(1 - activeBlock.easing.y1) * 100}
                                            r="5.5"
                                            fill="#e879f9"
                                            stroke="#ffffff"
                                            strokeWidth="2"
                                            className="cursor-grab active:cursor-grabbing hover:scale-125 transition-transform"
                                            onPointerDown={(e) => handlePointerDown('p1', e)}
                                        />

                                        {/* Control Handle 2 (P2) */}
                                        <circle
                                            cx={activeBlock.easing.x2 * 100}
                                            cy={(1 - activeBlock.easing.y2) * 100}
                                            r="5.5"
                                            fill="#22d3ee"
                                            stroke="#ffffff"
                                            strokeWidth="2"
                                            className="cursor-grab active:cursor-grabbing hover:scale-125 transition-transform"
                                            onPointerDown={(e) => handlePointerDown('p2', e)}
                                        />
                                    </svg>
                                </div>

                                {/* Preset Curve Buttons */}
                                <div className="grid grid-cols-2 gap-1.5">
                                    {BEZIER_PRESETS.map((p) => (
                                        <button
                                            key={p.name}
                                            onClick={() =>
                                                handleUpdateEasing({
                                                    kind: 'bezier',
                                                    x1: p.x1,
                                                    y1: p.y1,
                                                    x2: p.x2,
                                                    y2: p.y2,
                                                })
                                            }
                                            className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] text-gray-300 hover:text-white transition"
                                        >
                                            {p.name}
                                        </button>
                                    ))}
                                </div>

                                {/* Numeric Coordinate Controls */}
                                <div className="grid grid-cols-2 gap-2">
                                    <ScrubInput
                                        label="Handle 1 X"
                                        value={activeBlock.easing.x1}
                                        min={0}
                                        max={1}
                                        step={0.01}
                                        decimals={2}
                                        onChange={(x1) =>
                                            handleUpdateEasing({
                                                ...(activeBlock.easing as any),
                                                x1,
                                            })
                                        }
                                    />
                                    <ScrubInput
                                        label="Handle 1 Y"
                                        value={activeBlock.easing.y1}
                                        min={-0.5}
                                        max={1.8}
                                        step={0.01}
                                        decimals={2}
                                        onChange={(y1) =>
                                            handleUpdateEasing({
                                                ...(activeBlock.easing as any),
                                                y1,
                                            })
                                        }
                                    />
                                    <ScrubInput
                                        label="Handle 2 X"
                                        value={activeBlock.easing.x2}
                                        min={0}
                                        max={1}
                                        step={0.01}
                                        decimals={2}
                                        onChange={(x2) =>
                                            handleUpdateEasing({
                                                ...(activeBlock.easing as any),
                                                x2,
                                            })
                                        }
                                    />
                                    <ScrubInput
                                        label="Handle 2 Y"
                                        value={activeBlock.easing.y2}
                                        min={-0.5}
                                        max={1.8}
                                        step={0.01}
                                        decimals={2}
                                        onChange={(y2) =>
                                            handleUpdateEasing({
                                                ...(activeBlock.easing as any),
                                                y2,
                                            })
                                        }
                                    />
                                </div>

                                <div className="text-[10px] font-mono text-gray-400 bg-black/60 px-2 py-1 rounded border border-white/10 truncate">
                                    cubic-bezier({activeBlock.easing.x1},{' '}
                                    {activeBlock.easing.y1}, {activeBlock.easing.x2},{' '}
                                    {activeBlock.easing.y2})
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Relative Delta Amount */}
                    <div className="rounded-xl border border-white/10 bg-black/40 p-3 space-y-3">
                        <div className="font-semibold text-gray-200 flex items-center justify-between">
                            <span>Relative Delta Amount</span>
                            {(activeBlock.property === 'rotation' ||
                                activeBlock.property === 'tilt') && (
                                <span className="text-[10px] font-mono text-cyan-300">
                                    Stored rad · Shown °
                                </span>
                            )}
                        </div>

                        {/* ROTATION & TILT BLOCKS (Stored in Radians, Shown as Degrees) */}
                        {(activeBlock.property === 'rotation' ||
                            activeBlock.property === 'tilt') && (
                            <div className="space-y-2">
                                <ScrubInput
                                    label="Delta Pitch (X)"
                                    value={radToDeg(
                                        typeof activeBlock.amount === 'object'
                                            ? activeBlock.amount.x
                                            : 0
                                    )}
                                    min={-180}
                                    max={180}
                                    step={1}
                                    unit="°"
                                    decimals={0}
                                    onChange={(degX) =>
                                        handleUpdateBlock({
                                            amount: {
                                                ...(typeof activeBlock.amount === 'object'
                                                    ? activeBlock.amount
                                                    : { x: 0, y: 0, z: 0 }),
                                                x: degToRad(degX),
                                            },
                                        })
                                    }
                                />
                                <ScrubInput
                                    label="Delta Yaw (Y)"
                                    value={radToDeg(
                                        typeof activeBlock.amount === 'object'
                                            ? activeBlock.amount.y
                                            : 0
                                    )}
                                    min={-180}
                                    max={180}
                                    step={1}
                                    unit="°"
                                    decimals={0}
                                    onChange={(degY) =>
                                        handleUpdateBlock({
                                            amount: {
                                                ...(typeof activeBlock.amount === 'object'
                                                    ? activeBlock.amount
                                                    : { x: 0, y: 0, z: 0 }),
                                                y: degToRad(degY),
                                            },
                                        })
                                    }
                                />
                                <ScrubInput
                                    label="Delta Roll (Z)"
                                    value={radToDeg(
                                        typeof activeBlock.amount === 'object'
                                            ? activeBlock.amount.z
                                            : 0
                                    )}
                                    min={-180}
                                    max={180}
                                    step={1}
                                    unit="°"
                                    decimals={0}
                                    onChange={(degZ) =>
                                        handleUpdateBlock({
                                            amount: {
                                                ...(typeof activeBlock.amount === 'object'
                                                    ? activeBlock.amount
                                                    : { x: 0, y: 0, z: 0 }),
                                                z: degToRad(degZ),
                                            },
                                        })
                                    }
                                />
                            </div>
                        )}

                        {/* POSITION & FOLLOWPATH BLOCKS */}
                        {(activeBlock.property === 'position' ||
                            activeBlock.property === 'followPath') && (
                            <div className="space-y-2">
                                {activeBlock.property === 'followPath' && (
                                    <div className="text-[10px] text-fuchsia-300/80 bg-fuchsia-500/10 p-2 rounded border border-fuchsia-500/20 leading-relaxed">
                                        Curved path follows an organic arc trajectory offset perpendicular to the motion vector.
                                    </div>
                                )}
                                <ScrubInput
                                    label="Delta X"
                                    value={
                                        typeof activeBlock.amount === 'object'
                                            ? activeBlock.amount.x
                                            : activeBlock.amount
                                    }
                                    min={-1.5}
                                    max={1.5}
                                    step={0.01}
                                    decimals={2}
                                    onChange={(x) =>
                                        handleUpdateBlock({
                                            amount:
                                                typeof activeBlock.amount === 'object'
                                                    ? { ...activeBlock.amount, x }
                                                    : { x, y: 0, z: 0 },
                                        })
                                    }
                                />
                                <ScrubInput
                                    label="Delta Y"
                                    value={
                                        typeof activeBlock.amount === 'object'
                                            ? activeBlock.amount.y
                                            : 0
                                    }
                                    min={-1.5}
                                    max={1.5}
                                    step={0.01}
                                    decimals={2}
                                    onChange={(y) =>
                                        handleUpdateBlock({
                                            amount:
                                                typeof activeBlock.amount === 'object'
                                                    ? { ...activeBlock.amount, y }
                                                    : { x: activeBlock.amount, y, z: 0 },
                                        })
                                    }
                                />
                                <ScrubInput
                                    label="Delta Z"
                                    value={
                                        typeof activeBlock.amount === 'object'
                                            ? activeBlock.amount.z
                                            : 0
                                    }
                                    min={-1.5}
                                    max={1.5}
                                    step={0.02}
                                    decimals={2}
                                    onChange={(z) =>
                                        handleUpdateBlock({
                                            amount:
                                                typeof activeBlock.amount === 'object'
                                                    ? { ...activeBlock.amount, z }
                                                    : { x: activeBlock.amount, y: 0, z },
                                        })
                                    }
                                />
                            </div>
                        )}

                        {/* SCALE BLOCK */}
                        {activeBlock.property === 'scale' && (
                            <div className="space-y-2">
                                {typeof activeBlock.amount === 'number' ? (
                                    <ScrubInput
                                        label="Uniform Delta Scale"
                                        value={activeBlock.amount}
                                        min={-1}
                                        max={2}
                                        step={0.05}
                                        decimals={2}
                                        onChange={(amount) => handleUpdateBlock({ amount })}
                                    />
                                ) : (
                                    <>
                                        <ScrubInput
                                            label="Delta Scale X"
                                            value={activeBlock.amount.x}
                                            min={-1}
                                            max={2}
                                            step={0.05}
                                            decimals={2}
                                            onChange={(x) =>
                                                handleUpdateBlock({
                                                    amount: { ...(activeBlock.amount as Vec3), x },
                                                })
                                            }
                                        />
                                        <ScrubInput
                                            label="Delta Scale Y"
                                            value={activeBlock.amount.y}
                                            min={-1}
                                            max={2}
                                            step={0.05}
                                            decimals={2}
                                            onChange={(y) =>
                                                handleUpdateBlock({
                                                    amount: { ...(activeBlock.amount as Vec3), y },
                                                })
                                            }
                                        />
                                        <ScrubInput
                                            label="Delta Scale Z"
                                            value={activeBlock.amount.z}
                                            min={-1}
                                            max={2}
                                            step={0.05}
                                            decimals={2}
                                            onChange={(z) =>
                                                handleUpdateBlock({
                                                    amount: { ...(activeBlock.amount as Vec3), z },
                                                })
                                            }
                                        />
                                    </>
                                )}
                            </div>
                        )}

                        {/* SIZE BLOCK */}
                        {activeBlock.property === 'size' && (
                            <div className="space-y-2">
                                <ScrubInput
                                    label="Delta Width"
                                    value={
                                        typeof activeBlock.amount === 'object'
                                            ? activeBlock.amount.x
                                            : 0.1
                                    }
                                    min={-1}
                                    max={1}
                                    step={0.01}
                                    decimals={2}
                                    onChange={(x) =>
                                        handleUpdateBlock({
                                            amount:
                                                typeof activeBlock.amount === 'object'
                                                    ? { ...activeBlock.amount, x }
                                                    : { x, y: 0, z: 0 },
                                        })
                                    }
                                />
                                <ScrubInput
                                    label="Delta Height"
                                    value={
                                        typeof activeBlock.amount === 'object'
                                            ? activeBlock.amount.y
                                            : 0.1
                                    }
                                    min={-1}
                                    max={1}
                                    step={0.01}
                                    decimals={2}
                                    onChange={(y) =>
                                        handleUpdateBlock({
                                            amount:
                                                typeof activeBlock.amount === 'object'
                                                    ? { ...activeBlock.amount, y }
                                                    : { x: 0, y, z: 0 },
                                        })
                                    }
                                />
                            </div>
                        )}

                        {/* OPACITY BLOCK */}
                        {activeBlock.property === 'opacity' && (
                            <ScrubInput
                                label="Delta Opacity"
                                value={
                                    typeof activeBlock.amount === 'number'
                                        ? activeBlock.amount
                                        : 0
                                }
                                min={-1}
                                max={1}
                                step={0.05}
                                decimals={2}
                                onChange={(amount) => handleUpdateBlock({ amount })}
                            />
                        )}

                        {/* COUNTER BLOCK */}
                        {activeBlock.property === 'counter' && (
                            <div className="space-y-2">
                                <ScrubInput
                                    label="Count Delta (+ / -)"
                                    value={
                                        typeof activeBlock.amount === 'number'
                                            ? activeBlock.amount
                                            : activeBlock.amount.x
                                    }
                                    min={-100000}
                                    max={100000}
                                    step={10}
                                    decimals={0}
                                    onChange={(amount) => handleUpdateBlock({ amount })}
                                />
                                <div className="text-[10px] text-gray-400 bg-black/40 p-2 rounded border border-white/10">
                                    Animates numeric text values in headline &amp; metric callouts over the block duration.
                                </div>
                            </div>
                        )}

                        {/* PATH REVEAL BLOCK */}
                        {activeBlock.property === 'pathReveal' && (
                            <div className="space-y-2">
                                <ScrubInput
                                    label="Reveal Progress"
                                    value={
                                        typeof activeBlock.amount === 'number'
                                            ? activeBlock.amount
                                            : 1
                                    }
                                    min={0}
                                    max={1}
                                    step={0.05}
                                    decimals={2}
                                    onChange={(amount) => handleUpdateBlock({ amount })}
                                />
                                <div className="text-[10px] text-gray-400 bg-black/40 p-2 rounded border border-white/10">
                                    Draws vector strokes, arrows, or line graphics from 0% to 100%.
                                </div>
                            </div>
                        )}

                        {/* GLOW INTENSITY BLOCK */}
                        {activeBlock.property === 'glow' && (
                            <div className="space-y-2">
                                <ScrubInput
                                    label="Delta Glow Intensity"
                                    value={
                                        typeof activeBlock.amount === 'number'
                                            ? activeBlock.amount
                                            : 0.5
                                    }
                                    min={-2}
                                    max={3}
                                    step={0.05}
                                    decimals={2}
                                    onChange={(amount) => handleUpdateBlock({ amount })}
                                />
                                <div className="text-[10px] text-gray-400 bg-black/40 p-2 rounded border border-white/10">
                                    Pulses or boosts the layer glow intensity dynamically.
                                </div>
                            </div>
                        )}

                        {/* MASK SWEEP & SHIMMER BLOCKS */}
                        {(activeBlock.property === 'maskSweep' ||
                            activeBlock.property === 'shimmer') && (
                            <div className="space-y-2">
                                <ScrubInput
                                    label="Sweep Progress"
                                    value={
                                        typeof activeBlock.amount === 'number'
                                            ? activeBlock.amount
                                            : 1
                                    }
                                    min={0}
                                    max={1}
                                    step={0.05}
                                    decimals={2}
                                    onChange={(amount) => handleUpdateBlock({ amount })}
                                />
                            </div>
                        )}
                    </div>
                </>
            )}
        </aside>
    );
};