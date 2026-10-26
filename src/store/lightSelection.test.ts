import { describe, it, expect, beforeEach } from 'vitest';
import { useSelectionStore } from './useSelectionStore';

describe('useSelectionStore - Light Selection', () => {
    beforeEach(() => {
        useSelectionStore.setState({
            selectedLightId: null,
            selectedLayerIds: ['layer-1'],
            selectedBlockId: null,
            selectedCameraBlockId: null,
            inspectorTab: 'layer',
        });
    });

    it('initializes with selectedLightId as null', () => {
        expect(useSelectionStore.getState().selectedLightId).toBeNull();
    });

    it('selects a light, clearing layer selection', () => {
        useSelectionStore.getState().selectLight('sun-key');
        const state = useSelectionStore.getState();
        expect(state.selectedLightId).toBe('sun-key');
        expect(state.selectedLayerIds).toEqual([]);
    });

    it('deselects light with null or selectProject', () => {
        useSelectionStore.getState().selectLight('spot-1');
        expect(useSelectionStore.getState().selectedLightId).toBe('spot-1');

        useSelectionStore.getState().selectLight(null);
        expect(useSelectionStore.getState().selectedLightId).toBeNull();

        useSelectionStore.getState().selectLight('area-1');
        useSelectionStore.getState().selectProject();
        expect(useSelectionStore.getState().selectedLightId).toBeNull();
    });

    it('clears selectedLightId when a layer is selected', () => {
        useSelectionStore.getState().selectLight('point-1');
        expect(useSelectionStore.getState().selectedLightId).toBe('point-1');

        useSelectionStore.getState().selectLayer('layer-2');
        expect(useSelectionStore.getState().selectedLightId).toBeNull();
        expect(useSelectionStore.getState().selectedLayerIds).toEqual(['layer-2']);
    });
});
