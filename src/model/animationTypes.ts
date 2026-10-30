import type { PresetEasingName, AnimationBlockProperty } from './schema';
import type { Vec3, Size2D } from './commonTypes';

export type SpringEasingName = 'gentle' | 'quick' | 'bouncy' | 'slow' | 'snappy' | 'stiff';

export interface SpringConfig {
  stiffness?: number;
  damping?: number;
  mass?: number;
}

export type Easing =
  | { kind: 'preset'; name: PresetEasingName }
  | { kind: 'spring'; name: SpringEasingName; config?: SpringConfig }
  | { kind: 'bezier'; x1: number; y1: number; x2: number; y2: number };

export type TransitionType =
  | 'none'
  | 'fade'
  | 'slide-up'
  | 'slide-down'
  | 'slide-left'
  | 'slide-right'
  | 'float-out'
  | 'scale-out'
  | 'mask-sweep'
  | 'wipe'
  | 'blur'
  | 'focus'
  | 'rack-focus'
  | 'pop'
  | 'spin'
  | 'flip-x'
  | 'flip-y'
  | 'swing'
  | 'typewriter'
  | 'scramble';

export interface Transitionish {
  enabled?: boolean;
  blur?: number;
  fade?: boolean;
  stagger?: 'none' | 'letter' | 'word' | 'line';
  type: TransitionType;
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
