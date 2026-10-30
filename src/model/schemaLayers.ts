import { z } from 'zod';
import {
  AnimationBlockSchema,
  DeviceFrameSettingsSchema,
  FillSchema,
  LayerEffectsSchema,
  Size2DSchema,
  TransitionishSchema,
  Vec3Schema,
} from './schemaPrimitives';

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

