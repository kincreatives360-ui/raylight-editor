/**
 * Offline WebCodecs video export: render → encode → mux, timestamped by frame
 * data, never by wall clock.
 *
 * The mediabunny integration sits behind a small injectable layer so the
 * orchestration (frame order, timestamps, progress, abort, backpressure) is
 * unit-testable in Node while the real muxer/encoders run in the browser.
 */
import {
    ExportCancelledError,
    throwIfAborted,
    type ExportDeps,
    type ExportProgress,
    type VideoExportRequest,
} from './contract';
import { exportDurationMs, totalFramesFor } from './frameMath';
import { runFrameLoop } from './frameLoop';
import { videoBitrateFor } from '../exportMetrics';

export { videoBitrateFor };

/** Session over one output file being muxed. */
export interface MuxSession {
    addVideoFrame(source: CanvasImageSource, timestampSec: number): Promise<void>;
    addAudio(mixedBuffer: AudioBuffer): Promise<void>;
    finalize(): Promise<Blob>;
    cancel(): void;
}

export interface MuxerLayer {
    openSession(options: {
        format: 'mp4' | 'webm';
        width: number;
        height: number;
        fps: number;
        videoBitrate: number;
        hasAudio: boolean;
        audioSampleRate: number;
        audioChannels: number;
    }): Promise<MuxSession>;
    /** Whether this environment can encode the requested container at all. */
    isSupported(format: 'mp4' | 'webm', withAudio: boolean): Promise<boolean>;
}

/**
 * The default layer: mediabunny muxing with WebCodecs-backed encoders.
 * Dynamically imported so Node (unit tests) can import this module freely.
 */
export const mediabunnyLayer: MuxerLayer = {
    async openSession(options) {
        const {
            Output, BufferTarget, Mp4OutputFormat, WebMOutputFormat,
            VideoSampleSource, AudioBufferSource, VideoSample, Quality,
            getFirstEncodableVideoCodec, getFirstEncodableAudioCodec,
        } = await import('mediabunny');

        const videoCodec = options.format === 'mp4'
            ? await getFirstEncodableVideoCodec(['avc'])
            : await getFirstEncodableVideoCodec(['vp9', 'vp8']);
        if (!videoCodec) {
            throw new Error(
                `This browser cannot encode ${options.format.toUpperCase()} video.`
            );
        }
        const audioCodec = !options.hasAudio
            ? null
            : options.format === 'mp4'
                ? await getFirstEncodableAudioCodec(['aac'])
                : await getFirstEncodableAudioCodec(['opus']);
        if (options.hasAudio && !audioCodec) {
            throw new Error(
                `This browser cannot encode ${options.format.toUpperCase()} audio.`
            );
        }

        const target = new BufferTarget();
        const format = options.format === 'mp4'
            ? new Mp4OutputFormat({ fastStart: 'in-memory' })
            : new WebMOutputFormat({});

        const output = new Output({ format, target });

        const videoSource = new VideoSampleSource({
            codec: videoCodec,
            quality: new Quality({ bitrate: options.videoBitrate }),
            keyFrameInterval: 2,
        });
        output.addVideoTrack(videoSource);

        const audioSource = audioCodec
            ? new AudioBufferSource({
                codec: audioCodec,
                quality: new Quality({ bitrate: 192_000 }),
            })
            : null;
        if (audioSource) output.addAudioTrack(audioSource);

        output.start();
        let finished = false;

        return {
            async addVideoFrame(source, timestampSec) {
                // The frame is consumed synchronously by VideoFrame's ctor;
                // closing releases GPU buffers promptly under backpressure.
                const sample = new VideoSample(source, { timestamp: timestampSec });
                try {
                    await videoSource.add(sample);
                } finally {
                    sample.close();
                }
            },
            async addAudio(mixedBuffer) {
                if (!audioSource) {
                    throw new Error(
                        `Cannot mux audio into ${options.format.toUpperCase()}: no audio track was configured.`
                    );
                }
                await audioSource.add(mixedBuffer);
            },
            async finalize() {
                if (finished) throw new Error('Mux session already finalized');
                finished = true;
                videoSource.close();
                audioSource?.close();
                await output.finalize();
                const buffer = target.buffer;
                if (!buffer || buffer.byteLength === 0) {
                    throw new Error('Export finished without any encoded data.');
                }
                const mime = options.format === 'mp4' ? 'video/mp4' : 'video/webm';
                return new Blob([buffer], { type: mime });
            },
            cancel() {
                if (finished) return;
                finished = true;
                try {
                    videoSource.close();
                    audioSource?.close();
                    output.cancel();
                } catch {
                    // Cancellation races finalization; nothing to salvage.
                }
            },
        };
    },

    async isSupported(format, withAudio) {
        if (typeof VideoEncoder === 'undefined') return false;
        const { getFirstEncodableVideoCodec, getFirstEncodableAudioCodec } = await import('mediabunny');
        const videoCodecs = format === 'mp4' ? (['avc'] as const) : (['vp9', 'vp8'] as const);
        const video = await getFirstEncodableVideoCodec([...videoCodecs]);
        if (!video) return false;
        if (!withAudio) return true;
        const audioCodecs = format === 'mp4' ? (['aac'] as const) : (['opus'] as const);
        const audio = await getFirstEncodableAudioCodec([...audioCodecs]);
        return !!audio;
    },
};

export interface EncodeVideoOfflineResult {
    blob: Blob;
    frameCount: number;
    durationMs: number;
}

/**
 * Encodes [startMs, endMs) of the scene into an MP4/WebM file. Returns only
 * after the container is finalized; throws ExportCancelledError on abort and
 * ExportFrameError when any frame fails to render.
 */
export async function encodeVideoOffline(
    request: VideoExportRequest,
    deps: ExportDeps,
    layer: MuxerLayer = mediabunnyLayer
): Promise<EncodeVideoOfflineResult> {
    const { width, height, fps, format } = request;
    if (width % 2 !== 0 || height % 2 !== 0) {
        throw new Error(`Video export requires even dimensions, got ${width}×${height}.`);
    }
    const durationMs = exportDurationMs(request.startMs, request.endMs);
    const totalFrames = totalFramesFor(durationMs, fps);
    const hasAudio = !!deps.mixedAudio;

    throwIfAborted(deps.signal);

    const session = await layer.openSession({
        format,
        width,
        height,
        fps,
        videoBitrate: videoBitrateFor(request.quality, request.resolution, request.bitrateFactor ?? 1),
        hasAudio,
        audioSampleRate: deps.mixedAudio?.sampleRate ?? 48000,
        audioChannels: deps.mixedAudio?.numberOfChannels ?? 2,
    });

    const progress = (frameIndex: number): void => {
        const percent = Math.round((frameIndex / totalFrames) * 95);
        const report: ExportProgress = {
            frameIndex,
            totalFrames,
            percent,
            statusText: `Rendering ${request.resolution} frame ${frameIndex}/${totalFrames} (${percent}%)`,
        };
        deps.onProgress?.(report);
    };

    try {
        await runFrameLoop({
            totalFrames,
            fps,
            startMs: request.startMs,
            renderFrame: deps.renderFrame,
            signal: deps.signal,
            onFrame: (_index, source, timestampSec) =>
                session.addVideoFrame(source, timestampSec),
            onFrameCaptured: (index) => progress(index + 1),
        });

        throwIfAborted(deps.signal);

        if (deps.mixedAudio) {
            deps.onProgress?.({
                frameIndex: totalFrames,
                totalFrames,
                percent: 96,
                statusText: 'Mixing audio…',
            });
            await session.addAudio(deps.mixedAudio);
        }

        throwIfAborted(deps.signal);

        deps.onProgress?.({
            frameIndex: totalFrames,
            totalFrames,
            percent: 98,
            statusText: 'Finalizing container…',
        });
        const blob = await session.finalize();

        return { blob, frameCount: totalFrames, durationMs };
    } catch (error) {
        session.cancel();
        if (deps.signal?.aborted && !(error instanceof ExportCancelledError)) {
            throw new ExportCancelledError();
        }
        throw error;
    }
}
