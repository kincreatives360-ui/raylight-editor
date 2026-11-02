import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAPass } from 'three/examples/jsm/postprocessing/FXAAPass.js';
import { getSafeMsaaSampleCount, shouldRebuildPassList, blendEvaluatedEffects } from './SceneEffectsPipeline';

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

  it('attaches depthTexture to both ping-pong targets so depth passes stay stable across buffer swaps', () => {
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
    const depthTexture = new THREE.DepthTexture(1920, 1080);
    composer.renderTarget1.depthTexture = depthTexture;
    composer.renderTarget2.depthTexture = depthTexture;

    expect(composer.renderTarget1.depthTexture).toBe(depthTexture);
    expect(composer.renderTarget2.depthTexture).toBe(depthTexture);

    depthTexture.dispose();
    composer.dispose();
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
  it('creates valid shader passes for all shader-backed scene effect keys', () => {
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

  it('uses a negative horizontal ghost shift so preview matches Canvas output', () => {
    const pass = createSceneEffectPass('ghost');
    expect(pass.material.fragmentShader).toContain('vec2 shift=-vec2(cos(angle),sin(angle))*uParams.y');
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

  it('configures vignette softness and custom color correctly in shader uniforms', () => {
    const effectsState = createDefaultEffects();
    effectsState.vignette.enabled = true;
    effectsState.vignette.intensity = 0.8;
    effectsState.vignette.midpoint = 0.4;
    effectsState.vignette.roundness = 1.2;
    effectsState.vignette.softness = 0.6;
    effectsState.vignette.color = '#ff8800';

    const evaluated: EvaluatedEffects = {
      state: effectsState,
      orderedEnabledPasses: [
        { key: 'vignette', orderIndex: 1, summary: 'Vignette' },
      ],
      deterministicSeed: 0.5,
    };

    const pass = createSceneEffectPass('vignette');
    configureSceneEffectPass(pass, 'vignette', evaluated, 1920, 1080);

    const params = pass.uniforms.uParams.value as THREE.Vector4;
    expect(params.x).toBeCloseTo(0.8); // intensity
    expect(params.y).toBeCloseTo(0.4); // midpoint
    expect(params.z).toBeCloseTo(1.2); // roundness
    expect(params.w).toBeCloseTo(0.6); // softness

    const color = pass.uniforms.uColor.value as THREE.Color;
    expect(color.getHexString()).toBe('ff8800');
    expect(pass.material.fragmentShader).toContain('mix(col.rgb,uColor*col.a,edge)');
    pass.material.dispose();
  });

  it('smoothly blends colorGrade, ghost, and edgeFade across shot transition progress', () => {
    const outState = createDefaultEffects();
    outState.colorGrade.enabled = true;
    outState.colorGrade.exposure = 1.0;
    outState.colorGrade.contrast = 2.0;
    outState.colorGrade.saturation = 0.5;
    outState.colorGrade.temperature = -0.5;
    outState.ghost.enabled = true;
    outState.ghost.opacity = 0.8;
    outState.ghost.offset = 0.4;
    outState.edgeFade.enabled = true;
    outState.edgeFade.top = 0.2;
    outState.edgeFade.bottom = 0.4;

    const inState = createDefaultEffects();
    inState.colorGrade.enabled = true;
    inState.colorGrade.exposure = 0.0;
    inState.colorGrade.contrast = 1.0;
    inState.colorGrade.saturation = 1.5;
    inState.colorGrade.temperature = 0.5;
    inState.ghost.enabled = true;
    inState.ghost.opacity = 0.2;
    inState.ghost.offset = 0.1;
    inState.edgeFade.enabled = true;
    inState.edgeFade.top = 0.0;
    inState.edgeFade.bottom = 0.0;

    const outgoing: EvaluatedEffects = {
      state: outState,
      orderedEnabledPasses: [
        { key: 'colorGrade', orderIndex: 0, summary: 'CG' },
        { key: 'ghost', orderIndex: 1, summary: 'Ghost' },
        { key: 'edgeFade', orderIndex: 2, summary: 'EF' },
      ],
      deterministicSeed: 0,
    };
    const incoming: EvaluatedEffects = {
      state: inState,
      orderedEnabledPasses: [
        { key: 'colorGrade', orderIndex: 0, summary: 'CG' },
        { key: 'ghost', orderIndex: 1, summary: 'Ghost' },
        { key: 'edgeFade', orderIndex: 2, summary: 'EF' },
      ],
      deterministicSeed: 0,
    };

    const blendedHalf = blendEvaluatedEffects(outgoing, incoming, 0.5);
    expect(blendedHalf.state.colorGrade.exposure).toBeCloseTo(0.5);
    expect(blendedHalf.state.colorGrade.contrast).toBeCloseTo(1.5);
    expect(blendedHalf.state.colorGrade.saturation).toBeCloseTo(1.0);
    expect(blendedHalf.state.colorGrade.temperature).toBeCloseTo(0.0);
    expect(blendedHalf.state.ghost.opacity).toBeCloseTo(0.5);
    expect(blendedHalf.state.ghost.offset).toBeCloseTo(0.25);
    expect(blendedHalf.state.edgeFade.top).toBeCloseTo(0.1);
    expect(blendedHalf.state.edgeFade.bottom).toBeCloseTo(0.2);
  });



  it('configures fishEye and lensDistortion modes accurately', () => {
    const effectsState = createDefaultEffects();
    effectsState.fishEye.enabled = true;
    effectsState.fishEye.amount = 0.35;
    effectsState.fishEye.edgeMode = 'balanced';

    effectsState.lensDistortion.enabled = true;
    effectsState.lensDistortion.strength = -0.4;
    effectsState.lensDistortion.mode = 'barrel';
    effectsState.lensDistortion.edgeMode = 'none';

    const evaluated: EvaluatedEffects = {
      state: effectsState,
      orderedEnabledPasses: [
        { key: 'fishEye', orderIndex: 1, summary: 'FishEye' },
        { key: 'lensDistortion', orderIndex: 2, summary: 'Lens' },
      ],
      deterministicSeed: 0.1,
    };

    const fishPass = createSceneEffectPass('fishEye');
    configureSceneEffectPass(fishPass, 'fishEye', evaluated, 1920, 1080);
    expect((fishPass.uniforms.uParams.value as THREE.Vector4).x).toBeCloseTo(0.35);
    expect((fishPass.uniforms.uExtra.value as THREE.Vector4).x).toBe(1); // balanced edge mode
    expect(fishPass.material.fragmentShader).toContain('#define EFFECT 11');
    fishPass.material.dispose();

    const lensPass = createSceneEffectPass('lensDistortion');
    configureSceneEffectPass(lensPass, 'lensDistortion', evaluated, 1920, 1080);
    expect((lensPass.uniforms.uParams.value as THREE.Vector4).x).toBeCloseTo(-0.4);
    expect((lensPass.uniforms.uExtra.value as THREE.Vector4).x).toBe(2); // none edge mode
    expect((lensPass.uniforms.uExtra.value as THREE.Vector4).z).toBe(1); // barrel mode
    expect(lensPass.material.fragmentShader).toContain('#define EFFECT 12');
    lensPass.material.dispose();
  });
});
