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
} from './types';
import { generateId } from './id';

export const CURRENT_SCHEMA_VERSION = 2;

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
  type: 'none',
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
  target: { x: 0, y: 0, z: 0 },
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
    radius: 1,
    softness: 0.5,
  },
  vignette: {
    enabled: false,
    intensity: 0.42,
    midpoint: 0.5,
    roundness: 1,
  },
  motionBlur: {
    enabled: false,
    shutterAngle: 180,
  },
  chromaticAberration: {
    enabled: false,
    offset: 0.002,
    verticalOffset: 0,
    edgeStrength: 1,
  },
  filmGrain: {
    enabled: false,
    intensity: 0.025,
    size: 1.2,
    softness: 0,
  },
  ghost: {
    enabled: false,
    opacity: 0.25,
    offset: 0.02,
    blur: 4,
    angle: 0,
    spread: 1,
  },
  colorGrade: {
    enabled: false,
    exposure: 1.0,
    contrast: 1.0,
    saturation: 1.0,
    temperature: 0,
    tint: 0,
    highlights: 0,
    shadows: 0,
  },
  edgeFade: {
    enabled: false,
    top: 0.1,
    bottom: 0.1,
    softness: 1,
  },
  glitch: {
    enabled: false,
    intensity: 0.15,
    bandSize: 50,
    colorShift: 0.5,
  },
};

export function createDefaultVideoLayer(
  overrides: Partial<VideoLayer> = {}
): VideoLayer {
  return {
    id: generateId('layer-vid'),
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
    id: generateId('layer-img'),
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
    id: generateId('layer-shp'),
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
    id: generateId('layer-txt'),
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
  const f1Id = generateId('framing-1');
  const f2Id = generateId('framing-2');

  const starterLayers = [
    createDefaultTextLayer({
      id: generateId('layer-txt'),
      name: 'Headline',
      position: { x: 0, y: 0.38, z: 0.15 },
      content: 'RAYLIGHT STUDIO',
    }),
  ];

  return {
    id: generateId('shot'),
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
    id: generateId('project'),
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
        isPlaceholder: true,
        startMs: 0,
        durationMs: 4000,
        lane: 0,
        layers: [],
      }),
    ],
    ...overrides,
  };
}

export const DEFAULT_PROJECT: Project = createDefaultProject();

/**
 * Canonical Phase 0 deterministic multi-shot fixture exercising:
 * - Multiple shots (Shot 1: 0..3000ms, Shot 2: 3000..7000ms) with a 1000ms crossfade transition
 * - Video layers in Shot 1 and Shot 2 (including a reused/shared video asset across both shots)
 * - Audio clips before/at t=0ms and future audio clips starting after t=0ms (1200ms, 3200ms)
 * - 3D device-framed image layers, shape layers, text layers, camera blocks, lights, and effects
 */
export function createMultiShotContractFixture(): Project {
  const sharedVideoAssetId = 'asset-shared-video';
  const shot2VideoAssetId = 'asset-shot2-video';
  const mockupImageAssetId = 'asset-mockup-img';

  const shot1 = createDefaultShot({
    id: 'shot-1',
    name: 'Intro Shot',
    isPlaceholder: false,
    startMs: 0,
    durationMs: 3000,
    useProjectBackground: true,
    layers: [
      createDefaultVideoLayer({
        id: 'vid-shot1',
        name: 'Intro Shared Video',
        order: 0,
        assetId: sharedVideoAssetId,
        inMs: 500,
        outMs: 2800,
        position: { x: -0.18, y: 0, z: 0 },
      }),
      createDefaultImageLayer({
        id: 'img-shot1-device',
        name: 'Hero Device Mockup',
        order: 1,
        assetId: mockupImageAssetId,
        inMs: 0,
        outMs: 3000,
        position: { x: 0.16, y: 0, z: 0.25 },
      }),
      createDefaultTextLayer({
        id: 'txt-shot1-title',
        name: 'Intro Headline',
        order: 2,
        content: 'RAYLIGHT PHASE 0',
        inMs: 0,
        outMs: 3000,
        entrance: {
          ...DEFAULT_TRANSITION_IN,
          type: 'slide-up',
          durationMs: 600,
        },
      }),
    ],
    cameraBlocks: [
      createDefaultCameraBlock('cam-shot1-push', 0, 2500, 'f1', 'f2', 'Intro Push'),
    ],
  });

  const shot2 = createDefaultShot({
    id: 'shot-2',
    name: 'Feature Shot',
    isPlaceholder: false,
    startMs: 3000,
    durationMs: 4000,
    useProjectBackground: false,
    background: {
      kind: 'solid',
      color: '#111827',
    },
    transition: {
      type: 'crossfade',
      durationMs: 1000,
      easing: { kind: 'preset', name: 'linear' },
    },
    layers: [
      createDefaultVideoLayer({
        id: 'vid-shot2-shared',
        name: 'Reused Video in Shot 2',
        order: 0,
        assetId: sharedVideoAssetId,
        inMs: 400,
        outMs: 3600,
        position: { x: -0.2, y: 0, z: -0.1 },
      }),
      createDefaultVideoLayer({
        id: 'vid-shot2-unique',
        name: 'Unique Video in Shot 2',
        order: 1,
        assetId: shot2VideoAssetId,
        inMs: 0,
        outMs: 4000,
        position: { x: 0.2, y: 0, z: 0.3 },
      }),
      createDefaultShapeLayer({
        id: 'shp-shot2-badge',
        name: 'Feature Card',
        order: 2,
        inMs: 200,
        outMs: 3800,
        position: { x: 0, y: -0.25, z: 0.45 },
      }),
    ],
    effects: {
      ...createDefaultEffects(),
      bloom: { enabled: true, intensity: 0.6, threshold: 0.7 },
      depthOfField: {
        enabled: true,
        target: { x: 0, y: 0, z: 0.3 },
        focusRange: 0.25,
        aperture: 2.8,
        bokehScale: 3.0,
        bokehShape: 'spherical',
      },
      motionBlur: { enabled: true, shutterAngle: 180, samples: 8 },
    },
  });

  return createDefaultProject({
    id: 'project-phase0-fixture',
    name: 'Phase 0 Multi-Shot Contract Fixture',
    fps: 60,
    assets: {
      [sharedVideoAssetId]: {
        id: sharedVideoAssetId,
        name: 'shared-demo.mp4',
        mimeType: 'video/mp4',
        dataUrl: 'data:video/mp4;base64,AAAAIGZ0eXBpc29t',
        width: 1920,
        height: 1080,
      },
      [shot2VideoAssetId]: {
        id: shot2VideoAssetId,
        name: 'shot2-clip.mp4',
        mimeType: 'video/mp4',
        dataUrl: 'data:video/mp4;base64,BBBBIGZ0eXBpc29t',
        width: 1920,
        height: 1080,
      },
      [mockupImageAssetId]: {
        id: mockupImageAssetId,
        name: 'mockup.png',
        mimeType: 'image/png',
        dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        width: 1179,
        height: 2556,
      },
    },
    audio: {
      muted: false,
      masterVolume: 1.0,
      clips: [
        {
          id: 'clip-intro-at-zero',
          name: 'Intro Chime (t=0)',
          startMs: 0,
          durationMs: 800,
          offsetMs: 0,
          volume: 0.9,
          muted: false,
          dataUrl: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=',
        },
        {
          id: 'clip-future-shot1',
          name: 'Future Whoosh (t=1200ms)',
          startMs: 1200,
          durationMs: 600,
          offsetMs: 0,
          volume: 0.85,
          muted: false,
          dataUrl: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=',
        },
        {
          id: 'clip-future-shot2',
          name: 'Shot 2 Impact (t=3200ms)',
          startMs: 3200,
          durationMs: 1500,
          offsetMs: 100,
          volume: 1.0,
          muted: false,
          dataUrl: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=',
        },
      ],
    },
    shots: [shot1, shot2],
  });
}






