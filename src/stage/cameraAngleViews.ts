export const CAMERA_ANGLE_VIEWS = [
  { id: 'three-quarter-right', label: 'Three-quarter right', orbit: 35, tilt: 20, roll: 0 },
  { id: 'three-quarter-left', label: 'Three-quarter left', orbit: -35, tilt: 20, roll: 0 },
  { id: 'profile-right', label: 'Profile right', orbit: 90, tilt: 0, roll: 0 },
  { id: 'profile-left', label: 'Profile left', orbit: -90, tilt: 0, roll: 0 },
  { id: 'top-down', label: 'Top down', orbit: 0, tilt: -89, roll: 0 },
  { id: 'low-angle', label: 'Low angle', orbit: 18, tilt: -16, roll: 0 },
  { id: 'front', label: 'Front', orbit: 0, tilt: 0, roll: 0 },
] as const;

export const RAYLIGHT_CAMERA_ANGLES = {
  front: { yaw: 0, pitch: 0, roll: 0, distance: 1.7 },
  threeQuarterRight: { yaw: 35, pitch: 18, roll: 0, distance: 1.7 },
  threeQuarterLeft: { yaw: -35, pitch: 18, roll: 0, distance: 1.7 },
  profileRight: { yaw: 80, pitch: 6, roll: 0, distance: 1.7 },
  profileLeft: { yaw: -80, pitch: 6, roll: 0, distance: 1.7 },
  topDown: { yaw: 0, pitch: 78, roll: 0, distance: 1.7 },
  lowAngle: { yaw: 25, pitch: -30, roll: 0, distance: 1.5 },
} as const;
