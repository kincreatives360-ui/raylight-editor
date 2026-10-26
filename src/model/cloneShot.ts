/** Deep-clone a shot while preserving only intentional shared asset references. */
import type { Shot } from './types';
import { generateId } from './id';

export function cloneShotWithNewIds(source: Shot): Shot {
    const shot = structuredClone(source);
    const ids = new Map<string, string>();
    const allocate = (oldId: string, prefix: string): string => {
        const value = generateId(prefix);
        ids.set(oldId, value);
        return value;
    };

    shot.id = generateId('shot');
    // Allocate IDs before fixing references: group and mask targets can be later in the array.
    for (const group of shot.groups) allocate(group.id, 'grp');
    for (const layer of shot.layers) allocate(layer.id, `layer-${layer.kind}`);
    for (const framing of shot.framings) allocate(framing.id, 'framing');
    const remap = (id: string | undefined): string | undefined =>
        id === undefined ? undefined : (ids.get(id) ?? id);

    shot.groups = shot.groups.map(group => ({
        ...group,
        id: ids.get(group.id)!,
        parentGroupId: remap(group.parentGroupId),
    }));
    shot.layers = shot.layers.map(layer => ({
        ...layer,
        id: ids.get(layer.id)!,
        groupId: remap(layer.groupId),
        maskLayerId: remap(layer.maskLayerId),
        blocks: layer.blocks.map(block => ({ ...block, id: generateId('blk') })),
        entrances: layer.entrances?.map(entry => ({
            ...entry,
            id: entry.id ? generateId('entrance') : undefined,
        })),
        exits: layer.exits?.map(entry => ({
            ...entry,
            id: entry.id ? generateId('exit') : undefined,
        })),
    }));
    shot.framings = shot.framings.map(framing => ({
        ...framing,
        id: ids.get(framing.id)!,
    }));
    shot.cameraBlocks = shot.cameraBlocks.map(block => ({
        ...block,
        id: generateId('cam-blk'),
        fromFramingId: remap(block.fromFramingId)!,
        toFramingId: remap(block.toFramingId)!,
    }));
    shot.lightBlocks = shot.lightBlocks?.map(block => ({ ...block, id: generateId('light-blk') }));
    shot.effectBlocks = shot.effectBlocks?.map(block => ({ ...block, id: generateId('effect-blk') }));
    shot.focusBlocks = shot.focusBlocks?.map(block => ({ ...block, id: generateId('focus-blk') }));
    return shot;
}
