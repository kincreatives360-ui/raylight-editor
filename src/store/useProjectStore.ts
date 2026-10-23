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
    AudioClip,
    CameraBlock,
    CameraKeyframeEndpoint,
    Easing,
} from '../model/types';
import {
    DEFAULT_PROJECT,
    createDefaultProject,
    createDefaultImageLayer,
    createDefaultVideoLayer,
    createDefaultShapeLayer,
    createDefaultTextLayer,
    createDefaultShot,
    createDefaultCameraBlock,
} from '../model/defaults';
import { validateProject, type ValidationResult } from '../model/schema';
import { loadProjectFromBrowser } from '../storage/projectIO';
import { useSelectionStore } from './useSelectionStore';
import { generateId } from '../model/id';

const MAX_HISTORY_STEPS = 50;

export interface AddCameraBlockOptions {
    label?: string;
    startMs?: number;
    durationMs?: number;
    mode?: CameraBlock['mode'];
    fromFramingId?: string;
    toFramingId?: string;
    from?: CameraKeyframeEndpoint;
    to?: CameraKeyframeEndpoint;
    easing?: Easing;
}

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

function trimBlocksForFirstHalf<T extends { startMs: number; durationMs: number }>(
    blocks: T[] | undefined,
    splitMs: number
): T[] {
    if (!blocks) return [];
    return blocks
        .filter((b) => b.startMs < splitMs)
        .map((b) => ({
            ...b,
            durationMs: Math.min(b.durationMs, splitMs - b.startMs),
        }));
}

function shiftBlocksForSecondHalf<T extends { id?: string; startMs: number; durationMs: number }>(
    blocks: T[] | undefined,
    splitMs: number,
    prefix = 'blk'
): T[] {
    if (!blocks) return [];
    return blocks
        .filter((b) => b.startMs + b.durationMs > splitMs)
        .map((b) => {
            const wasSplit = b.startMs < splitMs;
            const newStart = Math.max(0, b.startMs - splitMs);
            const remaining = b.startMs + b.durationMs - splitMs;
            return {
                ...b,
                id: wasSplit ? generateId(prefix) : (b.id ?? generateId(prefix)),
                startMs: newStart,
                durationMs: Math.min(b.durationMs, remaining),
            };
        });
}

export function pruneEmptyGroups(groups: Group[], remainingLayers: Layer[]): Group[] {
    const layerGroupIds = new Set(remainingLayers.map((l) => l.groupId).filter(Boolean));
    let currentGroups = [...groups];
    let changed = true;

    while (changed) {
        changed = false;
        const nextGroups = currentGroups.filter((g) => {
            if (layerGroupIds.has(g.id)) return true;
            return currentGroups.some((other) => other.parentGroupId === g.id && other.id !== g.id);
        });

        if (nextGroups.length !== currentGroups.length) {
            currentGroups = nextGroups;
            changed = true;
        }
    }

    const finalGroupIds = new Set(currentGroups.map((g) => g.id));
    return currentGroups.map((g) => {
        if (g.parentGroupId && !finalGroupIds.has(g.parentGroupId)) {
            return { ...g, parentGroupId: undefined };
        }
        return g;
    });
}

export type RestackMode = 'forward' | 'backward' | 'front' | 'back';

interface ProjectStore {
    project: Project;
    past: Project[];
    future: Project[];
    dragSnapshot: Project | null;
    validation: ValidationResult;
    isHydrating: boolean;
    hydrationRevision: number;
    setHydrated: (status: boolean) => void;

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
    addCameraBlockToShot: (
        shotId: string,
        options?: AddCameraBlockOptions
    ) => CameraBlock | null;
    toggleProjectAudioMuted: () => void;
    addMultipleLayersToShot: (
        shotId: string,
        newLayers: Layer[],
        newAssets?: Record<string, AssetRecord>
    ) => Layer[];
    deleteLayerFromShot: (shotId: string, layerId: string) => void;
    deleteMultipleLayersFromShot: (shotId: string, layerIds: string[]) => void;
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
    splitAudioClipAtPlayhead: (clipId: string, globalTimeMs: number) => AudioClip | null;
    splitAtPlayhead: (globalTimeMs: number) => boolean;

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
    isHydrating: true,
    hydrationRevision: 0,
    setHydrated: (status) => set({ isHydrating: !status }),

    updateProject: (updater, options) =>
        set((state) => {
            const updated = {
                ...updater(state.project),
                updatedAt: new Date().toISOString(),
            };
            const nextRevision = state.hydrationRevision + 1;
            // Pointer-move updates inside a drag are transient. Validate the committed
            // project once at pointer-up instead of reparsing the full asset graph per frame.
            const validation = state.dragSnapshot === null
                ? validateProject(updated)
                : state.validation;

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

        get().updateShot(shotId, (shot) => ({
            ...shot,
            layers: [...shot.layers, newLayer],
        }));

        return newLayer;
    },

    addCameraBlockToShot: (shotId, options = {}) => {
        const shot = get().project.shots.find((candidate) => candidate.id === shotId);
        if (!shot) return null;

        const id = generateId('cam-blk');
        const block: CameraBlock = {
            ...createDefaultCameraBlock(
                id,
                options.startMs ?? 0,
                options.durationMs ?? shot.durationMs,
                options.fromFramingId ?? shot.framings[0]?.id ?? 'f1',
                options.toFramingId ?? shot.framings[1]?.id ?? 'f2',
                options.label ?? 'Camera Move'
            ),
            ...(options.mode ? { mode: options.mode } : {}),
            ...(options.from ? { from: options.from } : {}),
            ...(options.to ? { to: options.to } : {}),
            ...(options.easing ? { easing: options.easing } : {}),
        };

        get().updateShot(shotId, (currentShot) => ({
            ...currentShot,
            cameraBlocks: [...(currentShot.cameraBlocks || []), block],
        }));
        return block;
    },

    toggleProjectAudioMuted: () => {
        get().updateProject((project) => ({
            ...project,
            audio: {
                ...(project.audio ?? { clips: [], masterVolume: 1 }),
                muted: !project.audio?.muted,
            },
        }));
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

    createGroupFromLayers: (shotId, layerIds, name) => {
        if (layerIds.length === 0) return null;
        const state = get();
        const shot = state.project.shots.find((s) => s.id === shotId);
        if (!shot) return null;

        const firstLayer = shot.layers.find((l) => l.id === layerIds[0]);
        const parentGroupId = firstLayer?.groupId;

        const newGroup: Group = {
            id: generateId('grp'),
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
            const updatedGroups = (shot.groups || []).map((g) =>
                g.id === groupId ? updater(g) : g
            );
            return {
                ...shot,
                groups: updatedGroups,
            };
        });
    },

    // Every new shot created is completely BLANK (no default layers, no default camera move)
    addShot: () => {
        const state = get();
        const count = state.project.shots.length;
        const newShot = createDefaultShot({
            id: generateId('shot'),
            name: `Shot ${count + 1}`,
            durationMs: 3500,
            lane: count % 8,
            layers: [],
            cameraBlocks: [],
        });

        let addedShot = newShot;
        get().updateProject((proj) => {
            const nextShots = recalculateShotStartTimes([...proj.shots, newShot]);
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

        const cloned: Shot = structuredClone(original);
        cloned.id = generateId('shot');
        cloned.name = `${original.name} (Copy)`;
        cloned.layers = cloned.layers.map((l) => ({
            ...l,
            id: generateId(`layer-${l.kind}`),
            blocks: (l.blocks || []).map((b) => ({
                ...b,
                id: generateId('blk'),
            })),
        }));
        cloned.cameraBlocks = (cloned.cameraBlocks || []).map((b) => ({
            ...b,
            id: generateId('cam-blk'),
        }));
        cloned.lightBlocks = (cloned.lightBlocks || []).map((b) => ({
            ...b,
            id: generateId('light-blk'),
        }));
        cloned.effectBlocks = (cloned.effectBlocks || []).map((b) => ({
            ...b,
            id: generateId('effect-blk'),
        }));
        cloned.focusBlocks = (cloned.focusBlocks || []).map((b) => ({
            ...b,
            id: generateId('focus-blk'),
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
            const remainingShots = recalculateShotStartTimes(filtered);
            try {
                const sel = useSelectionStore.getState();
                if (sel.selectedShotId === shotId && remainingShots.length > 0) {
                    sel.selectShot(remainingShots[0].id);
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

        const secondShot: Shot = structuredClone(target);
        secondShot.id = generateId('shot');
        secondShot.name = `${target.name} (Part 2)`;
        secondShot.startMs = target.startMs + firstDuration;
        secondShot.durationMs = secondDuration;
        // Split shots are contiguous continuations: incoming transition must be a seamless cut
        secondShot.transition = {
            type: 'cut',
            durationMs: 0,
            easing: { kind: 'preset', name: 'linear' },
        };
        secondShot.layers = secondShot.layers.map((l) => ({
            ...l,
            id: generateId(`layer-${l.kind}`),
            inMs: Math.max(0, l.inMs - firstDuration),
            outMs: Math.max(100, Math.min(secondDuration, l.outMs - firstDuration)),
            blocks: shiftBlocksForSecondHalf(l.blocks, firstDuration, 'blk'),
        }));
        secondShot.cameraBlocks = shiftBlocksForSecondHalf(target.cameraBlocks, firstDuration, 'cam-blk');
        secondShot.lightBlocks = shiftBlocksForSecondHalf(target.lightBlocks, firstDuration, 'light-blk');
        secondShot.effectBlocks = shiftBlocksForSecondHalf(target.effectBlocks, firstDuration, 'effect-blk');
        secondShot.focusBlocks = shiftBlocksForSecondHalf(target.focusBlocks, firstDuration, 'focus-blk');

        get().updateProject((proj) => {
            const idx = proj.shots.findIndex((s) => s.id === shotId);
            const updatedFirst: Shot = {
                ...target,
                durationMs: firstDuration,
                layers: target.layers.map((l) => ({
                    ...l,
                    outMs: Math.min(firstDuration, l.outMs),
                    blocks: trimBlocksForFirstHalf(l.blocks, firstDuration),
                })),
                cameraBlocks: trimBlocksForFirstHalf(target.cameraBlocks, firstDuration),
                lightBlocks: trimBlocksForFirstHalf(target.lightBlocks, firstDuration),
                effectBlocks: trimBlocksForFirstHalf(target.effectBlocks, firstDuration),
                focusBlocks: trimBlocksForFirstHalf(target.focusBlocks, firstDuration),
            };
            const nextShots = [...proj.shots];
            nextShots.splice(idx, 1, updatedFirst, secondShot);
            return { ...proj, shots: recalculateShotStartTimes(nextShots) };
        });

        return secondShot;
    },

    splitAudioClipAtPlayhead: (clipId, globalTimeMs) => {
        const state = get();
        const clips = state.project.audio?.clips || [];
        const target = clips.find((c) => c.id === clipId);
        if (!target) return null;

        const splitOffsetMs = globalTimeMs - target.startMs;
        if (splitOffsetMs < 100 || splitOffsetMs > target.durationMs - 100) {
            return null;
        }

        const firstDuration = splitOffsetMs;
        const secondDuration = target.durationMs - splitOffsetMs;

        const secondClip: AudioClip = {
            ...target,
            id: generateId('audio-clip'),
            name: `${target.name} (Part 2)`,
            startMs: globalTimeMs,
            durationMs: secondDuration,
            offsetMs: (target.offsetMs || 0) + firstDuration,
        };

        const updatedFirst: AudioClip = {
            ...target,
            durationMs: firstDuration,
        };

        get().updateProject((proj) => {
            const currentClips = proj.audio?.clips || [];
            const idx = currentClips.findIndex((c) => c.id === clipId);
            if (idx === -1) return proj;
            const nextClips = [...currentClips];
            nextClips.splice(idx, 1, updatedFirst, secondClip);
            return {
                ...proj,
                audio: {
                    ...(proj.audio || { muted: false, masterVolume: 1 }),
                    clips: nextClips,
                },
            };
        });

        return secondClip;
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
                validation: validateProject(previous),
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
                validation: validateProject(next),
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
                    shots: Array.isArray(partial.shots) && partial.shots.length > 0
                        ? partial.shots
                        : DEFAULT_PROJECT.shots,
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
    },
}));

if (typeof window !== 'undefined' && import.meta.env.DEV) {
    (window as unknown as { useProjectStore: typeof useProjectStore }).useProjectStore = useProjectStore;
}
