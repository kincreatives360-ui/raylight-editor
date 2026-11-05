/**
 * Deterministic offline audio mixdown.
 *
 * Takes the pure AudioMixPlan and renders it sample-accurately through an
 * OfflineAudioContext — no wall clock, no drift against the video track.
 * Video export waits for this buffer and muxes it at timestamp 0.
 */
import { decodeAudioFromDataUrl } from '../audioEngine';
import { buildAudioMixPlan, type AudioMixPlan, type MixPlanClipInput } from './audioSchedule';
import { throwIfAborted, type ExportProgress } from './contract';

export const MIX_SAMPLE_RATE = 48000;

interface PlanClip extends MixPlanClipInput {
    dataUrl: string;
}

/** Resolves decoded buffer lengths, then computes the deterministic plan. */
export async function prepareAudioMixPlan(
    clips: Array<Omit<PlanClip, 'bufferDurationSec'>>,
    master: { muted?: boolean; masterVolume?: number },
    startMs: number,
    endMs: number
): Promise<{ plan: AudioMixPlan; buffers: Map<string, AudioBuffer> } | null> {
    // Master mute/volume-zero means video-only; don't decode anything.
    if (master.muted || (master.masterVolume ?? 1) <= 0) return null;
    const audibleClips = clips.filter(
        (clip) => !clip.muted && (clip.volume ?? 1) > 0
    );
    if (audibleClips.length === 0) return null;

    // Decode once per unique dataUrl; expose buffers keyed by clip id.
    const decodedByUrl = new Map<string, AudioBuffer>();
    const buffers = new Map<string, AudioBuffer>();
    const resolved: PlanClip[] = [];

    for (const clip of audibleClips) {
        let buffer = decodedByUrl.get(clip.dataUrl);
        if (!buffer) {
            const decoded = await decodeAudioFromDataUrl(clip.dataUrl);
            if (!decoded) {
                throw new Error(
                    `Audio clip "${clip.name ?? clip.id}" could not be decoded. Export aborted rather than producing silent output.`
                );
            }
            decodedByUrl.set(clip.dataUrl, decoded);
            buffer = decoded;
        }
        buffers.set(clip.id, buffer);
        resolved.push({ ...clip, bufferDurationSec: buffer.duration });
    }

    const plan = buildAudioMixPlan(resolved, master, startMs, endMs);
    if (!plan) return null;
    return { plan, buffers };
}

/**
 * Renders a mix plan into a single AudioBuffer whose first sample corresponds
 * to the export window start.
 */
export async function renderAudioMix(
    { plan, buffers }: { plan: AudioMixPlan; buffers: Map<string, AudioBuffer> },
    options: { signal?: AbortSignal; onProgress?: (p: ExportProgress) => void } = {}
): Promise<AudioBuffer> {
    throwIfAborted(options.signal);
    if (typeof OfflineAudioContext === 'undefined') {
        throw new Error('OfflineAudioContext is required for audio export.');
    }

    const length = Math.max(1, Math.ceil(plan.durationSec * MIX_SAMPLE_RATE));
    const channels = Math.max(
        1,
        ...[...buffers.values()].map((buffer) => buffer.numberOfChannels)
    );
    const context = new OfflineAudioContext(channels, length, MIX_SAMPLE_RATE);

    for (const entry of plan.entries) {
        const sourceBuffer = buffers.get(entry.id);
        if (!sourceBuffer) continue;

        const source = context.createBufferSource();
        source.buffer = sourceBuffer;

        const gain = context.createGain();
        const startSec = entry.destOffsetSec;
        const endSec = startSec + entry.durationSec;
        gain.gain.setValueAtTime(entry.gain, startSec);
        if (entry.fadeInSec > 0) {
            gain.gain.setValueAtTime(0, startSec);
            gain.gain.linearRampToValueAtTime(entry.gain, startSec + entry.fadeInSec);
        }
        if (entry.fadeOutSec > 0) {
            gain.gain.setValueAtTime(entry.gain, endSec - entry.fadeOutSec);
            gain.gain.linearRampToValueAtTime(0, endSec);
        }

        source.connect(gain);
        gain.connect(context.destination);
        source.start(startSec, entry.sourceOffsetSec, entry.durationSec);
    }

    options.onProgress?.({
        frameIndex: 0,
        totalFrames: 1,
        percent: 0,
        statusText: 'Rendering audio…',
    });

    const mixed = await context.startRendering();
    throwIfAborted(options.signal);
    return mixed;
}
