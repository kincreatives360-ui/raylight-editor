import { describe, expect, it } from 'vitest';
import { useSelectionStore } from './useSelectionStore';

describe('camera view bookmarks', () => {
  it('stores and clears independent bookmarks by shot', () => {
    const state = useSelectionStore.getState();
    const originalView = { canvasZoom: state.canvasZoom, canvasPan: state.canvasPan };
    const bookmark = { orbit: 35, tilt: 20, roll: 0, zoom: 1.2, targetX: 0.1, targetY: -0.2, targetZ: 0.3, focalLength: 50 };
    state.setCameraBookmark('shot-a', bookmark);
    state.setCameraBookmark('shot-b', { ...bookmark, orbit: 90 });
    expect(useSelectionStore.getState().cameraBookmarks).toEqual({ 'shot-a': bookmark, 'shot-b': { ...bookmark, orbit: 90 } });
    expect(useSelectionStore.getState()).toMatchObject(originalView);
    useSelectionStore.getState().setCameraBookmark('shot-a', null);
    expect(useSelectionStore.getState().cameraBookmarks).toEqual({ 'shot-b': { ...bookmark, orbit: 90 } });
    useSelectionStore.setState({ cameraBookmarks: {}, ...originalView });
  });
});
