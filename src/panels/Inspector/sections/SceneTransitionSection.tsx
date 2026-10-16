// src/panels/Inspector/sections/SceneTransitionSection.tsx
import React from 'react';
import type { Shot } from '../../../model/types';
import { useProjectStore } from '../../../store/useProjectStore';
import { ScrubInput } from '../../../ui/ScrubInput';

interface SceneTransitionSectionProps {
    activeShot: Shot;
}

export const SceneTransitionSection: React.FC<SceneTransitionSectionProps> = ({
    activeShot,
}) => {
    const { updateShot } = useProjectStore();
    const { transition } = activeShot;

    return (
        <div className="p-3.5 space-y-3">
            <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-[#e4e4e7]">
                    Scene Transition
                </span>
                <select
                    value={transition.type}
                    onChange={(e) =>
                        updateShot(activeShot.id, (s) => ({
                            ...s,
                            transition: {
                                ...s.transition,
                                type: e.target.value as Shot['transition']['type'],
                            },
                        }))
                    }
                    className="h-7 rounded-lg bg-[#1c1c1f] border border-white/[0.06] px-2.5 text-[11px] text-white outline-none cursor-pointer capitalize"
                >
                    <option value="cut">Hard Cut</option>
                    <option value="crossfade">Crossfade</option>
                    <option value="push">Push</option>
                    <option value="slide">Slide</option>
                </select>
            </div>

            {transition.type !== 'cut' && (
                <ScrubInput
                    label="Length"
                    value={transition.durationMs}
                    min={100}
                    max={2500}
                    step={50}
                    unit=" ms"
                    onChange={(durationMs) =>
                        updateShot(activeShot.id, (s) => ({
                            ...s,
                            transition: { ...s.transition, durationMs },
                        }))
                    }
                />
            )}
        </div>
    );
};