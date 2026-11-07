import type { ProjectStoreActionCreator } from './projectStoreTypes';
import { appendHistoryState } from './projectStoreConstants';
import { repairProjectReferentialIntegrity } from '../model/projectReferentialIntegrity';

export const createProjectActions: ProjectStoreActionCreator<'setHydrated' | 'updateProject' | 'updateShot' | 'updateLayer' | 'deleteAsset'> = (set, get) => ({
    setHydrated: (status) => set({ isHydrating: !status }),

    updateProject: (updater, options) =>
        set((state) => {
            const isDragging = state.dragSnapshot !== null;
            const isTransient = Boolean(options?.skipHistory || isDragging);
            const updated = {
                ...updater(state.project),
                updatedAt: isDragging ? state.project.updatedAt : new Date().toISOString(),
            };
            const nextRevision = state.hydrationRevision + 1;
            // Hot internal mutations retain validation state.
            // Full schema validation is scoped to I/O boundaries (load, import, reset, migration).
            const validation = state.validation;

            if (isTransient) {
                return { project: updated, validation, hydrationRevision: nextRevision };
            }

            return {
                project: updated,
                past: appendHistoryState(state.past, state.project),
                future: [],
                validation,
                hydrationRevision: nextRevision,
            };
        }),

    updateShot: (shotId, updater, options) => {
        get().updateProject(
            (proj) => ({
                ...proj,
                shots: proj.shots.map((s) =>
                    s.id === shotId
                        ? typeof updater === 'function'
                            ? { ...updater(s), isPlaceholder: false }
                            : { ...s, ...updater, isPlaceholder: false }
                        : s
                ),
            }),
            options
        );
    },

    updateLayer: (shotId, layerId, updater, options) => {
        get().updateShot(
            shotId,
            (shot) => ({
                ...shot,
                layers: shot.layers.map((l) => (l.id === layerId ? updater(l) : l)),
            }),
            options
        );
    },

    deleteAsset: (assetId: string) => {
        get().updateProject((proj) => {
            const nextAssets = { ...proj.assets };
            delete nextAssets[assetId];
            const nextShots = proj.shots.map((shot) => ({
                ...shot,
                layers: shot.layers.filter((l) => (l as { assetId?: string }).assetId !== assetId),
                background:
                    shot.background?.kind === 'image' && shot.background.assetId === assetId
                        ? { kind: 'solid' as const, color: shot.background.color ?? '#000000' }
                        : shot.background,
            }));
            let nextBg = proj.background;
            if (nextBg.kind === 'image' && nextBg.assetId === assetId) {
                nextBg = { kind: 'solid', color: nextBg.color ?? '#000000' };
            }
            const nextAudio = proj.audio
                ? {
                    ...proj.audio,
                    clips: (proj.audio.clips || []).filter((c) => c.assetId !== assetId),
                }
                : proj.audio;
            return repairProjectReferentialIntegrity({
                ...proj,
                assets: nextAssets,
                shots: nextShots,
                background: nextBg,
                audio: nextAudio,
            });
        });
    },
});
