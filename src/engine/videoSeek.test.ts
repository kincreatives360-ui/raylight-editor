// src/engine/videoSeek.test.ts
import { describe, it, expect, vi } from 'vitest';
import { seekVideoElement, syncAndSeekAllProjectVideos, clearVideoElementCache } from './canvasRenderer';
import { createMultiShotContractFixture } from '../model/defaults';

describe('Deterministic Video Seeking', () => {
    it('P2: waits for seeked event and resolves when frame is ready', async () => {
        let seekedCallback: (() => void) | null = null;
        const mockVideo = {
            currentTime: 0,
            readyState: 1,
            addEventListener: vi.fn((event: string, cb: () => void) => {
                if (event === 'seeked') seekedCallback = cb;
            }),
            removeEventListener: vi.fn(),
        } as unknown as HTMLVideoElement;

        const seekPromise = seekVideoElement(mockVideo, 1.5, 500);

        // Simulate seek completing
        (mockVideo as { currentTime: number }).currentTime = 1.5;
        if (seekedCallback) (seekedCallback as () => void)();

        await expect(seekPromise).resolves.toBeUndefined();
        expect(mockVideo.removeEventListener).toHaveBeenCalledWith('seeked', expect.any(Function));
    });

    it('P2: resolves immediately without event listener if video is already at requested timestamp', async () => {
        const mockVideo = {
            currentTime: 2.0,
            readyState: 4,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        } as unknown as HTMLVideoElement;

        await expect(seekVideoElement(mockVideo, 2.0, 500)).resolves.toBeUndefined();
        expect(mockVideo.addEventListener).not.toHaveBeenCalled();
    });

    it('P2: integrates with requestVideoFrameCallback when supported', async () => {
        let rvfcCallback: (() => void) | null = null;
        let seekedCallback: (() => void) | null = null;

        const mockVideo = {
            currentTime: 0,
            readyState: 2,
            requestVideoFrameCallback: vi.fn((cb: () => void) => {
                rvfcCallback = cb;
                return 42;
            }),
            cancelVideoFrameCallback: vi.fn(),
            addEventListener: vi.fn((event: string, cb: () => void) => {
                if (event === 'seeked') seekedCallback = cb;
            }),
            removeEventListener: vi.fn(),
        } as unknown as HTMLVideoElement;

        const seekPromise = seekVideoElement(mockVideo, 3.2, 500);

        (mockVideo as { currentTime: number }).currentTime = 3.2;
        if (seekedCallback) (seekedCallback as () => void)();

        expect(mockVideo.requestVideoFrameCallback).toHaveBeenCalled();
        if (rvfcCallback) (rvfcCallback as () => void)();

        await expect(seekPromise).resolves.toBeUndefined();
    });

    it('seeks video layers in Shot 2 using shot-local time instead of global project time (F-02)', async () => {
        const originalDocument = (globalThis as unknown as { document?: unknown }).document;
        const createdVideos: Array<{ src: string; currentTime: number }> = [];

        (globalThis as unknown as { document: unknown }).document = {
            createElement: vi.fn((tag: string) => {
                if (tag === 'video') {
                    const v = {
                        src: '',
                        currentTime: 0,
                        readyState: 4,
                        muted: false,
                        playsInline: false,
                        preload: 'auto',
                        crossOrigin: '',
                        load: vi.fn(),
                        pause: vi.fn(),
                        removeAttribute: vi.fn(),
                        addEventListener: vi.fn((event: string, cb: () => void) => {
                            if (event === 'seeked') setTimeout(cb, 0);
                        }),
                        removeEventListener: vi.fn(),
                    };
                    createdVideos.push(v);
                    return v;
                }
                return {};
            }),
        };

        try {
            clearVideoElementCache();
            const project = createMultiShotContractFixture();
            // Shot 2 starts at 3000ms; its video layer has inMs = 400ms.
            // At global time 4400ms, shotLocalTimeMs = 1400ms -> video targetSec = (1400 - 400) / 1000 = 1.0s
            await syncAndSeekAllProjectVideos(project, 4400);
            expect(createdVideos.length).toBeGreaterThanOrEqual(1);
            expect(createdVideos[0].currentTime).toBeCloseTo(1.0, 3);
        } finally {
            clearVideoElementCache();
            (globalThis as unknown as { document: unknown }).document = originalDocument;
        }
    });
});
