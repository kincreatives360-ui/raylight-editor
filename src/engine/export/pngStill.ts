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
import type {
    ExportImageDestination,
    ExportImageFormat,
    ExportResolution,
} from './contract';

export interface StillFrameExportOptions {
    format?: ExportImageFormat;
    destination?: ExportImageDestination;
    onSeekFrame?: (timeMs: number) => Promise<void> | void;
}

export async function exportCurrentFrameAsPng(
    project: Project,
    projectName: string,
    timeMs: number,
    resolution: ExportResolution = '1080p',
    options?: StillFrameExportOptions
): Promise<Blob> {
    await preloadProjectImages(project);
    const { width, height } = getExportDimensions(project.aspectRatio, resolution);
    const imageFormat: ExportImageFormat = options?.format === 'jpg' ? 'jpg' : 'png';
    const destination: ExportImageDestination =
        options?.destination === 'clipboard' ? 'clipboard' : 'file';

    const renderer = await createStageFrameRenderer(project, width, height, {
        onSeek: options?.onSeekFrame,
    });
    const outputCanvas = acquireCanvas(width, height);
    const ctx = outputCanvas.getContext('2d');
    if (!ctx) {
        releaseCanvas(outputCanvas);
        await renderer.dispose();
        throw new Error('Failed to create a 2D context for still frame export.');
    }

    try {
        const frame = await renderer.renderFrame(timeMs);
        if (!frame) {
            throw new Error(`Could not render the frame at ${Math.round(timeMs)} ms.`);
        }
        if (imageFormat === 'jpg') {
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, width, height);
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(frame, 0, 0, width, height);

        const mimeType = imageFormat === 'jpg' ? 'image/jpeg' : 'image/png';
        const blob = await new Promise<Blob | null>((resolve) =>
            outputCanvas.toBlob(resolve, mimeType, imageFormat === 'jpg' ? 0.92 : undefined)
        );
        if (!blob) {
            throw new Error(`${imageFormat.toUpperCase()} encoding failed.`);
        }

        if (destination === 'clipboard') {
            let clipboardBlob = blob;
            if (imageFormat === 'jpg') {
                // ClipboardItem universally supports image/png across Chromium/WebKit/Gecko
                const pngBlob = await new Promise<Blob | null>((resolve) =>
                    outputCanvas.toBlob(resolve, 'image/png')
                );
                if (pngBlob) clipboardBlob = pngBlob;
            }
            if (
                typeof navigator !== 'undefined' &&
                navigator.clipboard?.write &&
                typeof ClipboardItem !== 'undefined'
            ) {
                await navigator.clipboard.write([
                    new ClipboardItem({ 'image/png': clipboardBlob }),
                ]);
            } else {
                throw new Error('Clipboard image export is not supported in this browser.');
            }
        } else {
            const filename = `${exportFileBaseName(projectName)}-${Math.round(timeMs)}ms.${imageFormat}`;
            downloadBlob(blob, filename);
        }

        return blob;
    } finally {
        releaseCanvas(outputCanvas);
        await renderer.dispose();
    }
}
