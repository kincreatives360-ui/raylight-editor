// src/engine/exporter.ts
import type { Project } from '../model/types';
import { evaluateProjectAtTime } from './evaluateShot';
import {
    preloadProjectImages,
    renderProjectFrameToCanvas,
    syncAndSeekAllProjectVideos,
} from './canvasRenderer';
import { getExportDimensions } from './exportMetrics';

export type ExportFormat = 'mp4' | 'gif' | 'png';
export type ExportResolution = '720p' | '1080p' | '4k';
export type ExportQuality = 'studio' | 'social' | 'web';
export type ExportScope = 'entire' | 'shot';

export interface ExportSettings {
    format: ExportFormat;
    resolution: ExportResolution;
    fps: 30 | 60;
    quality: ExportQuality;
    scope: ExportScope;
    selectedShotId?: string;
    onSeekFrame?: (timeMs: number) => Promise<void> | void;
}

export interface ExportProgress {
    frameIndex: number;
    totalFrames: number;
    percent: number;
    statusText: string;
}

function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(url), 3000);
}

// ============================================================================
// SELF-CONTAINED BINARY GIF89a LZW ENCODER (For Looping Animated GIF Exports)
// ============================================================================
function encodeLzwClearCodeStream(indices: Uint8Array): number[] {
    // Uses 8-bit color indices with periodic Clear Codes (256) every 120 pixels
    // so 9-bit LZW codes never overflow the dictionary—100% GIF89a compliant & fast!
    const CLEAR_CODE = 256;
    const EOI_CODE = 257;
    const subBlockBytes: number[] = [];

    let bitBuffer = 0;
    let bitCount = 0;

    const write9BitCode = (code: number) => {
        bitBuffer |= code << bitCount;
        bitCount += 9;
        while (bitCount >= 8) {
            subBlockBytes.push(bitBuffer & 0xff);
            bitBuffer >>= 8;
            bitCount -= 8;
        }
    };

    write9BitCode(CLEAR_CODE);
    for (let i = 0; i < indices.length; i++) {
        if (i > 0 && i % 120 === 0) {
            write9BitCode(CLEAR_CODE);
        }
        write9BitCode(indices[i]);
    }
    write9BitCode(EOI_CODE);

    if (bitCount > 0) {
        subBlockBytes.push(bitBuffer & 0xff);
    }

    // Packetize into 255-byte GIF sub-blocks
    const output: number[] = [8]; // LZW Minimum Code Size = 8
    for (let offset = 0; offset < subBlockBytes.length; offset += 255) {
        const chunk = subBlockBytes.slice(offset, offset + 255);
        output.push(chunk.length, ...chunk);
    }
    output.push(0); // Block Terminator
    return output;
}

function buildAnimatedGifBlob(
    framesData: ImageData[],
    width: number,
    height: number,
    delayCentiseconds: number
): Blob {
    const bytes: number[] = [];
    const writeByte = (b: number) => bytes.push(b & 0xff);
    const writeShort = (s: number) => {
        bytes.push(s & 0xff, (s >> 8) & 0xff);
    };
    const writeAscii = (str: string) => {
        for (let i = 0; i < str.length; i++) bytes.push(str.charCodeAt(i));
    };

    // 1. GIF89a Header & Logical Screen Descriptor
    writeAscii('GIF89a');
    writeShort(width);
    writeShort(height);
    writeByte(0xf7); // Global Color Table Flag (1) + 8-bit color (256 entries)
    writeByte(0);
    writeByte(0);

    // 2. Global 256-Color RGB332 Palette (3 bits R, 3 bits G, 2 bits B)
    for (let i = 0; i < 256; i++) {
        const r = ((i >> 5) & 0x07) * 36;
        const g = ((i >> 2) & 0x07) * 36;
        const b = (i & 0x03) * 85;
        writeByte(r);
        writeByte(g);
        writeByte(b);
    }

    // 3. Netscape 2.0 Infinite Loop Application Extension
    writeByte(0x21);
    writeByte(0xff);
    writeByte(11);
    writeAscii('NETSCAPE2.0');
    writeByte(3);
    writeByte(1);
    writeShort(0); // Loop forever
    writeByte(0);

    // 4. Encode Each Frame
    for (const frame of framesData) {
        // Graphic Control Extension (Frame Delay)
        writeByte(0x21);
        writeByte(0xf9);
        writeByte(4);
        writeByte(0x00);
        writeShort(delayCentiseconds);
        writeByte(0);
        writeByte(0);

        // Image Descriptor
        writeByte(0x2c);
        writeShort(0);
        writeShort(0);
        writeShort(width);
        writeShort(height);
        writeByte(0x00);

        // Map RGBA pixels to RGB332 palette indices
        const rgba = frame.data;
        const pixelCount = width * height;
        const indexed = new Uint8Array(pixelCount);
        for (let p = 0; p < pixelCount; p++) {
            const r = rgba[p * 4] >> 5;
            const g = rgba[p * 4 + 1] >> 5;
            const b = rgba[p * 4 + 2] >> 6;
            indexed[p] = (r << 5) | (g << 2) | b;
        }

        const compressed = encodeLzwClearCodeStream(indexed);
        for (let k = 0; k < compressed.length; k++) {
            bytes.push(compressed[k]);
        }
    }

    // 5. GIF Trailer
    writeByte(0x3b);
    return new Blob([new Uint8Array(bytes)], { type: 'image/gif' });
}

// ============================================================================
// EXPORT 1: HIGH-RES PNG STILL OF CURRENT FRAME
// ============================================================================
export async function exportCurrentFrameAsPng(
    project: Project,
    projectName: string,
    timeMs: number,
    resolution: ExportResolution = '1080p'
): Promise<void> {
    await preloadProjectImages(project);
    const { width, height } = getExportDimensions(
        project.aspectRatio,
        resolution
    );

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    await syncAndSeekAllProjectVideos(project, timeMs);

    // 1. Prefer capturing high-resolution frame directly from the active WebGL canvas
    const webglCanvas = document.querySelector('div[class*="overflow-hidden"] canvas') as HTMLCanvasElement | null;
    if (webglCanvas && webglCanvas.width > 0 && webglCanvas.height > 0) {
        ctx.drawImage(webglCanvas, 0, 0, width, height);
    } else {
        const evaluated = evaluateProjectAtTime(project, timeMs);
        renderProjectFrameToCanvas(ctx, project, evaluated, width, height);
    }

    const cleanName = projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const filename = `${cleanName || 'raylight'}-${Math.round(timeMs)}ms.png`;

    canvas.toBlob((blob) => {
        if (blob) downloadBlob(blob, filename);
    }, 'image/png');
}

// ============================================================================
// EXPORT 2: DETERMINISTIC VIDEO (MP4 / WEBM) OR ANIMATED GIF PIPELINE
// ============================================================================
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
        await exportCurrentFrameAsPng(
            project,
            project.name,
            0,
            settings.resolution
        );
        return;
    }

    onProgress({
        frameIndex: 0,
        totalFrames: 100,
        percent: 1,
        statusText: 'Preloading high-res textures & fonts...',
    });

    await preloadProjectImages(project);
    if (document.fonts?.ready) {
        await document.fonts.ready;
    }

    const totalProjectMs = project.shots.reduce(
        (max, s) => Math.max(max, s.startMs + s.durationMs),
        4000
    );
    const targetShot =
        project.shots.find((s) => s.id === settings.selectedShotId) ||
        project.shots[0];

    const startMs =
        settings.scope === 'shot' && targetShot ? targetShot.startMs : 0;
    const endMs =
        settings.scope === 'shot' && targetShot
            ? targetShot.startMs + targetShot.durationMs
            : totalProjectMs;
    const durationMs = Math.max(200, endMs - startMs);

    const cleanName =
        project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'raylight';

    // --------------------------------------------------------------------------
    // BRANCH A: ANIMATED GIF EXPORT
    // --------------------------------------------------------------------------
    if (settings.format === 'gif') {
        const gifDims = getExportDimensions(project.aspectRatio, '720p');
        const gifW = Math.round(gifDims.width * 0.5);
        const gifH = Math.round(gifDims.height * 0.5);
        const gifFps = 12;
        const totalFrames = Math.max(2, Math.floor((durationMs / 1000) * gifFps));

        const canvas = document.createElement('canvas');
        canvas.width = gifW;
        canvas.height = gifH;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const framesData: ImageData[] = [];

        for (let f = 0; f < totalFrames; f++) {
            if (abortSignal?.aborted) return;
            const t = startMs + (f / gifFps) * 1000;
            if (settings.onSeekFrame) {
                await settings.onSeekFrame(t);
            }
            await syncAndSeekAllProjectVideos(project, t);
            await new Promise((r) => requestAnimationFrame(r));
            const webglCanvas = document.querySelector('div[class*="overflow-hidden"] canvas') as HTMLCanvasElement | null;
            if (webglCanvas && webglCanvas.width > 0 && webglCanvas.height > 0) {
                ctx.drawImage(webglCanvas, 0, 0, gifW, gifH);
            } else {
                const evaluated = evaluateProjectAtTime(project, t);
                renderProjectFrameToCanvas(ctx, project, evaluated, gifW, gifH);
            }
            framesData.push(ctx.getImageData(0, 0, gifW, gifH));

            const percent = Math.round(((f + 1) / totalFrames) * 90);
            onProgress({
                frameIndex: f + 1,
                totalFrames,
                percent,
                statusText: `Capturing GIF Frame ${f + 1}/${totalFrames} (${percent}%)`,
            });
            await new Promise((r) => setTimeout(r, 12));
        }

        onProgress({
            frameIndex: totalFrames,
            totalFrames,
            percent: 96,
            statusText: 'Encoding GIF89a LZW palette...',
        });
        await new Promise((r) => setTimeout(r, 20));

        const gifBlob = buildAnimatedGifBlob(
            framesData,
            gifW,
            gifH,
            Math.round(100 / gifFps)
        );
        downloadBlob(gifBlob, `${cleanName}.gif`);

        onProgress({
            frameIndex: totalFrames,
            totalFrames,
            percent: 100,
            statusText: 'GIF Export Complete!',
        });
        return;
    }

    // --------------------------------------------------------------------------
    // BRANCH B: MP4 / WEBM HARDWARE VIDEO EXPORT
    // --------------------------------------------------------------------------
    const { width, height } = getExportDimensions(
        project.aspectRatio,
        settings.resolution
    );
    const fps = settings.fps;
    const totalFrames = Math.max(1, Math.floor((durationMs / 1000) * fps));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Prefer native H.264/MP4 when supported by browser, fallback to VP9 WebM
    const mp4MimeTypes = [
        'video/mp4;codecs=avc1.42E01E',
        'video/mp4;codecs=h264',
        'video/mp4',
        'video/webm;codecs=vp9',
        'video/webm',
    ];
    const selectedMime =
        mp4MimeTypes.find(
            (m) =>
                typeof MediaRecorder !== 'undefined' &&
                MediaRecorder.isTypeSupported(m)
        ) || '';

    const bitrate =
        settings.quality === 'studio'
            ? 18_000_000
            : settings.quality === 'social'
                ? 10_000_000
                : 5_000_000;

    if (
        typeof canvas.captureStream !== 'function' ||
        typeof MediaRecorder === 'undefined'
    ) {
        throw new Error('Video export is not supported by this browser.');
    }

    const stream = canvas.captureStream(fps);
    let recorder: MediaRecorder | null = null;
    try {
        recorder = new MediaRecorder(stream, {
            ...(selectedMime ? { mimeType: selectedMime } : {}),
            videoBitsPerSecond: bitrate,
        });
        const chunks: BlobPart[] = [];
        let recordingError: Error | null = null;
        let finalizationResolve: (() => void) | null = null;
        let finalizationReject: ((err: Error) => void) | null = null;

        recorder.ondataavailable = (ev) => {
            if (ev.data && ev.data.size > 0) chunks.push(ev.data);
        };
        recorder.onerror = (ev) => {
            stream.getTracks().forEach((track) => track.stop());
            const err =
                (ev as unknown as { error?: Error })?.error instanceof Error
                    ? (ev as unknown as { error: Error }).error
                    : new Error('The browser failed to record the video export.');
            recordingError = err;
            if (finalizationReject) {
                finalizationReject(err);
            }
        };
        recorder.onstop = () => {
            stream.getTracks().forEach((track) => track.stop());
            if (recordingError) {
                if (finalizationReject) {
                    finalizationReject(recordingError);
                }
                return;
            }
            if (chunks.length === 0) {
                const err = new Error('Video export finished without any recorded data.');
                recordingError = err;
                if (finalizationReject) {
                    finalizationReject(err);
                }
                return;
            }
            try {
                const isMp4 = selectedMime.includes('mp4');
                const ext = isMp4 ? 'mp4' : 'webm';
                const videoBlob = new Blob(chunks, {
                    type: recorder?.mimeType || selectedMime || 'video/webm',
                });
                downloadBlob(
                    videoBlob,
                    `${cleanName}-${settings.resolution}-${fps}fps.${ext}`
                );
                if (finalizationResolve) {
                    finalizationResolve();
                }
            } catch (err) {
                const error = err instanceof Error ? err : new Error(String(err));
                recordingError = error;
                if (finalizationReject) {
                    finalizationReject(error);
                }
            }
        };

        recorder.start();

        const frameDelayMs = Math.max(8, Math.round(1000 / fps));

        for (let f = 0; f <= totalFrames; f++) {
            if (abortSignal?.aborted) {
                return;
            }
            if (recordingError) {
                throw recordingError;
            }

            const t = startMs + (f / fps) * 1000;
            if (settings.onSeekFrame) {
                await settings.onSeekFrame(t);
            }
            await syncAndSeekAllProjectVideos(project, t);
            await new Promise((r) => requestAnimationFrame(r));

            const webglCanvas = document.querySelector('div[class*="overflow-hidden"] canvas') as HTMLCanvasElement | null;
            if (webglCanvas && webglCanvas.width > 0 && webglCanvas.height > 0) {
                ctx.drawImage(webglCanvas, 0, 0, width, height);
            } else {
                const evaluated = evaluateProjectAtTime(project, t);
                renderProjectFrameToCanvas(ctx, project, evaluated, width, height);
            }

            const percent = Math.round((f / totalFrames) * 100);
            onProgress({
                frameIndex: f,
                totalFrames,
                percent,
                statusText: `Rendering ${settings.resolution} Frame ${f}/${totalFrames} (${percent}%)`,
            });

            await new Promise((r) => setTimeout(r, frameDelayMs));
        }

        const activeRecorder = recorder;
        await new Promise<void>((resolve, reject) => {
            if (recordingError) {
                reject(recordingError);
                return;
            }
            if (!activeRecorder || activeRecorder.state === 'inactive') {
                reject(
                    recordingError ||
                        new Error('The browser failed to record the video export.')
                );
                return;
            }
            finalizationResolve = resolve;
            finalizationReject = reject;
            activeRecorder.stop();
        });

        onProgress({
            frameIndex: totalFrames,
            totalFrames,
            percent: 100,
            statusText: 'Video Export Complete!',
        });
    } finally {
        if (recorder && recorder.state !== 'inactive') {
            try {
                recorder.stop();
            } catch {
                // ignore
            }
        }
        stream.getTracks().forEach((track) => track.stop());
    }
}
