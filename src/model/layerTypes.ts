import type { Vec2, Vec3, Size2D, BlendMode, Fill, DeviceFrameSettings } from './commonTypes';
import type { AnimationBlock, Transitionish } from './animationTypes';
import type { LayerEffects } from './layerEffectTypes';

export interface LayerBase {
  id: string;
  name: string;
  order: number;
  groupId?: string;
  hidden: boolean;
  locked: boolean;
  inMs: number;
  outMs: number;
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
  opacity: number;
  blendMode: BlendMode;
  entrance: Transitionish;
  entrances?: (Transitionish & { id?: string })[];
  exit: Transitionish;
  exits?: (Transitionish & { id?: string })[];
  blocks: AnimationBlock[];
  effects: LayerEffects;
  /** Optional alpha-mask source layer ID. */
  maskLayerId?: string;
  /** When true, layer surface reacts to 3D scene lighting. Default false for text and true for images/video. */
  receivesLight?: boolean;
  /** Optional 3D surface material response */
  material?: {
    roughness?: number;
    metalness?: number;
  };
}

export interface ImageLayer extends LayerBase {
  kind: 'image';
  assetId: string;
  size: Size2D;
  cornerRadius: number;
  deviceFrame?: DeviceFrameSettings;
  crop?: { x: number; y: number; width: number; height: number };
  stroke?: { color: string; width: number; opacity: number };
}

export interface ShapeMask {
  enabled: boolean;
  shape: 'rectangle' | 'circle' | 'path';
  feather: number;
  opacity: number;
  grow: number;
  invert: boolean;
  show: boolean;
}

export interface ShapeLayer extends LayerBase {
  kind: 'shape';
  shape: 'rectangle' | 'ellipse' | 'line' | 'arrow' | 'polygon';
  /** Optional shape path points in normalized layer-local coordinates. */
  points?: Vec2[];
  /** Optional layer effects used by the canvas renderer. */
  size: Size2D;
  cornerRadius: number;
  fill: Fill;
  stroke?: {
    color: string;
    width: number;
    opacity: number;
    align?: 'inside' | 'center' | 'outside';
    style?: 'solid' | 'dashed' | 'dotted';
  };
  depth?: number;
  mask?: ShapeMask;
}

export interface TextLayer extends LayerBase {
  kind: 'text';
  content: string;
  maxWidth: number;
  verticalAlign?: 'top' | 'middle' | 'bottom';
  font: {
    family: string;
    size: number;
    weight: number;
    color: string;
    align: 'left' | 'center' | 'right';
    letterSpacing: number;
    lineHeight?: number;
  };
}

export interface VideoLayer extends LayerBase {
  kind: 'video';
  assetId: string;
  size: Size2D;
  cornerRadius: number;
  deviceFrame?: DeviceFrameSettings;
  crop?: { x: number; y: number; width: number; height: number };
  stroke?: { color: string; width: number; opacity: number };
}

export type Layer = ImageLayer | VideoLayer | ShapeLayer | TextLayer;

export interface Group {
  id: string;
  name: string;
  parentGroupId?: string;
  collapsed: boolean;
  hidden: boolean;
  locked: boolean;
  position?: Vec3;
  rotation?: Vec3;
  scale?: Vec3;
  opacity?: number;
  blocks?: AnimationBlock[];
}
