import type { Vec3, GradientStop } from './commonTypes';
import type { Easing } from './animationTypes';

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
  presetId?: string; // id of active CameraPreset (e.g. 'front', 'isometric', 'hero-low')
  anchorX: number; // artboard pixels relative to center
  anchorY: number; // artboard pixels relative to center (+Y up)
  anchorZ?: number; // 3D elevation / depth offset
  zoom: number;    // e.g. 1.0x, 1.1x
  roll: number;    // degrees (-180 to 180)
  orbit: number;   // degrees (-360 to 360)
  tilt: number;    // degrees (-89 to 89)
  focalLength?: number; // lens focal length in mm (e.g. 24, 35, 50, 85, 135)
  fov?: number;    // field of view in degrees
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
    frequency?: number; // speed multiplier (default 1.0)
  };
}

export interface LightAnimationBlock {
  /** Original curve bounds retained when a shot is split. */
  sourceStartMs?: number;
  sourceDurationMs?: number;
  id: string;
  label: string;
  /** 'key' for primary directional light, or specific source id */
  targetLightId?: string;
  property?: 'position' | 'intensity' | 'temperature' | 'ambience' | 'color' | 'angle' | 'penumbra';
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
  /** Original curve bounds retained when a shot is split. */
  sourceStartMs?: number;
  sourceDurationMs?: number;
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
  shadowStrength?: number;
  shadowSoftness?: number;
}

export interface LightRig {
  position: Vec3;
  /** Aim target for the primary Sun/directional light. */
  target?: Vec3;
  intensity: number;
  temperature: number;
  /** Ambient light intensity / shadow floor (0 - 1) */
  ambience: number;
  /** Scene-level ambient light tint color */
  ambientColor?: string;
  keyColor?: string;
  environment?: 'studio' | 'softbox' | 'strip-light' | 'daylight' | 'night-city' | 'warehouse' | 'custom';
  shadowStrength?: number;
  shadowSoftness?: number;
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
  | 'glitch'
  | 'atmosphere'
  | 'gradientMap'
  | 'fishEye'
  | 'lensDistortion';

export interface SceneEffects {
  atmosphere: {
    enabled: boolean;
    fog: number;
    mist: number;
    haze: number;
    color: string;
    depthEnabled: boolean;
    start: number;
    reach: number;
    mistHeight: number;
  };
  gradientMap: {
    enabled: boolean;
    stops: GradientStop[];
    blend: number;
    shift: number;
    spread: number;
    blendMode: 'normal' | 'multiply' | 'screen' | 'overlay' | 'softLight' | 'hardLight' | 'difference' | 'exclusion' | 'lighten' | 'darken' | 'colorDodge' | 'colorBurn';
  };
  fishEye: {
    enabled: boolean;
    amount: number;
    centerX: number;
    centerY: number;
    scale: number;
    edgeMode: 'fill' | 'balanced' | 'none';
  };
  lensDistortion: {
    enabled: boolean;
    mode: 'pinch' | 'barrel';
    strength: number;
    centerX: number;
    centerY: number;
    edgeMode: 'fill' | 'balanced' | 'none';
    measure: 'width' | 'height' | 'diagonal';
  };
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
    sceneSize?: number;
    focusMode?: 'point' | 'subject';
  };
  bloom: {
    enabled: boolean;
    intensity: number;
    threshold: number;
    radius?: number;
    softness?: number;
    blendMode?: 'screen' | 'add' | 'softLight';
  };
  vignette: {
    enabled: boolean;
    intensity: number;
    midpoint?: number;
    roundness?: number;
    softness?: number;
    color?: string;
  };
  motionBlur: {
    enabled: boolean;
    samples?: number;
    shutterAngle: number;
    angle?: number;
    direction?: 'camera' | 'angle';
    amount?: number;
  };
  chromaticAberration: {
    enabled: boolean;
    offset: number;
    verticalOffset?: number;
    edgeStrength?: number;
    mode?: 'lens' | 'split';
    angle?: number;
    softness?: number;
    centerX?: number;
    centerY?: number;
    channelRed?: number;
    channelGreen?: number;
    channelBlue?: number;
    fringeColorAngle?: number;
  };
  filmGrain: {
    enabled: boolean;
    intensity: number;
    size: number;
    softness?: number;
    colorAmount?: number;
    aspect?: number;
    seed?: number;
    stock?: 'Tungsten 500' | 'Kodak 5219' | 'Fuji 400' | 'Custom';
    shadowStrength?: number;
    midStrength?: number;
    highlightStrength?: number;
    midpoint?: number;
    protectBlacks?: boolean;
    blendMode?: 'film' | 'overlay' | 'softLight' | 'multiply';
    motion?: 'frame' | '12fps' | 'static';
    smooth?: boolean;
    perChannel?: boolean;
  };
  ghost: {
    enabled: boolean;
    opacity: number;
    offset: number;
    blur: number;
    angle?: number;
    spread?: number;
  };
  colorGrade: {
    enabled: boolean;
    exposure: number;
    contrast: number;
    saturation: number;
    temperature?: number;
    tint?: number;
    highlights?: number;
    shadows?: number;
    lift?: number;
    gamma?: number;
    vibrance?: number;
    blackPoint?: number;
    whitePoint?: number;
  };
  edgeFade: {
    enabled: boolean;
    top: number;
    bottom: number;
    left?: number;
    right?: number;
    softness?: number;
    color?: string;
  };
  glitch: {
    enabled: boolean;
    intensity: number;
    bandSize?: number;
    colorShift?: number;
    mode?: 'digital' | 'analog' | 'datamosh';
    jitter?: number;
    scanlines?: number;
    seed?: number;
  };
}
