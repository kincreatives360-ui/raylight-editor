import type { Project } from '../model/types';
import { DEFAULT_PROJECT, createDefaultProject } from '../model/defaults';
import { validateProject } from '../model/schema';
import { MAX_HISTORY_STEPS, appendHistoryState } from './projectStoreConstants';
import { useSelectionStore } from './useSelectionStore';
import { usePlayheadStore } from './usePlayheadStore';
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
            const committedProject = {
                ...state.project,
                updatedAt: new Date().toISOString(),
            };
            return {
                project: committedProject,
                past: appendHistoryState(state.past, state.dragSnapshot),
                future: [],
                dragSnapshot: null,
                validation: validateProject(committedProject),
            };
        }),

    undo: () =>
        set((state) => {
            if (state.past.length === 0) return state;
            const previous = state.past[state.past.length - 1];
            try {
                useSelectionStore.getState().pruneSelectionAgainstProject(previous);
            } catch {
                // Ignore in headless test runs
            }
            return {
                project: previous,
                past: state.past.slice(0, -1),
                future: [state.project, ...state.future].slice(0, MAX_HISTORY_STEPS),
                dragSnapshot: null,
                validation: validateProject(previous),
            };
        }),

    redo: () =>
        set((state) => {
            if (state.future.length === 0) return state;
            const next = state.future[0];
            try {
                useSelectionStore.getState().pruneSelectionAgainstProject(next);
            } catch {
                // Ignore in headless test runs
            }
            return {
                project: next,
                past: appendHistoryState(state.past, state.project),
                future: state.future.slice(1),
                dragSnapshot: null,
                validation: validateProject(next),
            };
        }),

    resetProject: () => {
        const fresh = createDefaultProject();
        try {
            useSelectionStore.getState().resetSelection(fresh.shots[0]?.id);
            usePlayheadStore.getState().setCurrentTimeMs(0);
        } catch {
            // Ignore in headless test runs
        }
        set({
            project: fresh,
            past: [],
            future: [],
            dragSnapshot: null,
            validation: validateProject(fresh),
        });
    },

    loadProjectJson: (rawJson) => {
        let parsedPayload = rawJson;
        if (typeof rawJson === 'string') {
            try {
                parsedPayload = JSON.parse(rawJson);
            } catch (err) {
                const parseErrorResult: ValidationResult = {
                    success: false,
                    errors: [`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`],
                };
                set({ validation: parseErrorResult });
                return parseErrorResult;
            }
        }

        let result = validateProject(parsedPayload);
        // Defensive repair fallback: if validation fails on partial project data (excluding arrays)
        if (!result.success && parsedPayload && typeof parsedPayload === 'object' && !Array.isArray(parsedPayload)) {
            try {
                const partial = parsedPayload as Partial<Project>;
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
            try {
                useSelectionStore.getState().resetSelection(result.data.shots[0]?.id);
                usePlayheadStore.getState().setCurrentTimeMs(0);
            } catch {
                // Ignore in headless test runs
            }
            set((state) => ({
                project: result.data,
                past: [],
                future: [],
                dragSnapshot: null,
                validation: result,
                isHydrating: false,
                hydrationRevision: state.hydrationRevision + 1,
            }));
        } else {
            set({ validation: result });
        }
        return result;
    },
});
