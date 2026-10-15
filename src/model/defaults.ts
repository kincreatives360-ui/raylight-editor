// src/model/defaults.ts
import type {
  Project,
  ProjectAudio,
  Shot,
  ImageLayer,
  ShapeLayer,
  TextLayer,
  Effects,
  EffectKey,
  Transitionish,
} from './types';

export const CURRENT_SCHEMA_VERSION = 1;

// Convert between human-friendly Degrees and 3D-engine Radians
export function degToRad(degrees: number): number {
  return Number(((degrees * Math.PI) / 180).toFixed(6));
}

export function radToDeg(radians: number): number {
  return Number(((radians * 180) / Math.PI).toFixed(2));
}

export const DEFAULT_EFFECTS_ORDER: EffectKey[] = [
  'depthOfField',
  'bloom',
  'vignette',
  'motionBlur',
  'chromaticAberration',
  'filmGrain',
  'ghost',
  'colorGrade',
  'edgeFade',
  'glitch',
];

export function createDefaultTransition(
  type: Transitionish['type'] = 'none',
  durationMs = 500
): Transitionish {
  return {
    type,
    durationMs,
    delayMs: 0,
    easing: { kind: 'preset', name: 'ease-out' },
    distance: 0.12,
  };
}

export function createDefaultEffects(): Effects {
  return {
    depthOfField: {
      enabled: true,
      target: { x: 0, y: 0, z: 0 },
      focusRange: 0.35,
      aperture: 4.8,
      bokehScale: 3.5,
      bokehShape: 'anamorphic',
      focalLength: 50,
      highlightThreshold: 0.75,
      highlightIntensity: 0.5,
    },
    bloom: { enabled: true, intensity: 0.3, threshold: 0.7 },
    vignette: { enabled: true, intensity: 0.58 },
    motionBlur: { enabled: false, samples: 8, shutterAngle: 180 },
    chromaticAberration: { enabled: false, offset: 0.002 },
    filmGrain: { enabled: true, intensity: 0.02, size: 1.0 },
    ghost: { enabled: false, opacity: 0.2, offset: 0.01, blur: 4 },
    colorGrade: {
      enabled: true,
      exposure: 1.0,
      contrast: 1.05,
      saturation: 1.17,
    },
    edgeFade: { enabled: false, top: 0, right: 0, bottom: 0, left: 0 },
    glitch: { enabled: false, intensity: 0.0 },
  };
}

export function createDefaultImageLayer(
  overrides: Partial<ImageLayer> = {}
): ImageLayer {
  return {
    id: `layer-img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: 'Product Screenshot',
    kind: 'image',
    assetId: 'asset-sample-dashboard',
    hidden: false,
    locked: false,
    order: 0,
    position: { x: 0, y: 0, z: 0 },
    rotation: {
      x: degToRad(-44),
      y: degToRad(25),
      z: degToRad(30),
    },
    scale: { x: 1, y: 1, z: 1 },
    opacity: 1,
    blendMode: 'normal',
    inMs: 0,
    outMs: 4000,
    size: { width: 0.64, height: 0.6 },
    crop: { x: 0, y: 0, width: 1, height: 1 },
    cornerRadius: 0.04,
    stroke: { color: '#6366f1', width: 0.002, opacity: 0.6 },
    device: {
      type: 'macbook',
      color: 'silver',
      gloss: 0.75,
      lidAngle: 100,
      screenGlow: 0.35,
    },
    entrance: createDefaultTransition('slide-up', 650),
    exit: createDefaultTransition('fade', 400),
    blocks: [],
    effects: {
      dropShadow: {
        enabled: true,
        color: '#000000',
        opacity: 0.65,
        blur: 0.04,
        offsetX: 0,
        offsetY: 0.02,
      },
      glow: {
        enabled: true,
        color: '#6366f1',
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
    name: 'Glass Feature Card',
    kind: 'shape',
    shape: 'rectangle',
    hidden: false,
    locked: false,
    order: 1,
    position: { x: 0.2, y: 0.14, z: 0.25 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    opacity: 0.92,
    blendMode: 'normal',
    inMs: 300,
    outMs: 4000,
    size: { width: 0.28, height: 0.18 },
    fill: { kind: 'solid', color: '#1e1b4b', opacity: 0.85 },
    stroke: { color: '#a855f7', width: 0.002, opacity: 0.5 },
    cornerRadius: 0.08,
    entrance: createDefaultTransition('scale-out', 500),
    exit: createDefaultTransition('fade', 350),
    blocks: [],
    effects: {
      dropShadow: {
        enabled: true,
        color: '#000000',
        opacity: 0.5,
        blur: 0.03,
        offsetX: 0,
        offsetY: 0.015,
      },
      backdropBlur: 0.02,
    },
    ...overrides,
  };
}

export function createDefaultTextLayer(
  overrides: Partial<TextLayer> = {}
): TextLayer {
  return {
    id: `layer-txt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: 'Headline Title',
    kind: 'text',
    content: 'Cinematic Product Launches',
    hidden: false,
    locked: false,
    order: 2,
    position: { x: 0, y: -0.35, z: 0.15 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    opacity: 1,
    blendMode: 'normal',
    inMs: 100,
    outMs: 3900,
    font: {
      family: 'Inter',
      size: 0.03, // Fractional size from audit
      weight: 700,
      color: '#ffffff',
      align: 'center',
      letterSpacing: -0.01,
    },
    maxWidth: 0.75,
    verticalAlign: 'middle',
    entrance: createDefaultTransition('mask-sweep', 600),
    exit: createDefaultTransition('fade', 300),
    blocks: [],
    effects: {},
    ...overrides,
  };
}

export function createDefaultShot(overrides: Partial<Shot> = {}): Shot {
  return {
    id: `shot-${Date.now()}`,
    name: 'Shot 1',
    startMs: 0,
    durationMs: 4000,
    lane: 0,
    layers: [],
    groups: [],
    framings: [
      {
        id: 'framing-wide',
        name: 'Wide Establishing',
        target: { x: 0, y: 0, z: 0 },
        zoom: 1.0,
      },
      {
        id: 'framing-closeup',
        name: 'Feature Push-In',
        target: { x: 0.08, y: 0.04, z: 0.1 },
        zoom: 1.28,
      },
    ],
    cameraBlocks: [
      {
        id: 'cam-block-1',
        label: 'Wide to Push-In',
        startMs: 400,
        durationMs: 3200,
        fromFramingId: 'framing-wide',
        toFramingId: 'framing-closeup',
        mode: 'dolly',
        easing: { kind: 'preset', name: 'ease-in-out' },
      },
    ],
    focusBlocks: [],
    transition: {
      type: 'crossfade',
      durationMs: 500,
      easing: { kind: 'preset', name: 'ease-in-out' },
    },
    light: {
      position: { x: -0.35, y: 0.45, z: 1.0 },
      intensity: 1.2,
      temperature: 5600,
      ambience: 0.65,
    },
    effects: createDefaultEffects(),
    effectsOrder: [...DEFAULT_EFFECTS_ORDER],
    ...overrides,
  };
}

export function createDefaultAudio(): ProjectAudio {
  return {
    clips: [
      {
        id: 'clip-audio-default-01',
        name: 'Neon Horizon (Lo-Fi Synthwave)',
        startMs: 0,
        durationMs: 7500,
        offsetMs: 0,
        volume: 0.8,
        muted: false,
      },
    ],
    muted: false,
    masterVolume: 1.0,
  };
}

// Starter Project matching the real Raylight project file values
export const DEFAULT_PROJECT: Project = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  id: 'proj-raylight-sample-01',
  name: 'Raylight Launch Showcase',
  aspectRatio: '16:9',
  fps: 60,
  background: {
    kind: 'gradient',
    angle: 135,
    stops: [
      { at: 0, color: '#070913' },
      { at: 1, color: '#141829' },
    ],
  },
  defaultCamera: {
    position: { x: 0, y: 0, z: 2.2 },
    rotation: { x: 0, y: 0, z: 0 },
    focalLength: 50,
  },
  assets: {
    'asset-sample-dashboard': {
      id: 'asset-sample-dashboard',
      name: 'dashboard-hero.png',
      mimeType: 'image/png',
      dataUrl: '',
      width: 1920,
      height: 1080,
    },
  },
  shots: [
    createDefaultShot({
      id: 'shot-1',
      name: 'Shot 1: 3D Tilted Hero Reveal',
      startMs: 0,
      durationMs: 4000,
      lane: 0,
      layers: [
        createDefaultImageLayer({
          id: 'layer-hero-screenshot',
          name: 'Hero Tilted Screenshot (-44°, 25°, 30°)',
          order: 0,
          rotation: {
            x: degToRad(-44),
            y: degToRad(25),
            z: degToRad(30),
          },
          blocks: [
            {
              id: 'block-shift-x',
              label: 'Shift X by -0.19',
              property: 'position',
              startMs: 600,
              durationMs: 2200,
              easing: { kind: 'spring', name: 'gentle' },
              amount: { x: -0.19, y: 0, z: 0 },
            },
            {
              id: 'block-swing-tilt',
              label: 'Swing Tilt into View',
              property: 'tilt',
              startMs: 400,
              durationMs: 2400,
              easing: {
                kind: 'bezier',
                x1: 0.16,
                y1: 1,
                x2: 0.3,
                y2: 1,
              },
              amount: {
                x: degToRad(18),
                y: degToRad(-10),
                z: degToRad(-12),
              },
            },
          ],
        }),
        createDefaultShapeLayer({
          id: 'layer-callout-card',
          name: 'Floating Glass Callout',
          order: 1,
        }),
        createDefaultTextLayer({
          id: 'layer-hero-headline',
          name: 'Main Feature Headline',
          order: 2,
        }),
      ],
    }),
    createDefaultShot({
      id: 'shot-2',
      name: 'Shot 2: Anamorphic Depth of Field',
      startMs: 4000,
      durationMs: 3500,
      lane: 1,
      effects: createDefaultEffects(), // Uses aperture 4.8, anamorphic, bloom 0.3, vignette 0.58, grain 0.02, saturation 1.17
      layers: [
        createDefaultImageLayer({
          id: 'layer-shot2-iphone',
          name: 'iPhone Product Close-Up',
          inMs: 0,
          outMs: 3500,
          size: { width: 0.28, height: 0.56 },
          rotation: {
            x: degToRad(12),
            y: degToRad(-20),
            z: degToRad(4),
          },
          device: {
            type: 'iphone',
            color: 'black',
            gloss: 0.88,
            screenGlow: 0.45,
          },
        }),
      ],
    }),
  ],
  audio: createDefaultAudio(),
  createdAt: '2026-10-13T12:00:00.000Z',
  updatedAt: '2026-10-13T12:00:00.000Z',
};