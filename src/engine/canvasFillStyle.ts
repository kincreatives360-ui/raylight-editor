import type { Background, Fill } from '../model/types';
import { getGradientRaster } from './canvasGradientRaster';
import { hexToRgba } from './canvasColorUtils';

export function createCanvasFillStyle(
  ctx: CanvasRenderingContext2D,
  fill: Fill | Extract<Background, { kind: 'gradient' }>,
  w: number,
  h: number,
  opacityMultiplier = 1
): string | CanvasGradient | CanvasPattern {
  if (fill.kind === 'solid') {
    return hexToRgba(fill.color, fill.opacity * opacityMultiplier);
  }
  const isRadial = fill.kind === 'gradient' && fill.gradientType === 'radial';
  const isAngular = fill.kind === 'gradient' && fill.gradientType === 'angular';
  const handles = 'handles' in fill ? fill.handles : undefined;
  if (!handles && fill.kind === 'gradient' && ['angular', 'diamond', 'mesh'].includes(fill.gradientType ?? 'linear')) {
    const raster = getGradientRaster(fill as Extract<Fill, { kind: 'gradient' }>, w, h, opacityMultiplier);
    const pattern = raster && ctx.createPattern(raster, 'no-repeat');
    if (pattern) {
      pattern.setTransform(new DOMMatrix().scale(w / raster.width, h / raster.height));
      return pattern;
    }
  }
  const cx = w / 2;
  const cy = h / 2;
  let grad: CanvasGradient;

  if (handles) {
    if (isRadial) {
      const rx = handles.start.x * w;
      const ry = handles.start.y * h;
      const ex = handles.end.x * w;
      const ey = handles.end.y * h;
      const radius = Math.hypot(ex - rx, ey - ry);
      const minorRadius = handles.width === undefined ? radius : Math.max(1, handles.width * h);
      const angle = Math.atan2(ey - ry, ex - rx);
      const scaleY = minorRadius / Math.max(1, radius);

      if (typeof document !== 'undefined' && typeof ctx.createPattern === 'function') {
        try {
          const offscreen = document.createElement('canvas');
          const offW = Math.max(1, Math.round(w));
          const offH = Math.max(1, Math.round(h));
          offscreen.width = offW;
          offscreen.height = offH;
          const offCtx = offscreen.getContext('2d');
          if (offCtx) {
            offCtx.save();
            offCtx.translate(rx, ry);
            offCtx.rotate(angle);
            offCtx.scale(1, scaleY);
            const rGrad = offCtx.createRadialGradient(0, 0, 0, 0, 0, Math.max(1, radius));
            for (const stop of fill.stops) {
              const stopOpacity = (stop.opacity ?? 1) * opacityMultiplier;
              rGrad.addColorStop(
                Math.max(0, Math.min(1, stop.at)),
                hexToRgba(stop.color, stopOpacity)
              );
            }
            offCtx.fillStyle = rGrad;
            const maxDim = Math.hypot(offW, offH) * 2;
            offCtx.fillRect(-maxDim, -maxDim, maxDim * 2, maxDim * 2);
            offCtx.restore();
            const pattern = ctx.createPattern(offscreen, 'no-repeat');
            if (pattern) {
              return pattern;
            }
          }
        } catch {
          // fallback to direct radial gradient
        }
      }

      ctx.save();
      ctx.translate(rx, ry);
      ctx.rotate(angle);
      ctx.scale(1, scaleY);
      grad = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(1, radius));
      ctx.restore();
    } else if (isAngular && typeof ctx.createConicGradient === 'function') {
      grad = ctx.createConicGradient(((fill.angle - 90) * Math.PI) / 180, handles.start.x * w, handles.start.y * h);
    } else {
      grad = ctx.createLinearGradient(
        handles.start.x * w,
        handles.start.y * h,
        handles.end.x * w,
        handles.end.y * h
      );
    }
  } else if (isRadial) {
    grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, w / 2);
  } else if (isAngular && typeof ctx.createConicGradient === 'function') {
    const rad = ((fill.angle - 90) * Math.PI) / 180;
    grad = ctx.createConicGradient(rad, cx, cy);
  } else {
    const rad = ((fill.angle - 90) * Math.PI) / 180;
    grad = ctx.createLinearGradient(
      cx - Math.cos(rad) * w / 2,
      cy - Math.sin(rad) * h / 2,
      cx + Math.cos(rad) * w / 2,
      cy + Math.sin(rad) * h / 2
    );
  }
  for (const stop of fill.stops) {
    const stopOpacity = (stop.opacity ?? 1) * opacityMultiplier;
    grad.addColorStop(
      Math.max(0, Math.min(1, stop.at)),
      hexToRgba(stop.color, stopOpacity)
    );
  }
  return grad;
}

