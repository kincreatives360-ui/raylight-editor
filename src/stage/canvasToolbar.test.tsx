import { describe, expect, it } from 'vitest';
import { SHAPE_TOOL_ITEMS } from './canvasToolItems';

describe('CanvasToolbar shortcuts', () => {
    it('shows the same Arrow shortcut used by the keyboard shortcut guide', () => {
        expect(SHAPE_TOOL_ITEMS.find((item) => item.id === 'arrow')?.key).toBe('A');
    });
});
