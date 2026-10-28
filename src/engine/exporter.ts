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
import { captureStageFrame } from './stageCapture';
import { validateRecordedVideo } from './recordingValidation';
import { IncrementalGifEncoder, gifFrameDelayCentiseconds } from './gifEncoder';

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

function nextFrame(): Promise<void> {
    return new Promise((resolve) => {
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => resolve());
        } else if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
            window.requestAnimationFrame(() => resolve());
        } else {
            setTimeout(resolve, 0);
        }
    });
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

function drawStageCanvas(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    width: number,
    height: number
): void {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(canvas, 0, 0, width, height);
}

// ============================================================================
// SELF-CONTAINED BINARY GIF89a LZW ENCODER (For Looping Animated GIF Exports)
// ============================================================================
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
    const stageCanvas = await captureStageFrame(timeMs, width, height);
    if (stageCanvas && stageCanvas.width > 0 && stageCanvas.height > 0) {
        drawStageCanvas(ctx, stageCanvas, width, height);
    } else {
        await renderProjectFrameToCanvas(ctx, project, evaluated, width, height);
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
type ExportTerminalState = 'running' | 'completed' | 'cancelled' | 'failed';

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

    const terminalStateRef = { value: 'running' as ExportTerminalState };
    const getTerminalState = (): ExportTerminalState => terminalStateRef.value;

    const handleAbort = () => {
        if (terminalStateRef.value === 'running') {
            terminalStateRef.value = 'cancelled';
        }
    };

    if (abortSignal) {
        if (abortSignal.aborted) {
            terminalStateRef.value = 'cancelled';
        } else {
            abortSignal.addEventListener('abort', handleAbort, { once: true });
        }
    }

    if (settings.format === 'png') {
        const targetShot =
            project.shots.find((s) => s.id === settings.selectedShotId) ||
            project.shots[0];
        const targetTimeMs =
            settings.scope === 'shot' && targetShot ? targetShot.startMs : 0;
        if (settings.onSeekFrame) {
            await settings.onSeekFrame(targetTimeMs);
            await nextFrame();
        }
        await exportCurrentFrameAsPng(
            project,
            project.name,
            targetTimeMs,
            settings.resolution
        );
        return;
    }

    if (abortSignal?.aborted || getTerminalState() === 'cancelled') {
        terminalStateRef.value = 'cancelled';
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

    if (abortSignal?.aborted || getTerminalState() === 'cancelled') {
        terminalStateRef.value = 'cancelled';
        return;
    }

    const totalProjectMs = project.shots.reduce(
        (max, s) => Math.max(max, s.startMs + s.durationMs),
        0
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
        const rawDims = getExportDimensions(
            project.aspectRatio,
            settings.resolution
        );
        const maxLongEdge = 1280;
        const longEdge = Math.max(rawDims.width, rawDims.height);
        const scale = longEdge > maxLongEdge ? maxLongEdge / longEdge : 1;
        const gifW = scale < 1 ? Math.round((rawDims.width * scale) / 2) * 2 : rawDims.width;
        const gifH = scale < 1 ? Math.round((rawDims.height * scale) / 2) * 2 : rawDims.height;
        const gifFps = 15;
        const totalFrames = Math.max(2, Math.floor((durationMs / 1000) * gifFps));

        const canvas = document.createElement('canvas');
        canvas.width = gifW;
        canvas.height = gifH;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const gifEncoder = new IncrementalGifEncoder(gifW, gifH);

        for (let f = 0; f < totalFrames; f++) {
            if (abortSignal?.aborted || getTerminalState() === 'cancelled') {
                terminalStateRef.value = 'cancelled';
                return;
            }
            const t = startMs + (f / gifFps) * 1000;
            if (settings.onSeekFrame) {
                await settings.onSeekFrame(t);
            }
            await syncAndSeekAllProjectVideos(project, t);
            await nextFrame();

            if (abortSignal?.aborted || getTerminalState() === 'cancelled') {
                terminalStateRef.value = 'cancelled';
                return;
            }

            const webglCanvas = await captureStageFrame(t, gifW, gifH);
            if (webglCanvas) {
                drawStageCanvas(ctx, webglCanvas, gifW, gifH);
            } else {
                const evaluated = evaluateProjectAtTime(project, t);
                await renderProjectFrameToCanvas(ctx, project, evaluated, gifW, gifH);
            }
            gifEncoder.addFrame(ctx.getImageData(0, 0, gifW, gifH), gifFrameDelayCentiseconds(f, gifFps));

            const percent = Math.round(((f + 1) / totalFrames) * 90);
            onProgress({
                frameIndex: f + 1,
                totalFrames,
                percent,
                statusText: `Capturing GIF Frame ${f + 1}/${totalFrames} (${percent}%)`,
            });
            await new Promise((r) => setTimeout(r, 12));
        }

        if (abortSignal?.aborted || getTerminalState() === 'cancelled') {
            terminalStateRef.value = 'cancelled';
            return;
        }

        onProgress({
            frameIndex: totalFrames,
            totalFrames,
            percent: 96,
            statusText: 'Encoding GIF89a LZW palette...',
        });
        await new Promise((r) => setTimeout(r, 20));

        if (abortSignal?.aborted || getTerminalState() === 'cancelled') {
            terminalStateRef.value = 'cancelled';
            return;
        }

        const gifBlob = gifEncoder.finish();

        if (abortSignal?.aborted || getTerminalState() === 'cancelled') {
            terminalStateRef.value = 'cancelled';
            return;
        }

        terminalStateRef.value = 'completed';
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

    // Strict format candidates constrained to requested format
    const mimeCandidatesByFormat = {
        mp4: [
            'video/mp4;codecs=avc1.4d002a,mp4a.40.2',
            'video/mp4;codecs=avc1.640033,mp4a.40.2',
            'video/mp4;codecs=avc1.4d002a',
            'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
            'video/mp4;codecs=avc1.42E01E',
            'video/mp4;codecs=h264',
            'video/mp4',
        ],
        webm: [
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp9',
            'video/webm;codecs=vp8,opus',
            'video/webm;codecs=vp8',
            'video/webm',
        ],
    } as const;

    if (settings.format !== 'mp4' && settings.format !== 'webm') {
        throw new Error(`Unsupported video export format: ${settings.format}`);
    }

    const candidates = mimeCandidatesByFormat[settings.format];
    const selectedMime =
        (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function'
            ? candidates.find((m) => MediaRecorder.isTypeSupported(m))
            : candidates[0]) || '';

    if (!selectedMime && typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function') {
        throw new Error(
            `The requested ${settings.format.toUpperCase()} export format is not supported by this browser.`
        );
    }

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

    // Prime a real frame before codec initialization to avoid an empty first capture.
    if (settings.onSeekFrame) await settings.onSeekFrame(startMs);
    await syncAndSeekAllProjectVideos(project, startMs);
    const initialStage = await captureStageFrame(startMs, width, height);
    if (initialStage) drawStageCanvas(ctx, initialStage, width, height);
    else await renderProjectFrameToCanvas(ctx, project, evaluateProjectAtTime(project, startMs), width, height);
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
        let hasStopped = false;

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
            terminalStateRef.value = 'failed';
            if (finalizationReject) {
                finalizationReject(err);
            }
        };
        recorder.onstop = async () => {
            if (hasStopped) return;
            hasStopped = true;
            stream.getTracks().forEach((track) => track.stop());

            if (recordingError) {
                terminalStateRef.value = 'failed';
                if (finalizationReject) {
                    finalizationReject(recordingError);
                }
                return;
            }

            // Cleanup only if cancelled or not completed. Never download for cancelled/failed work.
            if (getTerminalState() !== 'completed' || abortSignal?.aborted) {
                terminalStateRef.value = 'cancelled';
                if (finalizationResolve) {
                    finalizationResolve();
                }
                return;
            }

            if (chunks.length === 0) {
                const err = new Error('Video export finished without any recorded data.');
                recordingError = err;
                terminalStateRef.value = 'failed';
                if (finalizationReject) {
                    finalizationReject(err);
                }
                return;
            }

            try {
                const ext = settings.format === 'mp4' ? 'mp4' : 'webm';
                const actualMime =
                    recorder?.mimeType ||
                    selectedMime ||
                    (settings.format === 'mp4' ? 'video/mp4' : 'video/webm');

                const videoBlob = new Blob(chunks, {
                    type: actualMime,
                });
                await validateRecordedVideo(videoBlob);
                if (abortSignal?.aborted) { finalizationResolve?.(); return; }
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
                terminalStateRef.value = 'failed';
                if (finalizationReject) {
                    finalizationReject(error);
                }
            }
        };

        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Video recorder did not start.')), 10000);
            recorder!.onstart = () => { clearTimeout(timeout); resolve(); };
            recorder!.start(250);
        });

        let baseAudioTime = 0;

        for (let f = 0; f < totalFrames; f++) {
            if (abortSignal?.aborted || getTerminalState() === 'cancelled') {
                terminalStateRef.value = 'cancelled';
                return;
            }
            if (recordingError) {
                terminalStateRef.value = 'failed';
                throw recordingError;
            }

            // MediaRecorder uses wall-clock timestamps: skip overdue frames rather
            // than accumulating render/seek overhead into the exported duration.
            if (f > 0) {
                const elapsed = (audioContext ? audioContext.currentTime : performance.now() / 1000) - baseAudioTime;
                f = Math.max(f, Math.floor(elapsed * fps));
                if (f >= totalFrames) break;
            }
            const t = startMs + (f / fps) * 1000;
            if (settings.onSeekFrame) {
                await settings.onSeekFrame(t);
            }
            await syncAndSeekAllProjectVideos(project, t);
            await nextFrame();

            if (abortSignal?.aborted || getTerminalState() === 'cancelled') {
                terminalStateRef.value = 'cancelled';
                return;
            }

            const evaluated = evaluateProjectAtTime(project, t);
            const webglCanvas = await captureStageFrame(t, width, height);
            if (webglCanvas) {
                drawStageCanvas(ctx, webglCanvas, width, height);
            } else {
                await renderProjectFrameToCanvas(ctx, project, evaluated, width, height);
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

        if (abortSignal?.aborted || getTerminalState() === 'cancelled') {
            terminalStateRef.value = 'cancelled';
            return;
        }

        // All frames recorded successfully without cancellation
        terminalStateRef.value = 'completed';

        const activeRecorder = recorder;
        await new Promise<void>((resolve, reject) => {
            if (recordingError) {
                reject(recordingError);
                return;
            }
            if (getTerminalState() === 'cancelled' || abortSignal?.aborted) {
                resolve();
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

        if (getTerminalState() === 'completed' && !abortSignal?.aborted) {
            onProgress({
                frameIndex: totalFrames,
                totalFrames,
                percent: 100,
                statusText: 'Video Export Complete!',
            });
        }
    } finally {
        if (abortSignal) {
            abortSignal.removeEventListener('abort', handleAbort);
        }
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
