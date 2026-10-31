export type LayoutBounds = { left: number; top: number; right: number; bottom: number };
export type CanvasToolbarPlacement = 'top' | 'bottom';
type ToolbarSize = { width: number; height: number };

export function getCanvasToolbarPlacement(
    _stage?: LayoutBounds,
    _toolbar?: ToolbarSize,
    _selectionHandles?: readonly LayoutBounds[],
): CanvasToolbarPlacement {
    // Raylight design language anchors the floating toolbar consistently below the canvas
    return 'bottom';
}
