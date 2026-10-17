// src/panels/Inspector/CameraInspector.tsx
import React, { useState } from 'react';
import { Camera, Plus, Trash2, Video, Eye, Crosshair } from 'lucide-react';
import type {
    Shot,
    Framing,
    CameraBlock,
    PresetEasingName,
    SpringEasingName,
} from '../../model/types';
import { useProjectStore } from '../../store/useProjectStore';
import { ScrubInput } from '../../ui/ScrubInput';

interface CameraInspectorProps {
    activeShot: Shot;
}

export const CameraInspector: React.FC<CameraInspectorProps> = ({ activeShot }) => {
    const { updateShot } = useProjectStore();
    const [newFramingName, setNewFramingName] = useState('New Framing');

    // Add current or custom framing
    const handleSaveFraming = () => {
        const id = `framing-${Date.now()}`;
        // If there is an existing framing, use its coordinates as a sensible starting baseline
        const lastFraming =
            activeShot.framings.length > 0
                ? activeShot.framings[activeShot.framings.length - 1]
                : undefined;

        const initialTarget = lastFraming
            ? { ...lastFraming.target }
            : { x: 0, y: 0, z: 0 };
        const initialZoom = lastFraming ? lastFraming.zoom : 1.0;

        const newFraming: Framing = {
            id,
            name: newFramingName.trim() || `Framing ${activeShot.framings.length + 1}`,
            target: initialTarget,
            zoom: initialZoom,
        };

        updateShot(activeShot.id, (s) => ({
            ...s,
            framings: [...s.framings, newFraming],
        }));
        setNewFramingName(`Framing ${activeShot.framings.length + 2}`);
    };

    const handleDeleteFraming = (framingId: string) => {
        if (activeShot.framings.length <= 1) return;
        updateShot(activeShot.id, (s) => ({
            ...s,
            framings: s.framings.filter((f) => f.id !== framingId),
            cameraBlocks: s.cameraBlocks.filter(
                (cb) => cb.fromFramingId !== framingId && cb.toFramingId !== framingId
            ),
        }));
    };

    const updateFraming = (framingId: string, patch: Partial<Framing>) => {
        updateShot(activeShot.id, (s) => ({
            ...s,
            framings: s.framings.map((f) => (f.id === framingId ? { ...f, ...patch } : f)),
        }));
    };

    const handleAddCameraBlock = () => {
        if (activeShot.framings.length < 1) return;
        const f1 = activeShot.framings[0].id;
        const f2 = activeShot.framings[1]?.id || f1;

        const newBlock: CameraBlock = {
            id: `cam-blk-${Date.now()}`,
            label: 'Camera Move',
            startMs: 200,
            durationMs: 2500,
            fromFramingId: f1,
            toFramingId: f2,
            mode: 'dolly',
            easing: { kind: 'preset', name: 'ease-in-out' },
        };

        updateShot(activeShot.id, (s) => ({
            ...s,
            cameraBlocks: [...s.cameraBlocks, newBlock],
        }));
    };

    const updateCameraBlock = (blockId: string, patch: Partial<CameraBlock>) => {
        updateShot(activeShot.id, (s) => ({
            ...s,
            cameraBlocks: s.cameraBlocks.map((cb) =>
                cb.id === blockId ? { ...cb, ...patch } : cb
            ),
        }));
    };

    return (
        <aside className="w-80 shrink-0 overflow-y-auto border-l border-white/10 bg-[#0c0e17] p-4 flex flex-col gap-4 text-xs select-none flex-1 min-h-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Camera className="h-4 w-4 text-emerald-400" />
                <span className="truncate">Camera Rig: {activeShot.name}</span>
            </div>

            {/* 1. Saved Framings Manager */}
            <div className="rounded-xl border border-white/10 bg-black/40 p-3 space-y-3">
                <div className="flex items-center justify-between font-semibold text-gray-200">
                    <span className="flex items-center gap-1.5">
                        <Eye className="h-3.5 w-3.5 text-emerald-400" /> Saved Framings
                    </span>
                    <span className="text-[10px] font-mono text-gray-400">
                        {activeShot.framings.length} Saved
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        value={newFramingName}
                        onChange={(e) => setNewFramingName(e.target.value)}
                        className="flex-1 px-2.5 py-1.5 rounded bg-black/60 border border-white/15 text-white outline-none focus:border-emerald-500 text-xs"
                        placeholder="Framing name..."
                    />
                    <button
                        onClick={handleSaveFraming}
                        className="flex items-center gap-1 px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium cursor-pointer transition text-xs shadow-sm"
                    >
                        <Plus className="w-3.5 h-3.5" /> Save
                    </button>
                </div>

                {/* Framings List with Interactive Zoom and 3D Target Coordinates */}
                <div className="space-y-3 pt-1">
                    {activeShot.framings.map((f) => (
                        <div
                            key={f.id}
                            className="p-3 rounded-lg bg-white/5 border border-white/10 space-y-2.5"
                        >
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                                    <input
                                        type="text"
                                        value={f.name}
                                        onChange={(e) => updateFraming(f.id, { name: e.target.value })}
                                        className="font-medium text-white text-xs bg-transparent border-b border-transparent focus:border-emerald-400 outline-none px-1 flex-1 min-w-0 truncate"
                                        title="Click to rename framing"
                                    />
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                                        {f.zoom.toFixed(2)}x
                                    </span>
                                    {activeShot.framings.length > 1 && (
                                        <button
                                            onClick={() => handleDeleteFraming(f.id)}
                                            className="p-1 rounded hover:bg-rose-500/20 text-gray-400 hover:text-rose-400 transition cursor-pointer"
                                            title="Delete Framing"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Camera Zoom Control */}
                            <ScrubInput
                                label="Camera Zoom"
                                value={f.zoom}
                                min={0.2}
                                max={6.0}
                                step={0.05}
                                decimals={2}
                                unit="x"
                                onChange={(zoom) => updateFraming(f.id, { zoom })}
                            />

                            {/* 3D Target Coordinates (Pan X, Tilt Y, Depth Z) */}
                            <div className="grid grid-cols-3 gap-1.5">
                                <ScrubInput
                                    label="Target X"
                                    value={f.target.x}
                                    min={-2.0}
                                    max={2.0}
                                    step={0.01}
                                    decimals={2}
                                    onChange={(x) =>
                                        updateFraming(f.id, { target: { ...f.target, x } })
                                    }
                                />
                                <ScrubInput
                                    label="Target Y"
                                    value={f.target.y}
                                    min={-2.0}
                                    max={2.0}
                                    step={0.01}
                                    decimals={2}
                                    onChange={(y) =>
                                        updateFraming(f.id, { target: { ...f.target, y } })
                                    }
                                />
                                <ScrubInput
                                    label="Target Z"
                                    value={f.target.z}
                                    min={-2.0}
                                    max={2.0}
                                    step={0.02}
                                    decimals={2}
                                    onChange={(z) =>
                                        updateFraming(f.id, { target: { ...f.target, z } })
                                    }
                                />
                            </div>

                            {/* Quick Align & Snap to Layer */}
                            <div className="flex items-center gap-1.5 pt-1">
                                <button
                                    onClick={() =>
                                        updateFraming(f.id, {
                                            target: { x: 0, y: 0, z: 0 },
                                        })
                                    }
                                    className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-[10px] text-gray-300 flex items-center gap-1 border border-white/10 cursor-pointer transition shrink-0"
                                    title="Reset framing to center (0, 0, 0)"
                                >
                                    <Crosshair className="w-3 h-3 text-emerald-400" /> Center
                                </button>

                                {activeShot.layers.length > 0 && (
                                    <select
                                        onChange={(e) => {
                                            const layer = activeShot.layers.find(
                                                (l) => l.id === e.target.value
                                            );
                                            if (layer) {
                                                updateFraming(f.id, {
                                                    target: { ...layer.position },
                                                });
                                            }
                                            e.target.value = '';
                                        }}
                                        defaultValue=""
                                        className="flex-1 rounded bg-[#11131c] border border-white/10 px-2 py-1 text-[10px] text-gray-300 outline-none cursor-pointer truncate"
                                        title="Snap this framing target directly to a layer"
                                    >
                                        <option value="" disabled>
                                            Snap target to layer...
                                        </option>
                                        {activeShot.layers.map((l) => (
                                            <option key={l.id} value={l.id}>
                                                Snap to: {l.name}
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* 2. Camera Animation Blocks (Dolly / Zoom / Dolly-Zoom) */}
            <div className="rounded-xl border border-white/10 bg-black/40 p-3 space-y-3">
                <div className="flex items-center justify-between font-semibold text-gray-200">
                    <span className="flex items-center gap-1.5">
                        <Video className="h-3.5 w-3.5 text-emerald-400" /> Camera Motion Blocks
                    </span>
                    <button
                        onClick={handleAddCameraBlock}
                        disabled={activeShot.framings.length === 0}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/35 border border-emerald-500/30 text-emerald-300 text-xs cursor-pointer transition disabled:opacity-40"
                    >
                        <Plus className="w-3 h-3 text-emerald-400" /> Add Block
                    </button>
                </div>

                {activeShot.cameraBlocks.length === 0 ? (
                    <div className="text-gray-500 text-center py-4 text-[11px] rounded-lg border border-dashed border-white/10">
                        No camera moves in this shot yet. Click Add Block to dolly or zoom between framings!
                    </div>
                ) : (
                    <div className="space-y-3">
                        {activeShot.cameraBlocks.map((cb) => (
                            <div
                                key={cb.id}
                                className="p-3 rounded-lg bg-white/5 border border-white/10 space-y-2.5"
                            >
                                <div className="flex items-center justify-between">
                                    <input
                                        type="text"
                                        value={cb.label ?? ''}
                                        placeholder="Camera Move"
                                        onChange={(e) =>
                                            updateCameraBlock(cb.id, { label: e.target.value })
                                        }
                                        className="bg-transparent font-medium text-white text-xs outline-none border-b border-transparent focus:border-emerald-400 px-1"
                                    />
                                    <button
                                        onClick={() =>
                                            updateShot(activeShot.id, (s) => ({
                                                ...s,
                                                cameraBlocks: s.cameraBlocks.filter(
                                                    (item) => item.id !== cb.id
                                                ),
                                            }))
                                        }
                                        className="p-1 rounded hover:bg-rose-500/20 text-gray-400 hover:text-rose-400 cursor-pointer"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>

                                <div className="space-y-1">
                                    <span className="text-[10px] text-gray-400 block font-mono uppercase tracking-wider">
                                        Camera Move Mode
                                    </span>
                                    <select
                                        value={cb.mode}
                                        onChange={(e) =>
                                            updateCameraBlock(cb.id, {
                                                mode: e.target.value as CameraBlock['mode'],
                                            })
                                        }
                                        className="w-full rounded border border-white/15 bg-[#11131c] px-2.5 py-1.5 text-white outline-none cursor-pointer text-xs focus:border-emerald-500"
                                    >
                                        <option value="dolly">Dolly (Physical 3D Push)</option>
                                        <option value="zoom">Lens Zoom (Focal mm Telephoto)</option>
                                        <option value="dollyzoom">
                                            Dolly-Zoom (Vertigo Counter-Scale)
                                        </option>
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <span className="text-[10px] text-gray-400 block mb-1 font-mono uppercase tracking-wider">
                                            From Framing
                                        </span>
                                        <select
                                            value={cb.fromFramingId}
                                            onChange={(e) =>
                                                updateCameraBlock(cb.id, {
                                                    fromFramingId: e.target.value,
                                                })
                                            }
                                            className="w-full rounded border border-white/15 bg-[#11131c] px-2 py-1.5 text-white text-[11px] focus:border-emerald-500"
                                        >
                                            {activeShot.framings.map((f) => (
                                                <option key={f.id} value={f.id}>
                                                    {f.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-gray-400 block mb-1 font-mono uppercase tracking-wider">
                                            To Framing
                                        </span>
                                        <select
                                            value={cb.toFramingId}
                                            onChange={(e) =>
                                                updateCameraBlock(cb.id, {
                                                    toFramingId: e.target.value,
                                                })
                                            }
                                            className="w-full rounded border border-white/15 bg-[#11131c] px-2 py-1.5 text-white text-[11px] focus:border-emerald-500"
                                        >
                                            {activeShot.framings.map((f) => (
                                                <option key={f.id} value={f.id}>
                                                    {f.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 pt-1">
                                    <ScrubInput
                                        label="Start (ms)"
                                        value={cb.startMs}
                                        min={0}
                                        max={Math.max(100, activeShot.durationMs - 200)}
                                        step={50}
                                        decimals={0}
                                        unit="ms"
                                        onChange={(startMs) => updateCameraBlock(cb.id, { startMs })}
                                    />
                                    <ScrubInput
                                        label="Duration (ms)"
                                        value={cb.durationMs}
                                        min={200}
                                        max={10000}
                                        step={50}
                                        decimals={0}
                                        unit="ms"
                                        onChange={(durationMs) =>
                                            updateCameraBlock(cb.id, { durationMs })
                                        }
                                    />
                                </div>

                                {/* Easing Selector */}
                                <div className="space-y-1 pt-1">
                                    <span className="text-[10px] text-gray-400 block font-mono uppercase tracking-wider">
                                        Camera Easing
                                    </span>
                                    <select
                                        value={
                                            cb.easing.kind === 'bezier'
                                                ? 'bezier'
                                                : `${cb.easing.kind}:${cb.easing.name}`
                                        }
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === 'bezier') {
                                                updateCameraBlock(cb.id, {
                                                    easing: { kind: 'bezier', x1: 0.16, y1: 1, x2: 0.3, y2: 1 },
                                                });
                                            } else if (val.startsWith('spring:')) {
                                                updateCameraBlock(cb.id, {
                                                    easing: { kind: 'spring', name: val.split(':')[1] as SpringEasingName },
                                                });
                                            } else {
                                                updateCameraBlock(cb.id, {
                                                    easing: { kind: 'preset', name: val.split(':')[1] as PresetEasingName },
                                                });
                                            }
                                        }}
                                        className="w-full rounded border border-white/15 bg-[#11131c] px-2.5 py-1.5 text-white outline-none cursor-pointer text-xs focus:border-emerald-500"
                                    >
                                        <optgroup label="Physics Springs" className="bg-[#0c0e17]">
                                            <option value="spring:gentle">Spring: Gentle</option>
                                            <option value="spring:quick">Spring: Quick</option>
                                            <option value="spring:bouncy">Spring: Bouncy</option>
                                            <option value="spring:slow">Spring: Slow</option>
                                        </optgroup>
                                        <optgroup label="Presets" className="bg-[#0c0e17]">
                                            <option value="preset:ease-in-out">Ease In-Out</option>
                                            <option value="preset:ease-out">Ease Out</option>
                                            <option value="preset:ease-out-expo">Ease Out Expo</option>
                                            <option value="preset:linear">Linear Pan</option>
                                        </optgroup>
                                        <optgroup label="Custom" className="bg-[#0c0e17]">
                                            <option value="bezier">Smooth Cubic-Bezier</option>
                                        </optgroup>
                                    </select>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </aside>
    );
};
