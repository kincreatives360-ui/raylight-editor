import { describe, expect, it } from 'vitest';
import { LayerEffectsSchema } from './schema';
import { addLayerEffect, blurAtPoint, defaultShadow, warpPoint } from './layerEffects';

describe('reference layer effect parameters', () => {
  it('round trips every recommended effect and preserves authored settings when re-added', () => {
    let effects = {};
    for (const key of ['outline', 'colorCorrection', 'noise', 'bevel', 'halftone', 'roughen', 'colorKey', 'pixelate'] as const) {
      effects = addLayerEffect(effects, key);
      expect(addLayerEffect(effects, key)).toBe(effects);
    }
    const extended = { ...effects,
      dropShadow: { ...defaultShadow(), mode: 'long', length: 175, angle: -35, fade: .8 },
      warp: { enabled: true, mode: 'turbulent', amount: 35, size: 125, complexity: 4, seed: 52, pinning: 'horizontal', centerX: -4, centerY: 10, evolution: 730, loop: true, loopDuration: 3, speed: -45 },
    };
    expect(LayerEffectsSchema.parse(JSON.parse(JSON.stringify(extended)))).toEqual(extended);
  });
  it('rejects invalid effect domains instead of silently accepting corrupt settings', () => {
    const noise = addLayerEffect({}, 'noise').noise!;
    for (const patch of [{ amount: 1.1 }, { scale: 0 }, { density: -1 }, { seed: 1.5 }, { speed: 21 }]) {
      expect(LayerEffectsSchema.safeParse({ noise: { ...noise, ...patch } }).success).toBe(false);
    }
    const correction = addLayerEffect({}, 'colorCorrection').colorCorrection!;
    for (const patch of [{ exposure: 6 }, { gamma: 0 }, { curveMidtones: 2 }, { contrast: -1 }]) {
      expect(LayerEffectsSchema.safeParse({ colorCorrection: { ...correction, ...patch } }).success).toBe(false);
    }
  });
  it('keeps color correction neutral and creates independent default objects', () => {
    const first = addLayerEffect({}, 'colorCorrection').colorCorrection!;
    expect(first).toMatchObject({ exposure: 0, contrast: 1, saturation: 1, blackPoint: 0, whitePoint: 1, gamma: 1 });
    expect(addLayerEffect({}, 'colorCorrection').colorCorrection).not.toBe(first);
  });
  it('never overwrites an existing zero blur or authored glow', () => {
    const effects = { layerBlur: 0, glow: { enabled: true, intensity: 2, radius: .4, color: '#123456' } };
    expect(addLayerEffect(effects, 'layerBlur')).toBe(effects);
    expect(addLayerEffect(effects, 'glow')).toBe(effects);
  });
  it('uses both progressive blur endpoints and reverses with angle', () => {
    const blur = { mode: 'progressive' as const, start: 2, end: 40, angle: 0 };
    expect(blurAtPoint(blur, 0, .5)).toBe(2);
    expect(blurAtPoint(blur, 1, .5)).toBe(40);
    expect(blurAtPoint({ ...blur, angle: 180 }, 0, .5)).toBeCloseTo(40);
  });
  it('keeps zero-strength wraps neutral and gives Curl real depth', () => {
    for (const mode of ['bulge', 'ripple', 'bend', 'curl'] as const) {
      expect(warpPoint(40, 20, { enabled: true, mode, strength: 0 })).toEqual({ x: 40, y: 20, z: 0 });
    }
    const curl = warpPoint(100, 20, { enabled: true, mode: 'curl', strength: 1, size: 183 });
    expect(curl.z).toBeGreaterThan(0);
    expect(warpPoint(100, 20, { enabled: true, mode: 'bend', strength: 1, size: 183 }).z).toBe(0);
  });
  it('preserves every new setting when saving a project', () => {
    const effects = {
      dropShadow: { enabled: true, color: '#000000', opacity: .25, blur: .02, offsetX: 0, offsetY: .01, mode: 'inner', spread: 12 },
      glow: { enabled: true, color: '#0043ff', intensity: .2, radius: .06, mode: 'fill', angle: 106, sheen: 1, rim: .8, depth: 4, blend: 'add' },
      layerBlur: .24, layerBlurSettings: { mode: 'progressive', start: 0, end: 24, angle: 270 },
      backdropBlur: .24, backdropBlurSettings: { mode: 'progressive', start: 2, end: 50, angle: 90 },
      liquidGlass: { enabled: true, refraction: .5, roughness: .1, dispersion: .4, shine: .6, tint: '#ffffff' },
      warp: { enabled: true, mode: 'curl', strength: -.5, size: 183, centerX: 12, centerY: -8, angle: 30, width: 61, travel: .5 },
      screen: { enabled: true, mode: 'oled', pixelSize: 11.4, grid: 1, moire: .8, bands: .5, focus: .14, glow: .3, flicker: .2, speed: .5, offAxis: 1, snapToPixels: true },
    };
    expect(LayerEffectsSchema.parse(effects)).toEqual(effects);
  });

  it('continues to read existing projects unchanged', () => {
    const effects = { layerBlur: .12, backdropBlur: 0, warp: { enabled: true, amount: 10, frequency: 3 } };
    expect(LayerEffectsSchema.parse(effects)).toEqual(effects);
  });
});
