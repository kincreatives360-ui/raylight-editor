export interface CameraAngleView {
  id: string;
  label: string;
  orbit: number;
  tilt: number;
  roll: number;
  dolly?: number;
  panX?: number;
  panY?: number;
}

export const CAMERA_ANGLE_VIEWS: readonly CameraAngleView[] = [
  { id: 'three-quarter-right', label: 'Three-quarter right', orbit: 35, tilt: 18, roll: 0, dolly: 1.7, panX: 0, panY: 0 },
  { id: 'three-quarter-left', label: 'Three-quarter left', orbit: -35, tilt: 18, roll: 0, dolly: 1.7, panX: 0, panY: 0 },
  { id: 'profile-right', label: 'Profile right', orbit: 80, tilt: 6, roll: 0, dolly: 1.7, panX: 0, panY: 0 },
  { id: 'profile-left', label: 'Profile left', orbit: -80, tilt: 6, roll: 0, dolly: 1.7, panX: 0, panY: 0 },
  { id: 'top-down', label: 'Top down', orbit: 0, tilt: 78, roll: 0, dolly: 1.7, panX: 0, panY: 0 },
  { id: 'low-angle', label: 'Low angle', orbit: 25, tilt: -30, roll: 0, dolly: 1.5, panX: 0, panY: 0 },
  { id: 'front', label: 'Front', orbit: 0, tilt: 0, roll: 0, dolly: 1.7, panX: 0, panY: 0 },
] as const;
