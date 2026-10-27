import { describe, expect, it } from 'vitest';
import { createDefaultShapeLayer, createDefaultTextLayer, createDefaultShot } from '../../model/defaults';
import { addBlocksToShot, availableAnimations, availablePresets, presetList, replacePresets } from './animationModel';
describe('object-aware animation controls', () => {
    it('limits typography presets and animations to text selections', () => {
        const text = createDefaultTextLayer();
        const shape = createDefaultShapeLayer();
        expect(availablePresets([text]).map(p => p.type)).toContain('typewriter');
        expect(availablePresets([text, shape]).map(p => p.type)).not.toContain('typewriter');
        expect(availableAnimations([shape]).map(p => p.property)).not.toContain('counter');
        expect(availableAnimations([text]).map(p => p.property)).toContain('changeText');
    });
    it('adds independent blocks to every unlocked selected object in one update and clamps timing', () => {
        const a = createDefaultShapeLayer();
        const b = createDefaultTextLayer();
        const locked = { ...createDefaultShapeLayer(), locked: true };
        const shot = { ...createDefaultShot(), durationMs: 400, layers: [a, b, locked] };
        const next = addBlocksToShot(shot, [a.id, b.id, locked.id], 'position', 900);
        expect(next.layers[0].blocks).toHaveLength(1);
        expect(next.layers[1].blocks).toHaveLength(1);
        expect(next.layers[2].blocks).toHaveLength(0);
        expect(next.layers[0].blocks[0].id).not.toBe(next.layers[1].blocks[0].id);
        expect(next.layers[0].blocks[0].startMs).toBe(0);
        expect(next.layers[0].blocks[0].durationMs).toBe(400);
    });
    it('preserves legacy presets when stacking and clears the legacy field on final removal', () => {
        const layer = createDefaultTextLayer();
        layer.entrance = { ...layer.entrance, type: 'fade' };
        const next = replacePresets(layer, 'in', [...presetList(layer, 'in'), { ...layer.entrance, type: 'blur' }]);
        expect(next.entrances).toHaveLength(2);
        expect(next.entrance.type).toBe('fade');
        const empty = replacePresets(next, 'in', []);
        expect(empty.entrance.type).toBe('none');
        expect(presetList(empty, 'in')).toEqual([]);
    });
});
