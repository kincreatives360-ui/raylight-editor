import { describe, expect, it } from 'vitest';
import { getCanvasToolbarPlacement } from './canvasToolbarLayout';

describe('canvas toolbar placement', () => {
    it('always keeps the toolbar anchored at the bottom below the canvas', () => {
        expect(getCanvasToolbarPlacement(
            { left: 0, top: 0, right: 900, bottom: 500 },
            { width: 400, height: 56 },
            [{ left: 440, top: 476, right: 460, bottom: 496 }],
        )).toBe('bottom');
    });

    it('keeps the toolbar at the bottom when the selection is clear', () => {
        expect(getCanvasToolbarPlacement(
            { left: 0, top: 0, right: 900, bottom: 500 },
            { width: 400, height: 56 },
            [{ left: 440, top: 300, right: 460, bottom: 320 }],
        )).toBe('bottom');
    });

    it('keeps the toolbar at the bottom for selection handles outside horizontal span', () => {
        expect(getCanvasToolbarPlacement(
            { left: 0, top: 0, right: 900, bottom: 500 },
            { width: 400, height: 56 },
            [{ left: 10, top: 476, right: 30, bottom: 496 }],
        )).toBe('bottom');
    });
});
