import { useEffect } from 'react';
import type { Project } from '../model/types';
import { useProjectStore } from '../store/useProjectStore';
import { loadProjectFromIndexedDB, saveProjectToBrowser } from '../storage/projectIO';

interface UseAppProjectPersistenceOptions {
  project: Project;
  isHydrating: boolean;
  updateProject: ReturnType<typeof useProjectStore.getState>['updateProject'];
  setHydrated: ReturnType<typeof useProjectStore.getState>['setHydrated'];
}

export function useAppProjectPersistence({
  project,
  isHydrating,
  updateProject,
  setHydrated,
}: UseAppProjectPersistenceOptions): void {
  useEffect(() => {
    if (isHydrating) return;
    const timeoutId = window.setTimeout(() => saveProjectToBrowser(project), 250);
    const saveOnPageHide = () => {
      if (!isHydrating) saveProjectToBrowser(project);
    };
    window.addEventListener('pagehide', saveOnPageHide);
    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener('pagehide', saveOnPageHide);
    };
  }, [project, isHydrating]);

  useEffect(() => {
    void loadProjectFromIndexedDB()
      .then((indexedDbProject) => {
        if (!indexedDbProject?.assets || Object.keys(indexedDbProject.assets).length === 0) return;

        updateProject(
          (currentProject) => {
            if (indexedDbProject.id !== currentProject.id) return currentProject;

            const restoredAssets = { ...currentProject.assets };
            let hasNewData = false;
            for (const [id, asset] of Object.entries(indexedDbProject.assets)) {
              if (asset.dataUrl && (!restoredAssets[id] || !restoredAssets[id].dataUrl)) {
                if (!restoredAssets[id]) {
                  const isReferenced =
                    (currentProject.background?.kind === 'image' && currentProject.background.assetId === id) ||
                    currentProject.shots.some(
                      (shot) =>
                        (shot.background?.kind === 'image' && shot.background.assetId === id) ||
                        shot.layers.some(
                          (layer) => 'assetId' in layer && (layer as { assetId?: string }).assetId === id
                        )
                    ) ||
                    (currentProject.audio?.clips?.some((clip) => clip.assetId === id) ?? false);

                  if (!isReferenced) continue;
                }

                restoredAssets[id] = { ...(restoredAssets[id] || {}), ...asset };
                hasNewData = true;
              }
            }
            if (!hasNewData) return currentProject;
            return { ...currentProject, assets: restoredAssets };
          },
          { skipHistory: true }
        );
      })
      .catch((error) => {
        console.warn('[Raylight Storage] Hydration from IndexedDB failed:', error);
      })
      .finally(() => {
        setHydrated(true);
      });
  }, [updateProject, setHydrated]);
}
