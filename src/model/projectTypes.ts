import type { AspectRatio, Background, Vec3 } from './commonTypes';
import type { Easing } from './animationTypes';
import type { Layer, Group } from './layerTypes';
import type { Framing, CameraBlock, LightAnimationBlock, SceneEffectAnimationBlock, LightRig, SceneEffects, EffectKey } from './sceneTypes';

export interface ShotTransition {
  type: 'cut' | 'crossfade' | 'push' | 'slide';
  durationMs: number;
  easing: Easing;
}

export interface Shot {
  id: string;
  /** Internal startup shot, replaced when the user first adds content. */
  isPlaceholder?: boolean;
  name: string;
  startMs: number;
  durationMs: number;
  lane: number;
  /**
   * When true (default), this shot inherits `project.background`.
   * When false, uses `shot.background` (falls back to project if unset).
   */
  useProjectBackground?: boolean;
  /** Per-shot background override (used only when useProjectBackground is false). */
  background?: Background;
  layers: Layer[];
  groups: Group[];
  framings: Framing[];
  cameraBlocks: CameraBlock[];
  lightBlocks?: LightAnimationBlock[];
  effectBlocks?: SceneEffectAnimationBlock[];
  light: LightRig;
  effects: SceneEffects;
  effectsOrder: EffectKey[];
  appliedEffects?: EffectKey[];
  transition: ShotTransition;
  focusBlocks?: FocusBlock[];
}

export type Effects = SceneEffects;

export interface FocusBlock {
  /** Original curve bounds retained when a shot is split. */
  sourceStartMs?: number;
  sourceDurationMs?: number;
  id: string;
  label?: string;
  startMs: number;
  durationMs: number;
  fromZ: number;
  toZ: number;
  easing: Easing;
}

export interface AudioClip {
  id: string;
  name: string;
  assetId?: string;
  dataUrl?: string;
  startMs: number;
  durationMs: number;
  offsetMs: number;
  volume: number;
  muted: boolean;
}

export interface ProjectAudio {
  clips: AudioClip[];
  muted: boolean;
  masterVolume: number;
}

export interface AssetRecord {
  id: string;
  name: string;
  mimeType: string;
  dataUrl: string;
  thumbUrl?: string;
  width: number;
  height: number;
}

export interface Project {
  id: string;
  name: string;
  version?: number;
  schemaVersion?: number;
  updatedAt: string;
  createdAt?: string;
  aspectRatio: AspectRatio;
  fps: 24 | 30 | 60;
  background: Background;
  defaultCamera?: {
    position: Vec3;
    rotation: Vec3;
    focalLength: number;
  };
  assets: Record<string, AssetRecord>;
  shots: Shot[];
  audio?: ProjectAudio;
}

/** True while a project contains only its implicit startup shot (including pre-marker saves). */
export function isBlankProjectState(project: Project): boolean {
  if (project.shots.length === 0 || project.shots.every((shot) => shot.isPlaceholder)) return true;
  if (project.shots.length !== 1 || project.shots[0].isPlaceholder === false) return false;

  const [shot] = project.shots;
  return Boolean(
    shot.layers.length === 0 &&
    shot.groups.length === 0 &&
    shot.cameraBlocks.length === 0 &&
    (shot.lightBlocks?.length ?? 0) === 0 &&
    (shot.effectBlocks?.length ?? 0) === 0 &&
    (shot.focusBlocks?.length ?? 0) === 0 &&
    (project.audio?.clips.length ?? 0) === 0
  );
}

/** Resolve the effective background for a shot (project vs shot override). */
export function resolveShotBackground(project: Project, shot?: Shot): Background {
  if (!shot || shot.useProjectBackground !== false) {
    return project?.background ?? { kind: 'solid', color: '#0c0e17' };
  }
  return shot.background ?? project?.background ?? { kind: 'solid', color: '#0c0e17' };
}
