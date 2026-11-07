// src/engine/cameraOptics.ts
import * as THREE from 'three';
import { SENSOR_HEIGHT_MM } from './constants';
export { SENSOR_HEIGHT_MM };

export const DEFAULT_SCENE_SCALE = 250.0; // mm per 3D scene unit
export const BOKEH_SCALE_FACTOR = 0.05; // Base bokeh scale ratio relative to viewport height

export interface BokehShapeConfig {
  stretch: { x: number; y: number };
  catEye: number;
  rim: number;
  softness: number;
}

export type BokehShapeName = 'spherical' | 'anamorphic' | 'vintage' | 'portrait' | 'hexagonal' | 'octagonal';

export const BOKEH_SHAPES: Record<BokehShapeName, BokehShapeConfig> = {
  spherical: {
    stretch: { x: 1.0, y: 1.0 },
    catEye: 0.0,
    rim: 0.35,
    softness: 0.0,
  },
  anamorphic: {
    stretch: { x: 0.6, y: 1.5 },
    catEye: 0.0,
    rim: 0.35,
    softness: 0.0,
  },
  vintage: {
    stretch: { x: 1.0, y: 1.0 },
    catEye: 0.85,
    rim: 1.0,
    softness: 0.0,
  },
  portrait: {
    stretch: { x: 1.0, y: 1.0 },
    catEye: 0.0,
    rim: 0.0,
    softness: 1.0,
  },
  hexagonal: {
    stretch: { x: 1.0, y: 1.0 },
    catEye: 0.0,
    rim: 0.2,
    softness: 0.0,
  },
  octagonal: {
    stretch: { x: 1.0, y: 1.0 },
    catEye: 0.0,
    rim: 0.2,
    softness: 0.0,
  },
};

/**
 * Computes the physical Circle of Confusion (CoC) parameters using thin-lens optics.
 * A = f / N (entrance pupil diameter in mm)
 * s = subjectDistance in mm = focusDistance * sceneScale
 * i = image distance in mm = max(s - f, 0.001 * f)
 * cocMm = (A * f) / i
 * cocPixels = cocMm * (viewportHeight / 24mm) * 0.5
 */
export function computePhysicalCocGain(params: {
  focalLengthMm: number;
  fNumber: number;
  sceneScale?: number;
  focusDistance: number;
  viewportHeight: number;
}): { bokehScale: number; cocGain: number; cocPixels: number } {
  const f = Math.max(params.focalLengthMm, 0.001);
  const apertureDiameter = f / Math.max(params.fNumber, 0.001);
  const sceneScale = params.sceneScale && params.sceneScale > 0 ? params.sceneScale : DEFAULT_SCENE_SCALE;
  const subjectDistanceMm = Math.max(params.focusDistance, 0) * sceneScale;
  const imageDistanceMm = Math.max(subjectDistanceMm - f, f * 0.001);

  const cocMm = (apertureDiameter * f) / imageDistanceMm;
  const sensorRatio = Math.max(params.viewportHeight, 1) / SENSOR_HEIGHT_MM;
  const cocPixels = cocMm * sensorRatio * 0.5;

  const bokehScale = BOKEH_SCALE_FACTOR * Math.max(params.viewportHeight, 1);
  const cocGain = bokehScale > 0 ? cocPixels / bokehScale : 0;

  return { bokehScale, cocGain, cocPixels };
}

/**
 * Projects a target world coordinate along the camera forward axis to compute planar focus distance.
 */
export function calculateFocusDistanceToPoint(
  target: { x: number; y: number; z: number },
  cameraPos: { x: number; y: number; z: number },
  cameraForward: { x: number; y: number; z: number }
): number {
  const dx = target.x - cameraPos.x;
  const dy = target.y - cameraPos.y;
  const dz = target.z - cameraPos.z;

  const len = Math.hypot(cameraForward.x, cameraForward.y, cameraForward.z) || 1;
  const fx = cameraForward.x / len;
  const fy = cameraForward.y / len;
  const fz = cameraForward.z / len;

  const alongView = dx * fx + dy * fy + dz * fz;
  return Number.isFinite(alongView) && alongView > 0.001 ? alongView : 0.001;
}

/**
 * Resolves bokeh shape configuration with safe fallback to spherical.
 */
export function getBokehShapeConfig(shape?: string): BokehShapeConfig {
  if (shape && shape in BOKEH_SHAPES) {
    return BOKEH_SHAPES[shape as BokehShapeName];
  }
  return BOKEH_SHAPES.spherical;
}

