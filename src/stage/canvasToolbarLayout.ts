export type LayoutBounds = { left: number; top: number; right: number; bottom: number };
export type CanvasToolbarPlacement = 'top' | 'bottom';
type ToolbarSize = { width: number; height: number };

const TOOLBAR_EDGE_GAP = 12;

function overlapArea(first: LayoutBounds, second: LayoutBounds): number {
    const width = Math.max(0, Math.min(first.right, second.right) - Math.max(first.left, second.left));
    const height = Math.max(0, Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top));
    return width * height;
}

export function getCanvasToolbarPlacement(
    stage: LayoutBounds,
    toolbar: ToolbarSize,
    selectionHandles: readonly LayoutBounds[],
): CanvasToolbarPlacement {
    const left = stage.left + (stage.right - stage.left - toolbar.width) / 2;
    const topPlacement = {
        left,
        right: left + toolbar.width,
        top: stage.top + TOOLBAR_EDGE_GAP,
        bottom: stage.top + TOOLBAR_EDGE_GAP + toolbar.height,
    };
    const bottomPlacement = {
        left,
        right: left + toolbar.width,
        top: stage.bottom - TOOLBAR_EDGE_GAP - toolbar.height,
        bottom: stage.bottom - TOOLBAR_EDGE_GAP,
    };
    const overlap = (placement: LayoutBounds) =>
        selectionHandles.reduce((total, handle) => total + overlapArea(placement, handle), 0);

    const topOverlap = overlap(topPlacement);
    const bottomOverlap = overlap(bottomPlacement);
    return bottomOverlap > 0 && topOverlap < bottomOverlap ? 'top' : 'bottom';
}
