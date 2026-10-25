import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { configureLayerTexture } from './ThreeLayerObject';

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
