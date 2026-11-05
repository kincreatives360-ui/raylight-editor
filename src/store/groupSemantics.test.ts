// src/store/groupSemantics.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore, pruneEmptyGroups } from './useProjectStore';
import { isLayerEffectivelyHidden, isLayerEffectivelyLocked, evaluateProjectAtTime } from '../engine/evaluateShot';
import type { Group, Layer } from '../model/types';
import { createDefaultImageLayer, createDefaultTextLayer } from '../model/defaults';

describe('Group Semantics: Visibility, Locking, and Nested Group Pruning', () => {
    beforeEach(() => {
        useProjectStore.getState().resetProject();
    });

    it('P1: toggling group hidden/locked preserves individual layer hidden/locked state', () => {
        const store = useProjectStore.getState();
        const shotId = store.project.shots[0].id;

        const layer1 = store.addLayerToShot(shotId, 'text', { name: 'Child 1' });
        const layer2 = store.addLayerToShot(shotId, 'text', { name: 'Child 2' });

        // Individually hide layer1 and lock layer2
        store.updateLayer(shotId, layer1.id, (l) => ({ ...l, hidden: true }));
        store.updateLayer(shotId, layer2.id, (l) => ({ ...l, locked: true }));

        // Create a group containing both layers
        const group = store.createGroupFromLayers(shotId, [layer1.id, layer2.id], 'Test Group');
        expect(group).not.toBeNull();
        const groupId = group!.id;

        // Verify layer1 is hidden, layer2 is locked
        let shot = useProjectStore.getState().project.shots[0];
        let l1 = shot.layers.find((l) => l.id === layer1.id)!;
        let l2 = shot.layers.find((l) => l.id === layer2.id)!;
        expect(l1.hidden).toBe(true);
        expect(l2.locked).toBe(true);

        // Hide group
        store.updateGroupInShot(shotId, groupId, (g) => ({ ...g, hidden: true }));

        // Both should now be effectively hidden
        shot = useProjectStore.getState().project.shots[0];
        l1 = shot.layers.find((l) => l.id === layer1.id)!;
        l2 = shot.layers.find((l) => l.id === layer2.id)!;
        expect(isLayerEffectivelyHidden(l1, shot.groups)).toBe(true);
        expect(isLayerEffectivelyHidden(l2, shot.groups)).toBe(true);

        // Unhide group - layer1 MUST STILL be hidden, layer2 MUST STILL be visible (hidden: false)
        store.updateGroupInShot(shotId, groupId, (g) => ({ ...g, hidden: false }));

        shot = useProjectStore.getState().project.shots[0];
        l1 = shot.layers.find((l) => l.id === layer1.id)!;
        l2 = shot.layers.find((l) => l.id === layer2.id)!;
        expect(l1.hidden).toBe(true);
        expect(isLayerEffectivelyHidden(l1, shot.groups)).toBe(true);
        expect(l2.hidden).toBe(false);
        expect(isLayerEffectivelyHidden(l2, shot.groups)).toBe(false);

        // Now test locking: Lock group
        store.updateGroupInShot(shotId, groupId, (g) => ({ ...g, locked: true }));
        shot = useProjectStore.getState().project.shots[0];
        l1 = shot.layers.find((l) => l.id === layer1.id)!;
        l2 = shot.layers.find((l) => l.id === layer2.id)!;
        expect(isLayerEffectivelyLocked(l1, shot.groups)).toBe(true);
        expect(isLayerEffectivelyLocked(l2, shot.groups)).toBe(true);

        // Unlock group - layer2 MUST STILL be locked, layer1 MUST STILL be unlocked
        store.updateGroupInShot(shotId, groupId, (g) => ({ ...g, locked: false }));
        shot = useProjectStore.getState().project.shots[0];
        l1 = shot.layers.find((l) => l.id === layer1.id)!;
        l2 = shot.layers.find((l) => l.id === layer2.id)!;
        expect(l1.locked).toBe(false);
        expect(isLayerEffectivelyLocked(l1, shot.groups)).toBe(false);
        expect(l2.locked).toBe(true);
        expect(isLayerEffectivelyLocked(l2, shot.groups)).toBe(true);
    });

    it('P1: nested group hierarchy propagates effective hidden and locked states recursively', () => {
        const parentGroup: Group = {
            id: 'grp-parent',
            name: 'Parent Group',
            collapsed: false,
            hidden: true,
            locked: false,
        };
        const childGroup: Group = {
            id: 'grp-child',
            parentGroupId: 'grp-parent',
            name: 'Child Group',
            collapsed: false,
            hidden: false,
            locked: true,
        };
        const groups = [parentGroup, childGroup];

        const layer: Layer = {
            ...createDefaultTextLayer(),
            id: 'test-layer',
            groupId: 'grp-child',
            hidden: false,
            locked: false,
        };

        // Even though layer itself is hidden:false, parentGroup.hidden:true makes it effectively hidden
        expect(isLayerEffectivelyHidden(layer, groups)).toBe(true);
        // Even though layer itself is locked:false, childGroup.locked:true makes it effectively locked
        expect(isLayerEffectivelyLocked(layer, groups)).toBe(true);
    });

    it('P2: pruneEmptyGroups preserves parent groups containing valid child groups', () => {
        const parentGroup: Group = {
            id: 'parent-1',
            name: 'Parent Group',
            collapsed: false,
            hidden: false,
            locked: false,
        };
        const childGroup: Group = {
            id: 'child-1',
            parentGroupId: 'parent-1',
            name: 'Child Group',
            collapsed: false,
            hidden: false,
            locked: false,
        };
        const layer: Layer = {
            ...createDefaultImageLayer(),
            id: 'layer-1',
            groupId: 'child-1',
        };

        const groups = [parentGroup, childGroup];
        const remaining = [layer];

        // Parent group has NO direct layers, but it has child-1 which has layer-1
        const pruned = pruneEmptyGroups(groups, remaining);
        expect(pruned.length).toBe(2);
        expect(pruned.some((g) => g.id === 'parent-1')).toBe(true);
        expect(pruned.some((g) => g.id === 'child-1')).toBe(true);

        // If layer-1 is deleted, both child and parent should be pruned bottom-up
        const prunedEmpty = pruneEmptyGroups(groups, []);
        expect(prunedEmpty.length).toBe(0);
    });

    it('P1: inherits spatial transform and animation blocks from parent groups in evaluateProjectAtTime', () => {
        const store = useProjectStore.getState();
        const shotId = store.project.shots[0].id;

        const layer = store.addLayerToShot(shotId, 'text', {
            name: 'Group Child',
            position: { x: 10, y: 20, z: 5 },
            scale: { x: 1, y: 1, z: 1 },
            opacity: 1,
        });

        const group = store.createGroupFromLayers(shotId, [layer.id], 'Transform Group');
        expect(group).not.toBeNull();

        // Update group with spatial transform and animation block
        store.updateGroupInShot(shotId, group!.id, (g) => ({
            ...g,
            position: { x: 100, y: 50, z: 20 },
            scale: { x: 2, y: 2, z: 1 },
            opacity: 0.8,
            blocks: [
                {
                    id: 'group-anim-1',
                    label: 'Position',
                    property: 'position',
                    amount: { x: 50, y: 0, z: 0 },
                    startMs: 0,
                    durationMs: 1000,
                    easing: { kind: 'preset', name: 'linear' },
                },
            ],
        }));

        const project = useProjectStore.getState().project;
        const frame0 = evaluateProjectAtTime(project, 0);
        const evalL0 = frame0.layers.find((l) => l.id === layer.id)!;
        expect(evalL0.position.x).toBe(120);
        expect(evalL0.position.y).toBe(90);
        expect(evalL0.position.z).toBe(25);
        expect(evalL0.scale.x).toBe(2);
        expect(evalL0.scale.y).toBe(2);
        expect(evalL0.opacity).toBeCloseTo(0.8, 2);

        const frame1000 = evaluateProjectAtTime(project, 1000);
        const evalL1000 = frame1000.layers.find((l) => l.id === layer.id)!;
        expect(evalL1000.position.x).toBe(170);
    });
});
