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

export type ScreenFit = 'stretch' | 'contain' | 'cover';

export interface DeviceFrameSettings {
  /** Missing means the original media-shaped chassis. Never auto-upgrade saved frames. */
  geometryVersion?: 1;
  deviceId?: string;
  deviceScale?: number;
  /** Preserves legacy placement height when replacing a nonuniform transform. */
  legacyHeightCompensation?: number;
  enabled: boolean;
  model: 'iphone-pro' | 'iphone' | 'iphone-classic';
  frameColor: string;
  frameRoughness: number;
  frameMetalness: number;
  scale: number;
  bezelWidth: number;
  thickness: number;
  cornerRadius: number;
  screenFit: ScreenFit;
  screenFillColor: string;
  glassTint: string;
  glassOpacity: number;
  glassRoughness: number;
  gloss: number;
  reflection: number;
  cutoutStyle: 'dynamic-island' | 'notch' | 'punch-hole' | 'none';
  cutoutWidth: number;
  cutoutHeight: number;
  showSideButtons: boolean;
  showRearCameras: boolean;
  shadowEnabled: boolean;
  shadowOpacity: number;
  shadowBlur: number;
  shadowOffset: number;
  /** Laptop lid opening angle in degrees (e.g. 70° to 140°, default 110°). */
  lidAngle?: number;
}

export interface GradientStop {
  at: number;
  color: string;
  opacity?: number;
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
    gradientType?: 'linear' | 'radial';
  };

import type { ShaderPreset } from './backgroundPresets';
export type { ShaderPreset };

/**
 * Scene / stage background with full Raylight production parity.
 * - solid       → Solid color
 * - gradient    → Linear, radial, or angular (conic) multi-stop gradient with optional canvas handles
 * - noise       → Procedural film noise on base color
 * - shader      → 13 GPU-accelerated procedural fragment shaders
 * - image       → High-performance image with GPU mipmap Poisson blur, cover/contain fit & dimming
 * - transparent → Alpha transparency with dark studio checkerboard
 */
export type Background =
  | {
    kind: 'solid';
    color: string;
    opacity?: number;
  }
  | {
    kind: 'gradient';
    angle: number;
    stops: GradientStop[];
    source?: 'color' | 'shader';
    gradientType?: 'linear' | 'radial' | 'angular';
    handles?: {
      start: { x: number; y: number };
      end: { x: number; y: number };
      width?: number;
    };
  }
  | {
    kind: 'noise';
    baseColor: string;
    intensity: number;
  }
  | {
    kind: 'shader';
    preset: ShaderPreset;
    color: string;
    colors: string[];
    backgroundColor: string;
    speed: number;
    waves: number;
    focus: number;
    glow: number;
    shine: number;
    angle: number;
    noiseScale?: number;
    color1?: string;
    color2?: string;
    color3?: string;
    color4?: string;
  }
  | {
    kind: 'image';
    assetId?: string;
    src?: string;
    color?: string; // Backdrop letterbox fill color (default #000000)
    fit?: 'cover' | 'contain';
    dim?: number; // 0 to 1
    blur?: number; // 0 to 1 (or px)
    opacity?: number;
  }
  | {
    kind: 'transparent';
  };

/** Raylight.app-style quick color swatches (bottom row of the color picker). */
export const RAYLIGHT_COLOR_PALETTE: string[] = [
  '#f4f4f5', // white
  '#94a3b8', // slate
  '#6366f1', // indigo
  '#06b6d4', // cyan
  '#10b981', // emerald
  '#facc15', // yellow
  '#f59e0b', // amber
  '#f9a8d4', // pink
  '#ef4444', // red
];

export type SpringEasingName = 'gentle' | 'quick' | 'bouncy' | 'slow' | 'snappy' | 'stiff';

export interface SpringConfig {
  stiffness?: number;
  damping?: number;
  mass?: number;
}

export type Easing =
  | { kind: 'preset'; name: PresetEasingName }
  | { kind: 'spring'; name: SpringEasingName; config?: SpringConfig }
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

export interface LiquidGlassEffect {
  enabled: boolean;
  refraction?: number;
  roughness?: number;
  tint?: string;
}

export interface WarpEffect {
  enabled: boolean;
  amount?: number;
  frequency?: number;
}

export interface LayerEffects {
  dropShadow?: DropShadowEffect;
  glow?: GlowEffect;
  layerBlur?: number;
  backdropBlur?: number;
  liquidGlass?: LiquidGlassEffect;
  warp?: WarpEffect;
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
  exits?: (Transitionish & { id?: string })[];
  blocks: AnimationBlock[];
  effects: LayerEffects;
  /** Optional alpha-mask source layer ID. */
  maskLayerId?: string;
  /** When true, layer surface reacts to 3D scene lighting. Default false for text and true for images/video. */
  receivesLight?: boolean;
  /** Optional 3D surface material response */
  material?: {
    roughness?: number;
    metalness?: number;
  };
}

export interface ImageLayer extends LayerBase {
  kind: 'image';
  assetId: string;
  size: Size2D;
  cornerRadius: number;
  deviceFrame?: DeviceFrameSettings;
  crop?: { x: number; y: number; width: number; height: number };
  stroke?: { color: string; width: number; opacity: number };
}

export interface ShapeMask {
  enabled: boolean;
  shape: 'rectangle' | 'circle' | 'path';
  feather: number;
  opacity: number;
  grow: number;
  invert: boolean;
  show: boolean;
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
  stroke?: {
    color: string;
    width: number;
    opacity: number;
    align?: 'inside' | 'center' | 'outside';
    style?: 'solid' | 'dashed' | 'dotted';
  };
  depth?: number;
  mask?: ShapeMask;
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

export interface VideoLayer extends LayerBase {
  kind: 'video';
  assetId: string;
  size: Size2D;
  cornerRadius: number;
  deviceFrame?: DeviceFrameSettings;
  crop?: { x: number; y: number; width: number; height: number };
  stroke?: { color: string; width: number; opacity: number };
}

export type Layer = ImageLayer | VideoLayer | ShapeLayer | TextLayer;

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
  mode: 'dolly' | 'zoom' | 'dollyzoom' | 'shake'; // 'dollyzoom' = 'Warp' in Raylight UI
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
  /** 'key' for primary directional light, or specific source id */
  targetLightId?: string;
  startMs: number;
  durationMs: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  fromZ?: number;
  toZ?: number;
  fromIntensity: number;
  toIntensity: number;
  fromColor?: string;
  toColor?: string;
  fromTemperature?: number;
  toTemperature?: number;
  fromAngle?: number;
  toAngle?: number;
  fromPenumbra?: number;
  toPenumbra?: number;
  holdBefore?: boolean;
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
  /** Aim target for spot lights or orientation */
  target?: Vec3;
  /** Optional rotation in radians */
  rotation?: Vec3;
  intensity: number;
  color: string;
  temperature?: number;
  /** Distance / radius falloff for point and spot lights */
  distance?: number;
  /** Falloff decay factor (physically accurate inverse-square default = 2) */
  decay?: number;
  /** Cone angle for spot lights (radians) */
  angle?: number;
  /** Edge softness for spot lights (0 = hard edge, 1 = maximum penumbra) */
  penumbra?: number;
  /** Width for area lights */
  width?: number;
  /** Height for area lights */
  height?: number;
  /** Whether this light casts shadows */
  castShadow?: boolean;
}

export interface LightRig {
  position: Vec3;
  intensity: number;
  temperature: number;
  /** Ambient light intensity / shadow floor (0 - 1) */
  ambience: number;
  /** Scene-level ambient light tint color */
  ambientColor?: string;
  /** Toggle key light on/off */
  keyLightEnabled?: boolean;
  /** Key light only; intensity remains a master gain for additional sources. */
  keyIntensity?: number;
  /** Toggle fill light on/off */
  fillEnabled?: boolean;
  /** Fill light intensity level (0 - 1) */
  fillIntensity?: number;
  /** Tone mapping rolloff mode */
  toneMapping?: 'none' | 'neutral';
  /** Whether the directional key light casts shadows */
  castShadow?: boolean;
  /** Show 3D light helper gizmos on stage */
  showGizmos?: boolean;
  /** Multiple independently editable light sources */
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

/** True while a newly opened project contains only its implicit empty shot. */
export function isBlankProjectState(project: Project): boolean {
  if (project.shots.length !== 1) return false;
  const [shot] = project.shots;
  return Boolean(
    shot &&
    shot.layers.length === 0 &&
    shot.groups.length === 0 &&
    (shot.cameraBlocks?.length ?? 0) === 0 &&
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

