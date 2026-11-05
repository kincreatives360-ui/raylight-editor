import { describe, expect, it } from 'vitest';
import { getCanvasToolbarPlacement } from './canvasToolbarLayout';

describe('canvas toolbar placement', () => {
    it('always keeps the toolbar anchored at the bottom below the canvas', () => {
        expect(getCanvasToolbarPlacement()).toBe('bottom');
    });

    it('keeps the toolbar at the bottom when the selection is clear', () => {
        expect(getCanvasToolbarPlacement()).toBe('bottom');
    });

    it('keeps the toolbar at the bottom for selection handles outside horizontal span', () => {
        expect(getCanvasToolbarPlacement()).toBe('bottom');
    });
});
