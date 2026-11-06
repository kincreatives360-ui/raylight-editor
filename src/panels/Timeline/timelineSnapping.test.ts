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

    it('includes camera blocks, light blocks, and effect blocks in snap targets', () => {
        const shot = createDefaultShot({
            startMs: 0,
            durationMs: 3000,
            layers: [],
            cameraBlocks: [
                {
                    id: 'cam-1',
                    startMs: 200,
                    durationMs: 800,
                    fromFramingId: 'f1',
                    toFramingId: 'f2',
                    mode: 'dolly',
                    easing: { kind: 'preset', name: 'linear' },
                },
            ],
            lightBlocks: [
                {
                    id: 'light-1',
                    label: 'Light Move',
                    startMs: 1200,
                    durationMs: 600,
                    fromX: 0,
                    fromY: 0,
                    toX: 1,
                    toY: 1,
                    fromIntensity: 1,
                    toIntensity: 2,
                    easing: { kind: 'preset', name: 'linear' },
                },
            ],
            effectBlocks: [
                {
                    id: 'dof-rack-1',
                    label: 'Rack Focus',
                    effectKey: 'depthOfField',
                    startMs: 2000,
                    durationMs: 500,
                    fromValue: 0,
                    toValue: 1,
                    easing: { kind: 'preset', name: 'linear' },
                },
            ],
        });
        usePlayheadStore.setState({ currentTimeMs: 0 });

        const targets = getSnapTargets(shot);
        expect(targets).toContain(200);   // camera start
        expect(targets).toContain(1000);  // camera end
        expect(targets).toContain(1200);  // light start
        expect(targets).toContain(1800);  // light end
        expect(targets).toContain(2000);  // effect start
        expect(targets).toContain(2500);  // effect end
    });
});
