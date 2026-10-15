// src/panels/Inspector/sections/SceneTransitionSection.tsx
import React from 'react';
import { Scissors } from 'lucide-react';
import type { Shot } from '../../../model/types';
import { useProjectStore } from '../../../store/useProjectStore';
import { ScrubInput } from '../../../ui/ScrubInput';

interface SceneTransitionSectionProps {
    activeShot: Shot;
}

type ShotTransitionType = 'cut' | 'crossfade' | 'push' | 'slide';

const TRANSITION_TYPES: { type: ShotTransitionType; label: string }[] = [
    { type: 'cut', label: 'Cut' },
    { type: 'crossfade', label: 'Crossfade' },
    { type: 'push', label: 'Push' },
    { type: 'slide', label: 'Slide' },
];

export const SceneTransitionSection: React.FC<SceneTransitionSectionProps> = ({ activeShot }) => {
    const { updateShot } = useProjectStore();
    const trans = activeShot.transition;

    const updateTransition = (patch: Partial<Shot['transition']>) => {
        updateShot(activeShot.id, (s) => ({
            ...s,
            transition: { ...s.transition, ...patch },
        }));
    };

    return (
        <div className="p-3.5 space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    <Scissors className="w-3.5 h-3.5 text-sky-400" />
                    <span className="text-[11px] font-medium text-[#e4e4e7]">
                        Scene Transition
                    </span>
                </div>
                <span className="text-[10px] font-mono text-[#a1a1aa] capitalize">
                    {trans.type}
                </span>
            </div>

            {/* Transition Type 4-Button Bar */}
            <div className="grid grid-cols-4 gap-1">
                {TRANSITION_TYPES.map(({ type, label }) => (
                    <button
                        key={type}
                        type="button"
                        onClick={() => updateTransition({ type })}
                        className={`h-6 rounded text-[10px] font-medium transition cursor-pointer border ${
                            trans.type === type
                                ? 'bg-[#0088ff] text-white border-sky-400 shadow-sm'
                                : 'bg-[#1c1c1f] text-[#a1a1aa] border-white/[0.06] hover:bg-white/10 hover:text-white'
                        }`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* Duration (if not Cut) */}
            {trans.type !== 'cut' && (
                <div className="pt-1">
                    <ScrubInput
                        label="Duration"
                        value={trans.durationMs}
                        min={100}
                        max={3000}
                        step={50}
                        unit="ms"
                        onChange={(durationMs) => updateTransition({ durationMs })}
                    />
                </div>
            )}
        </div>
    );
};
