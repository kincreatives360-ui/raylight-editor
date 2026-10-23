import { SCREEN_PLANE_Z, isFixedDeviceFrame, type DeviceFrameMetrics } from '../../model/deviceFrame';
import type { DeviceFrameSettings } from '../../model/types';

export interface LocalBounds {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
}

interface Point { x: number; y: number; }
interface ButtonLayout { center: Point; width: number; height: number; depth: number; z: number; }
interface CircleLayout { center: Point; radius: number; z: number; depth: number; }
interface PanelLayout { center: Point; width: number; height: number; radius: number; z: number; depth: number; }

export interface IPhone15ProLayout {
  fixed: boolean;
  body: { width: number; height: number; depth: number; cornerRadius: number; z: number; };
  screen: { width: number; height: number; radius: number; };
  front: { bezelDepth: number; bezelZ: number; glassZ: number; reflectionZ: number; dynamicIslandZ: number; screenOverlap: number; };
  dynamicIsland: PanelLayout;
  buttons: { action: ButtonLayout; volumeUp: ButtonLayout; volumeDown: ButtonLayout; side: ButtonLayout; };
  rearGlass: PanelLayout;
  camera: { plateau: PanelLayout; lenses: [CircleLayout, CircleLayout, CircleLayout]; flash: CircleLayout; lidar: CircleLayout; };
  appleMark: PanelLayout;
}

/**
 * Calibrated, scale-independent hardware placements for the one complete
 * Raylight device model. Measurements are proportional to published body and
 * display metrics, which keeps features faithful at every uniform size.
 */
export function getIPhone15ProLayout(metrics: DeviceFrameMetrics, settings: DeviceFrameSettings): IPhone15ProLayout {
  const fixed = isFixedDeviceFrame(settings);
  const screenWidth = Math.max(fixed ? 0.000001 : 0.01, metrics.screenWidth);
  const screenHeight = Math.max(fixed ? 0.000001 : 0.01, metrics.screenHeight);
  const shortSide = Math.min(screenWidth, screenHeight);
  const proud = shortSide * 0.001;
  const bodyZ = SCREEN_PLANE_Z - proud / 2 - metrics.bodyDepth * (fixed ? 1 : 1.08);
  const bodyRearZ = bodyZ;
  const railZ = bodyZ + metrics.bodyDepth * 0.52;
  const bezelDepth = Math.max(metrics.bodyDepth * 0.34, proud * 1.8);
  const buttonDepth = Math.max(metrics.bodyDepth * 0.16, shortSide * 0.006);
  const buttonWidth = Math.max(metrics.bezel * 0.18, shortSide * 0.011);
  // The centre sits on the rail so exactly half the rounded control projects
  // beyond the silhouette, matching the physical-device sizing contract.
  const leftX = -metrics.bodyWidth / 2;
  const rightX = metrics.bodyWidth / 2;
  const lensRadius = screenWidth * 0.058;
  const plateauWidth = screenWidth * 0.46;
  const plateauHeight = screenWidth * 0.46;
  const plateauDepth = Math.max(metrics.bodyDepth * 0.26, shortSide * 0.018);
  const plateauCenter = {
    x: -metrics.bodyWidth / 2 + plateauWidth * 0.59,
    y: metrics.bodyHeight / 2 - plateauHeight * 0.59,
  };
  const plateauZ = bodyRearZ - plateauDepth / 2;
  const lensZ = plateauZ - plateauDepth * 0.56;
  const lensSpacing = lensRadius * 1.92;
  const lenses: [CircleLayout, CircleLayout, CircleLayout] = [
    { center: { x: plateauCenter.x - lensSpacing * 0.33, y: plateauCenter.y + lensSpacing * 0.33 }, radius: lensRadius, z: lensZ, depth: plateauDepth * 0.46 },
    { center: { x: plateauCenter.x + lensSpacing * 0.67, y: plateauCenter.y + lensSpacing * 0.33 }, radius: lensRadius, z: lensZ, depth: plateauDepth * 0.46 },
    { center: { x: plateauCenter.x - lensSpacing * 0.33, y: plateauCenter.y - lensSpacing * 0.67 }, radius: lensRadius, z: lensZ, depth: plateauDepth * 0.46 },
  ];
  const smallSensorRadius = lensRadius * 0.37;

  return {
    fixed,
    body: { width: metrics.bodyWidth, height: metrics.bodyHeight, depth: metrics.bodyDepth, cornerRadius: metrics.bodyCornerRadius, z: bodyZ },
    screen: { width: screenWidth, height: screenHeight, radius: metrics.cornerRadius },
    front: {
      bezelDepth,
      bezelZ: SCREEN_PLANE_Z + proud - bezelDepth,
      glassZ: SCREEN_PLANE_Z + proud * 0.34,
      reflectionZ: SCREEN_PLANE_Z + proud * 0.46,
      dynamicIslandZ: SCREEN_PLANE_Z + proud * 0.72,
      screenOverlap: shortSide * 0.008,
    },
    dynamicIsland: {
      center: { x: 0, y: screenHeight / 2 - shortSide * 0.115 },
      width: screenWidth * 0.33,
      height: shortSide * 0.055,
      radius: shortSide * 0.0275,
      z: SCREEN_PLANE_Z + proud * 0.72,
      depth: proud * 0.25,
    },
    buttons: {
      action: { center: { x: leftX, y: screenHeight * 0.235 }, width: buttonWidth, height: screenHeight * 0.074, depth: buttonDepth, z: railZ },
      volumeUp: { center: { x: leftX, y: screenHeight * 0.10 }, width: buttonWidth, height: screenHeight * 0.095, depth: buttonDepth, z: railZ },
      volumeDown: { center: { x: leftX, y: -screenHeight * 0.035 }, width: buttonWidth, height: screenHeight * 0.095, depth: buttonDepth, z: railZ },
      side: { center: { x: rightX, y: screenHeight * 0.145 }, width: buttonWidth, height: screenHeight * 0.15, depth: buttonDepth, z: railZ },
    },
    rearGlass: {
      center: { x: 0, y: 0 }, width: metrics.bodyWidth - metrics.bezel * 0.34, height: metrics.bodyHeight - metrics.bezel * 0.34,
      radius: Math.max(0.001, metrics.bodyCornerRadius - metrics.bezel * 0.17), z: bodyRearZ - proud * 0.08, depth: proud * 0.18,
    },
    camera: {
      plateau: { center: plateauCenter, width: plateauWidth, height: plateauHeight, radius: shortSide * 0.09, z: plateauZ, depth: plateauDepth },
      lenses,
      flash: { center: { x: plateauCenter.x + lensSpacing * 0.67, y: plateauCenter.y - lensSpacing * 0.67 }, radius: smallSensorRadius, z: lensZ - plateauDepth * 0.12, depth: plateauDepth * 0.14 },
      lidar: { center: { x: plateauCenter.x + lensSpacing * 0.23, y: plateauCenter.y - lensSpacing * 0.64 }, radius: smallSensorRadius * 0.78, z: lensZ - plateauDepth * 0.13, depth: plateauDepth * 0.15 },
    },
    appleMark: { center: { x: 0, y: -metrics.bodyHeight * 0.035 }, width: screenWidth * 0.145, height: screenWidth * 0.175, radius: screenWidth * 0.045, z: bodyRearZ - proud * 0.19, depth: proud * 0.08 },
  };
}

export function getIPhone15ProBounds(layout: IPhone15ProLayout, options: { includeButtons?: boolean; includeCameras?: boolean } = {}): LocalBounds {
  const { body, buttons, camera, front, dynamicIsland } = layout;
  const includeButtons = options.includeButtons ?? true;
  const includeCameras = options.includeCameras ?? true;
  const min = { x: -body.width / 2, y: -body.height / 2, z: body.z };
  const max = { x: body.width / 2, y: body.height / 2, z: front.dynamicIslandZ };
  // Rear glass and the low-relief mark are rendered whether or not the
  // optional camera system is shown, so their depth must always be selected.
  min.z = Math.min(
    min.z,
    layout.rearGlass.z - layout.rearGlass.depth / 2,
    layout.appleMark.z - layout.appleMark.depth / 2,
  );
  if (includeButtons) {
    for (const button of Object.values(buttons)) {
      min.x = Math.min(min.x, button.center.x - button.width / 2);
      max.x = Math.max(max.x, button.center.x + button.width / 2);
      min.z = Math.min(min.z, button.z - button.depth / 2);
      max.z = Math.max(max.z, button.z + button.depth / 2);
    }
  }
  if (includeCameras) {
    min.x = Math.min(min.x, camera.plateau.center.x - camera.plateau.width / 2);
    max.x = Math.max(max.x, camera.plateau.center.x + camera.plateau.width / 2);
    min.y = Math.min(min.y, camera.plateau.center.y - camera.plateau.height / 2);
    max.y = Math.max(max.y, camera.plateau.center.y + camera.plateau.height / 2);
    min.z = Math.min(min.z, camera.plateau.z - camera.plateau.depth / 2, ...camera.lenses.map(lens => lens.z - lens.depth / 2), camera.flash.z - camera.flash.depth / 2, camera.lidar.z - camera.lidar.depth / 2);
  }
  max.z = Math.max(max.z, dynamicIsland.z);
  return { min, max };
}
