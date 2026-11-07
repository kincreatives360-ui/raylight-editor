// src/engine/exporter.ts
/**
 * Public export API.
 *
 * All formats run through the offline engine in `src/engine/export/`: frames
 * are rendered at their exact timeline positions and stamped with data-derived
 * timestamps (never wall clock), audio is mixed sample-accurately offline,
 * and the container is muxed via WebCodecs + mediabunny. The legacy realtime
 * MediaRecorder pipeline has been removed — see design-plans/export-rebuild.
 */
import type { Project } from '../model/types';
import { runOfflineExport } from './export/runOfflineExport';
import { createStageFrameRenderer } from './export/stageFrameRenderer';
import { downloadBlob, exportFileBaseName } from './export/download';
import {
    throwIfAborted,
    type ExportProgress,
    type ExportSettings,
} from './export/contract';
import { exportCurrentFrameAsPng } from './export/pngStill';

export type {
    ExportFormat,
    ExportResolution,
    ExportQuality,
    ExportScope,
    ExportFps,
    ExportImageFormat,
    ExportImageDestination,
    ExportProgress,
    ExportSettings,
} from './export/contract';
export { exportCurrentFrameAsPng };

function extensionFor(mimeType: string): string {
    if (mimeType === 'video/mp4') return 'mp4';
    if (mimeType === 'video/webm') return 'webm';
    if (mimeType === 'image/gif') return 'gif';
    if (mimeType === 'application/zip') return 'zip';
    return 'bin';
}

/**
 * Runs a full export and delivers the file via browser download (or clipboard for stills).
 * Throws ExportCancelledError on abort; never skips or substitutes frames.
 */
export async function runVideoExportPipeline(
    project: Project,
    onProgress: (progress: ExportProgress) => void,
    customSettings?: Partial<ExportSettings>,
    abortSignal?: AbortSignal
): Promise<void> {
    const settings: ExportSettings = {
        format: 'mp4',
        resolution: '1080p',
        fps: project.fps,
        quality: 'social',
        scope: 'entire',
        ...customSettings,
    };

    if (settings.format === 'png') {
        throwIfAborted(abortSignal);
        const targetShot =
            project.shots.find((shot) => shot.id === settings.selectedShotId) ||
            project.shots[0];
        const targetTimeMs =
            typeof settings.playheadTimeMs === 'number' && Number.isFinite(settings.playheadTimeMs)
                ? Math.max(0, settings.playheadTimeMs)
                : settings.scope === 'shot' && targetShot
                    ? targetShot.startMs
                    : 0;

        onProgress({
            frameIndex: 0,
            totalFrames: 1,
            percent: 25,
            statusText: 'Rendering frame at playhead…',
        });

        await exportCurrentFrameAsPng(
            project,
            project.name,
            targetTimeMs,
            settings.resolution,
            {
                format: settings.imageFormat ?? 'png',
                destination: settings.imageDestination ?? 'file',
                onSeekFrame: settings.onSeekFrame,
            }
        );

        onProgress({
            frameIndex: 1,
            totalFrames: 1,
            percent: 100,
            statusText:
                settings.imageDestination === 'clipboard'
                    ? 'Copied frame to clipboard!'
                    : 'Export complete!',
        });
        return;
    }

    const result = await runOfflineExport(
        project,
        settings,
        { onProgress, signal: abortSignal },
        (exportWidth, exportHeight) =>
            createStageFrameRenderer(project, exportWidth, exportHeight, {
                onSeek: settings.onSeekFrame,
            })
    );
    throwIfAborted(abortSignal);

    const effectiveFps =
        settings.format === 'gif'
            ? (settings.fps === 30 ? 30 : 15)
            : settings.fps;
    const effectiveResolution =
        settings.format === 'gif' && settings.resolution === '4k'
            ? '720p'
            : settings.resolution;
    const filename = `${exportFileBaseName(project.name)}-${effectiveResolution}-${effectiveFps}fps.${extensionFor(result.mimeType)}`;
    downloadBlob(result.blob, filename);

    onProgress({
        frameIndex: result.frameCount,
        totalFrames: result.frameCount,
        percent: 100,
        statusText: 'Export complete!',
    });
}
