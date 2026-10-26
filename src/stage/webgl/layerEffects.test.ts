import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { getLayerHaloLayout, applyLayerReveal, getLayerEffectUniforms, getBokehOffsets, installLayerEffects, drawLayerHalo } from './layerEffects';

describe('layer effect rendering', () => {
  let origDocument: unknown;

  beforeEach(() => {
    origDocument = (globalThis as unknown as { document?: unknown }).document;
  });

  afterEach(() => {
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
    const uniforms = getLayerEffectUniforms({ warp: { enabled: true, amount: 0.1, frequency: 4 }, backdropBlur: 0.2 }, 'multiply');
    const shader: any = {
      uniforms: {},
      vertexShader: 'void main() {}',
      fragmentShader: '#include <map_fragment>\n#include <colorspace_fragment>',
    };
    installLayerEffects(shader, uniforms);
    expect(shader.uniforms.layerBlend).toBeDefined();
    expect(shader.uniforms.layerBlend.value).toBe(2); // multiply
    expect(shader.uniforms.layerWarp.value.x).toBe(0.1);
    expect(shader.fragmentShader).toContain('layerSampleScene');
    expect(shader.fragmentShader).toContain('layerWarp');
    expect(shader.fragmentShader).toContain('layerBlend == 2');
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
});
