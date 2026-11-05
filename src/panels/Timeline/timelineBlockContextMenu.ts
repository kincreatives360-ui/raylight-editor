import { Copy, Trash2 } from 'lucide-react';
import type { ContextMenuItemDef } from '../../ui/ContextMenu';

interface TimelineBlockContextMenuActions {
    title: string;
    onEditEasing: () => void;
    onCopy: () => void;
    onDuplicate: () => void;
    onRemove: () => void;
}

export function createTimelineBlockContextMenu({
    title,
    onEditEasing,
    onCopy,
    onDuplicate,
    onRemove,
}: TimelineBlockContextMenuActions): ContextMenuItemDef[] {
    return [
        { type: 'header', label: title },
        { id: 'edit-easing', label: 'Edit easing', shortcut: '↵', onClick: onEditEasing },
        { id: 'copy', label: 'Copy', icon: Copy, shortcut: '⌘C', onClick: onCopy },
        { id: 'dup', label: 'Duplicate', shortcut: '⌘D', onClick: onDuplicate },
        { type: 'divider' },
        { id: 'del', label: 'Remove', icon: Trash2, shortcut: '⌫', danger: true, onClick: onRemove },
    ];
}
