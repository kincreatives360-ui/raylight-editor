import type { Layer, Vec3 } from '../model/types';
import {
  createDefaultImageLayer,
  createDefaultVideoLayer,
  createDefaultShapeLayer,
  createDefaultTextLayer,
} from '../model/defaults';
import { useSelectionStore } from './useSelectionStore';
import { generateId } from '../model/id';
import { pruneEmptyGroups } from './projectStoreGroupHelpers';
import type { ProjectStoreActionCreator } from './projectStoreTypes';

export const createLayerActions: ProjectStoreActionCreator<'addLayerToShot' | 'addMultipleLayersToShot' | 'deleteLayerFromShot' | 'deleteMultipleLayersFromShot' | 'duplicateLayerInShot' | 'reorderLayerInShot' | 'restackLayerInShot' | 'moveLayerToOrderAndGroup' | 'recordAnimatedBlockAtPlayhead'> = (_set, get) => ({
    addLayerToShot: (shotId, kind, customOverrides = {}) => {
        const state = get();
        let targetShot = state.project.shots.find((s) => s.id === shotId) || state.project.shots[0];
        if (!targetShot) targetShot = get().addShot();
        const nextOrder = targetShot.layers.length;

        const newLayer: Layer =
            kind === 'video'
                ? createDefaultVideoLayer({
                    name: `Video ${nextOrder + 1}`,
                    order: nextOrder,
                    outMs: targetShot.durationMs,
                    ...customOverrides,
                })
                : kind === 'image'
                    ? createDefaultImageLayer({
                        name: `Image ${nextOrder + 1}`,
                        order: nextOrder,
                        outMs: targetShot.durationMs,
                        ...customOverrides,
                    })
                    : kind === 'shape'
                        ? createDefaultShapeLayer({
                            name: `${customOverrides.shape
                                    ? customOverrides.shape.charAt(0).toUpperCase() +
                                    customOverrides.shape.slice(1)
                                    : 'Rectangle'
                                } ${nextOrder + 1}`,
                            order: nextOrder,
                            outMs: targetShot.durationMs,
                            ...customOverrides,
                        })
                        : createDefaultTextLayer({
                            name: `Text ${nextOrder + 1}`,
                            order: nextOrder,
                            outMs: targetShot.durationMs,
                            ...customOverrides,
                        });

        get().updateShot(targetShot.id, (shot) => ({
            ...shot,
            layers: [...shot.layers, newLayer],
        }));

        return newLayer;
    },

    addMultipleLayersToShot: (shotId, newLayers, newAssets = {}) => {
        if (newLayers.length === 0) return [];
        get().updateProject((proj) => ({
            ...proj,
            assets: {
                ...proj.assets,
                ...newAssets,
            },
            shots: proj.shots.map((s) => {
                if (s.id !== shotId) return s;
                const baseOrder = s.layers.length;
                const indexed = newLayers.map((l, idx) => ({
                    ...l,
                    order: baseOrder + idx,
                    outMs: s.durationMs,
                }));
                return {
                    ...s,
                    layers: [...s.layers, ...indexed],
                };
            }),
        }));
        return newLayers;
    },

    deleteLayerFromShot: (shotId, layerId) => {
        get().updateShot(shotId, (shot) => {
            const nextLayers = shot.layers
                .filter((l) => l.id !== layerId)
                .sort((a, b) => a.order - b.order)
                .map((l, idx) => ({
                    ...l,
                    order: idx,
                    maskLayerId: l.maskLayerId === layerId ? undefined : l.maskLayerId,
                }));
            return {
                ...shot,
                layers: nextLayers,
                groups: pruneEmptyGroups(shot.groups || [], nextLayers),
            };
        });
        try {
            const sel = useSelectionStore.getState();
            if (sel.selectedLayerIds.includes(layerId)) {
                const remaining = sel.selectedLayerIds.filter((id) => id !== layerId);
                if (remaining.length > 0) {
                    sel.setSelectedLayerIds(remaining);
                } else {
                    sel.clearLayerSelection();
                }
            }
        } catch {
            // Ignore in headless tests
        }
    },

    deleteMultipleLayersFromShot: (shotId, layerIds) => {
        if (!layerIds || layerIds.length === 0) return;
        const idSet = new Set(layerIds);
        get().updateShot(shotId, (shot) => {
            const nextLayers = shot.layers
                .filter((l) => !idSet.has(l.id))
                .sort((a, b) => a.order - b.order)
                .map((l, idx) => ({
                    ...l,
                    order: idx,
                    maskLayerId: l.maskLayerId && idSet.has(l.maskLayerId) ? undefined : l.maskLayerId,
                }));
            return {
                ...shot,
                layers: nextLayers,
                groups: pruneEmptyGroups(shot.groups || [], nextLayers),
            };
        });
        try {
            const sel = useSelectionStore.getState();
            const remaining = sel.selectedLayerIds.filter((id) => !idSet.has(id));
            if (remaining.length !== sel.selectedLayerIds.length) {
                if (remaining.length > 0) {
                    sel.setSelectedLayerIds(remaining);
                } else {
                    sel.clearLayerSelection();
                }
            }
        } catch {
            // Ignore in headless tests
        }
    },

    duplicateLayerInShot: (shotId, layerId) => {
        const state = get();
        const shot = state.project.shots.find((s) => s.id === shotId);
        const original = shot?.layers.find((l) => l.id === layerId);
        if (!shot || !original) return null;

        const copyId = generateId(`layer-${original.kind}`);

        const cloned: Layer = structuredClone(original);
        cloned.id = copyId;
        cloned.name = `${original.name} Copy`;
        cloned.order = shot.layers.length;
        cloned.position = {
            ...original.position,
            x: Number((original.position.x + 0.03).toFixed(4)),
            y: Number((original.position.y + 0.03).toFixed(4)),
        };
        cloned.blocks = cloned.blocks.map((b) => ({
            ...b,
            id: generateId('blk'),
        }));

        get().updateShot(shotId, (s) => ({
            ...s,
            layers: [...s.layers, cloned],
        }));

        return cloned;
    },

    reorderLayerInShot: (shotId, layerId, direction) => {
        get().restackLayerInShot(
            shotId,
            layerId,
            direction === 'up' ? 'forward' : 'backward'
        );
    },

    restackLayerInShot: (shotId, layerId, mode) => {
        get().updateShot(shotId, (shot) => {
            const sorted = [...shot.layers].sort((a, b) => a.order - b.order);
            const index = sorted.findIndex((l) => l.id === layerId);
            if (index < 0) return shot;

            const [item] = sorted.splice(index, 1);
            let targetIndex = index;

            if (mode === 'forward') {
                targetIndex = Math.min(sorted.length, index + 1);
            } else if (mode === 'backward') {
                targetIndex = Math.max(0, index - 1);
            } else if (mode === 'front') {
                targetIndex = sorted.length;
            } else if (mode === 'back') {
                targetIndex = 0;
            }

            sorted.splice(targetIndex, 0, item);
            const reindexed = sorted.map((l, idx) => ({ ...l, order: idx }));
            return { ...shot, layers: reindexed };
        });
    },

    moveLayerToOrderAndGroup: (
        shotId,
        draggedLayerId,
        targetLayerId,
        targetGroupId
    ) => {
        get().updateShot(shotId, (shot) => {
            const sorted = [...shot.layers].sort((a, b) => a.order - b.order);
            const fromIdx = sorted.findIndex((l) => l.id === draggedLayerId);
            if (fromIdx < 0) return shot;

            const [moved] = sorted.splice(fromIdx, 1);
            const updatedMoved: Layer = {
                ...moved,
                groupId: targetGroupId,
            };

            if (targetLayerId) {
                const toIdx = sorted.findIndex((l) => l.id === targetLayerId);
                if (toIdx >= 0) {
                    sorted.splice(toIdx, 0, updatedMoved);
                } else {
                    sorted.push(updatedMoved);
                }
            } else {
                sorted.push(updatedMoved);
            }

            return {
                ...shot,
                layers: sorted.map((l, idx) => ({ ...l, order: idx })),
            };
        });
    },

    recordAnimatedBlockAtPlayhead: (
        shotId,
        layerId,
        property,
        deltaAmount,
        shotLocalTimeMs,
        labelPrefix = 'Recorded',
        options
    ) => {
        const state = get();
        const shot = state.project.shots.find((s) => s.id === shotId);
        const layer = shot?.layers.find((l) => l.id === layerId);
        if (!shot || !layer) return '';

        const safeEndMs = Math.max(
            200,
            Math.min(shot.durationMs, Math.round(shotLocalTimeMs / 10) * 10)
        );

        const existingBlock = layer.blocks.find(
            (b) =>
                b.property === property &&
                Math.abs(b.startMs + b.durationMs - safeEndMs) <= 120
        );

        if (existingBlock) {
            const nextAmount: Vec3 | number =
                typeof existingBlock.amount === 'object' &&
                    typeof deltaAmount === 'object'
                    ? {
                        x: Number((existingBlock.amount.x + deltaAmount.x).toFixed(4)),
                        y: Number((existingBlock.amount.y + deltaAmount.y).toFixed(4)),
                        z: Number((existingBlock.amount.z + deltaAmount.z).toFixed(4)),
                    }
                    : typeof existingBlock.amount === 'number' &&
                        typeof deltaAmount === 'number'
                        ? Number((existingBlock.amount + deltaAmount).toFixed(4))
                        : deltaAmount;

            get().updateLayer(
                shotId,
                layerId,
                (l) => ({
                    ...l,
                    blocks: l.blocks.map((b) =>
                        b.id === existingBlock.id ? { ...b, amount: nextAmount } : b
                    ),
                }),
                options
            );
            return existingBlock.id;
        }

        const durationMs = Math.min(800, safeEndMs);
        const startMs = Math.max(0, safeEndMs - durationMs);
        const newBlockId = generateId('blk-rec');

        get().updateLayer(
            shotId,
            layerId,
            (l) => ({
                ...l,
                blocks: [
                    ...l.blocks,
                    {
                        id: newBlockId,
                        label: `${labelPrefix} ${property}`,
                        property,
                        startMs,
                        durationMs,
                        easing: { kind: 'spring', name: 'gentle' },
                        amount: deltaAmount,
                    },
                ],
            }),
            options
        );

        return newBlockId;
    },

});
