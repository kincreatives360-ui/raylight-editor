import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAPass } from 'three/examples/jsm/postprocessing/FXAAPass.js';
import { getSafeMsaaSampleCount, shouldRebuildPassList } from './SceneEffectsPipeline';

describe('SceneEffectsPipeline pass initialization', () => {
  it('rebuilds a recreated composer even when the enabled effects have not changed', () => {
    expect(shouldRebuildPassList('', '', 0)).toBe(true);
    expect(shouldRebuildPassList('bloom', 'bloom', 0)).toBe(true);
    expect(shouldRebuildPassList('bloom', 'bloom', 4)).toBe(false);
  });
  it('builds the render chain on first render when no effects are enabled', () => {
    expect(shouldRebuildPassList(null, '')).toBe(true);
  });

  it('does not rebuild an already initialized empty effect pass list', () => {
    expect(shouldRebuildPassList('', '')).toBe(false);
  });
});

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

import {
  scenePassKeys,
  createSceneEffectPass,
  configureSceneEffectPass,
  createOutputEncodingPass,
} from './sceneEffectPasses';
import { createDefaultEffects } from '../../model/defaults';
import type { EvaluatedEffects } from '../../engine/evaluateEffects';

describe('SceneEffectsPipeline ordered passes & color encoding', () => {
  it('creates valid shader passes for all 9 scene effect keys', () => {
    for (const key of scenePassKeys) {
      const pass = createSceneEffectPass(key);
      expect(pass).toBeInstanceOf(ShaderPass);
      expect(pass.uniforms.tDiffuse).toBeDefined();
      expect(pass.uniforms.uParams).toBeDefined();
      expect(pass.uniforms.uResolution).toBeDefined();
      expect(pass.uniforms.uSeed).toBeDefined();
      pass.material.dispose();
    }
  });

  it('configures uniforms with deterministic seed and custom parameters', () => {
    const effectsState = createDefaultEffects();
    effectsState.colorGrade.enabled = true;
    effectsState.colorGrade.exposure = 0.5;
    effectsState.colorGrade.contrast = 1.2;
    effectsState.colorGrade.saturation = 1.1;
    effectsState.colorGrade.temperature = 0.3;
    effectsState.colorGrade.tint = -0.2;

    const evaluated: EvaluatedEffects = {
      state: effectsState,
      orderedEnabledPasses: [
        { key: 'colorGrade', orderIndex: 1, summary: 'Color Grade' },
      ],
      deterministicSeed: 0.765432,
    };

    const pass = createSceneEffectPass('colorGrade');
    configureSceneEffectPass(pass, 'colorGrade', evaluated, 1920, 1080);

    const params = pass.uniforms.uParams.value as THREE.Vector4;
    expect(params.x).toBeCloseTo(0.5); // exposure
    expect(params.y).toBeCloseTo(1.2); // contrast
    expect(params.z).toBeCloseTo(1.1); // saturation
    expect(params.w).toBeCloseTo(0.3); // temperature
    expect(pass.uniforms.uExtra.value.x).toBeCloseTo(-0.2); // tint
    expect(pass.uniforms.uSeed.value).toBe(0.765432); // deterministicSeed
    expect(pass.uniforms.uResolution.value.x).toBe(1920);
    expect(pass.uniforms.uResolution.value.y).toBe(1080);
    pass.material.dispose();
  });

  it('provides an output encoding pass converting linear to display sRGB', () => {
    const encodingPass = createOutputEncodingPass();
    expect(encodingPass).toBeInstanceOf(ShaderPass);
    expect(encodingPass.material.fragmentShader).toContain('lessThanEqual');
    expect(encodingPass.material.fragmentShader).toContain('1.055*pow(rgb,vec3(1.0/2.4))-.055');
    encodingPass.material.dispose();
  });

  it('assembles passes in exact evaluated order followed by sRGB encoding and FXAA on screen', () => {
    const mockGl = {
      capabilities: { isWebGL2: true, maxSamples: 4 },
      getPixelRatio: () => 1,
      getSize: (target: THREE.Vector2) => target.set(1920, 1080),
      setSize: () => {},
      setRenderTarget: () => {},
      clear: () => {},
      render: () => {},
    } as unknown as THREE.WebGLRenderer;

    const composer = new EffectComposer(mockGl);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const renderPass = new RenderPass(scene, camera);

    const effectsState = createDefaultEffects();
    effectsState.glitch.enabled = true;
    effectsState.bloom.enabled = true;

    // Custom order: glitch first, then bloom
    const evaluated: EvaluatedEffects = {
      state: effectsState,
      orderedEnabledPasses: [
        { key: 'glitch', orderIndex: 1, summary: 'Glitch' },
        { key: 'bloom', orderIndex: 2, summary: 'Bloom' },
      ],
      deterministicSeed: 0.123456,
    };

    composer.passes = [renderPass];
    renderPass.renderToScreen = false;

    for (const { key } of evaluated.orderedEnabledPasses) {
      const pass = createSceneEffectPass(key);
      pass.renderToScreen = false;
      configureSceneEffectPass(pass, key, evaluated, 1920, 1080);
      composer.addPass(pass);
    }

    const encodingPass = createOutputEncodingPass();
    encodingPass.renderToScreen = false;
    composer.addPass(encodingPass);

    const fxaaPass = new FXAAPass();
    fxaaPass.renderToScreen = true;
    composer.addPass(fxaaPass);

    // renderPass (0) -> glitch (1) -> bloom (2) -> encodingPass (3) -> fxaaPass (4)
    expect(composer.passes.length).toBe(5);
    expect(composer.passes[0]).toBe(renderPass);
    expect(composer.passes[3]).toBe(encodingPass);
    expect(composer.passes[4]).toBe(fxaaPass);
    expect(fxaaPass.renderToScreen).toBe(true);

    composer.dispose();
  });

  it('configures depthOfField pass with depth texture uniform and focal parameters', () => {
    const effectsState = createDefaultEffects();
    effectsState.depthOfField.enabled = true;
    effectsState.depthOfField.target.z = 2.5;
    effectsState.depthOfField.focusRange = 0.2;
    effectsState.depthOfField.bokehScale = 1.5;
    effectsState.depthOfField.aperture = 1.8;
    effectsState.depthOfField.bokehShape = 'anamorphic';

    const evaluated: EvaluatedEffects = {
      state: effectsState,
      orderedEnabledPasses: [
        { key: 'depthOfField', orderIndex: 0, summary: 'Depth of Field' },
      ],
      deterministicSeed: 0.5,
    };

    const pass = createSceneEffectPass('depthOfField');
    expect(pass.uniforms.tDepth).toBeDefined();

    configureSceneEffectPass(pass, 'depthOfField', evaluated, 1920, 1080);

    const params = pass.uniforms.uParams.value as THREE.Vector4;
    expect(params.x).toBeGreaterThan(0.5); // focal plane
    expect(params.y).toBeCloseTo(0.2); // focusRange
    expect(params.z).toBeCloseTo(1.5); // bokehScale
    expect(params.w).toBeCloseTo(1.8); // aperture

    const extra = pass.uniforms.uExtra.value as THREE.Vector4;
    expect(extra.w).toBe(1.0); // anamorphic flag

    pass.material.dispose();
  });
});

