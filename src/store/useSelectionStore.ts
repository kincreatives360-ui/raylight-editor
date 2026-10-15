// src/store/useSelectionStore.ts
import { create } from 'zustand';

export type InspectorTab =
    | 'layer'
    | 'shot'
    | 'transitions'
    | 'blocks'
    | 'camera'
    | 'effects';

export type CanvasTool =
    | 'select'    // V: Plane-aware move
    | 'move'      // G: Screen-space move
    | 'tilt'      // Y: 3D Tilt drag
    | 'hand'      // H: Pan workspace
    | 'text'      // T: Draw/place Text layer
    | 'image'     // I: Draw/place Image layer
    | 'rectangle' // R: Draw/place Rectangle shape
    | 'ellipse'   // O: Draw/place Ellipse shape
    | 'line';     // L: Draw/place Line shape

interface SelectionStore {
    selectedShotId: string;
    selectedLayerIds: string[];
    selectedBlockId: string | null;
    inspectorTab: InspectorTab;

    // Timeline synchronized state (Zoomed-out 'video' vs Zoomed-in 'scene')
    timelineView: 'video' | 'scene';
    timelineZoom: number;
    expandedTimelineLayerIds: string[];

    activeTool: CanvasTool;
    isAnimateMode: boolean;
    isCropping: boolean;

    canvasZoom: number;
    canvasPan: { x: number; y: number };

    selectShot: (shotId: string, defaultLayerId?: string) => void;
    selectLayer: (layerId: string, toggleMulti?: boolean) => void;
    selectLayerRange: (orderedLayerIds: string[], targetLayerId: string) => void;
    setSelectedLayerIds: (layerIds: string[]) => void;
    clearLayerSelection: () => void;
    selectBlock: (blockId: string | null, layerId?: string) => void;
    setInspectorTab: (tab: InspectorTab) => void;

    setTimelineView: (view: 'video' | 'scene') => void;
    setTimelineZoom: (zoom: number) => void;
    toggleTimelineLayerExpanded: (layerId: string) => void;

    setActiveTool: (tool: CanvasTool) => void;
    toggleAnimateMode: () => void;
    setIsAnimateMode: (active: boolean) => void;
    setIsCropping: (cropping: boolean) => void;

    setCanvasZoom: (zoom: number | ((prev: number) => number)) => void;
    setCanvasPan: (
        pan:
            | { x: number; y: number }
            | ((prev: { x: number; y: number }) => { x: number; y: number })
    ) => void;
    resetCanvasView: () => void;
}

export const useSelectionStore = create<SelectionStore>((set) => ({
    selectedShotId: 'shot-1',
    selectedLayerIds: ['layer-hero-screenshot'],
    selectedBlockId: null,
    inspectorTab: 'layer',

    timelineView: 'video',
    timelineZoom: 1,
    expandedTimelineLayerIds: ['layer-hero-screenshot', 'layer-headline-text'],

    activeTool: 'select',
    isAnimateMode: false,
    isCropping: false,

    canvasZoom: 1,
    canvasPan: { x: 0, y: 0 },

    selectShot: (shotId, defaultLayerId) =>
        set({
            selectedShotId: shotId,
            selectedLayerIds: defaultLayerId ? [defaultLayerId] : [],
            selectedBlockId: null,
            isCropping: false,
        }),

    selectLayer: (layerId, toggleMulti = false) =>
        set((state) => {
            if (!toggleMulti) {
                return {
                    selectedLayerIds: [layerId],
                    selectedBlockId: null,
                    isCropping: false,
                };
            }
            const exists = state.selectedLayerIds.includes(layerId);
            const nextIds = exists
                ? state.selectedLayerIds.filter((id) => id !== layerId)
                : [...state.selectedLayerIds, layerId];
            return {
                selectedLayerIds: nextIds.length > 0 ? nextIds : [layerId],
                isCropping: false,
            };
        }),

    selectLayerRange: (orderedLayerIds, targetLayerId) =>
        set((state) => {
            const anchorId = state.selectedLayerIds[0];
            if (!anchorId) {
                return { selectedLayerIds: [targetLayerId], isCropping: false };
            }
            const startIdx = orderedLayerIds.indexOf(anchorId);
            const endIdx = orderedLayerIds.indexOf(targetLayerId);
            if (startIdx === -1 || endIdx === -1) {
                return { selectedLayerIds: [targetLayerId], isCropping: false };
            }
            const low = Math.min(startIdx, endIdx);
            const high = Math.max(startIdx, endIdx);
            return {
                selectedLayerIds: orderedLayerIds.slice(low, high + 1),
                isCropping: false,
            };
        }),

    setSelectedLayerIds: (selectedLayerIds) =>
        set({ selectedLayerIds, isCropping: false }),

    clearLayerSelection: () =>
        set({
            selectedLayerIds: [],
            selectedBlockId: null,
            isCropping: false,
        }),

    selectBlock: (blockId, layerId) =>
        set((state) => ({
            selectedBlockId: blockId,
            selectedLayerIds: layerId ? [layerId] : state.selectedLayerIds,
            inspectorTab: blockId ? 'blocks' : state.inspectorTab,
        })),

    setInspectorTab: (inspectorTab) => set({ inspectorTab }),

    setTimelineView: (timelineView) =>
        set((state) => ({
            timelineView,
            timelineZoom:
                timelineView === 'scene' && state.timelineZoom < 1.3
                    ? 1.6
                    : timelineView === 'video'
                        ? 1.0
                        : state.timelineZoom,
        })),

    setTimelineZoom: (timelineZoom) =>
        set({
            timelineZoom,
            timelineView: timelineZoom > 1.25 ? 'scene' : 'video',
        }),

    toggleTimelineLayerExpanded: (layerId) =>
        set((state) => {
            const exists = state.expandedTimelineLayerIds.includes(layerId);
            return {
                expandedTimelineLayerIds: exists
                    ? state.expandedTimelineLayerIds.filter((id) => id !== layerId)
                    : [...state.expandedTimelineLayerIds, layerId],
            };
        }),

    setActiveTool: (activeTool) =>
        set((state) => ({
            activeTool,
            isCropping: activeTool !== 'select' ? false : state.isCropping,
        })),

    toggleAnimateMode: () =>
        set((state) => ({ isAnimateMode: !state.isAnimateMode })),

    setIsAnimateMode: (isAnimateMode) => set({ isAnimateMode }),

    setIsCropping: (isCropping) => set({ isCropping }),

    setCanvasZoom: (zoom) =>
        set((state) => {
            const next = typeof zoom === 'function' ? zoom(state.canvasZoom) : zoom;
            return {
                canvasZoom: Math.max(0.25, Math.min(3.5, Number(next.toFixed(3)))),
            };
        }),

    setCanvasPan: (pan) =>
        set((state) => ({
            canvasPan: typeof pan === 'function' ? pan(state.canvasPan) : pan,
        })),

    resetCanvasView: () =>
        set({
            canvasZoom: 1,
            canvasPan: { x: 0, y: 0 },
        }),
}));

if (typeof window !== 'undefined') {
    (window as any).__selectionStore = useSelectionStore;
}