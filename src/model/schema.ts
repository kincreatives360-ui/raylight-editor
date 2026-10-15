// src/model/schema.ts
import { z } from 'zod';
import type { Project } from './types';
import { CURRENT_SCHEMA_VERSION } from './defaults';

export const Vec3Schema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  z: z.number().finite(),
});

export const AspectRatioSchema = z.enum([
  '16:9',
  '4:3',
  '3:2',
  '21:9',
  '1:1',
  '9:16',
  '3:4',
  '2:3',
  '4:5',
]);

export const BlendModeSchema = z.enum([
  'normal',
  'darken',
  'multiply',
  'lighten',
  'screen',
  'add',
  'difference',
]);

export const FillSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('solid'),
    color: z.string().min(1),
    opacity: z.number().min(0).max(1),
  }),
  z.object({
    kind: z.literal('gradient'),
    angle: z.number(),
    stops: z
      .array(
        z.object({
          at: z.number().min(0).max(1),
          color: z.string().min(1),
        })
      )
      .min(2),
  }),
]);

export const StrokeSchema = z.object({
  color: z.string().min(1),
  width: z.number().min(0),
  opacity: z.number().min(0).max(1),
});

export const ShadowSchema = z.object({
  enabled: z.boolean(),
  color: z.string().min(1),
  opacity: z.number().min(0).max(1),
  blur: z.number().min(0),
  offsetX: z.number(),
  offsetY: z.number(),
});

export const GlowSchema = z.object({
  enabled: z.boolean(),
  color: z.string().min(1),
  intensity: z.number().min(0),
  radius: z.number().min(0),
});

export const GroupSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  parentGroupId: z.string().optional(),
  collapsed: z.boolean(),
  hidden: z.boolean(),
  locked: z.boolean(),
});

export const EasingSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('preset'),
    name: z.enum([
      'linear',
      'ease-in',
      'ease-out',
      'ease-in-out',
      'ease-in-expo',
      'ease-out-expo',
      'ease-in-back',
      'ease-out-back',
      'ease-in-out-back',
      'hold',
      'bounce',
    ]),
  }),
  z.object({
    kind: z.literal('spring'),
    name: z.enum(['gentle', 'quick', 'bouncy', 'slow']),
  }),
  z.object({
    kind: z.literal('bezier'),
    x1: z.number().min(0).max(1),
    y1: z.number(),
    x2: z.number().min(0).max(1),
    y2: z.number(),
  }),
]);

export const TransitionishSchema = z.object({
  id: z.string().optional(),
  type: z.enum([
    'none',
    'fade',
    'slide',
    'slide-up',
    'slide-down',
    'slide-left',
    'slide-right',
    'float-out',
    'scale-out',
    'mask-sweep',
  ]),
  durationMs: z.number().min(0),
  delayMs: z.number().min(0),
  easing: EasingSchema,
  distance: z.number().min(0),
  direction: z.enum(['up', 'down', 'left', 'right']).optional(),
});

export const AnimationBlockSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  property: z.enum([
    'position',
    'rotation',
    'tilt',
    'scale',
    'opacity',
    'size',
    'maskSweep',
    'shimmer',
    'followPath',
    'counter',
    'pathReveal',
    'glow',
  ]),
  startMs: z.number().min(0),
  durationMs: z.number().min(1),
  easing: EasingSchema,
  amount: z.union([Vec3Schema, z.number()]),
});

const LayerBaseSchemaObj = {
  id: z.string().min(1),
  name: z.string().min(1),
  hidden: z.boolean(),
  locked: z.boolean(),
  groupId: z.string().optional(),
  order: z.number().int().min(0),
  position: Vec3Schema,
  rotation: Vec3Schema,
  scale: Vec3Schema,
  opacity: z.number().min(0).max(1),
  blendMode: BlendModeSchema,
  inMs: z.number().min(0),
  outMs: z.number().min(0),
  entrance: TransitionishSchema,
  exit: TransitionishSchema,
  entrances: z.array(TransitionishSchema).optional(),
  exits: z.array(TransitionishSchema).optional(),
  blocks: z.array(AnimationBlockSchema),
  effects: z.object({
    dropShadow: ShadowSchema.optional(),
    glow: GlowSchema.optional(),
    layerBlur: z.number().min(0).optional(),
    backdropBlur: z.number().min(0).optional(),
  }),
};

export const ImageLayerSchema = z.object({
  ...LayerBaseSchemaObj,
  kind: z.literal('image'),
  assetId: z.string(),
  size: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
  }),
  crop: z
    .object({
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
      width: z.number().min(0).max(1),
      height: z.number().min(0).max(1),
    })
    .optional(),
  cornerRadius: z.number().min(0).max(1),
  stroke: StrokeSchema.optional(),
  device: z
    .object({
      type: z.enum(['iphone', 'ipad', 'macbook', 'browser']),
      color: z.enum(['silver', 'black']),
      gloss: z.number().min(0).max(1),
      lidAngle: z.number().optional(),
      screenGlow: z.number().min(0).max(1).optional(),
    })
    .optional(),
});

export const ShapeLayerSchema = z.object({
  ...LayerBaseSchemaObj,
  kind: z.literal('shape'),
  shape: z.enum(['rectangle', 'ellipse', 'line', 'arrow']),
  size: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
  }),
  fill: FillSchema,
  stroke: StrokeSchema.optional(),
  cornerRadius: z.number().min(0).max(1),
});

export const TextLayerSchema = z.object({
  ...LayerBaseSchemaObj,
  kind: z.literal('text'),
  content: z.string(),
  font: z.object({
    family: z.string().min(1),
    size: z.number().positive(),
    weight: z.number().int().min(100).max(900),
    color: z.string().min(1),
    align: z.enum(['left', 'center', 'right']),
    letterSpacing: z.number(),
  }),
  maxWidth: z.number().positive(),
  verticalAlign: z.enum(['top', 'middle', 'bottom']),
});

export const LayerSchema = z.discriminatedUnion('kind', [
  ImageLayerSchema,
  ShapeLayerSchema,
  TextLayerSchema,
]);

export const FramingSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  target: Vec3Schema,
  zoom: z.number().positive(),
});

export const CameraBlockSchema = z.object({
  id: z.string().min(1),
  label: z.string().optional(),
  startMs: z.number().min(0),
  durationMs: z.number().min(1),
  fromFramingId: z.string().min(1),
  toFramingId: z.string().min(1),
  mode: z.enum(['dolly', 'zoom', 'dollyzoom']),
  easing: EasingSchema,
});

export const FocusBlockSchema = z.object({
  id: z.string().min(1),
  label: z.string().optional(),
  startMs: z.number().min(0),
  durationMs: z.number().min(1),
  fromZ: z.number(),
  toZ: z.number(),
  easing: EasingSchema,
});

export const EffectsSchema = z.object({
  depthOfField: z.object({
    enabled: z.boolean(),
    target: Vec3Schema,
    focusRange: z.number().min(0),
    aperture: z.number().min(0),
    bokehScale: z.number().min(0),
    bokehShape: z.enum(['spherical', 'anamorphic', 'vintage', 'portrait']),
    focalLength: z.number().positive(),
    highlightThreshold: z.number().min(0).max(1),
    highlightIntensity: z.number().min(0),
  }),
  bloom: z.object({
    enabled: z.boolean(),
    intensity: z.number().min(0),
    threshold: z.number().min(0).max(1),
  }),
  vignette: z.object({
    enabled: z.boolean(),
    intensity: z.number().min(0).max(1),
  }),
  motionBlur: z.object({
    enabled: z.boolean(),
    samples: z.number().int().min(1).max(64),
    shutterAngle: z.number().min(0).max(360),
  }),
  chromaticAberration: z.object({
    enabled: z.boolean(),
    offset: z.number().min(0),
  }),
  filmGrain: z.object({
    enabled: z.boolean(),
    intensity: z.number().min(0).max(1),
    size: z.number().positive(),
  }),
  ghost: z.object({
    enabled: z.boolean(),
    opacity: z.number().min(0).max(1),
    offset: z.number(),
    blur: z.number().min(0),
  }),
  colorGrade: z.object({
    enabled: z.boolean(),
    exposure: z.number().min(0),
    contrast: z.number().min(0),
    saturation: z.number().min(0),
  }),
  edgeFade: z.object({
    enabled: z.boolean(),
    top: z.number().min(0).max(1),
    right: z.number().min(0).max(1),
    bottom: z.number().min(0).max(1),
    left: z.number().min(0).max(1),
  }),
  glitch: z.object({
    enabled: z.boolean(),
    intensity: z.number().min(0).max(1),
  }),
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

export const ShotSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  startMs: z.number().min(0),
  durationMs: z.number().min(100),
  lane: z.number().int().min(0).max(7),
  layers: z.array(LayerSchema),
  groups: z.array(GroupSchema),
  framings: z.array(FramingSchema),
  cameraBlocks: z.array(CameraBlockSchema),
  focusBlocks: z.array(FocusBlockSchema).optional().default([]),
  transition: z.object({
    type: z.enum(['cut', 'crossfade', 'push', 'slide']),
    durationMs: z.number().min(0),
    easing: EasingSchema,
  }),
  light: z.object({
    position: Vec3Schema,
    intensity: z.number().min(0),
    temperature: z.number().min(1000).max(15000),
    ambience: z.number().min(0).max(1),
  }),
  effects: EffectsSchema,
  effectsOrder: z.array(EffectKeySchema),
});

export const AssetRecordSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  mimeType: z.string().min(1),
  dataUrl: z.string(),
  thumbUrl: z.string().optional(),
  width: z.number().positive(),
  height: z.number().positive(),
});

export const AudioClipSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  assetId: z.string().optional(),
  dataUrl: z.string().optional(),
  startMs: z.number().min(0),
  durationMs: z.number().min(10),
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
  schemaVersion: z.number().int().min(1),
  id: z.string().min(1),
  name: z.string().min(1),
  aspectRatio: AspectRatioSchema,
  fps: z.union([z.literal(30), z.literal(60)]),
  background: z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('solid'),
      color: z.string().min(1),
    }),
    z.object({
      kind: z.literal('gradient'),
      angle: z.number(),
      stops: z
        .array(
          z.object({
            at: z.number().min(0).max(1),
            color: z.string().min(1),
          })
        )
        .min(2),
    }),
  ]),
  defaultCamera: z.object({
    position: Vec3Schema,
    rotation: Vec3Schema,
    focalLength: z.number().positive(),
  }),
  shots: z.array(ShotSchema).min(1),
  assets: z.record(z.string(), AssetRecordSchema),
  audio: ProjectAudioSchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ValidationResult =
  | { success: true; data: Project }
  | { success: false; errors: string[] };

// Upgrades older project files to the current schemaVersion before validating
export function migrateProject(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const copy = { ...(raw as Record<string, unknown>) };

  if (typeof copy.schemaVersion !== 'number') {
    copy.schemaVersion = CURRENT_SCHEMA_VERSION;
  }
  if (!copy.assets || typeof copy.assets !== 'object') {
    copy.assets = {};
  }
  return copy;
}

// Validates any unknown JSON object against the strict Raylight Project Schema
export function validateProject(rawInput: unknown): ValidationResult {
  const migrated = migrateProject(rawInput);
  const parsed = ProjectSchema.safeParse(migrated);

  if (parsed.success) {
    return { success: true, data: parsed.data as Project };
  }

  const friendlyErrors = parsed.error.issues.map((issue) => {
    const pathStr = issue.path.length > 0 ? issue.path.join(' -> ') : 'Project Root';
    return `[${pathStr}]: ${issue.message}`;
  });

  return {
    success: false,
    errors: friendlyErrors,
  };
}