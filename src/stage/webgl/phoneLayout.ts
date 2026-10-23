import { isFixedDeviceFrame, SCREEN_PLANE_Z, type DeviceFrameMetrics } from '../../model/deviceFrame';
import type { DeviceFrameSettings } from '../../model/types';
import { getIPhone15ProBounds, getIPhone15ProLayout } from './iphone15ProLayout';

/** Shared by the rendered hardware and its editor selection volume. */
export function getPhoneLayout(metrics: DeviceFrameMetrics, settings: DeviceFrameSettings) {
  const fixed = isFixedDeviceFrame(settings);
  const safeWidth = Math.max(fixed ? 0.000001 : 0.01, metrics.screenWidth);
  const safeHeight = Math.max(fixed ? 0.000001 : 0.01, metrics.screenHeight);
  const depth = metrics.bodyDepth;
  const shortSide = Math.min(safeWidth, safeHeight);
  const proud = shortSide * 0.001;
  const bezelDepth = Math.max(depth * 0.34, proud * 1.8);
  const bodyZ = SCREEN_PLANE_Z - proud / 2 - depth * (fixed ? 1 : 1.08);
  return {
    fixed, safeWidth, safeHeight, depth, shortSide, proud, bezelDepth, bodyZ,
    bezelZ: SCREEN_PLANE_Z + proud - bezelDepth,
    glassZ: SCREEN_PLANE_Z + proud * 0.4,
    reflectionZ: SCREEN_PLANE_Z + proud * 0.5,
    cutoutZ: SCREEN_PLANE_Z + proud * 0.6,
    screenOverlap: shortSide * 0.008,
    cameraX: -metrics.bodyWidth * 0.28,
    cameraY: metrics.bodyHeight * 0.31,
    cameraZ: bodyZ - depth * 0.14,
    lensRadius: safeWidth * 0.033,
    buttonWidth: Math.max(metrics.bezel * 0.19, shortSide * 0.009),
    buttonHeight: safeHeight * 0.06,
    buttonDepth: Math.max(depth * 0.18, 0.001),
    buttonZ: bodyZ + depth * 0.56,
  };
}

export function getPhoneLocalBounds(metrics: DeviceFrameMetrics, settings: DeviceFrameSettings) {
  if (isFixedDeviceFrame(settings) && settings.deviceId === 'iphone-15-pro') {
    return getIPhone15ProBounds(getIPhone15ProLayout(metrics, settings), {
      includeButtons: settings.showSideButtons,
      includeCameras: settings.showRearCameras,
    });
  }
  const layout = getPhoneLayout(metrics, settings);
  const bevel = layout.fixed ? 0 : Math.min(layout.depth * 0.08, metrics.bodyCornerRadius * 0.08);
  const min = { x: -metrics.bodyWidth / 2 - bevel, y: -metrics.bodyHeight / 2 - bevel, z: layout.bodyZ - (layout.fixed ? 0 : layout.depth * 0.08) };
  const max = { x: metrics.bodyWidth / 2 + bevel, y: metrics.bodyHeight / 2 + bevel, z: SCREEN_PLANE_Z + layout.proud };
  if (settings.showSideButtons) {
    min.x = Math.min(min.x, -metrics.bodyWidth / 2 - layout.buttonWidth / 2);
    max.x = Math.max(max.x, metrics.bodyWidth / 2 + layout.buttonWidth / 2);
    min.z = Math.min(min.z, layout.buttonZ - layout.buttonDepth / 2);
    max.z = Math.max(max.z, layout.buttonZ + layout.buttonDepth / 2);
  }
  if (settings.showRearCameras) {
    min.z = Math.min(min.z, layout.cameraZ - layout.depth * 0.025);
    min.x = Math.min(min.x, layout.cameraX - layout.safeWidth * 0.15);
    max.x = Math.max(max.x, layout.cameraX + layout.safeWidth * 0.15);
    min.y = Math.min(min.y, layout.cameraY - layout.safeWidth * 0.15);
    max.y = Math.max(max.y, layout.cameraY + layout.safeWidth * 0.15);
  }
  return { min, max };
}
