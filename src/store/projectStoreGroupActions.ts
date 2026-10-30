import type { Group } from '../model/types';
import { generateId } from '../model/id';
import type { ProjectStoreActionCreator } from './projectStoreTypes';

export const createGroupActions: ProjectStoreActionCreator<'createGroupFromLayers' | 'ungroupInShot' | 'updateGroupInShot'> = (_set, get) => ({
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

        const idSet = new Set(layerIds);
        get().updateShot(shotId, (s) => ({
            ...s,
            groups: [...s.groups, newGroup],
            layers: s.layers.map((l) =>
                idSet.has(l.id) ? { ...l, groupId: newGroup.id } : l
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
});
