import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createDefaultEffects } from '../../model/defaults';
import { ThreeComposerEffectPass } from './depthOfFieldPass';

async function loadModule() {
  try {
    return await import('./depthOfFieldPass');
  } catch (error) {
    if (error instanceof Error
      && error.message.startsWith('Cannot find module')
      && error.message.includes('depthOfFieldPass')) {
      return null;
    }
    throw error;
  }
}

describe('createDepthOfFieldPass', () => {
  it('creates a pmndrs depth-of-field effect pass with the supplied camera and depth buffer', async () => {
    const dofPassModule = await loadModule();
    expect(dofPassModule?.createDepthOfFieldPass).toBeTypeOf('function');
    if (!dofPassModule) return;

    const camera = new THREE.PerspectiveCamera();
    const depthTexture = new THREE.DepthTexture(320, 180);
    const { pass, effect } = dofPassModule.createDepthOfFieldPass(camera, depthTexture);

    expect(pass.constructor.name).toBe('EffectPass');
    expect(effect.constructor.name).toBe('DepthOfFieldEffect');
    expect(pass.getDepthTexture()).toBe(depthTexture);
    expect(effect.cocMaterial.uniforms.depthBuffer.value).toBe(depthTexture);

    pass.dispose();
    effect.dispose();
    depthTexture.dispose();
  });

  it('configures world focus, range, and aperture/focal-length-scaled bokeh', async () => {
    const dofPassModule = await loadModule();
    expect(dofPassModule?.configureDepthOfFieldEffect).toBeTypeOf('function');
    if (!dofPassModule) return;

    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 0, 10);
    camera.updateMatrixWorld(true);
    const depthTexture = new THREE.DepthTexture(320, 180);
    const { effect } = dofPassModule.createDepthOfFieldPass(camera, depthTexture);
    const dof = createDefaultEffects().depthOfField;
    dof.focusRange = 2.5;
    dof.aperture = 5.6;
    dof.bokehScale = 4;
    dof.focalLength = 100;
    const focusTarget = new THREE.Vector3(3, 4, 0);

    dofPassModule.configureDepthOfFieldEffect(effect, dof, focusTarget);

    expect(effect.getTarget()?.toArray()).toEqual([3, 4, 0]);
    expect(effect.circleOfConfusionMaterial.focusDistance).toBeCloseTo(Math.sqrt(125));
    expect(effect.circleOfConfusionMaterial.focusRange).toBe(2.5);
    expect(effect.bokehScale).toBeCloseTo(2);

    effect.dispose();
    depthTexture.dispose();
  });

  it('adapts buffer order and forwards sizing and screen output to the Three composer', async () => {
    const dofPassModule = await loadModule();
    expect(dofPassModule?.createDepthOfFieldPass).toBeTypeOf('function');
    if (!dofPassModule) return;

    const camera = new THREE.PerspectiveCamera();
    const depthTexture = new THREE.DepthTexture(320, 180);
    const { pass, effect } = dofPassModule.createDepthOfFieldPass(camera, depthTexture);
    const adapter = new ThreeComposerEffectPass(pass);
    const renderer = {} as THREE.WebGLRenderer;
    const writeBuffer = new THREE.WebGLRenderTarget();
    const readBuffer = new THREE.WebGLRenderTarget();
    const render = vi.spyOn(pass, 'render').mockImplementation(() => {});

    adapter.render(renderer, writeBuffer, readBuffer, 1 / 60, false);
    expect(render).toHaveBeenCalledWith(renderer, readBuffer, writeBuffer, 1 / 60, false);

    adapter.setSize(640, 360);
    expect(effect.resolution.baseWidth).toBe(640);
    expect(effect.resolution.baseHeight).toBe(360);
    adapter.renderToScreen = true;
    expect(pass.renderToScreen).toBe(true);

    adapter.dispose();
    depthTexture.dispose();
    writeBuffer.dispose();
    readBuffer.dispose();
  });
});
