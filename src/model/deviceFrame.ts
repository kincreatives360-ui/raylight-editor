import type { DeviceFrameSettings, ScreenFit, Size2D, Vec3 } from './types';

// World-space z of the screen artwork plane. Shared by ThreeLayerObject
// (artwork mesh) and PhoneDeviceFrame (chassis staging) so the frame and the
// screen always agree on where the screen lives.
export const SCREEN_PLANE_Z = 0.016;

// Published body dimensions and nominal display PPI: https://support.apple.com/en-bn/111829
// Corner profiles are approximations, to be refined with the detailed hardware model.
export const IPHONE_15_PRO = {
  id: 'iphone-15-pro',
  name: 'iPhone 15 Pro',
  body: { width: 70.6, height: 146.6, depth: 8.25, cornerRadius: 10.5 },
  screen: { width: 1179 / 460 * 25.4, height: 2556 / 460 * 25.4, cornerRadius: 9.5 },
} as const;

export function isFixedDeviceFrame(settings?: Partial<DeviceFrameSettings> | null): boolean {
  return settings?.geometryVersion === 1;
}

export function resizeDevicePlacement(size: Size2D, axis: keyof Size2D, value: number, visibleSize: Size2D = size): Size2D {
  const factor = Math.max(Math.max(0.01, value) / Math.max(0.001, visibleSize[axis]), 0.01 / size.width, 0.01 / size.height);
  return { width: Math.max(0.01, size.width * factor), height: Math.max(0.01, size.height * factor) };
}

export function getDeviceFrameScale(settings: DeviceFrameSettings | null, scale: Vec3): Vec3 {
  if (!isFixedDeviceFrame(settings)) return scale;
  const magnitude = Math.sqrt(Math.abs(scale.x * scale.y));
  return { x: Math.sign(scale.x) * magnitude, y: Math.sign(scale.y) * magnitude, z: magnitude };
}

export function getDevicePlacementSize(size: Size2D, settings: DeviceFrameSettings, aspect: number, scale: Vec3 = { x: 1, y: 1, z: 1 }): Size2D {
  const metrics = getDeviceFrameMetrics(size.width * aspect, size.height, settings);
  const resolvedScale = getDeviceFrameScale(settings, scale);
  return { width: metrics.bodyWidth / aspect * Math.abs(resolvedScale.x), height: metrics.bodyHeight * Math.abs(resolvedScale.y) };
}

export function resizeDeviceFromHandle(size: Size2D, visibleSize: Size2D, handle: string, dx: number, dy: number, mirror: { x: number; y: number }) {
  const horizontal = handle.includes('e') || handle.includes('w');
  const signX = (handle.includes('e') ? 1 : handle.includes('w') ? -1 : 0) * mirror.x;
  const signY = (handle.includes('s') ? 1 : handle.includes('n') ? -1 : 0) * mirror.y;
  const axis = horizontal ? 'width' : 'height';
  const next = resizeDevicePlacement(size, axis, visibleSize[axis] + (horizontal ? signX * dx : signY * dy), visibleSize);
  const factor = next.height / size.height;
  return {
    size: next,
    centerOffset: {
      x: signX * visibleSize.width * (factor - 1) / 2,
      y: signY * visibleSize.height * (factor - 1) / 2,
    },
  };
}

export const DEFAULT_DEVICE_FRAME_SETTINGS: DeviceFrameSettings = {
  geometryVersion: 1,
  deviceId: IPHONE_15_PRO.id,
  deviceScale: 1,
  enabled: false,
  model: 'iphone-pro',
  frameColor: '#202124',
  frameRoughness: 0.28,
  frameMetalness: 0.72,
  scale: 1.08,
  bezelWidth: 0.065,
  thickness: 0.055,
  cornerRadius: 0.115,
  screenFit: 'contain',
  screenFillColor: '#050507',
  glassTint: '#ffffff',
  glassOpacity: 0.08,
  glassRoughness: 0.12,
  gloss: 0.5,
  reflection: 0.65,
  cutoutStyle: 'dynamic-island',
  cutoutWidth: 0.34,
  cutoutHeight: 0.048,
  showSideButtons: true,
  showRearCameras: true,
  shadowEnabled: true,
  shadowOpacity: 0.38,
  shadowBlur: 0.66,
  shadowOffset: 0.04,
};

const clamp = (value: number | undefined, min: number, max: number, fallback: number): number =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value as number : fallback));

export function resolveDeviceFrameSettings(
  input?: Partial<DeviceFrameSettings> | null
): DeviceFrameSettings {
  const value = {
    ...DEFAULT_DEVICE_FRAME_SETTINGS,
    ...(input == null ? {} : {
      geometryVersion: undefined, deviceId: undefined, deviceScale: undefined,
      screenFit: input.geometryVersion === 1 ? 'contain' as const : 'stretch' as const,
    }),
    ...input,
  };

  return {
    ...value,
    ...(isFixedDeviceFrame(value) ? {
      deviceId: value.deviceId || IPHONE_15_PRO.id,
      deviceScale: clamp(value.deviceScale, 0.65, 2, 1),
    } : {}),
    scale: clamp(value.scale, 0.65, 2, DEFAULT_DEVICE_FRAME_SETTINGS.scale),
    bezelWidth: clamp(value.bezelWidth, 0.01, 0.2, DEFAULT_DEVICE_FRAME_SETTINGS.bezelWidth),
    thickness: clamp(value.thickness, 0.005, 0.16, DEFAULT_DEVICE_FRAME_SETTINGS.thickness),
    cornerRadius: clamp(value.cornerRadius, 0.04, 0.24, DEFAULT_DEVICE_FRAME_SETTINGS.cornerRadius),
    frameRoughness: clamp(value.frameRoughness, 0.04, 1, DEFAULT_DEVICE_FRAME_SETTINGS.frameRoughness),
    frameMetalness: clamp(value.frameMetalness, 0, 1, DEFAULT_DEVICE_FRAME_SETTINGS.frameMetalness),
    glassOpacity: clamp(value.glassOpacity, 0, 0.45, DEFAULT_DEVICE_FRAME_SETTINGS.glassOpacity),
    glassRoughness: clamp(value.glassRoughness, 0.02, 1, DEFAULT_DEVICE_FRAME_SETTINGS.glassRoughness),
    gloss: clamp(value.gloss, 0, 1, DEFAULT_DEVICE_FRAME_SETTINGS.gloss),
    reflection: clamp(value.reflection, 0, 1, DEFAULT_DEVICE_FRAME_SETTINGS.reflection),
    cutoutWidth: clamp(value.cutoutWidth, 0.08, 0.85, DEFAULT_DEVICE_FRAME_SETTINGS.cutoutWidth),
    cutoutHeight: clamp(value.cutoutHeight, 0.015, 0.14, DEFAULT_DEVICE_FRAME_SETTINGS.cutoutHeight),
    shadowOpacity: clamp(value.shadowOpacity, 0, 1, DEFAULT_DEVICE_FRAME_SETTINGS.shadowOpacity),
    shadowBlur: clamp(value.shadowBlur, 0, 1, DEFAULT_DEVICE_FRAME_SETTINGS.shadowBlur),
    shadowOffset: clamp(value.shadowOffset, 0, 0.5, DEFAULT_DEVICE_FRAME_SETTINGS.shadowOffset),
  };
}

export interface DeviceFrameMetrics {
  bodyWidth: number;
  bodyHeight: number;
  bodyDepth: number;
  bezel: number;
  cornerRadius: number;
  bodyCornerRadius: number;
  screenWidth: number;
  screenHeight: number;
}

export function upgradeDeviceFrameSettings(
  input: DeviceFrameSettings,
  screenWidth: number,
  screenHeight: number,
  scale: Vec3 = { x: 1, y: 1, z: 1 }
): DeviceFrameSettings {
  if (isFixedDeviceFrame(input)) return input;
  const settings = resolveDeviceFrameSettings(input);
  const legacy = getDeviceFrameMetrics(screenWidth, screenHeight, settings);
  return {
    ...settings,
    geometryVersion: 1,
    deviceId: IPHONE_15_PRO.id,
    deviceScale: legacy.bodyHeight / Math.max(0.001, Math.abs(screenHeight)),
    legacyHeightCompensation: Math.abs(scale.y) / (Math.sqrt(Math.abs(scale.x * scale.y)) || 1) || 1,
  };
}

export function getDeviceFrameMetrics(
  screenWidth: number,
  screenHeight: number,
  settings: DeviceFrameSettings
): DeviceFrameMetrics {
  if (isFixedDeviceFrame(settings)) {
    // Height is the placement anchor; source aspect and legacy rim controls cannot deform hardware.
    // Unknown IDs retain their saved identity but use the only supported specification for now.
    const unit = Math.max(0.001, Math.abs(screenHeight)) * clamp(settings.deviceScale, 0.65, 2, 1) * (settings.legacyHeightCompensation ?? 1) / IPHONE_15_PRO.body.height;
    return {
      bodyWidth: IPHONE_15_PRO.body.width * unit,
      bodyHeight: IPHONE_15_PRO.body.height * unit,
      bodyDepth: IPHONE_15_PRO.body.depth * unit,
      bodyCornerRadius: IPHONE_15_PRO.body.cornerRadius * unit,
      screenWidth: IPHONE_15_PRO.screen.width * unit,
      screenHeight: IPHONE_15_PRO.screen.height * unit,
      cornerRadius: IPHONE_15_PRO.screen.cornerRadius * unit,
      bezel: (IPHONE_15_PRO.body.width - IPHONE_15_PRO.screen.width) * unit / 2,
    };
  }
  const shortSide = Math.max(0.001, Math.min(Math.abs(screenWidth), Math.abs(screenHeight)));
  const bezel = shortSide * settings.bezelWidth * settings.scale;
  const radius = Math.min(shortSide * settings.cornerRadius, shortSide * 0.48);

  return {
    bodyWidth: Math.abs(screenWidth) + bezel * 2,
    bodyHeight: Math.abs(screenHeight) + bezel * 2,
    bodyDepth: shortSide * settings.thickness * settings.scale,
    bezel,
    cornerRadius: radius,
    bodyCornerRadius: radius + bezel,
    screenWidth: Math.abs(screenWidth),
    screenHeight: Math.abs(screenHeight),
  };
}

export interface ImageFitRect {
  sourceX: number;
  sourceY: number;
  sourceWidth: number;
  sourceHeight: number;
  targetX: number;
  targetY: number;
  targetWidth: number;
  targetHeight: number;
}

export function getImageFitRect(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  fit: ScreenFit
): ImageFitRect {
  if (fit === 'stretch') {
    return {
      sourceX: 0,
      sourceY: 0,
      sourceWidth,
      sourceHeight,
      targetX: 0,
      targetY: 0,
      targetWidth,
      targetHeight,
    };
  }

  const sourceAspect = sourceWidth / Math.max(sourceHeight, 0.001);
  const targetAspect = targetWidth / Math.max(targetHeight, 0.001);

  if (fit === 'contain') {
    if (sourceAspect > targetAspect) {
      const height = targetWidth / sourceAspect;
      return {
        sourceX: 0, sourceY: 0, sourceWidth, sourceHeight,
        targetX: 0, targetY: (targetHeight - height) / 2,
        targetWidth, targetHeight: height,
      };
    }

    const width = targetHeight * sourceAspect;
    return {
      sourceX: 0, sourceY: 0, sourceWidth, sourceHeight,
      targetX: (targetWidth - width) / 2, targetY: 0,
      targetWidth: width, targetHeight,
    };
  }

  if (sourceAspect > targetAspect) {
    const width = sourceHeight * targetAspect;
    return {
      sourceX: (sourceWidth - width) / 2, sourceY: 0,
      sourceWidth: width, sourceHeight,
      targetX: 0, targetY: 0, targetWidth, targetHeight,
    };
  }

  const height = sourceWidth / targetAspect;
  return {
    sourceX: 0, sourceY: (sourceHeight - height) / 2,
    sourceWidth, sourceHeight: height,
    targetX: 0, targetY: 0, targetWidth, targetHeight,
  };
}
