import { describe, expect, it } from 'vitest';
import { SHAPE_TOOL_ITEMS } from './canvasToolItems';

describe('canvas shape tool discovery', () => {
  it('exposes the existing Pen path tool with its working shortcut', () => {
    expect(SHAPE_TOOL_ITEMS).toContainEqual(expect.objectContaining({ id: 'pen', label: 'Pen path', key: 'P' }));
  });

  it('does not advertise unsupported Comment or frame creation tools', () => {
    expect(SHAPE_TOOL_ITEMS.map(({ id }) => id)).not.toContain('frame');
    expect(SHAPE_TOOL_ITEMS.map(({ id }) => id)).not.toContain('comment');
  });
});
