/**
 * Depth of Field — optical helpers (Stage 1 foundation).
 *
 * Thin-lens Circle of Confusion and focus-range calculations used by the
 * DoF post pass, the canvas HUD, and the inspector. Units:
 *   - distances: scene units (not metres unless the project has a scale)
 *   - focal length: millimetres
 *   - aperture: conventional f-number (f/2.8 → 2.8)
 *   - sensor height: millimetres (full-frame default 24)
 *
 * CoC formula (thin lens, absolute diameter in scene units, then scaled to
 * pixels by the renderer using focal length / sensor / resolution):
 *
 *   CoC ∝ |S − S₁| / S  ·  (f² / (N · (S₁ − f)))
 *
 * where S = subject distance, S₁ = focus distance, f = focal length,
 * N = f-number. We keep a practical real-time form that stays stable
 * when scene units are normalized (camera Z ≈ 2.65).
 */

import {
  DEFAULT_CAMERA_Z,
  DEFAULT_FOCAL_LENGTH,
  SENSOR_HEIGHT_MM,
} from './constants';

export type DofQuality = 'draft' | 'balanced' | 'high';
export type DofFocusMode = 'manual' | 'target' | 'selection' | 'pick';
export type DofBokehShape = 'spherical' | 'hexagonal' | 'octagonal';
export type DofModel = 'physical' | 'artistic';

/** Fully-resolved optical state consumed by the GPU pass and HUD. */
export interface EvaluatedDofOptics {
  enabled: boolean;
  /** World-space distance from camera to the focus plane. */
  focusDistance: number;
  /** Half-width of the relatively sharp zone in scene units. */
  focusRange: number;
  /** f-number (smaller → shallower DoF). */
  aperture: number;
  /** Focal length in mm (prefer camera-evaluated value). */
  focalLengthMm: number;
  /** Sensor height in mm. */
  sensorHeightMm: number;
  /** Multiplier on CoC radius (raylight.app-style artistic gain). */
  bokehScale: number;
  /** Hard cap on blur radius in screen pixels. */
  maxBlurPx: number;
  /** Spiral / kernel sample count. */
  samples: number;
  quality: DofQuality;
  highlightThreshold: number;
  highlightIntensity: number;
  apertureBlades: number;
  bokehRotationDeg: number;
  bokehShape: DofBokehShape;
  model: DofModel;
  /** Near / far limits of acceptable sharpness (scene units from camera). */
  nearLimit: number;
  farLimit: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Convert a WebGL depth-buffer sample (0…1, non-linear) into camera-space
 * linear distance using the *actual* perspective near/far planes.
 * Prefer this over any hard-coded 0.1/100 pair.
 */
export function linearizeDepth(
  depthSample: number,
  cameraNear: number,
  cameraFar: number
): number {
  const z = clamp(depthSample, 0, 1);
  const n = Math.max(1e-4, cameraNear);
  const f = Math.max(n + 1e-4, cameraFar);
  // Standard reverse of perspective depth (OpenGL-style, 0 at near … 1 at far)
  return (n * f) / (f - z * (f - n));
}

/**
 * Thin-lens inspired CoC radius in *normalized* form (0 = sharp).
 * Scaled to pixels later by:  cocNorm * maxBlurPx * bokehScale * resolutionFactor.
 *
 * @param subjectDistance  linear camera-space depth of the pixel
 * @param focusDistance    linear camera-space focus plane
 * @param focalLengthMm    lens focal length
 * @param fNumber          aperture f-number
 * @param sensorHeightMm   sensor height (affects relative CoC size)
 */
export function circleOfConfusionNorm(
  subjectDistance: number,
  focusDistance: number,
  focalLengthMm: number,
  fNumber: number,
  sensorHeightMm: number = SENSOR_HEIGHT_MM
): number {
  const S = Math.max(1e-3, subjectDistance);
  const S1 = Math.max(1e-3, focusDistance);
  const fMm = clamp(focalLengthMm, 8, 400);
  const N = clamp(fNumber, 0.5, 32);
  const sensor = Math.max(1, sensorHeightMm);

  // Relative distance term (dimensionless)
  const rel = Math.abs(S - S1) / S;

  // Optical gain: longer lenses and wider apertures → larger CoC.
  // sensorHeight normalises so a full-frame 50 mm behaves consistently.
  const optical = (fMm / 50) * (2.8 / N) * (24 / sensor);

  return rel * optical;
}

/**
 * Approximate near / far limits of acceptable sharpness for HUD guides.
 * Uses a simplified hyperfocal-style relationship in scene units.
 */
export function computeDofLimits(
  focusDistance: number,
  focalLengthMm: number,
  fNumber: number,
  focusRange: number
): { nearLimit: number; farLimit: number } {
  const S1 = Math.max(0.05, focusDistance);
  const half = Math.max(0.02, focusRange * 0.5);
  // Slight optical bias: wider aperture → narrower sharp zone
  const opticalTighten = clamp(2.8 / Math.max(0.5, fNumber), 0.5, 2.5);
  const nearLimit = Math.max(0.05, S1 - half / opticalTighten);
  const farLimit = S1 + half * opticalTighten;
  return { nearLimit, farLimit };
}

/**
 * Resolve a complete EvaluatedDofOptics from raw shot settings + live camera.
 * Call this from evaluateEffects / the pipeline so the GPU and HUD share one source of truth.
 */
export function evaluateDofOptics(input: {
  enabled: boolean;
  focusDistance?: number;
  focusRange?: number;
  aperture?: number;
  focalLengthMm?: number;
  /** Prefer the camera's evaluated focal length when provided. */
  cameraFocalLengthMm?: number;
  sensorHeightMm?: number;
  bokehScale?: number;
  maxBlur?: number;
  samples?: number;
  quality?: DofQuality;
  highlightThreshold?: number;
  highlightIntensity?: number;
  apertureBlades?: number;
  bokehRotation?: number;
  bokehShape?: DofBokehShape;
  model?: DofModel;
  /** Optional world-space focus point; distance derived if camera position given. */
  target?: { x: number; y: number; z: number } | null;
  cameraPosition?: { x: number; y: number; z: number } | null;
}): EvaluatedDofOptics {
  const focalLengthMm =
    input.cameraFocalLengthMm ??
    input.focalLengthMm ??
    DEFAULT_FOCAL_LENGTH;

  let focusDistance = Number(input.focusDistance);
  if (!Number.isFinite(focusDistance)) focusDistance = DEFAULT_CAMERA_Z;

  // If a 3D target and camera position exist, focus distance = camera → target.
  if (input.target && input.cameraPosition) {
    const dx = input.target.x - input.cameraPosition.x;
    const dy = input.target.y - input.cameraPosition.y;
    const dz = input.target.z - input.cameraPosition.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (Number.isFinite(dist) && dist > 1e-4) focusDistance = dist;
  }

  const aperture = Number.isFinite(Number(input.aperture))
    ? clamp(Number(input.aperture), 0.5, 32)
    : 2.8;
  const focusRange = Number.isFinite(Number(input.focusRange))
    ? Math.max(0.02, Number(input.focusRange))
    : 1.2;
  const bokehScale = Number.isFinite(Number(input.bokehScale))
    ? Math.max(0, Number(input.bokehScale))
    : 5;
  const maxBlurPx = Number.isFinite(Number(input.maxBlur))
    ? clamp(Number(input.maxBlur), 1, 128)
    : 48;

  const quality: DofQuality = input.quality ?? 'balanced';
  const qualitySamples =
    quality === 'draft' ? 8 : quality === 'high' ? 28 : 16;
  const samples = Number.isFinite(Number(input.samples))
    ? clamp(Math.round(Number(input.samples)), 4, 32)
    : qualitySamples;

  const { nearLimit, farLimit } = computeDofLimits(
    focusDistance,
    focalLengthMm,
    aperture,
    focusRange
  );

  return {
    enabled: Boolean(input.enabled),
    focusDistance,
    focusRange,
    aperture,
    focalLengthMm,
    sensorHeightMm: input.sensorHeightMm ?? SENSOR_HEIGHT_MM,
    bokehScale,
    maxBlurPx,
    samples,
    quality,
    highlightThreshold: Number.isFinite(Number(input.highlightThreshold))
      ? clamp(Number(input.highlightThreshold), 0, 1)
      : 0.7,
    highlightIntensity: Number.isFinite(Number(input.highlightIntensity))
      ? Math.max(0, Number(input.highlightIntensity))
      : 0.35,
    apertureBlades: Number.isFinite(Number(input.apertureBlades))
      ? clamp(Math.round(Number(input.apertureBlades)), 0, 12)
      : 0,
    bokehRotationDeg: Number.isFinite(Number(input.bokehRotation))
      ? Number(input.bokehRotation)
      : 0,
    bokehShape: input.bokehShape ?? 'spherical',
    model: input.model ?? 'physical',
    nearLimit,
    farLimit,
  };
}

/** Sample counts recommended per quality preset (for UI + pipeline). */
export const DOF_QUALITY_SAMPLES: Record<DofQuality, number> = {
  draft: 8,
  balanced: 16,
  high: 28,
};
