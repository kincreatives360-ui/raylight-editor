import * as THREE from 'three';
import type { BlendMode, LayerEffects, SceneEffects } from '../../model/types';
import { acquireCanvas, releaseCanvas } from '../../engine/canvasPool';
import { getBlurSettings, warpPoint } from '../../model/layerEffects';
import { getLayerStyleUniforms, LAYER_STYLE_GLSL } from './layerStyleShader';
import { drawAlphaOutline, drawLongShadow } from '../../engine/layerAlphaEffects';

/** Geometry and the fallback share the same authored-pixel deformation. */
export function createWarpGeometry(width: number, height: number, authoredWidth: number, authoredHeight: number, warp: import('../../model/types').WarpEffect, pinBounds = { width: authoredWidth, height: authoredHeight }) {
    const geometry = new THREE.PlaneGeometry(width, height, 64, 48);
    updateWarpGeometry(geometry, width, height, authoredWidth, authoredHeight, warp, 0, pinBounds);
    return geometry;
}

/** Update the existing buffers during playback; do not allocate a mesh each frame. */
export function updateWarpGeometry(geometry: THREE.PlaneGeometry, width: number, height: number, authoredWidth: number, authoredHeight: number, warp: import('../../model/types').WarpEffect, timeSeconds = 0, pinBounds: { width: number; height: number; centerX?: number; centerY?: number } = { width: authoredWidth, height: authoredHeight }) {
    const positions = geometry.getAttribute('position');
    const uv = geometry.getAttribute('uv');
    for (let i = 0; i < positions.count; i++) {
        const point = warpPoint((uv.getX(i) - .5) * authoredWidth, (.5 - uv.getY(i)) * authoredHeight, warp, timeSeconds, pinBounds);
        positions.setXYZ(i, point.x / authoredWidth * width, -point.y / authoredHeight * height, point.z / authoredWidth * width);
    }
    positions.needsUpdate = true;
    geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
}

function paintSpread(ctx: CanvasRenderingContext2D, source: HTMLCanvasElement, x: number, y: number, width: number, height: number, spread: number) {
    ctx.drawImage(source, x, y, width, height);
    if (Math.abs(spread) < .1) return;
    const composite = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = spread > 0 ? composite : 'destination-in';
    for (let i = 0; i < 16; i++) {
        const angle = i / 16 * Math.PI * 2;
        ctx.drawImage(source, x + Math.cos(angle) * Math.abs(spread), y + Math.sin(angle) * Math.abs(spread), width, height);
    }
    ctx.globalCompositeOperation = composite;
}

/** Inner shadow and directional glow use the actual alpha silhouette. */
export function applyLayerSurfaceEffects(source: HTMLCanvasElement, effects: LayerEffects, authoredWidth = source.width, authoredHeight = source.height) {
    const outline = effects.outline;
    if (outline?.enabled && outline.placement === 'inside') {
        const ctx = source.getContext('2d');
        if (ctx) {
            ctx.save(); ctx.resetTransform(); ctx.globalCompositeOperation = 'source-atop';
            const ratio = source.width / Math.max(1, authoredWidth);
            drawAlphaOutline(ctx, source, { x: 0, y: 0, width: source.width, height: source.height, radius: outline.width * ratio, softness: outline.softness * ratio, placement: 'inside', color: outline.color, opacity: outline.opacity });
            ctx.restore();
        }
    }
    const shadows = [effects.dropShadow, ...(effects.shadows ?? [])].filter(s => s?.enabled && s.mode === 'inner');
    const glow = effects.glow?.enabled && effects.glow.mode ? effects.glow : undefined;
    if (!shadows.length && !glow) return;
    // Smooth masks do not need a full 4K copy of the artwork. Preserve the source,
    // and composite bounded-resolution shading over it at native resolution.
    const workingScale = Math.min(1, 2048 / Math.max(source.width, source.height));
    const workW = Math.max(1, Math.round(source.width * workingScale)), workH = Math.max(1, Math.round(source.height * workingScale));
    const sx = workW / Math.max(1, authoredWidth), sy = workH / Math.max(1, authoredHeight);
    const padding = Math.ceil(Math.min(512, Math.max(2, (glow ? glow.radius * 1920 * 3 + Math.abs(glow.depth ?? 0) : 0) * sx,
        ...shadows.map(s => s ? (s.blur * 1920 * 3 + Math.abs(s.spread ?? 0) + Math.max(Math.abs(s.offsetX * 1920), Math.abs(s.offsetY * 1080))) * Math.max(sx, sy) : 0))));
    const original = acquireCanvas(workW, workH), mask = acquireCanvas(workW + padding * 2, workH + padding * 2), result = acquireCanvas(workW, workH);
    try {
        const originalCtx = original.getContext('2d'), maskCtx = mask.getContext('2d'), resultCtx = result.getContext('2d'), ctx = source.getContext('2d');
        if (!originalCtx || !maskCtx || !resultCtx || !ctx) return;
        originalCtx.drawImage(source, 0, 0, workW, workH);
        const composite = (color: string, opacity: number, blur: number, x: number, y: number, spread: number, inner: boolean, blend: GlobalCompositeOperation = 'source-over') => {
            maskCtx.clearRect(0, 0, mask.width, mask.height);
            paintSpread(maskCtx, original, padding, padding, workW, workH, (inner ? -spread : spread) * sx);
            if (inner) {
                maskCtx.globalCompositeOperation = 'source-out'; maskCtx.fillStyle = '#ffffff'; maskCtx.fillRect(0, 0, mask.width, mask.height);
                maskCtx.globalCompositeOperation = 'source-over';
            }
            resultCtx.clearRect(0, 0, result.width, result.height);
            resultCtx.filter = `blur(${Math.max(0, blur * sx)}px)`; resultCtx.drawImage(mask, x * sx - padding, y * sy - padding); resultCtx.filter = 'none';
            resultCtx.globalCompositeOperation = 'source-in'; resultCtx.fillStyle = color; resultCtx.fillRect(0, 0, result.width, result.height);
            resultCtx.globalCompositeOperation = 'destination-in'; resultCtx.drawImage(original, 0, 0); resultCtx.globalCompositeOperation = 'source-over';
            ctx.save(); ctx.resetTransform(); ctx.globalCompositeOperation = blend === 'source-over' ? 'source-atop' : blend;
            for (let pass = 0; pass < Math.min(2, Math.ceil(opacity)); pass++) { ctx.globalAlpha = Math.max(0, Math.min(1, opacity - pass)); ctx.drawImage(result, 0, 0, source.width, source.height); }
            ctx.restore();
        };
        for (const s of shadows) if (s) composite(s.color, s.opacity, s.blur * 1920, s.offsetX * 1920, s.offsetY * 1080, s.spread ?? 0, true);
        if (glow) {
            const angle = (glow.angle ?? 106) * Math.PI / 180, depth = glow.depth ?? 0, sheen = glow.sheen ?? 1, rim = glow.rim ?? 1;
            const blur = glow.radius * 1920, offset = depth + blur * .15 * sheen;
            const blend = glow.blend === 'add' ? 'lighter' : 'source-over';
            if (glow.mode === 'fill') composite(glow.color, glow.intensity * (1 - rim * .5), blur * .25, 0, 0, 0, false, blend);
            composite(glow.color, glow.intensity * rim * (1 + sheen), blur, Math.cos(angle) * offset, Math.sin(angle) * offset, depth, true, blend);
        }
    } finally { releaseCanvas(original); releaseCanvas(mask); releaseCanvas(result); }
}

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

    if (typeof motionX === 'number') {
        mX = motionX;
        mY = motionY;
    } else {
        mX = motionX.motionX;
        mY = motionX.motionY;
        rZ = motionX.rotZ ?? 0;
        sX = motionX.scaleX ?? 0;
        sY = motionX.scaleY ?? 0;
        sampleCount = motionX.samples ?? 8;
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
    const shadow = effects.dropShadow?.enabled && effects.dropShadow.mode !== 'inner' ? effects.dropShadow : undefined;
    const padding = Math.ceil(Math.max(glowIntensity > 0 ? glowRadius * 3 + Math.abs(effects.glow?.depth ?? 0) : 0,
        effects.outline?.enabled && effects.outline.placement === 'outside' ? effects.outline.width + effects.outline.softness * 3 : 0,
        ...[effects.dropShadow, ...(effects.shadows ?? [])].map(s => s?.enabled && s.mode !== 'inner' ? s.blur * Math.max(width, height) * 3 + Math.abs(s.spread ?? 0) + (s.mode === 'long' ? s.length ?? 120 : 0) + Math.max(Math.abs(s.offsetX * width), Math.abs(s.offsetY * height)) : 0)));
    return { padding, width: width + padding * 2, height: height + padding * 2, glowIntensity, glowRadius, shadow };
}

export function drawLayerHalo(source: HTMLCanvasElement, effects: LayerEffects, intensityOffset: number, radiusOffset: number, maxTextureSize: number, authoredWidth = source.width, authoredHeight = source.height) {
    const sx = source.width / Math.max(1, authoredWidth), sy = source.height / Math.max(1, authoredHeight);
    const shadowPixels = (s: NonNullable<LayerEffects['dropShadow']>) => ({ ...s, length: (s.length ?? 120) * sx, blur: s.blur * 1920 * sx / Math.max(source.width, source.height), offsetX: s.offsetX * 1920 / authoredWidth, offsetY: s.offsetY * 1080 / authoredHeight, spread: (s.spread ?? 0) * sx });
    effects = { ...effects, dropShadow: effects.dropShadow && shadowPixels(effects.dropShadow), shadows: effects.shadows?.map(shadowPixels), outline: effects.outline && { ...effects.outline, width: effects.outline.width * sx, softness: effects.outline.softness * sx }, glow: effects.glow && { ...effects.glow, radius: effects.glow.radius * 1920 * sx / Math.max(source.width, source.height), depth: (effects.glow.depth ?? 0) * sx } };
    const layout = getLayerHaloLayout(effects, source.width, source.height, intensityOffset, radiusOffset);
    const shadows = [effects.dropShadow, ...(effects.shadows ?? [])].filter(s => s?.enabled && s.mode !== 'inner');
    const outline = effects.outline?.enabled && effects.outline.placement === 'outside' ? effects.outline : undefined;
    if (!shadows.length && layout.glowIntensity <= 0 && !outline) return null;
    const canvas = acquireCanvas(
        Math.max(1, Math.ceil(layout.width * Math.min(1, maxTextureSize / Math.max(layout.width, layout.height)))),
        Math.max(1, Math.ceil(layout.height * Math.min(1, maxTextureSize / Math.max(layout.width, layout.height))))
    );
    const ratio = Math.min(1, maxTextureSize / Math.max(layout.width, layout.height));
    canvas.width = Math.max(1, Math.ceil(layout.width * ratio));
    canvas.height = Math.max(1, Math.ceil(layout.height * ratio));
    const ctx = canvas.getContext('2d');
    if (!ctx) { releaseCanvas(canvas); return null; }
    const mask = acquireCanvas(canvas.width, canvas.height);
    const maskCtx = mask.getContext('2d');
    if (!maskCtx) { releaseCanvas(mask); releaseCanvas(canvas); return null; }
    const draw = (color: string, opacity: number, blur: number, x: number, y: number, spread = 0) => {
        ctx.save();
        maskCtx.clearRect(0, 0, mask.width, mask.height);
        paintSpread(maskCtx, source, layout.padding * ratio, layout.padding * ratio, source.width * ratio, source.height * ratio, spread * ratio);
        // Draw the silhouette off-canvas; only its displaced shadow enters the output.
        const displacement = canvas.width * 2;
        ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
        ctx.shadowColor = color;
        ctx.shadowBlur = blur * ratio;
        ctx.shadowOffsetX = displacement + x * ratio;
        ctx.shadowOffsetY = y * ratio;
        ctx.drawImage(mask, -displacement, 0);
        ctx.restore();
    };
    for (const s of shadows) if (s) {
        if (s.mode === 'long') drawLongShadow(ctx, source, { x: layout.padding * ratio, y: layout.padding * ratio, width: source.width * ratio, height: source.height * ratio, length: (s.length ?? 120) * ratio, angle: s.angle ?? 45, fade: s.fade ?? 0, color: s.color, opacity: s.opacity, blur: s.blur * Math.max(source.width, source.height) * ratio, spread: (s.spread ?? 0) * ratio, offsetX: s.offsetX * source.width * ratio, offsetY: s.offsetY * source.height * ratio });
        else draw(s.color, s.opacity, s.blur * Math.max(source.width, source.height), s.offsetX * source.width, s.offsetY * source.height, s.spread);
    }
    if (layout.glowIntensity > 0) {
        const glow = effects.glow;
        const angle = (glow?.angle ?? 0) * Math.PI / 180, depth = glow?.depth ?? 0;
        ctx.globalCompositeOperation = glow?.blend === 'add' ? 'lighter' : 'source-over';
        const radius = layout.glowRadius;
        for (let pass = 0; pass < Math.min(2, Math.ceil(layout.glowIntensity)); pass++) draw(glow?.color ?? '#0088ff', Math.min(1, layout.glowIntensity - pass) * (glow?.rim ?? 1), radius, Math.cos(angle) * depth, Math.sin(angle) * depth * sy / sx);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    if (outline) drawAlphaOutline(ctx, source, { x: layout.padding * ratio, y: layout.padding * ratio, width: source.width * ratio, height: source.height * ratio, radius: outline.width * ratio, softness: outline.softness * ratio, placement: 'outside', color: outline.color, opacity: outline.opacity });
    releaseCanvas(mask);
    return { canvas, widthScale: layout.width / source.width, heightScale: layout.height / source.height };
}

export function getLayerEffectUniforms(effects: LayerEffects, blend: BlendMode) {
    const glass = effects.liquidGlass?.enabled ? effects.liquidGlass : undefined;
    const screen = effects.screen?.enabled ? effects.screen : undefined;
    const profile = (key: 'layerBlur' | 'backdropBlur') => {
        const p = getBlurSettings(effects, key);
        return new THREE.Vector4(p.mode === 'progressive' ? p.start : (effects[key] ?? 0) * 100, p.mode === 'progressive' ? p.end : (effects[key] ?? 0) * 100, p.angle * Math.PI / 180, p.mode === 'progressive' ? 1 : 0);
    };
    const blurShape = (key: 'layerBlur' | 'backdropBlur') => {
        const p = getBlurSettings(effects, key);
        return new THREE.Vector4(p.type === 'radial' ? 1 : p.type === 'zoom' ? 2 : 0, p.centerX ?? .5, p.centerY ?? .5, p.quality ?? 16);
    };
    return {
        ...getLayerStyleUniforms(effects),
        layerScene: { value: null as THREE.Texture | null },
        layerResolution: { value: new THREE.Vector2(1, 1) },
        layerAuthorSize: { value: new THREE.Vector2(1920, 1080) },
        layerContentScale: { value: new THREE.Vector2(1, 1) },
        layerContentCenter: { value: new THREE.Vector2(.5, .5) },
        layerTime: { value: 0 },
        layerViewAngle: { value: 0 },
        layerPixelRatio: { value: 1 },
        layerBlurProfile: { value: profile('layerBlur') },
        layerBackdropProfile: { value: profile('backdropBlur') },
        layerBlurShape: { value: blurShape('layerBlur') },
        layerBackdropShape: { value: blurShape('backdropBlur') },
        layerBlend: { value: ['normal', 'darken', 'multiply', 'lighten', 'screen', 'add', 'difference'].indexOf(blend) },
        layerBackdrop: { value: Math.max(getBlurSettings(effects, 'backdropBlur').start, getBlurSettings(effects, 'backdropBlur').end) },
        layerGlass: { value: glass ? 1 : 0 },
        layerTint: { value: new THREE.Color(glass?.tint ?? '#ffffff') },
        layerGlassParams: { value: new THREE.Vector4(glass?.refraction ?? 0.6, glass?.ior ?? 1.52, glass?.bevelWidth ?? 24, glass?.dispersion ?? 0.35) },
        layerGlassLighting: { value: new THREE.Vector4(glass?.roughness ?? 0.05, glass?.shine ?? 0.7, glass?.fresnel ?? 0.5, ((glass?.lightAngle ?? 45) * Math.PI) / 180) },
        // Warp is authored in stage pixels by the inspector; shaders consume UV displacement.
        layerWarp: { value: new THREE.Vector2(effects.warp?.enabled && !effects.warp.mode ? (effects.warp.amount ?? 0) / 1920 : 0, effects.warp?.frequency ?? 3) },
        layerScreen: { value: new THREE.Vector4(screen ? ['lcd', 'oled', 'crt', 'led'].indexOf(screen.mode) + 1 : 0, screen?.pixelSize ?? 8, screen?.grid ?? 0.85, screen?.snapToPixels ? 1 : 0) },
        layerScreenCamera: { value: new THREE.Vector4(screen?.focus ?? 0, screen?.glow ?? 0, screen?.flicker ?? 0, screen?.speed ?? .5) },
        layerScreenPattern: { value: new THREE.Vector4(screen?.moire ?? 0, screen?.bands ?? 0, screen?.offAxis ?? 0, 0) },
    };
}

export type LayerEffectUniforms = ReturnType<typeof getLayerEffectUniforms>;

let fallbackRenderer: THREE.WebGLRenderer | null | undefined;
let cachedExportUniforms: LayerEffectUniforms | null = null;
let cachedExportMaterial: THREE.MeshBasicMaterial | null = null;

/** Reuse the production shader for canvas exports rather than maintaining a second set of effects. */
export function compositeLayerEffectSurface(source: HTMLCanvasElement, backdrop: HTMLCanvasElement, effects: LayerEffects, options: {
    opacity: number; time: number; centerX: number; centerY: number; width: number; height: number; viewAngle: number;
}): HTMLCanvasElement | null {
    if (typeof window === 'undefined') return null;
    if (fallbackRenderer === undefined) {
        try { fallbackRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true }); }
        catch { fallbackRenderer = null; }
    }
    const renderer = fallbackRenderer;
    if (!renderer || renderer.getContext().isContextLost()) return null;
    renderer.setSize(source.width, source.height, false);
    const texture = new THREE.CanvasTexture(source), behind = new THREE.CanvasTexture(backdrop);
    texture.colorSpace = THREE.SRGBColorSpace;
    const freshUniforms = getLayerEffectUniforms(effects, 'normal');
    if (!cachedExportUniforms) {
        cachedExportUniforms = freshUniforms;
    } else {
        for (const key of Object.keys(freshUniforms) as (keyof LayerEffectUniforms)[]) {
            Object.assign(cachedExportUniforms[key], { value: freshUniforms[key].value });
        }
    }
    const uniforms = cachedExportUniforms;
    uniforms.layerScene.value = behind;
    uniforms.layerAuthorSize.value.set(source.width, source.height);
    uniforms.layerResolution.value.set(source.width, source.height);
    uniforms.layerPixelRatio.value = source.width / 1920;
    uniforms.layerContentScale.value.set(1 / Math.max(.001, options.width), 1 / Math.max(.001, options.height));
    uniforms.layerContentCenter.value.set(options.centerX, 1 - options.centerY);
    uniforms.layerTime.value = options.time; uniforms.layerViewAngle.value = options.viewAngle;
    const blur = getBlurSettings(effects, 'backdropBlur');
    uniforms.layerBackdrop.value = Math.max(blur.start, blur.end);
    if (!cachedExportMaterial) {
        cachedExportMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: options.opacity, toneMapped: false, side: THREE.DoubleSide });
        cachedExportMaterial.onBeforeCompile = shader => installLayerEffects(shader, uniforms);
    }
    const material = cachedExportMaterial;
    material.map = texture;
    material.opacity = options.opacity;
    material.needsUpdate = true;
    const warp = effects.warp;
    const geometry = new THREE.PlaneGeometry(1920, 1080, warp?.enabled && warp.mode ? 64 : 1, warp?.enabled && warp.mode ? 48 : 1);
    if (warp?.enabled && warp.mode) updateWarpGeometry(geometry, 1920, 1080, 1920, 1080, { ...warp, centerX: (warp.centerX ?? 0) + (options.centerX - .5) * 1920, centerY: (warp.centerY ?? 0) + (options.centerY - .5) * 1080 }, options.time, { width: options.width * 1920, height: options.height * 1080, centerX: (options.centerX - .5) * 1920, centerY: (options.centerY - .5) * 1080 });
    const scene = new THREE.Scene(); scene.add(new THREE.Mesh(geometry, material));
    const camera = new THREE.OrthographicCamera(-960, 960, 540, -540, .1, 10000); camera.position.z = 5000;
    try { renderer.setClearColor(0, 0); renderer.render(scene, camera); return renderer.domElement; }
    finally {
        geometry.dispose();
        material.map = null;
        texture.dispose();
        behind.dispose();
        renderer.renderLists.dispose();
    }
}

/** Inject into both the unlit and lit materials, preserving their light/shadow calculations. */
export function installLayerEffects(shader: THREE.WebGLProgramParametersWithUniforms, uniforms: LayerEffectUniforms) {
    Object.assign(shader.uniforms, uniforms);
    const effectHeader = `
uniform sampler2D layerScene;
uniform vec2 layerResolution;
uniform vec2 layerAuthorSize, layerContentScale, layerContentCenter;
uniform float layerTime, layerViewAngle, layerPixelRatio;
uniform vec4 layerBlurProfile, layerBackdropProfile, layerScreen, layerScreenCamera, layerScreenPattern;
uniform vec4 layerBlurShape, layerBackdropShape;
uniform int layerBlend;
uniform float layerBackdrop, layerGlass;
uniform vec4 layerGlassParams, layerGlassLighting;
uniform vec3 layerTint;
uniform vec2 layerWarp;
float layerBlurRadius(vec4 profile, vec2 uv, vec4 shape) {
    if (shape.x > .5) {
        vec2 fromCenter = uv - shape.yz;
        float distanceFromCenter = shape.x < 1.5 ? length(fromCenter) * 2. : dot(fromCenter, vec2(cos(profile.z), -sin(profile.z))) + .5;
        if (shape.x > 1.5) distanceFromCenter = .5 + dot(fromCenter, vec2(cos(profile.z), -sin(profile.z)));
        float t = clamp(distanceFromCenter, 0., 1.);
        return mix(profile.y, mix(profile.x, profile.y, t), profile.w);
    }
    vec2 dir = vec2(cos(profile.z), -sin(profile.z));
    float t = clamp(.5 + dot(uv - .5, dir) / max(.0001, abs(dir.x) + abs(dir.y)), 0., 1.);
    return mix(profile.y, mix(profile.x, profile.y, t), profile.w);
}
#ifdef USE_MAP
vec2 layerBlurOffset(vec2 uv, float radius, vec4 shape, float index, float count, vec2 size) {
    float phase = (index + .5) / count;
    if (shape.x < .5) {
        float angle = index * 2.39996323;
        // Isotropic blur: normalise so kernel stays circular on non-square layers.
        float shortSide = min(size.x, size.y);
        vec2 aspect = vec2(shortSide / max(size.x, 1.), shortSide / max(size.y, 1.));
        return vec2(cos(angle), sin(angle)) * sqrt(phase) * radius * aspect / shortSide;
    }
    vec2 center = layerContentCenter + (shape.yz - .5) / max(layerContentScale, vec2(.0001));
    if (shape.x < 1.5) {
        float angle = index * 2.39996323;
        vec2 fromCenter = (uv - center) * size;
        float spin = (phase - .5) * min(radius / max(length(fromCenter), 1.), .35);
        float c = cos(spin), s = sin(spin);
        return (mat2(c, -s, s, c) * fromCenter - fromCenter) / size;
    }
    return (center - uv) * phase * min(1., radius * 2. / max(size.x, size.y));
}
vec4 layerSampleArtwork(vec2 uv, float radius, vec4 shape) {
    vec4 accum = vec4(0.); float totalW = 0.;
    float count = max(1., shape.w);
    float dither = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    for (int i = 0; i < 32; i++) {
        if (float(i) >= count) break;
        float phase = (float(i) + .5) / count;
        float rNorm = sqrt(phase);
        float w = exp(-2.5 * rNorm * rNorm);
        vec2 delta = layerBlurOffset(uv, radius, shape, float(i) + dither * .5, count, layerAuthorSize);
        vec2 p = uv + delta;
        vec4 sampleColor = texture2D(map, clamp(p, vec2(0.), vec2(1.)));
        sampleColor.a *= step(0., p.x) * step(p.x, 1.) * step(0., p.y) * step(p.y, 1.);
        accum += sampleColor * w;
        totalW += w;
    }
    return accum / max(totalW, .00001);
}
vec3 layerScreenLcd(vec3 color, vec2 f) {
    float subX = fract(f.x * 3.0);
    int subIdx = int(floor(f.x * 3.0));
    float hSlit = smoothstep(0.0, 0.12, subX) * smoothstep(1.0, 0.88, subX);
    float vSlit = smoothstep(0.0, 0.08, f.y) * smoothstep(1.0, 0.92, f.y);
    float mask = hSlit * vSlit;
    vec3 subColor;
    if (subIdx == 0) {
        subColor = vec3(color.r * 2.85, color.g * 0.1, color.b * 0.06);
    } else if (subIdx == 1) {
        subColor = vec3(color.r * 0.06, color.g * 2.85, color.b * 0.1);
    } else {
        subColor = vec3(color.r * 0.08, color.g * 0.1, color.b * 2.85);
    }
    return subColor * mask;
}
vec3 layerScreenOled(vec3 color, vec2 cellCoord, vec2 f) {
    vec2 stagger = vec2(fract(cellCoord.x + mod(floor(cellCoord.y), 2.0) * 0.5), f.y);
    float diamond = 1.0 - smoothstep(0.26, 0.46, abs(stagger.x - 0.5) + abs(stagger.y - 0.5));
    int oledPattern = int(mod(floor(cellCoord.x) + floor(cellCoord.y), 3.0));
    vec3 oledColor;
    if (oledPattern == 0) {
        oledColor = vec3(color.r * 2.8, color.g * 0.08, color.b * 0.05);
    } else if (oledPattern == 1) {
        oledColor = vec3(color.r * 0.05, color.g * 2.8, color.b * 0.08);
    } else {
        oledColor = vec3(color.r * 0.08, color.g * 0.08, color.b * 2.8);
    }
    return oledColor * diamond;
}
vec3 layerScreenCrt(vec3 color, vec2 f) {
    float subX = fract(f.x * 3.0);
    int subIdx = int(floor(f.x * 3.0));
    float hSlit = smoothstep(0.0, 0.14, subX) * smoothstep(1.0, 0.86, subX);
    float scanline = 0.35 + 0.65 * pow(sin(f.y * 3.14159265), 1.6);
    vec3 crtSub;
    if (subIdx == 0) {
        crtSub = vec3(color.r * 2.8, color.g * 0.08, color.b * 0.05);
    } else if (subIdx == 1) {
        crtSub = vec3(color.r * 0.05, color.g * 2.8, color.b * 0.08);
    } else {
        crtSub = vec3(color.r * 0.08, color.g * 0.08, color.b * 2.8);
    }
    return crtSub * hSlit * scanline;
}
vec3 layerScreenLed(vec3 color, vec2 f) {
    float dotDist = length(f - 0.5);
    float ledDot = 1.0 - smoothstep(0.33, 0.47, dotDist);
    return color * 2.3 * ledDot;
}
vec3 layerScreenPhosphor(vec3 color, vec2 cellCoord, vec2 f) {
    if (layerScreen.x < 1.5) return layerScreenLcd(color, f);
    if (layerScreen.x < 2.5) return layerScreenOled(color, cellCoord, f);
    if (layerScreen.x < 3.5) return layerScreenCrt(color, f);
    return layerScreenLed(color, f);
}
#endif
vec2 layerSceneBlurOffset(vec2 uv, float radius, vec4 shape, float index, float count) {
    float phase = (index + .5) / count;
    if (shape.x < .5) {
        float angle = index * 2.39996323;
        // Isotropic circular backdrop blur across any display aspect ratio
        float shortSide = min(layerResolution.x, layerResolution.y);
        vec2 aspect = vec2(shortSide / max(layerResolution.x, 1.), shortSide / max(layerResolution.y, 1.));
        return vec2(cos(angle), sin(angle)) * sqrt(phase) * radius * aspect / shortSide;
    }
    vec2 center = layerContentCenter + (shape.yz - .5) / max(layerContentScale, vec2(.0001));
    if (shape.x < 1.5) {
        vec2 fromCenter = (uv - center) * layerResolution;
        float spin = (phase - .5) * min(radius / max(length(fromCenter), 1.), .35);
        float c = cos(spin), s = sin(spin);
        return (mat2(c, -s, s, c) * fromCenter - fromCenter) / layerResolution;
    }
    return (center - uv) * phase * min(1., radius * 2. / max(layerResolution.x, layerResolution.y));
}
vec3 layerSampleScene(vec2 uv, float radius, vec4 shape) {
    if (radius <= .001) return texture2D(layerScene, uv).rgb;
    vec3 accum = vec3(0.); float totalW = 0.;
    float count = min(shape.w, 32.);
    float dither = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    for (int i = 0; i < 32; i++) {
        if (float(i) >= count) break;
        float phase = (float(i) + .5) / count;
        float rNorm = sqrt(phase);
        float w = exp(-2.5 * rNorm * rNorm);
        vec2 offset = layerSceneBlurOffset(uv, radius, shape, float(i) + dither * .5, count);
        accum += texture2D(layerScene, clamp(uv + offset, vec2(0.), vec2(1.))).rgb * w;
        totalW += w;
    }
    return accum / max(totalW, .00001);
}
${LAYER_STYLE_GLSL}
`;
    // Helpers must follow Three's map sampler declaration in GLSL.
    shader.fragmentShader = shader.fragmentShader.includes('#include <map_pars_fragment>')
        ? shader.fragmentShader.replace('#include <map_pars_fragment>', `#include <map_pars_fragment>\n${effectHeader}`)
        : effectHeader + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
#ifdef USE_MAP
    vec2 layerUv = vMapUv;
    layerUv.x += sin(layerUv.y * layerWarp.y * 6.2831853) * layerWarp.x * .1;
    layerUv.y += sin(layerUv.x * layerWarp.y * 6.2831853) * layerWarp.x * .1;
    vec2 localUv = (layerUv - layerContentCenter) * layerContentScale + .5;
    float radius = layerBlurRadius(layerBlurProfile, localUv, layerBlurShape);
    vec2 sampleUv = layerUv;
    if (layerScreen.x > .5 && layerScreen.w > .5) {
        vec2 cellCount = max(vec2(1.0), layerAuthorSize / max(.5, layerScreen.y));
        sampleUv = (floor(layerUv * cellCount) + .5) / cellCount;
    }
    sampleUv = layerStyleUv(sampleUv, localUv);
    vec4 artwork = radius > .01 ? layerSampleArtwork(sampleUv, radius, layerBlurShape) : texture2D(map, sampleUv);
    if (layerScreen.x > .5) {
        vec2 cellCount = max(vec2(1.0), layerAuthorSize / max(.5, layerScreen.y));
        vec2 cellCoord = layerUv * cellCount;
        vec2 f = fract(cellCoord);
        vec3 screenColor = layerScreenPhosphor(artwork.rgb, cellCoord, f);
        artwork.rgb = mix(artwork.rgb, screenColor, layerScreen.z);
        if (layerScreenPattern.x > 0.001) {
            float m = 0.5 + 0.5 * sin(cellCoord.x * 0.5 + cellCoord.y * 0.3);
            artwork.rgb *= 1.0 - layerScreenPattern.x * 0.15 * m;
        }
        if (layerScreenPattern.y > 0.001) {
            float bands = 0.5 + 0.5 * sin((localUv.y - layerTime * layerScreenCamera.w * 0.25) * 6.2831853 * 2.0);
            artwork.rgb *= 1.0 - layerScreenPattern.y * 0.2 * bands;
        }
        if (layerScreenCamera.x > 0.001) {
            vec3 defocus = layerSampleArtwork(sampleUv, layerScreenCamera.x * layerScreen.y * 0.5, vec4(0., .5, .5, 16.)).rgb;
            artwork.rgb = mix(artwork.rgb, defocus, layerScreenCamera.x * 0.5);
        }
        if (layerScreenCamera.y > 0.001) {
            vec3 bloom = layerSampleArtwork(sampleUv, layerScreen.y * 0.5, vec4(0., .5, .5, 16.)).rgb;
            artwork.rgb += bloom * layerScreenCamera.y * 0.25;
        }
        if (layerScreenCamera.z > 0.001) {
            float flick = 1.0 - layerScreenCamera.z * 0.15 * sin(layerTime * layerScreenCamera.w * 30.0);
            artwork.rgb *= flick;
        }
        if (layerScreenPattern.z > 0.001 && layerViewAngle > 0.01) {
            artwork.rgb *= 1.0 - layerScreenPattern.z * layerViewAngle * 0.3;
        }
    }
    artwork = layerApplyStyles(artwork, sampleUv, localUv);
    diffuseColor *= artwork;
#endif
`);
    // Capture and source use the same output space, including the render-target's color space.
    shader.fragmentShader = shader.fragmentShader.replace('#include <colorspace_fragment>', `#include <colorspace_fragment>
if (layerBlend != 0 || layerBackdrop > 0. || layerGlass > .5) {
    if (gl_FragColor.a <= .0001) discard;
    vec2 screenUv = gl_FragCoord.xy / layerResolution;
    vec2 localUv = gl_FragCoord.xy / layerResolution;
    #ifdef USE_MAP
    localUv = (vMapUv - layerContentCenter) * layerContentScale + .5;
    #endif
    float backdropRadius = layerBackdrop;
    #ifdef USE_MAP
    backdropRadius = layerBlurRadius(layerBackdropProfile, localUv, layerBackdropShape) * layerPixelRatio;
    #endif
    vec3 behind = vec3(0.);
    vec3 sourceColor = gl_FragColor.rgb;
    if (layerGlass > .5) {
        float ior = max(1.001, layerGlassParams.y);
        float bevel = max(1.0, layerGlassParams.z);
        vec2 clLocalUv = clamp(localUv, vec2(0.0), vec2(1.0));
        vec2 authorSize = max(vec2(1.0), layerAuthorSize);
        vec2 p = abs((clLocalUv - 0.5) * authorSize);
        vec2 halfSize = 0.5 * authorSize;
        vec2 dBox = max(vec2(0.0), halfSize - p);
        float cornerDist = bevel - length(max(vec2(0.0), vec2(bevel) - dBox));
        float distToEdge = (dBox.x < bevel && dBox.y < bevel) ? cornerDist : min(dBox.x, dBox.y);
        distToEdge = max(0.0, distToEdge);

        vec3 N = vec3(0.0, 0.0, 1.0);
        if (distToEdge < bevel) {
            float t = clamp(distToEdge / bevel, 0.0, 1.0);
            float theta = (1.0 - t) * 1.5707963;
            vec2 signDir = vec2(clLocalUv.x >= 0.5 ? 1.0 : -1.0, clLocalUv.y >= 0.5 ? 1.0 : -1.0);
            vec2 cornerDiff = max(vec2(0.0), vec2(bevel) - dBox);
            vec2 edgeDir;
            if (dBox.x < bevel && dBox.y < bevel) {
                edgeDir = normalize(max(vec2(0.0001), cornerDiff) * signDir);
            } else {
                edgeDir = dBox.x < dBox.y ? vec2(signDir.x, 0.0) : vec2(0.0, signDir.y);
            }
            N = normalize(vec3(edgeDir * sin(theta), cos(theta)));
        }

        // Snell's Law refraction
        vec3 I = vec3(0.0, 0.0, -1.0);
        vec3 T = refract(I, N, 1.0 / ior);
        if (length(T) < 0.001) T = reflect(I, N);

        float refractScale = layerGlassParams.x * 0.15;
        float frost = max(backdropRadius, layerGlassLighting.x * 80. * layerPixelRatio);
        float disp = layerGlassParams.w * 0.08;

        if (disp > 0.001 && distToEdge < bevel) {
            vec3 Tr = refract(I, N, 1.0 / max(1.001, ior - disp));
            vec3 Tb = refract(I, N, 1.0 / max(1.001, ior + disp));
            if (length(Tr) < 0.001) Tr = T;
            if (length(Tb) < 0.001) Tb = T;
            behind.r = layerSampleScene(screenUv + Tr.xy * refractScale, frost, layerBackdropShape).r;
            behind.g = layerSampleScene(screenUv + T.xy * refractScale, frost, layerBackdropShape).g;
            behind.b = layerSampleScene(screenUv + Tb.xy * refractScale, frost, layerBackdropShape).b;
        } else {
            behind = layerSampleScene(screenUv + T.xy * refractScale, frost, layerBackdropShape);
        }

        // Specular highlight along bevel
        float lightRad = layerGlassLighting.w;
        vec3 L = normalize(vec3(cos(lightRad), sin(lightRad), 0.75));
        vec3 V = vec3(0.0, 0.0, 1.0);
        vec3 H = normalize(L + V);
        float NdotH = max(0.0, dot(N, H));
        float shine = layerGlassLighting.y;
        float spec = pow(NdotH, 36.0) * shine;

        // Fresnel edge sheen
        float f0 = pow((1.0 - ior) / (1.0 + ior), 2.0);
        float cosTheta = max(0.0, dot(N, V));
        float fresnelFactor = (f0 + (1.0 - f0) * pow(1.0 - cosTheta, 4.0)) * layerGlassLighting.z;

        sourceColor = behind * layerTint + vec3(spec + fresnelFactor * 0.75);
    } else {
        behind = layerSampleScene(screenUv, backdropRadius, layerBackdropShape);
    }
    if (layerBlend == 1) sourceColor = min(sourceColor, behind);
    if (layerBlend == 2) sourceColor *= behind;
    if (layerBlend == 3) sourceColor = max(sourceColor, behind);
    if (layerBlend == 4) sourceColor = 1. - (1. - sourceColor) * (1. - behind);
    if (layerBlend == 5) sourceColor = min(vec3(1.), sourceColor + behind);
    if (layerBlend == 6) sourceColor = abs(behind - sourceColor);
    #ifdef USE_MAP
    float artworkAlpha = artwork.a;
    #else
    float artworkAlpha = 1.0;
    #endif
    if (layerBackdrop > 0. && layerGlass <= .5) {
        float blendAlpha = gl_FragColor.a >= 0.999 ? 0.6 : gl_FragColor.a;
        sourceColor = mix(behind, sourceColor, blendAlpha);
        gl_FragColor = vec4(sourceColor, artworkAlpha);
    } else {
        gl_FragColor = vec4(sourceColor, gl_FragColor.a);
    }
}
`);
}
