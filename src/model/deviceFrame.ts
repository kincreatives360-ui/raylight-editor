import type { DeviceFrameSettings, ScreenFit, Size2D, Vec3 } from './types';

// World-space z of the screen artwork plane. Shared by ThreeLayerObject
// (artwork mesh) and PhoneDeviceFrame (chassis staging) so the frame and the
// screen always agree on where the screen lives.
export const SCREEN_PLANE_Z = 0.016;

export interface DeviceSpec {
  id: string;
  name: string;
  family?: 'phone' | 'laptop' | 'tablet' | 'display';
  category?: 'phone' | 'tablet' | 'laptop' | 'display' | 'browser';
  body: { width: number; height: number; depth: number; cornerRadius: number };
  screen: { width: number; height: number; cornerRadius: number };
  defaultCutout?: 'dynamic-island' | 'notch' | 'punch-hole' | 'none';
  aspectRatio?: number;
}

export const DEVICE_SPECS: Record<string, DeviceSpec> = {
  'iphone-15-pro': {
    id: 'iphone-15-pro',
    name: 'iPhone 15 Pro',
    family: 'phone',
    category: 'phone',
    body: { width: 70.6, height: 146.6, depth: 8.25, cornerRadius: 10.5 },
    screen: { width: 1179 / 460 * 25.4, height: 2556 / 460 * 25.4, cornerRadius: 9.5 },
    defaultCutout: 'dynamic-island',
    aspectRatio: 1179 / 2556,
  },
  'ipad-pro': {
    id: 'ipad-pro',
    name: 'iPad Pro',
    family: 'tablet',
    category: 'tablet',
    body: { width: 178.5, height: 247.6, depth: 5.9, cornerRadius: 10.0 },
    screen: { width: 166.5, height: 235.6, cornerRadius: 8.0 },
    defaultCutout: 'none',
    aspectRatio: 166.5 / 235.6,
  },
  'macbook-pro': {
    id: 'macbook-pro',
    name: 'MacBook Pro',
    family: 'laptop',
    category: 'laptop',
    body: { width: 312.6, height: 221.2, depth: 15.5, cornerRadius: 8.0 },
    screen: { width: 298.0, height: 196.0, cornerRadius: 4.0 },
    defaultCutout: 'notch',
    aspectRatio: 298.0 / 196.0,
  },
  'samsung-galaxy': {
    id: 'samsung-galaxy',
    name: 'Galaxy S24 Ultra',
    family: 'phone',
    category: 'phone',
    body: { width: 79.0, height: 162.3, depth: 8.6, cornerRadius: 3.5 },
    screen: { width: 75.0, height: 158.0, cornerRadius: 2.0 },
    defaultCutout: 'punch-hole',
    aspectRatio: 75.0 / 158.0,
  },
  'studio-display': {
    id: 'studio-display',
    name: 'Studio Display',
    family: 'display',
    category: 'display',
    body: { width: 623.0, height: 362.0, depth: 19.0, cornerRadius: 6.0 },
    screen: { width: 600.0, height: 339.0, cornerRadius: 2.0 },
    defaultCutout: 'none',
    aspectRatio: 600.0 / 339.0,
  },
  'browser': {
    id: 'browser',
    name: 'Browser Window',
    family: 'display',
    category: 'browser',
    body: { width: 320.0, height: 200.0, depth: 6.0, cornerRadius: 8.0 },
    screen: { width: 320.0, height: 180.0, cornerRadius: 0.0 },
    defaultCutout: 'none',
    aspectRatio: 16 / 9,
  },
};

export interface DeviceFinishPreset {
  id: string;
  name: string;
  color: string;
  metalness: number;
  roughness: number;
}

export const DEVICE_FINISH_PRESETS: DeviceFinishPreset[] = [
  { id: 'space-black', name: 'Space Black', color: '#202124', metalness: 0.85, roughness: 0.22 },
  { id: 'titanium', name: 'Titanium', color: '#8e8a83', metalness: 0.72, roughness: 0.32 },
  { id: 'silver', name: 'Silver', color: '#e2e4e6', metalness: 0.90, roughness: 0.18 },
  { id: 'midnight', name: 'Midnight', color: '#1e2530', metalness: 0.80, roughness: 0.26 },
  { id: 'black', name: 'Black', color: '#121214', metalness: 0.60, roughness: 0.40 },
];
export const IPHONE_15_PRO: DeviceSpec = {
  id: 'iphone-15-pro',
  name: 'iPhone 15 Pro',
  family: 'phone',
  category: 'phone',
  body: { width: 70.6, height: 146.6, depth: 8.25, cornerRadius: 10.5 },
  screen: { width: (1179 / 460) * 25.4, height: (2556 / 460) * 25.4, cornerRadius: 9.5 },
  defaultCutout: 'dynamic-island',
  aspectRatio: 1179 / 2556,
};

export const ANDROID_FLAGSHIP: DeviceSpec = {
  id: 'android-flagship',
  name: 'Android Flagship',
  family: 'phone',
  category: 'phone',
  body: { width: 76.5, height: 162.6, depth: 8.8, cornerRadius: 12.0 },
  screen: { width: 71.5, height: 156.8, cornerRadius: 10.0 },
  defaultCutout: 'punch-hole',
  aspectRatio: 71.5 / 156.8,
};

export const MACBOOK_PRO_16: DeviceSpec = {
  id: 'macbook-pro-16',
  name: 'MacBook Pro 16"',
  family: 'laptop',
  category: 'laptop',
  body: { width: 355.7, height: 248.1, depth: 16.8, cornerRadius: 8.0 },
  screen: { width: 345.0, height: 224.0, cornerRadius: 5.0 },
  defaultCutout: 'notch',
  aspectRatio: 345.0 / 224.0,
};

export const IPAD_PRO_13: DeviceSpec = {
  id: 'ipad-pro-13',
  name: 'iPad Pro 13"',
  family: 'tablet',
  category: 'tablet',
  body: { width: 215.5, height: 281.6, depth: 5.1, cornerRadius: 12.0 },
  screen: { width: 202.0, height: 268.0, cornerRadius: 10.0 },
  defaultCutout: 'none',
  aspectRatio: 202.0 / 268.0,
};

export const STUDIO_DISPLAY_27: DeviceSpec = {
  id: 'studio-display-27',
  name: 'Studio Display 27"',
  family: 'display',
  category: 'display',
  body: { width: 622.7, height: 362.0, depth: 16.0, cornerRadius: 6.0 },
  screen: { width: 597.0, height: 336.0, cornerRadius: 2.0 },
  defaultCutout: 'none',
  aspectRatio: 597.0 / 336.0,
};

export const SUPPORTED_DEVICES: Record<string, DeviceSpec> = {
  'iphone-15-pro': IPHONE_15_PRO,
  'android-flagship': ANDROID_FLAGSHIP,
  'macbook-pro-16': MACBOOK_PRO_16,
  'ipad-pro-13': IPAD_PRO_13,
  'studio-display-27': STUDIO_DISPLAY_27,
};

export function getDeviceSpec(deviceId?: string): DeviceSpec {
  if (deviceId && DEVICE_SPECS[deviceId]) {
    return DEVICE_SPECS[deviceId];
  }
  if (deviceId && SUPPORTED_DEVICES[deviceId]) {
    return SUPPORTED_DEVICES[deviceId];
  }
  return DEVICE_SPECS['iphone-15-pro'];
}

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
  family: 'phone',
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
  screenPan: { x: 0, y: 0 },
  screenZoom: 1,
  hingeAngleDeg: 105,
  tiltAngleDeg: 10,
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
  lidAngle: 110,
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

  const resolvedDeviceId = value.deviceId || IPHONE_15_PRO.id;
  const spec = getDeviceSpec(resolvedDeviceId);
  const specFamily = spec.family || (spec.category === 'browser' ? 'display' : spec.category) || 'phone';

  return {
    ...value,
    ...(isFixedDeviceFrame(value) ? {
      deviceId: resolvedDeviceId,
      deviceScale: clamp(value.deviceScale, 0.65, 2, 1),
      family: specFamily as DeviceFrameSettings['family'],
      cutoutStyle: input?.cutoutStyle ?? spec.defaultCutout ?? DEFAULT_DEVICE_FRAME_SETTINGS.cutoutStyle,
    } : {}),
    scale: clamp(value.scale, 0.65, 2, DEFAULT_DEVICE_FRAME_SETTINGS.scale),
    bezelWidth: clamp(value.bezelWidth, 0.01, 0.2, DEFAULT_DEVICE_FRAME_SETTINGS.bezelWidth),
    thickness: clamp(value.thickness, 0.005, 0.16, DEFAULT_DEVICE_FRAME_SETTINGS.thickness),
    cornerRadius: clamp(value.cornerRadius, 0.04, 0.24, DEFAULT_DEVICE_FRAME_SETTINGS.cornerRadius),
    frameRoughness: clamp(value.frameRoughness, 0.04, 1, DEFAULT_DEVICE_FRAME_SETTINGS.frameRoughness),
    frameMetalness: clamp(value.frameMetalness, 0, 1, DEFAULT_DEVICE_FRAME_SETTINGS.frameMetalness),
    screenPan: {
      x: clamp(value.screenPan?.x, -1, 1, 0),
      y: clamp(value.screenPan?.y, -1, 1, 0),
    },
    screenZoom: clamp(value.screenZoom, 0.5, 3, 1),
    hingeAngleDeg: clamp(value.hingeAngleDeg, 0, 135, 105),
    tiltAngleDeg: clamp(value.tiltAngleDeg, -15, 30, 10),
    glassOpacity: clamp(value.glassOpacity, 0, 0.45, DEFAULT_DEVICE_FRAME_SETTINGS.glassOpacity),
    glassRoughness: clamp(value.glassRoughness, 0.02, 1, DEFAULT_DEVICE_FRAME_SETTINGS.glassRoughness),
    gloss: clamp(value.gloss, 0, 1, DEFAULT_DEVICE_FRAME_SETTINGS.gloss),
    reflection: clamp(value.reflection, 0, 1, DEFAULT_DEVICE_FRAME_SETTINGS.reflection),
    cutoutWidth: clamp(value.cutoutWidth, 0.08, 0.85, DEFAULT_DEVICE_FRAME_SETTINGS.cutoutWidth),
    cutoutHeight: clamp(value.cutoutHeight, 0.015, 0.14, DEFAULT_DEVICE_FRAME_SETTINGS.cutoutHeight),
    shadowOpacity: clamp(value.shadowOpacity, 0, 1, DEFAULT_DEVICE_FRAME_SETTINGS.shadowOpacity),
    shadowBlur: clamp(value.shadowBlur, 0, 1, DEFAULT_DEVICE_FRAME_SETTINGS.shadowBlur),
    shadowOffset: clamp(value.shadowOffset, 0, 0.5, DEFAULT_DEVICE_FRAME_SETTINGS.shadowOffset),
    lidAngle: clamp(value.lidAngle, 60, 150, 110),
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
    const spec = getDeviceSpec(settings.deviceId);
    const unit = Math.max(0.001, Math.abs(screenHeight)) * clamp(settings.deviceScale, 0.65, 2, 1) * (settings.legacyHeightCompensation ?? 1) / spec.body.height;
    return {
      bodyWidth: spec.body.width * unit,
      bodyHeight: spec.body.height * unit,
      bodyDepth: spec.body.depth * unit,
      bodyCornerRadius: spec.body.cornerRadius * unit,
      screenWidth: spec.screen.width * unit,
      screenHeight: spec.screen.height * unit,
      cornerRadius: spec.screen.cornerRadius * unit,
      bezel: (spec.body.width - spec.screen.width) * unit / 2,
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
  fit: ScreenFit,
  pan?: { x: number; y: number },
  zoom?: number
): ImageFitRect {
  const sourceAspect = sourceWidth / Math.max(sourceHeight, 0.001);
  const targetAspect = targetWidth / Math.max(targetHeight, 0.001);
  const zoomFactor = Math.max(0.5, Math.min(3, zoom ?? 1));

  if (fit === 'cover') {
    let baseSourceW = sourceWidth;
    let baseSourceH = sourceHeight;

    if (sourceAspect > targetAspect) {
      baseSourceW = sourceHeight * targetAspect;
    } else {
      baseSourceH = sourceWidth / targetAspect;
    }

    const finalSourceW = baseSourceW / zoomFactor;
    const finalSourceH = baseSourceH / zoomFactor;

    const maxPanX = Math.max(0, sourceWidth - finalSourceW);
    const maxPanY = Math.max(0, sourceHeight - finalSourceH);

    const panOffsetX = (pan?.x ?? 0) * (maxPanX / 2);
    const panOffsetY = (pan?.y ?? 0) * (maxPanY / 2);

    const sourceX = (sourceWidth - finalSourceW) / 2 + panOffsetX;
    const sourceY = (sourceHeight - finalSourceH) / 2 + panOffsetY;

    return {
      sourceX,
      sourceY,
      sourceWidth: finalSourceW,
      sourceHeight: finalSourceH,
      targetX: 0,
      targetY: 0,
      targetWidth,
      targetHeight,
    };
  }

  if (fit === 'contain') {
    let baseTargetW = targetWidth;
    let baseTargetH = targetHeight;
    let baseTargetX = 0;
    let baseTargetY = 0;

    if (sourceAspect > targetAspect) {
      baseTargetH = targetWidth / sourceAspect;
      baseTargetY = (targetHeight - baseTargetH) / 2;
    } else {
      baseTargetW = targetHeight * sourceAspect;
      baseTargetX = (targetWidth - baseTargetW) / 2;
    }

    const finalW = baseTargetW * zoomFactor;
    const finalH = baseTargetH * zoomFactor;

    const panOffsetX = (pan?.x ?? 0) * baseTargetW * 0.5;
    const panOffsetY = (pan?.y ?? 0) * baseTargetH * 0.5;

    const finalX = baseTargetX + (baseTargetW - finalW) / 2 + panOffsetX;
    const finalY = baseTargetY + (baseTargetH - finalH) / 2 + panOffsetY;

    return {
      sourceX: 0,
      sourceY: 0,
      sourceWidth,
      sourceHeight,
      targetX: finalX,
      targetY: finalY,
      targetWidth: finalW,
      targetHeight: finalH,
    };
  }

  // fit === 'stretch'
  const finalW = targetWidth * zoomFactor;
  const finalH = targetHeight * zoomFactor;
  const panOffsetX = (pan?.x ?? 0) * targetWidth * 0.5;
  const panOffsetY = (pan?.y ?? 0) * targetHeight * 0.5;

  return {
    sourceX: 0,
    sourceY: 0,
    sourceWidth,
    sourceHeight,
    targetX: (targetWidth - finalW) / 2 + panOffsetX,
    targetY: (targetHeight - finalH) / 2 + panOffsetY,
    targetWidth: finalW,
    targetHeight: finalH,
  };
}
