import type { LightRig, Project } from '../model/types';
import type { EvaluatedCamera } from './evaluateCamera';
import { getArtboardDimensions } from '../stage/stageUtils';
import { resolveLighting } from './lightingSystem';
import { hexToRgba } from './canvasColorUtils';
import { acquireCanvas, releaseCanvas } from './canvasPool';

export function renderSceneLightSources(
  ctx: CanvasRenderingContext2D,
  light: LightRig | undefined,
  camera: EvaluatedCamera,
  canvasW: number,
  canvasH: number,
  aspectRatio?: Project['aspectRatio'],
  alphaMask?: HTMLCanvasElement,
): void {
  if (alphaMask) {
    const overlay = acquireCanvas(canvasW, canvasH);
    const overlayCtx = overlay.getContext('2d');
    if (!overlayCtx) {
      releaseCanvas(overlay);
      return;
    }
    renderSceneLightSources(overlayCtx, light, camera, canvasW, canvasH, aspectRatio);
    overlayCtx.globalCompositeOperation = 'destination-in';
    overlayCtx.drawImage(alphaMask, 0, 0, canvasW, canvasH);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(overlay, 0, 0);
    ctx.restore();
    releaseCanvas(overlay);
    return;
  }
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
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvasW, canvasH);
    ctx.restore();
  };

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = hexToRgba(resolved.room.environmentTint, Math.min(0.22, resolved.room.intensity * 0.08));
  ctx.fillRect(0, 0, canvasW, canvasH);
  ctx.restore();

  const keyPosition = projectPosition(light?.position?.x ?? -0.28, light?.position?.y ?? 0.36);
  const keyTarget = projectPosition(light?.target?.x ?? 0, light?.target?.y ?? 0);
  if (resolved.key.enabled) {
    drawWash(resolved.key.color, resolved.key.intensity, keyTarget.x - keyPosition.x, keyTarget.y - keyPosition.y);
  }
  if (resolved.fill.enabled) {
    drawWash(resolved.fill.color, resolved.fill.intensity, -keyTarget.x + keyPosition.x, -keyTarget.y + keyPosition.y);
  }

  const sourceById = new Map((light?.sources ?? []).map((source) => [source.id, source]));
  for (const source of resolved.sources) {
    const model = sourceById.get(source.id);
    if (!model) continue;
    const position = projectPosition(model.position.x, model.position.y);
    const target = projectPosition(model.target?.x ?? 0, model.target?.y ?? 0);
    const baseIntensity = source.type === 'ambient' ? source.intensity * 0.5 : source.intensity;
    if (baseIntensity <= 0.001) continue;

    if (source.type === 'ambient') {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
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
    ctx.globalCompositeOperation = 'screen';
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
