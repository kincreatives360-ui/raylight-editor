import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createReflectionTexture, createShadowTexture } from './deviceTextures';
import { createGradientTexture } from './SceneBackground';

describe('deviceTextures resolution & filtering', () => {
  beforeEach(() => {
    const mockCtx = {
      createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      fillRect: vi.fn(),
      fillStyle: '',
    };
    vi.stubGlobal('document', {
      createElement: vi.fn((tag: string) => {
        if (tag === 'canvas') {
          return {
            width: 0,
            height: 0,
            getContext: () => mockCtx,
          };
        }
        return {};
      }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates reflection texture with high resolution (1024x2048), mipmaps, trilinear filtering, and anisotropy', () => {
    const tex = createReflectionTexture(0.5, 0.5, '#ffffff');

    expect(tex).toBeInstanceOf(THREE.CanvasTexture);
    expect(tex.image.width).toBe(1024);
    expect(tex.image.height).toBe(2048);
    expect(tex.generateMipmaps).toBe(true);
    expect(tex.minFilter).toBe(THREE.LinearMipmapLinearFilter);
    expect(tex.magFilter).toBe(THREE.LinearFilter);
    expect(tex.anisotropy).toBe(8);
    expect(tex.colorSpace).toBe(THREE.SRGBColorSpace);

    tex.dispose();
  });

  it('creates shadow texture with high resolution (1024x1024), mipmaps, and trilinear filtering', () => {
    const tex = createShadowTexture();

    expect(tex).toBeInstanceOf(THREE.CanvasTexture);
    expect(tex.image.width).toBe(1024);
    expect(tex.image.height).toBe(1024);
    expect(tex.generateMipmaps).toBe(true);
    expect(tex.minFilter).toBe(THREE.LinearMipmapLinearFilter);
    expect(tex.magFilter).toBe(THREE.LinearFilter);
    expect(tex.colorSpace).toBe(THREE.SRGBColorSpace);

    tex.dispose();
  });

  it('creates gradient background texture at 2048x2048 with mipmaps and trilinear filtering', () => {
    const tex = createGradientTexture({
      kind: 'gradient',
      gradientType: 'linear',
      stops: [
        { offset: 0, color: '#ff0000' },
        { offset: 1, color: '#0000ff' },
      ],
      angle: 45,
    });

    expect(tex).toBeInstanceOf(THREE.CanvasTexture);
    expect(tex.image.width).toBe(2048);
    expect(tex.image.height).toBe(2048);
    expect(tex.generateMipmaps).toBe(true);
    expect(tex.minFilter).toBe(THREE.LinearMipmapLinearFilter);
    expect(tex.magFilter).toBe(THREE.LinearFilter);
    expect(tex.colorSpace).toBe(THREE.SRGBColorSpace);

    tex.dispose();
  });
});
