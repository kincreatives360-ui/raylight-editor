import { isBlankProjectState } from '../model/types';
import { createDefaultShot } from '../model/defaults';
import { cloneShotWithNewIds } from '../model/cloneShot';
import { useSelectionStore } from './useSelectionStore';
import { generateId } from '../model/id';
import { recalculateShotStartTimes } from './projectStoreTimelineHelpers';
import type { ProjectStoreActionCreator } from './projectStoreTypes';

export const createShotActions: ProjectStoreActionCreator<'addShot' | 'duplicateShot' | 'deleteShot' | 'splitAtPlayhead'> = (_set, get) => ({
    addShot: () => {
        const state = get();
        const isReplacingPlaceholder = isBlankProjectState(state.project);
        const realShots = isReplacingPlaceholder
            ? []
            : state.project.shots.filter((shot) => !shot.isPlaceholder);
        const count = realShots.length;
        const newShot = createDefaultShot({
            id: generateId('shot'),
            name: `Shot ${count + 1}`,
            isPlaceholder: false,
            durationMs: 3500,
            lane: count % 8,
            layers: [],
            cameraBlocks: [],
        });

        let addedShot = newShot;
        get().updateProject((proj) => {
            const nextShots = recalculateShotStartTimes(
                [
                    ...proj.shots.filter((shot) => !shot.isPlaceholder && !isBlankProjectState(proj)),
                    newShot,
                ]
            );
            addedShot = nextShots.find((s) => s.id === newShot.id) || nextShots[nextShots.length - 1];
            return {
                ...proj,
                shots: nextShots,
            };
        });

        return addedShot;
    },

    duplicateShot: (shotId) => {
        const state = get();
        const original = state.project.shots.find((s) => s.id === shotId);
        if (!original) return null;

        const cloned = cloneShotWithNewIds(original);
        cloned.name = `${original.name} (Copy)`;

        get().updateProject((proj) => {
            const idx = proj.shots.findIndex((s) => s.id === shotId);
            const nextShots = [...proj.shots];
            nextShots.splice(idx + 1, 0, cloned);
            return {
                ...proj,
                shots: recalculateShotStartTimes(nextShots),
            };
        });

        return cloned;
    },

    deleteShot: (shotId) => {
        get().updateProject((proj) => {
            if (!proj.shots.some((s) => s.id === shotId)) return proj;
            const filtered = proj.shots.filter((s) => s.id !== shotId);
            const remainingShots = recalculateShotStartTimes(filtered);
            try {
                const sel = useSelectionStore.getState();
                if (sel.selectedShotId === shotId && remainingShots.length > 0) {
                    sel.selectShot(remainingShots[0].id);
                } else if (sel.selectedShotId === shotId) {
                    sel.selectProject();
                }
            } catch {
                // Ignore in headless tests
            }
            return {
                ...proj,
                shots: remainingShots,
            };
        });
    },

    splitAtPlayhead: (globalTimeMs) => {
        const state = get();
        // Check if there is an audio clip under the playhead
        const audioClips = state.project.audio?.clips || [];
        const activeClip = audioClips.find(
            (c) => globalTimeMs > c.startMs + 100 && globalTimeMs < c.startMs + c.durationMs - 100
        );
        if (activeClip) {
            const res = get().splitAudioClipAtPlayhead(activeClip.id, globalTimeMs);
            if (res) return true;
        }

        // Otherwise find the active shot under playhead
        const activeShot = state.project.shots.find(
            (s) => globalTimeMs > s.startMs + 200 && globalTimeMs < s.startMs + s.durationMs - 200
        );
        if (activeShot) {
            const res = get().splitShotAtPlayhead(activeShot.id, globalTimeMs);
            if (res) return true;
        }

        return false;
    },

});
