import type { PresetEasingName, AnimationBlockProperty } from './schema';
export type { PresetEasingName, AnimationBlockProperty };

export type AspectRatio =
  | '16:9'
  | '4:3'
  | '3:2'
  | '21:9'
  | '1:1'
  | '9:16'
  | '3:4'
  | '2:3'
  | '4:5';

export type BlendMode =
  | 'normal'
  | 'darken'
  | 'multiply'
  | 'lighten'
  | 'screen'
  | 'add'
  | 'difference';

export interface Vec2 {
  x: number;
  y: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Size2D {
  width: number;
  height: number;
}

export interface GradientStop {
  at: number;
  color: string;
}

export type Fill =
  | {
    kind: 'solid';
    color: string;
    opacity: number;
  }
  | {
    kind: 'gradient';
    angle: number;
    stops: GradientStop[];
  };

/**
 * Scene / stage background.
 * - solid  → "Color" in Raylight UI
 * - gradient → "Shader" (procedural gradient) in Raylight UI
 * - image  → "Image" in Raylight UI
 */
export type Background =
  | {
    kind: 'solid';
    color: string;
  }
  | {
    kind: 'gradient';
    angle: number;
    stops: GradientStop[];
  }
  | {
    kind: 'image';
    assetId: string;
  };

/** Raylight.app-style quick color swatches (bottom row of the color picker). */
export const RAYLIGHT_COLOR_PALETTE: string[] = [
  '#ffffff',
  '#a1a1aa',
  '#3b82f6',
  '#22d3ee',
  '#22c55e',
  '#eab308',
  '#ec4899',
  '#ef4444',
];

export type SpringEasingName = 'gentle' | 'quick' | 'bouncy' | 'slow';

export type Easing =
  | { kind: 'preset'; name: PresetEasingName }
  | { kind: 'spring'; name: SpringEasingName }
  | { kind: 'bezier'; x1: number; y1: number; x2: number; y2: number };

export type TransitionType =
  | 'none'
  | 'fade'
  | 'slide-up'
  | 'slide-down'
  | 'slide-left'
  | 'slide-right'
  | 'float-out'
  | 'scale-out'
  | 'mask-sweep';

export interface Transitionish {
  type: TransitionType;
  durationMs: number;
  delayMs: number;
  distance: number;
  easing: Easing;
}


export interface AnimationBlock {
  id: string;
  label: string;
  property: AnimationBlockProperty;
  startMs: number;
  durationMs: number;
  easing: Easing;
  amount: Vec3 | number;
}

export interface DropShadowEffect {
  enabled: boolean;
  color: string;
  opacity: number;
  blur: number;
  offsetX: number;
  offsetY: number;
}

export interface GlowEffect {
  enabled: boolean;
  color: string;
  intensity: number;
  radius: number;
}

export interface LayerEffects {
  dropShadow?: DropShadowEffect;
  glow?: GlowEffect;
  layerBlur?: number;
  backdropBlur?: number;
}

export interface DeviceFrame {
  type: 'iphone' | 'ipad' | 'macbook' | 'browser';
  color: 'silver' | 'black';
  gloss: number;
  lidAngle?: number;
  screenGlow?: number;
}

export interface LayerBase {
  id: string;
  name: string;
  order: number;
  groupId?: string;
  hidden: boolean;
  locked: boolean;
  inMs: number;
  outMs: number;
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
  opacity: number;
  blendMode: BlendMode;
  entrance: Transitionish;
  entrances?: (Transitionish & { id?: string })[];
  exit: Transitionish;
  blocks: AnimationBlock[];
  effects: LayerEffects;
  /** Optional alpha-mask source layer ID. */
  maskLayerId?: string;
}

export interface ImageLayer extends LayerBase {
  kind: 'image';
  assetId: string;
  size: Size2D;
  cornerRadius: number;
  crop?: { x: number; y: number; width: number; height: number };
  stroke?: { color: string; width: number; opacity: number };
  device?: DeviceFrame;
}

export interface ShapeLayer extends LayerBase {
  kind: 'shape';
  shape: 'rectangle' | 'ellipse' | 'line' | 'arrow' | 'polygon';
  /** Optional shape path points in normalized layer-local coordinates. */
  points?: Vec2[];
  /** Optional layer effects used by the canvas renderer. */
  size: Size2D;
  cornerRadius: number;
  fill: Fill;
  stroke?: { color: string; width: number; opacity: number };
}

export interface TextLayer extends LayerBase {
  kind: 'text';
  content: string;
  maxWidth: number;
  verticalAlign?: 'top' | 'middle' | 'bottom';
  font: {
    family: string;
    size: number;
    weight: number;
    color: string;
    align: 'left' | 'center' | 'right';
    letterSpacing: number;
  };
}

export type Layer = ImageLayer | ShapeLayer | TextLayer;

export interface Group {
  id: string;
  name: string;
  parentGroupId?: string;
  collapsed: boolean;
  hidden: boolean;
  locked: boolean;
}

export interface Framing {
  id: string;
  name: string;
  target: Vec3;
  zoom: number;
  roll?: number;  // degrees
  orbit?: number; // degrees (yaw)
  tilt?: number;  // degrees (pitch)
}

export interface CameraKeyframeEndpoint {
  anchorX: number; // fractional X (-1 to 1, shown as px in UI)
  anchorY: number; // fractional Y (-1 to 1, shown as px in UI)
  zoom: number;    // e.g. 1.0x, 1.1x
  roll: number;    // degrees
  orbit: number;   // degrees
  tilt: number;    // degrees
}

export interface CameraBlock {
  id: string;
  label?: string;
  startMs: number;
  durationMs: number;
  fromFramingId: string;
  toFramingId: string;
  mode: 'dolly' | 'zoom' | 'dollyzoom'; // 'dollyzoom' = 'Warp' in Raylight UI
  easing: Easing;
  from?: CameraKeyframeEndpoint;
  to?: CameraKeyframeEndpoint;
  shake?: {
    from: number; // 0 to 100%
    to: number;   // 0 to 100%
  };
}

export interface LightAnimationBlock {
  id: string;
  label: string;
  startMs: number;
  durationMs: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  fromIntensity: number;
  toIntensity: number;
  easing: Easing;
}

export interface SceneEffectAnimationBlock {
  id: string;
  label: string;
  effectKey: EffectKey;
  startMs: number;
  durationMs: number;
  fromValue: number;
  toValue: number;
  easing: Easing;
}

export type LightSourceType = 'directional' | 'point' | 'spot' | 'area' | 'ambient';

export interface SceneLight {
  id: string;
  name: string;
  type: LightSourceType;
  enabled: boolean;
  position: Vec3;
  intensity: number;
  color: string;
  temperature: number;
  distance?: number;
  angle?: number;
  penumbra?: number;
  width?: number;
  height?: number;
}

export interface LightRig {
  position: Vec3;
  intensity: number;
  temperature: number;
  ambience: number;
  /** Multiple independently editable light sources; legacy fields remain supported. */
  sources?: SceneLight[];
}

export type EffectKey =
  | 'depthOfField'
  | 'bloom'
  | 'vignette'
  | 'motionBlur'
  | 'chromaticAberration'
  | 'filmGrain'
  | 'ghost'
  | 'colorGrade'
  | 'edgeFade'
  | 'glitch';

export interface SceneEffects {
  depthOfField: {
    enabled: boolean;
    target: Vec3;
    focusRange: number;
    aperture: number;
    bokehScale: number;
    bokehShape: 'anamorphic' | 'spherical' | 'vintage' | 'portrait';
    focalLength?: number;
    highlightThreshold?: number;
    highlightIntensity?: number;
  };
  bloom: {
    enabled: boolean;
    intensity: number;
    threshold: number;
  };
  vignette: {
    enabled: boolean;
    intensity: number;
  };
  motionBlur: {
    enabled: boolean;
    samples?: number;
    shutterAngle: number;
  };
  chromaticAberration: {
    enabled: boolean;
    offset: number;
  };
  filmGrain: {
    enabled: boolean;
    intensity: number;
    size: number;
  };
  ghost: {
    enabled: boolean;
    opacity: number;
    offset: number;
    blur: number;
  };
  colorGrade: {
    enabled: boolean;
    exposure: number;
    contrast: number;
    saturation: number;
  };
  edgeFade: {
    enabled: boolean;
    top: number;
    bottom: number;
    left?: number;
    right?: number;
  };
  glitch: {
    enabled: boolean;
    intensity: number;
  };
}

export interface ShotTransition {
  type: 'cut' | 'crossfade' | 'push' | 'slide';
  durationMs: number;
  easing: Easing;
}

export interface Shot {
  id: string;
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
  transition: ShotTransition;
  focusBlocks?: FocusBlock[];
}

export type Effects = SceneEffects;

export interface FocusBlock {
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
  fps: 30 | 60;
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

/** Resolve the effective background for a shot (project vs shot override). */
export function resolveShotBackground(project: Project, shot: Shot): Background {
  if (shot.useProjectBackground !== false) {
    return project.background;
  }
  return shot.background ?? project.background;
}
