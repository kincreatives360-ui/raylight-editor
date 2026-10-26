// src/store/useSelectionStore.ts
import { create } from 'zustand';

export type InspectorTab =
    | 'project'
    | 'shot'
    | 'layer'
    | 'transitions'
    | 'blocks'
    | 'camera'
    | 'effects';

export type CanvasTool =
    | 'select'
    | 'move'
    | 'tilt'
    | 'camera'
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
    selectedLightId: string | null;
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
    isTransformDragging: boolean;
    setIsTransformDragging: (dragging: boolean) => void;

    canvasZoom: number;
    canvasPan: { x: number; y: number };
    gradientEditorActive: boolean;
    gradientEditorAngle: number;

    leftPanelOpen: boolean;
    rightSidebarOpen: boolean;
    leftPanelWidth: number;
    rightSidebarWidth: number;
    toggleLeftPanel: () => void;
    toggleRightSidebar: () => void;
    setLeftPanelOpen: (open: boolean) => void;
    setRightSidebarOpen: (open: boolean) => void;
    setLeftPanelWidth: (width: number) => void;
    setRightSidebarWidth: (width: number) => void;
    resetPanelWidths: () => void;

    selectProject: () => void;
    selectShot: (shotId: string, defaultLayerId?: string) => void;
    selectLayer: (layerId: string, toggleMulti?: boolean) => void;
    selectLayerRange: (orderedLayerIds: string[], targetLayerId: string) => void;
    setSelectedLayerIds: (layerIds: string[]) => void;
    clearLayerSelection: () => void;
    selectBlock: (blockId: string | null, layerId?: string) => void;
    selectCameraBlock: (cameraBlockId: string | null) => void;
    selectLightBlock: (lightBlockId: string | null) => void;
    selectLight: (lightId: string | null) => void;
    setSelectedLightId: (lightId: string | null) => void;
    selectPreset: (preset: 'entrance' | 'exit' | null, layerId?: string) => void;
    setInspectorTab: (tab: InspectorTab) => void;

    setTimelineView: (view: 'video' | 'scene') => void;
    setTimelineZoom: (zoom: number) => void;
    setTimelineHeightPx: (heightPx: number) => void;
    setTimelineScrollTop: (scrollTop: number) => void;
    toggleTimelineLayerExpanded: (layerId: string) => void;
    setTimelineLayerExpanded: (layerId: string, expanded: boolean) => void;

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

export const DEFAULT_LEFT_PANEL_WIDTH = 260;
export const MIN_LEFT_PANEL_WIDTH = 200;
export const MAX_LEFT_PANEL_WIDTH = 460;

export const DEFAULT_RIGHT_SIDEBAR_WIDTH = 300;
export const MIN_RIGHT_SIDEBAR_WIDTH = 260;
export const MAX_RIGHT_SIDEBAR_WIDTH = 500;

function getSavedPanelWidth(key: string, defaultVal: number, minVal: number, maxVal: number): number {
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            const saved = window.localStorage.getItem(key);
            if (saved) {
                const num = Number(saved);
                if (Number.isFinite(num)) {
                    return Math.max(minVal, Math.min(maxVal, num));
                }
            }
        }
    } catch {
        // Ignore localStorage restrictions
    }
    return defaultVal;
}

export const useSelectionStore = create<SelectionStore>((set) => ({
    selectedShotId: 'shot-1',
    selectedLayerIds: [],
    selectedBlockId: null,
    selectedCameraBlockId: null,
    selectedLightBlockId: null,
    selectedLightId: null,
    selectedPresetType: null,
    inspectorTab: 'project',

    timelineView: 'video',
    timelineZoom: 1,
    timelineHeightPx: 220,
    timelineScrollTop: 0,
    expandedTimelineLayerIds: [],

    activeTool: 'select',
    isAnimateMode: false,
    isCropping: false,
    isTransformDragging: false,
    setIsTransformDragging: (dragging) => set({ isTransformDragging: dragging }),

    canvasZoom: 1,
    canvasPan: { x: 0, y: 0 },
    gradientEditorActive: false,
    gradientEditorAngle: 0,

    leftPanelOpen: true,
    rightSidebarOpen: true,
    leftPanelWidth: getSavedPanelWidth('raylight_left_panel_width', DEFAULT_LEFT_PANEL_WIDTH, MIN_LEFT_PANEL_WIDTH, MAX_LEFT_PANEL_WIDTH),
    rightSidebarWidth: getSavedPanelWidth('raylight_right_sidebar_width', DEFAULT_RIGHT_SIDEBAR_WIDTH, MIN_RIGHT_SIDEBAR_WIDTH, MAX_RIGHT_SIDEBAR_WIDTH),

    selectProject: () =>
        set({
            selectedLayerIds: [],
            selectedBlockId: null,
            selectedCameraBlockId: null,
            selectedLightBlockId: null,
            selectedLightId: null,
            selectedPresetType: null,
            isCropping: false,
            inspectorTab: 'project',
        }),

    selectShot: (shotId, defaultLayerId) =>
        set(() => ({
            selectedShotId: shotId,
            selectedLayerIds: defaultLayerId ? [defaultLayerId] : [],
            selectedBlockId: null,
            selectedCameraBlockId: null,
            selectedLightBlockId: null,
            selectedLightId: null,
            selectedPresetType: null,
            isCropping: false,
            inspectorTab: defaultLayerId ? 'layer' : 'shot',
        })),

    selectLayer: (layerId, toggleMulti = false) =>
        set((state) => {
            if (!toggleMulti) {
                return {
                    selectedLayerIds: [layerId],
                    selectedBlockId: null,
                    selectedCameraBlockId: null,
                    selectedLightBlockId: null,
                    selectedLightId: null,
                    selectedPresetType: null,
                    isCropping: false,
                    inspectorTab: 'layer',
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
                selectedLightId: null,
                isCropping: false,
                inspectorTab: 'layer',
            };
        }),

    selectLayerRange: (orderedLayerIds, targetLayerId) =>
        set((state) => {
            const anchorId = state.selectedLayerIds[0];
            if (!anchorId) {
                return { selectedLayerIds: [targetLayerId], selectedLightId: null, isCropping: false, inspectorTab: 'layer' };
            }
            const startIdx = orderedLayerIds.indexOf(anchorId);
            const endIdx = orderedLayerIds.indexOf(targetLayerId);
            if (startIdx === -1 || endIdx === -1) {
                return { selectedLayerIds: [targetLayerId], selectedLightId: null, isCropping: false, inspectorTab: 'layer' };
            }
            const low = Math.min(startIdx, endIdx);
            const high = Math.max(startIdx, endIdx);
            return {
                selectedLayerIds: orderedLayerIds.slice(low, high + 1),
                selectedCameraBlockId: null,
                selectedLightBlockId: null,
                selectedLightId: null,
                isCropping: false,
                inspectorTab: 'layer',
            };
        }),

    setSelectedLayerIds: (selectedLayerIds) =>
        set({
            selectedLayerIds,
            selectedCameraBlockId: null,
            selectedLightBlockId: null,
            ...(selectedLayerIds.length > 0 ? { selectedLightId: null } : {}),
            isCropping: false,
            inspectorTab: selectedLayerIds.length > 0 ? 'layer' : 'project',
        }),

    clearLayerSelection: () =>
        set({
            selectedLayerIds: [],
            selectedBlockId: null,
            selectedCameraBlockId: null,
            selectedLightBlockId: null,
            selectedPresetType: null,
            isCropping: false,
            inspectorTab: 'project',
        }),

    selectBlock: (blockId, layerId) =>
        set((state) => ({
            selectedBlockId: blockId,
            selectedCameraBlockId: null,
            selectedLightBlockId: null,
            selectedLightId: null,
            selectedPresetType: null,
            selectedLayerIds: layerId ? [layerId] : state.selectedLayerIds,
            inspectorTab: blockId ? 'blocks' : state.inspectorTab,
        })),

    selectCameraBlock: (cameraBlockId) =>
        set({
            selectedCameraBlockId: cameraBlockId,
            selectedBlockId: null,
            selectedLightBlockId: null,
            selectedLightId: null,
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

    selectLight: (lightId) =>
        set({
            selectedLightId: lightId,
            selectedLayerIds: [],
            selectedBlockId: null,
            selectedCameraBlockId: null,
            selectedLightBlockId: null,
            selectedPresetType: null,
            isCropping: false,
            inspectorTab: lightId ? 'shot' : 'project',
        }),

    setSelectedLightId: (selectedLightId) =>
        set({
            selectedLightId,
            ...(selectedLightId ? { selectedLayerIds: [], inspectorTab: 'shot' } : {}),
            isCropping: false,
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

    setTimelineLayerExpanded: (layerId, expanded) =>
        set((state) => {
            const exists = state.expandedTimelineLayerIds.includes(layerId);
            if (exists === expanded) return state;
            return {
                expandedTimelineLayerIds: expanded
                    ? [...state.expandedTimelineLayerIds, layerId]
                    : state.expandedTimelineLayerIds.filter((id) => id !== layerId),
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

    toggleLeftPanel: () => set((state) => ({ leftPanelOpen: !state.leftPanelOpen })),
    toggleRightSidebar: () => set((state) => ({ rightSidebarOpen: !state.rightSidebarOpen })),
    setLeftPanelOpen: (leftPanelOpen) => set({ leftPanelOpen }),
    setRightSidebarOpen: (rightSidebarOpen) => set({ rightSidebarOpen }),

    setLeftPanelWidth: (width) => {
        const clamped = Math.max(MIN_LEFT_PANEL_WIDTH, Math.min(MAX_LEFT_PANEL_WIDTH, Math.round(width)));
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.setItem('raylight_left_panel_width', String(clamped));
            }
        } catch {
            // Ignore localStorage restrictions
        }
        set({ leftPanelWidth: clamped });
    },

    setRightSidebarWidth: (width) => {
        const clamped = Math.max(MIN_RIGHT_SIDEBAR_WIDTH, Math.min(MAX_RIGHT_SIDEBAR_WIDTH, Math.round(width)));
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.setItem('raylight_right_sidebar_width', String(clamped));
            }
        } catch {
            // Ignore localStorage restrictions
        }
        set({ rightSidebarWidth: clamped });
    },

    resetPanelWidths: () => {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.removeItem('raylight_left_panel_width');
                window.localStorage.removeItem('raylight_right_sidebar_width');
            }
        } catch {
            // Ignore localStorage restrictions
        }
        set({
            leftPanelWidth: DEFAULT_LEFT_PANEL_WIDTH,
            rightSidebarWidth: DEFAULT_RIGHT_SIDEBAR_WIDTH,
        });
    },
}));
