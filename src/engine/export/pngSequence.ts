/**
 * Lossless PNG sequence export: every exported frame as a numbered PNG inside
 * a ZIP archive. This is the fidelity-exact export format — pre-encode pixels,
 * no codec approximation.
 */
import { ExportFrameError, throwIfAborted, type ExportDeps } from './contract';
import { exportDurationMs, totalFramesFor } from './frameMath';
import { runFrameLoop } from './frameLoop';
import { createZip, frameEntryName, type ZipEntry } from './zipWriter';

function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (!blob) {
                reject(new Error('PNG encoding failed for an export frame.'));
                return;
            }
            blob.arrayBuffer().then(
                (buffer) => resolve(new Uint8Array(buffer)),
                (error) => reject(error)
            );
        }, 'image/png');
    });
}

export async function encodePngSequenceOffline(
    request: { width: number; height: number; fps: number; startMs: number; endMs: number },
    deps: ExportDeps
): Promise<{ blob: Blob; frameCount: number; durationMs: number }> {
    const { width, height, fps } = request;
    const durationMs = exportDurationMs(request.startMs, request.endMs);
    const totalFrames = totalFramesFor(durationMs, fps);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Failed to create a 2D context for PNG sequence export.');

    const entries: ZipEntry[] = [];
    try {
        await runFrameLoop({
            totalFrames,
            fps,
            startMs: request.startMs,
            renderFrame: deps.renderFrame,
            signal: deps.signal,
            onFrame: async (frameIndex, source) => {
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(source, 0, 0, width, height);
                entries.push({
                    name: frameEntryName(frameIndex),
                    data: await canvasToPngBytes(canvas),
                });
            },
            onFrameCaptured: (index) => {
                const percent = Math.round(((index + 1) / totalFrames) * 97);
                deps.onProgress?.({
                    frameIndex: index + 1,
                    totalFrames,
                    percent,
                    statusText: `Capturing PNG frame ${index + 1}/${totalFrames} (${percent}%)`,
                });
            },
        });

        throwIfAborted(deps.signal);
        if (entries.length !== totalFrames) {
            throw new ExportFrameError(0);
        }
        deps.onProgress?.({
            frameIndex: totalFrames,
            totalFrames,
            percent: 99,
            statusText: 'Packaging frames…',
        });
        const blob = createZip(entries);
        return { blob, frameCount: totalFrames, durationMs };
    } finally {
        canvas.width = 0;
        canvas.height = 0;
    }
}
