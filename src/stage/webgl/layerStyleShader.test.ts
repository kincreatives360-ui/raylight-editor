import { describe, expect, it } from 'vitest';
import { addLayerEffect } from '../../model/layerEffects';
import { getLayerStyleUniforms, LAYER_STYLE_GLSL } from './layerStyleShader';

describe('shared layer style uniforms', () => {
  it('keeps inactive effects neutral and independently enables the requested style', () => {
    const base = getLayerStyleUniforms({});
    expect(base.styleGrade.value.w).toBe(0);
    expect(base.styleNoise.value.x).toBe(0);
    expect(base.styleBevel.value.w).toBe(0);
    expect(base.styleHalftone.value.x).toBe(0);
    expect(base.stylePixelate.value.z).toBe(0);
    expect(getLayerStyleUniforms(addLayerEffect({}, 'noise')).styleNoise.value.x).toBeGreaterThan(0);
    expect(getLayerStyleUniforms(addLayerEffect({}, 'halftone')).styleHalftone.value.x).toBe(1);
  });
  it('wires all advanced grade controls without changing alpha', () => {
    const effects = addLayerEffect({}, 'colorCorrection');
    const uniforms = getLayerStyleUniforms({ ...effects, colorCorrection: { ...effects.colorCorrection!, exposure: 2, gamma: 1.4, curveShadows: .1, curveMidtones: .2, curveHighlights: -.1 } });
    expect(uniforms.styleGrade.value.x).toBe(2);
    expect(uniforms.styleLevels.value.z).toBe(1.4);
    expect(uniforms.styleCurves.value.toArray()).toEqual([.1, .2, -.1]);
    expect(LAYER_STYLE_GLSL).toContain('artwork.rgb =');
    expect(LAYER_STYLE_GLSL).not.toContain('artwork.a =');
  });
});
