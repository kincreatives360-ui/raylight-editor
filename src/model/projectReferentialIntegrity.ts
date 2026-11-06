import type { Project, Group, Layer } from './types';
import { generateId } from './id';
import { AssetRecordSchema } from './projectSchemas';

/**
 * Recursively prunes empty groups containing zero layers and zero non-empty descendant groups,
 * reparenting any remaining descendant groups to the pruned group's parent.
 */
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

/**
 * Enforces unique entity IDs and repairs dangling references (framings, camera blocks,
 * light sources, light blocks, groups, parent groups, mask layers, and missing assets).
 */
export function repairProjectReferentialIntegrity(project: Project): Project {
  const seenIds = new Set<string>();

  const ensureUniqueId = (id: string | undefined, prefix: string): string => {
    let candidate = id && typeof id === 'string' && id.trim().length > 0 ? id.trim() : generateId(prefix);
    while (seenIds.has(candidate)) {
      candidate = generateId(prefix);
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
    // 2a. Deduplicate & remap framings
    const framingRemap = new Map<string, string>();
    let repairedFramings = (shot.framings || []).map((f) => {
      const origId = f.id;
      const uniqueId = ensureUniqueId(f.id, 'framing');
      if (origId && origId !== uniqueId) framingRemap.set(origId, uniqueId);
      return { ...f, id: uniqueId };
    });

    if (repairedFramings.length === 0) {
      const f1Id = ensureUniqueId('framing-1', 'framing');
      const f2Id = ensureUniqueId('framing-2', 'framing');
      repairedFramings = [
        {
          id: f1Id,
          name: 'Wide Establishing',
          target: { x: 0, y: 0, z: 0 },
          zoom: 1.0,
        },
        {
          id: f2Id,
          name: 'Feature Push-In',
          target: { x: -96, y: 22, z: 0 },
          zoom: 1.15,
        },
      ];
    }

    const validFramingIds = new Set(repairedFramings.map((f) => f.id));
    const fallbackFromFramingId = repairedFramings[0]?.id || 'f1';
    const fallbackToFramingId = repairedFramings[1]?.id || fallbackFromFramingId;

    // 2b. Camera blocks referencing framings
    const cameraBlocks = (shot.cameraBlocks || []).map((cb) => {
      let fromFramingId = cb.fromFramingId ? framingRemap.get(cb.fromFramingId) ?? cb.fromFramingId : fallbackFromFramingId;
      if (!validFramingIds.has(fromFramingId)) fromFramingId = fallbackFromFramingId;

      let toFramingId = cb.toFramingId ? framingRemap.get(cb.toFramingId) ?? cb.toFramingId : fallbackToFramingId;
      if (!validFramingIds.has(toFramingId)) toFramingId = fallbackToFramingId;

      return {
        ...cb,
        id: ensureUniqueId(cb.id, 'cam'),
        fromFramingId,
        toFramingId,
      };
    });

    // 2c. Light sources & light blocks
    const lightSourceRemap = new Map<string, string>();
    const repairedLightSources = (shot.light?.sources || []).map((src) => {
      const origId = src.id;
      const uniqueId = ensureUniqueId(src.id, 'light-src');
      if (origId && origId !== uniqueId) lightSourceRemap.set(origId, uniqueId);
      return { ...src, id: uniqueId };
    });
    const validLightSourceIds = new Set(repairedLightSources.map((s) => s.id));

    const lightBlocks = (shot.lightBlocks || []).map((lb) => {
      let targetLightId = lb.targetLightId ? lightSourceRemap.get(lb.targetLightId) ?? lb.targetLightId : undefined;
      if (targetLightId && !validLightSourceIds.has(targetLightId)) {
        targetLightId = undefined;
      }
      return {
        ...lb,
        id: ensureUniqueId(lb.id, 'light'),
        targetLightId,
      };
    });

    const effectBlocks = (shot.effectBlocks || []).map((eb) => ({
      ...eb,
      id: ensureUniqueId(eb.id, 'eff'),
    }));

    // 2d. Groups deduplication, cycle detection & repair
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

    // 2e. Layers deduplication & reference repair
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
    
    // Detect circular mask layer references
    const detectMaskCycle = (startId: string, currentId: string, visited: Set<string>): boolean => {
      if (visited.has(currentId)) return true;
      visited.add(currentId);
      const layer = rawLayers.find((l) => l.id === currentId);
      if (layer?.maskLayerId) {
        return detectMaskCycle(startId, layer.maskLayerId, visited);
      }
      return false;
    };

    const repairedLayers = rawLayers.map((l) => {
      let groupId = l.groupId ? groupRemap.get(l.groupId) ?? l.groupId : undefined;
      if (groupId && !validGroupIds.has(groupId)) {
        groupId = undefined;
      }

      let maskLayerId = l.maskLayerId ? layerRemap.get(l.maskLayerId) ?? l.maskLayerId : undefined;
      if (maskLayerId && (!validLayerIds.has(maskLayerId) || maskLayerId === l.id)) {
        maskLayerId = undefined;
      } else if (maskLayerId) {
        // Check for circular mask references
        if (detectMaskCycle(l.id, maskLayerId, new Set([l.id]))) {
          maskLayerId = undefined;
        }
      }

      // If an image or video layer references an asset not yet in assets, supply a safe fallback stub
      if ((l.kind === 'image' || l.kind === 'video') && 'assetId' in l && l.assetId) {
        const assetId = l.assetId;
        if (!assets[assetId]) {
          // Use schema default values instead of hardcoded
          const fallbackAsset = AssetRecordSchema.parse({
            id: assetId,
            name: l.name || 'Imported media',
            mimeType: l.kind === 'video' ? 'video/mp4' : 'image/png',
            dataUrl: '',
            width: 1920,
            height: 1080,
          });
          assets[assetId] = fallbackAsset;
        }
      }

      return {
        ...l,
        groupId,
        maskLayerId,
      };
    });

    // 2f. Prune empty groups containing no layers and no children (Raylight J8 contract)
    const prunedGroups = pruneEmptyGroups(repairedGroups, repairedLayers);

    // 2g. Depth of Field focus references repair
    let repairedEffects = shot.effects;
    if (shot.effects?.depthOfField) {
      let focusLayerId = shot.effects.depthOfField.focusLayerId;
      if (focusLayerId) {
        focusLayerId = layerRemap.get(focusLayerId) ?? focusLayerId;
        if (!validLayerIds.has(focusLayerId)) {
          focusLayerId = null;
        }
      }
      let focusAssetId = shot.effects.depthOfField.focusAssetId;
      if (focusAssetId && !assets[focusAssetId]) {
        focusAssetId = undefined;
      }
      repairedEffects = {
        ...shot.effects,
        depthOfField: {
          ...shot.effects.depthOfField,
          focusLayerId: focusLayerId ?? null,
          focusAssetId,
        },
      };
    }

    return {
      ...shot,
      framings: repairedFramings,
      cameraBlocks,
      light: shot.light
        ? {
            ...shot.light,
            sources: repairedLightSources,
          }
        : shot.light,
      lightBlocks,
      effectBlocks,
      groups: prunedGroups,
      layers: repairedLayers,
      effects: repairedEffects,
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

