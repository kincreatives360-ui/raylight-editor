import { describe, it, expect, vi } from 'vitest';
import { getExportDimensions, estimateExportMetrics } from './exportMetrics';
import { generateWaveformPeaks, decodeAudioFromDataUrl, clearWaveformCache, syncAudioPlayback, stopAudioPlayback } from './audioEngine';
import { runVideoExportPipeline } from './exporter';
import type { Project, AudioClip } from '../model/types';
import { createDefaultProject } from '../model/defaults';

describe('Export Metrics & Dimension Calculation Engine', () => {
    it('calculates correct dimensions for landscape, vertical, and square aspect ratios', () => {
        // 16:9 Landscape
        const landscape1080 = getExportDimensions('16:9', '1080p');
        expect(landscape1080).toEqual({ width: 1920, height: 1080 });

        const landscape4k = getExportDimensions('16:9', '4k');
        expect(landscape4k).toEqual({ width: 3840, height: 2160 });

        const landscape720 = getExportDimensions('16:9', '720p');
        expect(landscape720).toEqual({ width: 1280, height: 720 });

        // 9:16 Vertical
        const vertical1080 = getExportDimensions('9:16', '1080p');
        expect(vertical1080).toEqual({ width: 1080, height: 1920 });

        // 1:1 Square
        const square1080 = getExportDimensions('1:1', '1080p');
        expect(square1080).toEqual({ width: 1920, height: 1920 });

        // Always produces even integer dimensions for video codec compatibility
        const ultrawide = getExportDimensions('21:9', '1080p');
        expect(ultrawide.width % 2).toBe(0);
        expect(ultrawide.height % 2).toBe(0);
    });

    it('accurately estimates export frame counts, duration, and file sizes', () => {
        const project: Project = createDefaultProject();
        project.shots = [
            {
                ...project.shots[0],
                id: 'shot-1',
                name: 'Intro',
                startMs: 0,
                durationMs: 3000,
            },
            {
                ...project.shots[0],
                id: 'shot-2',
                name: 'Outro',
                startMs: 3000,
                durationMs: 2000,
            },
        ];

        // Entire project export at 30 fps (5000 ms = 5 sec -> 150 frames)
        const entireMetrics = estimateExportMetrics(project, {
            format: 'mp4',
            resolution: '1080p',
            fps: 30,
            quality: 'studio',
            scope: 'entire',
        });

        expect(entireMetrics.durationSec).toBe(5);
        expect(entireMetrics.totalFrames).toBe(150);
        expect(entireMetrics.width).toBe(1920);
        expect(entireMetrics.height).toBe(1080);
        expect(entireMetrics.estimatedSizeMb).toBeGreaterThan(0);

        // Single shot scope (shot-2: 2000 ms = 2 sec -> 60 frames)
        const shotMetrics = estimateExportMetrics(project, {
            format: 'mp4',
            resolution: '1080p',
            fps: 30,
            quality: 'studio',
            scope: 'shot',
            selectedShotId: 'shot-2',
        });

        expect(shotMetrics.durationSec).toBe(2);
        expect(shotMetrics.totalFrames).toBe(60);

        // GIF export forces 15 fps and caps long edge to 720p
        const gifMetrics = estimateExportMetrics(project, {
            format: 'gif',
            resolution: '4k',
            fps: 60,
            quality: 'studio',
            scope: 'entire',
        });
        expect(gifMetrics.width).toBe(1280);
        expect(gifMetrics.height).toBe(720);
        expect(gifMetrics.totalFrames).toBe(5 * 15);

        // PNG snapshot export has exactly 1 frame
        const pngMetrics = estimateExportMetrics(project, {
            format: 'png',
            resolution: '1080p',
            fps: 30,
            quality: 'studio',
            scope: 'entire',
        });
        expect(pngMetrics.totalFrames).toBe(1);
    });

    it('enforces lower clamping bounds for short durations, tiny project sizes, and estimated times', () => {
        const tinyProject: Project = {
            ...createDefaultProject(),
            shots: [
                {
                    ...createDefaultProject().shots[0],
                    startMs: 0,
                    durationMs: 40,
                },
            ],
        };

        const metrics = estimateExportMetrics(tinyProject, {
            format: 'mp4',
            resolution: '720p',
            fps: 30,
            quality: 'web',
            scope: 'shot',
            selectedShotId: tinyProject.shots[0].id,
        });

        // durationSec clamps to at least 0.5s
        expect(metrics.durationSec).toBeGreaterThanOrEqual(0.5);
        // totalFrames clamps to at least 1
        expect(metrics.totalFrames).toBeGreaterThanOrEqual(1);
        // estimatedTimeSec clamps to at least 2s for non-png exports
        expect(metrics.estimatedTimeSec).toBeGreaterThanOrEqual(2);
        // estimatedSizeMb clamps to at least 0.2MB
        expect(metrics.estimatedSizeMb).toBeGreaterThanOrEqual(0.2);
    });
});

describe('Audio Engine Waveform Generation & Peak Clamping', () => {
    it('generates clamped, deterministic waveform peaks for procedural audio clips', () => {
        const clipA: AudioClip = {
            id: 'clip-alpha',
            name: 'Ambient Groove',
            startMs: 0,
            durationMs: 4000,
            offsetMs: 0,
            volume: 1,
            muted: false,
        };

        const peaks1 = generateWaveformPeaks(clipA, 32);
        const peaks2 = generateWaveformPeaks(clipA, 32);

        expect(peaks1.length).toBe(32);
        // Deterministic identical output for identical clips
        expect(peaks1).toEqual(peaks2);

        // All values are normalized and clamped between [0.08, 1.0]
        for (const peak of peaks1) {
            expect(peak).toBeGreaterThanOrEqual(0.08);
            expect(peak).toBeLessThanOrEqual(1.0);
        }

        // Different clip identity yields different waveform contour
        const clipB: AudioClip = {
            ...clipA,
            id: 'clip-beta',
            name: 'Upbeat Drums',
        };
        const peaksB = generateWaveformPeaks(clipB, 32);
        expect(peaksB).not.toEqual(peaks1);

        // Enforces minimum count of 16 bars
        const minPeaks = generateWaveformPeaks(clipA, 4);
        expect(minPeaks.length).toBe(16);

        // LRU Cache returns identical array reference on repeated queries
        expect(peaks1).toBe(peaks2);

        // Renaming a clip produces a different waveform contour and cache entry
        const clipRenamed: AudioClip = {
            ...clipA,
            name: 'Ambient Groove Remastered',
        };
        const peaksRenamed = generateWaveformPeaks(clipRenamed, 32);
        expect(peaksRenamed).not.toEqual(peaks1);
        expect(peaksRenamed).not.toBe(peaks1);

        // After clearing cache, new instance is returned but with identical values
        clearWaveformCache();
        const peaksFresh = generateWaveformPeaks(clipA, 32);
        expect(peaksFresh).toEqual(peaks1);
        expect(peaksFresh).not.toBe(peaks1);
    });

    it('clamps true PCM waveform buffer peaks between [0.08, 1.0] even with extreme amplitudes', async () => {
        const mockPcm = new Float32Array(1000);
        // Half extremely quiet, half excessively loud
        for (let i = 0; i < 500; i++) mockPcm[i] = 0.00001;
        for (let i = 500; i < 1000; i++) mockPcm[i] = 8.0;

        const mockBuffer = {
            sampleRate: 1000,
            duration: 1,
            numberOfChannels: 1,
            getChannelData: () => mockPcm,
        } as unknown as AudioBuffer;

        const originalWindow = (globalThis as unknown as { window?: unknown }).window;
        const originalFetch = globalThis.fetch;

        class MockAudioContext {
            state = 'running';
            decodeAudioData = vi.fn().mockResolvedValue(mockBuffer);
            resume = vi.fn().mockResolvedValue(undefined);
        }

        (globalThis as unknown as { window: unknown }).window = {
            AudioContext: MockAudioContext,
        };

        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            statusText: 'OK',
            arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(16)),
        } as unknown as Response);

        try {
            const testDataUrl = 'data:audio/wav;base64,mockBufferClampingTest';
            const decoded = await decodeAudioFromDataUrl(testDataUrl);
            expect(decoded).toBe(mockBuffer);

            const clipWithBuffer: AudioClip = {
                id: 'clip-clamping-pcm',
                name: 'Extreme Dynamic Range',
                dataUrl: testDataUrl,
                startMs: 0,
                durationMs: 1000,
                offsetMs: 0,
                volume: 1,
                muted: false,
            };

            const peaks = generateWaveformPeaks(clipWithBuffer, 32);
            expect(peaks.length).toBe(32);
            for (const peak of peaks) {
                expect(peak).toBeGreaterThanOrEqual(0.08);
                expect(peak).toBeLessThanOrEqual(1.0);
            }
            // First peak should clamp to minimum 0.08
            expect(peaks[0]).toBeCloseTo(0.08, 2);
            // Last peak should clamp to maximum 1.0
            expect(peaks[peaks.length - 1]).toBe(1.0);
        } finally {
            (globalThis as unknown as { window: unknown }).window = originalWindow;
            globalThis.fetch = originalFetch;
        }
    });
});

describe('Audio Engine Concurrent Decoding', () => {
    it('handles concurrent decodeAudioFromDataUrl calls without errors and shares cached result', async () => {
        const mockBuffer = {
            sampleRate: 44100,
            duration: 2,
            numberOfChannels: 2,
            getChannelData: () => new Float32Array(500),
        } as unknown as AudioBuffer;

        const originalWindow = (globalThis as unknown as { window?: unknown }).window;
        const originalFetch = globalThis.fetch;

        class MockAudioContext {
            state = 'running';
            decodeAudioData = vi.fn().mockResolvedValue(mockBuffer);
            resume = vi.fn().mockResolvedValue(undefined);
        }

        (globalThis as unknown as { window: unknown }).window = {
            AudioContext: MockAudioContext,
        };

        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            statusText: 'OK',
            arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
        } as unknown as Response);

        try {
            const concurrentUrl = 'data:audio/wav;base64,concurrentAudioUrlTest';
            const [res1, res2, res3] = await Promise.all([
                decodeAudioFromDataUrl(concurrentUrl),
                decodeAudioFromDataUrl(concurrentUrl),
                decodeAudioFromDataUrl(concurrentUrl),
            ]);

            // All three concurrent calls must return the same cached instance
            expect(res1).toBe(res2);
            expect(res2).toBe(res3);
            // Subsequent call returns directly from cache
            const resCached = await decodeAudioFromDataUrl(concurrentUrl);
            expect(resCached).toBe(res1);
        } finally {
            (globalThis as unknown as { window: unknown }).window = originalWindow;
            globalThis.fetch = originalFetch;
        }
    });
});

describe('Export Pipeline Cancellation', () => {
    it('cleanly aborts runVideoExportPipeline when AbortSignal is triggered', async () => {
        const originalWindow = (globalThis as unknown as { window?: unknown }).window;
        const originalDocument = (globalThis as unknown as { document?: unknown }).document;

        const mockCanvas = {
            width: 100,
            height: 100,
            getContext: vi.fn(() => ({
                drawImage: vi.fn(),
                getImageData: vi.fn(() => ({ data: new Uint8Array(4) })),
            })),
            toBlob: vi.fn((cb) => cb(new Blob())),
        };

        (globalThis as unknown as { document: unknown }).document = {
            createElement: vi.fn((tag: string) => {
                if (tag === 'canvas') return mockCanvas;
                if (tag === 'a') return { href: '', download: '', click: vi.fn() };
                return {};
            }),
            getElementById: vi.fn(() => null),
            querySelector: vi.fn(() => null),
            body: {
                appendChild: vi.fn(),
                removeChild: vi.fn(),
            },
            fonts: { ready: Promise.resolve() },
        };

        (globalThis as unknown as { window: unknown }).window = {
            requestAnimationFrame: (cb: () => void) => setTimeout(cb, 0),
        };

        try {
            const project = createDefaultProject();
            const controller = new AbortController();
            controller.abort();

            const progressCalls: number[] = [];
            await expect(
                runVideoExportPipeline(
                    project,
                    (prog) => progressCalls.push(prog.frameIndex),
                    { format: 'gif' },
                    controller.signal
                )
            ).resolves.toBeUndefined();

            // The pipeline aborted before executing frame capture loop
            expect(progressCalls.length).toBeLessThanOrEqual(1);
        } finally {
            (globalThis as unknown as { document: unknown }).document = originalDocument;
            (globalThis as unknown as { window: unknown }).window = originalWindow;
        }
    });

    it('schedules both active and future audio clips using Web Audio lookahead timestamps (F-01)', async () => {
        const mockBuffer = {
            sampleRate: 44100,
            duration: 5,
            numberOfChannels: 2,
            getChannelData: () => new Float32Array(500),
        } as unknown as AudioBuffer;

        const startedSources: Array<{ when: number; offset: number; duration: number }> = [];
        const originalWindow = (globalThis as unknown as { window?: unknown }).window;
        const originalFetch = globalThis.fetch;

        class MockAudioContext {
            state = 'running';
            currentTime = 10;
            destination = {};
            decodeAudioData = vi.fn().mockResolvedValue(mockBuffer);
            resume = vi.fn().mockResolvedValue(undefined);
            createGain = vi.fn(() => ({
                gain: { value: 1, setValueAtTime: vi.fn() },
                connect: vi.fn(),
                disconnect: vi.fn(),
            }));
            createBufferSource = vi.fn(() => ({
                buffer: null as AudioBuffer | null,
                connect: vi.fn(),
                disconnect: vi.fn(),
                stop: vi.fn(),
                start: vi.fn((when: number, offset: number, duration: number) => {
                    startedSources.push({ when, offset, duration });
                }),
            }));
        }

        (globalThis as unknown as { window: unknown }).window = {
            AudioContext: MockAudioContext,
        };
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            statusText: 'OK',
            arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
        } as unknown as Response);

        try {
            const urlA = 'data:audio/wav;base64,lookaheadClipA';
            const urlB = 'data:audio/wav;base64,lookaheadClipB';
            await decodeAudioFromDataUrl(urlA);
            await decodeAudioFromDataUrl(urlB);

            syncAudioPlayback(
                {
                    masterVolume: 1,
                    muted: false,
                    clips: [
                        { id: 'c1', name: 'Active Now', dataUrl: urlA, startMs: 0, durationMs: 1000, offsetMs: 100, volume: 0.8, muted: false },
                        { id: 'c2', name: 'Future Clip', dataUrl: urlB, startMs: 1500, durationMs: 800, offsetMs: 200, volume: 0.9, muted: false },
                    ],
                },
                true,
                200
            );

            expect(startedSources.length).toBe(2);
            // Active clip starts immediately at ctx.currentTime (10s) with offset (100 + 200)/1000 = 0.3s
            expect(startedSources[0].when).toBeCloseTo(10, 3);
            expect(startedSources[0].offset).toBeCloseTo(0.3, 3);
            expect(startedSources[0].duration).toBeCloseTo(0.8, 3);
            // Future clip is scheduled at ctx.currentTime + (1500 - 200)/1000 = 11.3s with offset 0.2s
            expect(startedSources[1].when).toBeCloseTo(11.3, 3);
            expect(startedSources[1].offset).toBeCloseTo(0.2, 3);
            expect(startedSources[1].duration).toBeCloseTo(0.8, 3);
        } finally {
            stopAudioPlayback();
            (globalThis as unknown as { window: unknown }).window = originalWindow;
            globalThis.fetch = originalFetch;
        }
    });
});
