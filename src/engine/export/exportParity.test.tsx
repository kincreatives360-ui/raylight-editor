import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createDefaultProject, createDefaultShot } from '../../model/defaults';
import {
    computeFilmGrainBitrateFactor,
    estimateExportMetrics,
    getExportDimensions,
} from '../exportMetrics';
import { videoBitrateFor, type MuxerLayer } from './webCodecsExporter';
import { IncrementalGifEncoder } from '../gifEncoder';
import { runOfflineExport } from './runOfflineExport';
import { runVideoExportPipeline, type ExportSettings } from '../exporter';
import { ExportModal, COMPRESSION_DESCRIPTIONS } from '../../ui/ExportModal';
import { ShotSettingsPanel } from '../../panels/Inspector/ShotSettingsPanel';
import * as audioMixdown from './audioMixdown';

describe('Export & Offline Render Pipeline Parity Suite', () => {
    describe('Phase 1: Resolution (480p), Film-Grain Bitrate & Metrics Deduplication', () => {
        it('computes 480p export dimensions across aspect ratios', () => {
            expect(getExportDimensions('16:9', '480p')).toEqual({ width: 854, height: 480 });
            expect(getExportDimensions('9:16', '480p')).toEqual({ width: 480, height: 854 });
            expect(getExportDimensions('1:1', '480p')).toEqual({ width: 854, height: 854 });
        });

        it('scales videoBitrateFor across 480p, 1080p, 4k, and film-grain factor', () => {
            expect(videoBitrateFor('social', '1080p')).toBe(12_000_000);
            expect(videoBitrateFor('social', '480p')).toBe(6_000_000);
            expect(videoBitrateFor('social', '4k')).toBe(30_000_000);
            expect(videoBitrateFor('social', '1080p', 2.0)).toBe(24_000_000);
        });

        it('computes film-grain bitrate factor from active shot effects and effectBlocks', () => {
            const project = createDefaultProject();
            expect(computeFilmGrainBitrateFactor(project, 0, 4000)).toEqual({
                hasFilmGrain: false,
                grainLoad: 0,
                bitrateFactor: 1,
            });

            project.shots[0].effects.filmGrain.enabled = true;
            project.shots[0].effects.filmGrain.intensity = 0.05; // 50% of 0.1 max load -> factor = 1 + 1.5 * 0.5 = 1.75
            const activeResult = computeFilmGrainBitrateFactor(project, 0, 4000);
            expect(activeResult.hasFilmGrain).toBe(true);
            expect(activeResult.grainLoad).toBeCloseTo(0.5, 5);
            expect(activeResult.bitrateFactor).toBeCloseTo(1.75, 5);
        });

        it('respects GIF resolution and FPS in estimateExportMetrics', () => {
            const project = createDefaultProject();
            const gifSettings30: ExportSettings = {
                format: 'gif',
                resolution: '1080p',
                fps: 30,
                quality: 'social',
                scope: 'entire',
            };
            const metrics = estimateExportMetrics(project, gifSettings30);
            expect(metrics.width).toBe(1920);
            expect(metrics.height).toBe(1080);
            expect(metrics.totalFrames).toBe(120); // 4s * 30fps
        });
    });

    describe('Phase 2: Offline Audio Mixdown Envelope Forwarding & GIF Loop Control', () => {
        it('forwards solo, fadeInMs, fadeOutMs, and assetId dataUrl fallback to prepareAudioMixPlan', async () => {
            const spy = vi.spyOn(audioMixdown, 'prepareAudioMixPlan').mockResolvedValue(null);
            const project = createDefaultProject();
            project.assets['audio-asset-1'] = {
                id: 'audio-asset-1',
                name: 'score.wav',
                mimeType: 'audio/wav',
                dataUrl: 'data:audio/wav;base64,ASSET_AUDIO',
                width: 0,
                height: 0,
            };
            project.audio = {
                muted: false,
                masterVolume: 0.85,
                clips: [
                    {
                        id: 'clip-solo',
                        name: 'Lead Vocal',
                        assetId: 'audio-asset-1',
                        startMs: 100,
                        durationMs: 2500,
                        offsetMs: 50,
                        volume: 0.9,
                        muted: false,
                        solo: true,
                        fadeInMs: 300,
                        fadeOutMs: 450,
                    },
                ],
            };

            const dummyLayer: MuxerLayer = {
                async openSession() {
                    return {
                        async addVideoFrame() {},
                        async addAudio() {},
                        async finalize() {
                            return new Blob([new Uint8Array([1, 2, 3])], { type: 'video/mp4' });
                        },
                        cancel() {},
                    };
                },
                async isSupported() {
                    return true;
                },
            };

            try {
                await runOfflineExport(
                    project,
                    {
                        format: 'mp4',
                        resolution: '720p',
                        fps: 24,
                        quality: 'web',
                        scope: 'entire',
                    },
                    {
                        onProgress: () => {},
                        muxerLayer: dummyLayer,
                        capabilities: {
                            mp4: { available: true },
                            webm: { available: true },
                            gif: { available: true },
                            png: { available: true },
                            pngSeq: { available: true },
                        },
                    },
                    async () => ({
                        renderFrame: async () => ({} as HTMLCanvasElement),
                        dispose: async () => {},
                    })
                );

                expect(spy).toHaveBeenCalledOnce();
                const [passedClips, passedMaster] = spy.mock.calls[0];
                expect(passedMaster).toEqual({ masterVolume: 0.85 });
                expect(passedClips[0]).toEqual({
                    id: 'clip-solo',
                    name: 'Lead Vocal',
                    startMs: 100,
                    durationMs: 2500,
                    offsetMs: 50,
                    volume: 0.9,
                    muted: false,
                    solo: true,
                    fadeInMs: 300,
                    fadeOutMs: 450,
                    dataUrl: 'data:audio/wav;base64,ASSET_AUDIO',
                });
            } finally {
                spy.mockRestore();
            }
        });

        it('includes NETSCAPE2.0 loop block by default and omits it when loop is false', async () => {
            const frame = {
                width: 2,
                height: 2,
                data: new Uint8ClampedArray(2 * 2 * 4),
            } as ImageData;

            const loopingEncoder = new IncrementalGifEncoder(2, 2, undefined, { loop: true });
            loopingEncoder.addFrame(frame, 4);
            const loopingBytes = new Uint8Array(await loopingEncoder.finish().arrayBuffer());
            const loopingAscii = String.fromCharCode(...loopingBytes);
            expect(loopingAscii).toContain('NETSCAPE2.0');

            const nonLoopingEncoder = new IncrementalGifEncoder(2, 2, undefined, { loop: false });
            nonLoopingEncoder.addFrame(frame, 4);
            const nonLoopingBytes = new Uint8Array(await nonLoopingEncoder.finish().arrayBuffer());
            const nonLoopingAscii = String.fromCharCode(...nonLoopingBytes);
            expect(nonLoopingAscii).not.toContain('NETSCAPE2.0');
        });
    });

    describe('Phase 3: Still Frame Playhead Export & Export Modal Parity', () => {
        beforeEach(() => {
            // Minimal canvas / document mock for still export
            const mockCtx = new Proxy(
                {
                    fillStyle: '#000',
                    imageSmoothingEnabled: true,
                    imageSmoothingQuality: 'high',
                    fillRect: vi.fn(),
                    drawImage: vi.fn(),
                    save: vi.fn(),
                    restore: vi.fn(),
                    clearRect: vi.fn(),
                    beginPath: vi.fn(),
                    rect: vi.fn(),
                    clip: vi.fn(),
                    translate: vi.fn(),
                    rotate: vi.fn(),
                    scale: vi.fn(),
                    measureText: vi.fn(() => ({ width: 50 })),
                    fillText: vi.fn(),
                    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
                    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
                },
                {
                    get(target, prop: string) {
                        if (prop in target) return (target as Record<string, unknown>)[prop];
                        return vi.fn();
                    },
                }
            );

            vi.stubGlobal('document', {
                createElement: vi.fn((tag: string) => {
                    if (tag === 'canvas') {
                        return {
                            width: 1920,
                            height: 1080,
                            getContext: vi.fn(() => mockCtx),
                            toBlob: vi.fn((cb: (b: Blob | null) => void, mime?: string) =>
                                cb(new Blob([new Uint8Array([1, 2, 3])], { type: mime || 'image/png' }))
                            ),
                        };
                    }
                    if (tag === 'a') {
                        return { href: '', download: '', click: vi.fn() };
                    }
                    return {};
                }),
                body: { appendChild: vi.fn(), removeChild: vi.fn() },
                fonts: { ready: Promise.resolve() },
            });
            vi.stubGlobal('URL', {
                createObjectURL: vi.fn(() => 'blob:still'),
                revokeObjectURL: vi.fn(),
            });
        });

        afterEach(() => {
            vi.unstubAllGlobals();
        });

        it('exports still frame at playheadTimeMs and invokes onSeekFrame with that time', async () => {
            const project = createDefaultProject();
            project.shots = [createDefaultShot({ id: 's1', startMs: 0, durationMs: 4000, layers: [] })];
            const seekTimes: number[] = [];

            await runVideoExportPipeline(
                project,
                () => {},
                {
                    format: 'png',
                    resolution: '1080p',
                    playheadTimeMs: 1850,
                    imageFormat: 'jpg',
                    imageDestination: 'file',
                    onSeekFrame: (t) => {
                        seekTimes.push(t);
                    },
                }
            );

            expect(seekTimes).toContain(1850);
        });

        it('renders GIF controls, Image controls, and Video compression descriptions in ExportModal', () => {
            const project = createDefaultProject();
            const shot = project.shots[0];
            const baseMetrics = {
                width: 1280,
                height: 720,
                estimatedSizeMb: 2.4,
                estimatedTimeSec: 3,
                hasFilmGrain: true,
                bitrateFactor: 1.75,
            };

            // 1. GIF Mode
            const gifHtml = renderToStaticMarkup(
                <ExportModal
                    isOpen={true}
                    onClose={() => {}}
                    exportSettings={{
                        format: 'gif',
                        resolution: '720p',
                        fps: 15,
                        quality: 'social',
                        scope: 'entire',
                        gifHighQuality: true,
                        gifLoop: true,
                    }}
                    setExportSettings={() => {}}
                    exportMetrics={baseMetrics}
                    project={project}
                    activeShot={shot}
                    exporting={false}
                    exportProgressText=""
                    exportPercent={0}
                    exportError={null}
                    onStartExport={() => {}}
                    onCancelExport={() => {}}
                />
            );
            expect(gifHtml).toContain('480P');
            expect(gifHtml).toContain('720P');
            expect(gifHtml).toContain('1080P');
            expect(gifHtml).toContain('15 FPS');
            expect(gifHtml).toContain('30 FPS');
            expect(gifHtml).toContain('High quality (slower export)');
            expect(gifHtml).toContain('Disable loop');
            expect(gifHtml).toContain('Film grain increases GIF file size');

            // 2. Image / PNG Still Mode
            const imageHtml = renderToStaticMarkup(
                <ExportModal
                    isOpen={true}
                    onClose={() => {}}
                    exportSettings={{
                        format: 'png',
                        resolution: '1080p',
                        fps: 60,
                        quality: 'social',
                        scope: 'entire',
                        imageFormat: 'jpg',
                        imageDestination: 'clipboard',
                    }}
                    setExportSettings={() => {}}
                    exportMetrics={baseMetrics}
                    project={project}
                    activeShot={shot}
                    exporting={false}
                    exportProgressText=""
                    exportPercent={0}
                    exportError={null}
                    onStartExport={() => {}}
                    onCancelExport={() => {}}
                />
            );
            expect(imageHtml).toContain('Exports the frame at the playhead.');
            expect(imageHtml).toContain('Image Format');
            expect(imageHtml).toContain('JPG');
            expect(imageHtml).toContain('Destination');
            expect(imageHtml).toContain('Clipboard');
            expect(imageHtml).toContain('Copy to Clipboard');

            // 3. Video Mode
            const videoHtml = renderToStaticMarkup(
                <ExportModal
                    isOpen={true}
                    onClose={() => {}}
                    exportSettings={{
                        format: 'mp4',
                        resolution: '1080p',
                        fps: 60,
                        quality: 'studio',
                        scope: 'entire',
                    }}
                    setExportSettings={() => {}}
                    exportMetrics={baseMetrics}
                    project={project}
                    activeShot={shot}
                    exporting={false}
                    exportProgressText=""
                    exportPercent={0}
                    exportError={null}
                    onStartExport={() => {}}
                    onCancelExport={() => {}}
                />
            );
            expect(videoHtml).toContain(COMPRESSION_DESCRIPTIONS.studio);
            expect(videoHtml).toContain('Film grain bitrate boost active');
        });

        it('renders "Export shot" button in ShotSettingsPanel', () => {
            const project = createDefaultProject();
            const shot = project.shots[0];
            const html = renderToStaticMarkup(
                <ShotSettingsPanel activeShot={shot} onOpenExportModal={() => {}} />
            );
            expect(html).toContain('Export shot');
        });
    });
});

