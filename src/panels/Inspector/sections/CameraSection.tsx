// src/panels/Inspector/sections/CameraSection.tsx
import React from 'react';
import { RotateCcw, Plus } from 'lucide-react';
import type { Shot, Framing } from '../../../model/types';
import { useProjectStore } from '../../../store/useProjectStore';
import { useSelectionStore } from '../../../store/useSelectionStore';
import { ScrubInput } from '../../../ui/ScrubInput';

interface CameraSectionProps {
    activeShot: Shot;
}

export const CameraSection: React.FC<CameraSectionProps> = ({ activeShot }) => {
    const { updateShot } = useProjectStore();
    const { selectCameraBlock, setTimelineView } = useSelectionStore();

    const primaryFraming: Framing = activeShot.framings[0] || {
        id: 'framing-wide',
        name: 'Wide Establishing',
        target: { x: 0, y: 0, z: 0 },
        zoom: 1,
    };

    const updatePrimaryFraming = (patch: Partial<Framing>) => {
        updateShot(activeShot.id, (s) => {
            if (s.framings.length === 0) {
                return { ...s, framings: [{ ...primaryFraming, ...patch }] };
            }
            return {
                ...s,
                framings: s.framings.map((f, idx) =>
                    idx === 0 ? { ...f, ...patch } : f
                ),
            };
        });
    };

    return (
        <div className="p-3.5 space-y-3">
            <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-[#e4e4e7]">Camera</span>
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={() =>
                            updatePrimaryFraming({
                                target: { x: 0, y: 0, z: 0 },
                                zoom: 1,
                            })
                        }
                        title="Reset Shot Camera to Center (1.0x)"
                        className="p-1 rounded hover:bg-white/10 text-[#71717a] hover:text-white cursor-pointer"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                    <button
                        type="button"
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
                                            anchorX: primaryFraming.target.x,
                                            anchorY: primaryFraming.target.y,
                                            zoom: primaryFraming.zoom,
                                            roll: 0,
                                            orbit: 0,
                                            tilt: 0,
                                        },
                                        to: {
                                            anchorX: primaryFraming.target.x - 0.05,
                                            anchorY: primaryFraming.target.y + 0.02,
                                            zoom: Number((primaryFraming.zoom * 1.15).toFixed(2)),
                                            roll: 0,
                                            orbit: 0,
                                            tilt: 0,
                                        },
                                        shake: { from: 0, to: 0 },
                                    },
                                ],
                            }));
                            selectCameraBlock(camId);
                            setTimelineView('scene');
                        }}
                        title="Add Camera Move to Timeline"
                        className="p-1 rounded hover:bg-white/10 text-[#0088ff] cursor-pointer"
                    >
                        <Plus className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
                <ScrubInput
                    label="X"
                    value={Math.round(primaryFraming.target.x * 1920)}
                    min={-2400}
                    max={2400}
                    step={10}
                    onChange={(pxX) =>
                        updatePrimaryFraming({
                            target: {
                                ...primaryFraming.target,
                                x: Number((pxX / 1920).toFixed(4)),
                            },
                        })
                    }
                />
                <ScrubInput
                    label="Y"
                    value={Math.round(primaryFraming.target.y * 1080)}
                    min={-2400}
                    max={2400}
                    step={10}
                    onChange={(pxY) =>
                        updatePrimaryFraming({
                            target: {
                                ...primaryFraming.target,
                                y: Number((pxY / 1080).toFixed(4)),
                            },
                        })
                    }
                />
            </div>

            <ScrubInput
                label="Zoom"
                value={primaryFraming.zoom}
                min={0.25}
                max={4}
                step={0.05}
                decimals={2}
                unit="x"
                onChange={(zoom) => updatePrimaryFraming({ zoom })}
            />
        </div>
    );
};