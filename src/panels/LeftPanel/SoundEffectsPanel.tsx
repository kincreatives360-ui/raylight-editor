import React, { useMemo } from 'react';
import { IconButton } from '../../ui/primitives';
import { SearchField } from '../../ui/SearchField';
import { BUILTIN_SOUND_PACKS } from '../../engine/soundPacks';
import { CURATED_SOUNDS } from '../../data/curatedSounds';
import { getSoundCategoryLabels, normalizeSoundCategory } from '../../data/soundCategories';
import { useProjectStore } from '../../store/useProjectStore';
import { usePlayheadStore } from '../../store/usePlayheadStore';
import type { AudioClip } from '../../model/types';
import { Play, Pause, Plus, Upload, Volume2 } from 'lucide-react';

interface SoundEffectsPanelProps {
    assetCategory: 'sfx';
    audioLabel: string;
    onSelectAudioClick: () => void;
    selectedSfxCategory: string;
    onSelectedSfxCategoryChange: (category: string) => void;
    soundSearchQuery: string;
    onSoundSearchQueryChange: (query: string) => void;
    playingSfxId: string | null;
    onTogglePreviewSound: (id: string, src: string) => void;
}

type SoundItem = {
    id: string;
    name: string;
    category: string;
    durationMs: number;
    description: string;
    getUrl: () => string;
};

export const SoundEffectsPanel: React.FC<SoundEffectsPanelProps> = ({
    assetCategory,
    audioLabel,
    onSelectAudioClick,
    selectedSfxCategory,
    onSelectedSfxCategoryChange,
    soundSearchQuery,
    onSoundSearchQueryChange,
    playingSfxId,
    onTogglePreviewSound,
}) => {
    const updateProject = useProjectStore((state) => state.updateProject);

    const soundItems: SoundItem[] = useMemo(() => [
        ...CURATED_SOUNDS.map((sound) => ({
            id: sound.slug,
            name: sound.name,
            category: normalizeSoundCategory(sound.category),
            durationMs: sound.durationMs,
            description: `${sound.category} sound effect`,
            getUrl: () => sound.src,
        })),
        ...BUILTIN_SOUND_PACKS.map((sound) => ({
            id: sound.id,
            name: sound.name,
            category: normalizeSoundCategory(sound.category),
            durationMs: sound.durationMs,
            description: sound.description,
            getUrl: () => sound.generateWavDataUrl(),
        })),
    ], []);

    const soundCategories = useMemo(
        () => getSoundCategoryLabels(soundItems.map((sound) => sound.category)),
        [soundItems]
    );

    const filteredCuratedSounds = useMemo(() => {
        const q = soundSearchQuery.trim().toLowerCase();
        return soundItems.filter((item) => {
            if (selectedSfxCategory !== 'All' && item.category !== selectedSfxCategory) {
                return false;
            }
            if (!q) return true;
            return [item.name, item.category, item.description]
                .some((field) => field.toLowerCase().includes(q));
        });
    }, [soundItems, soundSearchQuery, selectedSfxCategory]);

    return (
        <>
            {assetCategory === 'sfx' && (
                        <div className="flex-1 flex flex-col min-h-0 gap-2.5">
                            <button
                                type="button"
                                onClick={onSelectAudioClick}
                                className="w-full py-2 px-3 rounded-xl bg-brand-blue hover:bg-brand-blue-hover text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition shadow-md shadow-brand-blue/15"
                            >
                                <Upload className="w-3.5 h-3.5" />
                                <span>Upload Audio Track</span>
                            </button>

                            {audioLabel && (
                                <div className="p-2.5 rounded-xl bg-surface border border-subtle flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <Volume2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                        <span className="text-[11px] font-medium text-foreground truncate">{audioLabel}</span>
                                    </div>
                                    <span className="text-[10px] text-emerald-400 font-mono shrink-0">Active</span>
                                </div>
                            )}

                            {/* Sound Search Bar */}
                            <SearchField
                                containerClassName="relative"
                                iconClassName="w-3.5 h-3.5 text-disabled absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                                type="text"
                                placeholder="Search 150+ sound effects..."
                                value={soundSearchQuery}
                                onChange={(e) => onSoundSearchQueryChange(e.target.value)}
                                className="w-full bg-surface border border-subtle rounded-xl pl-8 pr-7 py-1.5 text-xs text-foreground placeholder:text-disabled outline-none focus:border-brand-blue transition"
                                onClear={() => onSoundSearchQueryChange('')}
                                clearButtonClassName="absolute right-2.5 top-1/2 -translate-y-1/2 text-disabled hover:text-foreground"
                            ></SearchField>

                            {/* Category Filter Pills */}
                            <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[10px] no-scrollbar shrink-0">
                                {soundCategories.map((cat) => (
                                    <button
                                        key={cat}
                                        type="button"
                                        onClick={() => onSelectedSfxCategoryChange(cat)}
                                        className={`px-2 py-0.5 rounded-full shrink-0 font-medium transition cursor-pointer ${
                                            selectedSfxCategory === cat
                                                ? 'bg-brand-blue/25 text-brand-blue border border-brand-blue/50'
                                                : 'bg-surface text-muted-foreground hover:text-foreground border border-subtle'
                                        }`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>

                            {/* SFX List */}
                            <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
                                {filteredCuratedSounds.map((sound) => {
                                    const isPlaying = playingSfxId === sound.id;
                                    const durationFormatted = sound.durationMs >= 1000
                                        ? `${(sound.durationMs / 1000).toFixed(1)}s`
                                        : `${sound.durationMs}ms`;

                                    return (
                                        <div
                                            key={sound.id}
                                            className="p-2 rounded-xl bg-surface hover:bg-subtle border border-subtle flex items-center justify-between gap-2 transition"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-xs font-semibold text-foreground truncate">
                                                        {sound.name}
                                                    </span>
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-blue/10 text-brand-blue font-mono tabular-nums tracking-tight shrink-0">
                                                        {durationFormatted}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground font-medium uppercase tracking-wider">
                                                        {sound.category}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1 shrink-0">
                                                <IconButton
                                                    unstyled
                                                    tooltip={false}
                                                    label={`${isPlaying ? 'Pause' : 'Preview'} ${sound.name}`}
                                                    icon={<>
                                                        {isPlaying ? (
                                                            <Pause className="w-3.5 h-3.5 fill-current" />
                                                        ) : (
                                                            <Play className="w-3.5 h-3.5 fill-current" />
                                                        )}
                                                    </>}
                                                    onClick={() => onTogglePreviewSound(sound.id, sound.getUrl())}
                                                    title={isPlaying ? "Pause Preview" : "Preview Sound"}
                                                    className={`p-1.5 rounded-lg border transition cursor-pointer ${isPlaying
                                                    ? 'bg-brand-blue text-white border-brand-blue'
                                                    : 'bg-subtle hover:bg-muted text-muted-foreground border-subtle'
                                                    }`}
                                                />

                                                <IconButton
                                                    unstyled
                                                    tooltip={false}
                                                    label={`Add ${sound.name} to Timeline at playhead`}
                                                    icon={<>
                                                        <Plus className="w-3.5 h-3.5" />
                                                    </>}
                                                    onClick={() => {
                                                        const clip: AudioClip = {
                                                            id: `sfx-${sound.id}-${Date.now()}`,
                                                            name: sound.name,
                                                            dataUrl: sound.getUrl(),
                                                            startMs: usePlayheadStore.getState().currentTimeMs,
                                                            durationMs: sound.durationMs,
                                                            offsetMs: 0,
                                                            volume: 1,
                                                            muted: false,
                                                        };
                                                        updateProject((p) => ({
                                                            ...p,
                                                            audio: {
                                                                clips: [...(p.audio?.clips || []), clip],
                                                                muted: p.audio?.muted || false,
                                                                masterVolume: p.audio?.masterVolume ?? 1,
                                                            },
                                                        }));
                                                    }}
                                                    title="Add to Timeline at Playhead"
                                                    className="p-1.5 rounded-lg bg-brand-blue/20 hover:bg-brand-blue/30 text-brand-blue border border-brand-blue/40 transition cursor-pointer"
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                                {filteredCuratedSounds.length === 0 && (
                                    <div className="py-8 text-center text-xs text-disabled">
                                        No sound effects match &quot;{soundSearchQuery}&quot;
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
        </>
    );
};
