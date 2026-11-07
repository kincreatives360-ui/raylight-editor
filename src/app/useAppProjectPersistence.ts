import { useEffect } from 'react';
import { isBlankProjectState, type Project } from '../model/types';
import { DEFAULT_PROJECT } from '../model/defaults';
import { useProjectStore } from '../store/useProjectStore';
import {
  loadProjectFromIndexedDB,
  restoreProjectAssetReferences,
  saveProjectToBrowser,
} from '../storage/projectIO';

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
        if (!indexedDbProject) return;

        updateProject(
          (currentProject) => {
            const isCurrentDefaultBlank =
              currentProject.id === DEFAULT_PROJECT.id &&
              isBlankProjectState(currentProject) &&
              Object.keys(currentProject.assets || {}).length === 0 &&
              (currentProject.audio?.clips?.length ?? 0) === 0;

            // If localStorage missed/failed on boot (leaving DEFAULT_PROJECT in memory),
            // adopt the full project persisted in IndexedDB.
            if (isCurrentDefaultBlank && indexedDbProject.id !== DEFAULT_PROJECT.id) {
              return restoreProjectAssetReferences(indexedDbProject);
            }

            if (indexedDbProject.id !== currentProject.id) return currentProject;

            const idbTime = indexedDbProject.updatedAt ? Date.parse(indexedDbProject.updatedAt) : 0;
            const curTime = currentProject.updatedAt ? Date.parse(currentProject.updatedAt) : 0;
            const baseProject =
              Number.isFinite(idbTime) && Number.isFinite(curTime) && idbTime > curTime
                ? indexedDbProject
                : currentProject;

            const restoredAssets = { ...baseProject.assets };
            let hasNewData = baseProject === indexedDbProject;

            for (const [id, asset] of Object.entries(indexedDbProject.assets || {})) {
              if (asset.dataUrl && (!restoredAssets[id] || !restoredAssets[id].dataUrl)) {
                if (!restoredAssets[id]) {
                  const isReferenced =
                    (baseProject.background?.kind === 'image' && baseProject.background.assetId === id) ||
                    baseProject.shots.some(
                      (shot) =>
                        (shot.background?.kind === 'image' && shot.background.assetId === id) ||
                        shot.layers.some(
                          (layer) => 'assetId' in layer && (layer as { assetId?: string }).assetId === id
                        )
                    ) ||
                    (baseProject.audio?.clips?.some((clip) => clip.assetId === id) ?? false);

                  if (!isReferenced) continue;
                }

                restoredAssets[id] = { ...(restoredAssets[id] || {}), ...asset };
                hasNewData = true;
              }
            }

            const hydrated = restoreProjectAssetReferences({
              ...baseProject,
              assets: restoredAssets,
            });
            if (!hasNewData && hydrated === baseProject) return currentProject;
            return hydrated;
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
