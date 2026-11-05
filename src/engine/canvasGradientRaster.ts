import type { Fill, GradientStop, MeshGradientPoint } from '../model/types';

const MAX_GRADIENT_RASTER_CACHE = 10;
const gradientRasterCache = new Map<string, HTMLCanvasElement>();

function parseGradientColor(color: string): [number, number, number] {
  const clean = color.replace('#', '');
  const expanded = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const value = Number.parseInt(expanded.slice(0, 6), 16);
  return Number.isFinite(value) ? [(value >> 16) & 255, (value >> 8) & 255, value & 255] : [0, 0, 0];
}

export function sampleStops(stops: GradientStop[], t: number): [number, number, number, number] {
  const sorted = [...stops].sort((a, b) => a.at - b.at);
  if (!sorted.length) return [0, 0, 0, 0];
  const rightIndex = sorted.findIndex((stop) => stop.at >= t);
  const right = rightIndex < 0 ? sorted[sorted.length - 1] : sorted[rightIndex];
  const left = rightIndex < 0 ? right : rightIndex === 0 ? sorted[0] : sorted[rightIndex - 1];
  const span = right.at - left.at;
  const mix = span <= 0 ? 0 : Math.max(0, Math.min(1, (t - left.at) / span));
  const a = parseGradientColor(left.color);
  const b = parseGradientColor(right.color);
  return [
    a[0] + (b[0] - a[0]) * mix,
    a[1] + (b[1] - a[1]) * mix,
    a[2] + (b[2] - a[2]) * mix,
    (left.opacity ?? 1) + ((right.opacity ?? 1) - (left.opacity ?? 1)) * mix,
  ];
}

/** Samples non-linear gradient fills in normalized coordinates for previews and raster output. */
export function sampleLayerGradient(
  fill: Extract<Fill, { kind: 'gradient' }>,
  x: number,
  y: number
): [number, number, number, number] {
  const nx = x - 0.5;
  const ny = y - 0.5;
  const angle = (fill.angle * Math.PI) / 180;
  if (fill.gradientType === 'mesh' && fill.mesh?.length === 9) {
    let total = 0;
    const channels = [0, 0, 0, 0];
    for (const point of fill.mesh as MeshGradientPoint[]) {
      const distance = Math.hypot(x - point.x, y - point.y);
      if (distance < 1e-6) return [...parseGradientColor(point.color), point.opacity];
      const weight = 1 / Math.pow(distance, 4);
      const rgb = parseGradientColor(point.color);
      channels[0] += rgb[0] * weight;
      channels[1] += rgb[1] * weight;
      channels[2] += rgb[2] * weight;
      channels[3] += point.opacity * weight;
      total += weight;
    }
    return channels.map((value) => value / total) as [number, number, number, number];
  }
  const rotatedX = nx * Math.cos(angle) + ny * Math.sin(angle);
  const rotatedY = -nx * Math.sin(angle) + ny * Math.cos(angle);
  let t: number;
  if (fill.gradientType === 'angular') {
    t = ((Math.atan2(ny, nx) - angle) / (Math.PI * 2) + 1) % 1;
  } else if (fill.gradientType === 'diamond') {
    t = Math.min(1, (Math.abs(rotatedX) + Math.abs(rotatedY)) * 2);
  } else {
    t = Math.min(1, Math.hypot(nx, ny) * 2);
  }
  return sampleStops(fill.stops, t);
}

export function getGradientRaster(fill: Extract<Fill, { kind: 'gradient' }>, w: number, h: number, opacityMultiplier: number): HTMLCanvasElement | undefined {
  if (typeof document === 'undefined') return undefined;
  const width = Math.max(1, Math.min(1024, Math.round(w)));
  const height = Math.max(1, Math.min(1024, Math.round(h)));
  const key = JSON.stringify([width, height, fill.gradientType, fill.angle, fill.stops, fill.mesh, opacityMultiplier]);
  const cached = gradientRasterCache.get(key);
  if (cached) {
    gradientRasterCache.delete(key);
    gradientRasterCache.set(key, cached);
    return cached;
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;
  const image = ctx.createImageData(width, height);
  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const rgba = sampleLayerGradient(fill, (px + 0.5) / width, (py + 0.5) / height);
      const i = (py * width + px) * 4;
      image.data[i] = rgba[0]; image.data[i + 1] = rgba[1]; image.data[i + 2] = rgba[2]; image.data[i + 3] = rgba[3] * opacityMultiplier * 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  gradientRasterCache.set(key, canvas);
  if (gradientRasterCache.size > MAX_GRADIENT_RASTER_CACHE) gradientRasterCache.delete(gradientRasterCache.keys().next().value!);
  return canvas;
}


