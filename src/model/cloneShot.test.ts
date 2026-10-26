import { describe, expect, it } from 'vitest';
import { createDefaultShot, createDefaultShapeLayer } from './defaults';
import { cloneShotWithNewIds } from './cloneShot';

describe('cloneShotWithNewIds', () => {
    it('regenerates owned group and layer IDs and remaps group/mask references', () => {
        const mask = createDefaultShapeLayer();
        const child = createDefaultShapeLayer();
        const shot = createDefaultShot();
        shot.groups = [{ id: 'parent', name: 'Parent', collapsed: false, hidden: false, locked: false },
            { id: 'nested', name: 'Nested', parentGroupId: 'parent', collapsed: false, hidden: false, locked: false }];
        shot.layers = [{ ...mask, id: 'mask', groupId: 'parent' },
            { ...child, id: 'child', groupId: 'nested', maskLayerId: 'mask' }];
        const copied = cloneShotWithNewIds(shot);
        expect(copied.id).not.toBe(shot.id);
        expect(copied.groups[1].parentGroupId).toBe(copied.groups[0].id);
        expect(copied.layers[1].groupId).toBe(copied.groups[1].id);
        expect(copied.layers[1].maskLayerId).toBe(copied.layers[0].id);
        expect(copied.layers[0].id).not.toBe('mask');
        expect(shot.layers[1].maskLayerId).toBe('mask');
    });
});
