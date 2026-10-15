// src/panels/Inspector/TransitionInspector.tsx
import React from 'react';
import {
    ArrowDownToLine,
    ArrowUpFromLine,
    Sparkles,
} from 'lucide-react';
import type {
    Layer,
    Shot,
    Transitionish,
    TransitionType,
    PresetEasingName,
} from '../../model/types';
import { useProjectStore } from '../../store/useProjectStore';
import { ScrubInput } from '../../ui/ScrubInput';

interface TransitionInspectorProps {
    activeShot: Shot;
    selectedLayer?: Layer;
}

const TRANSITION_OPTIONS: {
    value: TransitionType;
    label: string;
}[] = [
        { value: 'none', label: 'None / Cut' },
        { value: 'fade', label: 'Fade' },
        { value: 'slide-up', label: 'Slide Up' },
        { value: 'slide-down', label: 'Slide Down' },
        { value: 'slide-left', label: 'Slide Left' },
        { value: 'slide-right', label: 'Slide Right' },
        { value: 'float-out', label: 'Float Out' },
        { value: 'scale-out', label: 'Scale Out' },
        { value: 'mask-sweep', label: 'Mask Sweep' },
    ];

const EASING_OPTIONS: {
    value: PresetEasingName;
    label: string;
}[] = [
        { value: 'linear', label: 'Linear' },
        { value: 'ease-in', label: 'Ease In' },
        { value: 'ease-out', label: 'Ease Out' },
        { value: 'ease-in-out', label: 'Ease In Out' },
        { value: 'ease-out-back', label: 'Ease Out Back' },
        { value: 'ease-out-expo', label: 'Ease Out Expo' },
        { value: 'bounce', label: 'Bounce' },
    ];

export const TransitionInspector: React.FC<TransitionInspectorProps> = ({
    activeShot,
    selectedLayer,
}) => {
    const { updateLayer } = useProjectStore();

    const updateTransition = (
        key: 'entrance' | 'exit',
        patch: Partial<Transitionish>,
    ) => {
        if (!selectedLayer) return;

        updateLayer(activeShot.id, selectedLayer.id, (layer) => ({
            ...layer,
            [key]: { ...layer[key], ...patch },
        }));
    };

    if (!selectedLayer) {
        return (
            <aside className="w-80 border-l border-white/10 bg-[#0c0e17] p-4 text-xs text-gray-400 shrink-0">
                Select a layer to edit its transitions and animation blocks.
            </aside>
        );
    }

    const renderTransition = (
        key: 'entrance' | 'exit',
        title: string,
        Icon: React.ComponentType<{ className?: string }>,
    ) => {
        const transition = selectedLayer[key];
        const visibleDuration = Math.max(
            100,
            selectedLayer.outMs - selectedLayer.inMs,
        );
        const availableDelay = Math.max(
            100,
            activeShot.durationMs - selectedLayer.inMs,
        );

        const selectedEasing =
            transition.easing.kind === 'preset'
                ? transition.easing.name
                : 'ease-out';

        return (
            <section
                key={key}
                className="rounded-xl border border-white/10 bg-black/40 p-3 space-y-3"
            >
                <div className="flex items-center gap-1.5 font-semibold text-gray-200">
                    <Icon className="h-3.5 w-3.5 text-amber-300" />
                    {title}
                </div>

                <label className="flex items-center justify-between gap-3 text-gray-400">
                    <span>Transition</span>
                    <select
                        value={transition.type}
                        onChange={(event) =>
                            updateTransition(key, {
                                type: event.target.value as TransitionType,
                            })
                        }
                        className="max-w-40 rounded border border-white/15 bg-[#11131c] px-2 py-1.5 text-white outline-none cursor-pointer"
                    >
                        {TRANSITION_OPTIONS.map((option) => (
                            <option
                                key={option.value}
                                value={option.value}
                            >
                                {option.label}
                            </option>
                        ))}
                    </select>
                </label>

                <ScrubInput
                    label="Duration"
                    value={transition.durationMs}
                    min={0}
                    max={visibleDuration}
                    step={25}
                    unit="ms"
                    onChange={(durationMs) =>
                        updateTransition(key, { durationMs })
                    }
                />

                <ScrubInput
                    label="Delay"
                    value={transition.delayMs}
                    min={0}
                    max={availableDelay}
                    step={25}
                    unit="ms"
                    onChange={(delayMs) =>
                        updateTransition(key, { delayMs })
                    }
                />

                {transition.type !== 'none' &&
                    transition.type !== 'fade' &&
                    transition.type !== 'mask-sweep' && (
                        <ScrubInput
                            label="Travel Distance"
                            value={transition.distance}
                            min={0}
                            max={1}
                            step={0.01}
                            decimals={2}
                            onChange={(distance) =>
                                updateTransition(key, { distance })
                            }
                        />
                    )}

                <label className="flex items-center justify-between gap-3 text-gray-400">
                    <span>Easing</span>
                    <select
                        value={selectedEasing}
                        onChange={(event) =>
                            updateTransition(key, {
                                easing: {
                                    kind: 'preset',
                                    name: event.target.value as PresetEasingName,
                                },
                            })
                        }
                        className="max-w-40 rounded border border-white/15 bg-[#11131c] px-2 py-1.5 text-white outline-none cursor-pointer"
                    >
                        {EASING_OPTIONS.map((option) => (
                            <option
                                key={option.value}
                                value={option.value}
                            >
                                {option.label}
                            </option>
                        ))}
                    </select>
                </label>

                <p className="text-[10px] leading-relaxed text-gray-500">
                    {key === 'entrance'
                        ? 'Plays after the layer in-point.'
                        : 'Plays toward the end of the layer bar.'}
                </p>
            </section>
        );
    };

    return (
        <aside className="w-80 shrink-0 overflow-y-auto border-l border-white/10 bg-[#0c0e17] p-4 flex flex-col gap-4 text-xs">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Sparkles className="h-4 w-4 text-amber-300" />
                <span className="truncate">
                    Transitions: {selectedLayer.name}
                </span>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-[10px] leading-relaxed text-gray-400">
                Layer timing is relative to{' '}
                <span className="text-gray-200">{activeShot.name}</span>.{' '}
                In: {Math.round(selectedLayer.inMs)}ms · Out:{' '}
                {Math.round(selectedLayer.outMs)}ms.
            </div>

            {renderTransition(
                'entrance',
                'Entrance Transition',
                ArrowDownToLine,
            )}

            {renderTransition(
                'exit',
                'Exit Transition',
                ArrowUpFromLine,
            )}

        </aside>
    );
};