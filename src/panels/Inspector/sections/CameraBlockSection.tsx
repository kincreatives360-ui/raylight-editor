// src/panels/Inspector/sections/CameraBlockSection.tsx
import React, { useState } from 'react';
import {
    ChevronDown,
    ChevronUp,
    AlignLeft,
    AlignCenterHorizontal,
    AlignRight,
    AlignStartVertical,
    AlignCenterVertical,
    AlignEndVertical,
    X,
} from 'lucide-react';
import type {
    CameraBlock,
    CameraKeyframeEndpoint,
    Easing,
    PresetEasingName,
    SpringEasingName,
} from '../../../model/types';
import { useProjectStore } from '../../../store/useProjectStore';
import { ScrubInput } from '../../../ui/ScrubInput';

interface CameraBlockSectionProps {
    activeShotId: string;
    activeCameraBlock: CameraBlock;
    onDone: () => void;
}

export const CameraBlockSection: React.FC<CameraBlockSectionProps> = ({
    activeShotId,
    activeCameraBlock,
    onDone,
}) => {
    const { updateShot } = useProjectStore();
    const [fromCollapsed, setFromCollapsed] = useState(false);
    const [toCollapsed, setToCollapsed] = useState(false);


    const updateCameraBlock = (
        camBlockId: string,
        updater: (cb: CameraBlock) => CameraBlock
    ) => {
        updateShot(activeShotId, (s) => ({
            ...s,
            cameraBlocks: (s.cameraBlocks || []).map((cb) =>
                cb.id === camBlockId ? updater(cb) : cb
            ),
        }));
    };

    const renderCameraEndpoint = (
        which: 'from' | 'to',
        collapsed: boolean,
        onToggle: () => void
    ) => {
        const fallback: CameraKeyframeEndpoint =
            which === 'from'
                ? { anchorX: 0, anchorY: 0, zoom: 1, roll: 0, orbit: 0, tilt: 0 }
                : {
                    anchorX: 0,
                    anchorY: 0,
                    zoom: 1.2,
                    roll: 0,
                    orbit: 0,
                    tilt: 0,
                };
        const ep: CameraKeyframeEndpoint = activeCameraBlock[which] || fallback;

        const patchEndpoint = (patch: Partial<CameraKeyframeEndpoint>) => {
            updateCameraBlock(activeCameraBlock.id, (curr) => ({
                ...curr,
                [which]: { ...(curr[which] || fallback), ...patch },
            }));
        };

        return (
            <div className="p-3.5 space-y-3">
                <button
                    type="button"
                    onClick={onToggle}
                    aria-expanded={!collapsed}
                    aria-label={`Toggle ${which} camera endpoint settings`}
                    className="flex items-center justify-between cursor-pointer w-full text-left"
                >
                    <span className="text-[11px] font-medium text-[#e4e4e7] capitalize">
                        {which}
                    </span>
                    {collapsed ? (
                        <ChevronDown className="w-3.5 h-3.5 text-[#a1a1aa]" />
                    ) : (
                        <ChevronUp className="w-3.5 h-3.5 text-[#a1a1aa]" />
                    )}
                </button>

                {!collapsed && (
                    <div className="space-y-3">
                        {/* Alignment 6-Icon Bar */}
                        <div className="space-y-1.5">
                            <span className="text-[10px] text-[#a1a1aa] block">
                                Alignment
                            </span>
                            <div className="grid grid-cols-6 gap-0.5 bg-[#1c1c1f] p-0.5 rounded-lg" role="toolbar" aria-label={`${which} endpoint alignment`}>
                                <button
                                    type="button"
                                    onClick={() => patchEndpoint({ anchorX: Math.round(-960 + 960 / Math.max(0.1, ep.zoom)) })}
                                    className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
                                    title="Align Left"
                                    aria-label="Align Left"
                                >
                                    <AlignLeft className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => patchEndpoint({ anchorX: 0 })}
                                    className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
                                    title="Center X"
                                    aria-label="Center X"
                                >
                                    <AlignCenterHorizontal className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => patchEndpoint({ anchorX: Math.round(960 - 960 / Math.max(0.1, ep.zoom)) })}
                                    className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
                                    title="Align Right"
                                    aria-label="Align Right"
                                >
                                    <AlignRight className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => patchEndpoint({ anchorY: Math.round(540 - 540 / Math.max(0.1, ep.zoom)) })}
                                    className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
                                    title="Align Top"
                                    aria-label="Align Top"
                                >
                                    <AlignStartVertical className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => patchEndpoint({ anchorY: 0 })}
                                    className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
                                    title="Center Y"
                                    aria-label="Center Y"
                                >
                                    <AlignCenterVertical className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => patchEndpoint({ anchorY: Math.round(-540 + 540 / Math.max(0.1, ep.zoom)) })}
                                    className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
                                    title="Align Bottom"
                                    aria-label="Align Bottom"
                                >
                                    <AlignEndVertical className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>

                        {/* Anchor X & Y */}
                        <div className="space-y-1.5">
                            <span className="text-[10px] text-[#a1a1aa] block">Anchor</span>
                            <div className="grid grid-cols-2 gap-1.5">
                                <ScrubInput
                                    label="X"
                                    value={Math.round(ep.anchorX)}
                                    min={-10000}
                                    max={10000}
                                    step={1}
                                    onChange={(pxX) =>
                                        patchEndpoint({
                                            anchorX: Math.round(pxX),
                                        })
                                    }
                                />
                                <ScrubInput
                                    label="Y"
                                    value={Math.round(ep.anchorY)}
                                    min={-10000}
                                    max={10000}
                                    step={1}
                                    onChange={(pxY) =>
                                        patchEndpoint({
                                            anchorY: Math.round(pxY),
                                        })
                                    }
                                />
                            </div>
                        </div>

                        {/* Zoom */}
                        <div className="space-y-1.5">
                            <span className="text-[10px] text-[#a1a1aa] block">Zoom</span>
                            <ScrubInput
                                label="⊕"
                                value={Number(ep.zoom.toFixed(2))}
                                min={0.2}
                                max={5}
                                step={0.01}
                                decimals={2}
                                unit="x"
                                onChange={(zoom) => patchEndpoint({ zoom: Number(zoom.toFixed(2)) })}
                            />
                        </div>

                        {/* Roll */}
                        <div className="space-y-1.5">
                            <span className="text-[10px] text-[#a1a1aa] block">Roll</span>
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
                            <span className="text-[10px] text-[#a1a1aa] block">
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
        <div className="flex-1 overflow-y-auto divide-y divide-white/[0.06]">
            <div className="px-3.5 py-2.5 flex items-center justify-between bg-emerald-950/20">
                <span className="text-[11px] font-semibold text-emerald-300">
                    Camera Move
                </span>
                <button
                    type="button"
                    onClick={onDone}
                    aria-label="Close camera move settings"
                    className="text-[10px] text-[#a1a1aa] hover:text-white cursor-pointer px-2 py-0.5 rounded hover:bg-white/5"
                >
                    Done
                </button>
            </div>

            {/* 1. FROM SECTION */}
            {renderCameraEndpoint('from', fromCollapsed, () => setFromCollapsed((v) => !v))}

            {/* 2. TO SECTION */}
            {renderCameraEndpoint('to', toCollapsed, () => setToCollapsed((v) => !v))}

            {/* 3. MOVE SECTION: [ Dolly | Zoom | Warp ] */}
            <div className="p-3.5 space-y-2.5">
                <span className="text-[11px] font-medium text-[#e4e4e7] block">
                    Move
                </span>
                <div className="grid grid-cols-3 gap-1 bg-[#161619] p-1 rounded-xl border border-white/[0.06]" role="radiogroup" aria-label="Camera move mode">
                    {(
                        [
                            { id: 'dolly', label: 'Dolly' },
                            { id: 'zoom', label: 'Zoom' },
                            { id: 'dollyzoom', label: 'Warp' },
                        ] as const
                    ).map((m) => (
                        <button
                            key={m.id}
                            type="button"
                            role="radio"
                            aria-checked={activeCameraBlock.mode === m.id}
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
                    <span className="text-[10px] text-[#a1a1aa] block">Amount</span>
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
                    <span className="text-[10px] text-[#a1a1aa] block">Start &amp; Length</span>
                    <div className="grid grid-cols-2 gap-1.5">
                        <ScrubInput
                            label="Start"
                            value={activeCameraBlock.startMs}
                            min={0}
                            max={30000}
                            step={50}
                            unit="ms"
                            onChange={(startMs) =>
                                updateCameraBlock(activeCameraBlock.id, (cb) => ({
                                    ...cb,
                                    startMs,
                                }))
                            }
                        />
                        <ScrubInput
                            label="Dur"
                            value={activeCameraBlock.durationMs}
                            min={100}
                            max={10000}
                            step={50}
                            unit="ms"
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
                    <span className="text-[10px] text-[#a1a1aa] block">Easing</span>
                    <div className="flex items-center gap-1.5">
                        <select
                            aria-label="Camera move easing"
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
                                                name: val.split(':')[1] as SpringEasingName,
                                            }
                                            : {
                                                kind: 'preset',
                                                name: val.split(':')[1] as PresetEasingName,
                                            };
                                updateCameraBlock(activeCameraBlock.id, (cb) => ({
                                    ...cb,
                                    easing,
                                }));
                            }}
                            className="flex-1 h-7 rounded-lg bg-[#1c1c1f] border border-white/[0.06] px-2.5 text-[11px] text-white outline-none cursor-pointer"
                        >
                            <optgroup label="Physics Springs">
                                <option value="spring:gentle">Spring: Gentle</option>
                                <option value="spring:quick">Spring: Quick</option>
                                <option value="spring:bouncy">Spring: Bouncy</option>
                                <option value="spring:slow">Spring: Slow</option>
                                <option value="spring:snappy">Spring: Snappy</option>
                                <option value="spring:stiff">Spring: Stiff</option>
                            </optgroup>
                            <optgroup label="Standard Presets">
                                <option value="preset:linear">Linear</option>
                                <option value="preset:ease">Standard Ease</option>
                                <option value="preset:ease-in">Ease In</option>
                                <option value="preset:ease-out">Ease Out</option>
                                <option value="preset:ease-in-out">Ease In-Out</option>
                                <option value="preset:ease-in-expo">Ease In Expo</option>
                                <option value="preset:ease-out-expo">Ease Out Expo</option>
                                <option value="preset:ease-in-back">Ease In Back</option>
                                <option value="preset:ease-out-back">Ease Out Back</option>
                                <option value="preset:bounce">Bounce</option>
                            </optgroup>
                            <optgroup label="Custom Curves">
                                <option value="bezier">Custom Cubic Bezier</option>
                            </optgroup>
                        </select>
                        <button
                            type="button"
                            onClick={() => {
                                updateShot(activeShotId, (s) => ({
                                    ...s,
                                    cameraBlocks: (s.cameraBlocks || []).filter(
                                        (b) => b.id !== activeCameraBlock.id
                                    ),
                                }));
                                onDone();
                            }}
                            title="Delete Camera Move"
                            aria-label="Delete Camera Move"
                            className="p-1.5 text-[#a1a1aa] hover:text-rose-400 cursor-pointer"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {/* Spring Physics Parameters Slider Tuning */}
                    {activeCameraBlock.easing.kind === 'spring' && (
                        <div className="p-2 rounded-lg bg-[#141416] border border-white/[0.06] space-y-1.5 mt-2">
                            <div className="flex items-center justify-between text-[10px] text-[#38bdf8] font-medium">
                                <span>Spring Physics Tuning</span>
                                <span className="text-[10px] text-[#a1a1aa] font-mono capitalize tracking-tight">{activeCameraBlock.easing.name}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-1">
                                <ScrubInput
                                    label="Stiff"
                                    value={activeCameraBlock.easing.config?.stiffness ?? 180}
                                    min={20}
                                    max={400}
                                    step={5}
                                    onChange={(stiffness) =>
                                        updateCameraBlock(activeCameraBlock.id, (cb) => ({
                                            ...cb,
                                            easing: {
                                                ...cb.easing,
                                                kind: 'spring',
                                                name: cb.easing.kind === 'spring' ? cb.easing.name : 'gentle',
                                                config: { ...(cb.easing.kind === 'spring' ? cb.easing.config : {}), stiffness },
                                            },
                                        }))
                                    }
                                />
                                <ScrubInput
                                    label="Damp"
                                    value={activeCameraBlock.easing.config?.damping ?? 18}
                                    min={1}
                                    max={50}
                                    step={1}
                                    onChange={(damping) =>
                                        updateCameraBlock(activeCameraBlock.id, (cb) => ({
                                            ...cb,
                                            easing: {
                                                ...cb.easing,
                                                kind: 'spring',
                                                name: cb.easing.kind === 'spring' ? cb.easing.name : 'gentle',
                                                config: { ...(cb.easing.kind === 'spring' ? cb.easing.config : {}), damping },
                                            },
                                        }))
                                    }
                                />
                                <ScrubInput
                                    label="Mass"
                                    value={Math.round((activeCameraBlock.easing.config?.mass ?? 1) * 10)}
                                    min={1}
                                    max={50}
                                    step={1}
                                    unit="x"
                                    onChange={(massVal) =>
                                        updateCameraBlock(activeCameraBlock.id, (cb) => ({
                                            ...cb,
                                            easing: {
                                                ...cb.easing,
                                                kind: 'spring',
                                                name: cb.easing.kind === 'spring' ? cb.easing.name : 'gentle',
                                                config: { ...(cb.easing.kind === 'spring' ? cb.easing.config : {}), mass: Number((massVal / 10).toFixed(1)) },
                                            },
                                        }))
                                    }
                                />
                            </div>
                        </div>
                    )}

                    {/* Bezier Handles Tuning */}
                    {activeCameraBlock.easing.kind === 'bezier' && (
                        <div className="p-2 rounded-lg bg-[#141416] border border-white/[0.06] space-y-1.5 mt-2">
                            <div className="flex items-center justify-between text-[10px] text-[#38bdf8] font-medium">
                                <span>Cubic Bezier Curve Handles</span>
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                                <ScrubInput
                                    label="X1"
                                    value={Math.round(activeCameraBlock.easing.x1 * 100)}
                                    min={0}
                                    max={100}
                                    step={1}
                                    unit="%"
                                    onChange={(val) => {
                                        const x1 = Number((val / 100).toFixed(2));
                                        updateCameraBlock(activeCameraBlock.id, (cb) => ({
                                            ...cb,
                                            easing: cb.easing.kind === 'bezier' ? { ...cb.easing, x1 } : cb.easing,
                                        }));
                                    }}
                                />
                                <ScrubInput
                                    label="Y1"
                                    value={Math.round(activeCameraBlock.easing.y1 * 100)}
                                    min={-100}
                                    max={200}
                                    step={1}
                                    unit="%"
                                    onChange={(val) => {
                                        const y1 = Number((val / 100).toFixed(2));
                                        updateCameraBlock(activeCameraBlock.id, (cb) => ({
                                            ...cb,
                                            easing: cb.easing.kind === 'bezier' ? { ...cb.easing, y1 } : cb.easing,
                                        }));
                                    }}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
