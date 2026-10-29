import { describe, expect, it } from 'vitest';
import { clampStop, defaultHandles, gradientAngle, interpolatePoint, mergeGradient, rotateHandles, sampleStop, stopPosition, type Gradient } from './gradientGeometry';

const fill: Gradient = { kind: 'gradient', angle: 90, stops: [{ at: 0, color: '#000000', opacity: 0 }, { at: 1, color: '#ffffff', opacity: 1 }] };
describe('shared gradient editing geometry', () => {
    it('preserves line geometry on color edits, rotates it on angle edits and resets it on type changes', () => {
        const current = { ...fill, handles: defaultHandles(fill) };
        expect(mergeGradient(current, { ...fill, stops: [...fill.stops] }).handles).toEqual(current.handles);
        const rotated = mergeGradient(current, { ...fill, angle: 180 });
        expect(rotated.handles?.end.y).toBeCloseTo(1);
        expect(mergeGradient(current, { ...fill, gradientType: 'radial' }).handles).toBeUndefined();
    });
    it('defaults linear gradients to the shape bounds and radial gradients to its center', () => {
        expect(defaultHandles(fill).start.x).toBe(0);
        expect(defaultHandles(fill).end.x).toBe(1);
        expect(defaultHandles({ ...fill, gradientType: 'radial' }).start).toEqual({ x: .5, y: .5 });
    });
    it('samples color and opacity when inserting a stop without changing the gradient', () => {
        expect(sampleStop(fill.stops, .5)).toEqual({ at: .5, color: '#808080', opacity: .5 });
        expect(sampleStop([{ at: .2, color: '#123456' }, { at: .8, color: '#abcdef' }], 1).color).toBe('#abcdef');
    });
    it('projects stops on angled lines and clamps them to the endpoints', () => {
        expect(stopPosition({ x: 5, y: 8 }, { x: 0, y: 0 }, { x: 10, y: 10 })).toBe(.65);
        expect(stopPosition({ x: -5, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(0);
        expect(clampStop(2)).toBe(1);
    });
    it('rotates without changing length or midpoint, retaining ellipse radius', () => {
        const handles = { start: { x: 0, y: .5 }, end: { x: 1, y: .5 }, width: .3 };
        const next = rotateHandles(handles, { x: .5, y: .5 }, Math.PI / 2);
        expect(next.width).toBe(.3);
        expect(interpolatePoint(next.start, next.end, .5)).toEqual({ x: .5, y: .5 });
        expect(Math.hypot(next.end.x - next.start.x, next.end.y - next.start.y)).toBeCloseTo(1);
        expect(gradientAngle(next.start, next.end)).toBeCloseTo(180);
    });
});
