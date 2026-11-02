import type { Shot } from '../model/types';
import type { EvaluatedCamera } from './evaluateCamera';
import type { EvaluatedLayer } from './evaluateLayer';
import {
  type CameraOptics,
  DEFAULT_CAMERA_OPTICS,
  SENSOR_HEIGHTS_MM,
} from '../model/cameraOpticsTypes';

export interface EvaluatedCameraOptics extends CameraOptics {
  /** Effective focus distance resolved from target object tracking or manual setting (metres). */
  resolvedFocusDistance: number;
  /** Near plane distance in metres where depth-of-field blur starts. */
  nearFocusDistance: number;
  /** Far plane distance in metres where depth-of-field blur ends. */
  farFocusDistance: number;
  /** Calculated hyperfocal distance in metres. */
  hyperfocalDistance: number;
  /** Circle of Confusion scale factor for GPU shader. */
  cocScale: number;
}

/**
 * Calculates physical depth of field limits and evaluates target object tracking.
 */
export function evaluateCameraOptics(
  shot: Shot,
  camera: EvaluatedCamera,
  evaluatedLayers: EvaluatedLayer[] = []
): EvaluatedCameraOptics {
  const optics: CameraOptics = shot.cameraOptics
    ? { ...DEFAULT_CAMERA_OPTICS, ...shot.cameraOptics }
    : { ...DEFAULT_CAMERA_OPTICS };

  let resolvedDistance = optics.focusDistance;

  // If focus mode is 'target' and targetObjectId is set, track object's 3D position
  if (optics.focusMode === 'target' && optics.targetObjectId) {
    const targetLayer = evaluatedLayers.find((l) => l.id === optics.targetObjectId);
    if (targetLayer) {
      const anchor = optics.targetAnchor ?? { x: 0, y: 0, z: 0 };
      const targetPos = {
        x: targetLayer.position.x + anchor.x,
        y: targetLayer.position.y + anchor.y,
        z: targetLayer.position.z + anchor.z,
      };

      // Camera position in 3D scene space
      const camPos = camera.position;
      const dx = targetPos.x - camPos.x;
      const dy = targetPos.y - camPos.y;
      const dz = targetPos.z - camPos.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist > 0.01 && !isNaN(dist)) {
        resolvedDistance = Number(dist.toFixed(3));
      }
    }
  }

  // Physical optics constants
  const focalLengthM = Math.max(1, optics.focalLength) / 1000.0; // mm -> m
  const apertureN = Math.max(0.1, optics.aperture);
  const sensorHeightM = (SENSOR_HEIGHTS_MM[optics.sensorFormat] ?? 24.0) / 1000.0; // mm -> m
  const maxCoC = sensorHeightM / 1000.0; // Standard 0.024mm CoC criterion for full frame

  // Hyperfocal distance: H = f^2 / (N * c)
  const hyperfocal = (focalLengthM * focalLengthM) / (apertureN * maxCoC);

  // Near focus limit: Dn = (H * S) / (H + (S - f))
  // Far focus limit: Df = (H * S) / (H - (S - f))
  const S = Math.max(0.05, resolvedDistance);
  const f = focalLengthM;
  const num = hyperfocal * S;
  const denNear = hyperfocal + (S - f);
  const denFar = hyperfocal - (S - f);

  const nearDist = denNear > 0 ? num / denNear : S * 0.8;
  const farDist = denFar > 0 ? num / denFar : S * 1.5;

  // Calculate shader CoC multiplier: (f^2) / (N * (S - f) * sensorHeight)
  const denom = apertureN * Math.max(0.001, S - f) * sensorHeightM;
  const cocScale = (focalLengthM * focalLengthM) / Math.max(0.0001, denom);

  return {
    ...optics,
    resolvedFocusDistance: S,
    nearFocusDistance: Math.max(0.01, Number(nearDist.toFixed(3))),
    farFocusDistance: Number(farDist.toFixed(3)),
    hyperfocalDistance: Number(hyperfocal.toFixed(2)),
    cocScale: Number(cocScale.toFixed(4)),
  };
}
