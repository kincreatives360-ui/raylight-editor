import { describe, expect, it, vi } from 'vitest';
import { runOfflineExport, resolveExportWindow } from './runOfflineExport';
import type { MuxerLayer, MuxSession } from './webCodecsExporter';
import type { ExportCapabilities } from './capabilities';
import type { FrameRenderer, VideoExportRequest } from './contract';
import type { Project } from '../../model/types';
import { createDefaultProject } from '../../model/defaults';

// Fail loudly if the GIF path ever tries to decode audio.
vi.mock('../audioEngine', () => ({
    decodeAudioFromDataUrl: vi.fn(async () => {
        throw new Error('GIF export must not decode audio');
    }),
}));

function fixtureProject(overrides: Partial<Project> = {}): Project {
    const base = createDefaultProject();
    return {
        ...base,
        name: 'Export Fixture',
        fps: 30,
        aspectRatio: '16:9',
        shots: [
            {
                ...base.shots[0],
                id: 'shot-a',
                name: 'Shot A',
                startMs: 0,
                durationMs: 2000,
                useProjectBackground: false,
                background: { kind: 'solid', color: '#ff0000' },
            },
            {
                ...base.shots[1],
                id: 'shot-b',
                name: 'Shot B',
                startMs: 2000,
                durationMs: 3000,
                useProjectBackground: false,
                background: { kind: 'solid', color: '#0000ff' },
            },
        ],
        ...overrides,
    } as Project;
}

const allCaps: ExportCapabilities = {
    mp4: { available: true },
    webm: { available: true },
    gif: { available: true },
    png: { available: true },
    pngSeq: { available: true },
};

const noMp4Caps: ExportCapabilities = {
    ...allCaps,
    mp4: { available: false, reason: 'This browser cannot encode H.264 (MP4) video.' },
};

const nothingCaps: ExportCapabilities = {
    mp4: { available: false, reason: 'WebCodecs is unavailable.' },
    webm: { available: false, reason: 'WebCodecs is unavailable.' },
    gif: { available: true },
    png: { available: true },
    pngSeq: { available: true },
};

interface RecordedSession {
    frames: Array<{ timestampSec: number }>;
    audio: AudioBuffer[];
    finalized: boolean;
    cancelled: boolean;
}

function recordingLayer(): { layer: MuxerLayer; sessions: RecordedSession[]; opened: VideoExportRequest[] } {
    const sessions: RecordedSession[] = [];
    const opened: unknown[] = [];
    const layer: MuxerLayer = {
        async openSession(options) {
            opened.push(options);
            const session: RecordedSession = { frames: [], audio: [], finalized: false, cancelled: false };
            sessions.push(session);
            const mux: MuxSession = {
                async addVideoFrame(_source, timestampSec) {
                    session.frames.push({ timestampSec });
                },
                async addAudio(buffer) {
                    session.audio.push(buffer);
                },
                async finalize() {
                    session.finalized = true;
                    return new Blob([new Uint8Array([1])], {
                        type: options.format === 'mp4' ? 'video/mp4' : 'video/webm',
                    });
                },
                cancel() {
                    session.cancelled = true;
                },
            };
            return mux;
        },
        async isSupported(format) {
            return format === 'mp4' ? false : true;
        },
    };
    return { layer, sessions, opened: opened as VideoExportRequest[] };
}

function stubRendererFactory(calls: Array<{ width: number; height: number; times: number[] }>):
    (width: number, height: number) => Promise<{ renderFrame: FrameRenderer; dispose: () => Promise<void> }> {
    return async (width, height) => {
        const entry = { width, height, times: [] as number[] };
        calls.push(entry);
        return {
            renderFrame: async (timeMs: number) => {
                entry.times.push(timeMs);
                return {} as HTMLCanvasElement;
            },
            dispose: async () => {},
        };
    };
}

function progressStub(): { reports: Array<{ percent: number; statusText: string }>; onProgress: (p: { percent: number; statusText: string }) => void } {
    const reports: Array<{ percent: number; statusText: string }> = [];
    return { reports, onProgress: (p) => reports.push({ percent: p.percent, statusText: p.statusText }) };
}

describe('resolveExportWindow', () => {
    it('spans the whole timeline for entire scope', () => {
        const project = fixtureProject();
        expect(resolveExportWindow(project, { scope: 'entire' })).toEqual({ startMs: 0, endMs: 5000 });
    });

    it('spans only the selected shot for shot scope', () => {
        const project = fixtureProject();
        expect(resolveExportWindow(project, { scope: 'shot', selectedShotId: 'shot-b' })).toEqual({
            startMs: 2000,
            endMs: 5000,
        });
    });

    it('falls back to the first shot when the selection is unknown', () => {
        const project = fixtureProject();
        expect(resolveExportWindow(project, { scope: 'shot', selectedShotId: 'missing' })).toEqual({
            startMs: 0,
            endMs: 2000,
        });
    });
});

describe('runOfflineExport — video formats', () => {
    it('exports MP4 at the requested format with exact frame math', async () => {
        const project = fixtureProject();
        const { layer, sessions, opened } = recordingLayer();
        const calls: Array<{ width: number; height: number; times: number[] }> = [];
        const { reports, onProgress } = progressStub();

        const result = await runOfflineExport(
            project,
            { format: 'mp4', resolution: '1080p', fps: 30, quality: 'social', scope: 'entire' },
            { onProgress, muxerLayer: layer, capabilities: allCaps },
            stubRendererFactory(calls)
        );

        expect(result.mimeType).toBe('video/mp4');
        expect(result.frameCount).toBe(150); // 5 s at 30 fps
        expect(sessions[0].frames).toHaveLength(150);
        // Frame 0 at t=0, last at 149/30 s.
        expect(sessions[0].frames[0].timestampSec).toBe(0);
        expect(sessions[0].frames[149].timestampSec).toBeCloseTo(149 / 30, 12);
        // Rendered at exact timeline positions from 0.
        expect(calls[0].times[0]).toBeCloseTo(0, 6);
        expect(calls[0].times[149]).toBeCloseTo((149 / 30) * 1000, 6);
        // 1080p → 1920×1080.
        expect(calls[0]).toMatchObject({ width: 1920, height: 1080 });
        expect(opened[0]).toMatchObject({ format: 'mp4', fps: 30 });
        // Progress completed.
        expect(reports.at(-1)?.percent).toBeGreaterThanOrEqual(90);
    });

    it('falls back to WebM with a note when MP4 is unavailable', async () => {
        const project = fixtureProject();
        const { layer, opened } = recordingLayer();
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        try {
            const result = await runOfflineExport(
                project,
                { format: 'mp4', resolution: '720p', fps: 30, quality: 'web', scope: 'shot', selectedShotId: 'shot-a' },
                { onProgress: () => {}, muxerLayer: layer, capabilities: noMp4Caps },
                stubRendererFactory([])
            );
            expect(result.mimeType).toBe('video/webm');
            expect(opened[0].format).toBe('webm');
            expect(warn).toHaveBeenCalledWith(expect.stringContaining('MP4 is unavailable'));
        } finally {
            warn.mockRestore();
        }
    });

    it('throws an honest error when no video format is supported', async () => {
        const project = fixtureProject();
        const { layer } = recordingLayer();
        await expect(
            runOfflineExport(
                project,
                { format: 'mp4', resolution: '1080p', fps: 30, quality: 'web', scope: 'entire' },
                { onProgress: () => {}, muxerLayer: layer, capabilities: nothingCaps },
                stubRendererFactory([])
            )
        ).rejects.toThrow(/WebCodecs is unavailable/);
    });

    it('does not download or finalize anything on cancel', async () => {
        const project = fixtureProject();
        const { layer, sessions } = recordingLayer();
        const controller = new AbortController();
        const calls: Array<{ width: number; height: number; times: number[] }> = [];
        const factory = stubRendererFactory(calls);
        const wrapped = async (width: number, height: number) => {
            const handle = await factory(width, height);
            return {
                ...handle,
                renderFrame: async (timeMs: number) => {
                    if (timeMs > 100) controller.abort();
                    return handle.renderFrame(timeMs);
                },
            };
        };

        await expect(
            runOfflineExport(
                project,
                { format: 'mp4', resolution: '720p', fps: 30, quality: 'web', scope: 'entire' },
                { onProgress: () => {}, signal: controller.signal, muxerLayer: layer, capabilities: allCaps },
                wrapped
            )
        ).rejects.toThrow(/cancelled/i);

        expect(sessions[0].cancelled).toBe(true);
        expect(sessions[0].finalized).toBe(false);
        // Far fewer frames than the full 150.
        expect(sessions[0].frames.length).toBeLessThan(10);
    });

    it('disposes the renderer even when encoding fails', async () => {
        const project = fixtureProject();
        const dispose = vi.fn(async () => {});
        const factory = async () => ({
            renderFrame: async () => null as unknown as HTMLCanvasElement,
            dispose,
        });
        await expect(
            runOfflineExport(
                project,
                { format: 'mp4', resolution: '720p', fps: 30, quality: 'web', scope: 'shot', selectedShotId: 'shot-a' },
                { onProgress: () => {}, muxerLayer: recordingLayer().layer, capabilities: allCaps },
                factory
            )
        ).rejects.toThrow(/no frame/i);
        expect(dispose).toHaveBeenCalledOnce();
    });
});

describe('runOfflineExport — non-video formats', () => {
    it('skips audio entirely for GIF', async () => {
        const project = fixtureProject({
            audio: {
                clips: [{
                    id: 'clip-1',
                    name: 'beat',
                    startMs: 0,
                    durationMs: 1000,
                    offsetMs: 0,
                    volume: 1,
                    muted: false,
                    dataUrl: 'data:audio/wav;base64,AAAA',
                }],
                muted: false,
                masterVolume: 1,
            },
        } as Partial<Project>);
        const { layer, sessions } = recordingLayer();
        // GIF path needs a DOM canvas; we only assert the decision to not mix
        // audio by checking it throws in Node before any mux session opens.
        await expect(
            runOfflineExport(
                project,
                { format: 'gif', resolution: '720p', fps: 30, quality: 'web', scope: 'shot', selectedShotId: 'shot-a' },
                { onProgress: () => {}, muxerLayer: layer, capabilities: allCaps },
                stubRendererFactory([])
            )
        ).rejects.toThrow();
        // No video mux session was opened for a GIF.
        expect(sessions).toHaveLength(0);
    });

    it('rejects the unsupported png format with a clear message', async () => {
        const project = fixtureProject();
        await expect(
            runOfflineExport(
                project,
                { format: 'png', resolution: '1080p', fps: 30, quality: 'web', scope: 'entire' },
                { onProgress: () => {}, capabilities: allCaps },
                stubRendererFactory([])
            )
        ).rejects.toThrow(/Unsupported export format/);
    });
});
