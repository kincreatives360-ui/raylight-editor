import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAPass } from 'three/examples/jsm/postprocessing/FXAAPass.js';
import { getSafeMsaaSampleCount } from './SceneEffectsPipeline';

describe('SceneEffectsPipeline anti-aliasing setup', () => {
  it('correctly creates FXAAPass with resolution uniform matching pixel dimensions', () => {
    const width = 1200;
    const height = 675;
    const dpr = 2;

    const fxaa = new FXAAPass();
    fxaa.setSize(width * dpr, height * dpr);

    const res = fxaa.material.uniforms['resolution'].value as THREE.Vector2;
    expect(res.x).toBeCloseTo(1 / (width * dpr));
    expect(res.y).toBeCloseTo(1 / (height * dpr));
  });

  it('places FXAAPass at the end of the post-processing chain for screen output', () => {
    // Mock WebGLRenderer to verify pass chain
    const mockGl = {
      capabilities: { isWebGL2: true, maxSamples: 4 },
      getPixelRatio: () => 2,
      getSize: (target: THREE.Vector2) => target.set(800, 600),
      setSize: () => {},
      setRenderTarget: () => {},
      clear: () => {},
      render: () => {},
    } as unknown as THREE.WebGLRenderer;

    const composer = new EffectComposer(mockGl);
    composer.setSize(800, 600);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();

    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    const shaderPass = new ShaderPass({
      uniforms: { tDiffuse: { value: null } },
      vertexShader: 'void main() {}',
      fragmentShader: 'void main() {}',
    });
    composer.addPass(shaderPass);

    const fxaaPass = new FXAAPass();
    fxaaPass.renderToScreen = true;
    composer.addPass(fxaaPass);

    expect(composer.passes.length).toBe(3);
    expect(composer.passes[0]).toBe(renderPass);
    expect(composer.passes[1]).toBe(shaderPass);
    expect(composer.passes[2]).toBe(fxaaPass);
    expect(fxaaPass.renderToScreen).toBe(true);

    composer.dispose();
    fxaaPass.material.dispose();
    shaderPass.material.dispose();
  });

  it('adjusts MSAA sample count based on pixel dimensions and GPU limits', () => {
    // 1080p standard: full 4 samples
    expect(getSafeMsaaSampleCount(1920, 1080, 4)).toBe(4);

    // 1440p high-density: reduced to 2 samples
    expect(getSafeMsaaSampleCount(2560, 1440, 4)).toBe(2);

    // 4K ultra-high resolution: disabled (0 samples) to prevent VRAM overflow
    expect(getSafeMsaaSampleCount(3840, 2160, 4)).toBe(0);

    // Respects low GPU capability limits
    expect(getSafeMsaaSampleCount(800, 600, 2)).toBe(2);
    expect(getSafeMsaaSampleCount(800, 600, 0)).toBe(0);
  });
});
