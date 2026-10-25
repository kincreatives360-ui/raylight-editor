import type { Layer, ScreenFit } from '../../model/types';
import { getImageFitRect } from '../../model/deviceFrame';

export function getMediaTextureSize(width: number, height: number, projected?: {
  pixelWidth: number;
  pixelHeight: number;
  maxTextureSize: number;
}) {
  const aspect = Math.max(0.0001, width) / Math.max(0.0001, height);
  // Two texels per display pixel keep rasterized glyphs and masks sharp after filtering.
  const required = projected ? 2 * Math.max(
    projected.pixelWidth * Math.max(1, 1 / aspect),
    projected.pixelHeight * Math.max(1, aspect),
  ) : 1024;
  const limit = Math.max(1, Math.min(8192, projected?.maxTextureSize ?? 4096));
  const longEdge = Number.isFinite(required)
    ? Math.min(limit, 2 ** Math.ceil(Math.log2(Math.max(1024, required))))
    : limit;
  return aspect >= 1
    ? { width: longEdge, height: Math.max(1, Math.round(longEdge / aspect)) }
    : { width: Math.max(1, Math.round(longEdge * aspect)), height: longEdge };
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
    pixelRatio?: number;
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
      if (options.blurPx) ctx.filter = `blur(${Math.min(28, options.blurPx * 1.5) * (options.pixelRatio ?? 1)}px)`;
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
