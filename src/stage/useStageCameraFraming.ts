import { useCallback } from 'react';
import type { EvaluatedProjectFrame } from '../engine/evaluateShot';
import { useSelectionStore } from '../store/useSelectionStore';
import { calculateLayersBoundingFraming } from './webgl/cameraMath';

interface UseStageCameraFramingOptions {
    frame: EvaluatedProjectFrame;
    frameWidth: number;
    frameHeight: number;
    beginDragTransaction: () => void;
    commitDragTransaction: () => void;
    updateCamera: (patch: { targetX: number; targetY: number; zoom: number }) => void;
    resetCamera: () => void;
}

export const useStageCameraFraming = ({
    frame,
    frameWidth,
    frameHeight,
    beginDragTransaction,
    commitDragTransaction,
    updateCamera,
    resetCamera,
}: UseStageCameraFramingOptions) => useCallback(() => {
    const selectedIds = useSelectionStore.getState().selectedLayerIds;
    const selectedLayers = frame.layers.filter((layer) => selectedIds.includes(layer.id));
    const targetLayers = selectedLayers.length > 0
        ? selectedLayers
        : frame.layers.filter((layer) => layer.visible !== false && (layer.opacity ?? 1) > 0);

    if (targetLayers.length === 0) {
        resetCamera();
        return;
    }

    const framing = calculateLayersBoundingFraming(targetLayers, {
        width: frameWidth,
        height: frameHeight,
    });

    beginDragTransaction();
    updateCamera({
        targetX: framing.anchorX,
        targetY: framing.anchorY,
        zoom: framing.zoom,
    });
    commitDragTransaction();
}, [frame.layers, frameWidth, frameHeight, beginDragTransaction, updateCamera, commitDragTransaction, resetCamera]);
