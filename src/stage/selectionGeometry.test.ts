import { describe, expect, it } from 'vitest';
import { polygonsIntersectRect, unionRects, type Point, type Rect } from './selectionGeometry';

const rect: Rect = { left: 2, top: 2, right: 6, bottom: 6 };

describe('selection geometry', () => {
    it('detects polygon edges crossing a rectangle when no polygon vertex is inside', () => {
        const polygon: Point[] = [
            { x: 0, y: 3 },
            { x: 8, y: 3 },
            { x: 8, y: 5 },
            { x: 0, y: 5 },
        ];

        expect(polygonsIntersectRect(polygon, rect)).toBe(true);
    });

    it('detects polygons contained by the rectangle and rectangles contained by the polygon', () => {
        expect(polygonsIntersectRect([
            { x: 3, y: 3 },
            { x: 5, y: 3 },
            { x: 5, y: 5 },
            { x: 3, y: 5 },
        ], rect)).toBe(true);

        expect(polygonsIntersectRect([
            { x: 0, y: 0 },
            { x: 8, y: 0 },
            { x: 8, y: 8 },
            { x: 0, y: 8 },
        ], rect)).toBe(true);
    });

    it('rejects disjoint polygons', () => {
        expect(polygonsIntersectRect([
            { x: 7, y: 7 },
            { x: 9, y: 7 },
            { x: 9, y: 9 },
            { x: 7, y: 9 },
        ], rect)).toBe(false);
    });

    it('treats edge and vertex contact as intersection', () => {
        expect(polygonsIntersectRect([
            { x: 6, y: 3 },
            { x: 8, y: 3 },
            { x: 8, y: 5 },
            { x: 6, y: 5 },
        ], rect)).toBe(true);

        expect(polygonsIntersectRect([
            { x: 6, y: 6 },
            { x: 8, y: 6 },
            { x: 8, y: 8 },
            { x: 6, y: 8 },
        ], rect)).toBe(true);
    });

    it('returns false for an empty polygon and null for empty rectangle input', () => {
        expect(polygonsIntersectRect([], rect)).toBe(false);
        expect(unionRects([])).toBeNull();
    });

    it('returns the minimal bounds covering all rectangles', () => {
        expect(unionRects([
            { left: -2, top: 3, right: 4, bottom: 8 },
            { left: 1, top: -5, right: 9, bottom: 6 },
            { left: 0, top: 2, right: 2, bottom: 10 },
        ])).toEqual({ left: -2, top: -5, right: 9, bottom: 10 });
    });
});
