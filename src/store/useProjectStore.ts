// src/store/useProjectStore.ts
import { create } from 'zustand';
import type {
    Project,
    Shot,
    Layer,
    Group,
    AnimationBlockProperty,
    Vec3,
    ImageLayer,
    ShapeLayer,
    TextLayer,
    AssetRecord,
} from '../model/types';
import {
    DEFAULT_PROJECT,
    createDefaultImageLayer,
    createDefaultShapeLayer,
    createDefaultTextLayer,
    createDefaultShot,
} from '../model/defaults';
import { validateProject, type ValidationResult } from '../model/schema';
import { loadProjectFromBrowser } from '../storage/projectIO';

const MAX_HISTORY_STEPS = 50;

export function recalculateShotStartTimes(shots: Shot[]): Shot[] {
    let runningMs = 0;
    return shots.map((shot, idx) => {
        const updated = {
            ...shot,
            startMs: runningMs,
            lane: shot.lane ?? idx % 8,
        };
        runningMs += shot.durationMs;
        return updated;
    });
}

export type RestackMode = 'forward' | 'backward' | 'front' | 'back';

interface ProjectStore {
    project: Project;
    past: Project[];
    future: Project[];
    dragSnapshot: Project | null;
    validation: ValidationResult;

    updateProject: (
        updater: (project: Project) => Project,
        options?: { skipHistory?: boolean }
    ) => void;
    updateShot: (
        shotId: string,
        updater: (shot: Shot) => Shot,
        options?: { skipHistory?: boolean }
    ) => void;
    updateLayer: (
        shotId: string,
        layerId: string,
        updater: (layer: Layer) => Layer,
        options?: { skipHistory?: boolean }
    ) => void;

    addLayerToShot: (
        shotId: string,
        kind: Layer['kind'],
        customOverrides?: Partial<ImageLayer> &
            Partial<ShapeLayer> &
            Partial<TextLayer>
    ) => Layer;
    addMultipleLayersToShot: (
        shotId: string,
        newLayers: Layer[],
        newAssets?: Record<string, AssetRecord>
    ) => Layer[];
    deleteLayerFromShot: (shotId: string, layerId: string) => void;
    duplicateLayerInShot: (shotId: string, layerId: string) => Layer | null;
    reorderLayerInShot: (
        shotId: string,
        layerId: string,
        direction: 'up' | 'down'
    ) => void;
    restackLayerInShot: (
        shotId: string,
        layerId: string,
        mode: RestackMode
    ) => void;
    moveLayerToOrderAndGroup: (
        shotId: string,
        draggedLayerId: string,
        targetLayerId: string | null,
        targetGroupId: string | undefined
    ) => void;

    recordAnimatedBlockAtPlayhead: (
        shotId: string,
        layerId: string,
        property: AnimationBlockProperty,
        deltaAmount: Vec3 | number,
        shotLocalTimeMs: number,
        labelPrefix?: string,
        options?: { skipHistory?: boolean }
    ) => string;

    createGroupFromLayers: (
        shotId: string,
        layerIds: string[],
        name?: string
    ) => Group | null;
    ungroupInShot: (shotId: string, groupId: string) => void;
    updateGroupInShot: (
        shotId: string,
        groupId: string,
        updater: (group: Group) => Group
    ) => void;

    addShot: () => Shot;
    duplicateShot: (shotId: string) => Shot | null;
    deleteShot: (shotId: string) => void;
    splitShotAtPlayhead: (shotId: string, globalTimeMs: number) => Shot | null;

    beginDragTransaction: () => void;
    commitDragTransaction: () => void;
    undo: () => void;
    redo: () => void;
    resetProject: () => void;
    loadProjectJson: (rawJson: unknown) => ValidationResult;
}

const initialProject = loadProjectFromBrowser() || DEFAULT_PROJECT;

export const useProjectStore = create<ProjectStore>((set, get) => ({
    project: initialProject,
    past: [],
    future: [],
    dragSnapshot: null,
    validation: validateProject(initialProject),

    updateProject: (updater, options) =>
        set((state) => {
            const updated = {
                ...updater(state.project),
                updatedAt: new Date().toISOString(),
            };
            const validation = validateProject(updated);

            if (options?.skipHistory || state.dragSnapshot !== null) {
                return { project: updated, validation };
            }

            return {
                project: updated,
                past: [...state.past.slice(-(MAX_HISTORY_STEPS - 1)), state.project],
                future: [],
                validation,
            };
        }),

    updateShot: (shotId, updater, options) => {
        get().updateProject(
            (proj) => ({
                ...proj,
                shots: proj.shots.map((s) => (s.id === shotId ? updater(s) : s)),
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

    addLayerToShot: (shotId, kind, customOverrides = {}) => {
        const state = get();
        const targetShot =
            state.project.shots.find((s) => s.id === shotId) ||
            state.project.shots[0];
        const nextOrder = targetShot.layers.length;

        const newLayer: Layer =
            kind === 'image'
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

        get().updateShot(shotId, (shot) => ({
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
        get().updateShot(shotId, (shot) => ({
            ...shot,
            layers: shot.layers
                .filter((l) => l.id !== layerId)
                .sort((a, b) => a.order - b.order)
                .map((l, idx) => ({ ...l, order: idx })),
        }));
    },

    duplicateLayerInShot: (shotId, layerId) => {
        const state = get();
        const shot = state.project.shots.find((s) => s.id === shotId);
        const original = shot?.layers.find((l) => l.id === layerId);
        if (!shot || !original) return null;

        const copyId = `layer-${original.kind}-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 5)}`;

        const cloned: Layer = JSON.parse(JSON.stringify(original));
        cloned.id = copyId;
        cloned.name = `${original.name} Copy`;
        cloned.order = shot.layers.length;
        cloned.position = {
            ...original.position,
            x: Number((original.position.x + 0.03).toFixed(4)),
            y: Number((original.position.y + 0.03).toFixed(4)),
        };
        cloned.blocks = cloned.blocks.map((b, i) => ({
            ...b,
            id: `blk-${Date.now()}-${i}`,
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
        const newBlockId = `blk-rec-${Date.now()}`;

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

    createGroupFromLayers: (shotId, layerIds, name) => {
        if (layerIds.length === 0) return null;
        const state = get();
        const shot = state.project.shots.find((s) => s.id === shotId);
        if (!shot) return null;

        const firstLayer = shot.layers.find((l) => l.id === layerIds[0]);
        const parentGroupId = firstLayer?.groupId;

        const newGroup: Group = {
            id: `grp-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            name: name || `Group ${shot.groups.length + 1}`,
            parentGroupId,
            collapsed: false,
            hidden: false,
            locked: false,
        };

        get().updateShot(shotId, (s) => ({
            ...s,
            groups: [...s.groups, newGroup],
            layers: s.layers.map((l) =>
                layerIds.includes(l.id) ? { ...l, groupId: newGroup.id } : l
            ),
        }));

        return newGroup;
    },

    ungroupInShot: (shotId, groupId) => {
        get().updateShot(shotId, (shot) => {
            const targetGroup = shot.groups.find((g) => g.id === groupId);
            const fallbackParentId = targetGroup?.parentGroupId;

            return {
                ...shot,
                groups: shot.groups
                    .filter((g) => g.id !== groupId)
                    .map((g) =>
                        g.parentGroupId === groupId
                            ? { ...g, parentGroupId: fallbackParentId }
                            : g
                    ),
                layers: shot.layers.map((l) =>
                    l.groupId === groupId ? { ...l, groupId: fallbackParentId } : l
                ),
            };
        });
    },

    updateGroupInShot: (shotId, groupId, updater) => {
        get().updateShot(shotId, (shot) => {
            const updatedGroups = shot.groups.map((g) =>
                g.id === groupId ? updater(g) : g
            );
            const targetGroup = updatedGroups.find((g) => g.id === groupId);

            const nextLayers = targetGroup
                ? shot.layers.map((l) =>
                    l.groupId === groupId
                        ? {
                            ...l,
                            hidden: targetGroup.hidden,
                            locked: targetGroup.locked,
                        }
                        : l
                )
                : shot.layers;

            return {
                ...shot,
                groups: updatedGroups,
                layers: nextLayers,
            };
        });
    },

    // Every new shot created is completely BLANK (no default layers, no default camera move)
    addShot: () => {
        const state = get();
        const count = state.project.shots.length;
        const newShot = createDefaultShot({
            id: `shot-${Date.now()}`,
            name: `Shot ${count + 1}`,
            durationMs: 3500,
            lane: count % 8,
            layers: [],
            cameraBlocks: [],
        });

        get().updateProject((proj) => ({
            ...proj,
            shots: recalculateShotStartTimes([...proj.shots, newShot]),
        }));

        return newShot;
    },

    duplicateShot: (shotId) => {
        const state = get();
        const original = state.project.shots.find((s) => s.id === shotId);
        if (!original) return null;

        const cloned: Shot = JSON.parse(JSON.stringify(original));
        cloned.id = `shot-${Date.now()}`;
        cloned.name = `${original.name} (Copy)`;
        cloned.layers = cloned.layers.map((l, idx) => ({
            ...l,
            id: `layer-${l.kind}-${Date.now()}-${idx}`,
        }));

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
            if (proj.shots.length <= 1) return proj;
            const filtered = proj.shots.filter((s) => s.id !== shotId);
            return {
                ...proj,
                shots: recalculateShotStartTimes(filtered),
            };
        });
    },

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

        const secondShot: Shot = JSON.parse(JSON.stringify(target));
        secondShot.id = `shot-${Date.now()}`;
        secondShot.name = `${target.name} (Part 2)`;
        secondShot.startMs = target.startMs + firstDuration;
        secondShot.durationMs = secondDuration;
        secondShot.layers = secondShot.layers.map((l, idx) => ({
            ...l,
            id: `layer-${l.kind}-${Date.now()}-${idx}`,
            inMs: Math.max(0, l.inMs - firstDuration),
            outMs: Math.max(100, Math.min(secondDuration, l.outMs - firstDuration)),
        }));

        get().updateProject((proj) => {
            const idx = proj.shots.findIndex((s) => s.id === shotId);
            const updatedFirst: Shot = {
                ...target,
                durationMs: firstDuration,
                layers: target.layers.map((l) => ({
                    ...l,
                    outMs: Math.min(firstDuration, l.outMs),
                })),
            };
            const nextShots = [...proj.shots];
            nextShots.splice(idx, 1, updatedFirst, secondShot);
            return { ...proj, shots: nextShots };
        });

        return secondShot;
    },

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
            };
        }),

    undo: () =>
        set((state) => {
            if (state.past.length === 0) return state;
            const previous = state.past[state.past.length - 1];
            return {
                project: previous,
                past: state.past.slice(0, -1),
                future: [state.project, ...state.future],
                dragSnapshot: null,
                validation: validateProject(previous),
            };
        }),

    redo: () =>
        set((state) => {
            if (state.future.length === 0) return state;
            const next = state.future[0];
            return {
                project: next,
                past: [...state.past, state.project],
                future: state.future.slice(1),
                dragSnapshot: null,
                validation: validateProject(next),
            };
        }),

    resetProject: () =>
        set({
            project: DEFAULT_PROJECT,
            past: [],
            future: [],
            dragSnapshot: null,
            validation: validateProject(DEFAULT_PROJECT),
        }),

    loadProjectJson: (rawJson) => {
        const result = validateProject(rawJson);
        if (result.success) {
            set((state) => ({
                project: result.data,
                past: [...state.past, state.project],
                future: [],
                validation: result,
            }));
        } else {
            set({ validation: result });
        }
        return result;
    },
}));