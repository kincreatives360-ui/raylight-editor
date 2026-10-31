// src/engine/canvasRenderer.ts
import type { Project, Background } from '../model/types';
import { resolveShotBackground } from '../model/types';
import type { EvaluatedProjectFrame } from './evaluateShot';
import { getShaderColors } from '../model/backgroundPresets';
import { applyCanvasSceneEffects } from './canvasSceneEffects';
import { acquireCanvas, releaseCanvas } from './canvasPool';

export {
  clearImageElementCache,
  clearVideoElementCache,
  getOrCreateImageElement,
  getOrCreateVideoElement,
  preloadProjectImages,
  seekVideoElement,
  syncAndSeekAllProjectVideos,
  type ImagePreloadSummary,
} from './canvasMediaAssets';
import {
  getOrCreateImageElement,
  getOrCreateVideoElement,
} from './canvasMediaAssets';

export { sampleStops, sampleLayerGradient } from './canvasGradientRaster';

export { hexToRgba } from './canvasColorUtils';
import { hexToRgba } from './canvasColorUtils';
export { createCanvasFillStyle } from './canvasFillStyle';
import { createCanvasFillStyle } from './canvasFillStyle';

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

import { drawLayerOnCanvas } from './canvasLayerRenderer';

export { renderSceneLightSources } from './canvasLighting';
import { renderSceneLightSources } from './canvasLighting';

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

function renderBackgroundWithLighting(
  ctx: CanvasRenderingContext2D,
  project: Project,
  background: Background,
  light: EvaluatedProjectFrame['activeShot']['light'],
  camera: EvaluatedProjectFrame['camera'],
  canvasW: number,
  canvasH: number,
  alpha = 1,
  offsetX = 0,
): void {
  if (!light?.backgroundReceivesLight || background.kind === 'transparent') {
    renderSingleBackground(ctx, project, background, canvasW, canvasH, alpha, offsetX);
    return;
  }
  const canvas = acquireCanvas(canvasW, canvasH);
  const backgroundCtx = canvas.getContext('2d');
  if (!backgroundCtx) {
    releaseCanvas(canvas);
    renderSingleBackground(ctx, project, background, canvasW, canvasH, alpha, offsetX);
    return;
  }
  renderSingleBackground(backgroundCtx, project, background, canvasW, canvasH, alpha, offsetX);
  renderSceneLightSources(backgroundCtx, light, camera, canvasW, canvasH, project.aspectRatio, canvas);
  ctx.drawImage(canvas, 0, 0);
  releaseCanvas(canvas);
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
      renderBackgroundWithLighting(outgoingCtx, project, outgoingBg, outgoing.activeShot.light, outgoing.camera, canvasW, canvasH, 1, 0);
      for (const outLayer of outgoing.layers) {
        await drawLayerOnCanvas(outgoingCtx, outLayer, project, outgoing, canvasW, canvasH);
      }
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
      renderBackgroundWithLighting(incomingCtx, project, incomingBg, frame.activeShot.light, frame.camera, canvasW, canvasH, 1, 0);
      for (const evalLayer of frame.layers) {
        await drawLayerOnCanvas(incomingCtx, evalLayer, project, frame, canvasW, canvasH);
      }
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
    renderBackgroundWithLighting(ctx, project, incomingBg, frame.activeShot.light, frame.camera, canvasW, canvasH, 1, 0);

    ctx.save();
    ctx.globalAlpha = incomingOpacity;
    if (incomingSlideX !== 0) ctx.translate(incomingSlideX, 0);

    for (const evalLayer of frame.layers) {
      await drawLayerOnCanvas(ctx, evalLayer, project, frame, canvasW, canvasH);
    }
    ctx.restore();

    if (frame.effects.orderedEnabledPasses.some(pass => pass.key !== 'depthOfField')) {
      const image = ctx.getImageData(0, 0, canvasW, canvasH);
      applyCanvasSceneEffects(image.data, canvasW, canvasH, frame.effects);
      ctx.putImageData(image, 0, 0);
    }
  }

  ctx.restore();
}





