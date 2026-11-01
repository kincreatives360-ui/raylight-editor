import type { Vec3, Size2D } from './commonTypes';
import type {
  AnimationBlockProperty,
  SpringEasingName,
  PresetEasingName,
  TransitionType,
  Easing,
  isVectorProperty,
  isScalarProperty,
  VECTOR_PROPERTIES,
  SCALAR_PROPERTIES,
} from './enums';

export interface AnimationBlockSettings {
  targetPosition?: Vec3;
  targetScale?: Vec3;
  targetSize?: Size2D;
  color?: string;
  intensity?: number;
  width?: number;
  direction?: 'left' | 'right' | 'up' | 'down';
  text?: string;
}

export interface AnimationBlock {
  enabled?: boolean;
  settings?: AnimationBlockSettings;
  id: string;
  label: string;
  property: AnimationBlockProperty;
  startMs: number;
  durationMs: number;
  easing: Easing;
  amount: Vec3 | number;
}
