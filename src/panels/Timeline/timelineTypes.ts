import type { ContextMenuItemDef } from '../../ui/ContextMenu';
import type { Easing } from '../../model/types';

export interface TimelineEasingPopoverTarget {
    easing: Easing;
    onChange: (easing: Easing) => void;
    anchorRect?: DOMRect | null;
}

export interface TimelineContextMenuState {
    x: number;
    y: number;
    items: ContextMenuItemDef[];
}

export interface TimelineGhostDragPreview {
    id: string;
    type: 'block' | 'entrance' | 'exit' | 'layer' | 'camera' | 'light';
    startMs: number;
    durationMs: number;
    label?: string;
    trimEdge?: 'left' | 'right';
    snapped?: boolean;
}
