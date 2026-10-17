// src/model/defaults.ts
import type {
  Project,
  Shot,
  ImageLayer,
  VideoLayer,
  ShapeLayer,
  TextLayer,
  Transitionish,
  SceneEffects,
  EffectKey,
  LightRig,
  ProjectAudio,
} from './types';

export const CURRENT_SCHEMA_VERSION = 1;

export function createDefaultEffects(): SceneEffects {
  return JSON.parse(JSON.stringify(DEFAULT_SCENE_EFFECTS));
}

export function createDefaultAudio(): ProjectAudio {
  return {
    clips: [],
    muted: false,
    masterVolume: 1.0,
  };
}

export const degToRad = (degrees: number): number =>
  Number(((degrees * Math.PI) / 180).toFixed(6));

export const radToDeg = (radians: number): number =>
  Number(((radians * 180) / Math.PI).toFixed(1));

export const DEFAULT_TRANSITION_IN: Transitionish = {
  type: 'fade',
  durationMs: 650,
  delayMs: 0,
  distance: 0.16,
  easing: { kind: 'preset', name: 'ease-out-expo' },
};

export const DEFAULT_TRANSITION_OUT: Transitionish = {
  type: 'none',
  durationMs: 500,
  delayMs: 0,
  distance: 0.14,
  easing: { kind: 'preset', name: 'ease-in-out' },
};

export const DEFAULT_LIGHT_RIG: LightRig = {
  position: { x: -0.28, y: 0.36, z: 0.9 },
  intensity: 1.0,
  temperature: 6100,
  ambience: 0.45,
  ambientColor: '#f8fafc',
  keyLightEnabled: true,
  castShadow: true,
  showGizmos: false,
  sources: [],
};

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
];

export const DEFAULT_SCENE_EFFECTS: SceneEffects = {
  depthOfField: {
    enabled: false,
    target: { x: 0, y: 0, z: 0 },
    focusRange: 0.35,
    aperture: 2.8,
    bokehScale: 4.5,
    bokehShape: 'anamorphic',
  },
  bloom: {
    enabled: false,
    intensity: 0.35,
    threshold: 0.75,
  },
  vignette: {
    enabled: false,
    intensity: 0.42,
  },
  motionBlur: {
    enabled: false,
    shutterAngle: 180,
  },
  chromaticAberration: {
    enabled: false,
    offset: 0.002,
  },
  filmGrain: {
    enabled: false,
    intensity: 0.025,
    size: 1.2,
  },
  ghost: {
    enabled: false,
    opacity: 0.25,
    offset: 0.02,
    blur: 4,
  },
  colorGrade: {
    enabled: false,
    exposure: 1.0,
    contrast: 1.0,
    saturation: 1.0,
  },
  edgeFade: {
    enabled: false,
    top: 0.1,
    bottom: 0.1,
  },
  glitch: {
    enabled: false,
    intensity: 0.15,
  },
};

export function createDefaultVideoLayer(
  overrides: Partial<VideoLayer> = {}
): VideoLayer {
  return {
    id: `layer-vid-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    kind: 'video',
    name: 'Video Layer',
    order: 0,
    hidden: false,
    locked: false,
    inMs: 0,
    outMs: 4000,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    opacity: 1,
    blendMode: 'normal',
    assetId: '',
    size: { width: 0.34, height: 0.68 },
    cornerRadius: 0.04,
    device: undefined,
    entrance: { ...DEFAULT_TRANSITION_IN },
    exit: { ...DEFAULT_TRANSITION_OUT },
    blocks: [],
    effects: {
      dropShadow: {
        enabled: true,
        color: '#000000',
        opacity: 0.68,
        blur: 0.045,
        offsetX: 0,
        offsetY: 0.024,
      },
      glow: {
        enabled: false,
        color: '#0088ff',
        intensity: 0.35,
        radius: 0.05,
      },
      layerBlur: 0,
      backdropBlur: 0,
    },
    ...overrides,
  };
}

export function createDefaultImageLayer(
  overrides: Partial<ImageLayer> = {}
): ImageLayer {
  return {
    id: `layer-img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    kind: 'image',
    name: 'Image Layer',
    order: 0,
    hidden: false,
    locked: false,
    inMs: 0,
    outMs: 4000,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    opacity: 1,
    blendMode: 'normal',
    assetId: '',
    size: { width: 0.34, height: 0.68 },
    cornerRadius: 0.04,
    device: undefined,
    entrance: { ...DEFAULT_TRANSITION_IN },
    exit: { ...DEFAULT_TRANSITION_OUT },
    blocks: [],
    effects: {
      dropShadow: {
        enabled: true,
        color: '#000000',
        opacity: 0.68,
        blur: 0.045,
        offsetX: 0,
        offsetY: 0.024,
      },
      glow: {
        enabled: false,
        color: '#0088ff',
        intensity: 0.35,
        radius: 0.05,
      },
      layerBlur: 0,
      backdropBlur: 0,
    },
    ...overrides,
  };
}

export function createDefaultShapeLayer(
  overrides: Partial<ShapeLayer> = {}
): ShapeLayer {
  return {
    id: `layer-shp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    kind: 'shape',
    name: 'Rectangle',
    order: 1,
    hidden: false,
    locked: false,
    inMs: 0,
    outMs: 4000,
    position: { x: 0, y: 0, z: 0.12 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    opacity: 0.95,
    blendMode: 'normal',
    shape: 'rectangle',
    size: { width: 0.3, height: 0.18 },
    cornerRadius: 0.05,
    fill: {
      kind: 'gradient',
      angle: 135,
      stops: [
        { at: 0, color: '#0284c7' },
        { at: 1, color: '#1e1b4b' },
      ],
    },
    stroke: {
      color: '#38bdf8',
      width: 0.002,
      opacity: 0.65,
    },
    entrance: { ...DEFAULT_TRANSITION_IN },
    exit: { ...DEFAULT_TRANSITION_OUT },
    blocks: [],
    effects: {
      backdropBlur: 0.025,
      layerBlur: 0,
    },
    ...overrides,
  };
}

export function createDefaultTextLayer(
  overrides: Partial<TextLayer> = {}
): TextLayer {
  return {
    id: `layer-txt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    kind: 'text',
    name: 'Headline Text',
    order: 2,
    hidden: false,
    locked: false,
    inMs: 0,
    outMs: 4000,
    position: { x: 0, y: 0, z: 0.2 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    opacity: 1,
    blendMode: 'normal',
    content: 'slide to answer',
    maxWidth: 0.55,
    verticalAlign: 'middle',
    font: {
      family: 'Inter',
      size: 0.042,
      weight: 700,
      color: '#ffffff',
      align: 'center',
      letterSpacing: -0.015,
    },
    entrance: { ...DEFAULT_TRANSITION_IN },
    exit: { ...DEFAULT_TRANSITION_OUT },
    blocks: [],
    effects: {
      dropShadow: {
        enabled: true,
        color: '#000000',
        opacity: 0.75,
        blur: 0.025,
        offsetX: 0,
        offsetY: 0.01,
      },
      layerBlur: 0,
    },
    ...overrides,
  };
}

export function createDefaultShot(overrides: Partial<Shot> = {}): Shot {
  const f1Id = `framing-1-${Date.now()}`;
  const f2Id = `framing-2-${Date.now()}`;

  const starterLayers = [
    createDefaultImageLayer({
      id: `layer-img-${Date.now()}`,
      name: 'App Showcase Device',
      position: { x: 0, y: -0.02, z: 0 },
      device: { type: 'iphone', color: 'black', gloss: 0.6 },
    }),
    createDefaultTextLayer({
      id: `layer-txt-${Date.now()}`,
      name: 'Headline',
      position: { x: 0, y: 0.38, z: 0.15 },
      content: 'RAYLIGHT STUDIO',
    }),
  ];

  return {
    id: `shot-${Date.now()}`,
    name: 'Shot 1',
    startMs: 0,
    durationMs: 4000,
    lane: 0,
    useProjectBackground: true,
    layers: overrides.layers !== undefined ? overrides.layers : starterLayers,
    groups: [],
    framings: [
      {
        id: f1Id,
        name: 'Wide Establishing',
        target: { x: 0, y: 0, z: 0 },
        zoom: 1.0,
      },
      {
        id: f2Id,
        name: 'Feature Push-In',
        target: { x: -0.05, y: -0.02, z: 0 },
        zoom: 1.15,
      },
    ],
    cameraBlocks: [],
    lightBlocks: [],
    effectBlocks: [],
    light: { ...DEFAULT_LIGHT_RIG },
    effects: JSON.parse(JSON.stringify(DEFAULT_SCENE_EFFECTS)),
    effectsOrder: [...DEFAULT_EFFECTS_ORDER],
    transition: {
      type: 'crossfade',
      durationMs: 500,
      easing: { kind: 'preset', name: 'ease-in-out' },
    },
    ...overrides,
  };
}

export const DEFAULT_PROJECT: Project = {
  id: `project-${Date.now()}`,
  name: 'Untitled project',
  version: 1,
  schemaVersion: CURRENT_SCHEMA_VERSION,
  updatedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  aspectRatio: '16:9',
  fps: 60,
  background: {
    kind: 'gradient',
    angle: 135,
    stops: [
      { at: 0, color: '#0c0e17' },
      { at: 1, color: '#161928' },
    ],
  },
  assets: {},
  audio: createDefaultAudio(),
  shots: [
    createDefaultShot({
      id: 'shot-1',
      name: 'Shot 1',
      startMs: 0,
      durationMs: 4000,
      lane: 0,
    }),
  ],
};