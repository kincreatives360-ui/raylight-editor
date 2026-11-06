import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { EvaluatedLayerWithEffects } from '../../engine/evaluateShot';
import type { ImageLayer, Layer, Project, ShapeLayer, TextLayer, VideoLayer } from '../../model/types';
import type { ScreenFit } from '../../model/commonTypes';
import { createCanvasFillStyle, getOrCreateVideoElement } from '../../engine/canvasRenderer';
import { drawStudioPlaceholder } from './threeLayerObjectHelpers';
import { configureLayerTexture } from './threeLayerTexture';
import { drawMediaFrame } from './mediaSurface';
import { applyTextureMask, drawMediaShimmer } from './mediaDecorations';
import { applyMotionBlur, applyLayerReveal, applyLayerSurfaceEffects, drawLayerHalo } from './layerEffects';
import { applyLayerAlphaEffects } from '../../engine/layerAlphaEffects';
import { releaseCanvas } from '../../engine/canvasPool';
import { usePlayheadStore } from '../../store/usePlayheadStore';

export interface UseLayerTextureParams {
    layer: Layer;
    evalLayer: EvaluatedLayerWithEffects;
    project: Project;
    surfaceVisible: boolean;
    screenFit?: ScreenFit;
    screenFill?: string;
    screenPan?: { x: number; y: number };
    screenZoom?: number;
    totalBlurPx: number;
    authoredW: number;
    authoredH: number;
    canvasW: number;
    canvasH: number;
    widthScale: number;
    heightScale: number;
    blurPadding: number;
    paddedCanvasW: number;
    paddedCanvasH: number;
    paddedTextureW: number;
    paddedTextureH: number;
    texturePixelRatio: number;
    shotStartMs: number;
    gl: THREE.WebGLRenderer;
    invalidate: () => void;
}

export function useLayerTexture({
    layer,
    evalLayer,
    project,
    surfaceVisible,
    screenFit = 'stretch',
    screenFill,
    screenPan,
    screenZoom,
    totalBlurPx,
    authoredW,
    authoredH,
    canvasW,
    canvasH,
    widthScale,
    heightScale,
    blurPadding,
    paddedCanvasW,
    paddedCanvasH,
    paddedTextureW,
    paddedTextureH,
    texturePixelRatio,
    shotStartMs,
    gl,
    invalidate,
}: UseLayerTextureParams) {
    const isVideoAsset = useMemo(() => {
        if (layer.kind === 'video') return true;
        if (layer.kind === 'image') {
            const asset = project.assets[(layer as ImageLayer).assetId];
            return asset?.mimeType?.startsWith('video/') ?? false;
        }
        return false;
    }, [layer, project.assets]);

    const animatedAlpha = Boolean(
        (layer.effects.roughen?.enabled && layer.effects.roughen.speed) ||
            (layer.effects.agentGlow?.enabled && layer.effects.agentGlow.speed)
    );
    const currentTimeMs = usePlayheadStore((s) => (isVideoAsset || animatedAlpha ? s.currentTimeMs : 0));
    const alphaTimeSeconds = animatedAlpha ? Math.max(0, currentTimeMs - shotStartMs) / 1000 : 0;

    const [loadedImageState, setLoadedImageState] = useState<{
        url: string;
        image: HTMLImageElement;
    } | null>(null);

    const assetUrl = useMemo(() => {
        if (layer.kind !== 'image' && layer.kind !== 'video') return null;
        const mediaL = layer as ImageLayer | VideoLayer;
        const asset = project.assets[mediaL.assetId];
        if (asset?.dataUrl) return asset.dataUrl;
        if (
            mediaL.assetId?.startsWith('data:') ||
            mediaL.assetId?.startsWith('http') ||
            mediaL.assetId?.startsWith('blob:')
        ) {
            return mediaL.assetId;
        }
        return null;
    }, [layer, project.assets]);

    const loadedImg = loadedImageState?.url === assetUrl ? loadedImageState.image : null;

    useEffect(() => {
        if (!assetUrl || isVideoAsset) return;
        let active = true;
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            if (active) setLoadedImageState({ url: assetUrl, image: img });
        };
        img.src = assetUrl;
        return () => {
            active = false;
        };
    }, [assetUrl, isVideoAsset]);

    const videoElement = useMemo(() => {
        if (!isVideoAsset || !assetUrl) return null;
        return getOrCreateVideoElement(assetUrl, layer.id);
    }, [isVideoAsset, assetUrl, layer.id]);

    useEffect(() => {
        if (!isVideoAsset || !assetUrl) return;
        const vid = getOrCreateVideoElement(assetUrl, layer.id);
        const shotLocalTimeMs = Math.max(0, currentTimeMs - shotStartMs);
        const targetSec = Math.max(0, (shotLocalTimeMs - layer.inMs) / 1000);
        if (Number.isFinite(targetSec)) {
            if (Math.abs(vid.currentTime - targetSec) > 0.04) {
                vid.currentTime = targetSec;
            }
        }
    }, [isVideoAsset, assetUrl, currentTimeMs, shotStartMs, layer.inMs, layer.id]);

    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const textureRef = useRef<THREE.CanvasTexture | null>(null);

    const texture = useMemo(() => {
        if (!surfaceVisible) return null;

        if (!canvasRef.current) {
            canvasRef.current = document.createElement('canvas');
        }
        const canvas = canvasRef.current;
        if (canvas.width !== paddedTextureW || canvas.height !== paddedTextureH) {
            canvas.width = paddedTextureW;
            canvas.height = paddedTextureH;
        }
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        // Start from a clean transform: a leftover scale/translate from the previous frame makes the artwork drift.
        ctx.resetTransform();
        ctx.clearRect(0, 0, paddedTextureW, paddedTextureH);
        ctx.scale(paddedTextureW / paddedCanvasW, paddedTextureH / paddedCanvasH);
        if (blurPadding > 0) {
            ctx.translate(blurPadding, blurPadding);
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        if (layer.kind === 'image' || layer.kind === 'video') {
            const imgL = layer as ImageLayer | VideoLayer;
            const options = {
                crop: imgL.crop,
                fit: screenFit,
                fillColor: screenFill,
                blurPx: totalBlurPx,
                pixelRatio: texturePixelRatio,
                pan: screenPan,
                zoom: screenZoom,
            };
            if (isVideoAsset && videoElement) {
                drawMediaFrame(
                    ctx,
                    videoElement,
                    videoElement.readyState >= 2 ? videoElement.videoWidth : 0,
                    videoElement.videoHeight,
                    canvasW,
                    canvasH,
                    options
                );
            } else if (loadedImg) {
                drawMediaFrame(
                    ctx,
                    loadedImg,
                    loadedImg.naturalWidth,
                    loadedImg.naturalHeight,
                    canvasW,
                    canvasH,
                    options
                );
            } else {
                drawStudioPlaceholder(ctx, canvasW, canvasH, imgL.name, totalBlurPx, texturePixelRatio);
            }
        } else if (layer.kind === 'text') {
            const textL = layer as TextLayer;
            ctx.clearRect(0, 0, canvasW, canvasH);

            ctx.save();
            if (totalBlurPx > 0) {
                ctx.filter = `blur(${Math.min(28, totalBlurPx * 1.5) * texturePixelRatio}px)`;
            }

            const relFontRatio =
                (textL.font.size || 0.04) / Math.max(0.04, evalLayer.size.height);
            const fontSize = Math.max(
                24,
                Math.min(canvasH * 0.78, Math.round(canvasH * relFontRatio))
            );

            ctx.fillStyle = textL.font.color || '#ffffff';
            ctx.font = `${textL.font.weight || 700} ${fontSize}px "${
                textL.font.family || 'Inter'
            }", -apple-system, sans-serif`;
            ctx.textAlign = textL.font.align || 'center';
            ctx.textBaseline = 'middle';

            const cx =
                textL.font.align === 'left'
                    ? 32
                    : textL.font.align === 'right'
                    ? canvasW - 32
                    : canvasW / 2;
            const cy = canvasH / 2;

            const rawContent = evalLayer.textContentOverride ?? (textL.content || 'Headline Title');
            const lines = rawContent.split('\n');
            const lineHeight = fontSize * (textL.font.lineHeight ?? 1.22);
            const startY =
                textL.verticalAlign === 'top'
                    ? fontSize / 2
                    : textL.verticalAlign === 'bottom'
                    ? canvasH - fontSize / 2 - (lines.length - 1) * lineHeight
                    : cy - ((lines.length - 1) * lineHeight) / 2;
            ctx.letterSpacing =
                ((textL.font.letterSpacing || 0) * fontSize) /
                    Math.max(0.01, textL.font.size * 1080) +
                'px';

            lines.forEach((line, idx) => {
                ctx.fillText(line, cx, startY + idx * lineHeight);
            });
            ctx.restore();
        } else if (layer.kind === 'shape') {
            const shapeL = layer as ShapeLayer;
            ctx.clearRect(0, 0, canvasW, canvasH);

            ctx.save();
            if (totalBlurPx > 0) {
                ctx.filter = `blur(${Math.min(28, totalBlurPx * 1.5) * texturePixelRatio}px)`;
            }

            if (shapeL.fill.kind === 'solid') {
                ctx.fillStyle = shapeL.fill.color || '#6366f1';
                ctx.globalAlpha = shapeL.fill.opacity ?? 1;
            } else {
                ctx.fillStyle = createCanvasFillStyle(ctx, shapeL.fill, canvasW, canvasH, 1);
            }

            const strokePx = shapeL.stroke?.width
                ? Math.max(2, shapeL.stroke.width * 1024)
                : 0;
            const pad = Math.max(8, strokePx);

            if (shapeL.shape === 'ellipse') {
                ctx.beginPath();
                ctx.ellipse(
                    canvasW / 2,
                    canvasH / 2,
                    canvasW / 2 - pad,
                    canvasH / 2 - pad,
                    0,
                    0,
                    Math.PI * 2
                );
                ctx.fill();
                if (shapeL.stroke && strokePx > 0) {
                    ctx.globalAlpha = shapeL.stroke.opacity ?? 1;
                    ctx.strokeStyle = shapeL.stroke.color;
                    ctx.lineWidth = strokePx;
                    ctx.stroke();
                }
            } else if (shapeL.shape === 'line' || shapeL.shape === 'arrow') {
                const shaftColor =
                    shapeL.stroke?.color ||
                    (shapeL.fill.kind === 'solid' ? shapeL.fill.color : '#a855f7');
                const shaftWidth = Math.max(6, canvasH * 0.18);
                ctx.strokeStyle = shaftColor;
                ctx.lineWidth = shaftWidth;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(pad, canvasH / 2);
                ctx.lineTo(canvasW - pad, canvasH / 2);
                ctx.stroke();
                if (shapeL.shape === 'arrow') {
                    const arrowSize = Math.max(shaftWidth * 2.2, strokePx * 3);
                    ctx.beginPath();
                    ctx.moveTo(canvasW - pad, canvasH / 2);
                    ctx.lineTo(canvasW - pad - arrowSize, canvasH / 2 - arrowSize * 0.65);
                    ctx.lineTo(canvasW - pad - arrowSize, canvasH / 2 + arrowSize * 0.65);
                    ctx.closePath();
                    ctx.fillStyle = shaftColor;
                    ctx.fill();
                }
            } else if (shapeL.shape === 'polygon') {
                const points = shapeL.points?.length
                    ? shapeL.points
                    : [
                          { x: 0.5, y: 0 },
                          { x: 1, y: 0.5 },
                          { x: 0.5, y: 1 },
                          { x: 0, y: 0.5 },
                      ];
                const inset = shapeL.stroke && strokePx > 0 ? strokePx / 2 : 0;
                const drawW = canvasW - inset * 2;
                const drawH = canvasH - inset * 2;
                ctx.beginPath();
                points.forEach((pt, i) => {
                    const x = inset + pt.x * drawW;
                    const y = inset + pt.y * drawH;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                });
                ctx.closePath();
                ctx.fill();
                if (shapeL.stroke && strokePx > 0) {
                    ctx.globalAlpha = shapeL.stroke.opacity ?? 1;
                    ctx.strokeStyle = shapeL.stroke.color;
                    ctx.lineWidth = strokePx;
                    ctx.stroke();
                }
            } else {
                const r = Math.round(
                    (shapeL.cornerRadius ?? 0.04) * Math.min(canvasW, canvasH) * 0.5
                );
                ctx.beginPath();
                ctx.roundRect(pad, pad, canvasW - pad * 2, canvasH - pad * 2, r);
                ctx.fill();
                if (shapeL.stroke && strokePx > 0) {
                    ctx.globalAlpha = shapeL.stroke.opacity ?? 1;
                    ctx.strokeStyle = shapeL.stroke.color;
                    ctx.lineWidth = strokePx;
                    ctx.stroke();
                }
            }
            ctx.restore();
        }

        drawMediaShimmer(ctx, canvasW, canvasH, evalLayer.shimmerProgress, evalLayer.shimmerSettings);
        if (evalLayer.motionBlur) {
            applyMotionBlur(canvas, {
                motionX: evalLayer.motionBlur.x * canvasW * texturePixelRatio,
                motionY: evalLayer.motionBlur.y * canvasH * texturePixelRatio,
                motionZ: evalLayer.motionBlur.z,
                rotZ: evalLayer.motionBlur.rotZ,
                scaleX: evalLayer.motionBlur.scaleX,
                scaleY: evalLayer.motionBlur.scaleY,
                samples: evalLayer.motionBlur.samples,
            });
        }

        ctx.resetTransform();
        ctx.scale(paddedTextureW / paddedCanvasW, paddedTextureH / paddedCanvasH);
        if (blurPadding > 0) ctx.translate(blurPadding, blurPadding);

        applyTextureMask(ctx, canvasW, canvasH, layer, project);
        applyLayerReveal(ctx, canvasW, canvasH, evalLayer.maskSweepProgress, evalLayer.pathRevealProgress);
        applyLayerAlphaEffects(canvas, layer.effects, authoredW * widthScale, authoredH * heightScale, alphaTimeSeconds);
        applyLayerSurfaceEffects(canvas, layer.effects, authoredW * widthScale, authoredH * heightScale, alphaTimeSeconds);

        if (!textureRef.current) {
            const tex = new THREE.CanvasTexture(canvas);
            const maxAniso = gl.capabilities?.getMaxAnisotropy?.() ?? 16;
            configureLayerTexture(tex, maxAniso);
            textureRef.current = tex;
        } else {
            textureRef.current.needsUpdate = true;
        }
        return textureRef.current;
    }, [
        layer,
        authoredW,
        authoredH,
        widthScale,
        heightScale,
        alphaTimeSeconds,
        project,
        loadedImg,
        isVideoAsset,
        videoElement,
        totalBlurPx,
        canvasW,
        canvasH,
        texturePixelRatio,
        blurPadding,
        paddedCanvasW,
        paddedCanvasH,
        paddedTextureW,
        paddedTextureH,
        gl,
        evalLayer.shimmerProgress,
        evalLayer.shimmerSettings,
        evalLayer.textContentOverride,
        evalLayer.maskSweepProgress,
        evalLayer.pathRevealProgress,
        evalLayer.motionBlur,
        evalLayer.size.height,
        screenFit,
        screenFill,
        screenPan,
        screenZoom,
        surfaceVisible,
    ]);

    const halo = useMemo(() => {
        if (!texture) return null;
        const result = drawLayerHalo(
            texture.image as HTMLCanvasElement,
            layer.effects,
            evalLayer.glowIntensityOffset,
            evalLayer.glowRadiusOffset,
            gl.capabilities.maxTextureSize,
            authoredW * widthScale,
            authoredH * heightScale,
            alphaTimeSeconds
        );
        if (!result) return null;
        const haloTexture = new THREE.CanvasTexture(result.canvas);
        configureLayerTexture(haloTexture, gl.capabilities.getMaxAnisotropy());
        return { ...result, texture: haloTexture };
    }, [
        texture,
        layer.effects,
        evalLayer.glowIntensityOffset,
        evalLayer.glowRadiusOffset,
        gl,
        authoredW,
        authoredH,
        widthScale,
        heightScale,
        alphaTimeSeconds,
    ]);

    useEffect(() => {
        return () => {
            halo?.texture.dispose();
            if (halo?.canvas) releaseCanvas(halo.canvas);
        };
    }, [halo]);

    useEffect(() => {
        return () => {
            if (textureRef.current) {
                textureRef.current.dispose();
                textureRef.current = null;
            }
            canvasRef.current = null;
        };
    }, []);

    // Video events sync
    useEffect(() => {
        if (!isVideoAsset || !videoElement || !texture) return;
        const canvas = texture.image as HTMLCanvasElement;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const redraw = () => {
            if (videoElement.readyState < 2) return;
            const media = layer as ImageLayer | VideoLayer;
            const options = {
                crop: media.crop,
                fit: screenFit,
                fillColor: screenFill,
                blurPx: totalBlurPx,
                pixelRatio: texturePixelRatio,
                pan: screenPan,
                zoom: screenZoom,
            };
            ctx.resetTransform();
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.scale(paddedTextureW / paddedCanvasW, paddedTextureH / paddedCanvasH);
            if (blurPadding > 0) ctx.translate(blurPadding, blurPadding);
            drawMediaFrame(
                ctx,
                videoElement,
                videoElement.videoWidth,
                videoElement.videoHeight,
                canvasW,
                canvasH,
                options
            );
            drawMediaShimmer(ctx, canvasW, canvasH, evalLayer.shimmerProgress, evalLayer.shimmerSettings);
            if (evalLayer.motionBlur) {
                applyMotionBlur(canvas, {
                    motionX: evalLayer.motionBlur.x * canvasW * texturePixelRatio,
                    motionY: evalLayer.motionBlur.y * canvasH * texturePixelRatio,
                    motionZ: evalLayer.motionBlur.z,
                    rotZ: evalLayer.motionBlur.rotZ,
                    scaleX: evalLayer.motionBlur.scaleX,
                    scaleY: evalLayer.motionBlur.scaleY,
                    samples: evalLayer.motionBlur.samples,
                });
            }
            ctx.resetTransform();
            ctx.scale(paddedTextureW / paddedCanvasW, paddedTextureH / paddedCanvasH);
            if (blurPadding > 0) ctx.translate(blurPadding, blurPadding);
            applyTextureMask(ctx, canvasW, canvasH, layer, project);
            applyLayerReveal(ctx, canvasW, canvasH, evalLayer.maskSweepProgress, evalLayer.pathRevealProgress);
            applyLayerAlphaEffects(canvas, layer.effects, authoredW * widthScale, authoredH * heightScale, alphaTimeSeconds);
            applyLayerSurfaceEffects(canvas, layer.effects, authoredW * widthScale, authoredH * heightScale, alphaTimeSeconds);
            if (halo) {
                const updated = drawLayerHalo(
                    canvas,
                    layer.effects,
                    evalLayer.glowIntensityOffset,
                    evalLayer.glowRadiusOffset,
                    gl.capabilities.maxTextureSize,
                    authoredW * widthScale,
                    authoredH * heightScale,
                    alphaTimeSeconds
                );
                const haloCtx = halo.canvas.getContext('2d');
                if (updated && haloCtx) {
                    haloCtx.clearRect(0, 0, halo.canvas.width, halo.canvas.height);
                    haloCtx.drawImage(updated.canvas, 0, 0);
                    halo.texture.needsUpdate = true;
                }
                if (updated) releaseCanvas(updated.canvas);
            }
            texture.needsUpdate = true;
            invalidate();
        };
        redraw();
        const events = ['loadeddata', 'seeked', 'timeupdate'] as const;
        for (const event of events) videoElement.addEventListener(event, redraw);
        return () => {
            for (const event of events) videoElement.removeEventListener(event, redraw);
        };
    }, [
        currentTimeMs,
        authoredW,
        authoredH,
        widthScale,
        heightScale,
        alphaTimeSeconds,
        isVideoAsset,
        videoElement,
        texture,
        layer,
        project,
        totalBlurPx,
        screenFit,
        screenFill,
        screenPan,
        screenZoom,
        evalLayer.shimmerProgress,
        evalLayer.shimmerSettings,
        evalLayer.maskSweepProgress,
        evalLayer.pathRevealProgress,
        evalLayer.motionBlur,
        evalLayer.glowIntensityOffset,
        evalLayer.glowRadiusOffset,
        halo,
        gl,
        invalidate,
        canvasW,
        canvasH,
        texturePixelRatio,
        blurPadding,
        paddedCanvasW,
        paddedCanvasH,
        paddedTextureW,
        paddedTextureH,
    ]);

    return {
        texture,
        halo,
        isVideoAsset,
        videoElement,
    };
}
