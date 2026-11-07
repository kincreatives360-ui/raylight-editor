/**
 * Animated GIF export on the shared offline frame loop.
 *
 * Quality upgrade over the legacy path: the 256-color global palette is
 * derived from the actual frames (median cut) instead of a fixed RGB332
 * table, and frames are dithered, which removes banding on gradients.
 */
import { throwIfAborted, ExportFrameError, type ExportDeps } from './contract';
import { exportDurationMs, totalFramesFor } from './frameMath';
import { runFrameLoop } from './frameLoop';
import { buildPalette, type Palette } from './quantize';
import { IncrementalGifEncoder, gifFrameDelayCentiseconds } from '../gifEncoder';

export const GIF_FPS = 15;
export const GIF_MAX_LONG_EDGE = 1920;

/** GIF frames sampled (evenly spaced) to build the global palette. */
const PALETTE_SAMPLE_COUNT = 8;

export function gifDimensions(
    width: number,
    height: number
): { width: number; height: number } {
    const longEdge = Math.max(width, height);
    if (longEdge <= GIF_MAX_LONG_EDGE) return { width, height };
    const scale = GIF_MAX_LONG_EDGE / longEdge;
    // GIF dimensions must stay even for the color-table layout to align.
    return {
        width: Math.max(2, Math.round((width * scale) / 2) * 2),
        height: Math.max(2, Math.round((height * scale) / 2) * 2),
    };
}

async function drawToImageData(
    source: CanvasImageSource,
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
): Promise<ImageData> {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, width, height);
    return ctx.getImageData(0, 0, width, height);
}

export interface GifExportRequest {
    width: number;
    height: number;
    startMs: number;
    endMs: number;
    fps?: number;
    highQuality?: boolean;
    loop?: boolean;
}

export async function encodeGifOffline(
    request: GifExportRequest,
    deps: ExportDeps
): Promise<{ blob: Blob; frameCount: number; durationMs: number }> {
    const { width, height } = gifDimensions(request.width, request.height);
    const fps = request.fps === 30 ? 30 : GIF_FPS;
    const highQuality = request.highQuality ?? true;
    const loop = request.loop ?? true;
    const durationMs = exportDurationMs(request.startMs, request.endMs);
    const totalFrames = Math.max(2, totalFramesFor(durationMs, fps));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Failed to create a 2D context for GIF export.');

    try {
        throwIfAborted(deps.signal);

        let palette: Palette | undefined;
        if (highQuality) {
            // Pass 1: render a sparse sample of frames and build the palette.
            const sampleFrames: ImageData[] = [];
            const sampleIndices = new Set<number>();
            for (let i = 0; i < PALETTE_SAMPLE_COUNT; i++) {
                sampleIndices.add(
                    Math.round((i / Math.max(1, PALETTE_SAMPLE_COUNT - 1)) * (totalFrames - 1))
                );
            }
            for (const frameIndex of sampleIndices) {
                throwIfAborted(deps.signal);
                const timeMs = request.startMs + (frameIndex / fps) * 1000;
                const source = await deps.renderFrame(timeMs);
                if (!source) throw new ExportFrameError(timeMs);
                sampleFrames.push(await drawToImageData(source, ctx, width, height));
                deps.onProgress?.({
                    frameIndex: 0,
                    totalFrames,
                    percent: Math.round((sampleFrames.length / sampleIndices.size) * 10),
                    statusText: 'Analyzing colors…',
                });
            }
            palette = buildPalette(sampleFrames);
            // Release sample pixels before the encode pass.
            sampleFrames.length = 0;
        }

        // Pass 2: encode every frame against the content palette (or fast RGB332 table).
        const encoder = new IncrementalGifEncoder(width, height, palette, { loop });
        const progressBase = highQuality ? 10 : 0;
        const progressSpan = highQuality ? 86 : 96;
        await runFrameLoop({
            totalFrames,
            fps,
            startMs: request.startMs,
            renderFrame: deps.renderFrame,
            signal: deps.signal,
            onFrame: async (_index, source) => {
                const imageData = await drawToImageData(source, ctx, width, height);
                encoder.addFrame(imageData, gifFrameDelayCentiseconds(_index, fps), {
                    dither: highQuality,
                });
            },
            onFrameCaptured: (index) => {
                const percent = progressBase + Math.round(((index + 1) / totalFrames) * progressSpan);
                deps.onProgress?.({
                    frameIndex: index + 1,
                    totalFrames,
                    percent,
                    statusText: `Capturing GIF frame ${index + 1}/${totalFrames} (${percent}%)`,
                });
            },
        });

        throwIfAborted(deps.signal);
        deps.onProgress?.({
            frameIndex: totalFrames,
            totalFrames,
            percent: 98,
            statusText: 'Encoding GIF…',
        });
        const blob = encoder.finish();
        return { blob, frameCount: totalFrames, durationMs };
    } finally {
        canvas.width = 0;
        canvas.height = 0;
    }
}
