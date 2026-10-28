import * as THREE from 'three';
import type { BlendMode, LayerEffects, SceneEffects } from '../../model/types';
import { acquireCanvas, releaseCanvas } from '../../engine/canvasPool';

export function getBokehOffsets(shape: SceneEffects['depthOfField']['bokehShape'] = 'spherical') {
    return Array.from({ length: 32 }, (_, i) => {
        const angle = i * 2.39996323;
        let radius = Math.sqrt((i + .5) / 32);
        if (shape === 'vintage') radius *= Math.cos(Math.PI / 6) / Math.cos((angle % (Math.PI / 3)) - Math.PI / 6);
        if (shape === 'portrait') radius *= radius;
        return { x: Math.cos(angle) * radius * (shape === 'anamorphic' ? 2 : 1), y: Math.sin(angle) * radius * (shape === 'anamorphic' ? .5 : 1) };
    });
}

export function applyBokehBlur(canvas: HTMLCanvasElement, radius: number, shape?: SceneEffects['depthOfField']['bokehShape']) {
    if (radius <= .1) return;
    const source = acquireCanvas(canvas.width, canvas.height);
    const sourceCtx = source.getContext('2d');
    const ctx = canvas.getContext('2d');
    if (!sourceCtx || !ctx) {
        releaseCanvas(source);
        return;
    }
    sourceCtx.drawImage(canvas, 0, 0);
    ctx.save();
    ctx.resetTransform();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'lighter';
    const samples = getBokehOffsets(shape);
    ctx.globalAlpha = 1 / samples.length;
    for (const offset of samples) ctx.drawImage(source, offset.x * radius, offset.y * radius);
    ctx.restore();
    releaseCanvas(source);
}

export interface MotionBlurParams {
    motionX: number;
    motionY: number;
    motionZ?: number;
    rotZ?: number;
    scaleX?: number;
    scaleY?: number;
    samples?: number;
}

export function applyMotionBlur(
    canvas: HTMLCanvasElement,
    motionX: number | MotionBlurParams,
    motionY = 0,
    samples = 8
) {
    let mX: number;
    let mY: number;
    let rZ = 0;
    let sX = 0;
    let sY = 0;
    let sampleCount = samples;

    if (typeof motionX === 'object' && motionX !== null) {
        mX = motionX.motionX;
        mY = motionX.motionY;
        rZ = motionX.rotZ ?? 0;
        sX = motionX.scaleX ?? 0;
        sY = motionX.scaleY ?? 0;
        sampleCount = motionX.samples ?? 8;
    } else {
        mX = motionX;
        mY = motionY;
    }

    const dist = Math.hypot(mX, mY);
    const hasAngular = Math.abs(rZ) > 0.0001;
    const hasScale = Math.abs(sX) > 0.0001 || Math.abs(sY) > 0.0001;
    if (dist <= 0.5 && !hasAngular && !hasScale) return;

    const source = acquireCanvas(canvas.width, canvas.height);
    const sourceCtx = source.getContext('2d');
    const ctx = canvas.getContext('2d');
    if (!sourceCtx || !ctx) {
        releaseCanvas(source);
        return;
    }
    sourceCtx.drawImage(canvas, 0, 0);
    ctx.save();
    ctx.resetTransform();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const count = Math.max(2, Math.min(32, Math.round(sampleCount)));
    ctx.globalAlpha = 1 / count;
    ctx.globalCompositeOperation = 'lighter';

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    for (let i = 0; i < count; i++) {
        const t = (i / (count - 1)) - 0.5;
        if (hasAngular || hasScale) {
            ctx.save();
            ctx.translate(cx + mX * t, cy + mY * t);
            if (hasAngular) ctx.rotate(rZ * t);
            if (hasScale) ctx.scale(1 + sX * t, 1 + sY * t);
            ctx.drawImage(source, -cx, -cy);
            ctx.restore();
        } else {
            ctx.drawImage(source, mX * t, mY * t);
        }
    }
    ctx.restore();
    releaseCanvas(source);
}

export function applyLayerReveal(ctx: CanvasRenderingContext2D, width: number, height: number, sweep = 1, path = 1) {
    const progress = Math.max(0, Math.min(1, sweep, path));
    if (progress < 1) ctx.clearRect(width * progress, 0, width * (1 - progress), height);
}

export function getLayerHaloLayout(effects: LayerEffects, width: number, height: number, intensityOffset = 0, radiusOffset = 0) {
    const glowIntensity = Math.max(0, (effects.glow?.enabled ? effects.glow.intensity : 0) + intensityOffset);
    const glowRadius = Math.max(0, (effects.glow?.enabled ? effects.glow.radius : .05) + radiusOffset) * Math.max(width, height);
    const shadow = effects.dropShadow?.enabled ? effects.dropShadow : undefined;
    const padding = Math.ceil(Math.max(glowIntensity > 0 ? glowRadius * 3 : 0,
        shadow ? shadow.blur * Math.max(width, height) * 3 + Math.max(Math.abs(shadow.offsetX * width), Math.abs(shadow.offsetY * height)) : 0));
    return { padding, width: width + padding * 2, height: height + padding * 2, glowIntensity, glowRadius, shadow };
}

export function drawLayerHalo(source: HTMLCanvasElement, effects: LayerEffects, intensityOffset: number, radiusOffset: number, maxTextureSize: number) {
    const layout = getLayerHaloLayout(effects, source.width, source.height, intensityOffset, radiusOffset);
    if (!layout.shadow && layout.glowIntensity <= 0) return null;
    const canvas = acquireCanvas(
        Math.max(1, Math.ceil(layout.width * Math.min(1, maxTextureSize / Math.max(layout.width, layout.height)))),
        Math.max(1, Math.ceil(layout.height * Math.min(1, maxTextureSize / Math.max(layout.width, layout.height))))
    );
    const ratio = Math.min(1, maxTextureSize / Math.max(layout.width, layout.height));
    canvas.width = Math.max(1, Math.ceil(layout.width * ratio));
    canvas.height = Math.max(1, Math.ceil(layout.height * ratio));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const draw = (color: string, opacity: number, blur: number, x: number, y: number) => {
        // Draw the silhouette off-canvas; only its displaced shadow enters the output.
        const displacement = canvas.width * 2;
        ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
        ctx.shadowColor = color;
        ctx.shadowBlur = blur * ratio;
        ctx.shadowOffsetX = displacement + x * ratio;
        ctx.shadowOffsetY = y * ratio;
        ctx.drawImage(source, layout.padding * ratio - displacement, layout.padding * ratio, source.width * ratio, source.height * ratio);
    };
    if (layout.shadow) {
        const s = layout.shadow;
        draw(s.color, s.opacity, s.blur * Math.max(source.width, source.height), s.offsetX * source.width, s.offsetY * source.height);
    }
    if (layout.glowIntensity > 0) draw(effects.glow?.color ?? '#0088ff', layout.glowIntensity, layout.glowRadius, 0, 0);
    return { canvas, widthScale: layout.width / source.width, heightScale: layout.height / source.height };
}

export function getLayerEffectUniforms(effects: LayerEffects, blend: BlendMode) {
    const glass = effects.liquidGlass?.enabled ? effects.liquidGlass : undefined;
    return {
        layerScene: { value: null as THREE.Texture | null },
        layerResolution: { value: new THREE.Vector2(1, 1) },
        layerBlend: { value: ['normal', 'darken', 'multiply', 'lighten', 'screen', 'add', 'difference'].indexOf(blend) },
        layerBackdrop: { value: Math.max(0, effects.backdropBlur ?? 0) },
        layerGlass: { value: glass ? 1 : 0 },
        layerRefraction: { value: glass?.refraction ?? .1 },
        layerRoughness: { value: glass?.roughness ?? .15 },
        layerTint: { value: new THREE.Color(glass?.tint ?? '#ffffff') },
        // Warp is authored in stage pixels by the inspector; shaders consume UV displacement.
        layerWarp: { value: new THREE.Vector2(effects.warp?.enabled ? (effects.warp.amount ?? 0) / 1920 : 0, effects.warp?.frequency ?? 3) },
    };
}

export type LayerEffectUniforms = ReturnType<typeof getLayerEffectUniforms>;

/** Inject into both the unlit and lit materials, preserving their light/shadow calculations. */
export function installLayerEffects(shader: THREE.WebGLProgramParametersWithUniforms, uniforms: LayerEffectUniforms) {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = `
uniform sampler2D layerScene;
uniform vec2 layerResolution;
uniform int layerBlend;
uniform float layerBackdrop, layerGlass, layerRefraction, layerRoughness;
uniform vec3 layerTint;
uniform vec2 layerWarp;
vec3 layerSampleScene(vec2 uv, float radius) {
    vec3 c = texture2D(layerScene, uv).rgb * .2;
    for (int i = 0; i < 12; i++) {
        float a = float(i) * 2.39996323;
        vec2 offset = vec2(cos(a), sin(a)) * sqrt((float(i)+.5)/12.) * radius / layerResolution;
        c += texture2D(layerScene, clamp(uv + offset, vec2(0.), vec2(1.))).rgb * (.8/12.);
    }
    return c;
}
` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
#ifdef USE_MAP
    vec2 layerUv = vMapUv;
    layerUv.x += sin(layerUv.y * layerWarp.y * 6.2831853) * layerWarp.x * .1;
    layerUv.y += sin(layerUv.x * layerWarp.y * 6.2831853) * layerWarp.x * .1;
#endif
${THREE.ShaderChunk.map_fragment.replaceAll('vMapUv', 'layerUv')}
`);
    // Capture and source use the same output space, including the render-target's color space.
    shader.fragmentShader = shader.fragmentShader.replace('#include <colorspace_fragment>', `#include <colorspace_fragment>
if (layerBlend != 0 || layerBackdrop > 0. || layerGlass > .5) {
    if (gl_FragColor.a <= .0001) discard;
    vec2 screenUv = gl_FragCoord.xy / layerResolution;
    vec2 refractOffset = vec2(0.);
    #ifdef USE_MAP
    refractOffset = (vMapUv - .5) * layerRefraction * .08;
    #endif
    vec3 behind = layerSampleScene(screenUv + refractOffset * layerGlass,
        max(layerBackdrop, layerGlass * layerRoughness * 30.));
    vec3 sourceColor = gl_FragColor.rgb;
    if (layerGlass > .5) sourceColor = mix(sourceColor, behind * layerTint, .65);
    if (layerBlend == 1) sourceColor = min(sourceColor, behind);
    if (layerBlend == 2) sourceColor *= behind;
    if (layerBlend == 3) sourceColor = max(sourceColor, behind);
    if (layerBlend == 4) sourceColor = 1. - (1. - sourceColor) * (1. - behind);
    if (layerBlend == 5) sourceColor = min(vec3(1.), sourceColor + behind);
    if (layerBlend == 6) sourceColor = abs(behind - sourceColor);
    // Resolve here so a translucent layer composites against the blurred backdrop.
    gl_FragColor = vec4(mix(behind, sourceColor, gl_FragColor.a), 1.);
}
`);
}
