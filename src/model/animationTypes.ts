import type { Vec3, Size2D } from './commonTypes';
import type { AnimationBlockProperty, Easing, TransitionType } from './enums';
export type {
  AnimationBlockProperty,
  Easing,
  PresetEasingName,
  SpringConfig,
  SpringEasingName,
  TransitionType,
} from './enums';

export interface Transitionish {
  enabled?: boolean;
  blur?: number;
  fade?: boolean;
  stagger?: 'none' | 'letter' | 'word' | 'line';
  type: TransitionType;
  direction?: 'left' | 'right' | 'up' | 'down';
  durationMs: number;
  delayMs: number;
  distance: number;
  easing: Easing;
}

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
