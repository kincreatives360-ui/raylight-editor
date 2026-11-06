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

    it('regenerates light source IDs, remaps targetLightId in lightBlocks, and remaps DoF focusLayerId', () => {
        const shot = createDefaultShot();
        const layer = createDefaultShapeLayer({ id: 'focal-layer' });
        shot.layers = [layer];
        shot.light = {
            ...shot.light,
            sources: [
                {
                    id: 'src-1',
                    name: 'Key Light',
                    type: 'spot',
                    enabled: true,
                    position: { x: 1, y: 2, z: 3 },
                    intensity: 1.5,
                    color: '#ffffff',
                },
            ],
        };
        shot.lightBlocks = [
            {
                id: 'lb-1',
                label: 'Light Move',
                targetLightId: 'src-1',
                startMs: 0,
                durationMs: 1000,
                fromX: 0,
                fromY: 0,
                toX: 1,
                toY: 1,
                fromIntensity: 1,
                toIntensity: 2,
                easing: { kind: 'preset', name: 'linear' },
            },
        ];
        shot.effects = {
            ...shot.effects,
            depthOfField: {
                ...shot.effects.depthOfField,
                focusLayerId: 'focal-layer',
            },
        };

        const cloned = cloneShotWithNewIds(shot);

        expect(cloned.light?.sources?.[0].id).not.toBe('src-1');
        expect(cloned.lightBlocks?.[0].targetLightId).toBe(cloned.light?.sources?.[0].id);
        expect(cloned.effects.depthOfField.focusLayerId).not.toBe('focal-layer');
        expect(cloned.effects.depthOfField.focusLayerId).toBe(cloned.layers[0].id);
    });
});
