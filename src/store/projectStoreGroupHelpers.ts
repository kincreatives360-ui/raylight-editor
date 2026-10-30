import type { Group, Layer } from '../model/types';

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

