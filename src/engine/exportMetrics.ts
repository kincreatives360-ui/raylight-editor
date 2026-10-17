import type { Project } from '../model/types';
import { ASPECT_RATIO_CONFIG } from '../stage/stageUtils';
import type { ExportSettings, ExportResolution } from './exporter';

export function getExportDimensions(
    aspectRatio: Project['aspectRatio'],
    resolution: ExportResolution = '1080p'
): { width: number; height: number } {
    const spec = ASPECT_RATIO_CONFIG[aspectRatio];
    const baseLongEdge =
        resolution === '4k' ? 3840 : resolution === '1080p' ? 1920 : 1280;
    const aspect = spec.widthRatio / spec.heightRatio;

    if (aspect >= 1) {
        const width = baseLongEdge;
        const height = Math.round(width / aspect / 2) * 2;
        return { width, height };
    }
    const height = baseLongEdge;
    const width = Math.round((height * aspect) / 2) * 2;
    return { width, height };
}

export function estimateExportMetrics(
    project: Project,
    settings: ExportSettings
): {
    width: number;
    height: number;
    durationSec: number;
    totalFrames: number;
    estimatedTimeSec: number;
    estimatedSizeMb: number;
} {
    const { width, height } = getExportDimensions(
        project.aspectRatio,
        settings.format === 'gif' ? '720p' : settings.resolution
    );
    const totalProjectMs = project.shots.reduce(
        (max, shot) => Math.max(max, shot.startMs + shot.durationMs),
        4000
    );
    const targetShot =
        project.shots.find((shot) => shot.id === settings.selectedShotId) ??
        project.shots[0];
    const durationMs =
        settings.scope === 'shot' && targetShot
            ? targetShot.durationMs
            : totalProjectMs;
    const durationSec = Math.max(0.5, durationMs / 1000);
    const effectiveFps = settings.format === 'gif' ? 15 : settings.fps;
    const totalFrames = settings.format === 'png'
        ? 1
        : Math.max(1, Math.floor(durationSec * effectiveFps));
    const bitrateMbps = settings.quality === 'studio'
        ? 16
        : settings.quality === 'social' ? 8 : 4;
    const resScale = (width * height) / (1920 * 1080);
    const estimatedSizeMb = settings.format === 'png'
        ? 1.4 * resScale
        : settings.format === 'gif'
            ? durationSec * 0.85
            : (durationSec * bitrateMbps * resScale) / 8;
    const estimatedTimeSec = settings.format === 'png'
        ? 1
        : Math.max(2, Math.ceil((totalFrames * (resScale > 2 ? 32 : 16)) / 1000));

    return {
        width,
        height,
        durationSec: Number(durationSec.toFixed(1)),
        totalFrames,
        estimatedTimeSec,
        estimatedSizeMb: Math.max(0.2, Number(estimatedSizeMb.toFixed(1))),
    };
}
