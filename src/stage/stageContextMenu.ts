import type React from 'react';

export interface StageContextMenuState {
    x: number;
    y: number;
    layerId: string | null;
}

interface StageContextMenuOptions {
    activeTool: string;
    selectedLayerIds: string[];
    selectedLayerSet: Set<string>;
    selectLayer: (layerId: string, multiSelect?: boolean) => void;
    setContextMenu: (menu: StageContextMenuState) => void;
}

export const handleStageContextMenu = (
    event: React.MouseEvent,
    {
        activeTool,
        selectedLayerIds,
        selectedLayerSet,
        selectLayer,
        setContextMenu,
    }: StageContextMenuOptions
) => {
    if (activeTool === 'camera' || event.altKey) {
        event.preventDefault();
        event.stopPropagation();
        return;
    }

    event.preventDefault();
    event.stopPropagation();

    const targetElement = event.target as HTMLElement;
    const layerElement = targetElement.closest('[data-layer-id]');
    const clickedLayerId = layerElement?.getAttribute('data-layer-id');

    if (clickedLayerId) {
        if (!selectedLayerSet.has(clickedLayerId)) {
            selectLayer(clickedLayerId, false);
        }
        setContextMenu({ x: event.clientX, y: event.clientY, layerId: clickedLayerId });
    } else {
        setContextMenu({
            x: event.clientX,
            y: event.clientY,
            layerId: selectedLayerIds[0] ?? null,
        });
    }
};
