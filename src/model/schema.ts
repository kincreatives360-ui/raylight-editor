// src/model/schema.ts
import { z } from 'zod';
import type { Project } from './types';

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

export const GradientStopSchema = z.object({
  at: z.number().min(0).max(1),
  color: z.string(),
  opacity: z.number().min(0).max(1).optional(),
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
    gradientType: z.enum(['linear', 'radial']).optional(),
  }),
]);

export const ShaderPresetSchema = z.enum([
  'silk',
  'undertones',
  'mosaic',
  'meshGradient',
  'warp',
  'grainGradient',
  'prism',
  'halo',
  'shift',
  'lineScreen',
  'dotMatrix',
  'watercolor',
  'voxels',
]);

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
]);

export const TransitionishSchema = z.object({
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
]);

export type AnimationBlockProperty = z.infer<typeof AnimationBlockPropertySchema>;

export const AnimationBlockSchema = z.object({
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
      blur: z.number().min(0),
      offsetX: z.number(),
      offsetY: z.number(),
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
  layerBlur: z.number().min(0).optional(),
  backdropBlur: z.number().min(0).optional(),
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
  device: z
    .object({
      type: z.enum(['iphone', 'ipad', 'macbook', 'browser', 'samsung-galaxy', 'display']),
      color: z.enum(['silver', 'black', 'space-black', 'titanium', 'midnight']),
      gloss: z.number().min(0).max(1),
      lidAngle: z.number().optional(),
      screenGlow: z.number().optional(),
      glare: z.number().optional(),
    })
    .optional(),
});

export const ShapeLayerSchema = LayerBaseSchema.extend({
  kind: z.literal('shape'),
  shape: z.enum(['rectangle', 'ellipse', 'line', 'arrow', 'polygon']),
  points: z.array(z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) })).optional(),
  size: Size2DSchema,
  cornerRadius: z.number().min(0).max(0.5),
  fill: FillSchema,
  stroke: z
    .object({
      color: z.string(),
      width: z.number(),
      opacity: z.number(),
    })
    .optional(),
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
  anchorX: z.number(),
  anchorY: z.number(),
  zoom: z.number().min(0.1).max(10),
  roll: z.number(),
  orbit: z.number(),
  tilt: z.number(),
});

export const CameraBlockSchema = z.object({
  id: z.string(),
  label: z.string().optional(),
  startMs: z.number().min(0),
  durationMs: z.number().min(50),
  fromFramingId: z.string(),
  toFramingId: z.string(),
  mode: z.enum(['dolly', 'zoom', 'dollyzoom']),
  easing: EasingSchema,
  from: CameraKeyframeEndpointSchema.optional(),
  to: CameraKeyframeEndpointSchema.optional(),
  shake: z
    .object({
      from: z.number().min(0).max(100),
      to: z.number().min(0).max(100),
    })
    .optional(),
});

export const LightAnimationBlockSchema = z.object({
  id: z.string(),
  label: z.string(),
  targetLightId: z.string().optional(),
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
    intensity: z.number().min(0),
    temperature: z.number().min(1000).max(15000),
    ambience: z.number().min(0).max(1),
    ambientColor: z.string().optional(),
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
    })).optional(),
  }),
  effects: z.object({
    depthOfField: z.object({
      enabled: z.boolean(),
      target: Vec3Schema,
      focusRange: z.number(),
      aperture: z.number(),
      bokehScale: z.number(),
      bokehShape: z.enum(['anamorphic', 'spherical', 'vintage', 'portrait']),
      focalLength: z.number().optional(),
      highlightThreshold: z.number().optional(),
      highlightIntensity: z.number().optional(),
    }),
    bloom: z.object({
      enabled: z.boolean(),
      intensity: z.number(),
      threshold: z.number(),
    }),
    vignette: z.object({
      enabled: z.boolean(),
      intensity: z.number(),
    }),
    motionBlur: z.object({
      enabled: z.boolean(),
      shutterAngle: z.number(),
      samples: z.number().optional(),
    }),
    chromaticAberration: z.object({
      enabled: z.boolean(),
      offset: z.number(),
    }),
    filmGrain: z.object({
      enabled: z.boolean(),
      intensity: z.number(),
      size: z.number(),
    }),
    ghost: z.object({
      enabled: z.boolean(),
      opacity: z.number(),
      offset: z.number(),
      blur: z.number(),
    }),
    colorGrade: z.object({
      enabled: z.boolean(),
      exposure: z.number(),
      contrast: z.number(),
      saturation: z.number(),
    }),
    edgeFade: z.object({
      enabled: z.boolean(),
      top: z.number(),
      bottom: z.number(),
      left: z.number().optional(),
      right: z.number().optional(),
    }),
    glitch: z.object({
      enabled: z.boolean(),
      intensity: z.number(),
    }),
  }),
  effectsOrder: z.array(EffectKeySchema),
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
      dataUrl: z.string(),
      thumbUrl: z.string().optional(),
      width: z.number(),
      height: z.number(),
    })
  ),
  shots: z.array(ShotSchema).min(1),
  audio: ProjectAudioSchema.optional(),
});

export type ValidationResult =
  | { success: true; data: Project }
  | { success: false; errors: string[] };

function migrateLegacyProject(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const project = JSON.parse(JSON.stringify(raw));

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

  return project;
}

export function validateProject(raw: unknown): ValidationResult {
  const migrated = migrateLegacyProject(raw);
  const parsed = ProjectSchema.safeParse(migrated);
  if (parsed.success) {
    return { success: true, data: parsed.data as Project };
  }
  const errors = parsed.error.issues.map(
    (issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`
  );
  return { success: false, errors };
}
