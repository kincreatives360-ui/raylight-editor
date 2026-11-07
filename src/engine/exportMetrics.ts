import type { Project } from '../model/types';
import { ASPECT_RATIO_CONFIG } from '../stage/stageUtils';
import type { ExportSettings, ExportResolution, VideoExportRequest } from './export/contract';

/** Bitrate ladder mirroring the quality presets, resolution-scaled and film-grain aware. */
export function videoBitrateFor(
    quality: VideoExportRequest['quality'],
    resolution: VideoExportRequest['resolution'],
    bitrateFactor: number = 1
): number {
    const base =
        quality === 'studio' ? 25_000_000
        : quality === 'social' ? 12_000_000
        : quality === 'web' ? 6_000_000
        : 2_500_000;
    const multiplier =
        resolution === '4k' ? 2.5
        : resolution === '480p' ? 0.5
        : 1;
    const safeFactor = Number.isFinite(bitrateFactor) && bitrateFactor > 0 ? bitrateFactor : 1;
    return Math.round(base * multiplier * safeFactor);
}

/** Resolves the export window [startMs, endMs) from scope + selected shot. */
export function resolveExportWindow(
    project: Project,
    settings: Pick<ExportSettings, 'scope' | 'selectedShotId'>
): { startMs: number; endMs: number } {
    const totalProjectMs = project.shots.reduce(
        (max, shot) => Math.max(max, shot.startMs + shot.durationMs),
        0
    );
    const targetShot =
        project.shots.find((shot) => shot.id === settings.selectedShotId) ??
        project.shots[0];
    const startMs = settings.scope === 'shot' && targetShot ? targetShot.startMs : 0;
    const endMs =
        settings.scope === 'shot' && targetShot
            ? targetShot.startMs + targetShot.durationMs
            : totalProjectMs;
    return { startMs, endMs: Math.max(startMs + 200, endMs) };
}

/**
 * Computes Raylight's film-grain load factor (1.0 to 2.5) for shots overlapping [startMs, endMs].
 * High-frequency film grain requires additional video encoder bitrate to prevent block artifacts.
 */
export function computeFilmGrainBitrateFactor(
    project: Project,
    startMs: number,
    endMs: number
): { hasFilmGrain: boolean; grainLoad: number; bitrateFactor: number } {
    let maxGrainIntensity = 0;
    let hasFilmGrain = false;

    for (const shot of project.shots) {
        const shotEndMs = shot.startMs + shot.durationMs;
        if (shotEndMs <= startMs || shot.startMs >= endMs) continue;

        const fg = shot.effects?.filmGrain;
        if (fg?.enabled) {
            hasFilmGrain = true;
            maxGrainIntensity = Math.max(maxGrainIntensity, fg.intensity ?? 0);
        }

        for (const block of shot.effectBlocks ?? []) {
            if (block.effectKey === 'filmGrain' && (!block.property || block.property === 'intensity')) {
                hasFilmGrain = true;
                maxGrainIntensity = Math.max(
                    maxGrainIntensity,
                    block.fromValue ?? 0,
                    block.toValue ?? 0
                );
            }
        }
    }

    const grainLoad = hasFilmGrain
        ? Math.min(1, Math.max(0, maxGrainIntensity / 0.1))
        : 0;
    const bitrateFactor = Number((1 + 1.5 * grainLoad).toFixed(3));
    return { hasFilmGrain, grainLoad, bitrateFactor };
}

export function getExportDimensions(
    aspectRatio: Project['aspectRatio'],
    resolution: ExportResolution = '1080p'
): { width: number; height: number } {
    const spec = ASPECT_RATIO_CONFIG[aspectRatio];
    const baseLongEdge =
        resolution === '4k'
            ? 3840
            : resolution === '1080p'
                ? 1920
                : resolution === '480p'
                    ? 854
                    : 1280;
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
    hasFilmGrain: boolean;
    bitrateFactor: number;
} {
    const effectiveResolution: ExportResolution =
        settings.format === 'gif' && settings.resolution === '4k'
            ? '720p'
            : settings.resolution;
    const { width, height } = getExportDimensions(
        project.aspectRatio,
        effectiveResolution
    );
    const { startMs, endMs } = resolveExportWindow(project, settings);
    const durationMs = Math.max(500, endMs - startMs);
    const durationSec = durationMs / 1000;
    const effectiveFps =
        settings.format === 'gif'
            ? (settings.fps === 30 ? 30 : 15)
            : settings.fps;
    const totalFrames = settings.format === 'png'
        ? 1
        : Math.max(1, Math.floor(durationSec * effectiveFps));

    const { hasFilmGrain, bitrateFactor } = computeFilmGrainBitrateFactor(
        project,
        startMs,
        endMs
    );
    const effectiveBitrateMbps =
        videoBitrateFor(settings.quality, effectiveResolution, bitrateFactor) / 1_000_000;

    const resScale = (width * height) / (1920 * 1080);
    const isJpgStill = settings.format === 'png' && settings.imageFormat === 'jpg';
    const estimatedSizeMb = settings.format === 'png'
        ? (isJpgStill ? 0.45 : 1.4) * resScale
        : settings.format === 'png-seq'
            ? totalFrames * 0.9 * resScale
            : settings.format === 'gif'
                ? durationSec * (effectiveFps / 15) * Math.max(0.35, resScale * 1.8)
                : (durationSec * effectiveBitrateMbps) / 8;
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
        hasFilmGrain,
        bitrateFactor,
    };
}
