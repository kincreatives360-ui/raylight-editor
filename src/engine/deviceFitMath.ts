// src/engine/deviceFitMath.ts
import type { DeviceModelSpec, ScreenFit } from '../model/types';

export interface TextureFitResult {
  /** Destination X on target canvas */
  dx: number;
  /** Destination Y on target canvas */
  dy: number;
  /** Destination width on target canvas */
  dw: number;
  /** Destination height on target canvas */
  dh: number;
  /** Source X to sample from source */
  sx: number;
  /** Source Y to sample from source */
  sy: number;
  /** Source width to sample from source */
  sw: number;
  /** Source height to sample from source */
  sh: number;
  /** Normalized UV horizontal scale factor */
  scaleX: number;
  /** Normalized UV vertical scale factor */
  scaleY: number;
  /** Normalized UV horizontal offset */
  offsetX: number;
  /** Normalized UV vertical offset */
  offsetY: number;
}

export interface DeviceGeometryResult {
  deviceW: number;
  deviceH: number;
  screenW: number;
  screenH: number;
  chassisCornerRadius: number;
  screenCornerRadius: number;
  deviceAspect: number;
  screenAspect: number;
}

/**
 * Calculates deterministic texture fitting parameters for contain and cover modes.
 *
 * In `contain` mode:
 * The complete source image is visible without distortion; letterboxing is placed
 * on the unused axis.
 *
 * In `cover` mode:
 * The entire target rectangle is covered without distortion; overflowing source
 * dimensions are cropped symmetrically.
 */
export function calculateTextureFit(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  mode: ScreenFit = 'contain'
): TextureFitResult {
  const safeSrcW = Math.max(1, Number.isFinite(sourceWidth) ? sourceWidth : 1);
  const safeSrcH = Math.max(1, Number.isFinite(sourceHeight) ? sourceHeight : 1);
  const safeTargetW = Math.max(1, Number.isFinite(targetWidth) ? targetWidth : 1);
  const safeTargetH = Math.max(1, Number.isFinite(targetHeight) ? targetHeight : 1);

  const srcAspect = safeSrcW / safeSrcH;
  const dstAspect = safeTargetW / safeTargetH;

  if (mode === 'cover') {
    // Fill entire target area
    const dx = 0;
    const dy = 0;
    const dw = safeTargetW;
    const dh = safeTargetH;

    if (srcAspect > dstAspect) {
      // Source is wider than target: crop source horizontally
      const sw = safeSrcH * dstAspect;
      const sh = safeSrcH;
      const sx = (safeSrcW - sw) / 2;
      const sy = 0;

      const scaleX = dstAspect / srcAspect;
      const scaleY = 1;
      const offsetX = (1 - scaleX) / 2;
      const offsetY = 0;

      return { dx, dy, dw, dh, sx, sy, sw, sh, scaleX, scaleY, offsetX, offsetY };
    } else {
      // Source is taller than target: crop source vertically
      const sw = safeSrcW;
      const sh = safeSrcW / dstAspect;
      const sx = 0;
      const sy = (safeSrcH - sh) / 2;

      const scaleX = 1;
      const scaleY = srcAspect / dstAspect;
      const offsetX = 0;
      const offsetY = (1 - scaleY) / 2;

      return { dx, dy, dw, dh, sx, sy, sw, sh, scaleX, scaleY, offsetX, offsetY };
    }
  }

  // mode === 'contain'
  const sx = 0;
  const sy = 0;
  const sw = safeSrcW;
  const sh = safeSrcH;

  if (srcAspect > dstAspect) {
    // Source is wider than target: letterbox top/bottom
    const dw = safeTargetW;
    const dh = safeTargetW / srcAspect;
    const dx = 0;
    const dy = (safeTargetH - dh) / 2;

    const visibleH = dstAspect / srcAspect;
    const scaleX = 1;
    const scaleY = visibleH;
    const offsetX = 0;
    const offsetY = (1 - visibleH) / 2;

    return { dx, dy, dw, dh, sx, sy, sw, sh, scaleX, scaleY, offsetX, offsetY };
  } else {
    // Source is taller than target: pillarbox left/right
    const dh = safeTargetH;
    const dw = safeTargetH * srcAspect;
    const dx = (safeTargetW - dw) / 2;
    const dy = 0;

    const visibleW = srcAspect / dstAspect;
    const scaleX = visibleW;
    const scaleY = 1;
    const offsetX = (1 - visibleW) / 2;
    const offsetY = 0;

    return { dx, dy, dw, dh, sx, sy, sw, sh, scaleX, scaleY, offsetX, offsetY };
  }
}

/**
 * Computes the physical device dimensions and screen surface dimensions
 * so the physical device geometry is strictly independent of the screenshot
 * or video aspect ratio.
 */
export function computeDeviceGeometry(
  spec: DeviceModelSpec,
  containerW: number,
  containerH: number,
  orientation?: 'portrait' | 'landscape'
): DeviceGeometryResult {
  const safeContainerW = Math.max(0.01, containerW);
  const safeContainerH = Math.max(0.01, containerH);

  // undefined orientation = the model's native orientation (no flip).
  const isSpecPortrait = spec.nominalHeight >= spec.nominalWidth;
  const shouldFlip =
    orientation === 'landscape' ? isSpecPortrait : orientation === 'portrait' ? !isSpecPortrait : false;

  const nominalW = shouldFlip ? spec.nominalHeight : spec.nominalWidth;
  const nominalH = shouldFlip ? spec.nominalWidth : spec.nominalHeight;
  const screenNomW = shouldFlip ? spec.screenHeight : spec.screenWidth;
  const screenNomH = shouldFlip ? spec.screenWidth : spec.screenHeight;

  // Scale uniformly within container boundaries
  const scale = Math.min(safeContainerW / nominalW, safeContainerH / nominalH);

  const deviceW = nominalW * scale;
  const deviceH = nominalH * scale;
  const screenW = screenNomW * scale;
  const screenH = screenNomH * scale;

  const minDeviceDim = Math.min(deviceW, deviceH);
  const minScreenDim = Math.min(screenW, screenH);

  const chassisCornerRadius = minDeviceDim * (spec.chassisCornerRadius ?? 0.05);
  const screenCornerRadius = minScreenDim * (spec.screenCornerRadius ?? 0.04);

  return {
    deviceW,
    deviceH,
    screenW,
    screenH,
    chassisCornerRadius,
    screenCornerRadius,
    deviceAspect: deviceW / Math.max(0.0001, deviceH),
    screenAspect: screenW / Math.max(0.0001, screenH),
  };
}

/**
 * Helper to draw an image/video source onto a 2D canvas with sub-crop and contain/cover fit.
 */
export function drawSourceWithFit(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sourceNaturalWidth: number,
  sourceNaturalHeight: number,
  crop: { x: number; y: number; width: number; height: number } | undefined,
  targetX: number,
  targetY: number,
  targetW: number,
  targetH: number,
  mode: ScreenFit = 'contain',
  letterboxBgColor: string = '#0a0a0c'
): void {
  const normCrop = crop || { x: 0, y: 0, width: 1, height: 1 };
  const effectiveCropX = Math.max(0, Math.min(1, normCrop.x)) * sourceNaturalWidth;
  const effectiveCropY = Math.max(0, Math.min(1, normCrop.y)) * sourceNaturalHeight;
  const effectiveCropW = Math.max(1, Math.min(1 - normCrop.x, normCrop.width) * sourceNaturalWidth);
  const effectiveCropH = Math.max(1, Math.min(1 - normCrop.y, normCrop.height) * sourceNaturalHeight);

  if (mode === 'contain') {
    ctx.fillStyle = letterboxBgColor;
    ctx.fillRect(targetX, targetY, targetW, targetH);
  }

  const fit = calculateTextureFit(effectiveCropW, effectiveCropH, targetW, targetH, mode);

  if (mode === 'cover') {
    // Offset source crop by the crop position
    const actualSx = effectiveCropX + fit.sx;
    const actualSy = effectiveCropY + fit.sy;
    ctx.drawImage(
      source,
      actualSx,
      actualSy,
      fit.sw,
      fit.sh,
      targetX + fit.dx,
      targetY + fit.dy,
      fit.dw,
      fit.dh
    );
  } else {
    ctx.drawImage(
      source,
      effectiveCropX,
      effectiveCropY,
      effectiveCropW,
      effectiveCropH,
      targetX + fit.dx,
      targetY + fit.dy,
      fit.dw,
      fit.dh
    );
  }
}
