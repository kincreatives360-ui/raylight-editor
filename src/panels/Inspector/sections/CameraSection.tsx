// src/panels/Inspector/sections/CameraSection.tsx
import React from 'react';
import { Camera, Crosshair, RotateCcw } from 'lucide-react';
import type { Shot } from '../../../model/types';
import { useProjectStore } from '../../../store/useProjectStore';
import { ScrubInput } from '../../../ui/ScrubInput';

interface CameraSectionProps {
    activeShot: Shot;
}

const FOCAL_PRESETS = [
    { label: '24mm', value: 24 },
    { label: '35mm', value: 35 },
    { label: '50mm', value: 50 },
    { label: '85mm', value: 85 },
];

export const CameraSection: React.FC<CameraSectionProps> = ({ activeShot }) => {
    const { updateShot } = useProjectStore();

    const activeFraming = activeShot.framings?.[0];
    const cameraTarget = activeFraming?.target || { x: 0, y: 0, z: 0 };
    const cameraZoom = activeFraming?.zoom ?? 1;
    const focalLength = (activeShot as any)?.camera?.focalLength ?? 50;

    const updateFraming = (patch: { target?: { x: number; y: number; z: number }; zoom?: number }) => {
        updateShot(activeShot.id, (s) => {
            const framings = s.framings && s.framings.length > 0 ? s.framings : [{ id: 'f0', name: 'Main Framing', target: { x: 0, y: 0, z: 0 }, zoom: 1 }];
            return {
                ...s,
                framings: framings.map((f, i) => (i === 0 ? { ...f, ...patch } : f)),
            };
        });
    };

    return (
        <div className="p-3.5 space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-[11px] font-medium text-[#e4e4e7]">
                        Camera &amp; Optics
                    </span>
                </div>
                <span className="text-[10px] font-mono text-[#0088ff] bg-[#0088ff]/10 px-1.5 py-0.5 rounded">
                    {focalLength}mm
                </span>
            </div>

            {/* Focal Length Presets Bar */}
            <div className="space-y-1.5">
                <span className="text-[10px] text-[#71717a] block">Focal Length</span>
                <div className="grid grid-cols-4 gap-1">
                    {FOCAL_PRESETS.map(({ label, value }) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() =>
                                updateShot(activeShot.id, (s) => ({
                                    ...s,
                                    camera: { ...(s as any).camera, focalLength: value },
                                }))
                            }
                            className={`h-6 rounded text-[10px] font-mono font-medium transition cursor-pointer border ${
                                focalLength === value
                                    ? 'bg-[#0088ff] text-white border-sky-400 shadow-sm'
                                    : 'bg-[#1c1c1f] text-[#a1a1aa] border-white/[0.06] hover:bg-white/10 hover:text-white'
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Camera Target Position (X, Y) */}
            <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[#71717a]">Center Target</span>
                    <button
                        type="button"
                        onClick={() => updateFraming({ target: { x: 0, y: 0, z: cameraTarget.z } })}
                        title="Center Camera Target (0, 0)"
                        className="text-[#71717a] hover:text-white cursor-pointer"
                    >
                        <Crosshair className="w-3 h-3" />
                    </button>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                    <ScrubInput
                        label="X"
                        value={cameraTarget.x}
                        min={-2}
                        max={2}
                        step={0.02}
                        decimals={2}
                        onChange={(x) =>
                            updateFraming({ target: { ...cameraTarget, x } })
                        }
                    />
                    <ScrubInput
                        label="Y"
                        value={cameraTarget.y}
                        min={-2}
                        max={2}
                        step={0.02}
                        decimals={2}
                        onChange={(y) =>
                            updateFraming({ target: { ...cameraTarget, y } })
                        }
                    />
                </div>
            </div>

            {/* Camera Zoom Multiplier */}
            <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[#71717a]">Zoom Framing</span>
                    <button
                        type="button"
                        onClick={() => updateFraming({ zoom: 1.0 })}
                        title="Reset Zoom to 1.0x"
                        className="text-[#71717a] hover:text-white cursor-pointer"
                    >
                        <RotateCcw className="w-3 h-3" />
                    </button>
                </div>
                <ScrubInput
                    label="Zoom"
                    value={cameraZoom}
                    min={0.2}
                    max={5.0}
                    step={0.05}
                    decimals={2}
                    unit="x"
                    onChange={(zoom) => updateFraming({ zoom })}
                />
            </div>
        </div>
    );
};
