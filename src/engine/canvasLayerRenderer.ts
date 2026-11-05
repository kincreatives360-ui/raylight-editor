import type { ImageLayer, Project, ShapeLayer, Shot, TextLayer, VideoLayer } from '../model/types';
import type { EvaluatedCamera } from './evaluateCamera';
import type { EvaluatedEffects } from './evaluateEffects';
import type { EvaluatedLayerWithEffects } from './evaluateShot';
import { getArtboardDimensions } from '../stage/stageUtils';
import { getBlurSettings } from '../model/layerEffects';
import { applyLayerSurfaceEffects, compositeLayerEffectSurface, drawLayerHalo } from '../stage/webgl/layerEffects';
import { drawMediaShimmer } from '../stage/webgl/mediaDecorations';
import { layerReceivesLight } from '../model/layerLighting';
import { renderSceneLightSources } from './canvasLighting';
import { applyLayerAlphaEffects } from './layerAlphaEffects';
import { acquireCanvas, releaseCanvas } from './canvasPool';
import { hexToRgba } from './canvasColorUtils';
import { createCanvasFillStyle } from './canvasFillStyle';
import { getOrCreateImageElement, getOrCreateVideoElement } from './canvasMediaAssets';

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
export async function drawLayerOnCanvas(
  ctx: CanvasRenderingContext2D, layer: EvaluatedLayerWithEffects, project: Project,
  frame: Parameters<typeof drawLayerContentOnCanvas>[3], w: number, h: number
): Promise<void> {
  const effects = layer.layer.effects;
  const receivesLight = layerReceivesLight(layer.layer) && Boolean(frame.activeShot?.light);
  if (!Object.keys(effects).length && layer.glowIntensityOffset <= 0 && !receivesLight) {
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
    if (receivesLight && frame.activeShot) {
      renderSceneLightSources(content, frame.activeShot.light, frame.camera, w, h, project.aspectRatio, surface);
    }
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
    if (!composed) {
      const blurSettings = getBlurSettings(effects, 'layerBlur');
      const maxBlur = Math.max((effects.layerBlur ?? 0) * 100, blurSettings.start, blurSettings.end);
      if (maxBlur > 0) ctx.filter = `blur(${maxBlur * w / 1920}px)`;
    }
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

