import type { BlurSettings, DropShadowEffect, LayerEffects, WarpEffect } from './types';
import { turbulentWarpPoint } from './proceduralNoise';

export const EFFECT_STAGE = { width: 1920, height: 1080 };
export type BlurEffectKey = 'layerBlur' | 'backdropBlur';
export type AddableLayerEffect = 'dropShadow' | 'glow' | BlurEffectKey | 'liquidGlass' | 'warp' | 'screen' | 'outline' | 'colorCorrection' | 'noise' | 'bevel' | 'halftone' | 'roughen' | 'colorKey' | 'pixelate' | 'rgbSplit';
export const LAYER_EFFECT_NAMES: Record<AddableLayerEffect, string> = {
  rgbSplit: 'RGB split', dropShadow: 'Shadow', glow: 'Glow', backdropBlur: 'Backdrop blur', layerBlur: 'Layer blur',
  outline: 'Alpha outline', colorCorrection: 'Color correction', noise: 'Noise', bevel: 'Bevel and emboss', halftone: 'Halftone', roughen: 'Roughen edges', colorKey: 'Color key', pixelate: 'Pixelate',
  liquidGlass: 'Liquid glass', warp: 'Wrap', screen: 'Screen',
};

export function defaultShadow(): DropShadowEffect {
  return { enabled: true, mode: 'drop', color: '#000000', opacity: .25, blur: 24 / 1920, offsetX: 0, offsetY: 8 / 1080, spread: 0 };
}

export function addLayerEffect(effects: LayerEffects, key: AddableLayerEffect): LayerEffects {
  // Re-adding an effect must never discard authored settings (including zero blur).
  if (effects[key] !== undefined) return effects;
  switch (key) {
    case 'rgbSplit': return { ...effects, rgbSplit: { enabled: true, amount: 8, angle: 0, mode: 'linear', centerX: .5, centerY: .5, red: 1, green: 0, blue: -1 } };
    case 'outline': return { ...effects, outline: { enabled: true, width: 6, placement: 'outside', color: '#ffffff', opacity: 1, softness: 0 } };
    case 'colorCorrection': return { ...effects, colorCorrection: {
      enabled: true, exposure: 0, contrast: 1, saturation: 1, temperature: 0, tint: 0,
      blackPoint: 0, whitePoint: 1, gamma: 1, curveShadows: 0, curveMidtones: 0, curveHighlights: 0,
    } };
    case 'noise': return { ...effects, noise: { enabled: true, amount: .2, scale: 1, monochrome: true, density: 1, seed: 1, animated: false, speed: 1 } };
    case 'bevel': return { ...effects, bevel: { enabled: true, thickness: 8, softness: 2.8, depth: 5, angle: 135, highlightColor: '#ffffff', shadowColor: '#000000', intensity: .7 } };
    case 'halftone': return { ...effects, halftone: { enabled: true, dotSize: 6, spacing: 8, offsetX: 0, offsetY: 0, contrast: 1, angle: 45, shape: 'circle', foreground: '#000000', background: '#ffffff', sourceColor: false, invert: false } };
    case 'roughen': return { ...effects, roughen: { enabled: true, border: 8, scale: 20, sharpness: .5, amount: .7, seed: 1, evolution: 0, speed: 0 } };
    case 'colorKey': return { ...effects, colorKey: { enabled: true, color: '#00ff00', similarity: .3, softness: .1, spill: .5, invert: false } };
    case 'pixelate': return { ...effects, pixelate: { enabled: true, blockSize: 16, aspect: 1, offsetX: 0, offsetY: 0, mode: 'uniform', start: 1, end: 32, angle: 0 } };
    case 'dropShadow': return { ...effects, dropShadow: defaultShadow() };
    case 'glow': return { ...effects, glow: { enabled: true, placement: 'outer', mode: 'edge', color: '#0043ff', intensity: .2, radius: 126 / 1920, angle: 106, sheen: 1, rim: 1, depth: 0, blend: 'normal', innerColor: '#0043ff', innerIntensity: 0, innerRadius: 60 / 1920 } };
    case 'backdropBlur': case 'layerBlur': return { ...effects, [key]: .24 };
    case 'liquidGlass': return { ...effects, liquidGlass: { enabled: true, refraction: .6, ior: 1.52, bevelWidth: 24, doubleBevel: .4, roughness: .05, dispersion: .45, chromaBoost: .8, shine: .7, fresnel: .6, lightAngle: 45, tint: '#ffffff', rimColor: '#cce4ff' } };
    case 'warp': return { ...effects, warp: { enabled: true, mode: 'bulge', strength: .5, size: 183, centerX: 0, centerY: 0, angle: 0, width: 61, travel: .5 } };
    case 'screen': return { ...effects, screen: { enabled: true, mode: 'lcd', pixelSize: 8, grid: 0.85, moire: 0, bands: 0, focus: 0, glow: 0, flicker: 0, speed: 0.5, offAxis: 0, snapToPixels: false } };
  }
}

export function getBlurSettings(effects: LayerEffects, key: BlurEffectKey): BlurSettings {
  return effects[`${key}Settings`] ?? { type: 'gaussian', centerX: .5, centerY: .5, quality: 16, mode: 'uniform', start: 0, end: (effects[key] ?? 0) * 100, angle: 270 };
}

export function blurAtPoint(settings: BlurSettings, x: number, y: number): number {
  if (settings.mode === 'uniform') return settings.end;
  const angle = settings.angle * Math.PI / 180;
  const dx = Math.cos(angle), dy = Math.sin(angle);
  const t = Math.max(0, Math.min(1, .5 + ((x - .5) * dx + (y - .5) * dy) / Math.max(.0001, Math.abs(dx) + Math.abs(dy))));
  return settings.start + (settings.end - settings.start) * t;
}

/** Authored pixels in, authored pixels out. Shared with geometry and fallback rendering. */
export function warpPoint(x: number, y: number, warp: WarpEffect, timeSeconds = 0, bounds?: { width: number; height: number; centerX?: number; centerY?: number }): { x: number; y: number; z: number } {
  if (!warp.enabled) return { x, y, z: 0 };
  if (warp.mode === 'turbulent') return turbulentWarpPoint(x, y, warp, timeSeconds, bounds);
  if (!warp.mode) return { x: x + Math.sin(y / 1080 * Math.PI * 2 * (warp.frequency ?? 3)) * (warp.amount ?? 0), y, z: 0 };
  const cx = warp.centerX ?? 0, cy = warp.centerY ?? 0;
  const angle = (warp.angle ?? 0) * Math.PI / 180;
  const c = Math.cos(angle), s = Math.sin(angle);
  const dx = x - cx, dy = y - cy;
  let u = dx * c + dy * s, v = -dx * s + dy * c, z = 0;
  const strength = warp.strength ?? .5, size = Math.max(1, warp.size ?? 183);
  const radius = Math.hypot(u, v);
  if (warp.mode === 'bulge') {
    const scale = 1 + strength * Math.max(0, 1 - (radius / size) ** 2) ** 2;
    u *= scale; v *= scale;
  } else if (warp.mode === 'ripple') {
    const width = Math.max(1, warp.width ?? 61), ring = (warp.travel ?? .5) * size;
    const distance = radius - ring;
    const shift = Math.abs(distance) < width ? Math.sin(distance / width * Math.PI) * strength * width * .5 : 0;
    if (radius > .0001) { u += u / radius * shift; v += v / radius * shift; }
  } else if (Math.abs(strength) > .00001) {
    const curvature = strength / size;
    if (warp.mode === 'bend') {
      const theta = u * curvature;
      u = Math.sin(theta) * (1 / curvature + v);
      v = Math.cos(theta) * (1 / curvature + v) - 1 / curvature;
    } else {
      const theta = u * curvature;
      z = (1 - Math.cos(theta)) / curvature;
      u = Math.sin(theta) / curvature;
    }
  }
  return { x: cx + u * c - v * s, y: cy + u * s + v * c, z };
}
