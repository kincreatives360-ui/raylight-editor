export type EffectKey =
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
  | 'lensDistortion'
  | 'depthOfField';

export const EFFECT_KEYS: EffectKey[] = [
  'bloom',
  'vignette',
  'motionBlur',
  'chromaticAberration',
  'filmGrain',
  'ghost',
  'colorGrade',
  'edgeFade',
  'glitch',
  'atmosphere',
  'gradientMap',
  'fishEye',
  'lensDistortion',
  'depthOfField',
];

export const DEFAULT_EFFECTS_ORDER: EffectKey[] = [
  'depthOfField',
  'bloom',
  'motionBlur',
  'chromaticAberration',
  'colorGrade',
  'vignette',
  'filmGrain',
  'ghost',
  'edgeFade',
  'glitch',
  'atmosphere',
  'gradientMap',
  'fishEye',
  'lensDistortion',
];

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
  | 'pathReveal'
  | 'wiggle'
  | 'emphasis'
  | 'changeText'
  | 'morph';

export const ANIMATION_BLOCK_PROPERTIES: AnimationBlockProperty[] = [
  'position',
  'rotation',
  'tilt',
  'scale',
  'size',
  'opacity',
  'cornerRadius',
  'layerBlur',
  'maskSweep',
  'shimmer',
  'followPath',
  'counter',
  'glow',
  'pathReveal',
  'wiggle',
  'emphasis',
  'changeText',
  'morph',
];

export const VECTOR_PROPERTIES: AnimationBlockProperty[] = [
  'position',
  'rotation',
  'tilt',
  'scale',
  'size',
];

export const SCALAR_PROPERTIES: AnimationBlockProperty[] = [
  'opacity',
  'cornerRadius',
  'layerBlur',
  'maskSweep',
  'shimmer',
  'followPath',
  'counter',
  'glow',
  'pathReveal',
  'wiggle',
  'emphasis',
  'changeText',
  'morph',
];

export function isVectorProperty(prop: AnimationBlockProperty): boolean {
  return VECTOR_PROPERTIES.includes(prop);
}

export function isScalarProperty(prop: AnimationBlockProperty): boolean {
  return SCALAR_PROPERTIES.includes(prop);
}

export type BlendMode =
  | 'normal'
  | 'darken'
  | 'multiply'
  | 'lighten'
  | 'screen'
  | 'add'
  | 'difference';

export const BLEND_MODES: BlendMode[] = [
  'normal',
  'darken',
  'multiply',
  'lighten',
  'screen',
  'add',
  'difference',
];

export type TransitionType =
  | 'none'
  | 'fade'
  | 'slide-up'
  | 'slide-down'
  | 'slide-left'
  | 'slide-right'
  | 'float-out'
  | 'scale-out'
  | 'mask-sweep'
  | 'wipe'
  | 'blur'
  | 'pop'
  | 'spin'
  | 'flip-x'
  | 'flip-y'
  | 'swing'
  | 'typewriter'
  | 'scramble';

export const TRANSITION_TYPES: TransitionType[] = [
  'none',
  'fade',
  'slide-up',
  'slide-down',
  'slide-left',
  'slide-right',
  'float-out',
  'scale-out',
  'mask-sweep',
  'wipe',
  'blur',
  'pop',
  'spin',
  'flip-x',
  'flip-y',
  'swing',
  'typewriter',
  'scramble',
];

export type SpringEasingName = 'gentle' | 'quick' | 'bouncy' | 'slow' | 'snappy' | 'stiff';
export interface SpringConfig {
  stiffness?: number;
  damping?: number;
  mass?: number;
}

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

export type Easing =
  | { kind: 'preset'; name: PresetEasingName }
  | { kind: 'spring'; name: SpringEasingName; config?: SpringConfig }
  | { kind: 'bezier'; x1: number; y1: number; x2: number; y2: number };