export type CanvasToolbarPlacement = 'top' | 'bottom';

export function getCanvasToolbarPlacement(): CanvasToolbarPlacement {
    // Raylight design language anchors the floating toolbar consistently below the canvas
    return 'bottom';
}