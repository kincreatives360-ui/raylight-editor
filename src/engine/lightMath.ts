import type { LightRig, SceneLight } from '../model/types';

export const KEY_LIGHT_MIN_Z = 0.5; // world units; replaces the hard-coded 2.5 in SceneLighting
export const MAX_SHADOW_CASTERS = 3; // key light counts as one
export const DEFAULT_FILL_INTENSITY = 0.38;

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function parseHex(hex: string): [number, number, number] {
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (clean.length !== 6) {
    return [255, 255, 255];
  }
  const num = parseInt(clean, 16);
  if (Number.isNaN(num)) return [255, 255, 255];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function toHexComponent(c: number): string {
  const clamped = Math.max(0, Math.min(255, Math.round(c)));
  return clamped.toString(16).padStart(2, '0');
}

/** Interpolates two hex colors '#rrggbb', clamping t to 0..1. Returns '#rrggbb'. */
export function lerpHex(a: string, b: string, t: number): string {
  const clampedT = Math.max(0, Math.min(1, t));
  const [r1, g1, b1] = parseHex(a);
  const [r2, g2, b2] = parseHex(b);
  const r = lerp(r1, r2, clampedT);
  const g = lerp(g1, g2, clampedT);
  const bVal = lerp(b1, b2, clampedT);
  return `#${toHexComponent(r)}${toHexComponent(g)}${toHexComponent(bVal)}`;
}

/** Key light intensity. Falls back to the master `intensity` so old projects look identical. */
export function resolveKeyIntensity(rig: LightRig): number {
  return rig.keyIntensity ?? rig.intensity;
}

/** Final intensity multiplier for an additional source. Master gain only; never the key. */
export function resolveSourceIntensity(rig: LightRig, src: SceneLight): number {
  const baseSrcIntensity = src.intensity ?? 1;
  const masterIntensity = rig.intensity ?? 1.2;
  return baseSrcIntensity * masterIntensity * 2.0;
}

/** Fill light state. Default follows the key toggle to preserve existing behavior. */
export function resolveFill(rig: LightRig): { enabled: boolean; intensity: number } {
  const enabled = rig.fillEnabled ?? (rig.keyLightEnabled !== false);
  const intensity = rig.fillIntensity ?? DEFAULT_FILL_INTENSITY;
  return { enabled, intensity };
}

/** Which lights may cast shadows this frame. Order: key first, then sources in array order, skipping area lights. */
export function planShadowCasters(rig: LightRig): { key: boolean; sourceIds: ReadonlySet<string> } {
  const keyMayCast = rig.keyLightEnabled !== false && rig.castShadow !== false;
  let remainingBudget = MAX_SHADOW_CASTERS;

  const key = keyMayCast && remainingBudget > 0;
  if (key) {
    remainingBudget -= 1;
  }

  const sourceIds = new Set<string>();
  if (remainingBudget > 0 && rig.sources) {
    for (const src of rig.sources) {
      if (remainingBudget <= 0) break;
      if (!src.enabled) continue;
      if (src.castShadow === false) continue;
      // Skip area and ambient lights for shadow casting
      if (src.type === 'area' || src.type === 'ambient') continue;

      sourceIds.add(src.id);
      remainingBudget -= 1;
    }
  }

  return { key, sourceIds };
}
