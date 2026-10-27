import type { LightRig, LightAnimationBlock } from '../model/types';
import { evaluateEasing } from './easing';
import { lerp, lerpHex } from './lightingSystem';

/** Deep clone of a rig (position, target, rotation and every source). */
export function cloneLightRig(rig: LightRig): LightRig {
  return {
    ...rig,
    position: { ...rig.position },
    sources: rig.sources
      ? rig.sources.map((s) => ({
          ...s,
          position: { ...s.position },
          target: s.target ? { ...s.target } : undefined,
          rotation: s.rotation ? { ...s.rotation } : undefined,
        }))
      : undefined,
  };
}

type PropertyName =
  | 'x'
  | 'y'
  | 'z'
  | 'intensity'
  | 'color'
  | 'temperature'
  | 'angle'
  | 'penumbra'
  | 'ambience';

interface ResolvedValue<T> {
  from: T;
  to: T;
}

function getPropertyEndpoints(
  b: LightAnimationBlock,
  prop: PropertyName,
  baseVal: number | string
): ResolvedValue<number | string> | null {
  if (b.property !== undefined) {
    const expected = prop === 'x' || prop === 'y' || prop === 'z' ? 'position' : prop;
    if (b.property !== expected) return null;
  }
  switch (prop) {
    case 'x':
      if (b.fromX !== undefined && b.toX !== undefined) {
        return { from: b.fromX, to: b.toX };
      }
      return null;
    case 'y':
      if (b.fromY !== undefined && b.toY !== undefined) {
        return { from: b.fromY, to: b.toY };
      }
      return null;
    case 'z': {
      if (b.fromZ !== undefined || b.toZ !== undefined) {
        const fromZ = b.fromZ ?? (typeof baseVal === 'number' ? baseVal : 0);
        const toZ = b.toZ ?? fromZ;
        return { from: fromZ, to: toZ };
      }
      return null;
    }
    case 'intensity':
    case 'ambience':
      if (b.fromIntensity !== undefined && b.toIntensity !== undefined) {
        return { from: b.fromIntensity, to: b.toIntensity };
      }
      return null;
    case 'color':
      if (b.fromColor !== undefined && b.toColor !== undefined) {
        return { from: b.fromColor, to: b.toColor };
      }
      return null;
    case 'temperature': {
      if (b.fromTemperature !== undefined || b.toTemperature !== undefined) {
        const from = b.fromTemperature ?? (typeof baseVal === 'number' ? baseVal : 6100);
        const to = b.toTemperature ?? from;
        return { from, to };
      }
      return null;
    }
    case 'angle': {
      if (b.fromAngle !== undefined || b.toAngle !== undefined) {
        const from = b.fromAngle ?? (typeof baseVal === 'number' ? baseVal : 0);
        const to = b.toAngle ?? from;
        return { from, to };
      }
      return null;
    }
    case 'penumbra': {
      if (b.fromPenumbra !== undefined || b.toPenumbra !== undefined) {
        const from = b.fromPenumbra ?? (typeof baseVal === 'number' ? baseVal : 0);
        const to = b.toPenumbra ?? from;
        return { from, to };
      }
      return null;
    }
    default:
      return null;
  }
}

/**
 * Resolves a single animated property among a target's blocks.
 * Winning rule:
 * - Among blocks with startMs <= t that define prop: latest startMs wins (ties: later index wins).
 * - If no block has startMs <= t: earliest startMs block wins if holdBefore !== false (default true);
 *   otherwise base value holds.
 */
function resolveProperty<T extends number | string>(
  prop: PropertyName,
  targetBlocks: readonly { block: LightAnimationBlock; index: number }[],
  t: number,
  baseValue: T
): T {
  // Filter to blocks defining this property
  const defining = targetBlocks
    .map(({ block, index }) => ({
      block,
      index,
      endpoints: getPropertyEndpoints(block, prop, baseValue) as ResolvedValue<T> | null,
    }))
    .filter(
      (
        item
      ): item is {
        block: LightAnimationBlock;
        index: number;
        endpoints: ResolvedValue<T>;
      } => item.endpoints !== null
    );

  if (defining.length === 0) {
    return baseValue;
  }

  // Check started blocks: startMs <= t
  const started = defining.filter((item) => item.block.startMs <= t);

  if (started.length > 0) {
    // Latest startMs wins; if tie, later index wins
    let winner = started[0];
    for (let i = 1; i < started.length; i++) {
      const candidate = started[i];
      if (
        candidate.block.startMs > winner.block.startMs ||
        (candidate.block.startMs === winner.block.startMs &&
          candidate.index > winner.index)
      ) {
        winner = candidate;
      }
    }

    const { block, endpoints } = winner;
    const rawProgress =
      block.durationMs > 0
        ? Math.max(0, Math.min(1, (t - block.startMs) / block.durationMs))
        : 1;
    const eased = evaluateEasing(rawProgress, block.easing);

    if (typeof endpoints.from === 'number' && typeof endpoints.to === 'number') {
      return lerp(endpoints.from, endpoints.to, eased) as T;
    }
    if (typeof endpoints.from === 'string' && typeof endpoints.to === 'string') {
      return lerpHex(endpoints.from, endpoints.to, eased) as T;
    }
    return endpoints.to;
  }

  // No block has started yet (t < earliest startMs)
  // Find earliest block defining prop
  let earliest = defining[0];
  for (let i = 1; i < defining.length; i++) {
    const candidate = defining[i];
    if (
      candidate.block.startMs < earliest.block.startMs ||
      (candidate.block.startMs === earliest.block.startMs &&
        candidate.index < earliest.index)
    ) {
      earliest = candidate;
    }
  }

  const shouldHoldBefore = earliest.block.holdBefore !== false;
  if (shouldHoldBefore) {
    return earliest.endpoints.from;
  }

  return baseValue;
}

/** Returns a new rig with all blocks applied at shot-local time. Pure; never mutates inputs. */
export function evaluateLightBlocks(
  base: LightRig,
  blocks: readonly LightAnimationBlock[] | undefined,
  shotLocalTimeMs: number
): LightRig {
  const result = cloneLightRig(base);
  if (!blocks || blocks.length === 0) {
    return result;
  }

  // Group blocks by targetLightId ?? 'key'
  const groups = new Map<string, { block: LightAnimationBlock; index: number }[]>();
  for (let i = 0; i < blocks.length; i++) {
    const original = blocks[i];
    const b = {...original, startMs:original.sourceStartMs ?? original.startMs, durationMs:original.sourceDurationMs ?? original.durationMs};
    const target = b.targetLightId ?? 'key';
    let list = groups.get(target);
    if (!list) {
      list = [];
      groups.set(target, list);
    }
    list.push({ block: b, index: i });
  }

  for (const [targetId, targetBlocks] of groups.entries()) {
    if (targetId === 'room') {
      result.ambience = Math.max(0, Math.min(1, resolveProperty(
        'ambience', targetBlocks, shotLocalTimeMs, result.ambience ?? 0.45
      )));
      continue;
    }
    if (targetId === 'key') {
      // Key target
      const baseX = result.position.x;
      const baseY = result.position.y;
      const baseZ = result.position.z;
      const baseIntensity = result.keyIntensity ?? result.intensity;
      const baseTemp = result.temperature ?? 6100;

      const x = resolveProperty('x', targetBlocks, shotLocalTimeMs, baseX);
      const y = resolveProperty('y', targetBlocks, shotLocalTimeMs, baseY);
      const z = resolveProperty('z', targetBlocks, shotLocalTimeMs, baseZ);
      const intensity = resolveProperty(
        'intensity',
        targetBlocks,
        shotLocalTimeMs,
        baseIntensity
      );
      const temp = resolveProperty(
        'temperature',
        targetBlocks,
        shotLocalTimeMs,
        baseTemp
      );

      result.position.x = Number(x.toFixed(3));
      result.position.y = Number(y.toFixed(3));
      result.position.z = Number(z.toFixed(3));
      result.keyIntensity = Number(intensity.toFixed(2));
      result.temperature = Math.round(temp);
    } else {
      // Source target
      const source = result.sources?.find((s) => s.id === targetId);
      if (!source) {
        // Target id matches no source; ignore
        continue;
      }

      const baseX = source.position.x;
      const baseY = source.position.y;
      const baseZ = source.position.z;
      const baseIntensity = source.intensity;
      const baseColor = source.color || '#ffffff';
      const baseTemp = source.temperature ?? result.temperature ?? 6100;

      const x = resolveProperty('x', targetBlocks, shotLocalTimeMs, baseX);
      const y = resolveProperty('y', targetBlocks, shotLocalTimeMs, baseY);
      const z = resolveProperty('z', targetBlocks, shotLocalTimeMs, baseZ);
      const intensity = resolveProperty(
        'intensity',
        targetBlocks,
        shotLocalTimeMs,
        baseIntensity
      );
      const color = resolveProperty(
        'color',
        targetBlocks,
        shotLocalTimeMs,
        baseColor
      );
      const temp = resolveProperty(
        'temperature',
        targetBlocks,
        shotLocalTimeMs,
        baseTemp
      );

      source.position.x = Number(x.toFixed(3));
      source.position.y = Number(y.toFixed(3));
      source.position.z = Number(z.toFixed(3));
      source.intensity = Number(intensity.toFixed(2));
      source.color = color;
      source.temperature = Math.round(temp);

      if (source.type === 'spot') {
        const baseAngle = source.angle ?? Math.PI / 5;
        const basePenumbra = source.penumbra ?? 0.4;
        const angle = resolveProperty(
          'angle',
          targetBlocks,
          shotLocalTimeMs,
          baseAngle
        );
        const penumbra = resolveProperty(
          'penumbra',
          targetBlocks,
          shotLocalTimeMs,
          basePenumbra
        );
        source.angle = angle;
        source.penumbra = Math.max(0, Math.min(1, penumbra));
      }
    }
  }

  return result;
}




