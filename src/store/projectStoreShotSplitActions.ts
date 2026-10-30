import type { Shot } from '../model/types';
import { cloneShotWithNewIds } from '../model/cloneShot';
import { pruneEmptyGroups } from './projectStoreGroupHelpers';
import {
    recalculateShotStartTimes,
    shiftBlocksForSecondHalf,
    sliceSceneBlocks,
    trimBlocksForFirstHalf,
} from './projectStoreTimelineHelpers';
import type { ProjectStoreActionCreator } from './projectStoreTypes';

export const createShotSplitActions: ProjectStoreActionCreator<'splitShotAtPlayhead'> = (_set, get) => ({
    splitShotAtPlayhead: (shotId, globalTimeMs) => {
        const state = get();
        const target = state.project.shots.find((s) => s.id === shotId);
        if (!target) return null;

        const localSplitMs = Math.round(globalTimeMs - target.startMs);
        if (localSplitMs < 300 || localSplitMs > target.durationMs - 300) {
            return null;
        }

        const firstDuration = localSplitMs;
        const secondDuration = target.durationMs - localSplitMs;

        // Clone the entire owned graph before trimming so the second shot cannot
        // retain group, mask or camera-framing references to the first shot.
        const secondShot: Shot = cloneShotWithNewIds(target);
        secondShot.name = `${target.name} (Part 2)`;
        secondShot.startMs = target.startMs + firstDuration;
        secondShot.durationMs = secondDuration;
        secondShot.transition = {
            type: 'cut',
            durationMs: 0,
            easing: { kind: 'preset', name: 'linear' },
        };
        // Blocks entirely after the cut belong only to the second shot and may
        // retain their stable IDs. Crossing blocks receive new IDs when sliced.
        // Camera framing references remain remapped by cloneShotWithNewIds.
        const originalLayerById = new Map(target.layers.map((layer) => [layer.id, layer]));
        // Clone preserves layer order; we use that order to restore IDs only for
        // blocks absent from the left shot, avoiding duplicate IDs across halves.
        secondShot.layers = secondShot.layers.map((layer, index) => {
            const original = target.layers[index];
            const source = originalLayerById.get(original.id);
            return {
                ...layer,
                blocks: layer.blocks.map((block, blockIndex) => {
                    const old = source?.blocks[blockIndex];
                    return old && old.startMs >= firstDuration
                        ? { ...block, id: old.id } : block;
                }),
            };
        });
        secondShot.cameraBlocks = secondShot.cameraBlocks.map((block, index) => {
            const original = target.cameraBlocks[index];
            return original && original.startMs >= firstDuration
                ? { ...block, id: original.id } : block;
        });
        const restoreFutureBlockIds = <T extends { id: string; startMs: number }>(
            cloned: T[] | undefined, original: T[] | undefined,
        ): T[] | undefined => cloned?.map((block, index) => {
            const source = original?.[index];
            return source && source.startMs >= firstDuration
                ? { ...block, id: source.id } : block;
        });
        secondShot.lightBlocks = restoreFutureBlockIds(secondShot.lightBlocks, target.lightBlocks);
        secondShot.effectBlocks = restoreFutureBlockIds(secondShot.effectBlocks, target.effectBlocks);
        secondShot.focusBlocks = restoreFutureBlockIds(secondShot.focusBlocks, target.focusBlocks);
        // An interval which ends at the split is absent from the second shot.
        // In particular, never revive it using an arbitrary 100ms minimum.
        secondShot.layers = secondShot.layers
            .filter((layer) => layer.outMs > firstDuration && layer.inMs < target.durationMs)
            .map((layer) => ({
                ...layer,
                inMs: Math.max(0, layer.inMs - firstDuration),
                outMs: Math.min(secondDuration, layer.outMs - firstDuration),
                blocks: shiftBlocksForSecondHalf(layer.blocks, firstDuration, 'blk'),
            }));
        const secondIds = new Set(secondShot.layers.map((layer) => layer.id));
        secondShot.layers = secondShot.layers.map((layer) => ({
            ...layer,
            maskLayerId: layer.maskLayerId && secondIds.has(layer.maskLayerId)
                ? layer.maskLayerId : undefined,
        }));
        secondShot.groups = pruneEmptyGroups(secondShot.groups, secondShot.layers);
        secondShot.cameraBlocks = shiftBlocksForSecondHalf(secondShot.cameraBlocks, firstDuration, 'cam-blk');
        secondShot.lightBlocks = sliceSceneBlocks(secondShot.lightBlocks, firstDuration, secondDuration);
        secondShot.effectBlocks = sliceSceneBlocks(secondShot.effectBlocks, firstDuration, secondDuration);
        secondShot.focusBlocks = sliceSceneBlocks(secondShot.focusBlocks, firstDuration, secondDuration, 'focus-blk');

        get().updateProject((proj) => {
            const idx = proj.shots.findIndex((s) => s.id === shotId);
            const updatedFirst: Shot = {
                ...target,
                durationMs: firstDuration,
                layers: target.layers
                    .filter((layer) => layer.inMs < firstDuration && layer.outMs > 0)
                    .map((layer) => ({
                        ...layer,
                        outMs: Math.min(firstDuration, layer.outMs),
                        blocks: trimBlocksForFirstHalf(layer.blocks, firstDuration),
                    }))
                    .map((layer, _index, layers) => ({
                        ...layer,
                        maskLayerId: layer.maskLayerId && layers.some((candidate) => candidate.id === layer.maskLayerId)
                            ? layer.maskLayerId : undefined,
                    })),
                cameraBlocks: trimBlocksForFirstHalf(target.cameraBlocks, firstDuration),
                lightBlocks: sliceSceneBlocks(target.lightBlocks, 0, firstDuration),
                effectBlocks: sliceSceneBlocks(target.effectBlocks, 0, firstDuration),
                focusBlocks: sliceSceneBlocks(target.focusBlocks, 0, firstDuration),
            };
            updatedFirst.groups = pruneEmptyGroups(updatedFirst.groups, updatedFirst.layers);
            const nextShots = [...proj.shots];
            nextShots.splice(idx, 1, updatedFirst, secondShot);
            return { ...proj, shots: recalculateShotStartTimes(nextShots) };
        });

        return secondShot;
    },

});
