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
    | 'select'
    | 'move'
    | 'tilt'
    | 'hand'
    | 'text'
    | 'image'
    | 'rectangle'
    | 'ellipse'
    | 'line'
    | 'arrow'
    | 'polygon'
    | 'pen';

interface SelectionStore {
    selectedShotId: string;
    selectedLayerIds: string[];
    selectedBlockId: string | null;
    selectedCameraBlockId: string | null;
    selectedLightBlockId: string | null;
    selectedPresetType: 'entrance' | 'exit' | null;
    inspectorTab: InspectorTab;

    // Timeline synchronized state
    timelineView: 'video' | 'scene';
    timelineZoom: number;
    timelineHeightPx: number;
    timelineScrollTop: number;
    expandedTimelineLayerIds: string[];

    activeTool: CanvasTool;
    isAnimateMode: boolean;
    isCropping: boolean;

    canvasZoom: number;
    canvasPan: { x: number; y: number };
    gradientEditorActive: boolean;
    gradientEditorAngle: number;

    selectShot: (shotId: string, defaultLayerId?: string) => void;
    selectLayer: (layerId: string, toggleMulti?: boolean) => void;
    selectLayerRange: (orderedLayerIds: string[], targetLayerId: string) => void;
    setSelectedLayerIds: (layerIds: string[]) => void;
    clearLayerSelection: () => void;
    selectBlock: (blockId: string | null, layerId?: string) => void;
    selectCameraBlock: (cameraBlockId: string | null) => void;
    selectLightBlock: (lightBlockId: string | null) => void;
    selectPreset: (preset: 'entrance' | 'exit' | null, layerId?: string) => void;
    setInspectorTab: (tab: InspectorTab) => void;

    setTimelineView: (view: 'video' | 'scene') => void;
    setTimelineZoom: (zoom: number) => void;
    setTimelineHeightPx: (heightPx: number) => void;
    setTimelineScrollTop: (scrollTop: number) => void;
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
    setGradientEditor: (active: boolean, angle?: number) => void;
    setGradientEditorAngle: (angle: number) => void;
}

export const useSelectionStore = create<SelectionStore>((set) => ({
    selectedShotId: 'shot-1',
    selectedLayerIds: [],
    selectedBlockId: null,
    selectedCameraBlockId: null,
    selectedLightBlockId: null,
    selectedPresetType: null,
    inspectorTab: 'layer',

    timelineView: 'video',
    timelineZoom: 1,
    timelineHeightPx: 248,
    timelineScrollTop: 0,
    expandedTimelineLayerIds: [],

    activeTool: 'select',
    isAnimateMode: false,
    isCropping: false,

    canvasZoom: 1,
    canvasPan: { x: 0, y: 0 },
    gradientEditorActive: false,
    gradientEditorAngle: 0,

    selectShot: (shotId, defaultLayerId) =>
        set({
            selectedShotId: shotId,
            selectedLayerIds: defaultLayerId ? [defaultLayerId] : [],
            selectedBlockId: null,
            selectedCameraBlockId: null,
            selectedLightBlockId: null,
            selectedPresetType: null,
            isCropping: false,
        }),

    selectLayer: (layerId, toggleMulti = false) =>
        set((state) => {
            if (!toggleMulti) {
                return {
                    selectedLayerIds: [layerId],
                    selectedBlockId: null,
                    selectedCameraBlockId: null,
                    selectedLightBlockId: null,
                    selectedPresetType: null,
                    isCropping: false,
                };
            }
            const exists = state.selectedLayerIds.includes(layerId);
            const nextIds = exists
                ? state.selectedLayerIds.filter((id) => id !== layerId)
                : [...state.selectedLayerIds, layerId];
            return {
                selectedLayerIds: nextIds.length > 0 ? nextIds : [layerId],
                selectedCameraBlockId: null,
                selectedLightBlockId: null,
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
                selectedCameraBlockId: null,
                selectedLightBlockId: null,
                isCropping: false,
            };
        }),

    setSelectedLayerIds: (selectedLayerIds) =>
        set({
            selectedLayerIds,
            selectedCameraBlockId: null,
            selectedLightBlockId: null,
            isCropping: false,
        }),

    clearLayerSelection: () =>
        set({
            selectedLayerIds: [],
            selectedBlockId: null,
            selectedCameraBlockId: null,
            selectedLightBlockId: null,
            selectedPresetType: null,
            isCropping: false,
        }),

    selectBlock: (blockId, layerId) =>
        set((state) => ({
            selectedBlockId: blockId,
            selectedCameraBlockId: null,
            selectedLightBlockId: null,
            selectedPresetType: null,
            selectedLayerIds: layerId ? [layerId] : state.selectedLayerIds,
            inspectorTab: blockId ? 'blocks' : state.inspectorTab,
        })),

    selectCameraBlock: (cameraBlockId) =>
        set({
            selectedCameraBlockId: cameraBlockId,
            selectedBlockId: null,
            selectedLightBlockId: null,
            selectedPresetType: null,
            selectedLayerIds: [],
            inspectorTab: 'camera',
        }),

    selectLightBlock: (lightBlockId) =>
        set({
            selectedLightBlockId: lightBlockId,
            selectedCameraBlockId: null,
            selectedBlockId: null,
            selectedPresetType: null,
            selectedLayerIds: [],
            inspectorTab: 'shot',
        }),

    selectPreset: (preset, layerId) =>
        set((state) => ({
            selectedPresetType: preset,
            selectedBlockId: null,
            selectedCameraBlockId: null,
            selectedLightBlockId: null,
            selectedLayerIds: layerId ? [layerId] : state.selectedLayerIds,
            inspectorTab: 'transitions',
        })),

    setInspectorTab: (inspectorTab) => set({ inspectorTab }),

    setTimelineView: (timelineView) => set({ timelineView }),

    setTimelineZoom: (timelineZoom) => set({ timelineZoom }),

    setTimelineHeightPx: (heightPx) =>
        set({
            timelineHeightPx: Math.max(150, Math.min(560, Math.round(heightPx))),
        }),

    setTimelineScrollTop: (timelineScrollTop) => set({ timelineScrollTop }),

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

    setGradientEditor: (gradientEditorActive, gradientEditorAngle) =>
        set((state) => ({
            gradientEditorActive,
            gradientEditorAngle: gradientEditorAngle ?? state.gradientEditorAngle,
        })),

    setGradientEditorAngle: (gradientEditorAngle) => set({ gradientEditorAngle }),
}));
