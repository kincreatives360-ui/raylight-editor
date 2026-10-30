import { describe, expect, it } from 'vitest';
import { createDefaultShot } from '../../model/defaults';
import { usePlayheadStore } from '../../store/usePlayheadStore';
import { getSnapTargets, snapTime } from './timelineSnapping';

describe('timeline snapping', () => {
    it('snaps to the closest target only inside the threshold', () => {
        expect(snapTime(52, [0, 50, 100], 5)).toEqual({ time: 50, snapped: true });
        expect(snapTime(55, [0, 50, 100], 5)).toEqual({ time: 55, snapped: false });
    });

    it('includes the shot edges and in-range playhead in snap targets', () => {
        const shot = createDefaultShot({ startMs: 500, durationMs: 1000, layers: [] });
        usePlayheadStore.setState({ currentTimeMs: 750 });

        expect(getSnapTargets(shot)).toEqual([0, 1000, 250]);
    });
});
