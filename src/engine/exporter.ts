// src/engine/exporter.ts
import type { Project } from '../model/types';
import { evaluateProjectAtTime } from './evaluateShot';
import {
    preloadProjectImages,
    renderProjectFrameToCanvas,
    syncAndSeekAllProjectVideos,
} from './canvasRenderer';
import { getExportDimensions } from './exportMetrics';
import { decodeAudioFromDataUrl } from './audioEngine';

export type ExportFormat = 'mp4' | 'webm' | 'gif' | 'png';
export type ExportResolution = '720p' | '1080p' | '4k';
export type ExportQuality = 'studio' | 'social' | 'web';
export type ExportScope = 'entire' | 'shot';

export interface ExportSettings {
    format: ExportFormat;
    resolution: ExportResolution;
    fps: 24 | 30 | 60;
    quality: ExportQuality;
    scope: ExportScope;
    selectedShotId?: string;
    onSeekFrame?: (timeMs: number) => Promise<void> | void;
}

import { isWebCodecsSupported, isMediaRecorderMp4Supported } from './exportCapabilities';
export { isWebCodecsSupported, isMediaRecorderMp4Supported };

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
function encodeLzwClearCodeStream(indices: Uint8Array): Uint8Array {
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
    const numBlocks = Math.ceil(subBlockBytes.length / 255);
    const totalLen = 1 + subBlockBytes.length + numBlocks + 1;
    const output = new Uint8Array(totalLen);
    let ptr = 0;
    output[ptr++] = 8; // LZW Minimum Code Size = 8

    for (let offset = 0; offset < subBlockBytes.length; offset += 255) {
        const chunkSize = Math.min(255, subBlockBytes.length - offset);
        output[ptr++] = chunkSize;
        for (let j = 0; j < chunkSize; j++) {
            output[ptr++] = subBlockBytes[offset + j];
        }
    }
    output[ptr++] = 0; // Block Terminator
    return output.slice(0, ptr);
}

function buildAnimatedGifBlob(
    framesData: ImageData[],
    width: number,
    height: number,
    delayCentiseconds: number
): Blob {
    const chunks: Uint8Array[] = [];

    // Header buffer (Header, LSD, GCT, Netscape extension)
    const header = new Uint8Array(800);
    let hPtr = 0;
    const writeAscii = (str: string) => {
        for (let i = 0; i < str.length; i++) header[hPtr++] = str.charCodeAt(i);
    };
    const writeShort = (s: number) => {
        header[hPtr++] = s & 0xff;
        header[hPtr++] = (s >> 8) & 0xff;
    };

    writeAscii('GIF89a');
    writeShort(width);
    writeShort(height);
    header[hPtr++] = 0xf7;
    header[hPtr++] = 0;
    header[hPtr++] = 0;

    // 2. Global 256-Color RGB332 Palette
    for (let i = 0; i < 256; i++) {
        header[hPtr++] = ((i >> 5) & 0x07) * 36;
        header[hPtr++] = ((i >> 2) & 0x07) * 36;
        header[hPtr++] = (i & 0x03) * 85;
    }

    // 3. Netscape 2.0 Infinite Loop Application Extension
    header[hPtr++] = 0x21;
    header[hPtr++] = 0xff;
    header[hPtr++] = 11;
    writeAscii('NETSCAPE2.0');
    header[hPtr++] = 3;
    header[hPtr++] = 1;
    writeShort(0);
    header[hPtr++] = 0;

    chunks.push(header.slice(0, hPtr));

    // 4. Encode Each Frame
    for (const frame of framesData) {
        const frameHeader = new Uint8Array(18);
        let fPtr = 0;
        // Graphic Control Extension
        frameHeader[fPtr++] = 0x21;
        frameHeader[fPtr++] = 0xf9;
        frameHeader[fPtr++] = 4;
        frameHeader[fPtr++] = 0x00;
        frameHeader[fPtr++] = delayCentiseconds & 0xff;
        frameHeader[fPtr++] = (delayCentiseconds >> 8) & 0xff;
        frameHeader[fPtr++] = 0;
        frameHeader[fPtr++] = 0;

        // Image Descriptor
        frameHeader[fPtr++] = 0x2c;
        frameHeader[fPtr++] = 0;
        frameHeader[fPtr++] = 0;
        frameHeader[fPtr++] = 0;
        frameHeader[fPtr++] = 0;
        frameHeader[fPtr++] = width & 0xff;
        frameHeader[fPtr++] = (width >> 8) & 0xff;
        frameHeader[fPtr++] = height & 0xff;
        frameHeader[fPtr++] = (height >> 8) & 0xff;
        frameHeader[fPtr] = 0x00;

        chunks.push(frameHeader);

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
        chunks.push(compressed);
    }

    // 5. GIF Trailer
    chunks.push(new Uint8Array([0x3b]));
    return new Blob(chunks as BlobPart[], { type: 'image/gif' });
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

    // Evaluate and render the exact requested timeMs frame to canvas
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
        format: isMediaRecorderMp4Supported() ? 'mp4' : 'webm',
        resolution: '1080p',
        fps: project.fps,
        quality: 'social',
        scope: 'entire',
        ...customSettings,
    };

    if (settings.format === 'png') {
        const targetShot =
            project.shots.find((s) => s.id === settings.selectedShotId) ||
            project.shots[0];
        const targetTimeMs =
            settings.scope === 'shot' && targetShot ? targetShot.startMs : 0;
        if (settings.onSeekFrame) {
            await settings.onSeekFrame(targetTimeMs);
            await new Promise((r) => requestAnimationFrame(r));
        }
        await exportCurrentFrameAsPng(
            project,
            project.name,
            targetTimeMs,
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
            const webglCanvas =
                (document.getElementById('raylight-stage-webgl-canvas') as HTMLCanvasElement | null) ||
                (document.querySelector('div[class*="overflow-hidden"] canvas') as HTMLCanvasElement | null);
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

    // Prefer native H.264/MP4 when supported by browser, with high/main profiles and VP9/VP8 WebM fallbacks
    const mp4MimeTypes = [
        'video/mp4;codecs=avc1.4d002a,mp4a.40.2',
        'video/mp4;codecs=avc1.640033,mp4a.40.2',
        'video/mp4;codecs=avc1.4d002a',
        'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
        'video/mp4;codecs=avc1.42E01E',
        'video/mp4;codecs=h264',
        'video/mp4',
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=vp8',
        'video/webm',
    ];
    const selectedMime =
        mp4MimeTypes.find(
            (m) =>
                typeof MediaRecorder !== 'undefined' &&
                MediaRecorder.isTypeSupported(m)
        ) || '';

    const bitrateMultiplier = settings.resolution === '4k' ? 2.5 : 1;
    const bitrate = Math.round(
        (settings.quality === 'studio'
            ? 18_000_000
            : settings.quality === 'social'
                ? 10_000_000
                : 5_000_000) * bitrateMultiplier
    );

    if (
        typeof canvas.captureStream !== 'function' ||
        typeof MediaRecorder === 'undefined'
    ) {
        throw new Error('Video export is not supported by this browser.');
    }

    const stream = canvas.captureStream(fps);

    // CRITICAL FIX: Mix down project audio tracks and attach to the recording stream
    let audioContext: AudioContext | null = null;
    let audioDest: MediaStreamAudioDestinationNode | null = null;
    const isProjectAudioMuted = !project.audio || project.audio.muted || (project.audio.masterVolume ?? 1) <= 0;
    const activeAudioClips = isProjectAudioMuted
        ? []
        : (project.audio?.clips || []).filter(
            (clip) => !clip.muted && (clip.volume ?? 1) > 0 && clip.dataUrl
        );

    const clipBuffers = new Map<string, AudioBuffer>();
    if (activeAudioClips.length > 0 && typeof AudioContext !== 'undefined') {
        try {
            const AudioContextClass =
                window.AudioContext ||
                (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            audioContext = new AudioContextClass();
            audioDest = audioContext.createMediaStreamDestination();
            const audioTrack = audioDest.stream.getAudioTracks()[0];
            if (audioTrack) {
                stream.addTrack(audioTrack);
            }
            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }
            await Promise.all(
                activeAudioClips
                    .filter((clip) => clip.dataUrl && !clipBuffers.has(clip.dataUrl))
                    .map(async (clip) => {
                        const buf = await decodeAudioFromDataUrl(clip.dataUrl!);
                        if (buf) {
                            clipBuffers.set(clip.dataUrl!, buf);
                        }
                    })
            );
        } catch (e) {
            console.warn('[Exporter] Audio track integration skipped:', e);
        }
    }

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
                const actualMime = recorder?.mimeType || selectedMime;
                const isMp4 = actualMime.includes('mp4');
                const ext = isMp4 ? 'mp4' : 'webm';
                const videoBlob = new Blob(chunks, {
                    type: actualMime || 'video/webm',
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

        let baseAudioTime = 0;

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

            const evaluated = evaluateProjectAtTime(project, t);
            const webglCanvas =
                (document.getElementById('raylight-stage-webgl-canvas') as HTMLCanvasElement | null) ||
                (document.querySelector('div[class*="overflow-hidden"] canvas') as HTMLCanvasElement | null);
            const isNativeResolution =
                webglCanvas &&
                webglCanvas.width >= width * 0.75 &&
                webglCanvas.height >= height * 0.75;

            if (isNativeResolution) {
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(webglCanvas, 0, 0, width, height);
            } else {
                renderProjectFrameToCanvas(ctx, project, evaluated, width, height);
            }

            const captureTrack = stream.getVideoTracks()[0] as (MediaStreamTrack & { requestFrame?: () => void }) | undefined;
            if (typeof captureTrack?.requestFrame === 'function') {
                captureTrack.requestFrame();
            }

            if (f === 0) {
                baseAudioTime = audioContext ? audioContext.currentTime : performance.now() / 1000;
                if (audioContext && audioDest) {
                    for (const clip of activeAudioClips) {
                        const clipEnd = clip.startMs + clip.durationMs;
                        if (clipEnd <= startMs || clip.startMs >= endMs) continue;

                        const buffer = clip.dataUrl ? clipBuffers.get(clip.dataUrl) : null;
                        if (!buffer) continue;

                        const source = audioContext.createBufferSource();
                        source.buffer = buffer;
                        const gain = audioContext.createGain();
                        const clipVol = (clip.volume ?? 1) * (project.audio?.masterVolume ?? 1);
                        gain.gain.setValueAtTime(clipVol, baseAudioTime);
                        source.connect(gain);
                        gain.connect(audioDest);

                        const effectiveStartMs = Math.max(startMs, clip.startMs);
                        const effectiveEndMs = Math.min(endMs, clipEnd);
                        const playDuration = Math.max(0, (effectiveEndMs - effectiveStartMs) / 1000);
                        const scheduledStart = baseAudioTime + Math.max(0, (clip.startMs - startMs) / 1000);
                        const elapsedBeforeStart = Math.max(0, startMs - clip.startMs);
                        const bufferOffset = Math.max(0, ((clip.offsetMs || 0) + elapsedBeforeStart) / 1000);
                        const remainingBufferTime = Math.max(0, buffer.duration - bufferOffset);
                        const safePlayDuration = Math.min(playDuration, remainingBufferTime);

                        if (safePlayDuration > 0 && bufferOffset < buffer.duration) {
                            source.start(scheduledStart, bufferOffset, safePlayDuration);
                        }
                    }
                }
            }

            const percent = Math.round((f / totalFrames) * 100);
            onProgress({
                frameIndex: f,
                totalFrames,
                percent,
                statusText: `Rendering ${settings.resolution} Frame ${f}/${totalFrames} (${percent}%)`,
            });

            if (f < totalFrames) {
                const nextFrameTargetTime = baseAudioTime + (f + 1) / fps;
                const currentAudioTime = audioContext ? audioContext.currentTime : performance.now() / 1000;
                const delayMs = Math.max(0, (nextFrameTargetTime - currentAudioTime) * 1000);
                if (delayMs > 0) {
                    await new Promise((r) => setTimeout(r, delayMs));
                }
            }
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
        if (audioContext) {
            audioContext.close().catch(() => {});
        }
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
