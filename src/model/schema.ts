// src/model/schema.ts
import { z } from 'zod';
import type { Project } from './types';
import { SHADER_PRESET_IDS } from './backgroundPresets';
import { resolveDeviceFrameSettings } from './deviceFrame';

export const Vec2Schema = z.object({
  x: z.number(),
  y: z.number(),
});

export const Vec3Schema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

export const Size2DSchema = z.object({
  width: z.number().min(0.01),
  height: z.number().min(0.01),
});

export const DeviceFrameSettingsSchema = z.preprocess(
  (input) => input && typeof input === 'object' && !Array.isArray(input)
    ? resolveDeviceFrameSettings(input)
    : input,
  z.object({
    geometryVersion: z.literal(1).optional(),
    deviceId: z.string().optional(),
    deviceScale: z.number().min(0.65).max(2).optional(),
    family: z.enum(['phone', 'laptop', 'tablet', 'display']).optional(),
    legacyHeightCompensation: z.number().positive().optional(),
    enabled: z.boolean(),
    model: z.enum(['iphone-pro', 'iphone', 'iphone-classic']),
    frameColor: z.string(),
    finish: z.string().optional(),
    frameRoughness: z.number().min(0.04).max(1),
    frameMetalness: z.number().min(0).max(1),
    scale: z.number().min(0.65).max(2),
    bezelWidth: z.number().min(0.01).max(0.2),
    thickness: z.number().min(0.005).max(0.16),
    cornerRadius: z.number().min(0.04).max(0.24),
    screenFit: z.enum(['stretch', 'contain', 'cover']),
    screenFillColor: z.string(),
    screenPan: z.object({ x: z.number().min(-1).max(1), y: z.number().min(-1).max(1) }).optional(),
    screenZoom: z.number().min(0.5).max(3).optional(),
    hingeAngleDeg: z.number().min(0).max(135).optional(),
    tiltAngleDeg: z.number().min(-15).max(30).optional(),
    glassTint: z.string(),
    glassOpacity: z.number().min(0).max(0.45),
    glassRoughness: z.number().min(0.02).max(1),
    gloss: z.number().min(0).max(1),
    reflection: z.number().min(0).max(1),
    cutoutStyle: z.enum(['dynamic-island', 'notch', 'punch-hole', 'none']),
    cutoutWidth: z.number().min(0.08).max(0.85),
    cutoutHeight: z.number().min(0.015).max(0.14),
    showSideButtons: z.boolean(),
    showRearCameras: z.boolean(),
    shadowEnabled: z.boolean(),
    shadowOpacity: z.number().min(0).max(1),
    shadowBlur: z.number().min(0).max(1),
    shadowOffset: z.number().min(0).max(0.5),
    lidAngle: z.number().min(0).max(180).optional(),
  })
);

export const GradientStopSchema = z.object({
  at: z.number().min(0).max(1),
  color: z.string(),
  opacity: z.number().min(0).max(1).optional(),
});

export const MeshGradientPointSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  color: z.string(),
  opacity: z.number().min(0).max(1),
});

export const FillSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('solid'),
    color: z.string(),
    opacity: z.number().min(0).max(1),
  }),
  z.object({
    kind: z.literal('gradient'),
    angle: z.number(),
    stops: z.array(GradientStopSchema).min(2),
    gradientType: z.enum(['linear', 'radial', 'angular', 'diamond', 'mesh']).optional(),
    mesh: z.array(MeshGradientPointSchema).length(9).optional(),
  }).superRefine((fill, ctx) => {
    if (fill.gradientType === 'mesh' && fill.mesh?.length !== 9) {
      ctx.addIssue({ code: 'custom', path: ['mesh'], message: 'Mesh gradients require exactly nine control points.' });
    }
  }),
]);

export const ShaderPresetSchema = z.enum(SHADER_PRESET_IDS);

export const BackgroundSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('solid'),
    color: z.string(),
    opacity: z.number().min(0).max(1).optional(),
  }),
  z.object({
    kind: z.literal('gradient'),
    angle: z.number(),
    stops: z.array(GradientStopSchema).min(2),
    source: z.enum(['color', 'shader']).optional(),
    gradientType: z.enum(['linear', 'radial', 'angular']).optional(),
    handles: z
      .object({
        start: z.object({ x: z.number(), y: z.number() }),
        end: z.object({ x: z.number(), y: z.number() }),
        width: z.number().optional(),
      })
      .optional(),
  }),
  z.object({
    kind: z.literal('noise'),
    baseColor: z.string(),
    intensity: z.number().min(0).max(1),
  }),
  z.object({
    kind: z.literal('shader'),
    preset: ShaderPresetSchema,
    color: z.string(),
    colors: z.array(z.string()).default([]),
    backgroundColor: z.string().default('#000102'),
    speed: z.number().min(0).max(3).default(1),
    waves: z.number().min(0.25).max(2.5).default(1),
    focus: z.number().min(0.2).max(2).default(1),
    glow: z.number().min(0).max(2).default(1),
    shine: z.number().min(0).max(2).default(1),
    angle: z.number().min(-90).max(90).default(28),
    noiseScale: z.number().optional(),
    color1: z.string().optional(),
    color2: z.string().optional(),
    color3: z.string().optional(),
    color4: z.string().optional(),
  }),
  z.object({
    kind: z.literal('image'),
    assetId: z.string().optional(),
    src: z.string().optional(),
    color: z.string().optional(),
    fit: z.enum(['cover', 'contain']).optional(),
    dim: z.number().min(0).max(1).optional(),
    blur: z.number().min(0).max(100).optional(),
    opacity: z.number().min(0).max(1).optional(),
  }),
  z.object({
    kind: z.literal('transparent'),
  }),
]);

export const PresetEasingNameSchema = z.enum([
  'linear',
  'ease',
  'ease-in',
  'ease-out',
  'ease-in-out',
  'ease-in-quad',
  'ease-out-quad',
  'ease-in-out-quad',
  'ease-in-cubic',
  'ease-out-cubic',
  'ease-in-out-cubic',
  'ease-in-back',
  'ease-out-back',
  'ease-in-out-back',
  'ease-in-expo',
  'ease-out-expo',
  'bounce',
  'hold',
]);

export type PresetEasingName = z.infer<typeof PresetEasingNameSchema>;

export const SpringEasingNameSchema = z.enum([
  'gentle',
  'quick',
  'bouncy',
  'slow',
  'snappy',
  'stiff',
]);

export const SpringConfigSchema = z.object({
  stiffness: z.number().min(1).max(1000).optional(),
  damping: z.number().min(1).max(200).optional(),
  mass: z.number().min(0.1).max(50).optional(),
});

export const EasingSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('preset'),
    name: PresetEasingNameSchema,
  }),
  z.object({
    kind: z.literal('spring'),
    name: SpringEasingNameSchema,
    config: SpringConfigSchema.optional(),
  }),
  z.object({
    kind: z.literal('bezier'),
    x1: z.number().min(0).max(1),
    y1: z.number(),
    x2: z.number().min(0).max(1),
    y2: z.number(),
  }),
]);

export const TransitionTypeSchema = z.enum([
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
  'focus',
  'rack-focus',
  'pop',
  'spin',
  'flip-x',
  'flip-y',
  'swing',
  'typewriter',
  'scramble',
]);

export const TransitionishSchema = z.object({
  enabled: z.boolean().optional(),
  blur: z.number().min(0).optional(),
  fade: z.boolean().optional(),
  stagger: z.enum(['none', 'letter', 'word', 'line']).optional(),
  type: TransitionTypeSchema,
  durationMs: z.number().min(0),
  delayMs: z.number().min(0),
  distance: z.number().min(0).max(2),
  easing: EasingSchema,
});

export const AnimationBlockPropertySchema = z.enum([
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
]);

export type AnimationBlockProperty = z.infer<typeof AnimationBlockPropertySchema>;

export const AnimationBlockSchema = z.object({
  enabled: z.boolean().optional(),
  settings: z.object({
    targetPosition: Vec3Schema.optional(),
    targetScale: Vec3Schema.optional(),
    targetSize: z.object({ width: z.number().min(0), height: z.number().min(0) }).optional(),
    color: z.string().optional(),
    intensity: z.number().min(0).optional(),
    width: z.number().min(0).max(1).optional(),
    direction: z.enum(['left', 'right', 'up', 'down']).optional(),
    text: z.string().optional(),
  }).optional(),
  id: z.string(),
  label: z.string(),
  property: AnimationBlockPropertySchema,
  startMs: z.number().min(0),
  durationMs: z.number().min(10),
  easing: EasingSchema,
  amount: z.union([Vec3Schema, z.number()]),
});

export const LayerEffectsSchema = z.object({
  dropShadow: z
    .object({
      enabled: z.boolean(),
      color: z.string(),
      opacity: z.number().min(0).max(1),
      blur: z.number().min(0).max(1),
      offsetX: z.number().min(-1).max(1),
      offsetY: z.number().min(-1).max(1),
    })
    .optional(),
  glow: z
    .object({
      enabled: z.boolean(),
      color: z.string(),
      intensity: z.number().min(0),
      radius: z.number().min(0),
    })
    .optional(),
  layerBlur: z.number().min(0).max(2).optional(),
  backdropBlur: z.number().min(0).max(2).optional(),
  liquidGlass: z
    .object({
      enabled: z.boolean(),
      refraction: z.number().optional(),
      roughness: z.number().optional(),
      tint: z.string().optional(),
    })
    .optional(),
  warp: z
    .object({
      enabled: z.boolean(),
      amount: z.number().optional(),
      frequency: z.number().optional(),
    })
    .optional(),
});

export const BlendModeSchema = z.enum([
  'normal',
  'darken',
  'multiply',
  'lighten',
  'screen',
  'add',
  'difference',
]);

const LayerBaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  order: z.number(),
  groupId: z.string().optional(),
  hidden: z.boolean(),
  locked: z.boolean(),
  inMs: z.number().min(0),
  outMs: z.number().min(0),
  position: Vec3Schema,
  rotation: Vec3Schema,
  scale: Vec3Schema,
  opacity: z.number().min(0).max(1),
  blendMode: BlendModeSchema,
  entrance: TransitionishSchema,
  entrances: z.array(TransitionishSchema.extend({ id: z.string().optional() })).optional(),
  exit: TransitionishSchema,
  exits: z.array(TransitionishSchema.extend({ id: z.string().optional() })).optional(),
  blocks: z.array(AnimationBlockSchema),
  effects: LayerEffectsSchema,
  maskLayerId: z.string().optional(),
  receivesLight: z.boolean().optional(),
  material: z.object({
    roughness: z.number().min(0).max(1).optional(),
    metalness: z.number().min(0).max(1).optional(),
  }).optional(),
});

export const ImageLayerSchema = LayerBaseSchema.extend({
  kind: z.literal('image'),
  assetId: z.string(),
  size: Size2DSchema,
  cornerRadius: z.number().min(0).max(0.5),
  deviceFrame: DeviceFrameSettingsSchema.optional(),
  crop: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    })
    .optional(),
  stroke: z
    .object({
      color: z.string(),
      width: z.number(),
      opacity: z.number(),
    })
    .optional(),
});

export const ShapeMaskSchema = z.object({
  enabled: z.boolean(),
  shape: z.enum(['rectangle', 'circle', 'path']),
  feather: z.number().min(0),
  opacity: z.number().min(0).max(1),
  grow: z.number(),
  invert: z.boolean(),
  show: z.boolean(),
});

export const ShapeLayerSchema = LayerBaseSchema.extend({
  kind: z.literal('shape'),
  shape: z.enum(['rectangle', 'ellipse', 'line', 'arrow', 'polygon']),
  points: z.array(z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) })).optional(),
  size: Size2DSchema,
  cornerRadius: z.number().min(0).max(1),
  fill: FillSchema,
  stroke: z
    .object({
      color: z.string(),
      width: z.number(),
      opacity: z.number(),
      align: z.enum(['inside', 'center', 'outside']).optional(),
      style: z.enum(['solid', 'dashed', 'dotted']).optional(),
    })
    .optional(),
  depth: z.number().optional(),
  mask: ShapeMaskSchema.optional(),
});

export const TextLayerSchema = LayerBaseSchema.extend({
  kind: z.literal('text'),
  content: z.string(),
  maxWidth: z.number().min(0.05),
  verticalAlign: z.enum(['top', 'middle', 'bottom']).optional(),
  font: z.object({
    family: z.string(),
    size: z.number().min(0.005),
    weight: z.number().min(100).max(900),
    color: z.string(),
    align: z.enum(['left', 'center', 'right']),
    letterSpacing: z.number(),
    lineHeight: z.number().min(0.5).max(4).optional(),
  }),
});

export const VideoLayerSchema = ImageLayerSchema.extend({
  kind: z.literal('video'),
});

export const LayerSchema = z.discriminatedUnion('kind', [
  ImageLayerSchema,
  VideoLayerSchema,
  ShapeLayerSchema,
  TextLayerSchema,
]);

export const GroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  parentGroupId: z.string().optional(),
  collapsed: z.boolean(),
  hidden: z.boolean(),
  locked: z.boolean(),
  position: Vec3Schema.optional(),
  rotation: Vec3Schema.optional(),
  scale: Vec3Schema.optional(),
  opacity: z.number().min(0).max(1).optional(),
  blocks: z.array(AnimationBlockSchema).optional(),
});

export const FramingSchema = z.object({
  id: z.string(),
  name: z.string(),
  target: Vec3Schema,
  zoom: z.number().min(0.1).max(10),
  roll: z.number().optional(),
  orbit: z.number().optional(),
  tilt: z.number().optional(),
});

export const CameraKeyframeEndpointSchema = z.object({
  presetId: z.string().optional(),
  anchorX: z.number(),
  anchorY: z.number(),
  anchorZ: z.number().optional(),
  zoom: z.number().min(0.1).max(10),
  roll: z.number(),
  orbit: z.number(),
  tilt: z.number(),
  focalLength: z.number().min(10).max(300).optional(),
  fov: z.number().min(5).max(160).optional(),
});

export const CameraBlockSchema = z.object({
  id: z.string(),
  label: z.string().optional(),
  startMs: z.number().min(0),
  durationMs: z.number().min(50),
  fromFramingId: z.string(),
  toFramingId: z.string(),
  mode: z.enum(['dolly', 'zoom', 'dollyzoom', 'shake']),
  easing: EasingSchema,
  from: CameraKeyframeEndpointSchema.optional(),
  to: CameraKeyframeEndpointSchema.optional(),
  shake: z
    .object({
      from: z.number().min(0).max(100),
      to: z.number().min(0).max(100),
      frequency: z.number().min(0.1).max(10).optional(),
    })
    .optional(),
});

export const LightAnimationBlockSchema = z.object({
  sourceStartMs: z.number().optional(),
  sourceDurationMs: z.number().min(0).optional(),
  id: z.string(),
  label: z.string(),
  targetLightId: z.string().optional(),
  property: z.enum(['position', 'intensity', 'temperature', 'ambience', 'color', 'angle', 'penumbra']).optional(),
  startMs: z.number().min(0),
  durationMs: z.number().min(50),
  fromX: z.number(),
  fromY: z.number(),
  toX: z.number(),
  toY: z.number(),
  fromZ: z.number().optional(),
  toZ: z.number().optional(),
  fromIntensity: z.number(),
  toIntensity: z.number(),
  fromColor: z.string().optional(),
  toColor: z.string().optional(),
  fromTemperature: z.number().min(1000).max(15000).optional(),
  toTemperature: z.number().min(1000).max(15000).optional(),
  fromAngle: z.number().optional(),
  toAngle: z.number().optional(),
  fromPenumbra: z.number().min(0).max(1).optional(),
  toPenumbra: z.number().min(0).max(1).optional(),
  holdBefore: z.boolean().optional(),
  easing: EasingSchema,
});

export const EffectKeySchema = z.enum([
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
]);

export const SceneEffectAnimationBlockSchema = z.object({
  sourceStartMs: z.number().optional(),
  sourceDurationMs: z.number().min(0).optional(),
  id: z.string(),
  label: z.string(),
  effectKey: EffectKeySchema,
  startMs: z.number().min(0),
  durationMs: z.number().min(50),
  fromValue: z.number(),
  toValue: z.number(),
  easing: EasingSchema,
});

export const FocusBlockSchema = z.object({
  sourceStartMs: z.number().optional(),
  sourceDurationMs: z.number().min(0).optional(),
  id: z.string(),
  label: z.string().optional(),
  startMs: z.number().min(0),
  durationMs: z.number().min(10),
  fromZ: z.number(),
  toZ: z.number(),
  easing: EasingSchema,
});

export const ShotSchema = z.object({
  id: z.string(),
  isPlaceholder: z.boolean().optional(),
  name: z.string(),
  startMs: z.number().min(0),
  durationMs: z.number().min(200),
  lane: z.number().int().min(0).max(7),
  /** When true (default), inherit project.background. When false, use shot.background. */
  useProjectBackground: z.boolean().optional(),
  background: BackgroundSchema.optional(),
  layers: z.array(LayerSchema),
  groups: z.array(GroupSchema),
  framings: z.array(FramingSchema),
  cameraBlocks: z.array(CameraBlockSchema),
  focusBlocks: z.array(FocusBlockSchema).optional(),
  lightBlocks: z.array(LightAnimationBlockSchema).optional(),
  effectBlocks: z.array(SceneEffectAnimationBlockSchema).optional(),
  light: z.object({
    position: Vec3Schema,
    target: Vec3Schema.optional(),
    intensity: z.number().min(0),
    temperature: z.number().min(1000).max(15000),
    ambience: z.number().min(0).max(1),
    ambientColor: z.string().optional(),
    environment: z.enum(['studio', 'softbox', 'strip-light', 'daylight', 'night-city', 'warehouse', 'custom']).optional(),
    shadowStrength: z.number().min(0).max(1).optional(),
    shadowSoftness: z.number().min(0).max(100).optional(),
    keyLightEnabled: z.boolean().optional(),
    keyIntensity: z.number().min(0).optional(),
    fillEnabled: z.boolean().optional(),
    fillIntensity: z.number().min(0).max(1).optional(),
    toneMapping: z.enum(['none', 'neutral']).optional(),
    castShadow: z.boolean().optional(),
    showGizmos: z.boolean().optional(),
    sources: z.array(z.object({
      id: z.string(),
      name: z.string(),
      type: z.enum(['directional', 'point', 'spot', 'area', 'ambient']),
      enabled: z.boolean(),
      position: Vec3Schema,
      target: Vec3Schema.optional(),
      rotation: Vec3Schema.optional(),
      intensity: z.number().min(0),
      color: z.string(),
      temperature: z.number().min(1000).max(15000).optional(),
      distance: z.number().optional(),
      decay: z.number().optional(),
      angle: z.number().optional(),
      penumbra: z.number().min(0).max(1).optional(),
      width: z.number().optional(),
      height: z.number().optional(),
      castShadow: z.boolean().optional(),
      shadowStrength: z.number().min(0).max(1).optional(),
      shadowSoftness: z.number().min(0).max(100).optional(),
    })).optional(),
  }),
  effects: z.object({
    depthOfField: z.object({
      enabled: z.boolean(),
      target: Vec3Schema,
      focusRange: z.number().min(0).max(20),
      aperture: z.number().min(0.1).max(32),
      bokehScale: z.number().min(0).max(20),
      bokehShape: z.enum(['anamorphic', 'spherical', 'vintage', 'portrait']),
      focalLength: z.number().optional(),
      highlightThreshold: z.number().optional(),
      highlightIntensity: z.number().optional(),
    }),
    bloom: z.object({
      enabled: z.boolean(),
      intensity: z.number().min(0).max(4),
      threshold: z.number().min(0).max(4),
    }),
    vignette: z.object({
      enabled: z.boolean(),
      intensity: z.number().min(0).max(1),
    }),
    motionBlur: z.object({
      enabled: z.boolean(),
      shutterAngle: z.number().min(0).max(360),
      samples: z.number().int().min(2).max(32).optional(),
    }),
    chromaticAberration: z.object({
      enabled: z.boolean(),
      offset: z.number().min(0).max(0.1),
    }),
    filmGrain: z.object({
      enabled: z.boolean(),
      intensity: z.number().min(0).max(1),
      size: z.number().min(0.1).max(32),
    }),
    ghost: z.object({
      enabled: z.boolean(),
      opacity: z.number().min(0).max(1),
      offset: z.number().min(-1).max(1),
      blur: z.number().min(0).max(100),
    }),
    colorGrade: z.object({
      enabled: z.boolean(),
      exposure: z.number().min(-4).max(4),
      contrast: z.number().min(0).max(4),
      saturation: z.number().min(0).max(4),
      temperature: z.number().min(-4).max(4).optional(),
      tint: z.number().min(-4).max(4).optional(),
    }),
    edgeFade: z.object({
      enabled: z.boolean(),
      top: z.number().min(0).max(1),
      bottom: z.number().min(0).max(1),
      left: z.number().min(0).max(1).optional(),
      right: z.number().min(0).max(1).optional(),
    }),
    glitch: z.object({
      enabled: z.boolean(),
      intensity: z.number().min(0).max(1),
    }),
  }),
  effectsOrder: z.array(EffectKeySchema),
  appliedEffects: z.array(EffectKeySchema).optional(),
  transition: z.object({
    type: z.enum(['cut', 'crossfade', 'push', 'slide']),
    durationMs: z.number().min(0),
    easing: EasingSchema,
  }),
});

export const AudioClipSchema = z.object({
  id: z.string(),
  name: z.string(),
  assetId: z.string().optional(),
  dataUrl: z.string().optional(),
  startMs: z.number().min(0),
  durationMs: z.number().min(0),
  offsetMs: z.number().min(0),
  volume: z.number().min(0).max(1),
  muted: z.boolean(),
});

export const ProjectAudioSchema = z.object({
  clips: z.array(AudioClipSchema),
  muted: z.boolean(),
  masterVolume: z.number().min(0).max(1),
});

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.number().optional(),
  schemaVersion: z.number().optional(),
  updatedAt: z.string(),
  createdAt: z.string().optional(),
  aspectRatio: z.enum([
    '16:9',
    '4:3',
    '3:2',
    '21:9',
    '1:1',
    '9:16',
    '3:4',
    '2:3',
    '4:5',
  ]),
  fps: z.union([z.literal(24), z.literal(30), z.literal(60)]),
  background: BackgroundSchema,
  defaultCamera: z
    .object({
      position: Vec3Schema,
      rotation: Vec3Schema,
      focalLength: z.number(),
    })
    .optional(),
  assets: z.record(
    z.string(),
    z.object({
      id: z.string(),
      name: z.string(),
      mimeType: z.string(),
      dataUrl: z.string().default(''),
      thumbUrl: z.string().optional(),
      width: z.number(),
      height: z.number(),
    })
  ),
  shots: z.array(ShotSchema),
  audio: ProjectAudioSchema.optional(),
});

export type ValidationResult =
  | { success: true; data: Project; project: Project }
  | { success: false; errors: string[] };

function migrateLegacyProject(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const project = structuredClone(raw) as Record<string, any>;

  if (project.assets && typeof project.assets === 'object') {
    for (const asset of Object.values(project.assets)) {
      if (asset && typeof asset === 'object' && !('dataUrl' in asset)) {
        (asset as { dataUrl?: string }).dataUrl = '';
      }
    }
  }

  if (project.version == null && project.schemaVersion != null) {
    project.version = project.schemaVersion;
  }
  if (project.schemaVersion == null && project.version != null) {
    project.schemaVersion = project.version;
  }

  const schemaVer = project.schemaVersion ?? project.version ?? 1;
  if (schemaVer < 2) {
    if (Array.isArray(project.shots)) {
      for (const shot of project.shots) {
        if (Array.isArray(shot.framings)) {
          for (const f of shot.framings) {
            if (f && f.target) {
              if (typeof f.target.x === 'number') {
                f.target.x = Math.round(f.target.x * 1920);
              }
              if (typeof f.target.y === 'number') {
                f.target.y = Math.round(-f.target.y * 1080);
              }
            }
          }
        }
        if (Array.isArray(shot.cameraBlocks)) {
          for (const cb of shot.cameraBlocks) {
            if (cb.from) {
              if (typeof cb.from.anchorX === 'number') {
                cb.from.anchorX = Math.round(cb.from.anchorX * 1920);
              }
              if (typeof cb.from.anchorY === 'number') {
                cb.from.anchorY = Math.round(-cb.from.anchorY * 1080);
              }
            }
            if (cb.to) {
              if (typeof cb.to.anchorX === 'number') {
                cb.to.anchorX = Math.round(cb.to.anchorX * 1920);
              }
              if (typeof cb.to.anchorY === 'number') {
                cb.to.anchorY = Math.round(-cb.to.anchorY * 1080);
              }
            }
          }
        }
      }
    }
    project.schemaVersion = 2;
    project.version = 2;
  }

  if (Array.isArray(project.shots)) {
    for (const shot of project.shots) {
      if (typeof shot.durationMs === 'number') {
        shot.durationMs = Math.max(200, shot.durationMs);
      }

      if (Array.isArray(shot.cameraBlocks)) {
        for (const cb of shot.cameraBlocks) {
          if (typeof cb.durationMs === 'number') {
            cb.durationMs = Math.max(50, cb.durationMs);
          }
        }
      }

      if (Array.isArray(shot.focusBlocks)) {
        for (const fb of shot.focusBlocks) {
          if (typeof fb.durationMs === 'number') {
            fb.durationMs = Math.max(10, fb.durationMs);
          }
        }
      }

      if (Array.isArray(shot.effectBlocks)) {
        for (const eb of shot.effectBlocks) {
          if (typeof eb.durationMs === 'number') {
            eb.durationMs = Math.max(50, eb.durationMs);
          }
        }
      }

      if (Array.isArray(shot.lightBlocks)) {
        for (const lb of shot.lightBlocks) {
          if (typeof lb.durationMs === 'number') {
            lb.durationMs = Math.max(50, lb.durationMs);
          }
        }
      }

      if (Array.isArray(shot.layers)) {
        for (const layer of shot.layers) {
          if (layer.entrance && layer.entrance.type === 'slide') {
            layer.entrance.type = 'slide-up';
          }
          if (layer.exit && layer.exit.type === 'slide') {
            layer.exit.type = 'slide-right';
          }
          if (Array.isArray(layer.entrances)) {
            for (const ent of layer.entrances) {
              if (ent && ent.type === 'slide') {
                ent.type = 'slide-up';
              }
            }
          }
          if (Array.isArray(layer.exits)) {
            for (const ex of layer.exits) {
              if (ex && ex.type === 'slide') {
                ex.type = 'slide-right';
              }
            }
          }

          if (Array.isArray(layer.blocks)) {
            for (const blk of layer.blocks) {
              if (typeof blk.durationMs === 'number') {
                blk.durationMs = Math.max(10, blk.durationMs);
              }
            }
          }
        }
      }
    }
  }

  if (Array.isArray(project.shots)) {
    for (const shot of project.shots) {
      if (Array.isArray(shot.groups)) {
        for (const g of shot.groups) {
          if (g && typeof g === 'object') {
            if (g.collapsed === undefined) g.collapsed = false;
            if (g.hidden === undefined) g.hidden = false;
            if (g.locked === undefined) g.locked = false;
          }
        }
      }
    }
  }

  return project;
}

/**
 * Enforces unique entity IDs and repairs dangling references (groups, parent groups, mask layers, and missing assets).
 */
export function repairProjectReferentialIntegrity(project: Project): Project {
  const seenIds = new Set<string>();
  let idCounter = 1;

  const ensureUniqueId = (id: string | undefined, prefix: string): string => {
    let candidate = id && typeof id === 'string' && id.trim().length > 0 ? id.trim() : `${prefix}-${idCounter++}`;
    while (seenIds.has(candidate)) {
      candidate = `${prefix}-${Date.now().toString(36)}-${idCounter++}`;
    }
    seenIds.add(candidate);
    return candidate;
  };

  // 1. Deduplicate Shot and Asset IDs
  const shots = (project.shots || []).map((shot) => ({
    ...shot,
    id: ensureUniqueId(shot.id, 'shot'),
  }));

  const assets: Project['assets'] = {};
  for (const [key, asset] of Object.entries(project.assets || {})) {
    if (!asset) continue;
    const uniqueAssetId = ensureUniqueId(asset.id || key, 'asset');
    assets[uniqueAssetId] = {
      ...asset,
      id: uniqueAssetId,
    };
  }

  // 2. Deduplicate IDs and repair references in each Shot
  const repairedShots = shots.map((shot) => {
    const groupRemap = new Map<string, string>();
    const rawGroups = (shot.groups || []).map((g) => {
      const origId = g.id;
      const uniqueId = ensureUniqueId(g.id, 'grp');
      if (origId && origId !== uniqueId) groupRemap.set(origId, uniqueId);
      return { ...g, id: uniqueId };
    });

    const groupsWithRemappedParents = rawGroups.map((g) => ({
      ...g,
      parentGroupId: g.parentGroupId ? groupRemap.get(g.parentGroupId) ?? g.parentGroupId : undefined,
    }));

    const validGroupIds = new Set(groupsWithRemappedParents.map((g) => g.id));
    const repairedGroups = groupsWithRemappedParents.map((g) => {
      let parentGroupId = g.parentGroupId;
      if (parentGroupId && (!validGroupIds.has(parentGroupId) || parentGroupId === g.id)) {
        parentGroupId = undefined;
      }
      // Break cycle loops in parent chains
      if (parentGroupId) {
        let curr: string | undefined = parentGroupId;
        const chain = new Set<string>([g.id]);
        while (curr) {
          if (chain.has(curr)) {
            parentGroupId = undefined;
            break;
          }
          chain.add(curr);
          curr = groupsWithRemappedParents.find((x) => x.id === curr)?.parentGroupId;
        }
      }
      return { ...g, parentGroupId };
    });

    const cameraBlocks = (shot.cameraBlocks || []).map((cb) => ({
      ...cb,
      id: ensureUniqueId(cb.id, 'cam'),
    }));
    const lightBlocks = (shot.lightBlocks || []).map((lb) => ({
      ...lb,
      id: ensureUniqueId(lb.id, 'light'),
    }));
    const effectBlocks = (shot.effectBlocks || []).map((eb) => ({
      ...eb,
      id: ensureUniqueId(eb.id, 'eff'),
    }));

    const layerRemap = new Map<string, string>();
    const rawLayers = (shot.layers || []).map((l) => {
      const origId = l.id;
      const uniqueId = ensureUniqueId(l.id, `layer-${l.kind || 'elem'}`);
      if (origId && origId !== uniqueId) layerRemap.set(origId, uniqueId);

      const blocks = (l.blocks || []).map((b) => ({
        ...b,
        id: ensureUniqueId(b.id, 'blk'),
      }));

      return {
        ...l,
        id: uniqueId,
        blocks,
      };
    });

    const validLayerIds = new Set(rawLayers.map((l) => l.id));
    const repairedLayers = rawLayers.map((l) => {
      let groupId = l.groupId ? groupRemap.get(l.groupId) ?? l.groupId : undefined;
      if (groupId && !validGroupIds.has(groupId)) {
        groupId = undefined;
      }

      let maskLayerId = l.maskLayerId ? layerRemap.get(l.maskLayerId) ?? l.maskLayerId : undefined;
      if (maskLayerId && (!validLayerIds.has(maskLayerId) || maskLayerId === l.id)) {
        maskLayerId = undefined;
      }

      // If an image or video layer references an asset not yet in assets, supply a safe fallback stub
      if ((l.kind === 'image' || l.kind === 'video') && 'assetId' in l && l.assetId) {
        const assetId = l.assetId;
        if (!assets[assetId]) {
          assets[assetId] = {
            id: assetId,
            name: l.name || 'Imported media',
            mimeType: l.kind === 'video' ? 'video/mp4' : 'image/png',
            dataUrl: '',
            width: 1920,
            height: 1080,
          };
        }
      }

      return {
        ...l,
        groupId,
        maskLayerId,
      };
    });

    return {
      ...shot,
      groups: repairedGroups,
      cameraBlocks,
      lightBlocks,
      effectBlocks,
      layers: repairedLayers,
    };
  });

  const audioClips = (project.audio?.clips || []).map((c) => ({
    ...c,
    id: ensureUniqueId(c.id, 'audio'),
  }));

  return {
    ...project,
    shots: repairedShots,
    assets,
    audio: project.audio
      ? {
          ...project.audio,
          clips: audioClips,
        }
      : undefined,
  };
}

export function validateProject(raw: unknown): ValidationResult {
  const migrated = migrateLegacyProject(raw);
  const parsed = ProjectSchema.safeParse(migrated);
  if (parsed.success) {
    const repaired = repairProjectReferentialIntegrity(parsed.data as Project);
    return { success: true, data: repaired, project: repaired };
  }
  const errors = parsed.error.issues.map(
    (issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`
  );
  return { success: false, errors };
}





