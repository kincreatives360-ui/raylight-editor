// src/model/types.ts
// Units:
// - Time is stored in milliseconds (ms).
// - Rotations are stored in radians under the hood, and displayed in degrees in the UI.
// - Sizes and positions are fractions (0 to 1) of the frame so any aspect ratio works.

export type Vec3 = { x: number; y: number; z: number };

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

export type Fill =
  | { kind: 'solid'; color: string; opacity: number }
  | {
      kind: 'gradient';
      angle: number;
      stops: { at: number; color: string }[];
    };

export type Stroke = {
  color: string;
  width: number; // Fractional width (e.g. 0.002)
  opacity: number;
};

export type Shadow = {
  enabled: boolean;
  color: string;
  opacity: number;
  blur: number;
  offsetX: number;
  offsetY: number;
};

export type Glow = {
  enabled: boolean;
  color: string;
  intensity: number;
  radius: number;
};

export type Group = {
  id: string;
  name: string;
  parentGroupId?: string;
  collapsed: boolean;
  hidden: boolean;
  locked: boolean;
};

export type PresetEasingName =
  | 'linear'
  | 'ease-in'
  | 'ease-out'
  | 'ease-in-out'
  | 'ease-in-expo'
  | 'ease-out-expo'
  | 'ease-in-back'
  | 'ease-out-back'
  | 'ease-in-out-back'
  | 'hold'
  | 'bounce';

export type SpringEasingName = 'gentle' | 'quick' | 'bouncy' | 'slow';

export type Easing =
  | { kind: 'preset'; name: PresetEasingName }
  | { kind: 'spring'; name: SpringEasingName }
  | { kind: 'bezier'; x1: number; y1: number; x2: number; y2: number };

export type TransitionType =
  | 'none'
  | 'fade'
  | 'slide'
  | 'slide-up'
  | 'slide-down'
  | 'slide-left'
  | 'slide-right'
  | 'float-out'
  | 'scale-out'
  | 'mask-sweep';

export type Transitionish = {
  id?: string;
  type: TransitionType;
  durationMs: number;
  delayMs: number;
  easing: Easing;
  distance: number;
  direction?: 'up' | 'down' | 'left' | 'right';
};

export type AnimationBlockProperty =
  | 'position'
  | 'rotation'
  | 'tilt'
  | 'scale'
  | 'opacity'
  | 'size'
  | 'maskSweep'
  | 'shimmer'
  | 'followPath'
  | 'counter'
  | 'pathReveal'
  | 'glow';

export type AnimationBlock = {
  id: string;
  label: string;
  property: AnimationBlockProperty;
  startMs: number; // Relative to shot start
  durationMs: number;
  easing: Easing;
  amount: Vec3 | number; // How much to change (delta), not a fixed end value
};

export type LayerBase = {
  id: string;
  name: string;
  hidden: boolean;
  locked: boolean;
  groupId?: string;
  order: number; // Stacking order in the layer list
  position: Vec3;
  rotation: Vec3; // Stored in radians
  scale: Vec3;
  opacity: number; // 0 to 1
  blendMode: BlendMode;
  inMs: number; // When it appears (relative to shot start)
  outMs: number; // When it disappears
  entrance: Transitionish;
  exit: Transitionish;
  entrances?: Transitionish[];
  exits?: Transitionish[];
  blocks: AnimationBlock[];
  effects: {
    dropShadow?: Shadow;
    glow?: Glow;
    layerBlur?: number;
    backdropBlur?: number;
  };
};

export type DeviceFrame = {
  type: 'iphone' | 'ipad' | 'macbook' | 'browser';
  color: 'silver' | 'black';
  gloss: number;
  lidAngle?: number;
  screenGlow?: number;
};

export type ImageLayer = LayerBase & {
  kind: 'image';
  assetId: string; // Points to a saved image by ID
  size: { width: number; height: number }; // Fractional (0 to 1)
  crop?: { x: number; y: number; width: number; height: number };
  cornerRadius: number; // 0 to 1
  stroke?: Stroke;
  device?: DeviceFrame;
};

export type ShapeLayer = LayerBase & {
  kind: 'shape';
  shape: 'rectangle' | 'ellipse' | 'line' | 'arrow';
  size: { width: number; height: number }; // Fractional (0 to 1)
  fill: Fill;
  stroke?: Stroke;
  cornerRadius: number; // 0 to 1
};

export type TextLayer = LayerBase & {
  kind: 'text';
  content: string;
  font: {
    family: string;
    size: number; // Fractional (e.g. 0.03)
    weight: number;
    color: string;
    align: 'left' | 'center' | 'right';
    letterSpacing: number;
  };
  maxWidth: number;
  verticalAlign: 'top' | 'middle' | 'bottom';
};

export type Layer = ImageLayer | ShapeLayer | TextLayer;

export type Framing = {
  id: string;
  name: string;
  target: Vec3;
  zoom: number;
};

export type CameraBlock = {
  id: string;
  label?: string;
  startMs: number;
  durationMs: number;
  fromFramingId: string;
  toFramingId: string;
  mode: 'dolly' | 'zoom' | 'dollyzoom';
  easing: Easing;
};

export type FocusBlock = {
  id: string;
  label?: string;
  startMs: number;
  durationMs: number;
  fromZ: number;
  toZ: number;
  easing: Easing;
};

export type Effects = {
  depthOfField: {
    enabled: boolean;
    target: Vec3;
    focusRange: number;
    aperture: number;
    bokehScale: number;
    bokehShape: 'spherical' | 'anamorphic' | 'vintage' | 'portrait';
    focalLength: number;
    highlightThreshold: number;
    highlightIntensity: number;
  };
  bloom: { enabled: boolean; intensity: number; threshold: number };
  vignette: { enabled: boolean; intensity: number };
  motionBlur: { enabled: boolean; samples: number; shutterAngle: number };
  chromaticAberration: { enabled: boolean; offset: number };
  filmGrain: { enabled: boolean; intensity: number; size: number };
  ghost: { enabled: boolean; opacity: number; offset: number; blur: number };
  colorGrade: {
    enabled: boolean;
    exposure: number;
    contrast: number;
    saturation: number;
  };
  edgeFade: {
    enabled: boolean;
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  glitch: { enabled: boolean; intensity: number };
};

export type EffectKey = keyof Effects;

export type Shot = {
  id: string;
  name: string;
  startMs: number;
  durationMs: number;
  lane: number; // 0 to 7
  layers: Layer[];
  groups: Group[];
  framings: Framing[];
  cameraBlocks: CameraBlock[];
  focusBlocks?: FocusBlock[];
  transition: {
    type: 'cut' | 'crossfade' | 'push' | 'slide';
    durationMs: number;
    easing: Easing;
  };
  light: {
    position: Vec3;
    intensity: number;
    temperature: number;
    ambience: number;
  };
  effects: Effects;
  effectsOrder: EffectKey[];
};

export type AssetRecord = {
  id: string;
  name: string;
  mimeType: string;
  dataUrl: string;
  thumbUrl?: string;
  width: number;
  height: number;
};

export type AudioClip = {
  id: string;
  name: string;
  assetId?: string;
  dataUrl?: string;
  startMs: number;
  durationMs: number;
  offsetMs: number;
  volume: number;
  muted: boolean;
};

export type ProjectAudio = {
  clips: AudioClip[];
  muted: boolean;
  masterVolume: number;
};

export type Project = {
  schemaVersion: number;
  id: string;
  name: string;
  aspectRatio: AspectRatio;
  fps: 30 | 60;
  background:
    | { kind: 'solid'; color: string }
    | {
        kind: 'gradient';
        angle: number;
        stops: { at: number; color: string }[];
      };
  defaultCamera: {
    position: Vec3;
    rotation: Vec3;
    focalLength: number;
  };
  shots: Shot[];
  assets: Record<string, AssetRecord>;
  audio?: ProjectAudio;
  createdAt: string;
  updatedAt: string;
};