// src/model/projectReferentialIntegrity.test.ts
import { describe, it, expect } from 'vitest';
import {
  repairProjectReferentialIntegrity,
  pruneEmptyGroups,
} from './projectReferentialIntegrity';
import {
  createDefaultProject,
  createDefaultShot,
  createDefaultShapeLayer,
  createDefaultImageLayer,
} from './defaults';
import type { Project, Group } from './types';

describe('repairProjectReferentialIntegrity', () => {
  it('deduplicates colliding entity IDs across shots and assets', () => {
    const project = createDefaultProject();
    project.shots = [
      createDefaultShot({ id: 'colliding-id' }),
      createDefaultShot({ id: 'colliding-id' }),
    ];
    project.assets = {
      'asset-1': {
        id: 'colliding-id',
        name: 'Asset 1',
        mimeType: 'image/png',
        dataUrl: '',
        width: 100,
        height: 100,
      },
    };

    const repaired = repairProjectReferentialIntegrity(project);
    const shotIds = repaired.shots.map((s) => s.id);
    const assetIds = Object.values(repaired.assets).map((a) => a.id);

    expect(shotIds[0]).not.toBe(shotIds[1]);
    expect(shotIds).not.toContain(assetIds[0]);
  });

  it('provisions default framings and repairs dangling camera block references', () => {
    const project = createDefaultProject();
    const shot = createDefaultShot();
    shot.framings = []; // Empty framings
    shot.cameraBlocks = [
      {
        id: 'cam-1',
        startMs: 0,
        durationMs: 1000,
        fromFramingId: 'ghost-framing-1',
        toFramingId: 'ghost-framing-2',
        mode: 'dolly',
        easing: { kind: 'preset', name: 'linear' },
      },
    ];
    project.shots = [shot];

    const repaired = repairProjectReferentialIntegrity(project);
    const repairedShot = repaired.shots[0];

    expect(repairedShot.framings.length).toBeGreaterThanOrEqual(2);
    const validFramingIds = new Set(repairedShot.framings.map((f) => f.id));
    expect(validFramingIds.has(repairedShot.cameraBlocks[0].fromFramingId)).toBe(true);
    expect(validFramingIds.has(repairedShot.cameraBlocks[0].toFramingId)).toBe(true);
  });

  it('deduplicates light sources and clears invalid targetLightId on lightBlocks', () => {
    const project = createDefaultProject();
    const shot = createDefaultShot();
    shot.light = {
      ...shot.light,
      sources: [
        {
          id: 'src-dup',
          name: 'Light 1',
          type: 'point',
          enabled: true,
          position: { x: 0, y: 1, z: 2 },
          intensity: 1,
          color: '#ffffff',
        },
        {
          id: 'src-dup',
          name: 'Light 2',
          type: 'spot',
          enabled: true,
          position: { x: 1, y: 1, z: 2 },
          intensity: 1,
          color: '#ffffff',
        },
      ],
    };
    shot.lightBlocks = [
      {
        id: 'lb-1',
        label: 'Valid Light Block',
        targetLightId: 'src-dup',
        startMs: 0,
        durationMs: 500,
        fromX: 0,
        fromY: 0,
        toX: 1,
        toY: 1,
        fromIntensity: 1,
        toIntensity: 2,
        easing: { kind: 'preset', name: 'linear' },
      },
      {
        id: 'lb-2',
        label: 'Dangling Light Block',
        targetLightId: 'non-existent-source',
        startMs: 0,
        durationMs: 500,
        fromX: 0,
        fromY: 0,
        toX: 1,
        toY: 1,
        fromIntensity: 1,
        toIntensity: 2,
        easing: { kind: 'preset', name: 'linear' },
      },
    ];
    project.shots = [shot];

    const repaired = repairProjectReferentialIntegrity(project);
    const sources = repaired.shots[0].light?.sources || [];
    expect(sources[0].id).not.toBe(sources[1].id);

    const validSourceIds = new Set(sources.map((s) => s.id));
    expect(validSourceIds.has(repaired.shots[0].lightBlocks![0].targetLightId!)).toBe(true);
    expect(repaired.shots[0].lightBlocks![1].targetLightId).toBeUndefined();
  });

  it('prunes empty groups and breaks circular parent group chains', () => {
    const project = createDefaultProject();
    const shot = createDefaultShot();
    const layer = createDefaultShapeLayer({ id: 'layer-in-child', groupId: 'child-group' });

    shot.groups = [
      {
        id: 'parent-group',
        name: 'Parent Group',
        parentGroupId: 'child-group', // Circular reference!
        collapsed: false,
        hidden: false,
        locked: false,
      },
      {
        id: 'child-group',
        name: 'Child Group',
        parentGroupId: 'parent-group', // Circular reference!
        collapsed: false,
        hidden: false,
        locked: false,
      },
      {
        id: 'empty-orphan-group',
        name: 'Empty Group',
        collapsed: false,
        hidden: false,
        locked: false,
      },
    ];
    shot.layers = [layer];
    project.shots = [shot];

    const repaired = repairProjectReferentialIntegrity(project);
    const groups = repaired.shots[0].groups;

    // Empty group must be pruned
    expect(groups.some((g) => g.name === 'Empty Group')).toBe(false);

    // Parent group circular ancestry must be broken (one of them has parentGroupId undefined)
    const hasBrokenCycle = groups.some((g) => g.parentGroupId === undefined);
    expect(hasBrokenCycle).toBe(true);
  });

  it('clears invalid focusLayerId and focusAssetId in depth of field effects', () => {
    const project = createDefaultProject();
    const shot = createDefaultShot();
    const layer = createDefaultShapeLayer({ id: 'real-layer' });
    shot.layers = [layer];
    shot.effects = {
      ...shot.effects,
      depthOfField: {
        ...shot.effects.depthOfField,
        focusLayerId: 'ghost-layer',
        focusAssetId: 'ghost-asset',
      },
    };
    project.shots = [shot];

    const repaired = repairProjectReferentialIntegrity(project);
    const dof = repaired.shots[0].effects.depthOfField;

    expect(dof.focusLayerId).toBeNull();
    expect(dof.focusAssetId).toBeUndefined();
  });

  it('provisions safe fallback asset stubs when image/video layer references missing asset', () => {
    const project = createDefaultProject();
    const shot = createDefaultShot();
    const imgLayer = createDefaultImageLayer({
      id: 'img-1',
      name: 'Unlinked Image',
      assetId: 'missing-asset-id',
    });
    shot.layers = [imgLayer];
    project.shots = [shot];
    project.assets = {}; // No assets

    const repaired = repairProjectReferentialIntegrity(project);

    expect(repaired.assets['missing-asset-id']).toBeDefined();
    expect(repaired.assets['missing-asset-id'].name).toBe('Unlinked Image');
    expect(repaired.assets['missing-asset-id'].mimeType).toBe('image/png');
  });
});

describe('pruneEmptyGroups', () => {
  it('preserves groups with direct or indirect layers, pruning only strictly empty subtrees', () => {
    const groups: Group[] = [
      { id: 'g-root', name: 'Root', collapsed: false, hidden: false, locked: false },
      { id: 'g-mid', name: 'Mid', parentGroupId: 'g-root', collapsed: false, hidden: false, locked: false },
      { id: 'g-leaf', name: 'Leaf', parentGroupId: 'g-mid', collapsed: false, hidden: false, locked: false },
      { id: 'g-dead', name: 'Dead', collapsed: false, hidden: false, locked: false },
    ];
    const layers = [
      createDefaultShapeLayer({ groupId: 'g-leaf' }),
    ];

    const pruned = pruneEmptyGroups(groups, layers);
    const remainingIds = pruned.map((g) => g.id);

    expect(remainingIds).toContain('g-root');
    expect(remainingIds).toContain('g-mid');
    expect(remainingIds).toContain('g-leaf');
    expect(remainingIds).not.toContain('g-dead');
  });
});

