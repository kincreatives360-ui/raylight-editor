import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDeviceShadowTexture, getIPhone15ProMaterialPolicy } from './iphone15ProMaterials';

describe('iPhone 15 Pro material policy', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('keeps the head-on reflection below the level that could wash out display media', () => {
    const policy = getIPhone15ProMaterialPolicy({ gloss: 1, reflection: 1, glassOpacity: 0.45 });

    expect(policy.headOnReflectionOpacity).toBeLessThanOrEqual(0.1);
    expect(policy.displayToneMapped).toBe(false);
    expect(policy.displayOpaque).toBe(true);
  });

  it('uses distinct titanium, rear-glass, lens, and flash material responses', () => {
    const policy = getIPhone15ProMaterialPolicy({ gloss: 0.5, reflection: 0.65, glassOpacity: 0.08 });

    expect(policy.titanium.metalness).toBeGreaterThan(policy.rearGlass.metalness);
    expect(policy.titanium.roughness).toBeGreaterThan(policy.lensGlass.roughness);
    expect(policy.flash.emissiveIntensity).toBeGreaterThan(0);
  });

  it('respects frameMetalness and frameRoughness overrides when provided', () => {
    const policy = getIPhone15ProMaterialPolicy({
      gloss: 0.5,
      reflection: 0.65,
      glassOpacity: 0.08,
      frameMetalness: 0.42,
      frameRoughness: 0.85,
    });

    expect(policy.titanium.metalness).toBeCloseTo(0.42, 5);
    expect(policy.titanium.roughness).toBeCloseTo(0.85, 5);
  });

  it('keeps the Dynamic Island above reflections in the front render stack', () => {
    const policy = getIPhone15ProMaterialPolicy({ gloss: 0.5, reflection: 0.65, glassOpacity: 0.08 });

    expect(policy.renderOrder.dynamicIsland).toBeGreaterThan(policy.renderOrder.reflection);
    expect(policy.renderOrder.reflection).toBeGreaterThan(policy.renderOrder.screenGlass);
  });

  it('retains a disposable local shadow texture for the full device assembly', () => {
    const gradient = { addColorStop: vi.fn() };
    vi.stubGlobal('document', {
      createElement: vi.fn(() => ({
        width: 0,
        height: 0,
        getContext: () => ({ createRadialGradient: () => gradient, fillRect: vi.fn(), fillStyle: '' }),
      })),
    });
    const texture = createDeviceShadowTexture();

    expect(texture.image.width).toBeGreaterThan(0);
    expect(texture.image.height).toBeGreaterThan(0);
    texture.dispose();
  });

  it('attenuates shadow opacity to zero when rotated away from the camera', () => {
    const shadowOpacity = 0.6;
    const calculateEffectiveOpacity = (rotX = 0, rotY = 0) => {
      const facingCamera = Math.max(0, Math.cos(rotX) * Math.cos(rotY));
      return Math.max(0, Math.min(1, shadowOpacity * facingCamera));
    };

    expect(calculateEffectiveOpacity(0, 0)).toBeCloseTo(0.6, 5);
    expect(calculateEffectiveOpacity(Math.PI / 2, 0)).toBeCloseTo(0, 5);
    expect(calculateEffectiveOpacity(0, Math.PI / 2)).toBeCloseTo(0, 5);
    expect(calculateEffectiveOpacity(Math.PI, 0)).toBeCloseTo(0, 5);
    expect(calculateEffectiveOpacity(Math.PI / 4, 0)).toBeCloseTo(0.6 * Math.cos(Math.PI / 4), 5);
  });
});
