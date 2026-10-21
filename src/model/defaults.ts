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
  CameraBlock,
  DeviceModelSpec,
  DeviceFrame,
} from './types';

export const CURRENT_SCHEMA_VERSION = 2;

/**
 * Normalizes device chassis color tokens to standard hex values.
 * Passes through existing hex/rgb values and falls back to '#1c1c1f'.
 */
export function resolveDeviceColor(color?: string): string {
  if (!color) return '#1c1c1f';
  if (color.startsWith('#') || color.startsWith('rgb')) return color;
  switch (color) {
    case 'silver': return '#e2e8f0';
    case 'black': return '#18181c';
    case 'space-black': return '#121316';
    case 'titanium': return '#484745';
    case 'midnight': return '#161c28';
    default: return color;
  }
}

export function createDefaultCameraBlock(
  id: string,
  startMs: number,
  durationMs: number,
  fromFramingId: string = 'f1',
  toFramingId: string = 'f2',
  label: string = 'Camera Move'
): CameraBlock {
  return {
    id,
    label,
    startMs,
    durationMs,
    fromFramingId,
    toFramingId,
    mode: 'dolly',
    easing: { kind: 'preset', name: 'linear' },
    from: {
      anchorX: 0,
      anchorY: 0,
      zoom: 1,
      roll: 0,
      orbit: 0,
      tilt: 0,
    },
    to: {
      anchorX: 0,
      anchorY: 0,
      zoom: 1.2,
      roll: 0,
      orbit: 0,
      tilt: 0,
    },
    shake: { from: 0, to: 0 },
  };
}

export function createDefaultEffects(): SceneEffects {
  return structuredClone(DEFAULT_SCENE_EFFECTS);
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
        target: { x: -96, y: 22, z: 0 },
        zoom: 1.15,
      },
    ],
    cameraBlocks: [],
    lightBlocks: [],
    effectBlocks: [],
    light: { ...DEFAULT_LIGHT_RIG },
    effects: structuredClone(DEFAULT_SCENE_EFFECTS),
    effectsOrder: [...DEFAULT_EFFECTS_ORDER],
    transition: {
      type: 'crossfade',
      durationMs: 500,
      easing: { kind: 'preset', name: 'ease-in-out' },
    },
    ...overrides,
  };
}

export function createDefaultProject(overrides: Partial<Project> = {}): Project {
  return {
    id: `project-${Date.now()}`,
    name: 'Untitled project',
    version: CURRENT_SCHEMA_VERSION,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    aspectRatio: '16:9',
    fps: 60,
    background: {
      kind: 'solid',
      color: '#0c0e17',
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
    ...overrides,
  };
}

export const DEFAULT_PROJECT: Project = createDefaultProject();
export const DEFAULT_DEVICE_MODELS: Readonly<Record<string, DeviceModelSpec>> = {
  phone_generic: {
    id: 'phone_generic',
    name: 'iPhone',
    kind: 'procedural',
    nominalWidth: 1,
    nominalHeight: 2.05,
    nominalDepth: 0.08,
    screenWidth: 0.92,
    screenHeight: 1.95,
    defaultFit: 'cover',
    chassisCornerRadius: 0.14,
    screenCornerRadius: 0.135,
  },
  iphone_15_pro: {
    id: 'iphone_15_pro',
    name: 'iPhone 15 Pro',
    kind: 'procedural',
    nominalWidth: 1,
    nominalHeight: 2.05,
    nominalDepth: 0.08,
    screenWidth: 0.92,
    screenHeight: 1.95,
    defaultFit: 'cover',
    chassisCornerRadius: 0.14,
    screenCornerRadius: 0.135,
  },
  ipad_pro_12_9: {
    id: 'ipad_pro_12_9',
    name: 'iPad Pro 12.9',
    kind: 'procedural',
    nominalWidth: 1.53,
    nominalHeight: 2.0,
    nominalDepth: 0.06,
    screenWidth: 1.43,
    screenHeight: 1.90,
    defaultFit: 'cover',
    chassisCornerRadius: 0.07,
    screenCornerRadius: 0.065,
  },
  macbook_pro_14: {
    id: 'macbook_pro_14',
    name: 'MacBook Pro 14',
    kind: 'procedural',
    nominalWidth: 1.60,
    nominalHeight: 1.08,
    nominalDepth: 0.12,
    screenWidth: 1.50,
    screenHeight: 0.95,
    defaultFit: 'cover',
    chassisCornerRadius: 0.045,
    screenCornerRadius: 0.025,
  },
  display_27: {
    id: 'display_27',
    name: 'Studio Display 27',
    kind: 'procedural',
    nominalWidth: 1.66,
    nominalHeight: 1.0,
    nominalDepth: 0.05,
    screenWidth: 1.60,
    screenHeight: 0.90,
    defaultFit: 'cover',
    chassisCornerRadius: 0.02,
    screenCornerRadius: 0.005,
  },
  browser_window: {
    id: 'browser_window',
    name: 'Browser Window',
    kind: 'procedural',
    nominalWidth: 1.60,
    nominalHeight: 1.0,
    nominalDepth: 0.03,
    screenWidth: 1.56,
    screenHeight: 0.88,
    defaultFit: 'contain',
    chassisCornerRadius: 0.045,
    screenCornerRadius: 0.02,
  },
  samsung_galaxy_s22: {
    id: 'samsung_galaxy_s22',
    name: 'Galaxy S22',
    kind: 'procedural',
    nominalWidth: 1.0,
    nominalHeight: 2.08,
    nominalDepth: 0.08,
    screenWidth: 0.94,
    screenHeight: 1.98,
    defaultFit: 'cover',
    chassisCornerRadius: 0.04,
    screenCornerRadius: 0.035,
  },
} as const;

export type DeviceModelId = keyof typeof DEFAULT_DEVICE_MODELS;

export function getDeviceModelSpec(id: DeviceModelId): DeviceModelSpec {
  return DEFAULT_DEVICE_MODELS[id];
}

export function getDeviceModelSpecByType(type: DeviceFrame['type']): DeviceModelSpec | undefined {
  const mapping: Record<DeviceFrame['type'], DeviceModelId> = {
    iphone: 'phone_generic',
    ipad: 'ipad_pro_12_9',
    macbook: 'macbook_pro_14',
    browser: 'browser_window',
    'samsung-galaxy': 'samsung_galaxy_s22',
    display: 'display_27',
  };
  const modelId = mapping[type];
  return modelId ? DEFAULT_DEVICE_MODELS[modelId] : undefined;
}

export function resolveDeviceModelSpec(device?: DeviceFrame): DeviceModelSpec {
  if (!device) return DEFAULT_DEVICE_MODELS.phone_generic;
  if (device.modelSpecId && (device.modelSpecId in DEFAULT_DEVICE_MODELS)) {
    return DEFAULT_DEVICE_MODELS[device.modelSpecId as DeviceModelId];
  }
  return getDeviceModelSpecByType(device.type) ?? DEFAULT_DEVICE_MODELS.phone_generic;
}