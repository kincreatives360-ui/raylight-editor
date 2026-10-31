import * as THREE from 'three';
import type { LayerEffects } from '../../model/types';
import { COLOR_GRADE_GLSL, RANDOM_GLSL } from './shaderPrimitives';

export function getLayerStyleUniforms(effects: LayerEffects) {
    const grade = effects.colorCorrection?.enabled ? effects.colorCorrection : undefined;
    const noise = effects.noise?.enabled ? effects.noise : undefined;
    const bevel = effects.bevel?.enabled ? effects.bevel : undefined;
    const print = effects.halftone?.enabled ? effects.halftone : undefined;
    const pixel = effects.pixelate?.enabled ? effects.pixelate : undefined;
    const rgb = effects.rgbSplit?.enabled ? effects.rgbSplit : undefined;
    return {
        styleGrade: { value: new THREE.Vector4(grade?.exposure ?? 0, grade?.contrast ?? 1, grade?.saturation ?? 1, grade ? 1 : 0) },
        styleBalance: { value: new THREE.Vector2(grade?.temperature ?? 0, grade?.tint ?? 0) },
        styleLevels: { value: new THREE.Vector3(grade?.blackPoint ?? 0, grade?.whitePoint ?? 1, grade?.gamma ?? 1) },
        styleCurves: { value: new THREE.Vector3(grade?.curveShadows ?? 0, grade?.curveMidtones ?? 0, grade?.curveHighlights ?? 0) },
        styleCurveR: { value: new THREE.Vector3(...(grade?.curveR ?? [0, 0, 0])) },
        styleCurveG: { value: new THREE.Vector3(...(grade?.curveG ?? [0, 0, 0])) },
        styleCurveB: { value: new THREE.Vector3(...(grade?.curveB ?? [0, 0, 0])) },
        styleNoise: { value: new THREE.Vector4(noise?.amount ?? 0, noise?.scale ?? 1, noise?.density ?? 1, noise?.seed ?? 0) },
        styleNoiseOptions: { value: new THREE.Vector2(noise?.monochrome === false ? 0 : 1, noise?.animated ? noise.speed : 0) },
        styleBevel: { value: new THREE.Vector4(bevel?.thickness ?? 0, bevel?.depth ?? 0, (bevel?.angle ?? 0) * Math.PI / 180, bevel?.intensity ?? 0) },
        styleBevelSoftness: { value: bevel?.softness ?? (bevel?.thickness ?? 0) * .35 },
        styleBevelHighlight: { value: new THREE.Color(bevel?.highlightColor ?? '#ffffff') },
        styleBevelShadow: { value: new THREE.Color(bevel?.shadowColor ?? '#000000') },
        styleHalftone: { value: new THREE.Vector4(print ? 1 : 0, print?.dotSize ?? 8, print?.spacing ?? 10, (print?.angle ?? 0) * Math.PI / 180) },
        styleHalftoneOffset: { value: new THREE.Vector2(print?.offsetX ?? 0, print?.offsetY ?? 0) },
        styleHalftoneContrast: { value: print?.contrast ?? 1 },
        stylePrintOptions: { value: new THREE.Vector3(['circle', 'square', 'line'].indexOf(print?.shape ?? 'circle'), print?.sourceColor ? 1 : 0, print?.invert ? 1 : 0) },
        stylePrintForeground: { value: new THREE.Color(print?.foreground ?? '#000000') },
        stylePrintBackground: { value: new THREE.Color(print?.background ?? '#ffffff') },
        stylePixelate: { value: new THREE.Vector3(pixel?.blockSize ?? 1, pixel?.aspect ?? 1, pixel ? 1 : 0) },
        stylePixelateOffset: { value: new THREE.Vector2(pixel?.offsetX ?? 0, pixel?.offsetY ?? 0) },
        stylePixelProfile: { value: new THREE.Vector4(pixel?.mode === 'progressive' ? pixel.start : pixel?.blockSize ?? 1, pixel?.mode === 'progressive' ? pixel.end : pixel?.blockSize ?? 1, (pixel?.angle ?? 0) * Math.PI / 180, pixel?.mode === 'progressive' ? 1 : 0) },
        styleRgbSplit: { value: new THREE.Vector4(rgb?.amount ?? 0, (rgb?.angle ?? 0) * Math.PI / 180, rgb?.mode === 'radial' ? 1 : 0, rgb ? 1 : 0) },
        styleRgbChannels: { value: new THREE.Vector3(rgb?.red ?? 1, rgb?.green ?? 0, rgb?.blue ?? -1) },
        styleRgbCenter: { value: new THREE.Vector2(rgb?.centerX ?? .5, rgb?.centerY ?? .5) },
    };
}

/** Uses the production map, authored coordinates, blur sampler and timeline uniforms. */
export const LAYER_STYLE_GLSL = `
${COLOR_GRADE_GLSL}
${RANDOM_GLSL}
uniform vec4 styleGrade, styleNoise, styleBevel, styleHalftone, stylePixelProfile, styleRgbSplit;
uniform vec2 styleBalance, styleNoiseOptions, styleHalftoneOffset, stylePixelateOffset, styleRgbCenter;
uniform vec3 styleLevels, styleCurves, styleBevelHighlight, styleBevelShadow;
uniform vec3 styleCurveR, styleCurveG, styleCurveB;
uniform vec3 stylePrintOptions, stylePrintForeground, stylePrintBackground, stylePixelate;
uniform vec3 styleRgbChannels;
uniform float styleBevelSoftness, styleHalftoneContrast;

// styleCurve removed: use raylightCurve(v, styleCurves.x, styleCurves.y, styleCurves.z) directly

vec2 layerStyleUv(vec2 uv, vec2 localUv) {
    if (stylePixelate.z < .5) return uv;
    float block = layerBlurRadius(stylePixelProfile, localUv, vec4(0., .5, .5, 16.));
    if (block < 1.) return uv;
    vec2 pixels = (uv - layerContentCenter) * layerAuthorSize - stylePixelateOffset;
    return (floor(pixels / vec2(block * stylePixelate.y, block)) + .5) * vec2(block * stylePixelate.y, block) / layerAuthorSize + layerContentCenter + stylePixelateOffset / layerAuthorSize;
}

#ifdef USE_MAP
vec4 layerApplyStyles(vec4 artwork, vec2 uv, vec2 localUv) {
    if (styleRgbSplit.w > .5 && styleRgbSplit.x > 0.) {
        vec2 direction = vec2(cos(styleRgbSplit.y), -sin(styleRgbSplit.y));
        if (styleRgbSplit.z > .5) {
            vec2 rgbCenter = layerContentCenter + (styleRgbCenter - .5) / max(layerContentScale, vec2(.0001));
            vec2 radial = uv - rgbCenter;
            direction = radial / max(length(radial), .0001);
        }
        vec2 shift = direction * styleRgbSplit.x / layerAuthorSize;
        // Border-aware sampling prevents colour fringing from inflating the apparent object size
        vec2 rUv = uv + shift * styleRgbChannels.x;
        vec2 gUv = uv + shift * styleRgbChannels.y;
        vec2 bUv = uv + shift * styleRgbChannels.z;
        float rIn = step(0., rUv.x) * step(rUv.x, 1.) * step(0., rUv.y) * step(rUv.y, 1.);
        float gIn = step(0., gUv.x) * step(gUv.x, 1.) * step(0., gUv.y) * step(gUv.y, 1.);
        float bIn = step(0., bUv.x) * step(bUv.x, 1.) * step(0., bUv.y) * step(bUv.y, 1.);
        vec4 rSamp = mix(artwork, texture2D(map, clamp(rUv, vec2(0.), vec2(1.))), rIn);
        vec4 gSamp = mix(artwork, texture2D(map, clamp(gUv, vec2(0.), vec2(1.))), gIn);
        vec4 bSamp = mix(artwork, texture2D(map, clamp(bUv, vec2(0.), vec2(1.))), bIn);
        artwork.rgb = vec3(rSamp.r, gSamp.g, bSamp.b);
        // Alpha preserved: style shaders strictly alter rgb
    }
    if (styleHalftone.x > .5) {
        vec2 pixels = (uv - layerContentCenter) * layerAuthorSize - styleHalftoneOffset;
        float c = cos(styleHalftone.w), s = sin(styleHalftone.w);
        vec2 grid = mat2(c, -s, s, c) * pixels;
        float spacing = max(.5, styleHalftone.z);
        vec2 center = (floor(grid / spacing) + .5) * spacing;
        vec2 sourcePixel = mat2(c, s, -s, c) * center;
        vec3 sourceColor = texture2D(map, clamp(layerContentCenter + (sourcePixel + styleHalftoneOffset) / layerAuthorSize, vec2(0.), vec2(1.))).rgb;
        float brightness = clamp(dot(sourceColor, vec3(.2126, .7152, .0722)), 0., 1.);
        brightness = clamp((brightness - .5) * styleHalftoneContrast + .5, 0., 1.);
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
        artwork.rgb = vec3(
            raylightCurve(raylightCurve(color.r, styleCurves.x, styleCurves.y, styleCurves.z), styleCurveR.x, styleCurveR.y, styleCurveR.z),
            raylightCurve(raylightCurve(color.g, styleCurves.x, styleCurves.y, styleCurves.z), styleCurveG.x, styleCurveG.y, styleCurveG.z),
            raylightCurve(raylightCurve(color.b, styleCurves.x, styleCurves.y, styleCurves.z), styleCurveB.x, styleCurveB.y, styleCurveB.z)
        );
    }
    if (styleBevel.w > 0. && styleBevel.x > 0.) {
        vec2 delta = vec2(cos(styleBevel.z), -sin(styleBevel.z)) * styleBevel.x / layerAuthorSize;
        float high = layerSampleArtwork(uv + delta, styleBevelSoftness, vec4(0., .5, .5, 16.)).a;
        float low = layerSampleArtwork(uv - delta, styleBevelSoftness, vec4(0., .5, .5, 16.)).a;
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
