// src/engine/canvasRenderer.ts
import type {
  Project,
  Shot,
  ImageLayer,
  VideoLayer,
  ShapeLayer,
  TextLayer,
  Fill,
  Background,
  LayerBase,
  LightRig,
} from '../model/types';
import { resolveShotBackground } from '../model/types';
import { radToDeg } from '../model/defaults';
import type {
  EvaluatedProjectFrame,
  EvaluatedLayerWithEffects,
} from './evaluateShot';
import type { EvaluatedCamera } from './evaluateCamera';
import type { EvaluatedEffects } from './evaluateEffects';
import { kelvinToRgb } from '../stage/stageUtils';
import { resolveKeyIntensity } from './lightMath';

const imageElementCache = new Map<string, HTMLImageElement>();
const videoElementCache = new Map<string, HTMLVideoElement>();

export function getOrCreateVideoElement(dataUrl: string): HTMLVideoElement {
  let video = videoElementCache.get(dataUrl);
  if (!video) {
    video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = dataUrl;
    video.load();
    videoElementCache.set(dataUrl, video);
  }
  return video;
}

export async function syncAndSeekAllProjectVideos(
  project: Project,
  timeMs: number
): Promise<void> {
  const seekPromises: Promise<void>[] = [];

  for (const shot of project.shots || []) {
    for (const layer of shot.layers || []) {
      if (layer.kind === 'video' || layer.kind === 'image') {
        const asset = project.assets[(layer as ImageLayer | VideoLayer).assetId];
        if (asset?.dataUrl && (layer.kind === 'video' || asset.mimeType?.startsWith('video/'))) {
          const video = getOrCreateVideoElement(asset.dataUrl);
          const targetSec = Math.max(0, (timeMs - layer.inMs) / 1000);
          if (Number.isFinite(targetSec)) {
            if (Math.abs(video.currentTime - targetSec) > 0.03) {
              const p = new Promise<void>((resolve) => {
                let resolved = false;
                const done = () => {
                  if (!resolved) {
                    resolved = true;
                    video.removeEventListener('seeked', done);
                    resolve();
                  }
                };
                video.addEventListener('seeked', done, { once: true });
                setTimeout(done, 80);
                video.currentTime = targetSec;
              });
              seekPromises.push(p);
            }
          }
        }
      }
    }
  }

  await Promise.all(seekPromises);
}

export async function preloadProjectImages(project: Project): Promise<void> {
  const urls = new Set<string>();
  for (const a of Object.values(project.assets || {})) {
    if (a?.dataUrl) urls.add(a.dataUrl);
  }
  if (project.background?.kind === 'image' && project.background.assetId) {
    const bgAsset = project.assets?.[project.background.assetId];
    if (bgAsset?.dataUrl) urls.add(bgAsset.dataUrl);
  }
  if (project.shots) {
    for (const shot of project.shots) {
      if (shot.background?.kind === 'image' && shot.background.assetId) {
        const shotBgAsset = project.assets?.[shot.background.assetId];
        if (shotBgAsset?.dataUrl) urls.add(shotBgAsset.dataUrl);
      }
    }
  }
  await Promise.all(
    Array.from(urls).map(
      (url) =>
        new Promise<void>((resolve) => {
          if (imageElementCache.has(url)) {
            resolve();
            return;
          }
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            imageElementCache.set(url, img);
            resolve();
          };
          img.onerror = () => resolve();
          img.src = url;
        })
    )
  );
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
): string | CanvasGradient {
  if (fill.kind === 'solid') {
    return hexToRgba(fill.color, fill.opacity * opacityMultiplier);
  }
  const isRadial = fill.kind === 'gradient' && fill.gradientType === 'radial';
  const cx = w / 2;
  const cy = h / 2;
  const len = Math.hypot(w, h) / 2;
  let grad: CanvasGradient;
  if (isRadial) {
    grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, len);
  } else {
    const rad = ((fill.angle - 90) * Math.PI) / 180;
    grad = ctx.createLinearGradient(
      cx - Math.cos(rad) * len,
      cy - Math.sin(rad) * len,
      cx + Math.cos(rad) * len,
      cy + Math.sin(rad) * len
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

function applyLayerShadowOrGlow(
  ctx: CanvasRenderingContext2D,
  effects: LayerBase['effects'],
  canvasW: number,
  canvasH: number,
  bloomMultiplier: number,
  glowIntensityOffset: number = 0,
  glowRadiusOffset: number = 0
): void {
  const currentGlowIntensity = (effects.glow?.enabled ? effects.glow.intensity : 0) + glowIntensityOffset;
  const currentGlowRadius = (effects.glow?.enabled ? effects.glow.radius : 0.05) + glowRadiusOffset;
  const glowColor = effects.glow?.color || '#0088ff';

  if (currentGlowIntensity > 0) {
    ctx.shadowColor = hexToRgba(
      glowColor,
      Math.min(1, currentGlowIntensity * 0.8 * bloomMultiplier)
    );
    ctx.shadowBlur = Math.max(
      10,
      currentGlowRadius * Math.max(canvasW, canvasH) * bloomMultiplier
    );
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  } else if (effects.dropShadow?.enabled) {
    const ds = effects.dropShadow;
    ctx.shadowColor = hexToRgba(ds.color, ds.opacity);
    ctx.shadowBlur = ds.blur * Math.max(canvasW, canvasH);
    ctx.shadowOffsetX = ds.offsetX * canvasW;
    ctx.shadowOffsetY = ds.offsetY * canvasH;
  } else {
    clearShadow(ctx);
  }
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

function drawLayerOnCanvas(
  ctx: CanvasRenderingContext2D,
  evalLayer: EvaluatedLayerWithEffects,
  project: Project,
  frame: {
    camera: EvaluatedCamera;
    effects: EvaluatedEffects;
    activeShot?: Shot;
    shot?: Shot;
  },
  canvasW: number,
  canvasH: number
): void {
  if (!evalLayer.visible || evalLayer.opacity <= 0.001) return;

  const { layer } = evalLayer;
  const light: LightRig = frame.activeShot?.light ||
    frame.shot?.light || {
      position: { x: -0.2, y: -0.3, z: 0.8 },
      intensity: 1,
      temperature: 5500,
      ambience: 0.5,
      sources: [],
    };
  const eff = frame.effects.state;

  const fovRad = (frame.camera.fovDegrees * Math.PI) / 180;
  const perspectivePx = Math.max(
    300,
    canvasH / 2 / Math.tan(Math.max(0.1, fovRad / 2))
  );
  const zPx = evalLayer.position.z * (canvasW * 0.28);
  const depthScale = perspectivePx / Math.max(120, perspectivePx - zPx);
  const cameraZoom = frame.camera.zoom;
  const totalScale = depthScale * cameraZoom;

  const relX = (evalLayer.position.x - frame.camera.target.x) * canvasW;
  const relY = (evalLayer.position.y - frame.camera.target.y) * canvasH;
  const screenCenterX = canvasW / 2 + relX * totalScale;
  const screenCenterY = canvasH / 2 + relY * totalScale;

  const baseW = Math.max(16, evalLayer.size.width * canvasW);
  const baseH = Math.max(16, evalLayer.size.height * canvasH);

  const rx = evalLayer.rotation.x;
  const ry = evalLayer.rotation.y;
  const rz = evalLayer.rotation.z;
  const rotXDeg = radToDeg(rx);
  const rotYDeg = radToDeg(ry);

  ctx.save();
  ctx.globalAlpha = evalLayer.opacity;

  if (layer.blendMode !== 'normal') {
    ctx.globalCompositeOperation =
      layer.blendMode === 'add'
        ? 'lighter'
        : (layer.blendMode as GlobalCompositeOperation);
  }

  const motionBlurAdd = eff.motionBlur.enabled
    ? (eff.motionBlur.shutterAngle / 360) * 1.5
    : 0;
  const totalBlur = (evalLayer.totalBlurPx + motionBlurAdd) * (canvasW / 960);
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

  if (evalLayer.maskSweepProgress < 1) {
    ctx.beginPath();
    ctx.rect(
      -baseW / 2,
      -baseH / 2,
      baseW * evalLayer.maskSweepProgress,
      baseH
    );
    ctx.clip();
  }

  const bloomMultiplier = eff.bloom.enabled ? 1 + eff.bloom.intensity * 1.4 : 1;

  if (layer.kind === 'image' || layer.kind === 'video') {
    const imgLayer = layer as ImageLayer | VideoLayer;
    const device = imgLayer.device;
    const isSilver = device?.color === 'silver';
    const sideColor = isSilver ? '#94a3b8' : '#1e293b';
    const rimColor = isSilver ? '#e2e8f0' : '#334155';

    const radiusPx = device
      ? device.type === 'iphone'
        ? Math.min(baseW, baseH) * 0.14
        : device.type === 'ipad'
          ? Math.min(baseW, baseH) * 0.07
          : Math.min(baseW, baseH) * 0.045
      : imgLayer.cornerRadius * Math.min(baseW, baseH) * 0.5;

    const extrudeSteps = device ? 8 : 4;
    const stepX = (-rotYDeg / 30) * 1.2;
    const stepY = (rotXDeg / 30) * 1.2;
    for (let s = extrudeSteps; s >= 1; s--) {
      ctx.fillStyle = sideColor;
      drawRoundedRectPath(
        ctx,
        -baseW / 2 + stepX * s,
        -baseH / 2 + stepY * s,
        baseW,
        baseH,
        radiusPx
      );
      ctx.fill();
    }

    applyLayerShadowOrGlow(
      ctx,
      imgLayer.effects,
      canvasW,
      canvasH,
      bloomMultiplier
    );
    ctx.fillStyle = '#05070d';
    drawRoundedRectPath(ctx, -baseW / 2, -baseH / 2, baseW, baseH, radiusPx);
    ctx.fill();
    clearShadow(ctx);

    if (device) {
      ctx.strokeStyle = rimColor;
      ctx.lineWidth = Math.max(2, canvasW * 0.0025);
      ctx.stroke();
    }

    const bezel = device ? Math.max(6, baseW * 0.026) : 0;
    const topChrome = device?.type === 'browser' ? baseH * 0.07 : 0;
    const screenX = -baseW / 2 + bezel;
    const screenY = -baseH / 2 + bezel + topChrome;
    const screenW = Math.max(10, baseW - bezel * 2);
    const screenH = Math.max(10, baseH - bezel * 2 - topChrome);

    if (device?.type === 'browser') {
      ctx.fillStyle = isSilver ? '#f1f5f9' : '#0f172a';
      drawRoundedRectPath(
        ctx,
        -baseW / 2,
        -baseH / 2,
        baseW,
        topChrome + radiusPx,
        radiusPx
      );
      ctx.fill();
      ['#f43f5e', '#fbbf24', '#34d399'].forEach((dotColor, idx) => {
        ctx.fillStyle = dotColor;
        ctx.beginPath();
        ctx.arc(
          -baseW / 2 + baseW * 0.04 + idx * (baseW * 0.028),
          -baseH / 2 + topChrome * 0.55,
          Math.max(3, baseH * 0.012),
          0,
          Math.PI * 2
        );
        ctx.fill();
      });
    }

    ctx.save();
    drawRoundedRectPath(
      ctx,
      screenX,
      screenY,
      screenW,
      screenH,
      Math.max(2, radiusPx - bezel)
    );
    ctx.clip();

    const asset = project.assets[imgLayer.assetId];
    const isVideo = layer.kind === 'video' || (asset && asset.mimeType?.startsWith('video/'));
    const cachedImg = !isVideo && asset?.dataUrl
      ? imageElementCache.get(asset.dataUrl)
      : undefined;
    const cachedVideo = isVideo && asset?.dataUrl
      ? getOrCreateVideoElement(asset.dataUrl)
      : undefined;
    const crop = imgLayer.crop || { x: 0, y: 0, width: 1, height: 1 };

    if (cachedVideo) {
      const vw = cachedVideo.videoWidth || 1920;
      const vh = cachedVideo.videoHeight || 1080;
      const sx = crop.x * vw;
      const sy = crop.y * vh;
      const sw = Math.max(1, crop.width * vw);
      const sh = Math.max(1, crop.height * vh);
      ctx.drawImage(
        cachedVideo,
        sx,
        sy,
        sw,
        sh,
        screenX,
        screenY,
        screenW,
        screenH
      );
    } else if (cachedImg) {
      const sx = crop.x * cachedImg.naturalWidth;
      const sy = crop.y * cachedImg.naturalHeight;
      const sw = Math.max(1, crop.width * cachedImg.naturalWidth);
      const sh = Math.max(1, crop.height * cachedImg.naturalHeight);
      ctx.drawImage(
        cachedImg,
        sx,
        sy,
        sw,
        sh,
        screenX,
        screenY,
        screenW,
        screenH
      );
    } else {
      drawDefaultImagePlaceholder(
        ctx,
        screenX,
        screenY,
        screenW,
        screenH,
        imgLayer.name
      );
    }

    if (device?.type === 'iphone') {
      ctx.fillStyle = '#000000';
      drawRoundedRectPath(
        ctx,
        -baseW * 0.14,
        screenY + screenH * 0.025,
        baseW * 0.28,
        screenH * 0.038,
        999
      );
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      drawRoundedRectPath(
        ctx,
        -baseW * 0.18,
        screenY + screenH * 0.96,
        baseW * 0.36,
        3,
        999
      );
      ctx.fill();
    }

    if (device?.type === 'macbook') {
      ctx.fillStyle = '#000000';
      drawRoundedRectPath(
        ctx,
        -baseW * 0.08,
        screenY,
        baseW * 0.16,
        screenH * 0.04,
        4
      );
      ctx.fill();
    }

    const receivesLight = layer.receivesLight ?? true;

    if (receivesLight) {
      // Normal-based shading: Brightness depends on the angle between surface normal and light
      const nX = -Math.sin(ry);
      const nY = Math.sin(rx);
      const nZ = Math.cos(rx) * Math.cos(ry);
      const lX = light.position.x;
      const lY = light.position.y;
      const lZ = light.position.z;
      const lLen = Math.hypot(lX, lY, lZ) || 1;
      const dot = Math.max(0, (nX * lX + nY * lY + nZ * lZ) / lLen);
      const shadowFactor = (1 - dot) * (1 - (light.ambience ?? 0.45));
      if (shadowFactor > 0.02) {
        ctx.fillStyle = `rgba(0, 0, 0, ${(shadowFactor * 0.45).toFixed(3)})`;
        ctx.fillRect(screenX, screenY, screenW, screenH);
      }
    }

    const glossAmount = device ? device.gloss : 0;
    if (glossAmount > 0) {
      if (light.keyLightEnabled !== false) {
        const sweepOffset =
          (rotYDeg - light.position.x * 45) * 0.01 +
          evalLayer.shimmerProgress * 0.6;
        const glossGrad = ctx.createLinearGradient(
          -baseW / 2,
          -baseH / 2,
          baseW / 2,
          baseH / 2
        );
        const mid = Math.max(0.15, Math.min(0.85, 0.5 + sweepOffset));
        glossGrad.addColorStop(Math.max(0, mid - 0.2), 'rgba(255,255,255,0)');
        glossGrad.addColorStop(
          mid,
          kelvinToRgb(light.temperature, 0.22 * glossAmount * resolveKeyIntensity(light)).css
        );
        glossGrad.addColorStop(Math.min(1, mid + 0.2), 'rgba(255,255,255,0)');
        ctx.fillStyle = glossGrad;
        ctx.fillRect(screenX, screenY, screenW, screenH);
      }

      // Render specular gloss reflections from all enabled additional light sources
      const enabledSources = (light.sources || []).filter((s) => s.enabled);
      for (const src of enabledSources) {
        const srcSweepOffset =
          (rotYDeg - (src.position?.x ?? 0) * 45) * 0.01 +
          evalLayer.shimmerProgress * 0.6;
        const srcGlossGrad = ctx.createLinearGradient(
          -baseW / 2,
          -baseH / 2,
          baseW / 2,
          baseH / 2
        );
        const srcMid = Math.max(0.15, Math.min(0.85, 0.5 + srcSweepOffset));
        srcGlossGrad.addColorStop(Math.max(0, srcMid - 0.2), 'rgba(255,255,255,0)');
        const srcAlpha = 0.18 * glossAmount * (src.intensity ?? 1) * light.intensity;
        const srcColor = src.temperature
          ? kelvinToRgb(src.temperature, srcAlpha).css
          : hexToRgba(src.color || '#ffffff', srcAlpha);
        srcGlossGrad.addColorStop(srcMid, srcColor);
        srcGlossGrad.addColorStop(Math.min(1, srcMid + 0.2), 'rgba(255,255,255,0)');
        ctx.fillStyle = srcGlossGrad;
        ctx.fillRect(screenX, screenY, screenW, screenH);
      }
    }
    ctx.restore();

    if (device?.type === 'macbook') {
      const deckW = baseW * 1.12;
      const deckH = Math.max(8, baseH * 0.045);
      ctx.fillStyle = isSilver ? '#cbd5e1' : '#334155';
      drawRoundedRectPath(ctx, -deckW / 2, baseH / 2 - 2, deckW, deckH, 6);
      ctx.fill();
    }
  } else if (layer.kind === 'shape') {
    const shpLayer = layer as ShapeLayer;
    applyLayerShadowOrGlow(
      ctx,
      shpLayer.effects,
      canvasW,
      canvasH,
      bloomMultiplier
    );

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
    applyLayerShadowOrGlow(
      ctx,
      txtLayer.effects,
      canvasW,
      canvasH,
      bloomMultiplier
    );

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
    ctx.fillText(evalLayer.textContentOverride ?? txtLayer.content, alignX, 0);
    clearShadow(ctx);
  }

  ctx.restore();
}

function renderSceneLightSources(
  ctx: CanvasRenderingContext2D,
  light: LightRig | undefined,
  camera: EvaluatedCamera,
  canvasW: number,
  canvasH: number
): void {
  if (!light) return;

  ctx.save();

  // 1. Scene Ambient Shadow Floor
  const ambience = light.ambience ?? 0.45;
  const ambientColor = light.ambientColor || '#f8fafc';
  if (ambience > 0.05) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = hexToRgba(ambientColor, Math.min(0.2, ambience * 0.08));
    ctx.fillRect(0, 0, canvasW, canvasH);
    ctx.restore();
  }

  // 2. Key Directional Light Wash (if enabled)
  if (light.keyLightEnabled !== false) {
    const keyInt = resolveKeyIntensity(light) * 0.14;
    const dirX = light.position?.x ?? -0.28;
    const dirY = light.position?.y ?? 0.36;
    const grad = ctx.createLinearGradient(
      canvasW / 2 + dirX * canvasW * 0.5,
      canvasH / 2 + dirY * canvasH * 0.5,
      canvasW / 2 - dirX * canvasW * 0.5,
      canvasH / 2 - dirY * canvasH * 0.5
    );
    const keyColor = kelvinToRgb(light.temperature ?? 6100, Math.min(0.35, keyInt)).css;
    grad.addColorStop(0, keyColor);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvasW, canvasH);
    ctx.restore();
  }

  const sources = (light.sources || []).filter((s) => s.enabled);
  for (const src of sources) {
    const intensity = (src.intensity ?? 1) * (light.intensity ?? 1);
    if (intensity <= 0.001) continue;

    const baseColor = src.color || '#ffffff';

    if (src.type === 'ambient') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = hexToRgba(baseColor, Math.min(0.25, intensity * 0.06));
      ctx.fillRect(0, 0, canvasW, canvasH);
      ctx.restore();
    } else if (src.type === 'directional') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const dirX = src.position?.x ?? -0.28;
      const dirY = src.position?.y ?? 0.36;
      const startX = canvasW / 2 + dirX * canvasW * 0.6;
      const startY = canvasH / 2 + dirY * canvasH * 0.6;
      const endX = canvasW / 2 - dirX * canvasW * 0.4;
      const endY = canvasH / 2 - dirY * canvasH * 0.4;
      const grad = ctx.createLinearGradient(startX, startY, endX, endY);
      grad.addColorStop(0, hexToRgba(baseColor, Math.min(0.35, intensity * 0.12)));
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvasW, canvasH);
      ctx.restore();
    } else if (src.type === 'point') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const px = canvasW / 2 + ((src.position?.x ?? 0) - camera.target.x) * canvasW * camera.zoom;
      const py = canvasH / 2 + ((src.position?.y ?? 0) - camera.target.y) * canvasH * camera.zoom;
      const radius = Math.max(30, (src.distance ?? 8) * (canvasW * 0.07) * camera.zoom);
      const radGrad = ctx.createRadialGradient(px, py, 0, px, py, radius);
      radGrad.addColorStop(0, hexToRgba(baseColor, Math.min(0.45, intensity * 0.2)));
      radGrad.addColorStop(0.5, hexToRgba(baseColor, Math.min(0.18, intensity * 0.07)));
      radGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = radGrad;
      ctx.fillRect(0, 0, canvasW, canvasH);
      ctx.restore();
    } else if (src.type === 'spot') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const sx = canvasW / 2 + ((src.position?.x ?? 0) - camera.target.x) * canvasW * camera.zoom;
      const sy = canvasH / 2 + ((src.position?.y ?? 0) - camera.target.y) * canvasH * camera.zoom;
      const radius = Math.max(40, (src.distance ?? 8) * (canvasW * 0.09) * camera.zoom);
      const spotGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius);
      spotGrad.addColorStop(0, hexToRgba(baseColor, Math.min(0.5, intensity * 0.24)));
      spotGrad.addColorStop(0.6, hexToRgba(baseColor, Math.min(0.2, intensity * 0.08)));
      spotGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = spotGrad;
      ctx.fillRect(0, 0, canvasW, canvasH);
      ctx.restore();
    } else if (src.type === 'area') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const ax = canvasW / 2 + ((src.position?.x ?? 0) - camera.target.x) * canvasW * camera.zoom;
      const ay = canvasH / 2 + ((src.position?.y ?? 0) - camera.target.y) * canvasH * camera.zoom;
      const areaW = Math.max(20, (src.width ?? 2) * (canvasW * 0.1) * camera.zoom);
      const areaH = Math.max(20, (src.height ?? 2) * (canvasH * 0.1) * camera.zoom);
      const areaGrad = ctx.createRadialGradient(ax, ay, 0, ax, ay, Math.max(areaW, areaH));
      areaGrad.addColorStop(0, hexToRgba(baseColor, Math.min(0.4, intensity * 0.16)));
      areaGrad.addColorStop(0.7, hexToRgba(baseColor, Math.min(0.12, intensity * 0.04)));
      areaGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = areaGrad;
      ctx.fillRect(ax - areaW, ay - areaH, areaW * 2, areaH * 2);
      ctx.restore();
    }
  }
  ctx.restore();
}

export function renderProjectFrameToCanvas(
  ctx: CanvasRenderingContext2D,
  project: Project,
  frame: EvaluatedProjectFrame,
  canvasW: number,
  canvasH: number
): void {
  // Sync any video layers to the exact frame time
  for (const evalLayer of frame.layers) {
    const layer = evalLayer.layer;
    if (layer.kind === 'image' || layer.kind === 'video') {
      const asset = project.assets[layer.assetId];
      if (asset?.mimeType?.startsWith('video/') && asset.dataUrl) {
        const video = getOrCreateVideoElement(asset.dataUrl);
        const targetSec = Math.max(0, (frame.globalTimeMs - layer.inMs) / 1000);
        if (Number.isFinite(targetSec) && Math.abs(video.currentTime - targetSec) > 0.04) {
          video.currentTime = targetSec;
        }
      }
    }
  }

  ctx.save();
  ctx.clearRect(0, 0, canvasW, canvasH);

  // 1. Unlit Stage Background (exact solid color, gradient, or cover-cropped image)
  const bg = resolveShotBackground(project, frame.activeShot);
  if (bg.kind === 'solid') {
    ctx.fillStyle = bg.color;
    ctx.fillRect(0, 0, canvasW, canvasH);
  } else if (bg.kind === 'gradient') {
    ctx.fillStyle = createCanvasFillStyle(
      ctx,
      {
        kind: 'gradient',
        angle: bg.angle,
        stops: bg.stops,
        gradientType: bg.gradientType,
      },
      canvasW,
      canvasH,
      1
    );
    ctx.fillRect(0, 0, canvasW, canvasH);
  } else if (bg.kind === 'image') {
    const asset = project.assets[bg.assetId];
    if (asset?.dataUrl) {
      const img = imageElementCache.get(asset.dataUrl);
      if (img && img.complete) {
        const imgW = img.naturalWidth || img.width;
        const imgH = img.naturalHeight || img.height;
        if (imgW > 0 && imgH > 0) {
          const canvasAspect = canvasW / canvasH;
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
        } else {
          ctx.drawImage(img, 0, 0, canvasW, canvasH);
        }
      } else {
        ctx.fillStyle = '#0a0a0c';
        ctx.fillRect(0, 0, canvasW, canvasH);
      }
    } else {
      ctx.fillStyle = '#0a0a0c';
      ctx.fillRect(0, 0, canvasW, canvasH);
    }
  } else {
    ctx.fillStyle = '#0a0a0c';
    ctx.fillRect(0, 0, canvasW, canvasH);
  }

  // 2. Shot Transition Compositing (Crossfade / Slide / Push)
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

    ctx.save();
    ctx.globalAlpha = outgoingOpacity;
    if (outgoingSlideX !== 0) ctx.translate(outgoingSlideX, 0);
    for (const outLayer of outgoing.layers) {
      drawLayerOnCanvas(ctx, outLayer, project, outgoing, canvasW, canvasH);
    }
    renderSceneLightSources(
      ctx,
      outgoing.activeShot.light,
      outgoing.camera,
      canvasW,
      canvasH
    );
    ctx.restore();
  } else {
    incomingOpacity = transType === 'crossfade' ? transProgress : 1;
    incomingSlideX =
      transType === 'slide' || transType === 'push'
        ? (1 - transProgress) * canvasW * 0.25
        : 0;
  }

  ctx.save();
  ctx.globalAlpha = incomingOpacity;
  if (incomingSlideX !== 0) ctx.translate(incomingSlideX, 0);

  // 3. Ghost Echo Pass (if Ghost Effect is enabled)
  const eff = frame.effects.state;
  if (eff.ghost.enabled && eff.ghost.opacity > 0) {
    ctx.save();
    ctx.translate(eff.ghost.offset * canvasW, -eff.ghost.offset * canvasH * 0.5);
    for (const evalLayer of frame.layers) {
      drawLayerOnCanvas(
        ctx,
        {
          ...evalLayer,
          opacity: evalLayer.opacity * eff.ghost.opacity,
          totalBlurPx: evalLayer.totalBlurPx + eff.ghost.blur,
        },
        project,
        frame,
        canvasW,
        canvasH
      );
    }
    ctx.restore();
  }

  // 4. Render All 3D Layers (Sorted Back-to-Front)
  for (const evalLayer of frame.layers) {
    drawLayerOnCanvas(ctx, evalLayer, project, frame, canvasW, canvasH);
  }

  // 4b. Render Scene Light Sources (Fallback Path)
  renderSceneLightSources(
    ctx,
    frame.activeShot.light,
    frame.camera,
    canvasW,
    canvasH
  );
  ctx.restore();

  // 5. Vignette Pass (only when explicitly enabled on the shot)
  if (eff.vignette.enabled && eff.vignette.intensity > 0) {
    const vigGrad = ctx.createRadialGradient(
      canvasW / 2,
      canvasH / 2,
      Math.min(canvasW, canvasH) * 0.28,
      canvasW / 2,
      canvasH / 2,
      Math.hypot(canvasW, canvasH) * 0.55
    );
    vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
    vigGrad.addColorStop(
      1,
      `rgba(0,0,0,${Math.min(0.92, eff.vignette.intensity * 0.9)})`
    );
    ctx.fillStyle = vigGrad;
    ctx.fillRect(0, 0, canvasW, canvasH);
  }

  // 6. Deterministic Film Grain Pass (only when explicitly enabled)
  if (eff.filmGrain.enabled && eff.filmGrain.intensity > 0) {
    const grainAlpha = Math.min(0.25, eff.filmGrain.intensity * 1.4);
    ctx.fillStyle = `rgba(255,255,255,${grainAlpha.toFixed(3)})`;
    let seed = Math.floor(frame.effects.deterministicSeed * 100000) + 1;
    const dotsCount = Math.min(1800, Math.round((canvasW * canvasH) / 700));
    const dotSize = Math.max(1, eff.filmGrain.size);
    for (let i = 0; i < dotsCount; i++) {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      const gx = (seed / 4294967296) * canvasW;
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      const gy = (seed / 4294967296) * canvasH;
      ctx.fillRect(gx, gy, dotSize, dotSize);
    }
  }

  // 7. Glitch Scanline Pass
  if (eff.glitch.enabled && eff.glitch.intensity > 0) {
    const slices = Math.max(2, Math.round(eff.glitch.intensity * 10));
    for (let i = 0; i < slices; i++) {
      const sy = ((i * 97 + frame.frameNumber * 31) % 100) * 0.01 * canvasH;
      const sh = Math.max(4, canvasH * 0.02);
      const shiftX =
        (i % 2 === 0 ? 1 : -1) * eff.glitch.intensity * canvasW * 0.03;
      ctx.fillStyle =
        i % 2 === 0 ? 'rgba(244,63,94,0.18)' : 'rgba(56,189,248,0.18)';
      ctx.fillRect(shiftX, sy, canvasW, sh);
    }
  }

  ctx.restore();
}