import type { Project } from './types';

/**
 * Enforces unique entity IDs and repairs dangling references (groups, parent groups, mask layers, and missing assets).
 */
export function repairProjectReferentialIntegrity(project: Project): Project {
  const seenIds = new Set<string>();
  let idCounter = 1;

  const ensureUniqueId = (id: string | undefined, prefix: string): string => {
    let candidate = id && typeof id === 'string' && id.trim().length > 0 ? id.trim() : `${prefix}-${idCounter++}`;
    while (seenIds.has(candidate)) {
      candidate = `${prefix}-${Date.now().toString(36)}-${idCounter++}`;
    }
    seenIds.add(candidate);
    return candidate;
  };

  // 1. Deduplicate Shot and Asset IDs
  const shots = (project.shots || []).map((shot) => ({
    ...shot,
    id: ensureUniqueId(shot.id, 'shot'),
  }));

  const assets: Project['assets'] = {};
  for (const [key, asset] of Object.entries(project.assets || {})) {
    if (!asset) continue;
    const uniqueAssetId = ensureUniqueId(asset.id || key, 'asset');
    assets[uniqueAssetId] = {
      ...asset,
      id: uniqueAssetId,
    };
  }

  // 2. Deduplicate IDs and repair references in each Shot
  const repairedShots = shots.map((shot) => {
    const groupRemap = new Map<string, string>();
    const rawGroups = (shot.groups || []).map((g) => {
      const origId = g.id;
      const uniqueId = ensureUniqueId(g.id, 'grp');
      if (origId && origId !== uniqueId) groupRemap.set(origId, uniqueId);
      return { ...g, id: uniqueId };
    });

    const groupsWithRemappedParents = rawGroups.map((g) => ({
      ...g,
      parentGroupId: g.parentGroupId ? groupRemap.get(g.parentGroupId) ?? g.parentGroupId : undefined,
    }));

    const validGroupIds = new Set(groupsWithRemappedParents.map((g) => g.id));
    const repairedGroups = groupsWithRemappedParents.map((g) => {
      let parentGroupId = g.parentGroupId;
      if (parentGroupId && (!validGroupIds.has(parentGroupId) || parentGroupId === g.id)) {
        parentGroupId = undefined;
      }
      // Break cycle loops in parent chains
      if (parentGroupId) {
        let curr: string | undefined = parentGroupId;
        const chain = new Set<string>([g.id]);
        while (curr) {
          if (chain.has(curr)) {
            parentGroupId = undefined;
            break;
          }
          chain.add(curr);
          curr = groupsWithRemappedParents.find((x) => x.id === curr)?.parentGroupId;
        }
      }
      return { ...g, parentGroupId };
    });

    const cameraBlocks = (shot.cameraBlocks || []).map((cb) => ({
      ...cb,
      id: ensureUniqueId(cb.id, 'cam'),
    }));
    const lightBlocks = (shot.lightBlocks || []).map((lb) => ({
      ...lb,
      id: ensureUniqueId(lb.id, 'light'),
    }));
    const effectBlocks = (shot.effectBlocks || []).map((eb) => ({
      ...eb,
      id: ensureUniqueId(eb.id, 'eff'),
    }));

    const layerRemap = new Map<string, string>();
    const rawLayers = (shot.layers || []).map((l) => {
      const origId = l.id;
      const uniqueId = ensureUniqueId(l.id, `layer-${l.kind || 'elem'}`);
      if (origId && origId !== uniqueId) layerRemap.set(origId, uniqueId);

      const blocks = (l.blocks || []).map((b) => ({
        ...b,
        id: ensureUniqueId(b.id, 'blk'),
      }));

      return {
        ...l,
        id: uniqueId,
        blocks,
      };
    });

    const validLayerIds = new Set(rawLayers.map((l) => l.id));
    const repairedLayers = rawLayers.map((l) => {
      let groupId = l.groupId ? groupRemap.get(l.groupId) ?? l.groupId : undefined;
      if (groupId && !validGroupIds.has(groupId)) {
        groupId = undefined;
      }

      let maskLayerId = l.maskLayerId ? layerRemap.get(l.maskLayerId) ?? l.maskLayerId : undefined;
      if (maskLayerId && (!validLayerIds.has(maskLayerId) || maskLayerId === l.id)) {
        maskLayerId = undefined;
      }

      // If an image or video layer references an asset not yet in assets, supply a safe fallback stub
      if ((l.kind === 'image' || l.kind === 'video') && 'assetId' in l && l.assetId) {
        const assetId = l.assetId;
        if (!assets[assetId]) {
          assets[assetId] = {
            id: assetId,
            name: l.name || 'Imported media',
            mimeType: l.kind === 'video' ? 'video/mp4' : 'image/png',
            dataUrl: '',
            width: 1920,
            height: 1080,
          };
        }
      }

      return {
        ...l,
        groupId,
        maskLayerId,
      };
    });

    return {
      ...shot,
      groups: repairedGroups,
      cameraBlocks,
      lightBlocks,
      effectBlocks,
      layers: repairedLayers,
    };
  });

  const audioClips = (project.audio?.clips || []).map((c) => ({
    ...c,
    id: ensureUniqueId(c.id, 'audio'),
  }));

  return {
    ...project,
    shots: repairedShots,
    assets,
    audio: project.audio
      ? {
          ...project.audio,
          clips: audioClips,
        }
      : undefined,
  };
}

