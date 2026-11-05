/**
 * Pure audio mix-plan math for offline export.
 *
 * Replaces the legacy realtime AudioContext scheduling (which drifted against
 * wall clock) with a deterministic plan: every clip's source window, gain and
 * de-click ramps are computed here as plain data, then rendered sample-accurately
 * through an OfflineAudioContext by the app layer.
 */

/** A clip as the planner needs it, with its decoded buffer length resolved. */
export interface MixPlanClipInput {
    id: string;
    /** Display name, used in error messages only. */
    name?: string;
    /** Clip start on the project timeline, in ms. */
    startMs: number;
    /** Authored clip length on the timeline, in ms. */
    durationMs: number;
    /** Trim into the source buffer, in ms. */
    offsetMs?: number;
    volume?: number;
    muted?: boolean;
    /** Decoded buffer length, in seconds. */
    bufferDurationSec: number;
}

export interface MixPlanMaster {
    muted?: boolean;
    masterVolume?: number;
}

export interface MixPlanEntry {
    id: string;
    /** Read offset into the decoded buffer, in seconds. */
    sourceOffsetSec: number;
    /** Seconds of audio to render from the buffer. */
    durationSec: number;
    /** Where the clip lands inside the export window, in seconds. */
    destOffsetSec: number;
    /** Clip volume × master volume. */
    gain: number;
    /** De-click ramp at clip start, in seconds (0 when not at a boundary). */
    fadeInSec: number;
    /** De-click ramp at clip end, in seconds (0 when not at a boundary). */
    fadeOutSec: number;
}

export interface AudioMixPlan {
    durationSec: number;
    entries: MixPlanEntry[];
}

/**
 * Short ramp applied where audio starts/stops abruptly, preventing boundary
 * clicks on overlapping clips. 5 ms is inaudible and sample-cheap.
 */
export const DE_CLICK_RAMP_SEC = 0.005;

/**
 * Computes the deterministic mix plan for the export window [startMs, endMs].
 * Returns null when the result would be silent (muted master, no clips, or no
 * overlap with the window) — callers then export video-only.
 */
export function buildAudioMixPlan(
    clips: MixPlanClipInput[],
    master: MixPlanMaster,
    startMs: number,
    endMs: number
): AudioMixPlan | null {
    if (master.muted || (master.masterVolume ?? 1) <= 0) return null;
    const windowSec = Math.max(0, (endMs - startMs) / 1000);
    if (windowSec <= 0) return null;

    const masterVolume = master.masterVolume ?? 1;
    const entries: MixPlanEntry[] = [];

    for (const clip of clips) {
        if (clip.muted || (clip.volume ?? 1) <= 0 || clip.bufferDurationSec <= 0) continue;

        const clipEndMs = clip.startMs + clip.durationMs;
        // Only clips overlapping the export window contribute.
        if (clipEndMs <= startMs || clip.startMs >= endMs) continue;

        // Where the audible part of the clip starts/ends on the export window.
        const effectiveStartMs = Math.max(startMs, clip.startMs);
        const effectiveEndMs = Math.min(endMs, clipEndMs);

        // How far into the source buffer playback begins (honours authored trim).
        const elapsedBeforeStart = Math.max(0, startMs - clip.startMs);
        const sourceOffsetSec = Math.max(
            0,
            ((clip.offsetMs || 0) + elapsedBeforeStart) / 1000
        );
        if (sourceOffsetSec >= clip.bufferDurationSec) continue; // trim consumes whole buffer

        // Never read past the end of the decoded buffer.
        const requestedSec = Math.max(0, (effectiveEndMs - effectiveStartMs) / 1000);
        const durationSec = Math.min(
            requestedSec,
            clip.bufferDurationSec - sourceOffsetSec
        );
        if (durationSec <= 0) continue;

        const gain = (clip.volume ?? 1) * masterVolume;

        // De-click ramps only where audio actually starts/stops inside the
        // window; a clip running edge-to-edge of the window keeps its authored
        // envelope intact.
        const startsInWindow = clip.startMs >= startMs;
        const endsInWindow = clipEndMs <= endMs;
        const fadeInSec = startsInWindow ? Math.min(DE_CLICK_RAMP_SEC, durationSec / 2) : 0;
        const fadeOutSec = endsInWindow ? Math.min(DE_CLICK_RAMP_SEC, durationSec / 2) : 0;

        entries.push({
            id: clip.id,
            sourceOffsetSec,
            durationSec,
            destOffsetSec: (effectiveStartMs - startMs) / 1000,
            gain,
            fadeInSec,
            fadeOutSec,
        });
    }

    if (entries.length === 0) return null;
    return { durationSec: windowSec, entries };
}

/** Total decoded-buffer seconds required to satisfy a plan (for validation). */
export function planRequiresBufferSeconds(plan: AudioMixPlan): number {
    return plan.entries.reduce(
        (max, entry) => Math.max(max, entry.sourceOffsetSec + entry.durationSec),
        0
    );
}
