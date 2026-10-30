import type { Project } from '../model/types';
import { DEFAULT_PROJECT, createDefaultProject } from '../model/defaults';
import { validateProject } from '../model/schema';
import { MAX_HISTORY_STEPS } from './projectStoreConstants';
import type { ProjectStoreActionCreator } from './projectStoreTypes';

export const createHistoryActions: ProjectStoreActionCreator<'beginDragTransaction' | 'commitDragTransaction' | 'undo' | 'redo' | 'resetProject' | 'loadProjectJson'> = (set) => ({
    beginDragTransaction: () =>
        set((state) => {
            if (state.dragSnapshot !== null) return state;
            return { dragSnapshot: state.project };
        }),

    commitDragTransaction: () =>
        set((state) => {
            if (state.dragSnapshot === null) return state;
            if (state.dragSnapshot === state.project) {
                return { dragSnapshot: null };
            }
            return {
                past: [
                    ...state.past.slice(-(MAX_HISTORY_STEPS - 1)),
                    state.dragSnapshot,
                ],
                future: [],
                dragSnapshot: null,
                validation: validateProject(state.project),
            };
        }),

    undo: () =>
        set((state) => {
            if (state.past.length === 0) return state;
            const previous = state.past[state.past.length - 1];
            return {
                project: previous,
                past: state.past.slice(0, -1),
                future: [state.project, ...state.future].slice(0, MAX_HISTORY_STEPS),
                dragSnapshot: null,
                validation: state.validation,
            };
        }),

    redo: () =>
        set((state) => {
            if (state.future.length === 0) return state;
            const next = state.future[0];
            return {
                project: next,
                past: [...state.past.slice(-(MAX_HISTORY_STEPS - 1)), state.project],
                future: state.future.slice(1),
                dragSnapshot: null,
                validation: state.validation,
            };
        }),

    resetProject: () => {
        const fresh = createDefaultProject();
        set({
            project: fresh,
            past: [],
            future: [],
            dragSnapshot: null,
            validation: validateProject(fresh),
        });
    },

    loadProjectJson: (rawJson) => {
        let result = validateProject(rawJson);
        // Defensive repair fallback: if validation fails on partial project data (excluding arrays)
        if (!result.success && rawJson && typeof rawJson === 'object' && !Array.isArray(rawJson)) {
            try {
                const partial = rawJson as Partial<Project>;
                const repaired = {
                    ...DEFAULT_PROJECT,
                    ...partial,
                    shots: Array.isArray(partial.shots) ? partial.shots : DEFAULT_PROJECT.shots,
                    assets: { ...DEFAULT_PROJECT.assets, ...(partial.assets || {}) },
                    audio: partial.audio || DEFAULT_PROJECT.audio,
                };
                const repairResult = validateProject(repaired);
                if (repairResult.success) {
                    result = repairResult;
                }
            } catch {
                // Keep original validation error
            }
        }

        if (result.success) {
            set((state) => ({
                project: result.data,
                past: [...state.past.slice(-(MAX_HISTORY_STEPS - 1)), state.project],
                future: [],
                validation: result,
                isHydrating: false,
                hydrationRevision: state.hydrationRevision + 1,
            }));
        } else {
            set({ validation: result });
        }
        return result;
    },});
