import { describe, expect, it } from 'vitest';
import {
    buildAudioMixPlan,
    DE_CLICK_RAMP_SEC,
    planRequiresBufferSeconds,
    type MixPlanClipInput,
} from './audioSchedule';

const clip = (overrides: Partial<MixPlanClipInput> & { id: string }): MixPlanClipInput => ({
    startMs: 0,
    durationMs: 1000,
    offsetMs: 0,
    volume: 1,
    muted: false,
    bufferDurationSec: 10,
    ...overrides,
});

describe('buildAudioMixPlan', () => {
    it('returns null for muted master, empty clips, or zero volume', () => {
        expect(buildAudioMixPlan([], {}, 0, 1000)).toBeNull();
        expect(buildAudioMixPlan([clip({ id: 'a' })], { muted: true }, 0, 1000)).toBeNull();
        expect(buildAudioMixPlan([clip({ id: 'a' })], { masterVolume: 0 }, 0, 1000)).toBeNull();
        expect(
            buildAudioMixPlan([clip({ id: 'a', muted: true })], {}, 0, 1000)
        ).toBeNull();
        expect(
            buildAudioMixPlan([clip({ id: 'a', volume: 0 })], {}, 0, 1000)
        ).toBeNull();
    });

    it('returns null when no clip overlaps the export window', () => {
        expect(
            buildAudioMixPlan([clip({ id: 'a', startMs: 5000 })], {}, 0, 1000)
        ).toBeNull();
        expect(
            buildAudioMixPlan([clip({ id: 'a', startMs: 0, durationMs: 500 })], {}, 1000, 2000)
        ).toBeNull();
    });

    it('schedules a fully-contained clip at its exact position', () => {
        const plan = buildAudioMixPlan(
            [clip({ id: 'a', startMs: 200, durationMs: 600 })],
            { masterVolume: 0.8 },
            0,
            2000
        );
        expect(plan).not.toBeNull();
        expect(plan!.durationSec).toBe(2);
        expect(plan!.entries).toHaveLength(1);
        const entry = plan!.entries[0];
        expect(entry.destOffsetSec).toBeCloseTo(0.2, 9);
        expect(entry.durationSec).toBeCloseTo(0.6, 9);
        expect(entry.sourceOffsetSec).toBeCloseTo(0, 9);
        expect(entry.gain).toBeCloseTo(0.8, 9);
        // Starts and ends inside the window → de-click ramps both ends.
        expect(entry.fadeInSec).toBeGreaterThan(0);
        expect(entry.fadeOutSec).toBeGreaterThan(0);
    });

    it('honours authored trim offsets when reading the buffer', () => {
        const plan = buildAudioMixPlan(
            [clip({ id: 'a', startMs: 0, durationMs: 1000, offsetMs: 250 })],
            {},
            0,
            2000
        );
        expect(plan!.entries[0].sourceOffsetSec).toBeCloseTo(0.25, 9);
        expect(plan!.entries[0].durationSec).toBeCloseTo(1, 9);
    });

    it('trims clips that start before the window (source offset advances)', () => {
        const plan = buildAudioMixPlan(
            [clip({ id: 'a', startMs: 0, durationMs: 3000, offsetMs: 0 })],
            {},
            1000,
            2000
        );
        const entry = plan!.entries[0];
        expect(entry.destOffsetSec).toBe(0);
        expect(entry.sourceOffsetSec).toBeCloseTo(1, 9);
        expect(entry.durationSec).toBeCloseTo(1, 9);
        // Cut at the window start: no authored fade-in (only de-click on new audio).
        expect(entry.fadeInSec).toBe(0);
    });

    it('never reads past the end of the decoded buffer', () => {
        const plan = buildAudioMixPlan(
            [clip({ id: 'a', startMs: 0, durationMs: 5000, bufferDurationSec: 0.5 })],
            {},
            0,
            10000
        );
        const entry = plan!.entries[0];
        expect(entry.durationSec).toBeCloseTo(0.5, 9);
        expect(planRequiresBufferSeconds(plan!)).toBeLessThanOrEqual(0.5);
    });

    it('skips clips whose trim consumes the whole buffer', () => {
        expect(
            buildAudioMixPlan(
                [clip({ id: 'a', offsetMs: 20000, bufferDurationSec: 1 })],
                {},
                0,
                1000
            )
        ).toBeNull();
    });

    it('mixes overlapping clips with independent gains', () => {
        const plan = buildAudioMixPlan(
            [
                clip({ id: 'a', startMs: 0, durationMs: 1500, volume: 0.5 }),
                clip({ id: 'b', startMs: 500, durationMs: 1500, volume: 1 }),
            ],
            { masterVolume: 0.9 },
            0,
            2000
        );
        expect(plan!.entries).toHaveLength(2);
        expect(plan!.entries[0].gain).toBeCloseTo(0.45, 9);
        expect(plan!.entries[1].gain).toBeCloseTo(0.9, 9);
        expect(plan!.entries[1].destOffsetSec).toBeCloseTo(0.5, 9);
    });

    it('is deterministic: identical inputs produce identical plans', () => {
        const inputs = [clip({ id: 'a', startMs: 100, durationMs: 800, offsetMs: 50, volume: 0.7 })];
        const one = buildAudioMixPlan(inputs, { masterVolume: 0.6 }, 0, 1000);
        const two = buildAudioMixPlan(inputs, { masterVolume: 0.6 }, 0, 1000);
        expect(two).toEqual(one);
    });

    it('applies de-click ramps bounded by half the clip duration', () => {
        const short = buildAudioMixPlan(
            [clip({ id: 'a', startMs: 0, durationMs: 4 })],
            {},
            0,
            1000
        );
        const entry = short!.entries[0];
        expect(entry.fadeInSec).toBeLessThanOrEqual(entry.durationSec / 2);
        expect(entry.fadeInSec).toBeLessThanOrEqual(DE_CLICK_RAMP_SEC);
    });
});
