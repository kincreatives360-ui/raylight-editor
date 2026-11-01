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
import { throwIfAborted, type ExportProgress } from './export/contract';
import { exportCurrentFrameAsPng } from './export/pngStill';

export type {
    ExportFormat,
    ExportResolution,
    ExportQuality,
    ExportScope,
    ExportProgress,
} from './export/contract';
export { exportCurrentFrameAsPng };

export interface ExportSettings {
    format: 'mp4' | 'webm' | 'gif' | 'png' | 'png-seq';
    resolution: '720p' | '1080p' | '4k';
    fps: 24 | 30 | 60;
    quality: 'studio' | 'social' | 'web' | 'web-low';
    scope: 'entire' | 'shot';
    selectedShotId?: string;
    /** Seeks the editor playhead so the stage renders each frame. */
    onSeekFrame?: (timeMs: number) => Promise<void> | void;
}

function extensionFor(mimeType: string): string {
    if (mimeType === 'video/mp4') return 'mp4';
    if (mimeType === 'video/webm') return 'webm';
    if (mimeType === 'image/gif') return 'gif';
    if (mimeType === 'application/zip') return 'zip';
    return 'bin';
}

/**
 * Runs a full export and delivers the file via browser download.
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
        const targetShot =
            project.shots.find((shot) => shot.id === settings.selectedShotId) ||
            project.shots[0];
        const targetTimeMs =
            settings.scope === 'shot' && targetShot ? targetShot.startMs : 0;
        if (settings.onSeekFrame) {
            await settings.onSeekFrame(targetTimeMs);
        }
        await exportCurrentFrameAsPng(
            project,
            project.name,
            targetTimeMs,
            settings.resolution
        );
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

    const filename = `${exportFileBaseName(project.name)}-${settings.resolution}-${settings.fps}fps.${extensionFor(result.mimeType)}`;
    downloadBlob(result.blob, filename);

    onProgress({
        frameIndex: result.frameCount,
        totalFrames: result.frameCount,
        percent: 100,
        statusText: 'Export complete!',
    });
}
