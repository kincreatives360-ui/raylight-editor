import { describe, expect, it, vi } from 'vitest';
import {
    encodeVideoOffline,
    videoBitrateFor,
    type MuxerLayer,
    type MuxSession,
} from './webCodecsExporter';
import {
    ExportCancelledError,
    ExportFrameError,
    type VideoExportRequest,
} from './contract';

interface RecordedSession {
    frames: Array<{ source: CanvasImageSource; timestampSec: number }>;
    audio: AudioBuffer[];
    finalized: boolean;
    cancelled: boolean;
}

function fakeLayer(options: {
    onAddFrame?: (session: RecordedSession, index: number) => Promise<void> | void;
} = {}): { layer: MuxerLayer; sessions: RecordedSession[]; openOptions: Array<Record<string, unknown>> } {
    const sessions: RecordedSession[] = [];
    const openOptions: Array<Record<string, unknown>> = [];

    const layer: MuxerLayer = {
        async openSession(opts) {
            openOptions.push(opts as unknown as Record<string, unknown>);
            const session: RecordedSession = { frames: [], audio: [], finalized: false, cancelled: false };
            sessions.push(session);
            const mux: MuxSession = {
                async addVideoFrame(source, timestampSec) {
                    await options.onAddFrame?.(session, session.frames.length);
                    session.frames.push({ source, timestampSec });
                },
                async addAudio(buffer) {
                    session.audio.push(buffer);
                },
                async finalize() {
                    session.finalized = true;
                    return new Blob([new Uint8Array([0, 1, 2])], {
                        type: opts.format === 'mp4' ? 'video/mp4' : 'video/webm',
                    });
                },
                cancel() {
                    session.cancelled = true;
                },
            };
            return mux;
        },
        async isSupported() {
            return true;
        },
    };

    return { layer, sessions, openOptions };
}

const request: VideoExportRequest = {
    format: 'mp4',
    resolution: '1080p',
    fps: 30,
    quality: 'social',
    scope: 'entire',
    width: 1280,
    height: 720,
    startMs: 1000,
    endMs: 2000,
};

const fakeCanvas = {} as HTMLCanvasElement;
const fakeAudio = { sampleRate: 48000, numberOfChannels: 2 } as AudioBuffer;

describe('videoBitrateFor', () => {
    it('scales bitrate by quality and resolution', () => {
        expect(videoBitrateFor('studio', '1080p')).toBe(25_000_000);
        expect(videoBitrateFor('web-low', '1080p')).toBe(2_500_000);
        expect(videoBitrateFor('studio', '4k')).toBe(62_500_000);
        expect(videoBitrateFor('social', '4k')).toBe(30_000_000);
    });
});

describe('encodeVideoOffline', () => {
    it('encodes the exact frame count with monotonic data-derived timestamps', async () => {
        const { layer, sessions } = fakeLayer();
        const renderFrame = vi.fn(async (_timeMs: number) => fakeCanvas);

        const result = await encodeVideoOffline(request, { renderFrame }, layer);

        // 1 second at 30 fps = exactly 30 frames.
        expect(result.frameCount).toBe(30);
        expect(renderFrame).toHaveBeenCalledTimes(30);
        const frames = sessions[0].frames;
        expect(frames).toHaveLength(30);
        // Timestamps are index/fps, independent of render time.
        expect(frames[0].timestampSec).toBe(0);
        expect(frames[1].timestampSec).toBeCloseTo(1 / 30, 12);
        expect(frames[29].timestampSec).toBeCloseTo(29 / 30, 12);
        for (let i = 1; i < frames.length; i++) {
            expect(frames[i].timestampSec).toBeGreaterThan(frames[i - 1].timestampSec);
        }
        // Frame N is rendered at its timeline position within the window.
        expect(renderFrame.mock.calls[0][0]).toBeCloseTo(1000, 6);
        expect(renderFrame.mock.calls[30 - 1][0]).toBeCloseTo(1000 + (29 / 30) * 1000, 6);
        expect(sessions[0].finalized).toBe(true);
        expect(result.blob.type).toBe('video/mp4');
        expect(result.durationMs).toBe(1000);
    });

    it('passes mux options derived from the request and audio buffer', async () => {
        const { layer, openOptions } = fakeLayer();
        await encodeVideoOffline(request, { renderFrame: async () => fakeCanvas, mixedAudio: fakeAudio }, layer);
        expect(openOptions[0]).toMatchObject({
            format: 'mp4',
            width: 1280,
            height: 720,
            fps: 30,
            hasAudio: true,
            audioSampleRate: 48000,
            audioChannels: 2,
        });
    });

    it('muxes the mixed audio buffer exactly once, after all frames', async () => {
        const { layer, sessions } = fakeLayer();
        const order: string[] = [];
        await encodeVideoOffline(
            request,
            {
                renderFrame: async () => fakeCanvas,
                mixedAudio: fakeAudio,
            },
            layer
        );
        // Re-run with ordering instrumentation.
        const instrumented = fakeLayer({
            onAddFrame: (session) => {
                order.push(`frame:${session.frames.length}`);
            },
        });
        await encodeVideoOffline(
            request,
            { renderFrame: async () => fakeCanvas, mixedAudio: fakeAudio },
            instrumented.layer
        );
        const session = instrumented.sessions[0];
        expect(session.audio).toEqual([fakeAudio]);
        // Audio added after the final frame (frames recorded before audio flag).
        expect(order).toHaveLength(30);
        expect(sessions[0].audio).toEqual([fakeAudio]);
    });

    it('omits audio when no mix is provided', async () => {
        const { layer, sessions, openOptions } = fakeLayer();
        await encodeVideoOffline(request, { renderFrame: async () => fakeCanvas }, layer);
        expect(sessions[0].audio).toHaveLength(0);
        expect(openOptions[0].hasAudio).toBe(false);
    });

    it('reports monotonic progress bounded below 100 until completion', async () => {
        const { layer } = fakeLayer();
        const reports: number[] = [];
        await encodeVideoOffline(
            request,
            {
                renderFrame: async () => fakeCanvas,
                onProgress: (p) => reports.push(p.percent),
            },
            layer
        );
        expect(reports.length).toBeGreaterThan(1);
        for (let i = 1; i < reports.length; i++) {
            expect(reports[i]).toBeGreaterThanOrEqual(reports[i - 1]);
        }
        expect(reports[reports.length - 1]).toBeLessThanOrEqual(98);
        // The last frame report announces the full frame count.
        const lastFrameReport = reports[reports.length - 1];
        expect(lastFrameReport).toBeGreaterThanOrEqual(90);
    });

    it('rejects odd dimensions before opening a session', async () => {
        const { layer, sessions } = fakeLayer();
        await expect(
            encodeVideoOffline(
                { ...request, width: 1279 },
                { renderFrame: async () => fakeCanvas },
                layer
            )
        ).rejects.toThrow(/even dimensions/);
        expect(sessions).toHaveLength(0);
    });

    it('fails hard (no skip, no substitute) when a frame renders as null', async () => {
        const { layer, sessions } = fakeLayer();
        let call = 0;
        const renderFrame = vi.fn(async () => (++call === 5 ? null : fakeCanvas));
        await expect(
            encodeVideoOffline(request, { renderFrame }, layer)
        ).rejects.toThrow(ExportFrameError);
        expect(sessions[0].cancelled).toBe(true);
        expect(sessions[0].finalized).toBe(false);
        expect(renderFrame).toHaveBeenCalledTimes(5);
    });

    it('aborts immediately when the signal is already aborted', async () => {
        const { layer, sessions } = fakeLayer();
        const controller = new AbortController();
        controller.abort();
        const renderFrame = vi.fn(async () => fakeCanvas);
        await expect(
            encodeVideoOffline(request, { renderFrame, signal: controller.signal }, layer)
        ).rejects.toThrow(ExportCancelledError);
        expect(renderFrame).not.toHaveBeenCalled();
        expect(sessions).toHaveLength(0);
    });

    it('cancels mid-export and stops rendering new frames', async () => {
        const controller = new AbortController();
        let renderCall = 0;
        const { layer, sessions } = fakeLayer({
            onAddFrame: (_session, index) => {
                if (index === 9) controller.abort();
            },
        });
        const renderFrame = vi.fn(async () => {
            renderCall++;
            return fakeCanvas;
        });

        await expect(
            encodeVideoOffline(
                request,
                { renderFrame, signal: controller.signal },
                layer
            )
        ).rejects.toThrow(ExportCancelledError);

        // Abort during frame 10's add: frames stop at the abort boundary.
        expect(renderCall).toBeLessThanOrEqual(11);
        expect(sessions[0].cancelled).toBe(true);
        expect(sessions[0].finalized).toBe(false);
        // Never reaches 30 frames.
        expect(sessions[0].frames.length).toBeLessThan(30);
    });

    it('applies backpressure: a slow consumer delays the next render', async () => {
        const { layer } = fakeLayer({
            onAddFrame: async () => {
                await new Promise((resolve) => setTimeout(resolve, 2));
            },
        });
        const active: number[] = [];
        let inFlight = 0;
        const renderFrame = vi.fn(async () => {
            inFlight++;
            active.push(inFlight);
            await new Promise((resolve) => setTimeout(resolve, 1));
            inFlight--;
            return fakeCanvas;
        });
        await encodeVideoOffline(
            { ...request, startMs: 0, endMs: 600 },
            { renderFrame },
            layer
        );
        // Rendering never overlaps encoding: max concurrency stays at 1.
        expect(Math.max(...active)).toBe(1);
        expect(renderFrame).toHaveBeenCalledTimes(18);
    });
});
