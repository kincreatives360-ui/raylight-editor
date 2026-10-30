// src/store/useProjectStore.ts
import { create } from 'zustand';
import { DEFAULT_PROJECT } from '../model/defaults';
import { validateProject } from '../model/schema';
import { loadProjectFromBrowser } from '../storage/projectIO';
import type { ProjectStore } from './projectStoreTypes';
import { createProjectActions } from './projectStoreProjectActions';
import { createLayerActions } from './projectStoreLayerActions';
import { createCameraActions } from './projectStoreCameraActions';
import { createAudioActions } from './projectStoreAudioActions';
import { createGroupActions } from './projectStoreGroupActions';
import { createShotActions } from './projectStoreShotActions';
import { createShotSplitActions } from './projectStoreShotSplitActions';
import { createHistoryActions } from './projectStoreHistoryActions';

export type { AddCameraBlockOptions, RestackMode } from './projectStoreTypes';
export { pruneEmptyGroups } from './projectStoreGroupHelpers';
export { recalculateShotStartTimes } from './projectStoreTimelineHelpers';

const initialProject = loadProjectFromBrowser() || DEFAULT_PROJECT;

export const useProjectStore = create<ProjectStore>((set, get) => ({
    project: initialProject,
    past: [],
    future: [],
    dragSnapshot: null,
    validation: validateProject(initialProject),
    isHydrating: true,
    hydrationRevision: 0,
    ...createProjectActions(set, get),
    ...createLayerActions(set, get),
    ...createCameraActions(set, get),
    ...createAudioActions(set, get),
    ...createGroupActions(set, get),
    ...createShotActions(set, get),
    ...createShotSplitActions(set, get),
    ...createHistoryActions(set, get),
}));

if (typeof window !== 'undefined' && import.meta.env.DEV) {
    (window as unknown as { useProjectStore: typeof useProjectStore }).useProjectStore = useProjectStore;
}
