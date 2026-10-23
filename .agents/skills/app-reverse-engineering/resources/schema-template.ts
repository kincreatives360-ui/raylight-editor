export type EasingType = 'linear' | 'easeInQuad' | 'easeOutCubic' | 'spring';

export interface Keyframe<T = number> {
  id: string;
  timeMs: number;
  value: T;
  easing: EasingType;
  springConfig?: { stiffness: number; damping: number; mass: number };
}

export interface AnimatableProperty<T = number> {
  baseValue: T;
  keyframes: Keyframe<T>[];
}

export interface SceneNode {
  id: string;
  name: string;
  type: 'shape' | 'text' | 'video' | 'group';
  parentId: string | null;
  startTimeMs: number;
  durationMs: number;
  transform: {
    x: AnimatableProperty<number>;
    y: AnimatableProperty<number>;
    scaleX: AnimatableProperty<number>;
    scaleY: AnimatableProperty<number>;
    rotationDeg: AnimatableProperty<number>;
    opacity: AnimatableProperty<number>;
  };
}

export interface ProjectState {
  id: string;
  fps: number;
  width: number;
  height: number;
  durationMs: number;
  nodes: Record<string, SceneNode>;
  rootNodeIds: string[];
}