import type { Vec3 } from './commonTypes';

export type FocusMode = 'manual' | 'click' | 'target';
export type SensorFormat = 'full-frame' | 'super-35' | 'micro-four-thirds';
export type BokehQuality = 'low' | 'medium' | 'high';
export type BokehShape = 'circular' | 'bladed' | 'anamorphic';

export interface CameraOptics {
  enabled: boolean;
  focusMode: FocusMode;
  focusDistance: number;      // Distance in scene metres (e.g. 2.65)
  targetObjectId?: string;    // Layer ID for auto-tracking
  targetAnchor?: Vec3;        // Relative offset from target center
  focalLength: number;        // Lens focal length in mm (default 50)
  aperture: number;           // f-number (default 2.8; e.g. 1.4, 1.8, 2.8, 4.0, 5.6, 8.0, 11, 16)
  sensorFormat: SensorFormat; // Physical sensor dimension for CoC scale
  focusRange?: number;        // Custom acceptable sharpness zone override
  bokehQuality: BokehQuality; // Kernel sample count (low: 16, med: 32, high: 64)
  bokehShape: BokehShape;     // Optical aperture blade simulation
  showFocusPlane: boolean;    // Viewport visualization overlay toggle
}

export const DEFAULT_CAMERA_OPTICS: CameraOptics = {
  enabled: false,
  focusMode: 'manual',
  focusDistance: 2.65,
  focalLength: 50,
  aperture: 2.8,
  sensorFormat: 'full-frame',
  bokehQuality: 'medium',
  bokehShape: 'circular',
  showFocusPlane: false,
};

export const SENSOR_HEIGHTS_MM: Record<SensorFormat, number> = {
  'full-frame': 24.0,
  'super-35': 18.0,
  'micro-four-thirds': 13.0,
};

export const F_STOP_PRESETS = [1.4, 1.8, 2.8, 4.0, 5.6, 8.0, 11.0, 16.0];
export const FOCAL_LENGTH_PRESETS = [
  { label: '24mm Wide', value: 24 },
  { label: '35mm Street', value: 35 },
  { label: '50mm Natural', value: 50 },
  { label: '85mm Portrait', value: 85 },
  { label: '135mm Tele', value: 135 },
];
