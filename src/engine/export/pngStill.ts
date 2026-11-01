/**
 * High-resolution PNG still of a single timeline frame.
 *
 * Renders through the same stage capture path as video export (single-shot
 * session), so the still matches exported video frames pixel for pixel.
 */
import type { Project } from '../../model/types';
import { preloadProjectImages } from '../canvasRenderer';
import { getExportDimensions } from '../exportMetrics';
import { acquireCanvas, releaseCanvas } from '../canvasPool';
import { createStageFrameRenderer } from './stageFrameRenderer';
import { downloadBlob, exportFileBaseName } from './download';
import type { ExportResolution } from './contract';

export async function exportCurrentFrameAsPng(
    project: Project,
    projectName: string,
    timeMs: number,
    resolution: ExportResolution = '1080p'
): Promise<void> {
    await preloadProjectImages(project);
    const { width, height } = getExportDimensions(project.aspectRatio, resolution);

    const renderer = await createStageFrameRenderer(project, width, height);
    const outputCanvas = acquireCanvas(width, height);
    const ctx = outputCanvas.getContext('2d');
    if (!ctx) {
        releaseCanvas(outputCanvas);
        await renderer.dispose();
        throw new Error('Failed to create a 2D context for PNG export.');
    }

    try {
        const frame = await renderer.renderFrame(timeMs);
        if (!frame) {
            throw new Error(`Could not render the frame at ${Math.round(timeMs)} ms.`);
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(frame, 0, 0, width, height);

        const filename = `${exportFileBaseName(projectName)}-${Math.round(timeMs)}ms.png`;
        const blob = await new Promise<Blob | null>((resolve) =>
            outputCanvas.toBlob(resolve, 'image/png')
        );
        if (!blob) {
            throw new Error('PNG encoding failed.');
        }
        downloadBlob(blob, filename);
    } finally {
        releaseCanvas(outputCanvas);
        await renderer.dispose();
    }
}
