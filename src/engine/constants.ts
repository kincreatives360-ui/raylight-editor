// src/engine/constants.ts
// Centralized magic numbers with documentation for the evaluation engine

/** Camera & FOV Constants */
export const BASE_FOV_DEGREES = 27.0006;          // FOV at 50mm focal length on 24mm sensor
export const DEFAULT_FOCAL_LENGTH = 50;           // Default focal length in mm
export const SENSOR_HEIGHT_MM = 24;               // Full-frame sensor height
export const DEFAULT_CAMERA_Z = 2.65;             // Default camera distance from artboard

/** Camera Shake Constants */
export const CAMERA_SHAKE_AMPLITUDE_SCALE = 0.045;
export const CAMERA_SHAKE_FREQ_MULTIPLIERS = {
    xPrimary: 17.3,
    xSecondary: 31.7,
    yPrimary: 19.1,
    ySecondary: 27.5,
    rotZ: 14.2,
} as const;

/** Motion Blur Constants */
export const MOTION_BLUR_SHUTTER_BASE = 360;      // Shutter angle divisor (180° = 0.5)
export const MOTION_BLUR_MIN_SAMPLES = 2;
export const MOTION_BLUR_MAX_SAMPLES = 32;
export const MOTION_BLUR_DEFAULT_SAMPLES = 8;
export const MOTION_BLUR_MOTION_THRESHOLD = 0.0001;
export const MOTION_BLUR_SCALE_FACTOR = 0.25;     // Zoom/rotation contribution to motion vector

/** Layer Blur & Effects Constants */
export const LAYER_BLUR_SCALE_FACTOR = 100;       // layerBlur * 100 = pixels
export const EXTRA_LAYER_BLUR_DEFAULT = 0;
export const ENTRANCE_DISTANCE_DEFAULT = 0.18;
export const EXIT_DISTANCE_DEFAULT = 0.16;
export const WIGGLE_Y_AMPLITUDE_RATIO = 0.65;
export const WIGGLE_FOCUS_SCALE_FACTOR = 0.06;
export const WIGGLE_FREQ_X = 6;
export const WIGGLE_FREQ_Y = 8;
export const WIGGLE_FREQ_Z = 11;

/** Motion Blur Shutter/Scale */
export const MOTION_BLUR_SHUTTER_ANGLE_DEFAULT = 180;

/** Transition Constants */
export const TRANSITION_SLIDE_FACTOR = 0.25;

/** Lighting Constants */
export const MAX_SHADOW_CASTERS = 3;
export const DEFAULT_FILL_INTENSITY = 0.38;
export const WORLD_POSITION_SCALE_X = 6;
export const WORLD_POSITION_SCALE_Y = 6;
export const WORLD_POSITION_SCALE_Z = 5;
export const KEY_LIGHT_INTENSITY_MULTIPLIER = 2.2;
export const FILL_LIGHT_INTENSITY_MULTIPLIER = 0.5;
export const FILL_LIGHT_X_MULTIPLIER = -0.7;
export const FILL_LIGHT_Y_MULTIPLIER = -0.5;
export const FILL_LIGHT_Z_MULTIPLIER = 0.5;
export const AMBIENCE_INTENSITY_MULTIPLIER = 1.2;
export const ROOM_ENVIRONMENT_INTENSITY_MULTIPLIER = 1.5;
export const SHADOW_STRENGTH_DEFAULT = 0.7;
export const SHADOW_SOFTNESS_DEFAULT = 50;
export const SHADOW_SOFTNESS_DIVISOR = 10;

/** Kelvin Color Temperature */
export const KELVIN_MIN = 1000;
export const KELVIN_MAX = 15000;
export const KELVIN_SCALE = 100;                  // Kelvin / 100 for calculation

/** Animation Entrance/Exit */
export const ENTRANCE_DURATION_DEFAULT = 800;     // ms
export const EXIT_DURATION_DEFAULT = 800;         // ms
export const REVEAL_STAGGER_DEFAULT = 50;         // ms per char/word/line

/** Depth Compensation for Camera */
export const CAMERA_Z_COMPENSATION = 0.45;
export const CAMERA_ROT_X_COMPENSATION = 0.045;   // degrees to radians in compensation

/** Reveal Text Animation */
export const REVEAL_STAGGER_MS = 50;

/** Easing Precision */
export const EASING_PRECISION = 1e-6;
export const BEZIER_ITERATIONS = 8;
export const BEZIER_BISECTION_ITERATIONS = 12;

/** Light Animation Presets */
export const LIGHT_GLEAM_SWEEP_DURATION = 1400;
export const LIGHT_RIM_REVEAL_DURATION = 1600;
export const LIGHT_POWER_PULSE_DURATION = 1200;
export const LIGHT_DAWN_WARMTH_DURATION = 2000;

/** Camera Framing Padding */
export const FRAMING_PADDING_RATIO = 1.25;
export const FRAMING_MIN_PADDING = 1.05;
export const FRAMING_ZOOM_MIN = 0.15;
export const FRAMING_ZOOM_MAX = 5.0;
export const FRAMING_ZOOM_PRECISION = 2;

/** Scene Layer Scale Limits */
export const LAYER_MIN_MESH_SIZE = 0.02;

/** Layer Projected Corner Rot Offset */
export const SELECTION_ROT_OFFSET_MIN = 0.08;
export const SELECTION_ROT_OFFSET_FACTOR = 0.22;

/** Gradient Constants */
export const GRADIENT_MIN_STOPS = 2;
export const GRADIENT_MAX_STOPS = 8;

/** Asset Dimensions */
export const DEFAULT_ASSET_WIDTH = 1920;
export const DEFAULT_ASSET_HEIGHT = 1080;

/** Artboard Defaults */
export const DEFAULT_ARTBOARD_WIDTH = 1920;
export const DEFAULT_ARTBOARD_HEIGHT = 1080;

/** FPS Defaults */
export const DEFAULT_FPS = 60;
export const FRAME_MS_PRECISION = 1000;

/** Color Grade */
export const COLOR_GRADE_EXPOSURE_MIN = 0.2;

/** Vignette */
export const VIGNETTE_INTENSITY_MIN = 0;
export const VIGNETTE_INTENSITY_MAX = 1;
export const VIGNETTE_MIDPOINT_DEFAULT = 0.5;
export const VIGNETTE_ROUNDNESS_DEFAULT = 1;

/** Film Grain */
export const FILM_GRAIN_INTENSITY_MIN = 0;
export const FILM_GRAIN_SIZE_DEFAULT = 1;
export const FILM_GRAIN_SOFTNESS_DEFAULT = 0;
export const FILM_GRAIN_COLOR_AMOUNT_DEFAULT = 0.4;

/** Chromatic Aberration */
export const CHROMATIC_ABERRATION_OFFSET_MIN = 0;
export const CHROMATIC_ABERRATION_SOFTNESS_DEFAULT = 0.6;
export const CHROMATIC_ABERRATION_ANGLE_DEFAULT = 0;

/** Glitch */
export const GLITCH_BAND_SIZE_DEFAULT = 50;
export const GLITCH_COLOR_SHIFT_DEFAULT = 0.5;

/** Edge Fade */
export const EDGE_FADE_SOFTNESS_DEFAULT = 0;

/** Ghost */
export const GHOST_OPACITY_MIN = 0;
export const GHOST_OPACITY_MAX = 1;

/** Atmosphere */
export const ATMOSPHERE_DEPTH_MIX_FACTOR = 0.1;

/** Gradient Map */
export const GRADIENT_MAP_SPREAD_DEFAULT = 1;
export const GRADIENT_MAP_BLEND_DEFAULT = 0.5;

/** Fish Eye */
export const FISH_EYE_SCALE_DEFAULT = 1;
export const FISH_EYE_EDGE_MODE_DEFAULT = 0;

/** Lens Distortion */
export const LENS_DISTORTION_MEASURE_DEFAULT = 1;
export const LENS_DISTORTION_EDGE_MODE_DEFAULT = 0;

/** Background Render */
export const BACKGROUND_BLEND_SRC = 770;          // THREE.SrcAlphaFactor
export const BACKGROUND_BLEND_DST = 771;          // THREE.OneMinusSrcAlphaFactor
export const BACKGROUND_BLEND_EQUATION = 32774;   // THREE.AddEquation

/** Minimum Shadow Map Bias */
export const SHADOW_MAP_BIAS = 0.0001;

/** Color Conversions */
export const HEX_PARSE_FULL = 6;
export const HEX_PARSE_SHORT = 3;

/** Convex Hull Cross Product */
export const CONVEX_HULL_CROSS_TOLERANCE = 0;