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

  it('configures optical bokeh presets into uniforms', () => {
    const shot = createDefaultShot();
    shot.effects.depthOfField = {
      ...shot.effects.depthOfField,
      enabled: true,
      bokehShape: 'anamorphic',
      highlightThreshold: 0.8,
      highlightIntensity: 1.2,
      model: 'physical',
    };
    const pass = createSceneEffectPass('depthOfField');
    configureSceneEffectPass(pass, 'depthOfField', evaluateEffectsAtTime(shot, 0), 1920, 1080);

    const stretch = pass.uniforms.uMotion.value as THREE.Vector2;
    expect(stretch.x).toBeCloseTo(0.6, 2);
    expect(stretch.y).toBeCloseTo(1.5, 2);

    const fringe = pass.uniforms.uFringe.value as THREE.Vector4;
    expect(fringe.x).toBeCloseTo(0.8, 2); // highlightThreshold
    expect(fringe.y).toBeCloseTo(1.2, 2); // highlightIntensity
    expect(fringe.w).toBeCloseTo(0.35, 2); // rim

    const color = pass.uniforms.uColor.value as THREE.Color;
    expect(color.g).toBe(1.0); // physical model
  });

  it('configures vintage cat-eye and portrait softness presets', () => {
    const shot = createDefaultShot();
    shot.effects.depthOfField = {
      ...shot.effects.depthOfField,
      enabled: true,
      bokehShape: 'vintage',
      model: 'physical',
    };
    const pass = createSceneEffectPass('depthOfField');
    configureSceneEffectPass(pass, 'depthOfField', evaluateEffectsAtTime(shot, 0), 1920, 1080);
    const fringe = pass.uniforms.uFringe.value as THREE.Vector4;
    expect(fringe.z).toBeCloseTo(0.85, 2); // catEye
    expect(fringe.w).toBeCloseTo(1.0, 2); // rim

    shot.effects.depthOfField.bokehShape = 'portrait';
    configureSceneEffectPass(pass, 'depthOfField', evaluateEffectsAtTime(shot, 0), 1920, 1080);
    const color = pass.uniforms.uColor.value as THREE.Color;
    expect(color.r).toBeCloseTo(1.0, 2); // softness
  });
});
