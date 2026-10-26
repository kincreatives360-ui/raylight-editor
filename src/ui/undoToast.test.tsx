// src/ui/undoToast.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { UndoToast } from './UndoToast';

describe('UndoToast Component (Detail 5)', () => {
  it('renders role="status" and message when isOpen is true', () => {
    const html = renderToStaticMarkup(
      <UndoToast
        message="Deleted 2 layers"
        isOpen={true}
        onUndo={vi.fn()}
        onDismiss={vi.fn()}
      />
    );

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('Deleted 2 layers');
    expect(html).toContain('Undo');
    expect(html).toContain('Dismiss toast');
  });

  it('renders nothing when isOpen is false', () => {
    const html = renderToStaticMarkup(
      <UndoToast
        message="Deleted 2 layers"
        isOpen={false}
        onUndo={vi.fn()}
        onDismiss={vi.fn()}
      />
    );

    expect(html).toBe('');
  });
});
