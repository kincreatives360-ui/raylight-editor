import type { PresetEasingName, AnimationBlockProperty } from './schema';
export type { PresetEasingName, AnimationBlockProperty };

export type AspectRatio =
  | '16:9'
  | '4:3'
  | '3:2'
  | '21:9'
  | '1:1'
  | '9:16'
  | '3:4'
  | '2:3'
  | '4:5';

export type BlendMode =
  | 'normal'
  | 'darken'
  | 'multiply'
  | 'lighten'
  | 'screen'
  | 'add'
  | 'difference';

export interface Vec2 {
  x: number;
  y: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Size2D {
  width: number;
  height: number;
}

export type ScreenFit = 'stretch' | 'contain' | 'cover';

export interface DeviceFrameSettings {
  /** Missing means the original media-shaped chassis. Never auto-upgrade saved frames. */
  geometryVersion?: 1;
  deviceId?: string;
  deviceScale?: number;
  family?: 'phone' | 'laptop' | 'tablet' | 'display';
  /** Preserves legacy placement height when replacing a nonuniform transform. */
  legacyHeightCompensation?: number;
  enabled: boolean;
  model: 'iphone-pro' | 'iphone' | 'iphone-classic';
  frameColor: string;
  finish?: string;
  frameRoughness: number;
  frameMetalness: number;
  scale: number;
  bezelWidth: number;
  thickness: number;
  cornerRadius: number;
  screenFit: ScreenFit;
  screenFillColor: string;
  screenPan?: { x: number; y: number };
  screenZoom?: number;
  hingeAngleDeg?: number;
  tiltAngleDeg?: number;
  glassTint: string;
  glassOpacity: number;
  glassRoughness: number;
  gloss: number;
  reflection: number;
  cutoutStyle: 'dynamic-island' | 'notch' | 'punch-hole' | 'none';
  cutoutWidth: number;
  cutoutHeight: number;
  showSideButtons: boolean;
  showRearCameras: boolean;
  shadowEnabled: boolean;
  shadowOpacity: number;
  shadowBlur: number;
  shadowOffset: number;
  /** Laptop lid opening angle in degrees (e.g. 70° to 140°, default 110°). */
  lidAngle?: number;
}

export interface GradientStop {
  at: number;
  color: string;
  opacity?: number;
}

export interface MeshGradientPoint {
  x: number;
  y: number;
  color: string;
  opacity: number;
}

export type Fill =
  | {
    kind: 'solid';
    color: string;
    opacity: number;
  }
  | {
    kind: 'gradient';
    angle: number;
    stops: GradientStop[];
    gradientType?: 'linear' | 'radial' | 'angular' | 'diamond' | 'mesh';
    mesh?: MeshGradientPoint[];
    handles?: {
      start: { x: number; y: number };
      end: { x: number; y: number };
      width?: number;
    };
  };

import type { ShaderPreset } from './backgroundPresets';
export type { ShaderPreset };

/**
 * Scene / stage background with full Raylight production parity.
 * - solid       → Solid color
 * - gradient    → Linear, radial, or angular (conic) multi-stop gradient with optional canvas handles
 * - noise       → Procedural film noise on base color
 * - shader      → 13 GPU-accelerated procedural fragment shaders
 * - image       → High-performance image with GPU mipmap Poisson blur, cover/contain fit & dimming
 * - transparent → Alpha transparency with dark studio checkerboard
 */
export type Background =
  | {
    kind: 'solid';
    color: string;
    opacity?: number;
  }
  | {
    kind: 'gradient';
    angle: number;
    stops: GradientStop[];
    source?: 'color' | 'shader';
    gradientType?: 'linear' | 'radial' | 'angular';
    handles?: {
      start: { x: number; y: number };
      end: { x: number; y: number };
      width?: number;
    };
  }
  | {
    kind: 'noise';
    baseColor: string;
    intensity: number;
  }
  | {
    kind: 'shader';
    preset: ShaderPreset;
    color: string;
    colors: string[];
    backgroundColor: string;
    speed: number;
    waves: number;
    focus: number;
    glow: number;
    shine: number;
    angle: number;
    noiseScale?: number;
    color1?: string;
    color2?: string;
    color3?: string;
    color4?: string;
  }
  | {
    kind: 'image';
    assetId?: string;
    src?: string;
    color?: string; // Backdrop letterbox fill color (default #000000)
    fit?: 'cover' | 'contain';
    dim?: number; // 0 to 1
    blur?: number; // 0 to 1 (or px)
    opacity?: number;
  }
  | {
    kind: 'transparent';
  };

/** Raylight.app-style quick color swatches (bottom row of the color picker). */
export const RAYLIGHT_COLOR_PALETTE: string[] = [
  '#f4f4f5', // white
  '#94a3b8', // slate
  '#6366f1', // indigo
  '#06b6d4', // cyan
  '#10b981', // emerald
  '#facc15', // yellow
  '#f59e0b', // amber
  '#f9a8d4', // pink
  '#ef4444', // red
];
