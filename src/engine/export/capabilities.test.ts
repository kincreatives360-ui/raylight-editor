import { describe, expect, it } from 'vitest';
import { selectVideoFormat, type ExportCapabilities } from './capabilities';

const available = { available: true } as const;

function caps(overrides: Partial<ExportCapabilities>): ExportCapabilities {
    return {
        mp4: available,
        webm: available,
        gif: available,
        png: available,
        pngSeq: available,
        ...overrides,
    };
}

describe('selectVideoFormat', () => {
    it('honours the request when the format is fully supported', () => {
        expect(selectVideoFormat('mp4', caps({}))).toEqual({ format: 'mp4' });
        expect(selectVideoFormat('webm', caps({}))).toEqual({ format: 'webm' });
    });

    it('falls back MP4 → WebM with an explanatory note', () => {
        const result = selectVideoFormat(
            'mp4',
            caps({ mp4: { available: false, reason: 'No H.264 encoder.' } })
        );
        expect(result.format).toBe('webm');
        expect(result.fallbackNote).toContain('MP4 is unavailable');
        expect(result.fallbackNote).toContain('No H.264 encoder.');
        expect(result.fallbackNote).toContain('WebM');
    });

    it('falls back WebM → MP4 with an explanatory note', () => {
        const result = selectVideoFormat(
            'webm',
            caps({ webm: { available: false, reason: 'No VP9 encoder.' } })
        );
        expect(result.format).toBe('mp4');
        expect(result.fallbackNote).toContain('WebM is unavailable');
    });

    it('treats a video-only MP4 (no AAC) as unavailable for fallback purposes', () => {
        // Requested MP4 can mux video but not audio → engine falls back to a
        // format that supports the full request instead of silently dropping
        // the audio track.
        const result = selectVideoFormat(
            'mp4',
            caps({ mp4: { available: true, reason: 'Video only — no AAC audio.' } })
        );
        expect(result.format).toBe('webm');
        expect(result.fallbackNote).toContain('Video only');
    });

    it('throws an honest error when neither format is available', () => {
        expect(() =>
            selectVideoFormat(
                'mp4',
                caps({
                    mp4: { available: false, reason: 'WebCodecs is unavailable.' },
                    webm: { available: false, reason: 'WebCodecs is unavailable.' },
                })
            )
        ).toThrow(/WebCodecs is unavailable/);
    });
});
