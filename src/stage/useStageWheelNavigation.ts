import { useEffect, type RefObject } from 'react';
import type { EvaluatedProjectFrame } from '../engine/evaluateShot';
import type { useSelectionStore } from '../store/useSelectionStore';

type CanvasPan = ReturnType<typeof useSelectionStore.getState>['canvasPan'];
type SetCanvasZoom = ReturnType<typeof useSelectionStore.getState>['setCanvasZoom'];
type SetCanvasPan = ReturnType<typeof useSelectionStore.getState>['setCanvasPan'];

interface UseStageWheelNavigationOptions {
    containerRef: RefObject<HTMLDivElement | null>;
    activeTool: string;
    frame: EvaluatedProjectFrame;
    selectedCameraBlockId: string | null;
    beginDragTransaction: () => void;
    commitDragTransaction: () => void;
    updateActiveShotCamera: (patch: { zoom?: number }) => void;
    setCanvasZoom: SetCanvasZoom;
    setCanvasPan: SetCanvasPan;
}

export function useStageWheelNavigation({
    containerRef,
    activeTool,
    frame,
    selectedCameraBlockId,
    beginDragTransaction,
    commitDragTransaction,
    updateActiveShotCamera,
    setCanvasZoom,
    setCanvasPan,
}: UseStageWheelNavigationOptions): void {
    useEffect(() => {
        const element = containerRef.current;
        if (!element) return;

        const handleWheel = (event: WheelEvent) => {
            const target = event.target as HTMLElement | null;
            if (target?.closest?.('[aria-label="Orbit camera controls"]')) return;

            event.preventDefault();

            if (activeTool === 'camera' || event.altKey) {
                const zoomFactor = event.deltaY < 0 ? 1.06 : 0.94;
                const currentShot = frame.activeShot;
                const selectedCameraBlock = currentShot.cameraBlocks?.find(
                    (block) => block.id === selectedCameraBlockId
                );
                let baseZoom = currentShot.framings?.[0]?.zoom ?? frame.camera.zoom;
                if (selectedCameraBlock) {
                    const midpoint = selectedCameraBlock.startMs + selectedCameraBlock.durationMs / 2;
                    const endpoint = frame.shotLocalTimeMs < midpoint ? 'from' : 'to';
                    baseZoom = selectedCameraBlock[endpoint]?.zoom ?? baseZoom;
                }
                const nextZoom = Number(Math.max(0.2, Math.min(5, baseZoom * zoomFactor)).toFixed(3));
                beginDragTransaction();
                updateActiveShotCamera({ zoom: nextZoom });
                commitDragTransaction();
                return;
            }

            if (event.metaKey || event.ctrlKey) {
                setCanvasZoom((previous) => previous * (event.deltaY < 0 ? 1.08 : 0.92));
            } else {
                setCanvasPan((previous: CanvasPan) => ({
                    x: previous.x - event.deltaX,
                    y: previous.y - event.deltaY,
                }));
            }
        };

        element.addEventListener('wheel', handleWheel, { passive: false });
        return () => element.removeEventListener('wheel', handleWheel);
    }, [
        activeTool,
        beginDragTransaction,
        commitDragTransaction,
        containerRef,
        frame.activeShot,
        frame.camera.zoom,
        frame.shotLocalTimeMs,
        selectedCameraBlockId,
        setCanvasPan,
        setCanvasZoom,
        updateActiveShotCamera,
    ]);
}
