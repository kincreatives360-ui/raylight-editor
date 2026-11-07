import React, { useState } from 'react';
import { Trash2, Volume2, X } from 'lucide-react';
import type { AudioClip } from '../../../model/types';
import { useProjectStore } from '../../../store/useProjectStore';
import { IconButton, InspectorRow } from '../../../ui/primitives';
import { InspectorDisclosure } from '../../../ui/InspectorDisclosure';
import { ScrubInput } from '../../../ui/ScrubInput';
import { AnimationTimingFields } from '../../../ui/AnimationTimingFields';

interface AudioClipInspectorProps {
    clip: AudioClip;
    onDone: () => void;
}

export const AudioClipInspector: React.FC<AudioClipInspectorProps> = ({
    clip,
    onDone,
}) => {
    const {
        updateAudioClip,
        deleteAudioClip,
        toggleAudioClipMuted,
        toggleAudioClipSolo,
    } = useProjectStore();

    const [levelsOpen, setLevelsOpen] = useState(true);
    const [fadesOpen, setFadesOpen] = useState(true);
    const [timingOpen, setTimingOpen] = useState(true);

    const handleDelete = () => {
        deleteAudioClip(clip.id);
        onDone();
    };

    const maxFadeMs = Math.max(0, Math.round(clip.durationMs));

    return (
        <div data-testid="audio-clip-inspector" className="flex-1 overflow-y-auto divide-y divide-white/[0.06]">
            {/* Header: Title + Done Button */}
            <div className="p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="w-5 h-5 rounded bg-orange-500/15 flex items-center justify-center text-orange-400 shrink-0">
                        <Volume2 className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                        <span className="text-[12px] font-semibold text-white tracking-wide block truncate">
                            {clip.name || 'Audio Clip'}
                        </span>
                        <span className="text-[11px] text-muted-foreground font-mono tabular-nums">
                            {(clip.durationMs / 1000).toFixed(2)}s
                        </span>
                    </div>
                </div>
                <IconButton
                    unstyled
                    tooltip={false}
                    label="Done"
                    onClick={onDone}
                    title="Done"
                    className="w-6 h-6 rounded-md hover:bg-subtle flex items-center justify-center text-muted-foreground hover:text-foreground transition cursor-pointer"
                    icon={<X className="w-3.5 h-3.5" />}
                />
            </div>

            {/* Clip Name */}
            <div className="p-3.5">
                <InspectorRow
                    unstyled
                    className="space-y-1.5"
                    labelTag="label"
                    labelClassName="text-[11px] font-medium text-muted-foreground block"
                    label={<>Clip Name</>}
                >
                    <input
                        type="text"
                        aria-label="Audio clip name"
                        value={clip.name}
                        onChange={(e) => updateAudioClip(clip.id, (c) => ({ ...c, name: e.target.value }))}
                        className="w-full h-8 px-3 rounded-lg bg-surface border border-subtle text-[12px] text-foreground outline-none focus:border-brand-blue transition"
                    />
                </InspectorRow>
            </div>

            {/* Level & Routing Section */}
            <InspectorDisclosure
                title="Level & Routing"
                open={levelsOpen}
                onOpenChange={setLevelsOpen}
            >
                <div className="space-y-2.5">
                    <ScrubInput
                        label="Volume"
                        value={Math.round(clip.volume * 100)}
                        min={0}
                        max={100}
                        step={1}
                        decimals={0}
                        unit="%"
                        onChange={(val) =>
                            updateAudioClip(clip.id, (c) => ({
                                ...c,
                                volume: Math.max(0, Math.min(1, val / 100)),
                            }))
                        }
                    />
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={() => toggleAudioClipMuted(clip.id)}
                            aria-pressed={Boolean(clip.muted)}
                            className={`h-7 rounded-lg text-[11px] font-medium border transition cursor-pointer ${
                                clip.muted
                                    ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                                    : 'bg-surface border-subtle text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            {clip.muted ? 'Muted (M)' : 'Mute (M)'}
                        </button>
                        <button
                            type="button"
                            onClick={() => toggleAudioClipSolo(clip.id)}
                            aria-pressed={Boolean(clip.solo)}
                            className={`h-7 rounded-lg text-[11px] font-medium border transition cursor-pointer ${
                                clip.solo
                                    ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                                    : 'bg-surface border-subtle text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            {clip.solo ? 'Soloed (S)' : 'Solo (S)'}
                        </button>
                    </div>
                </div>
            </InspectorDisclosure>

            {/* Envelope Fades Section */}
            <InspectorDisclosure
                title="Fade Envelope"
                open={fadesOpen}
                onOpenChange={setFadesOpen}
            >
                <div className="grid grid-cols-2 gap-2">
                    <ScrubInput
                        label="Fade In"
                        value={clip.fadeInMs ?? 0}
                        min={0}
                        max={maxFadeMs}
                        step={50}
                        decimals={0}
                        unit=" ms"
                        onChange={(val) =>
                            updateAudioClip(clip.id, (c) => ({
                                ...c,
                                fadeInMs: Math.max(0, Math.min(maxFadeMs, Math.round(val))),
                            }))
                        }
                    />
                    <ScrubInput
                        label="Fade Out"
                        value={clip.fadeOutMs ?? 0}
                        min={0}
                        max={maxFadeMs}
                        step={50}
                        decimals={0}
                        unit=" ms"
                        onChange={(val) =>
                            updateAudioClip(clip.id, (c) => ({
                                ...c,
                                fadeOutMs: Math.max(0, Math.min(maxFadeMs, Math.round(val))),
                            }))
                        }
                    />
                </div>
            </InspectorDisclosure>

            {/* Timing Section */}
            <InspectorDisclosure
                title="Timing"
                open={timingOpen}
                onOpenChange={setTimingOpen}
            >
                <div className="space-y-2">
                    <AnimationTimingFields
                        start={{
                            label: 'Start',
                            value: clip.startMs,
                            min: 0,
                            step: 50,
                            decimals: 0,
                            onChange: (val) =>
                                updateAudioClip(clip.id, (c) => ({
                                    ...c,
                                    startMs: Math.max(0, Math.round(val)),
                                })),
                        }}
                        duration={{
                            label: 'Duration',
                            value: clip.durationMs,
                            min: 200,
                            step: 50,
                            decimals: 0,
                            onChange: (val) =>
                                updateAudioClip(clip.id, (c) => ({
                                    ...c,
                                    durationMs: Math.max(200, Math.round(val)),
                                })),
                        }}
                    />
                    <ScrubInput
                        label="Offset"
                        value={clip.offsetMs}
                        min={0}
                        step={50}
                        decimals={0}
                        unit=" ms"
                        onChange={(val) =>
                            updateAudioClip(clip.id, (c) => ({
                                ...c,
                                offsetMs: Math.max(0, Math.round(val)),
                            }))
                        }
                    />
                </div>
            </InspectorDisclosure>

            {/* Delete Clip */}
            <div className="p-3.5">
                <button
                    type="button"
                    onClick={handleDelete}
                    className="w-full py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 font-medium text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Audio Clip</span>
                </button>
            </div>
        </div>
    );
};
