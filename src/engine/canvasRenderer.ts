import { applyLayerSurfaceEffects, compositeLayerEffectSurface, drawLayerHalo } from '../stage/webgl/layerEffects';
import { applyLayerAlphaEffects } from './layerAlphaEffects';
import { drawMediaShimmer } from '../stage/webgl/mediaDecorations';
// src/engine/canvasRenderer.ts
import type {
  Project,
  Shot,
  ImageLayer,
  VideoLayer,
  ShapeLayer,
  TextLayer,
  Fill,
  GradientStop,
  MeshGradientPoint,
  Background,
  LightRig,
} from '../model/types';
import { resolveShotBackground } from '../model/types';
import {
  evaluateProjectAtTime,
  type EvaluatedProjectFrame,
  type EvaluatedLayerWithEffects,
} from './evaluateShot';
import type { EvaluatedCamera } from './evaluateCamera';
import type { EvaluatedEffects } from './evaluateEffects';
import { getArtboardDimensions } from '../stage/stageUtils';
import { resolveLighting } from './lightingSystem';
import { getShaderColors } from '../model/backgroundPresets';
import { applyCanvasSceneEffects } from './canvasSceneEffects';
import { acquireCanvas, releaseCanvas } from './canvasPool';

const MAX_IMAGE_CACHE_SIZE = 100;
const imageElementCache = new Map<string, HTMLImageElement>();
const MAX_VIDEO_CACHE_SIZE = 20;
const videoElementCache = new Map<string, HTMLVideoElement>();
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

function getGradientRaster(fill: Extract<Fill, { kind: 'gradient' }>, w: number, h: number, opacityMultiplier: number): HTMLCanvasElement | undefined {
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


export function getOrCreateVideoElement(
  dataUrl: string,
  instanceKey?: string
): HTMLVideoElement {
  const cacheKey = instanceKey ? `${dataUrl}::${instanceKey}` : dataUrl;
  let video = videoElementCache.get(cacheKey);
  if (video) {
    videoElementCache.delete(cacheKey);
    videoElementCache.set(cacheKey, video);
    return video;
  }
  if (videoElementCache.size >= MAX_VIDEO_CACHE_SIZE) {
    const oldestKey = videoElementCache.keys().next().value;
    if (oldestKey) {
      const oldVid = videoElementCache.get(oldestKey);
      if (oldVid) {
        oldVid.pause();
        oldVid.removeAttribute('src');
        oldVid.load();
      }
      videoElementCache.delete(oldestKey);
    }
  }
  video = document.createElement('video');
  video.crossOrigin = 'anonymous';
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = dataUrl;
  video.load();
  videoElementCache.set(cacheKey, video);
  if (instanceKey && !videoElementCache.has(dataUrl)) {
    videoElementCache.set(dataUrl, video);
  }
  return video;
}

export function getOrCreateImageElement(dataUrl: string): HTMLImageElement | undefined {
  const img = imageElementCache.get(dataUrl);
  if (img) {
    imageElementCache.delete(dataUrl);
    imageElementCache.set(dataUrl, img);
    return img;
  }
  return undefined;
}

export function clearImageElementCache(): void {
  imageElementCache.clear();
}

export function clearVideoElementCache(): void {
  for (const video of videoElementCache.values()) {
    video.pause();
    video.removeAttribute('src');
    video.load();
  }
  videoElementCache.clear();
}

/**
 * Deterministically seeks a video element to a target timestamp.
 * Awaits decoded frame presentation via requestVideoFrameCallback when available,
 * with bounded timeout and thorough listener cleanup.
 */
export function seekVideoElement(
  video: HTMLVideoElement,
  targetSec: number,
  timeoutMs = 600
): Promise<void> {
  const tolerance = 0.05;

  if (Math.abs(video.currentTime - targetSec) <= tolerance && video.readyState >= 2) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let rvfcHandle: number | null = null;
    let isSettled = false;

    const cleanup = () => {
      isSettled = true;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      if (rvfcHandle !== null && 'cancelVideoFrameCallback' in video) {
        (video as unknown as { cancelVideoFrameCallback: (h: number) => void }).cancelVideoFrameCallback(rvfcHandle);
        rvfcHandle = null;
      }
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
    };

    const onFinish = () => {
      if (isSettled) return;
      cleanup();
      resolve();
    };

    const onError = () => {
      if (isSettled) return;
      cleanup();
      reject(new Error(`Failed to decode video frame at ${targetSec}s.`));
    };

    const onSeeked = () => {
      if (isSettled) return;
      if (typeof (video as unknown as { requestVideoFrameCallback?: unknown }).requestVideoFrameCallback === 'function') {
        rvfcHandle = (video as unknown as { requestVideoFrameCallback: (cb: () => void) => number }).requestVideoFrameCallback(() => {
          onFinish();
        });
      } else {
        onFinish();
      }
    };

    video.addEventListener('seeked', onSeeked, { once: true });
    video.addEventListener('error', onError, { once: true });

    timer = setTimeout(() => {
      if (isSettled) return;
      cleanup();
      if ((video as { error?: MediaError | null }).error) {
        reject(new Error(`Video decode error while seeking to ${targetSec}s.`));
        return;
      }
      if (Math.abs(video.currentTime - targetSec) > tolerance) {
        try {
          video.currentTime = targetSec;
        } catch {
          // Ignore synchronous reassignment failure on timeout fallback
        }
        console.warn(`[Raylight] Video seek to ${targetSec}s timed out (current: ${video.currentTime}s)`);
      }
      resolve(); // Documented fallback to avoid indefinitely stalling export pipeline
    }, timeoutMs);

    try {
      video.currentTime = targetSec;
    } catch (e) {
      cleanup();
      reject(e);
    }
  });
}

export async function syncAndSeekAllProjectVideos(
  project: Project,
  timeMs: number
): Promise<void> {
  const seekPromises: Promise<void>[] = [];
  const frame = evaluateProjectAtTime(project, timeMs);

  const seekShotFrameVideos = (evalFrame: EvaluatedProjectFrame) => {
    for (const evalLayer of evalFrame.layers || []) {
      const layer = evalLayer.layer;
      if (layer.kind === 'video' || layer.kind === 'image') {
        const asset = project.assets[(layer as ImageLayer | VideoLayer).assetId];
        if (asset?.dataUrl && (layer.kind === 'video' || asset.mimeType?.startsWith('video/'))) {
          const video = getOrCreateVideoElement(asset.dataUrl, layer.id);
          const targetSec = Math.max(0, (evalFrame.shotLocalTimeMs - layer.inMs) / 1000);
          if (Number.isFinite(targetSec)) {
            seekPromises.push(seekVideoElement(video, targetSec));
          }
        }
      }
    }
  };

  seekShotFrameVideos(frame);
  if (frame.shotTransition.isTransitioning && frame.shotTransition.outgoingFrame) {
    seekShotFrameVideos(frame.shotTransition.outgoingFrame);
  }

  await Promise.all(seekPromises);
}

export interface ImagePreloadSummary {
  loaded: number;
  failed: number;
  failedUrls: string[];
}

export async function preloadProjectImages(project: Project): Promise<ImagePreloadSummary> {
  const urls = new Set<string>();
  for (const a of Object.values(project.assets || {})) {
    if (a?.dataUrl) urls.add(a.dataUrl);
  }
  if (project.background?.kind === 'image') {
    if (project.background.src) urls.add(project.background.src);
    if (project.background.assetId) {
      const bgAsset = project.assets?.[project.background.assetId];
      if (bgAsset?.dataUrl) urls.add(bgAsset.dataUrl);
    }
  }
  if (project.shots) {
    for (const shot of project.shots) {
      if (shot.background?.kind === 'image') {
        if (shot.background.src) urls.add(shot.background.src);
        if (shot.background.assetId) {
          const shotBgAsset = project.assets?.[shot.background.assetId];
          if (shotBgAsset?.dataUrl) urls.add(shotBgAsset.dataUrl);
        }
      }
    }
  }

  const failedUrls: string[] = [];
  let loadedCount = 0;

  await Promise.all(
    Array.from(urls).map(
      (url) =>
        new Promise<void>((resolve) => {
          if (getOrCreateImageElement(url)) {
            loadedCount++;
            resolve();
            return;
          }
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            if (imageElementCache.size >= MAX_IMAGE_CACHE_SIZE) {
              const oldestKey = imageElementCache.keys().next().value;
              if (oldestKey) imageElementCache.delete(oldestKey);
            }
            imageElementCache.set(url, img);
            loadedCount++;
            resolve();
          };
          img.onerror = () => {
            failedUrls.push(url);
            console.warn('[Raylight Image Preload] Could not load image asset:', url.slice(0, 80));
            resolve();
          };
          img.src = url;
        })
    )
  );

  return {
    loaded: loadedCount,
    failed: failedUrls.length,
    failedUrls,
  };
}

export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.padEnd(6, '0');
  const num = parseInt(full.slice(0, 6), 16) || 0;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;
}

export interface CoverCropCoordinates {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  uOffset: number;
  vOffset: number;
  uRepeat: number;
  vRepeat: number;
}

export function calculateCoverCrop(
  imgW: number,
  imgH: number,
  targetAspect: number
): CoverCropCoordinates {
  const imgAspect = imgW / imgH;
  let sx = 0;
  let sy = 0;
  let sw = imgW;
  let sh = imgH;

  if (imgAspect > targetAspect) {
    sw = imgH * targetAspect;
    sx = (imgW - sw) / 2;
  } else {
    sh = imgW / targetAspect;
    sy = (imgH - sh) / 2;
  }

  const uRepeat = sw / imgW;
  const vRepeat = sh / imgH;
  const uOffset = sx / imgW;
  const vOffset = (imgH - (sy + sh)) / imgH;

  return { sx, sy, sw, sh, uOffset, vOffset, uRepeat, vRepeat };
}

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.closePath();
}

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

function clearShadow(ctx: CanvasRenderingContext2D): void {
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

function drawDefaultImagePlaceholder(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  layerName: string
): void {
  const bgGrad = ctx.createLinearGradient(x, y, x + w, y + h);
  bgGrad.addColorStop(0, '#0c0e17');
  bgGrad.addColorStop(1, '#151928');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(x, y, w, h);

  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = Math.max(1, Math.round(Math.min(w, h) * 0.005));
  ctx.setLineDash([6, 6]);
  const inset = Math.max(8, Math.min(w, h) * 0.05);
  drawRoundedRectPath(
    ctx,
    x + inset,
    y + inset,
    w - inset * 2,
    h - inset * 2,
    Math.max(4, inset * 0.5)
  );
  ctx.stroke();
  ctx.restore();

  const cx = x + w / 2;
  const cy = y + h / 2;
  const iconSize = Math.max(16, Math.min(48, Math.min(w, h) * 0.16));

  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.lineWidth = Math.max(1.5, iconSize * 0.07);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const fx = cx - iconSize;
  const fy = cy - iconSize * 0.85;
  const fw = iconSize * 2;
  const fh = iconSize * 1.5;
  drawRoundedRectPath(ctx, fx, fy, fw, fh, iconSize * 0.2);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(fx + fw * 0.15, fy + fh * 0.82);
  ctx.lineTo(fx + fw * 0.45, fy + fh * 0.42);
  ctx.lineTo(fx + fw * 0.65, fy + fh * 0.62);
  ctx.lineTo(fx + fw * 0.85, fy + fh * 0.35);
  ctx.lineTo(fx + fw * 0.95, fy + fh * 0.82);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(fx + fw * 0.3, fy + fh * 0.32, iconSize * 0.15, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  const fontSize = Math.max(10, Math.min(18, Math.round(h * 0.045)));
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.font = `600 ${fontSize}px Inter, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(
    layerName.length > 28 ? layerName.slice(0, 26) + '...' : layerName,
    cx,
    cy + iconSize * 0.85
  );

  const subFontSize = Math.max(8, Math.min(12, Math.round(fontSize * 0.75)));
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.font = `400 ${subFontSize}px Inter, sans-serif`;
  ctx.fillText(
    'Drop image or choose asset',
    cx,
    cy + iconSize * 0.85 + fontSize + 4
  );
}

// Isolate layers requiring backdrop sampling or distortion (Zero-allocation via pooled canvas).
async function drawLayerOnCanvas(
  ctx: CanvasRenderingContext2D, layer: EvaluatedLayerWithEffects, project: Project,
  frame: Parameters<typeof drawLayerContentOnCanvas>[3], w: number, h: number
): Promise<void> {
  const effects = layer.layer.effects;
  if (!Object.keys(effects).length && layer.glowIntensityOffset <= 0) {
    return drawLayerContentOnCanvas(ctx, layer, project, frame, w, h);
  }
  const surface = acquireCanvas(w, h);
  const content = surface.getContext('2d');
  if (!content) { releaseCanvas(surface); return; }
  try {
    await drawLayerContentOnCanvas(content, {
      ...layer, opacity: 1, glowIntensityOffset: 0, glowRadiusOffset: 0,
      totalBlurPx: Math.max(0, layer.totalBlurPx - (effects.layerBlur ?? 0) * 100),
      layer: { ...layer.layer, effects: {}, blendMode: 'normal' },
    }, project, frame, w, h);
    applyLayerAlphaEffects(surface, effects, 1920, 1080, (frame.shotLocalTimeMs ?? 0) / 1000);
    applyLayerSurfaceEffects(surface, effects, 1920, 1080);
    const halo = drawLayerHalo(surface, effects, layer.glowIntensityOffset, layer.glowRadiusOffset, 8192, 1920, 1080);
    ctx.save();
    ctx.globalCompositeOperation = layer.layer.blendMode === 'add' ? 'lighter' : layer.layer.blendMode === 'normal' ? 'source-over' : layer.layer.blendMode as GlobalCompositeOperation;
    if (halo) {
      ctx.globalAlpha = layer.opacity;
      ctx.drawImage(halo.canvas, -(halo.widthScale - 1) * w / 2, -(halo.heightScale - 1) * h / 2, w * halo.widthScale, h * halo.heightScale);
      releaseCanvas(halo.canvas);
    }
    const artboard = getArtboardDimensions(project.aspectRatio);
    const distanceFactor = Math.max(.35, Math.min(3, 1 / Math.max(.4, 1 + layer.position.z * .65)));
    const zoom = Math.max(.15, frame.camera.zoom) * distanceFactor;
    const composed = compositeLayerEffectSurface(surface, ctx.canvas, effects, {
      opacity: layer.opacity, time: (frame.shotLocalTimeMs ?? 0) / 1000,
      centerX: .5 + (layer.position.x - (frame.camera.target?.x ?? 0) / artboard.width) * zoom,
      centerY: .5 + (layer.position.y - (frame.camera.target?.y ?? 0) / artboard.height) * zoom,
      width: layer.size.width * Math.abs(layer.scale.x) * zoom, height: layer.size.height * Math.abs(layer.scale.y) * zoom,
      viewAngle: 1 - Math.abs(Math.cos(layer.rotation.x) * Math.cos(layer.rotation.y)),
    });
    ctx.globalAlpha = composed ? 1 : layer.opacity;
    if (!composed && (effects.layerBlur ?? 0) > 0) ctx.filter = `blur(${(effects.layerBlur ?? 0) * 100 * w / 1920}px)`;
    ctx.drawImage(composed ?? surface, 0, 0, w, h);
    ctx.restore();
  } finally { releaseCanvas(surface); }
}
async function drawLayerContentOnCanvas(
  ctx: CanvasRenderingContext2D,
  evalLayer: EvaluatedLayerWithEffects,
  project: Project,
  frame: {
    camera: EvaluatedCamera;
    effects: EvaluatedEffects;
    activeShot?: Shot;
    shot?: Shot;
    shotLocalTimeMs?: number;
  },
  canvasW: number,
  canvasH: number
): Promise<void> {
  if (!evalLayer.visible || evalLayer.opacity <= 0.001) return;

  const { layer } = evalLayer;

  const fovRad = (frame.camera.fovDegrees * Math.PI) / 180;
  const perspectivePx = Math.max(
    300,
    canvasH / 2 / Math.tan(Math.max(0.1, fovRad / 2))
  );
  const zPx = evalLayer.position.z * (canvasW * 0.28);
  const depthScale = perspectivePx / Math.max(120, perspectivePx - zPx);
  const cameraZoom = frame.camera.zoom;
  const totalScale = depthScale * cameraZoom;

  const artboard = getArtboardDimensions(project.aspectRatio);
  const normTargetX = (frame.camera.target?.x ?? 0) / artboard.width;
  const normTargetY = (frame.camera.target?.y ?? 0) / artboard.height;
  const relX = (evalLayer.position.x - normTargetX) * canvasW;
  const relY = (evalLayer.position.y - normTargetY) * canvasH;
  const screenCenterX = canvasW / 2 + relX * totalScale;
  const screenCenterY = canvasH / 2 + relY * totalScale;

  const boxW = Math.max(16, evalLayer.size.width * canvasW);
  const boxH = Math.max(16, evalLayer.size.height * canvasH);
  const baseW = boxW;
  const baseH = boxH;

  const rx = evalLayer.rotation.x;
  const ry = evalLayer.rotation.y;
  const rz = evalLayer.rotation.z;

  ctx.save();
  ctx.globalAlpha = evalLayer.opacity;

  if (layer.blendMode !== 'normal') {
    ctx.globalCompositeOperation =
      layer.blendMode === 'add'
        ? 'lighter'
        : (layer.blendMode as GlobalCompositeOperation);
  }

  const motionBlurPx = evalLayer.motionBlur
    ? Math.hypot(evalLayer.motionBlur.x * canvasW, evalLayer.motionBlur.y * canvasH)
    : 0;
  const totalBlur = (evalLayer.totalBlurPx + motionBlurPx) * (canvasW / 1920);
  if (totalBlur > 0.35) {
    ctx.filter = `blur(${totalBlur.toFixed(1)}px)`;
  }

  ctx.translate(screenCenterX, screenCenterY);
  ctx.scale(evalLayer.scale.x * totalScale, evalLayer.scale.y * totalScale);

  ctx.rotate(rz);
  const cosY = Math.cos(ry);
  const cosX = Math.cos(rx);
  const shearXY = Math.sin(rx) * Math.sin(ry) * 0.55;
  const shearYX = -Math.sin(ry) * Math.sin(rx) * 0.25;
  ctx.transform(
    Math.max(0.22, cosY),
    shearYX,
    shearXY,
    Math.max(0.22, cosX),
    0,
    0
  );

  const revealProgress = Math.max(0, Math.min(1, evalLayer.maskSweepProgress ?? 1, evalLayer.pathRevealProgress ?? 1));
  if (revealProgress < 1) {
    ctx.beginPath();
    ctx.rect(
      -baseW / 2,
      -baseH / 2,
      baseW * revealProgress,
      baseH
    );
    ctx.clip();
  }

  if (layer.maskLayerId) {
    const mask = project.shots.flatMap((shot) => shot.layers).find((c) => c.id === layer.maskLayerId);
    if (mask?.kind === 'shape') {
      ctx.beginPath();
      if (mask.shape === 'ellipse') {
        ctx.ellipse(0, 0, baseW / 2, baseH / 2, 0, 0, Math.PI * 2);
      } else if (mask.shape === 'polygon') {
        const points = mask.points?.length ? mask.points : [{ x: 0.5, y: 0 }, { x: 1, y: 0.5 }, { x: 0.5, y: 1 }, { x: 0, y: 0.5 }];
        points.forEach((pt, i) => {
          const px = (pt.x - 0.5) * baseW;
          const py = (pt.y - 0.5) * baseH;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.closePath();
      } else if (mask.shape === 'line' || mask.shape === 'arrow') {
        ctx.rect(-baseW / 2, -Math.max(3, baseH * 0.09), baseW, Math.max(6, baseH * 0.18));
      } else {
        const r = Math.max(0, (mask.cornerRadius || 0) * Math.min(baseW, baseH) * 0.5);
        drawRoundedRectPath(ctx, -baseW / 2, -baseH / 2, baseW, baseH, r);
      }
      ctx.clip();
    }
  }


  if (layer.kind === 'image' || layer.kind === 'video') {
    const imageLayer = layer as ImageLayer | VideoLayer;
    {
      const radius = imageLayer.cornerRadius * Math.min(baseW, baseH) * 0.5;
      for (let step = 4; step >= 1; step--) {
        ctx.fillStyle = '#334155';
        drawRoundedRectPath(ctx, -baseW / 2 - step * 0.7, -baseH / 2 + step * 0.7, baseW, baseH, radius);
        ctx.fill();
      }
      ctx.fillStyle = '#05070d';
      drawRoundedRectPath(ctx, -baseW / 2, -baseH / 2, baseW, baseH, radius);
      ctx.fill();
      clearShadow(ctx);
      ctx.save();
      if (totalBlur <= 0.35) {
        drawRoundedRectPath(ctx, -baseW / 2, -baseH / 2, baseW, baseH, radius);
        ctx.clip();
      }
      const asset = project.assets[imageLayer.assetId];
      const isVideo = layer.kind === 'video' || Boolean(asset?.mimeType?.startsWith('video/'));
      const video = isVideo && asset?.dataUrl ? getOrCreateVideoElement(asset.dataUrl, layer.id) : undefined;
      const image = !isVideo && asset?.dataUrl ? getOrCreateImageElement(asset.dataUrl) : undefined;
      const crop = imageLayer.crop ?? { x: 0, y: 0, width: 1, height: 1 };
      if (video?.videoWidth && video.videoHeight) {
        ctx.drawImage(video, crop.x * video.videoWidth, crop.y * video.videoHeight,
          crop.width * video.videoWidth, crop.height * video.videoHeight, -baseW / 2, -baseH / 2, baseW, baseH);
      } else if (image?.naturalWidth && image.naturalHeight) {
        ctx.drawImage(image, crop.x * image.naturalWidth, crop.y * image.naturalHeight,
          crop.width * image.naturalWidth, crop.height * image.naturalHeight, -baseW / 2, -baseH / 2, baseW, baseH);
      }
      else if (!isVideo) drawDefaultImagePlaceholder(ctx, -baseW / 2, -baseH / 2, baseW, baseH, imageLayer.name);
      ctx.restore();
    }
  } else if (layer.kind === 'shape') {
    const shpLayer = layer as ShapeLayer;

    if (shpLayer.shape === 'line' || shpLayer.shape === 'arrow') {
      const strokeColor = shpLayer.stroke?.color || '#a855f7';
      const strokeW = Math.max(2, (shpLayer.stroke?.width || 0.003) * canvasW);
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeW;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-baseW / 2 + 8, 0);
      ctx.lineTo(baseW / 2 - 12, 0);
      ctx.stroke();

      if (shpLayer.shape === 'arrow') {
        ctx.fillStyle = strokeColor;
        ctx.beginPath();
        ctx.moveTo(baseW / 2, 0);
        ctx.lineTo(baseW / 2 - strokeW * 3.2, -strokeW * 1.8);
        ctx.lineTo(baseW / 2 - strokeW * 3.2, strokeW * 1.8);
        ctx.closePath();
        ctx.fill();
      }
    } else {
      const radiusPx =
        shpLayer.shape === 'ellipse'
          ? Math.min(baseW, baseH) / 2
          : shpLayer.cornerRadius * Math.min(baseW, baseH) * 0.5;

      ctx.fillStyle = createCanvasFillStyle(ctx, shpLayer.fill, baseW, baseH, 1);
      if (shpLayer.shape === 'polygon') {
        const points = shpLayer.points?.length
          ? shpLayer.points
          : [
              { x: 0.5, y: 0 },
              { x: 1, y: 0.5 },
              { x: 0.5, y: 1 },
              { x: 0, y: 0.5 },
            ];
        ctx.beginPath();
        points.forEach((pt, i) => {
          const x = (pt.x - 0.5) * baseW;
          const y = (pt.y - 0.5) * baseH;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
      } else if (shpLayer.shape === 'ellipse') {
        ctx.beginPath();
        ctx.ellipse(0, 0, baseW / 2, baseH / 2, 0, 0, Math.PI * 2);
      } else {
        drawRoundedRectPath(ctx, -baseW / 2, -baseH / 2, baseW, baseH, radiusPx);
      }
      ctx.fill();

      if (shpLayer.stroke && shpLayer.stroke.width > 0) {
        clearShadow(ctx);
        ctx.strokeStyle = hexToRgba(
          shpLayer.stroke.color,
          shpLayer.stroke.opacity
        );
        ctx.lineWidth = Math.max(1.5, shpLayer.stroke.width * canvasW);
        ctx.stroke();
      }
    }
    clearShadow(ctx);
  } else if (layer.kind === 'text') {
    const txtLayer = layer as TextLayer;
    const fontSizePx = Math.max(12, txtLayer.font.size * canvasH);

    ctx.font = `${txtLayer.font.weight} ${Math.round(fontSizePx)}px ${
      txtLayer.font.family
    }, Inter, sans-serif`;
    ctx.fillStyle = txtLayer.font.color;
    ctx.textAlign = txtLayer.font.align;
    ctx.textBaseline = 'middle';

    const alignX =
      txtLayer.font.align === 'left'
        ? -baseW / 2
        : txtLayer.font.align === 'right'
          ? baseW / 2
          : 0;
    const lines = (evalLayer.textContentOverride ?? txtLayer.content).split('\n');
    const lineHeight = fontSizePx * (txtLayer.font.lineHeight ?? 1.22);
    const startY = txtLayer.verticalAlign === 'top' ? -baseH / 2 + fontSizePx / 2 : txtLayer.verticalAlign === 'bottom' ? baseH / 2 - fontSizePx / 2 - (lines.length - 1) * lineHeight : -((lines.length - 1) * lineHeight) / 2;
    ctx.letterSpacing = ((txtLayer.font.letterSpacing || 0) * canvasH / 1080) + 'px';
    lines.forEach((line, index) => ctx.fillText(line, alignX, startY + index * lineHeight));
    clearShadow(ctx);
  }

  if (evalLayer.shimmerProgress > 0 && evalLayer.shimmerProgress < 1) {
    ctx.save();
    ctx.filter = 'none';
    ctx.translate(-baseW / 2, -baseH / 2);
    drawMediaShimmer(ctx, baseW, baseH, evalLayer.shimmerProgress, evalLayer.shimmerSettings);
    ctx.restore();
  }
  ctx.restore();
}

export function renderSceneLightSources(
  ctx: CanvasRenderingContext2D,
  light: LightRig | undefined,
  camera: EvaluatedCamera,
  canvasW: number,
  canvasH: number,
  aspectRatio?: Project['aspectRatio']
): void {
  if (!light) return;
  const resolved = resolveLighting(light);
  const artboard = getArtboardDimensions(aspectRatio);
  const targetX = (camera.target?.x ?? 0) / artboard.width;
  const targetY = (camera.target?.y ?? 0) / artboard.height;
  const cameraZoom = Math.max(0.15, camera.zoom);
  const projectPosition = (x: number, y: number) => ({
    x: canvasW / 2 + (x - targetX) * canvasW * cameraZoom,
    y: canvasH / 2 - (y - targetY) * canvasH * cameraZoom,
  });
  const drawWash = (color: string, intensity: number, dx: number, dy: number) => {
    if (intensity <= 0.001) return;
    const length = Math.hypot(dx, dy) || 1;
    const ux = dx / length;
    const uy = dy / length;
    const startX = canvasW / 2 + ux * canvasW * 0.58;
    const startY = canvasH / 2 - uy * canvasH * 0.58;
    const endX = canvasW / 2 - ux * canvasW * 0.42;
    const endY = canvasH / 2 + uy * canvasH * 0.42;
    const gradient = ctx.createLinearGradient(startX, startY, endX, endY);
    gradient.addColorStop(0, hexToRgba(color, Math.min(0.38, intensity * 0.12)));
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvasW, canvasH);
    ctx.restore();
  };

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = hexToRgba(resolved.room.environmentTint, Math.min(0.22, resolved.room.intensity * 0.08));
  ctx.fillRect(0, 0, canvasW, canvasH);
  ctx.restore();

  const keyPosition = projectPosition(light.position?.x ?? -0.28, light.position?.y ?? 0.36);
  const keyTarget = projectPosition(light.target?.x ?? 0, light.target?.y ?? 0);
  if (resolved.key.enabled) {
    drawWash(resolved.key.color, resolved.key.intensity, keyTarget.x - keyPosition.x, keyTarget.y - keyPosition.y);
  }
  if (resolved.fill.enabled) {
    drawWash(resolved.fill.color, resolved.fill.intensity, -keyTarget.x + keyPosition.x, -keyTarget.y + keyPosition.y);
  }

  const sourceById = new Map((light.sources ?? []).map((source) => [source.id, source]));
  for (const source of resolved.sources) {
    const model = sourceById.get(source.id);
    if (!model) continue;
    const position = projectPosition(model.position.x, model.position.y);
    const target = projectPosition(model.target?.x ?? 0, model.target?.y ?? 0);
    const baseIntensity = source.type === 'ambient' ? source.intensity * 0.5 : source.intensity;
    if (baseIntensity <= 0.001) continue;

    if (source.type === 'ambient') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = hexToRgba(source.color, Math.min(0.25, baseIntensity * 0.06));
      ctx.fillRect(0, 0, canvasW, canvasH);
      ctx.restore();
      continue;
    }
    if (source.type === 'directional') {
      drawWash(source.color, source.intensity, target.x - position.x, target.y - position.y);
      continue;
    }

    const radius = source.distance > 0
      ? Math.max(24, source.distance * canvasW * 0.07 * cameraZoom)
      : Math.max(canvasW, canvasH);
    const centerAlpha = Math.min(0.45, baseIntensity * 0.2);
    const halfDistanceFalloff = Math.pow(0.5, source.decay);
    const gradient = ctx.createRadialGradient(position.x, position.y, 0, position.x, position.y, radius);
    gradient.addColorStop(0, hexToRgba(source.color, centerAlpha));
    gradient.addColorStop(source.type === 'spot' ? 0.62 : 0.5, hexToRgba(source.color, Math.min(0.2, centerAlpha * halfDistanceFalloff)));
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (source.type === 'spot') {
      const direction = Math.atan2(target.y - position.y, target.x - position.x);
      ctx.translate(position.x, position.y);
      ctx.rotate(direction);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, -source.angle, source.angle);
      ctx.closePath();
      ctx.clip();
      ctx.fillStyle = gradient;
      ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
    } else if (source.type === 'area') {
      const width = Math.max(24, source.width * canvasW * 0.1 * cameraZoom);
      const height = Math.max(24, source.height * canvasH * 0.1 * cameraZoom);
      const direction = Math.atan2(target.y - position.y, target.x - position.x);
      ctx.translate(position.x, position.y);
      ctx.rotate(direction);
      ctx.fillStyle = gradient;
      ctx.fillRect(-width / 2, -height / 2, width, height);
    } else {
      ctx.fillStyle = gradient;
      ctx.fillRect(position.x - radius, position.y - radius, radius * 2, radius * 2);
    }
    ctx.restore();
  }
}
function renderSingleBackground(
  ctx: CanvasRenderingContext2D,
  project: Project,
  bg: Background,
  canvasW: number,
  canvasH: number,
  alpha = 1,
  offsetX = 0
): void {
  if (bg.kind === 'transparent') {
    return;
  }

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  if (offsetX !== 0) {
    ctx.translate(offsetX, 0);
  }

  if (bg.kind === 'solid') {
    const opacity = bg.opacity ?? 1;
    ctx.fillStyle = hexToRgba(bg.color, opacity);
    ctx.fillRect(0, 0, canvasW, canvasH);
  } else if (bg.kind === 'gradient') {
    ctx.fillStyle = createCanvasFillStyle(
      ctx,
      {
        kind: 'gradient',
        angle: bg.angle,
        stops: bg.stops,
        gradientType: bg.gradientType,
        handles: bg.handles,
      },
      canvasW,
      canvasH,
      1
    );
    ctx.fillRect(0, 0, canvasW, canvasH);
  } else if (bg.kind === 'noise') {
    ctx.fillStyle = bg.baseColor || '#0a0a0c';
    ctx.fillRect(0, 0, canvasW, canvasH);
    const noiseIntensity = Math.max(0, Math.min(1, bg.intensity ?? 0.2));
    if (noiseIntensity > 0) {
      const dotsCount = Math.min(2500, Math.round((canvasW * canvasH) / 600));
      ctx.fillStyle = `rgba(255,255,255,${(noiseIntensity * 0.25).toFixed(3)})`;
      let seed = 1234567;
      for (let i = 0; i < dotsCount; i++) {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        const gx = (seed / 4294967296) * canvasW;
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        const gy = (seed / 4294967296) * canvasH;
        ctx.fillRect(gx, gy, 1.5, 1.5);
      }
    }
  } else if (bg.kind === 'shader') {
    const baseColor = bg.backgroundColor || '#000102';
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, canvasW, canvasH);

    const palette = getShaderColors(
      bg.preset,
      bg.colors,
      bg.color,
      bg.backgroundColor,
      bg.color1,
      bg.color2,
      bg.color3
    );
    const colors = palette.length > 0 ? palette : [bg.color || '#38bdf8', bg.backgroundColor || '#0c0e17'];
    const grad = ctx.createLinearGradient(0, 0, canvasW, canvasH);
    colors.forEach((c, idx) => {
      grad.addColorStop(idx / Math.max(1, colors.length - 1), c);
    });
    ctx.globalAlpha *= 0.75;
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvasW, canvasH);
  } else if (bg.kind === 'image') {
    const dataUrl = bg.src || (bg.assetId ? project.assets[bg.assetId]?.dataUrl : undefined);
    const backdropColor = bg.color || '#000000';

    if (bg.fit === 'contain') {
      ctx.fillStyle = backdropColor;
      ctx.fillRect(0, 0, canvasW, canvasH);
    }

    if (dataUrl) {
      const img = getOrCreateImageElement(dataUrl);
      const imgOpacity = bg.opacity ?? 1;
      ctx.globalAlpha *= imgOpacity;

      if (bg.blur && bg.blur > 0) {
        ctx.filter = `blur(${bg.blur}px)`;
      }

      if (img && img.complete) {
        const imgW = img.naturalWidth || img.width;
        const imgH = img.naturalHeight || img.height;
        if (imgW > 0 && imgH > 0) {
          const canvasAspect = canvasW / canvasH;
          if (bg.fit === 'contain') {
            const imgAspect = imgW / imgH;
            let dw = canvasW;
            let dh = canvasH;
            let dx = 0;
            let dy = 0;
            if (imgAspect > canvasAspect) {
              dh = canvasW / imgAspect;
              dy = (canvasH - dh) / 2;
            } else {
              dw = canvasH * imgAspect;
              dx = (canvasW - dw) / 2;
            }
            ctx.drawImage(img, 0, 0, imgW, imgH, dx, dy, dw, dh);
          } else {
            const crop = calculateCoverCrop(imgW, imgH, canvasAspect);
            ctx.drawImage(
              img,
              crop.sx,
              crop.sy,
              crop.sw,
              crop.sh,
              0,
              0,
              canvasW,
              canvasH
            );
          }
        } else {
          ctx.drawImage(img, 0, 0, canvasW, canvasH);
        }
      } else {
        ctx.fillStyle = backdropColor;
        ctx.fillRect(0, 0, canvasW, canvasH);
      }
    } else {
      ctx.fillStyle = backdropColor;
      ctx.fillRect(0, 0, canvasW, canvasH);
    }

    if (bg.dim && bg.dim > 0) {
      ctx.filter = 'none';
      ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(1, bg.dim)})`;
      ctx.fillRect(0, 0, canvasW, canvasH);
    }
  } else {
    ctx.fillStyle = '#0a0a0c';
    ctx.fillRect(0, 0, canvasW, canvasH);
  }

  ctx.restore();
}

export async function renderProjectFrameToCanvas(
  ctx: CanvasRenderingContext2D,
  project: Project,
  frame: EvaluatedProjectFrame,
  canvasW: number,
  canvasH: number
): Promise<void> {
  const syncFrameVideoLayers = (evalFrame: EvaluatedProjectFrame) => {
    for (const evalLayer of evalFrame.layers) {
      const layer = evalLayer.layer;
      if (layer.kind === 'image' || layer.kind === 'video') {
        const asset = project.assets[layer.assetId];
        if ((layer.kind === 'video' || asset?.mimeType?.startsWith('video/')) && asset?.dataUrl) {
          const video = getOrCreateVideoElement(asset.dataUrl, layer.id);
          const targetSec = Math.max(0, (evalFrame.shotLocalTimeMs - layer.inMs) / 1000);
          if (Number.isFinite(targetSec) && Math.abs(video.currentTime - targetSec) > 0.04) {
            video.currentTime = targetSec;
          }
        }
      }
    }
  };

  // Sync any video layers to the exact shot-local frame time
  syncFrameVideoLayers(frame);
  if (frame.shotTransition.isTransitioning && frame.shotTransition.outgoingFrame) {
    syncFrameVideoLayers(frame.shotTransition.outgoingFrame);
  }

  ctx.save();
  ctx.clearRect(0, 0, canvasW, canvasH);

  // 1. Stage Background & Shot Transition Compositing
  const incomingBg = resolveShotBackground(project, frame.activeShot);
  const transType = frame.shotTransition.type;
  const transProgress = frame.shotTransition.progress;
  const outgoing = frame.shotTransition.outgoingFrame;

  let outgoingOpacity = 1;
  let outgoingSlideX = 0;
  let incomingOpacity = 1;
  let incomingSlideX = 0;

  if (outgoing && transProgress < 1) {
    if (transType === 'crossfade') {
      outgoingOpacity = 1 - transProgress;
      incomingOpacity = transProgress;
    } else if (transType === 'push') {
      outgoingSlideX = -transProgress * canvasW;
      incomingSlideX = (1 - transProgress) * canvasW;
    } else if (transType === 'slide') {
      outgoingSlideX = -transProgress * canvasW * 0.25;
      incomingSlideX = (1 - transProgress) * canvasW;
    }

    // 1. True per-shot isolated render of Outgoing Shot + Outgoing Post-Processing
    const outgoingCanvas = acquireCanvas(canvasW, canvasH);
    const outgoingCtx = outgoingCanvas.getContext('2d');
    if (outgoingCtx) {
      const outgoingBg = resolveShotBackground(project, outgoing.activeShot);
      renderSingleBackground(outgoingCtx, project, outgoingBg, canvasW, canvasH, 1, 0);
      for (const outLayer of outgoing.layers) {
        await drawLayerOnCanvas(outgoingCtx, outLayer, project, outgoing, canvasW, canvasH);
      }
      renderSceneLightSources(
        outgoingCtx,
        outgoing.activeShot.light,
        outgoing.camera,
        canvasW,
        canvasH,
        project.aspectRatio
      );
      if (outgoing.effects.orderedEnabledPasses.some(pass => pass.key !== 'depthOfField')) {
        const outImg = outgoingCtx.getImageData(0, 0, canvasW, canvasH);
        applyCanvasSceneEffects(outImg.data, canvasW, canvasH, outgoing.effects);
        outgoingCtx.putImageData(outImg, 0, 0);
      }
    }

    // 2. True per-shot isolated render of Incoming Shot + Incoming Post-Processing
    const incomingCanvas = acquireCanvas(canvasW, canvasH);
    const incomingCtx = incomingCanvas.getContext('2d');
    if (incomingCtx) {
      renderSingleBackground(incomingCtx, project, incomingBg, canvasW, canvasH, 1, 0);
      for (const evalLayer of frame.layers) {
        await drawLayerOnCanvas(incomingCtx, evalLayer, project, frame, canvasW, canvasH);
      }
      renderSceneLightSources(
        incomingCtx,
        frame.activeShot.light,
        frame.camera,
        canvasW,
        canvasH,
        project.aspectRatio
      );
      if (frame.effects.orderedEnabledPasses.some(pass => pass.key !== 'depthOfField')) {
        const inImg = incomingCtx.getImageData(0, 0, canvasW, canvasH);
        applyCanvasSceneEffects(inImg.data, canvasW, canvasH, frame.effects);
        incomingCtx.putImageData(inImg, 0, 0);
      }
    }

    // 3. Composite both post-processed shots with transition transforms
    if (outgoingCtx) {
      ctx.save();
      ctx.globalAlpha = outgoingOpacity;
      if (outgoingSlideX !== 0) ctx.translate(outgoingSlideX, 0);
      ctx.drawImage(outgoingCanvas, 0, 0);
      ctx.restore();
    }

    if (incomingCtx) {
      ctx.save();
      ctx.globalAlpha = incomingOpacity;
      if (incomingSlideX !== 0) ctx.translate(incomingSlideX, 0);
      ctx.drawImage(incomingCanvas, 0, 0);
      ctx.restore();
    }

    releaseCanvas(outgoingCanvas);
    releaseCanvas(incomingCanvas);
  } else {
    // Non-transitioning single shot: render directly to destination canvas
    renderSingleBackground(ctx, project, incomingBg, canvasW, canvasH, 1, 0);

    ctx.save();
    ctx.globalAlpha = incomingOpacity;
    if (incomingSlideX !== 0) ctx.translate(incomingSlideX, 0);

    for (const evalLayer of frame.layers) {
      await drawLayerOnCanvas(ctx, evalLayer, project, frame, canvasW, canvasH);
    }

    renderSceneLightSources(
      ctx,
      frame.activeShot.light,
      frame.camera,
      canvasW,
      canvasH,
      project.aspectRatio
    );
    ctx.restore();

    if (frame.effects.orderedEnabledPasses.some(pass => pass.key !== 'depthOfField')) {
      const image = ctx.getImageData(0, 0, canvasW, canvasH);
      applyCanvasSceneEffects(image.data, canvasW, canvasH, frame.effects);
      ctx.putImageData(image, 0, 0);
    }
  }

  ctx.restore();
}





