import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { configureSceneEffectPass, createSceneEffectPass, dofResolutionScale } from './sceneEffectPasses';
import { evaluateEffectsAtTime } from '../../engine/evaluateEffects';
import { createDefaultShot } from '../../model/defaults';

function dofEvaluated() {
  const shot = createDefaultShot();
  shot.effects.depthOfField = { ...shot.effects.depthOfField, enabled: true, maxBlur: 40, bokehScale: 1 };
  return evaluateEffectsAtTime(shot, 0);
}

function configure(height: number) {
  const pass = createSceneEffectPass('depthOfField');
  configureSceneEffectPass(pass, 'depthOfField', dofEvaluated(), Math.round(height * 16 / 9), height);
  return pass;
}

describe('depth of field resolution scaling', () => {
  it('maps the render height to a scale against the 1080p authoring frame', () => {
    expect(dofResolutionScale(1080)).toBe(1);
    expect(dofResolutionScale(540)).toBeCloseTo(0.5);
    expect(dofResolutionScale(2160)).toBeCloseTo(2);
    expect(dofResolutionScale(0)).toBe(1);
    expect(dofResolutionScale(Number.NaN)).toBe(1);
  });

  it('keeps blur proportional to the frame, so previews and exports match', () => {
    const preview = configure(540);
    const exported = configure(1080);
    const blurOf = (pass: ReturnType<typeof configure>) => (pass.uniforms.uParams.value as THREE.Vector4).z;
    const gainOf = (pass: ReturnType<typeof configure>) => (pass.uniforms.uExtra.value as THREE.Vector4).w;
    expect(blurOf(exported)).toBeCloseTo(40);
    expect(blurOf(preview) / blurOf(exported)).toBeCloseTo(0.5);
    expect(gainOf(preview) / gainOf(exported)).toBeCloseTo(0.5);
  });
});

describe('depth of field shader', () => {
  const source = createSceneEffectPass('depthOfField').material.fragmentShader;

  it('weights each tap by its own blur disc, so a shape blurs as a shape instead of feathering', () => {
    expect(source).toContain('minDisc / max(effective, minDisc)');
    expect(source).toContain('cover * disc * disc');
  });

  it('gathers alpha with the colour, so a transparent render does not keep a crisp silhouette', () => {
    expect(source).toContain('vec4 accum = col * selfWeight;');
    expect(source).toContain('col = accum / wSum;');
    expect(source).not.toContain('col.rgb = accum / wSum;');
  });
});
