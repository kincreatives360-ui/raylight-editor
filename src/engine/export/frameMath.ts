/**
 * Pure frame/timeline math for the offline export pipeline.
 *
 * All export timing derives from these functions: frame index → timestamp is
 * exact rational arithmetic (index / fps), so the Nth frame of a 30 fps export
 * always lands at N/30 seconds no matter how long rendering took.
 */

/** Total frames covering [0, durationMs) at fps. At least 1. */
export function totalFramesFor(durationMs: number, fps: number): number {
    if (!Number.isFinite(durationMs) || durationMs <= 0) return 1;
    if (!Number.isFinite(fps) || fps <= 0) {
        throw new RangeError(`Invalid export fps: ${fps}`);
    }
    return Math.max(1, Math.floor((durationMs / 1000) * fps));
}

/** Presentation timestamp of a frame, in seconds. */
export function frameTimestampSec(frameIndex: number, fps: number): number {
    if (!Number.isInteger(frameIndex) || frameIndex < 0) {
        throw new RangeError(`Invalid frame index: ${frameIndex}`);
    }
    if (!Number.isFinite(fps) || fps <= 0) {
        throw new RangeError(`Invalid export fps: ${fps}`);
    }
    return frameIndex / fps;
}

/** Timeline position (ms) of a frame within the export window. */
export function frameTimeMs(frameIndex: number, fps: number, startMs: number): number {
    return startMs + (frameTimestampSec(frameIndex, fps) * 1000);
}

/** Export window length in ms, clamped to a sane minimum. */
export function exportDurationMs(startMs: number, endMs: number): number {
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
        throw new RangeError('Export window must be finite');
    }
    return Math.max(200, endMs - startMs);
}

/**
 * Progress percent for the capture phase. Capture is expected to run to 100%;
 * container finalization/encoding flush is reported separately by callers.
 */
export function capturePercent(frameIndex: number, totalFrames: number): number {
    if (totalFrames <= 0) return 0;
    return Math.min(100, Math.round((frameIndex / totalFrames) * 100));
}
