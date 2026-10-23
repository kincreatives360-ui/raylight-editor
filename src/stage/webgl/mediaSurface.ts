import type { Layer, ScreenFit } from '../../model/types';
import { getImageFitRect } from '../../model/deviceFrame';

export function getMediaTextureSize(width: number, height: number, maxDimension: number = 1024) {
  const aspect = Math.max(0.0001, width) / Math.max(0.0001, height);
  return aspect >= 1
    ? { width: maxDimension, height: Math.max(1, Math.round(maxDimension / aspect)) }
    : { width: Math.max(1, Math.round(maxDimension * aspect)), height: maxDimension };
}

export function drawMediaFrame(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  naturalWidth: number,
  naturalHeight: number,
  width: number,
  height: number,
  options: {
    fit: ScreenFit;
    crop?: { x: number; y: number; width: number; height: number };
    fillColor?: string;
    blurPx?: number;
    pan?: { x: number; y: number };
    zoom?: number;
  }
): void {
  ctx.save();
  ctx.clearRect(0, 0, width, height);
  if (options.fillColor) {
    ctx.fillStyle = options.fillColor;
    ctx.fillRect(0, 0, width, height);
  }
  if (naturalWidth > 0 && naturalHeight > 0) {
    const crop = options.crop ?? { x: 0, y: 0, width: 1, height: 1 };
    const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
    const x = clamp(crop.x) * naturalWidth;
    const y = clamp(crop.y) * naturalHeight;
    const cropWidth = Math.min(clamp(crop.width) * naturalWidth, naturalWidth - x);
    const cropHeight = Math.min(clamp(crop.height) * naturalHeight, naturalHeight - y);
    if (cropWidth > 0 && cropHeight > 0) {
      const rect = getImageFitRect(cropWidth, cropHeight, width, height, options.fit, options.pan, options.zoom);
      if (options.blurPx) ctx.filter = `blur(${Math.min(28, options.blurPx * 1.5)}px)`;
      if (typeof ctx.beginPath === 'function') {
        ctx.beginPath();
        if (typeof ctx.rect === 'function') ctx.rect(0, 0, width, height);
        if (typeof ctx.clip === 'function') ctx.clip();
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(source, x + rect.sourceX, y + rect.sourceY, rect.sourceWidth, rect.sourceHeight,
        rect.targetX, rect.targetY, rect.targetWidth, rect.targetHeight);
    }
  }
  ctx.restore();
}

export function getLayerSurfaceState(layer: Layer, framed: boolean, opacity: number, visible = true) {
  const alpha = Math.max(0, Math.min(1, Number.isFinite(opacity) ? opacity : 1));
  return {
    visible: visible && !layer.hidden && alpha > 0,
    receivesLight: framed ? false : layer.receivesLight ?? layer.kind !== 'text',
    surfaceOpacity: framed ? 1 : alpha,
    assemblyOpacity: framed ? alpha : 1,
  };
}
