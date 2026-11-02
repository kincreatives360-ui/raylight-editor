export const CAMERA_ANGLE_VIEWS = [
  { id: 'front', label: 'Front', orbit: 0, tilt: 0, roll: 0 },
  { id: 'back', label: 'Back', orbit: 180, tilt: 0, roll: 0 },
  { id: 'right', label: 'Right', orbit: 90, tilt: 0, roll: 0 },
  { id: 'left', label: 'Left', orbit: -90, tilt: 0, roll: 0 },
  { id: 'top', label: 'Top', orbit: 0, tilt: -90, roll: 0 },
  { id: 'bottom', label: 'Bottom', orbit: 0, tilt: 90, roll: 0 },
  { id: 'isometric', label: 'Iso', orbit: 45, tilt: 35.26, roll: 0 },
  { id: 'three-quarter-right', label: 'Three-quarter right', orbit: 35, tilt: 20, roll: 0 },
  { id: 'three-quarter-left', label: 'Three-quarter left', orbit: -35, tilt: 20, roll: 0 },
  { id: 'low-angle', label: 'Low angle', orbit: 18, tilt: -16, roll: 0 },
] as const;

export const CANVAS_ZOOM_LEVELS: readonly number[] = [0.25, 0.5, 0.74, 1, 1.5, 2];
