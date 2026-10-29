import * as THREE from 'three';
import type { LayerEffects } from '../../model/types';
import { COLOR_GRADE_GLSL, RANDOM_GLSL } from './shaderPrimitives';

export function getLayerStyleUniforms(effects: LayerEffects) {
    const grade = effects.colorCorrection?.enabled ? effects.colorCorrection : undefined;
    const noise = effects.noise?.enabled ? effects.noise : undefined;
    const bevel = effects.bevel?.enabled ? effects.bevel : undefined;
    const print = effects.halftone?.enabled ? effects.halftone : undefined;
    const pixel = effects.pixelate?.enabled ? effects.pixelate : undefined;
    return {
        styleGrade: { value: new THREE.Vector4(grade?.exposure ?? 0, grade?.contrast ?? 1, grade?.saturation ?? 1, grade ? 1 : 0) },
        styleBalance: { value: new THREE.Vector2(grade?.temperature ?? 0, grade?.tint ?? 0) },
        styleLevels: { value: new THREE.Vector3(grade?.blackPoint ?? 0, grade?.whitePoint ?? 1, grade?.gamma ?? 1) },
        styleCurves: { value: new THREE.Vector3(grade?.curveShadows ?? 0, grade?.curveMidtones ?? 0, grade?.curveHighlights ?? 0) },
        styleNoise: { value: new THREE.Vector4(noise?.amount ?? 0, noise?.scale ?? 1, noise?.density ?? 1, noise?.seed ?? 0) },
        styleNoiseOptions: { value: new THREE.Vector2(noise?.monochrome === false ? 0 : 1, noise?.animated ? noise.speed : 0) },
        styleBevel: { value: new THREE.Vector4(bevel?.thickness ?? 0, bevel?.depth ?? 0, (bevel?.angle ?? 0) * Math.PI / 180, bevel?.intensity ?? 0) },
        styleBevelHighlight: { value: new THREE.Color(bevel?.highlightColor ?? '#ffffff') },
        styleBevelShadow: { value: new THREE.Color(bevel?.shadowColor ?? '#000000') },
        styleHalftone: { value: new THREE.Vector4(print ? 1 : 0, print?.dotSize ?? 8, print?.spacing ?? 10, (print?.angle ?? 0) * Math.PI / 180) },
        stylePrintOptions: { value: new THREE.Vector3(['circle', 'square', 'line'].indexOf(print?.shape ?? 'circle'), print?.sourceColor ? 1 : 0, print?.invert ? 1 : 0) },
        stylePrintForeground: { value: new THREE.Color(print?.foreground ?? '#000000') },
        stylePrintBackground: { value: new THREE.Color(print?.background ?? '#ffffff') },
        stylePixelate: { value: new THREE.Vector3(pixel?.blockSize ?? 1, pixel?.aspect ?? 1, pixel ? 1 : 0) },
        stylePixelProfile: { value: new THREE.Vector4(pixel?.mode === 'progressive' ? pixel.start : pixel?.blockSize ?? 1, pixel?.mode === 'progressive' ? pixel.end : pixel?.blockSize ?? 1, (pixel?.angle ?? 0) * Math.PI / 180, pixel?.mode === 'progressive' ? 1 : 0) },
    };
}

/** Uses the production map, authored coordinates, blur sampler and timeline uniforms. */
export const LAYER_STYLE_GLSL = `
${COLOR_GRADE_GLSL}
${RANDOM_GLSL}
uniform vec4 styleGrade, styleNoise, styleBevel, styleHalftone, stylePixelProfile;
uniform vec2 styleBalance, styleNoiseOptions;
uniform vec3 styleLevels, styleCurves, styleBevelHighlight, styleBevelShadow;
uniform vec3 stylePrintOptions, stylePrintForeground, stylePrintBackground, stylePixelate;

float styleCurve(float value) {
    float c1 = clamp(.25 + styleCurves.x, 0., 1.);
    float c2 = clamp(.5 + styleCurves.y, 0., 1.);
    float c3 = clamp(.75 + styleCurves.z, 0., 1.);
    if (value < .25) return mix(0., c1, value * 4.);
    if (value < .5) return mix(c1, c2, (value - .25) * 4.);
    if (value < .75) return mix(c2, c3, (value - .5) * 4.);
    return mix(c3, 1., (value - .75) * 4.);
}

vec2 layerStyleUv(vec2 uv, vec2 localUv) {
    if (stylePixelate.z < .5) return uv;
    float block = layerBlurRadius(stylePixelProfile, localUv);
    if (block < 1.) return uv;
    vec2 cell = vec2(block * stylePixelate.y, block) / layerAuthorSize;
    return (floor((uv - layerContentCenter) / cell) + .5) * cell + layerContentCenter;
}

#ifdef USE_MAP
vec4 layerApplyStyles(vec4 artwork, vec2 uv, vec2 localUv) {
    if (styleHalftone.x > .5) {
        vec2 pixels = (uv - layerContentCenter) * layerAuthorSize;
        float c = cos(styleHalftone.w), s = sin(styleHalftone.w);
        vec2 grid = mat2(c, -s, s, c) * pixels;
        float spacing = max(.5, styleHalftone.z);
        vec2 center = (floor(grid / spacing) + .5) * spacing;
        vec2 sourcePixel = mat2(c, s, -s, c) * center;
        vec3 sourceColor = texture2D(map, clamp(layerContentCenter + sourcePixel / layerAuthorSize, vec2(0.), vec2(1.))).rgb;
        float brightness = clamp(dot(sourceColor, vec3(.2126, .7152, .0722)), 0., 1.);
        float coverage = mix(1. - brightness, brightness, stylePrintOptions.z);
        vec2 f = abs(grid - center);
        float distance = stylePrintOptions.x < .5 ? length(f) : (stylePrintOptions.x < 1.5 ? max(f.x, f.y) : f.y);
        float radius = styleHalftone.y * .5 * sqrt(coverage);
        float aa = max(.15, fwidth(distance));
        float dotMask = 1. - smoothstep(radius - aa, radius + aa, distance);
        artwork.rgb = mix(stylePrintBackground, mix(stylePrintForeground, sourceColor, stylePrintOptions.y), dotMask);
    }
    if (styleGrade.w > .5) {
        vec3 color = raylightGrade(artwork.rgb, vec4(styleGrade.xyz, styleBalance.x), styleBalance.y);
        color = clamp((color - styleLevels.x) / max(.001, styleLevels.y - styleLevels.x), 0., 1.);
        color = pow(color, vec3(1. / max(.1, styleLevels.z)));
        artwork.rgb = vec3(styleCurve(color.r), styleCurve(color.g), styleCurve(color.b));
    }
    if (styleBevel.w > 0. && styleBevel.x > 0.) {
        vec2 delta = vec2(cos(styleBevel.z), -sin(styleBevel.z)) * styleBevel.x / layerAuthorSize;
        float high = layerSampleArtwork(uv + delta, styleBevel.x * .35).a;
        float low = layerSampleArtwork(uv - delta, styleBevel.x * .35).a;
        float relief = clamp((low - high) * styleBevel.y / max(1., styleBevel.x), -1., 1.) * styleBevel.w;
        artwork.rgb = mix(artwork.rgb, styleBevelHighlight, max(0., relief));
        artwork.rgb = mix(artwork.rgb, styleBevelShadow, max(0., -relief));
    }
    if (styleNoise.x > 0.) {
        vec2 cell = floor((uv - layerContentCenter) * layerAuthorSize / max(.5, styleNoise.y));
        float seed = styleNoise.w + floor(layerTime * styleNoiseOptions.y * 24.);
        if (raylightRandom(cell + 17.31, seed) < styleNoise.z) {
            float mono = raylightRandom(cell, seed);
            vec3 randomColor = vec3(mono, raylightRandom(cell + 83.7, seed), raylightRandom(cell + 193.1, seed));
            artwork.rgb = max(vec3(0.), artwork.rgb + (mix(randomColor, vec3(mono), styleNoiseOptions.x) - .5) * styleNoise.x);
        }
    }
    return artwork;
}
#endif
`;
