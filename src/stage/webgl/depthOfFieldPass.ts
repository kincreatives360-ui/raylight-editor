import * as THREE from 'three';
import { DepthOfFieldEffect, EffectPass } from 'postprocessing';
import { Pass as ThreePass } from 'three/examples/jsm/postprocessing/Pass.js';
import type { Effects } from '../../model/types';

export function createDepthOfFieldPass(
  camera: THREE.Camera,
  depthTexture: THREE.DepthTexture
): { pass: EffectPass; effect: DepthOfFieldEffect } {
  const effect = new DepthOfFieldEffect(camera);
  const pass = new EffectPass(camera, effect);
  pass.setDepthTexture(depthTexture);
  effect.setDepthTexture(depthTexture);
  return { pass, effect };
}

export function configureDepthOfFieldEffect(
  effect: DepthOfFieldEffect,
  dof: Effects['depthOfField'],
  focusTarget: THREE.Vector3
): void {
  effect.setTarget(focusTarget.clone());
  effect.circleOfConfusionMaterial.focusDistance = effect.calculateFocusDistance(focusTarget);
  effect.circleOfConfusionMaterial.focusRange = Math.max(0.0001, dof.focusRange);
  const apertureScale = Math.pow(2.8 / Math.max(0.1, dof.aperture), 2);
  const focalLengthScale = (dof.focalLength ?? 50) / 50;
  effect.bokehScale = Math.max(0, dof.bokehScale) * apertureScale * focalLengthScale;
}

export class ThreeComposerEffectPass extends ThreePass {
  needsSwap = true;
  clear = false;
  private effectPass: EffectPass | null = null;

  constructor(effectPass: EffectPass) {
    super();
    this.effectPass = effectPass;
  }

  override get renderToScreen(): boolean {
    return this.effectPass?.renderToScreen ?? false;
  }

  override set renderToScreen(value: boolean) {
    if (this.effectPass) this.effectPass.renderToScreen = value;
  }

  override setSize(width: number, height: number): void {
    this.effectPass?.setSize(width, height);
  }

  override render(
    renderer: THREE.WebGLRenderer,
    writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget,
    deltaTime: number,
    maskActive: boolean
  ): void {
    this.effectPass?.render(renderer, readBuffer, writeBuffer, deltaTime, maskActive);
  }

  override dispose(): void {
    this.effectPass?.dispose();
    this.effectPass = null;
  }
}
