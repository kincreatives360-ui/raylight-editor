import { z } from 'zod';
import { BackgroundSchema, Vec3Schema } from './schemaPrimitives';
import { ShotSchema } from './shotSchemas';

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

