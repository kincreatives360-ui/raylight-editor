// src/model/types.ts

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

export type Background =
  | {
    kind: 'solid';
    color: string;
  }
  | {
    kind: 'gradient';
    angle: number;
    stops: GradientStop[];
  };

export type PresetEasingName =
  | 'linear'
  | 'ease'
  | 'ease-in'
  | 'ease-out'
  | 'ease-in-out'
  | 'ease-in-quad'
  | 'ease-out-quad'
  | 'ease-in-out-quad'
  | 'ease-in-cubic'
  | 'ease-out-cubic'
  | 'ease-in-out-cubic'
  | 'ease-in-back'
  | 'ease-out-back'
  | 'ease-in-out-back'
  | 'ease-in-expo'
  | 'ease-out-expo'
  | 'bounce'
  | 'hold';

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

export type AnimationBlockProperty =
  | 'position'
  | 'rotation'
  | 'tilt'
  | 'scale'
  | 'size'
  | 'opacity'
  | 'cornerRadius'
  | 'layerBlur'
  | 'maskSweep'
  | 'shimmer'
  | 'followPath'
  | 'counter'
  | 'glow'
  | 'pathReveal';

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
  shape: 'rectangle' | 'ellipse' | 'line' | 'arrow';
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

export interface LightRig {
  position: Vec3;
  intensity: number;
  temperature: number;
  ambience: number;
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