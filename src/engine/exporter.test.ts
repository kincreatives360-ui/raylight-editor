// src/engine/exporter.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runVideoExportPipeline, type ExportProgress } from './exporter';
import { ExportCancelledError } from './export/contract';
import { createDefaultProject } from '../model/defaults';
import type { Project } from '../model/types';

interface MockCanvas {
    width: number;
    height: number;
    getContext: (type: string) => unknown;
    toBlob: (cb: (blob: Blob | null) => void, type?: string) => void;
}

describe('Offline export pipeline: cancellation, downloads, and format honesty', () => {
    let originalDocument: unknown;
    let originalUrl: unknown;
    let canvasSizes: Array<{ width: number; height: number }>;
    let downloadedFiles: { filename: string }[];
    let createdBlobs: Blob[];

    const makeCtx = (canvas: MockCanvas) => {
        const props: Record<string, unknown> = {
            canvas,
            getImageData: vi.fn((_x: number, _y: number, w: number, h: number) => ({
                data: new Uint8ClampedArray(w * h * 4),
                width: w,
                height: h,
            })),
            createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
            createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
            createPattern: vi.fn(() => ({})),
            measureText: vi.fn(() => ({ width: 100 })),
            imageSmoothingEnabled: false,
            imageSmoothingQuality: 'low',
        };
        return new Proxy(props, {
            get(target, prop: string) {
                if (prop in target) return target[prop];
                target[prop] = vi.fn();
                return target[prop];
            },
            set(target, prop: string, value) {
                target[prop] = value;
                return true;
            },
        });
    };

    const makeCanvas = (): MockCanvas => {
        const canvas: MockCanvas = {
            width: 0,
            height: 0,
            getContext: vi.fn(() => {
                // Engines assign width/height before requesting the context and
                // zero them in finally-blocks; snapshot the configured size now.
                canvasSizes.push({ width: canvas.width, height: canvas.height });
                return makeCtx(canvas);
            }),
            toBlob: vi.fn((cb: (blob: Blob | null) => void, type?: string) =>
                cb(new Blob([new Uint8Array([1, 2, 3])], { type: type || 'image/png' }))
            ),
        };
        return canvas;
    };

    beforeEach(() => {
        canvasSizes = [];
        downloadedFiles = [];
        createdBlobs = [];
        originalDocument = (globalThis as unknown as { document?: unknown }).document;
        originalUrl = (globalThis as unknown as { URL?: unknown }).URL;

        (globalThis as unknown as { document: unknown }).document = {
            createElement: vi.fn((tag: string) => {
                if (tag === 'canvas') return makeCanvas();
                if (tag === 'a') {
                    const anchor = {
                        href: '',
                        download: '',
                        click: vi.fn(() => {
                            downloadedFiles.push({ filename: anchor.download });
                        }),
                    };
                    return anchor;
                }
                return {};
            }),
            body: { appendChild: vi.fn(), removeChild: vi.fn() },
            fonts: { ready: Promise.resolve() },
        };

        (globalThis as unknown as { URL: unknown }).URL = {
            createObjectURL: vi.fn((blob: Blob) => {
                createdBlobs.push(blob);
                return 'blob:mock-url';
            }),
            revokeObjectURL: vi.fn(),
        };
    });

    afterEach(() => {
        (globalThis as unknown as { document?: unknown }).document = originalDocument;
        (globalThis as unknown as { URL?: unknown }).URL = originalUrl;
    });

    const shortProject = (): Project => {
        const project = createDefaultProject();
        project.name = 'Export Fixture';
        project.shots = [{ ...project.shots[0], durationMs: 200 }];
        return project;
    };

    it('rejects with ExportCancelledError before the first frame and downloads nothing', async () => {
        const controller = new AbortController();
        controller.abort();

        const progressList: ExportProgress[] = [];
        await expect(
            runVideoExportPipeline(
                shortProject(),
                (p) => progressList.push(p),
                { format: 'gif' },
                controller.signal
            )
        ).rejects.toThrow(ExportCancelledError);

        expect(downloadedFiles).toHaveLength(0);
        expect(progressList.some((p) => p.percent === 100)).toBe(false);
    });

    it('rejects with ExportCancelledError mid-export and downloads nothing', async () => {
        const controller = new AbortController();
        let progressCount = 0;

        await expect(
            runVideoExportPipeline(
                shortProject(),
                () => {
                    progressCount++;
                    if (progressCount >= 2) controller.abort();
                },
                { format: 'gif' },
                controller.signal
            )
        ).rejects.toThrow(ExportCancelledError);

        expect(downloadedFiles).toHaveLength(0);
    });

    it('completes a GIF export, downloads a .gif, and reports 100%', async () => {
        const progressList: ExportProgress[] = [];
        await runVideoExportPipeline(
            shortProject(),
            (p) => progressList.push(p),
            { format: 'gif', resolution: '720p' }
        );

        expect(downloadedFiles).toHaveLength(1);
        expect(downloadedFiles[0].filename).toMatch(/\.gif$/);
        expect(downloadedFiles[0].filename).toContain('export-fixture');
        expect(createdBlobs[0]?.type).toBe('image/gif');
        const final = progressList.at(-1);
        expect(final?.percent).toBe(100);
        expect(final?.statusText).toContain('complete');
    }, 15000);

    it('caps GIF to a 1280px long edge at 4K while preserving aspect ratio', async () => {
        await runVideoExportPipeline(
            shortProject(),
            () => {},
            { format: 'gif', resolution: '4k' }
        );

        expect(downloadedFiles).toHaveLength(1);
        // The GIF encode canvas is 1280×720 even though export size is 4K.
        expect(canvasSizes.some((s) => s.width === 1280 && s.height === 720)).toBe(true);
    }, 15000);

    it('exports a lossless PNG sequence as a .zip with numbered frames', async () => {
        await runVideoExportPipeline(
            shortProject(),
            () => {},
            { format: 'png-seq', resolution: '720p', fps: 24 }
        );

        expect(downloadedFiles).toHaveLength(1);
        expect(downloadedFiles[0].filename).toMatch(/\.zip$/);
        expect(createdBlobs[0]?.type).toBe('application/zip');
        // ZIP local header signature.
        const bytes = new Uint8Array(await createdBlobs[0]!.arrayBuffer());
        expect(Array.from(bytes.slice(0, 2))).toEqual([0x50, 0x4b]);
    }, 15000);

    it('exports a PNG still through the same stage path', async () => {
        await runVideoExportPipeline(shortProject(), () => {}, { format: 'png', resolution: '1080p' });

        expect(downloadedFiles).toHaveLength(1);
        expect(downloadedFiles[0].filename).toMatch(/-0ms\.png$/);
        expect(downloadedFiles[0].filename).toContain('export-fixture');
    }, 15000);

    it('fails honestly (no download) when no video codec is available', async () => {
        // Node has no VideoEncoder → both MP4 and WebM are unavailable.
        await expect(
            runVideoExportPipeline(shortProject(), () => {}, { format: 'mp4' })
        ).rejects.toThrow(/H\.264|WebM|WebCodecs/);

        expect(downloadedFiles).toHaveLength(0);
    });
});
