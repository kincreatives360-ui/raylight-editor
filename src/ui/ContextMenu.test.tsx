
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ContextMenu, type ContextMenuItemDef } from './ContextMenu';

describe('ContextMenu component', () => {
    it('renders menu items with headers, shortcuts, and styling', () => {
        const handleClick = vi.fn();
        const handleClose = vi.fn();
        const items: ContextMenuItemDef[] = [
            { type: 'header', label: 'Layer Operations' },
            { id: 'dup', label: 'Duplicate', shortcut: '⌘D', onClick: handleClick },
            { type: 'divider' },
            { id: 'del', label: 'Delete', danger: true, shortcut: '⌫', onClick: vi.fn() },
        ];

        const html = renderToStaticMarkup(
            <ContextMenu x={100} y={100} items={items} onClose={handleClose} />
        );

        expect(html).toContain('Layer Operations');
        expect(html).toContain('Duplicate');
        expect(html).toContain('⌘D');
        expect(html).toContain('Delete');
        expect(html).toContain('⌫');
    });

    it('renders disabled items with disabled attribute and appropriate styling', () => {
        const items: ContextMenuItemDef[] = [
            { id: 'disabled-item', label: 'Unavailable', disabled: true },
        ];

        const html = renderToStaticMarkup(
            <ContextMenu x={50} y={50} items={items} onClose={vi.fn()} />
        );

        expect(html).toContain('Unavailable');
        expect(html).toContain('disabled');
        expect(html).toContain('opacity-40');
    });
});
