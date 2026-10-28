import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ComponentProps } from 'react';
import type { ScrubInput } from '../../../ui/ScrubInput';
import type { LightAnimationBlock } from '../../../model/types';
import { LightBlockInspector } from './LightBlockInspector';

const { fields, updateShot } = vi.hoisted(() => ({
    fields: [] as ComponentProps<typeof ScrubInput>[],
    updateShot: vi.fn(),
}));
vi.mock('../../../ui/ScrubInput', () => ({ ScrubInput: (props: ComponentProps<typeof ScrubInput>) => { fields.push(props); return null; } }));
vi.mock('../../../store/useProjectStore', () => ({ useProjectStore: () => ({ updateShot }) }));
vi.mock('../../../ui/EasingControl', () => ({ EasingControl: () => null }));

const block: LightAnimationBlock = {
    id: 'block', label: 'Light', targetLightId: 'key', startMs: 0, durationMs: 1000,
    fromX: 0, fromY: 0, toX: 1, toY: 1, fromIntensity: 1, toIntensity: 2,
    easing: { kind: 'preset', name: 'linear' },
};

describe('light animation shared controls', () => {
    beforeEach(() => { fields.length = 0; updateShot.mockClear(); });

    it('retains timing clamps, coordinates, defaults and store targeting', () => {
        renderToStaticMarkup(<LightBlockInspector activeShotId="shot" activeLightBlock={block} onDone={() => {}} />);
        const start = fields.find((field) => field.label === 'Start')!;
        const duration = fields.find((field) => field.label === 'Duration')!;
        expect([start.min, start.step, duration.min, duration.step]).toEqual([0, 50, 50, 50]);
        expect(fields.find((field) => field.label === 'From Z')).toMatchObject({ value: 1, step: 0.05, decimals: 2 });
        expect(fields.find((field) => field.label === 'From Temp')).toMatchObject({ value: 6500, min: 2000, max: 10000, step: 100 });
        duration.onChange(-100);
        const [shotId, updater] = updateShot.mock.calls[0];
        expect(shotId).toBe('shot');
        const other = { ...block, id: 'other' };
        const result = updater({ lightBlocks: [block, other] });
        expect(result.lightBlocks[0].durationMs).toBe(50);
        expect(result.lightBlocks[1]).toBe(other);
    });

    it('retains ambience labels and limits without position/temperature controls', () => {
        renderToStaticMarkup(<LightBlockInspector activeShotId="shot" activeLightBlock={{ ...block, targetLightId: 'room', property: 'ambience' }} onDone={() => {}} />);
        expect(fields.map((field) => field.label)).toEqual(['Start', 'Duration', 'From', 'To']);
        expect(fields.find((field) => field.label === 'From')).toMatchObject({ min: 0, max: 1, step: 0.1, decimals: 2 });
    });
});
