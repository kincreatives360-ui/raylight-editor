import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { getLayerHaloLayout, applyLayerReveal, getLayerEffectUniforms, getBokehOffsets, installLayerEffects, drawLayerHalo, applyMotionBlur, createWarpGeometry } from './layerEffects';
import { canvasPool } from '../../engine/canvasPool';

describe('layer effect rendering', () => {
  it('keeps inner shadows inside the surface rather than creating an outer halo', () => {
    expect(drawLayerHalo({ width: 100, height: 100 } as HTMLCanvasElement, { dropShadow: { enabled: true, mode: 'inner', color: '#000000', opacity: 1, blur: .02, offsetX: 0, offsetY: 0 } }, 0, 0, 2048)).toBeNull();
  });
  it('tessellates curl geometry with finite normals and real depth', () => {
    const geometry = createWarpGeometry(3.2, 2, 320, 200, { enabled: true, mode: 'curl', strength: .5, size: 183 });
    expect(geometry.getAttribute('position').count).toBeGreaterThan(1000);
    expect(geometry.boundingBox!.max.z).toBeGreaterThan(0);
    expect(Array.from(geometry.getAttribute('normal').array).every(Number.isFinite)).toBe(true);
    geometry.dispose();
  });
  it('declares the map sampler before helpers that sample it', () => {
    const shader = { uniforms: {}, fragmentShader: '#include <map_pars_fragment>\nvoid main() {\n#include <map_fragment>\n#include <colorspace_fragment>\n}' } as unknown as Parameters<typeof installLayerEffects>[0];
    installLayerEffects(shader, getLayerEffectUniforms({}, 'normal'));
    expect(shader.fragmentShader.indexOf('#include <map_pars_fragment>')).toBeLessThan(shader.fragmentShader.indexOf('vec4 layerSampleArtwork'));
  });
  let origDocument: unknown;

  beforeEach(() => {
    canvasPool.clear();
    origDocument = (globalThis as unknown as { document?: unknown }).document;
  });

  afterEach(() => {
    canvasPool.clear();
    (globalThis as unknown as { document?: unknown }).document = origDocument;
  });

  it('uses distinct bokeh kernels, with anamorphic horizontal elongation', () => {
    const spherical = getBokehOffsets('spherical');
    const anamorphic = getBokehOffsets('anamorphic');
    expect(anamorphic[0].x).toBe(spherical[0].x * 2);
    expect(anamorphic[1].y).toBe(spherical[1].y * .5);
    expect(getBokehOffsets('vintage')).not.toEqual(spherical);
    expect(getBokehOffsets('portrait')).not.toEqual(spherical);
  });

  it('reserves halo space for both blur and signed shadow offsets', () => {
    const result = getLayerHaloLayout({ dropShadow: { enabled: true, color: '#000', opacity: 1, blur: .1, offsetX: -.2, offsetY: .3 } }, 100, 200, 0, 0);
    expect(result.padding).toBeGreaterThanOrEqual(120);
    expect(result.width).toBe(100 + result.padding * 2);
  });

  it('animates glow even with no static glow configured', () => {
    const result = getLayerHaloLayout({}, 100, 200, .8, .1);
    expect(result.glowIntensity).toBe(.8);
    expect(result.glowRadius).toBeCloseTo(30);
  });

  it('clears unrevealed content without affecting fully visible layers', () => {
    const ctx = { clearRect: vi.fn() } as unknown as CanvasRenderingContext2D;
    applyLayerReveal(ctx, 100, 80, 1, 1);
    expect(ctx.clearRect).not.toHaveBeenCalled();
    applyLayerReveal(ctx, 100, 80, .5, .8);
    expect(ctx.clearRect).toHaveBeenCalledWith(50, 0, 50, 80);
  });

  it('retains distinct blend modes and neutral default effects', () => {
    expect(getLayerEffectUniforms({}, 'difference').layerBlend.value).toBe(6);
    expect(getLayerEffectUniforms({}, 'normal').layerBackdrop.value).toBe(0);
    expect(getLayerEffectUniforms({ warp: { enabled: false, amount: 1 } }, 'normal').layerWarp.value.x).toBe(0);
  });

  it('installs shader modifications for warp, blend modes, and backdrop sampling', () => {
    const uniforms = getLayerEffectUniforms({ warp: { enabled: true, amount: 192, frequency: 4 }, backdropBlur: 0.2 }, 'multiply');
    const shader = {
      uniforms: {} as Record<string, { value: unknown }>,
      vertexShader: 'void main() {}',
      fragmentShader: '#include <map_fragment>\n#include <colorspace_fragment>',
    } as unknown as Parameters<typeof installLayerEffects>[0];
    installLayerEffects(shader, uniforms);
    expect(shader.uniforms.layerBlend).toBeDefined();
    expect(shader.uniforms.layerBlend.value).toBe(2); // multiply
    expect(shader.uniforms.layerBackdrop.value).toBe(20); // 0.2 * 100
    expect(shader.uniforms.layerWarp.value.x).toBeCloseTo(0.1);
    expect(shader.fragmentShader).toContain('layerSampleScene');
    expect(shader.fragmentShader).toContain('blendAlpha');
    expect(shader.fragmentShader).toContain('layerWarp');
    expect(shader.fragmentShader).toContain('layerBlend == 2');
  });

  it('configures physical liquid glass uniforms and shader without obsolete uniforms', () => {
    const glassEffects = {
      liquidGlass: {
        enabled: true,
        refraction: 0.75,
        ior: 1.6,
        bevelWidth: 32,
        doubleBevel: 0.5,
        dispersion: 0.45,
        chromaBoost: 0.9,
        roughness: 0.08,
        shine: 0.85,
        fresnel: 0.6,
        lightAngle: 60,
        tint: '#a0c0ff',
        rimColor: '#cce4ff',
      },
    };
    const uniforms = getLayerEffectUniforms(glassEffects, 'normal') as Record<string, any>;
    expect(uniforms.layerGlass.value).toBe(1);
    expect(uniforms.layerGlassParams.value.x).toBe(0.75);
    expect(uniforms.layerGlassParams.value.y).toBe(1.6);
    expect(uniforms.layerGlassParams.value.z).toBe(32);
    expect(uniforms.layerGlassParams.value.w).toBe(0.45);
    expect(uniforms.layerGlassLighting.value.x).toBe(0.08);
    expect(uniforms.layerGlassLighting.value.y).toBe(0.85);
    expect(uniforms.layerGlassLighting.value.z).toBe(0.6);
    expect(uniforms.layerGlassLighting.value.w).toBeCloseTo((60 * Math.PI) / 180);
    expect(uniforms.layerGlassOptics.value.x).toBe(0.5);
    expect(uniforms.layerGlassOptics.value.y).toBe(0.9);
    expect(uniforms.layerRimColor.value.getHexString()).toBe('cce4ff');
    expect(uniforms.layerRefraction).toBeUndefined();
    expect(uniforms.layerRoughness).toBeUndefined();
    expect(uniforms.layerDispersion).toBeUndefined();
    expect(uniforms.layerShine).toBeUndefined();

    const shader = {
      uniforms: {} as Record<string, { value: unknown }>,
      vertexShader: 'void main() {}',
      fragmentShader: '#include <map_fragment>\n#include <colorspace_fragment>',
    } as unknown as Parameters<typeof installLayerEffects>[0];
    installLayerEffects(shader, uniforms as any);
    expect(shader.fragmentShader).toContain('float bevel = max(1.0, layerGlassParams.z);');
    expect(shader.fragmentShader).not.toContain('layerGlassParams.z * layerPixelRatio');
    expect(shader.fragmentShader).not.toContain('uniform float layerBackdrop, layerGlass, layerRefraction');
  });

  it('drawLayerHalo produces valid canvas and scales when shadow or glow is enabled', () => {
    const mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      drawImage: vi.fn(),
      clearRect: vi.fn(),
    };
    (globalThis as unknown as { document?: unknown }).document = {
      createElement: vi.fn(() => ({
        width: 0,
        height: 0,
        getContext: vi.fn(() => mockCtx),
      })),
    };

    const sourceCanvas = { width: 100, height: 100 } as unknown as HTMLCanvasElement;
    const noEffects = drawLayerHalo(sourceCanvas, {}, 0, 0, 2048);
    expect(noEffects).toBeNull();

    const withShadow = drawLayerHalo(sourceCanvas, {
      dropShadow: { enabled: true, color: '#000000', opacity: 0.8, blur: 0.05, offsetX: 0.02, offsetY: 0.02 },
    }, 0, 0, 2048);
    expect(withShadow).not.toBeNull();
    expect(withShadow!.widthScale).toBeGreaterThan(1);
    expect(withShadow!.heightScale).toBeGreaterThan(1);
  });

  it('applyMotionBlur executes sample draws along motion vector when displacement > 0.5', () => {
    const mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      resetTransform: vi.fn(),
      drawImage: vi.fn(),
      clearRect: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
    };
    (globalThis as unknown as { document?: unknown }).document = {
      createElement: vi.fn(() => ({
        width: 100,
        height: 100,
        getContext: vi.fn(() => mockCtx),
      })),
    };

    const targetCanvas = {
      width: 100,
      height: 100,
      getContext: vi.fn(() => mockCtx),
    } as unknown as HTMLCanvasElement;

    // Displacement <= 0.5: no-op
    applyMotionBlur(targetCanvas, 0.2, 0.1, 8);
    expect(mockCtx.drawImage).not.toHaveBeenCalled();

    // Displacement > 0.5: draws 8 samples
    applyMotionBlur(targetCanvas, 10, 5, 8);
    // 1 draw to source canvas + 8 draws to target
    expect(mockCtx.drawImage).toHaveBeenCalledTimes(9);
  });

  it('applyMotionBlur applies 3D rotational and scale smear', () => {
    const mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      resetTransform: vi.fn(),
      drawImage: vi.fn(),
      clearRect: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
    };
    (globalThis as unknown as { document?: unknown }).document = {
      createElement: vi.fn(() => ({
        width: 100,
        height: 100,
        getContext: vi.fn(() => mockCtx),
      })),
    };

    const targetCanvas = {
      width: 100,
      height: 100,
      getContext: vi.fn(() => mockCtx),
    } as unknown as HTMLCanvasElement;

    applyMotionBlur(targetCanvas, {
      motionX: 0,
      motionY: 0,
      rotZ: 0.5,
      scaleX: 0.2,
      scaleY: 0.2,
      samples: 6,
    });

    expect(mockCtx.rotate).toHaveBeenCalled();
    expect(mockCtx.scale).toHaveBeenCalled();
    expect(mockCtx.drawImage).toHaveBeenCalledTimes(7); // 1 copy + 6 samples
  });
});
