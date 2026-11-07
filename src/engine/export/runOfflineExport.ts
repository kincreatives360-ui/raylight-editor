/**
 * App-facing offline export orchestrator.
 *
 * Replaces the legacy realtime MediaRecorder pipeline. Flow: resolve window →
 * preload assets → build the stage frame renderer (resize-once session) →
 * deterministically mix audio → dispatch to the format engine → deliver.
 */
import type { Project } from '../../model/types';
import { preloadProjectImages } from '../canvasRenderer';
import {
    computeFilmGrainBitrateFactor,
    getExportDimensions,
    resolveExportWindow,
} from '../exportMetrics';
import type {
    ExportDeps,
    ExportProgress,
    ExportSettings,
    FrameRenderer,
} from './contract';
import { throwIfAborted } from './contract';
import { encodeVideoOffline, mediabunnyLayer, type MuxerLayer } from './webCodecsExporter';
import { encodeGifOffline } from './gifExporter';
import { encodePngSequenceOffline } from './pngSequence';
import { prepareAudioMixPlan, renderAudioMix } from './audioMixdown';
import { resolveVideoFormat, type ExportCapabilities } from './capabilities';

export { resolveExportWindow };

export interface OfflineExportRequest extends ExportSettings {
    selectedShotId?: string;
}

export interface OfflineExportDeps {
    onProgress: (progress: ExportProgress) => void;
    signal?: AbortSignal;
    /** Injected for tests; defaults to the mediabunny WebCodecs layer. */
    muxerLayer?: MuxerLayer;
    /** Injected for tests; defaults to a live capability probe. */
    capabilities?: ExportCapabilities;
}

/** Prepares assets + audio, then encodes. Format engines never touch the project. */
export async function runOfflineExport(
    project: Project,
    request: OfflineExportRequest,
    deps: OfflineExportDeps,
    frameRendererFactory: (
        width: number,
        height: number
    ) => Promise<{ renderFrame: FrameRenderer; dispose: () => Promise<void> }>
): Promise<{ blob: Blob; mimeType: string; frameCount: number; durationMs: number }> {
    const effectiveResolution =
        request.format === 'gif' && request.resolution === '4k'
            ? '720p'
            : request.resolution;
    const { width, height } = getExportDimensions(project.aspectRatio, effectiveResolution);
    const { startMs, endMs } = resolveExportWindow(project, request);

    throwIfAborted(deps.signal);
    deps.onProgress({
        frameIndex: 0,
        totalFrames: 100,
        percent: 1,
        statusText: 'Preloading high-res textures & fonts…',
    });
    await preloadProjectImages(project);
    if (typeof document !== 'undefined' && document.fonts?.ready) {
        await document.fonts.ready;
    }
    throwIfAborted(deps.signal);

    // Deterministic audio mixdown (video formats only; GIF has no audio track).
    const wantsAudio = request.format === 'mp4' || request.format === 'webm';
    let mixedAudio: AudioBuffer | null = null;
    if (wantsAudio && project.audio && !project.audio.muted) {
        const plan = await prepareAudioMixPlan(
            project.audio.clips.map((clip) => ({
                id: clip.id,
                name: clip.name,
                startMs: clip.startMs,
                durationMs: clip.durationMs,
                offsetMs: clip.offsetMs,
                volume: clip.volume,
                muted: clip.muted,
                solo: clip.solo,
                fadeInMs: clip.fadeInMs,
                fadeOutMs: clip.fadeOutMs,
                dataUrl:
                    clip.dataUrl ||
                    (clip.assetId ? project.assets?.[clip.assetId]?.dataUrl : '') ||
                    '',
            })),
            { masterVolume: project.audio.masterVolume },
            startMs,
            endMs
        );
        if (plan) {
            mixedAudio = await renderAudioMix(plan, {
                signal: deps.signal,
                onProgress: deps.onProgress,
            });
        }
        throwIfAborted(deps.signal);
    }

    const renderer = await frameRendererFactory(width, height);
    try {
        const exportDeps: ExportDeps = {
            renderFrame: renderer.renderFrame,
            onProgress: deps.onProgress,
            signal: deps.signal,
            mixedAudio,
        };

        switch (request.format) {
            case 'gif': {
                const gifFps = request.fps === 30 ? 30 : 15;
                const result = await encodeGifOffline(
                    {
                        width,
                        height,
                        startMs,
                        endMs,
                        fps: gifFps,
                        highQuality: request.gifHighQuality ?? true,
                        loop: request.gifLoop ?? true,
                    },
                    exportDeps
                );
                return { ...result, mimeType: 'image/gif' };
            }
            case 'png-seq': {
                const fps = request.fps;
                const result = await encodePngSequenceOffline(
                    { width, height, fps, startMs, endMs },
                    exportDeps
                );
                return { ...result, mimeType: 'application/zip' };
            }
            case 'mp4':
            case 'webm': {
                const { format, fallbackNote } = await resolveVideoFormat(request.format, {
                    refresh: !deps.capabilities,
                    capabilities: deps.capabilities,
                });
                if (fallbackNote) {
                    console.warn(`[Export] ${fallbackNote}`);
                }
                const { bitrateFactor } = computeFilmGrainBitrateFactor(project, startMs, endMs);
                const result = await encodeVideoOffline(
                    {
                        format,
                        width,
                        height,
                        fps: request.fps,
                        quality: request.quality,
                        resolution: request.resolution,
                        scope: request.scope,
                        startMs,
                        endMs,
                        bitrateFactor: request.bitrateFactor ?? bitrateFactor,
                    },
                    exportDeps,
                    deps.muxerLayer ?? mediabunnyLayer
                );
                return {
                    ...result,
                    mimeType: format === 'mp4' ? 'video/mp4' : 'video/webm',
                };
            }
            default: {
                throw new Error(
                    `Unsupported export format: ${request.format}. PNG stills use exportCurrentFrameAsPng.`
                );
            }
        }
    } finally {
        await renderer.dispose();
    }
}
