import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { configureLayerTexture, getLayerBlurBleedLayout } from './ThreeLayerObject';

describe('Layer Texture High-Resolution Filtering', () => {
  it('enables mipmaps and trilinear filtering with sRGB color space', () => {
    const tex = new THREE.Texture();
    configureLayerTexture(tex, 16);

    expect(tex.generateMipmaps).toBe(true);
    expect(tex.minFilter).toBe(THREE.LinearMipmapLinearFilter);
    expect(tex.magFilter).toBe(THREE.LinearFilter);
    expect(tex.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(tex.version).toBeGreaterThan(0);
    expect(tex.anisotropy).toBe(16);
  });

  it('clamps anisotropy to the GPU capability maximum', () => {
    const tex = new THREE.Texture();
    configureLayerTexture(tex, 4);
    expect(tex.anisotropy).toBe(4);

    const texZero = new THREE.Texture();
    configureLayerTexture(texZero, 0);
    expect(texZero.anisotropy).toBe(1);
  });
});

describe('getLayerBlurBleedLayout', () => {
  it('returns zero padding and 1.0 scale when no blur is active', () => {
    const layout = getLayerBlurBleedLayout(800, 600, 0, 0);
    expect(layout.blurPadding).toBe(0);
    expect(layout.paddedCanvasW).toBe(800);
    expect(layout.paddedCanvasH).toBe(600);
    expect(layout.widthScale).toBe(1);
    expect(layout.heightScale).toBe(1);
  });

  it('expands canvas and geometry when layer blur is active', () => {
    const layout = getLayerBlurBleedLayout(800, 600, 10, 0);
    expect(layout.blurPadding).toBe(30);
    expect(layout.paddedCanvasW).toBe(860);
    expect(layout.paddedCanvasH).toBe(660);
    expect(layout.widthScale).toBe(860 / 800);
    expect(layout.heightScale).toBe(660 / 600);
  });

  it('accounts for depth of field blur', () => {
    const layout = getLayerBlurBleedLayout(800, 600, 0, 8);
    // 8 * 1.5 = 12 blur px -> 36px padding
    expect(layout.blurPadding).toBe(36);
    expect(layout.paddedCanvasW).toBe(872);
  });

  it('accounts for motion blur displacement along vectors', () => {
    const layout = getLayerBlurBleedLayout(1000, 500, 0, 0, { x: 0.05, y: 0 });
    // motionDistPx = 50px -> 150px padding
    expect(layout.blurPadding).toBe(150);
    expect(layout.paddedCanvasW).toBe(1300);
    expect(layout.paddedCanvasH).toBe(800);
  });

  it('caps padding at 256px maximum to prevent excessive VRAM allocation', () => {
    const layout = getLayerBlurBleedLayout(800, 600, 200, 0);
    expect(layout.blurPadding).toBe(256);
  });

  it('does not add blur padding when layer is inside a physical device frame', () => {
    const layout = getLayerBlurBleedLayout(800, 600, 20, 10, { x: 0.1, y: 0 }, true);
    expect(layout.blurPadding).toBe(0);
    expect(layout.widthScale).toBe(1);
    expect(layout.heightScale).toBe(1);
  });
});

