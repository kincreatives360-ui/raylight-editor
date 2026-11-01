import { describe, expect, it } from 'vitest';
import {
    capturePercent,
    exportDurationMs,
    frameTimeMs,
    frameTimestampSec,
    totalFramesFor,
} from './frameMath';

describe('frameMath', () => {
    it('computes exact frame counts for standard durations and rates', () => {
        expect(totalFramesFor(1000, 30)).toBe(30);
        expect(totalFramesFor(1000, 60)).toBe(60);
        expect(totalFramesFor(5000, 24)).toBe(120);
        expect(totalFramesFor(2000, 30)).toBe(60);
        // Non-integral frame spans floor to whole frames, never round up.
        expect(totalFramesFor(1050, 30)).toBe(31);
    });

    it('never returns fewer than one frame', () => {
        expect(totalFramesFor(0, 30)).toBe(1);
        expect(totalFramesFor(-5, 30)).toBe(1);
        expect(totalFramesFor(10, 30)).toBe(1);
    });

    it('rejects invalid rates', () => {
        expect(() => totalFramesFor(1000, 0)).toThrow(RangeError);
        expect(() => totalFramesFor(1000, NaN)).toThrow(RangeError);
    });

    it('stamps frames at exact rational timestamps', () => {
        expect(frameTimestampSec(0, 30)).toBe(0);
        expect(frameTimestampSec(1, 30)).toBeCloseTo(1 / 30, 12);
        expect(frameTimestampSec(30, 30)).toBeCloseTo(1, 12);
        expect(frameTimestampSec(90, 60)).toBeCloseTo(1.5, 12);
        // Monotonic and never duplicated.
        const stamps = Array.from({ length: 31 }, (_, i) => frameTimestampSec(i, 30));
        for (let i = 1; i < stamps.length; i++) {
            expect(stamps[i]).toBeGreaterThan(stamps[i - 1]);
        }
    });

    it('rejects invalid frame indices', () => {
        expect(() => frameTimestampSec(-1, 30)).toThrow(RangeError);
        expect(() => frameTimestampSec(1.5, 30)).toThrow(RangeError);
    });

    it('maps frame indices onto the export window timeline', () => {
        expect(frameTimeMs(0, 30, 3000)).toBe(3000);
        expect(frameTimeMs(30, 30, 3000)).toBeCloseTo(4000, 9);
        expect(frameTimeMs(15, 30, 0)).toBeCloseTo(500, 9);
    });

    it('clamps export windows to a sane minimum', () => {
        expect(exportDurationMs(0, 1000)).toBe(1000);
        expect(exportDurationMs(0, 50)).toBe(200);
        expect(() => exportDurationMs(0, NaN)).toThrow(RangeError);
    });

    it('reports capture progress bounded to [0, 100]', () => {
        expect(capturePercent(0, 100)).toBe(0);
        expect(capturePercent(50, 100)).toBe(50);
        expect(capturePercent(100, 100)).toBe(100);
        expect(capturePercent(200, 100)).toBe(100);
        expect(capturePercent(1, 0)).toBe(0);
    });
});
