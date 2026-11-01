/**
 * Export engine contract.
 *
 * Every export format is an implementation of this contract. The pipeline is
 * offline by construction: frame N is always rendered at its exact timeline
 * position and stamped with a data-derived timestamp — never wall clock — so
 * output timing is identical regardless of render speed.
 */

export type ExportFormat = 'mp4' | 'webm' | 'gif' | 'png' | 'png-seq';
export type ExportResolution = '720p' | '1080p' | '4k';
export type ExportQuality = 'studio' | 'social' | 'web' | 'web-low';
export type ExportScope = 'entire' | 'shot';

export interface ExportSettings {
    format: ExportFormat;
    resolution: ExportResolution;
    fps: 24 | 30 | 60;
    quality: ExportQuality;
    scope: ExportScope;
    selectedShotId?: string;
    /** Timeline position the export window starts from, in ms. */
    startMs?: number;
    /** Timeline position the export window ends at, in ms. */
    endMs?: number;
}

export interface ExportProgress {
    frameIndex: number;
    totalFrames: number;
    percent: number;
    statusText: string;
}

export interface ExportResult {
    blob: Blob;
    frameCount: number;
    durationMs: number;
    mimeType: string;
}

/**
 * Produces the visual content for a timeline position. Implementations render
 * the scene at export resolution. Returning `null` is a hard failure: engines
 * must never substitute, skip, or duplicate a frame.
 */
export type FrameRenderer = (timeMs: number) => Promise<CanvasImageSource | null>;

export interface ExportDeps {
    renderFrame: FrameRenderer;
    onProgress?: (progress: ExportProgress) => void;
    signal?: AbortSignal;
    /**
     * Fully mixed audio covering exactly the export window. The engine encodes
     * it starting at timestamp 0 alongside the video track.
     */
    mixedAudio?: AudioBuffer | null;
}

export interface VideoExportRequest extends ExportSettings {
    width: number;
    height: number;
    format: 'mp4' | 'webm';
    /** Timeline origin of the export window, in ms (video starts at t=0). */
    startMs: number;
    /** Timeline end of the export window, in ms. */
    endMs: number;
}

export class ExportCancelledError extends Error {
    constructor() {
        super('Export cancelled.');
        this.name = 'ExportCancelledError';
    }
}

export class ExportFrameError extends Error {
    constructor(timeMs: number) {
        super(
            `Export failed: the renderer produced no frame at ${Math.round(timeMs)} ms. ` +
            'Exports never skip or substitute frames.'
        );
        this.name = 'ExportFrameError';
    }
}

export function throwIfAborted(signal?: AbortSignal): void {
    if (signal?.aborted) throw new ExportCancelledError();
}
