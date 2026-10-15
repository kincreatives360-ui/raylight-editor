// src/engine/exporter.ts
import type { Project, AspectRatio } from '../model/types';
import { evaluateProjectAtTime } from './evaluateShot';
import {
    preloadProjectImages,
    renderProjectFrameToCanvas,
} from './canvasRenderer';
import { ASPECT_RATIO_CONFIG } from '../stage/Stage';

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
}

export interface ExportProgress {
    frameIndex: number;
    totalFrames: number;
    percent: number;
    statusText: string;
}

export function getExportDimensions(
    aspectRatio: AspectRatio,
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
    } else {
        const height = baseLongEdge;
        const width = Math.round((height * aspect) / 2) * 2;
        return { width, height };
    }
}

// Calculates estimated render time and file size for the Export Dialog
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
        (max, s) => Math.max(max, s.startMs + s.durationMs),
        4000
    );
    const targetShot =
        project.shots.find((s) => s.id === settings.selectedShotId) ||
        project.shots[0];

    const durationMs =
        settings.scope === 'shot' && targetShot
            ? targetShot.durationMs
            : totalProjectMs;

    const durationSec = Math.max(0.5, durationMs / 1000);
    const effectiveFps = settings.format === 'gif' ? 15 : settings.fps;
    const totalFrames =
        settings.format === 'png'
            ? 1
            : Math.max(1, Math.floor(durationSec * effectiveFps));

    const bitrateMbps =
        settings.quality === 'studio'
            ? 16
            : settings.quality === 'social'
                ? 8
                : 4;
    const resScale = (width * height) / (1920 * 1080);

    const estimatedSizeMb =
        settings.format === 'png'
            ? Number((1.4 * resScale).toFixed(1))
            : settings.format === 'gif'
                ? Number((durationSec * 0.85).toFixed(1))
                : Number(((durationSec * bitrateMbps * resScale) / 8).toFixed(1));

    const estimatedTimeSec =
        settings.format === 'png'
            ? 1
            : Math.max(2, Math.ceil((totalFrames * (resScale > 2 ? 32 : 16)) / 1000));

    return {
        width,
        height,
        durationSec: Number(durationSec.toFixed(1)),
        totalFrames,
        estimatedTimeSec,
        estimatedSizeMb: Math.max(0.2, estimatedSizeMb),
    };
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

    const evaluated = evaluateProjectAtTime(project, timeMs);
    renderProjectFrameToCanvas(ctx, project, evaluated, width, height);

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
            const evaluated = evaluateProjectAtTime(project, t);
            renderProjectFrameToCanvas(ctx, project, evaluated, gifW, gifH);
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

    let recorder: MediaRecorder | null = null;
    const chunks: BlobPart[] = [];

    if (
        typeof canvas.captureStream === 'function' &&
        typeof MediaRecorder !== 'undefined'
    ) {
        const stream = canvas.captureStream(fps);
        recorder = new MediaRecorder(stream, {
            ...(selectedMime ? { mimeType: selectedMime } : {}),
            videoBitsPerSecond: bitrate,
        });
        recorder.ondataavailable = (ev) => {
            if (ev.data && ev.data.size > 0) chunks.push(ev.data);
        };
        recorder.start();
    }

    const frameDelayMs = Math.max(8, Math.round(1000 / fps));

    for (let f = 0; f <= totalFrames; f++) {
        if (abortSignal?.aborted) {
            if (recorder && recorder.state !== 'inactive') recorder.stop();
            return;
        }

        const t = startMs + (f / fps) * 1000;
        const evaluated = evaluateProjectAtTime(project, t);
        renderProjectFrameToCanvas(ctx, project, evaluated, width, height);

        const percent = Math.round((f / totalFrames) * 100);
        onProgress({
            frameIndex: f,
            totalFrames,
            percent,
            statusText: `Rendering ${settings.resolution} Frame ${f}/${totalFrames} (${percent}%)`,
        });

        await new Promise((r) => setTimeout(r, frameDelayMs));
    }

    if (recorder) {
        await new Promise<void>((resolve) => {
            if (!recorder) {
                resolve();
                return;
            }
            recorder.onstop = () => {
                const isMp4 = selectedMime.includes('mp4');
                const ext = isMp4 ? 'mp4' : 'webm';
                const videoBlob = new Blob(chunks, {
                    type: selectedMime || 'video/mp4',
                });
                downloadBlob(
                    videoBlob,
                    `${cleanName}-${settings.resolution}-${fps}fps.${ext}`
                );
                resolve();
            };
            recorder.stop();
        });
    }

    onProgress({
        frameIndex: totalFrames,
        totalFrames,
        percent: 100,
        statusText: 'Video Export Complete!',
    });
}