import React, { useRef } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import type { AudioClip } from '../../model/types';

interface AudioMixerProps {
    clips: AudioClip[];
    masterVolume: number;
    masterMuted: boolean;
    mixerHeightPx: number;
    selectedAudioClipId: string | null;
    onResizeMixerHeight: (heightPx: number) => void;
    onSetMasterVolume: (volume: number) => void;
    onToggleMasterMute: () => void;
    onClearSolos: () => void;
    onSelectClip: (clipId: string) => void;
    onSetClipVolume: (clipId: string, volume: number) => void;
    onToggleClipMute: (clipId: string) => void;
    onToggleClipSolo: (clipId: string) => void;
}

export const AudioMixer: React.FC<AudioMixerProps> = React.memo(({
    clips,
    masterVolume,
    masterMuted,
    mixerHeightPx,
    selectedAudioClipId,
    onResizeMixerHeight,
    onSetMasterVolume,
    onToggleMasterMute,
    onClearSolos,
    onSelectClip,
    onSetClipVolume,
    onToggleClipMute,
    onToggleClipSolo,
}) => {
    const resizeRef = useRef<{ startClientY: number; startHeightPx: number } | null>(null);
    const hasSolo = clips.some((c) => Boolean(c.solo));

    const handleResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        resizeRef.current = {
            startClientY: e.clientY,
            startHeightPx: mixerHeightPx,
        };
        try {
            e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
            // Ignore pointer capture error in headless environments
        }
    };

    const handleResizePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        const state = resizeRef.current;
        if (!state) return;
        onResizeMixerHeight(state.startHeightPx + (state.startClientY - e.clientY));
    };

    const handleResizePointerUp = () => {
        resizeRef.current = null;
    };

    return (
        <div
            data-testid="audio-mixer-rack"
            style={{ height: `${mixerHeightPx}px` }}
            className="relative flex shrink-0 border-t border-subtle bg-panel select-none"
        >
            {/* Top Horizontal Resize Splitter (matches Raylight DPo) */}
            <div
                role="separator"
                aria-orientation="horizontal"
                aria-label="Resize mixer"
                onPointerDown={handleResizePointerDown}
                onPointerMove={handleResizePointerMove}
                onPointerUp={handleResizePointerUp}
                onPointerCancel={handleResizePointerUp}
                style={{ touchAction: 'none' }}
                className="group absolute inset-x-0 top-0 z-30 flex h-2 -translate-y-1/2 cursor-row-resize items-center justify-center"
            >
                <div className="h-px w-full bg-transparent transition-colors group-hover:bg-brand-blue/60 group-active:bg-brand-blue" />
            </div>

            {/* Master Channel Strip (matches Raylight IPo) */}
            <div className="flex h-full w-24 shrink-0 flex-col items-center justify-between border-r border-subtle bg-surface/50 px-2 py-2">
                <div className="flex w-full items-center justify-between">
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Master
                    </span>
                    <button
                        type="button"
                        aria-label={masterMuted ? 'Unmute master audio' : 'Mute master audio'}
                        title={masterMuted ? 'Unmute Master' : 'Mute Master'}
                        onClick={onToggleMasterMute}
                        className={`p-1 rounded transition cursor-pointer ${
                            masterMuted
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                                : 'text-muted-foreground hover:text-foreground hover:bg-subtle'
                        }`}
                    >
                        {masterMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                    </button>
                </div>

                <div className="w-full space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                        <span>Vol</span>
                        <span>{masterMuted ? 'Muted' : `${Math.round(masterVolume * 100)}%`}</span>
                    </div>
                    <input
                        aria-label="Master Volume"
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={masterVolume}
                        onChange={(e) => onSetMasterVolume(Number(e.target.value))}
                        className="w-full h-1.5 accent-brand-blue cursor-pointer"
                    />
                </div>

                <div className="flex h-5 w-full items-center justify-center">
                    {hasSolo ? (
                        <button
                            type="button"
                            onClick={onClearSolos}
                            title="Clear all soloed tracks"
                            className="w-full py-0.5 px-1.5 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-300 text-[9px] font-semibold uppercase tracking-wider transition cursor-pointer"
                        >
                            Clear Solo
                        </button>
                    ) : (
                        <span className="font-mono text-[9px] text-disabled">0.0 dB</span>
                    )}
                </div>
            </div>

            {/* Track Channel Strips (matches Raylight TPo) */}
            <div className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
                {clips.length === 0 ? (
                    <div className="flex h-full items-center justify-center px-4 text-[11px] text-muted-foreground">
                        Add audio to the playlist to mix it here.
                    </div>
                ) : (
                    <div className="flex h-full w-max divide-x divide-subtle/60">
                        {clips.map((clip, index) => {
                            const isSelected = selectedAudioClipId === clip.id;
                            const isSilenced = masterMuted || clip.muted || (hasSolo && !clip.solo);
                            const effectiveLevel = isSilenced ? 0 : clip.volume * masterVolume;

                            return (
                                <div
                                    key={clip.id}
                                    role="button"
                                    tabIndex={0}
                                    aria-label={clip.name}
                                    aria-pressed={isSelected}
                                    onClick={() => onSelectClip(clip.id)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            onSelectClip(clip.id);
                                        }
                                    }}
                                    className={`flex h-full w-32 shrink-0 flex-col justify-between p-2 transition cursor-pointer ${
                                        isSelected
                                            ? 'bg-brand-blue/10'
                                            : 'hover:bg-white/[0.02]'
                                    }`}
                                >
                                    {/* Track Header */}
                                    <div className="flex items-center justify-between gap-1 min-w-0">
                                        <span className="font-mono text-[9px] text-disabled shrink-0">
                                            #{index + 1}
                                        </span>
                                        <span
                                            title={clip.name}
                                            className={`truncate text-[11px] font-medium ${
                                                isSelected ? 'text-brand-blue' : 'text-foreground'
                                            }`}
                                        >
                                            {clip.name}
                                        </span>
                                    </div>

                                    {/* Peak Meter + Volume Fader */}
                                    <div className="space-y-1 my-auto" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex items-center justify-between text-[9px] font-mono text-muted-foreground">
                                            <span>{Math.round(clip.volume * 100)}%</span>
                                            {(clip.fadeInMs || clip.fadeOutMs) ? (
                                                <span className="text-orange-300/80">Fade</span>
                                            ) : null}
                                        </div>
                                        <div className="h-1 w-full rounded-full bg-subtle overflow-hidden">
                                            <div
                                                className={`h-full transition-all ${
                                                    isSilenced ? 'bg-slate-600' : 'bg-emerald-400'
                                                }`}
                                                style={{ width: `${Math.round(effectiveLevel * 100)}%` }}
                                            />
                                        </div>
                                        <input
                                            aria-label={`${clip.name} volume`}
                                            type="range"
                                            min={0}
                                            max={1}
                                            step={0.01}
                                            value={clip.volume}
                                            onChange={(e) => onSetClipVolume(clip.id, Number(e.target.value))}
                                            className="w-full h-1.5 accent-orange-400 cursor-pointer"
                                        />
                                    </div>

                                    {/* Mute (M) and Solo (S) Controls */}
                                    <div
                                        className="flex items-center gap-1"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <button
                                            type="button"
                                            aria-label={`${clip.muted ? 'Unmute' : 'Mute'} ${clip.name}`}
                                            title={clip.muted ? 'Unmute track' : 'Mute track'}
                                            onClick={() => onToggleClipMute(clip.id)}
                                            className={`flex-1 h-5 rounded text-[10px] font-mono font-bold transition cursor-pointer border ${
                                                clip.muted
                                                    ? 'bg-rose-500/25 border-rose-500/50 text-rose-300'
                                                    : 'bg-surface border-subtle text-muted-foreground hover:text-foreground'
                                            }`}
                                        >
                                            M
                                        </button>
                                        <button
                                            type="button"
                                            aria-label={`${clip.solo ? 'Unsolo' : 'Solo'} ${clip.name}`}
                                            title={clip.solo ? 'Unsolo track' : 'Solo track'}
                                            onClick={() => onToggleClipSolo(clip.id)}
                                            className={`flex-1 h-5 rounded text-[10px] font-mono font-bold transition cursor-pointer border ${
                                                clip.solo
                                                    ? 'bg-amber-500/25 border-amber-400/60 text-amber-300'
                                                    : 'bg-surface border-subtle text-muted-foreground hover:text-foreground'
                                            }`}
                                        >
                                            S
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
});

