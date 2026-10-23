// src/engine/exporter.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runVideoExportPipeline, type ExportProgress } from './exporter';
import { createDefaultProject } from '../model/defaults';

describe('Export Pipeline: Cancellation, Format Respect, and GIF Resolution', () => {
    let originalWindow: unknown;
    let originalDocument: unknown;
    let originalMediaRecorder: unknown;
    let downloadedFiles: { filename: string; blob: Blob }[] = [];

    beforeEach(() => {
        downloadedFiles = [];
        originalWindow = (globalThis as unknown as { window?: unknown }).window;
        originalDocument = (globalThis as unknown as { document?: unknown }).document;
        originalMediaRecorder = (globalThis as unknown as { MediaRecorder?: unknown }).MediaRecorder;

        const contextProps: Record<string, unknown> = {
            getImageData: vi.fn((_x: number, _y: number, w: number, h: number) => ({
                data: new Uint8Array(w * h * 4),
                width: w,
                height: h,
            })),
            createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
            createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
            measureText: vi.fn(() => ({ width: 100 })),
            imageSmoothingEnabled: false,
            imageSmoothingQuality: 'low',
        };

        const mockCanvas: {
            width: number;
            height: number;
            getContext: unknown;
            toBlob: unknown;
            captureStream: unknown;
        } = {
            width: 1920,
            height: 1080,
            getContext: null,
            toBlob: vi.fn((cb: (blob: Blob) => void, type?: string) => cb(new Blob([], { type: type || 'image/png' }))),
            captureStream: vi.fn(() => ({
                getTracks: () => [{ stop: vi.fn() }],
                getVideoTracks: () => [{ requestFrame: vi.fn(), stop: vi.fn() }],
                addTrack: vi.fn(),
            })),
        };

        const mockCtx = new Proxy(contextProps, {
            get(target, prop: string) {
                if (prop in target) return target[prop];
                if (prop === 'canvas') return mockCanvas;
                target[prop] = vi.fn();
                return target[prop];
            },
            set(target, prop: string, value) {
                target[prop] = value;
                return true;
            },
        });

        mockCanvas.getContext = vi.fn(() => mockCtx);

        (globalThis as unknown as { document: unknown }).document = {
            createElement: vi.fn((tag: string) => {
                if (tag === 'canvas') return mockCanvas;
                if (tag === 'a') {
                    const anchor = {
                        href: '',
                        download: '',
                        click: vi.fn(() => {
                            downloadedFiles.push({ filename: anchor.download, blob: new Blob() });
                        }),
                    };
                    return anchor;
                }
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
            URL: {
                createObjectURL: vi.fn(() => 'blob:mock-url'),
                revokeObjectURL: vi.fn(),
            },
        };
    });

    afterEach(() => {
        (globalThis as unknown as { window?: unknown }).window = originalWindow;
        (globalThis as unknown as { document?: unknown }).document = originalDocument;
        (globalThis as unknown as { MediaRecorder?: unknown }).MediaRecorder = originalMediaRecorder;
    });

    it('P1: cancellation before first frame does not download a file', async () => {
        const project = createDefaultProject();
        const controller = new AbortController();
        controller.abort(); // already aborted

        const progressList: ExportProgress[] = [];
        await runVideoExportPipeline(
            project,
            (p) => progressList.push(p),
            { format: 'gif' },
            controller.signal
        );

        expect(downloadedFiles.length).toBe(0);
        expect(progressList.some((p) => p.statusText.includes('Complete'))).toBe(false);
    });

    it('P1: cancellation mid-export does not assemble or download a partial file', async () => {
        const project = createDefaultProject();
        const controller = new AbortController();
        let frameCount = 0;

        await runVideoExportPipeline(
            project,
            () => {
                frameCount++;
                if (frameCount >= 2) {
                    controller.abort();
                }
            },
            { format: 'gif' },
            controller.signal
        );

        expect(downloadedFiles.length).toBe(0);
    });

    it('P1: normal completion path triggers download', async () => {
        const project = createDefaultProject();
        project.shots = [{ ...project.shots[0], durationMs: 200 }];
        const controller = new AbortController();

        await runVideoExportPipeline(
            project,
            () => {},
            { format: 'gif', resolution: '720p' },
            controller.signal
        );

        expect(downloadedFiles.length).toBe(1);
        expect(downloadedFiles[0].filename).toMatch(/\.gif$/);
    });

    it('P1: respects requested format (webm vs mp4) and rejects unsupported format', async () => {
        // Mock MediaRecorder supporting only WebM
        class MockWebmOnlyRecorder {
            state = 'inactive';
            mimeType = 'video/webm;codecs=vp9';
            ondataavailable: ((ev: { data: Blob }) => void) | null = null;
            onstop: (() => void) | null = null;
            start() {
                this.state = 'recording';
            }
            stop() {
                this.state = 'inactive';
                if (this.ondataavailable) {
                    this.ondataavailable({ data: new Blob(['dummy-data'], { type: 'video/webm' }) });
                }
                if (this.onstop) this.onstop();
            }
            static isTypeSupported(mime: string) {
                return mime.startsWith('video/webm');
            }
        }
        (globalThis as unknown as { MediaRecorder: unknown }).MediaRecorder = MockWebmOnlyRecorder;

        const project = createDefaultProject();
        project.shots = [{ ...project.shots[0], durationMs: 200 }];

        // 1. Requesting WebM should succeed
        await expect(
            runVideoExportPipeline(
                project,
                () => {},
                { format: 'webm' }
            )
        ).resolves.toBeUndefined();

        // 2. Requesting MP4 when browser only supports WebM should throw an actionable error
        await expect(
            runVideoExportPipeline(
                project,
                () => {},
                { format: 'mp4' }
            )
        ).rejects.toThrow(/requested MP4 export format is not supported/i);
    });
});
