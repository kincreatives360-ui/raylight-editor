import type { ProjectStoreActionCreator } from './projectStoreTypes';
import { MAX_HISTORY_STEPS } from './projectStoreConstants';

export const createProjectActions: ProjectStoreActionCreator<'setHydrated' | 'updateProject' | 'updateShot' | 'updateLayer'> = (set, get) => ({
    setHydrated: (status) => set({ isHydrating: !status }),

    updateProject: (updater, options) =>
        set((state) => {
            const updated = {
                ...updater(state.project),
                updatedAt: new Date().toISOString(),
            };
            const nextRevision = state.hydrationRevision + 1;
            // Hot internal mutations retain validation state.
            // Full schema validation is scoped to I/O boundaries (load, import, reset, migration).
            const validation = state.validation;

            if (options?.skipHistory || state.dragSnapshot !== null) {
                return { project: updated, validation, hydrationRevision: nextRevision };
            }

            return {
                project: updated,
                past: [...state.past.slice(-(MAX_HISTORY_STEPS - 1)), state.project],
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

});
