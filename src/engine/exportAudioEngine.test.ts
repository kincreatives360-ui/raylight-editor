import { describe, it, expect } from 'vitest';
import { getExportDimensions, estimateExportMetrics } from './exportMetrics';
import { generateWaveformPeaks } from './audioEngine';
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
});

describe('Audio Engine Waveform Generation', () => {
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

        // All values are normalized and clamped between [0.05, 1.0]
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
    });
});
