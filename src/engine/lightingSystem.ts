import type { LightRig, SceneLight, Vec3 } from '../model/types';

export const MAX_SHADOW_CASTERS = 3;
export const DEFAULT_FILL_INTENSITY = 0.38;

type Vector3Tuple = [number, number, number];

export interface ResolvedSceneLight {
  id: string;
  type: SceneLight['type'];
  enabled: true;
  position: Vector3Tuple;
  target: Vector3Tuple;
  intensity: number;
  color: string;
  distance: number;
  decay: number;
  angle: number;
  penumbra: number;
  width: number;
  height: number;
  castShadow: boolean;
  shadowIntensity: number;
  shadowRadius: number;
}

export interface ResolvedLighting {
  key: Omit<ResolvedSceneLight, 'enabled' | 'id' | 'type' | 'distance' | 'decay' | 'angle' | 'penumbra' | 'width' | 'height'> & {
    enabled: boolean;
    id: 'key';
    type: 'directional';
  };
  room: {
    intensity: number;
    environmentIntensity: number;
    color: string;
    environmentTint: string;
    environment: NonNullable<LightRig['environment']>;
  };
  fill: {
    enabled: boolean;
    intensity: number;
    position: Vector3Tuple;
    color: string;
  };
  sources: ResolvedSceneLight[];
  showGizmos: boolean;
}

const FALLBACK_POSITION: Vec3 = { x: -0.28, y: 0.36, z: 0.9 };
const FALLBACK_TARGET: Vec3 = { x: 0, y: 0, z: 0 };
const SHADOW_CAPABLE_TYPES = new Set<SceneLight['type']>(['directional', 'point', 'spot']);
const ENVIRONMENT_TINTS: Record<NonNullable<LightRig['environment']>, string> = {
  studio: '#f8fafc', softbox: '#e8f1ff', 'strip-light': '#e6eeff', daylight: '#fff2d9',
  'night-city': '#b8c9ff', warehouse: '#e9dfc8', custom: '#f8fafc',
};

function worldPosition(position: Vec3 | undefined, defaults: Vec3): Vector3Tuple {
  return [
    (position?.x ?? defaults.x) * 6,
    (position?.y ?? defaults.y) * 6,
    (position?.z ?? defaults.z) * 5,
  ];
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function parseHex(hex: string): [number, number, number] {
  const normalized = hex.trim().replace(/^#/, '');
  const expanded = normalized.length === 3 ? normalized.replace(/./g, (char) => char + char) : normalized;
  if (!/^[\da-f]{6}$/i.test(expanded)) return [255, 255, 255];
  const value = Number.parseInt(expanded, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function kelvinRgb(kelvin: number): [number, number, number] {
  const temperature = Math.max(1000, Math.min(15000, kelvin)) / 100;
  let red: number;
  let green: number;
  let blue: number;
  if (temperature <= 66) {
    red = 255;
    green = 99.4708025861 * Math.log(temperature) - 161.1195681661;
    blue = temperature <= 19 ? 0 : 138.5177312231 * Math.log(temperature - 10) - 305.0447927307;
  } else {
    red = 329.698727446 * Math.pow(temperature - 60, -0.1332047592);
    green = 288.1221695283 * Math.pow(temperature - 60, -0.0755148492);
    blue = 255;
  }
  return [red, green, blue].map((channel) => Math.max(0, Math.min(255, Math.round(channel)))) as [number, number, number];
}

export function resolveKelvinColor(kelvin: number, color = '#ffffff'): string {
  const [red, green, blue] = parseHex(color);
  const tint = kelvinRgb(kelvin);
  const bytes = [red, green, blue].map((channel, index) => Math.round(channel * tint[index] / 255));
  return `#${bytes.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

export function lerpHex(a: string, b: string, t: number): string {
  const amount = Math.max(0, Math.min(1, t));
  const left = parseHex(a);
  const right = parseHex(b);
  const mixed = left.map((channel, index) => Math.round(lerp(channel, right[index], amount)));
return `#${mixed.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

function resolveSource(source: SceneLight, rig: LightRig, shadowIds: ReadonlySet<string>): ResolvedSceneLight {
  const temperature = source.temperature ?? rig.temperature ?? 6100;
  return {
    id: source.id,
    type: source.type,
    enabled: true,
    position: worldPosition(source.position, { x: 0, y: 0, z: 1 }),
    target: worldPosition(source.target, FALLBACK_TARGET),
    intensity: (source.intensity ?? 1) * (rig.intensity ?? 1.2) * 2,
    color: resolveKelvinColor(temperature, source.color || '#ffffff'),
    distance: Math.max(0, source.distance ?? (source.type === 'spot' ? 12 : 10)),
    decay: Math.max(0, source.decay ?? 2),
    angle: Math.max(0.001, Math.min(Math.PI / 2, source.angle ?? Math.PI / 5)),
    penumbra: Math.max(0, Math.min(1, source.penumbra ?? 0.4)),
    width: Math.max(0.001, source.width ?? 3),
    height: Math.max(0.001, source.height ?? 3),
    castShadow: shadowIds.has(source.id),
    shadowIntensity: Math.max(0, Math.min(1, source.shadowStrength ?? rig.shadowStrength ?? 0.7)),
    shadowRadius: Math.max(0, (source.shadowSoftness ?? rig.shadowSoftness ?? 50) / 10),
  };
}

/** Resolve saved/editor light data to a single renderer-ready lighting contract. */
export function resolveLighting(rig?: LightRig): ResolvedLighting {
  const light = rig ?? {
    position: FALLBACK_POSITION,
    intensity: 1.2,
    temperature: 6100,
    ambience: 0.45,
  } satisfies LightRig;
  const keyEnabled = light.keyLightEnabled !== false;
  const keyIntensity = light.keyIntensity ?? light.intensity ?? 1.2;
  const shadowIds = new Set<string>();
  let remainingShadows = MAX_SHADOW_CASTERS;
  const keyCasts = keyEnabled && light.castShadow !== false && remainingShadows > 0;
  if (keyCasts) remainingShadows -= 1;

  for (const source of light.sources ?? []) {
    if (!source.enabled || source.castShadow === false || !SHADOW_CAPABLE_TYPES.has(source.type)) continue;
    if (remainingShadows <= 0) break;
    shadowIds.add(source.id);
    remainingShadows -= 1;
  }

  const keyColor = resolveKelvinColor(light.temperature ?? 6100, light.keyColor);
  const position = worldPosition(light.position, FALLBACK_POSITION);
  const keyTarget = worldPosition(light.target, FALLBACK_TARGET);
  const key = {
    id: 'key' as const,
    type: 'directional' as const,
    enabled: keyEnabled,
    position,
    target: keyTarget,
    intensity: keyIntensity * 2.2,
    color: keyColor,
    castShadow: keyCasts,
    shadowIntensity: Math.max(0, Math.min(1, light.shadowStrength ?? 0.7)),
    shadowRadius: Math.max(0, (light.shadowSoftness ?? 50) / 10),
  };
  const fill = {
    enabled: light.fillEnabled ?? keyEnabled,
    intensity: keyIntensity * (light.fillIntensity ?? DEFAULT_FILL_INTENSITY),
    position: [-position[0] * 0.7, -position[1] * 0.5, position[2] * 0.5] as Vector3Tuple,
    color: '#e0e7ff',
  };

  return {
    key,
    room: {
      intensity: Math.max(0, light.ambience ?? 0.45) * 1.2,
      environmentIntensity: Math.max(0, light.ambience ?? 0.45) * 1.5,
      color: light.environment && light.environment !== 'custom' ? '#ffffff' : light.ambientColor || '#f8fafc',
      environmentTint: light.environment === 'custom' ? light.ambientColor || '#f8fafc' : ENVIRONMENT_TINTS[light.environment ?? 'studio'],
      environment: light.environment ?? 'studio',
    },
    fill,
    sources: (light.sources ?? []).filter((source) => source.enabled).map((source) => resolveSource(source, light, shadowIds)),
    showGizmos: light.showGizmos ?? false,
  };
}





