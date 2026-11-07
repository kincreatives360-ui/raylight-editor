/**
 * Export engine contract.
 *
 * Every export format is an implementation of this contract. The pipeline is
 * offline by construction: frame N is always rendered at its exact timeline
 * position and stamped with a data-derived timestamp — never wall clock — so
 * output timing is identical regardless of render speed.
 */

export type ExportFormat = 'mp4' | 'webm' | 'gif' | 'png' | 'png-seq';
export type ExportResolution = '480p' | '720p' | '1080p' | '4k';
export type ExportQuality = 'studio' | 'social' | 'web' | 'web-low';
export type ExportScope = 'entire' | 'shot';
export type ExportFps = 15 | 24 | 30 | 60;
export type ExportImageFormat = 'png' | 'jpg';
export type ExportImageDestination = 'file' | 'clipboard';

export interface ExportSettings {
    format: ExportFormat;
    resolution: ExportResolution;
    fps: ExportFps;
    quality: ExportQuality;
    scope: ExportScope;
    selectedShotId?: string;
    /** Timeline position the export window starts from, in ms. */
    startMs?: number;
    /** Timeline position the export window ends at, in ms. */
    endMs?: number;
    /** GIF export: use median-cut + Floyd-Steinberg dithering (default: true). */
    gifHighQuality?: boolean;
    /** GIF export: loop infinitely via NETSCAPE2.0 extension (default: true). */
    gifLoop?: boolean;
    /** Still image format when format === 'png' (default: 'png'). */
    imageFormat?: ExportImageFormat;
    /** Still image delivery destination when format === 'png' (default: 'file'). */
    imageDestination?: ExportImageDestination;
    /** Current playhead position in ms for still frame export. */
    playheadTimeMs?: number;
    /** Optional film-grain bitrate multiplier (1.0 to 2.5). */
    bitrateFactor?: number;
    /** Seeks the editor playhead so the stage renders each frame. */
    onSeekFrame?: (timeMs: number) => Promise<void> | void;
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
