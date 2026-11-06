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

  it('sets uColor.g to 1.0 for physical and 0.0 for artistic and classic models', () => {
    const shot = createDefaultShot();
    shot.effects.depthOfField = { ...shot.effects.depthOfField, enabled: true };
    const pass = createSceneEffectPass('depthOfField');

    shot.effects.depthOfField.model = 'physical';
    configureSceneEffectPass(pass, 'depthOfField', evaluateEffectsAtTime(shot, 0), 1920, 1080);
    expect((pass.uniforms.uColor.value as THREE.Color).g).toBe(1.0);

    shot.effects.depthOfField.model = 'artistic';
    configureSceneEffectPass(pass, 'depthOfField', evaluateEffectsAtTime(shot, 0), 1920, 1080);
    expect((pass.uniforms.uColor.value as THREE.Color).g).toBe(0.0);

    shot.effects.depthOfField.model = 'classic';
    configureSceneEffectPass(pass, 'depthOfField', evaluateEffectsAtTime(shot, 0), 1920, 1080);
    expect((pass.uniforms.uColor.value as THREE.Color).g).toBe(0.0);
  });

  it('preserves manual focusDistance when focusMode is manual, and updates when target is selected', () => {
    const shot = createDefaultShot();
    shot.effects.depthOfField = {
      ...shot.effects.depthOfField,
      enabled: true,
      focusMode: 'manual',
      focusDistance: 3.5,
      target: { x: 0, y: 0, z: 10 },
    };
    const pass = createSceneEffectPass('depthOfField');
    const cameraClip = {
      near: 0.1,
      far: 100,
      position: { x: 0, y: 0, z: 0 },
      forward: { x: 0, y: 0, z: -1 },
    };

    // In manual mode, focusDistance remains 3.5 even with target set
    configureSceneEffectPass(pass, 'depthOfField', evaluateEffectsAtTime(shot, 0), 1920, 1080, { x: 0, y: 0 }, cameraClip);
    expect((pass.uniforms.uParams.value as THREE.Vector4).x).toBeCloseTo(3.5);

    // In target mode, focusDistance calculates to the target point
    shot.effects.depthOfField.focusMode = 'target';
    shot.effects.depthOfField.target = { x: 0, y: 0, z: -8 };
    configureSceneEffectPass(pass, 'depthOfField', evaluateEffectsAtTime(shot, 0), 1920, 1080, { x: 0, y: 0 }, cameraClip);
    expect((pass.uniforms.uParams.value as THREE.Vector4).x).toBeCloseTo(8.0);

    // With resolvedFocusTarget provided
    configureSceneEffectPass(pass, 'depthOfField', evaluateEffectsAtTime(shot, 0), 1920, 1080, { x: 0, y: 0 }, cameraClip, { x: 0, y: 0, z: -5 });
    expect((pass.uniforms.uParams.value as THREE.Vector4).x).toBeCloseTo(5.0);

    // When focusAssetId is set and resolvedFocusTarget is null (not found in scene), do not use stale dof.target
    shot.effects.depthOfField.focusMode = 'selection';
    shot.effects.depthOfField.focusAssetId = 'missing-layer';
    shot.effects.depthOfField.focusDistance = 4.2;
    shot.effects.depthOfField.target = { x: 0, y: 0, z: -15 };
    configureSceneEffectPass(pass, 'depthOfField', evaluateEffectsAtTime(shot, 0), 1920, 1080, { x: 0, y: 0 }, cameraClip, null);
    expect((pass.uniforms.uParams.value as THREE.Vector4).x).toBeCloseTo(4.2);
  });

  it('scales maxBlur by resolutionScale only when configured, leaving optics fallback in render pixels', () => {
    const shot = createDefaultShot();
    shot.effects.depthOfField = {
      ...shot.effects.depthOfField,
      enabled: true,
      maxBlur: 32,
    };
    const pass = createSceneEffectPass('depthOfField');

    // At 540p (resolutionScale = 0.5), configured maxBlur (32) scales to 16
    configureSceneEffectPass(pass, 'depthOfField', evaluateEffectsAtTime(shot, 0), 960, 540);
    expect((pass.uniforms.uParams.value as THREE.Vector4).z).toBeCloseTo(16);

    // When maxBlur is NaN / unconfigured, optics fallback is used directly without resolution scaling
    shot.effects.depthOfField.maxBlur = Number.NaN;
    configureSceneEffectPass(pass, 'depthOfField', evaluateEffectsAtTime(shot, 0), 960, 540);
    const fallbackBlur = (pass.uniforms.uParams.value as THREE.Vector4).z;
    expect(fallbackBlur).toBeGreaterThanOrEqual(1);
  });
});
