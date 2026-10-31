import React, { useMemo, useState, useEffect, useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { createNormalizedRoundedGeometry, drawStudioPlaceholder, getLayerBlurBleedLayout } from './threeLayerObjectHelpers';
import { configureLayerTexture } from './threeLayerTexture';
// eslint-disable-next-line react-refresh/only-export-components
export { getLayerBlurBleedLayout } from './threeLayerObjectHelpers';
// eslint-disable-next-line react-refresh/only-export-components
export { configureLayerTexture } from './threeLayerTexture';
import { useThree, useFrame } from '@react-three/fiber';
import { DeviceOpacityGroup } from './DeviceOpacityGroup';
import { drawMediaFrame, getMediaTextureSize, getLayerSurfaceState } from './mediaSurface';
import { applyTextureMask, drawMediaShimmer } from './mediaDecorations';
import type { EvaluatedLayerWithEffects } from '../../engine/evaluateShot';
import type { EvaluatedCamera } from '../../engine/evaluateCamera';
import type {
    Project,
    TextLayer,
    ShapeLayer,
    ImageLayer,
    VideoLayer,
} from '../../model/types';
import { evaluateCameraPose, getLayerProjectedCorners, getLayerRenderLayout } from './cameraMath';
import { getOrCreateVideoElement, createCanvasFillStyle } from '../../engine/canvasRenderer';
import { usePlayheadStore } from '../../store/usePlayheadStore';
import { SCREEN_PLANE_Z, getDeviceSpec } from '../../model/deviceFrame';
import { PhoneDeviceFrame } from './PhoneDeviceFrame';
import { MacBookProFrame } from './MacBookProFrame';
import { applyBokehBlur, applyMotionBlur, applyLayerReveal, applyLayerSurfaceEffects, createWarpGeometry, updateWarpGeometry, drawLayerHalo, getLayerEffectUniforms, installLayerEffects } from './layerEffects';
import { applyLayerAlphaEffects } from '../../engine/layerAlphaEffects';
import { getBlurSettings } from '../../model/layerEffects';
import { releaseCanvas } from '../../engine/canvasPool';

interface ThreeLayerObjectProps {
    evalLayer: EvaluatedLayerWithEffects;
    project: Project;
    evaluatedCamera: EvaluatedCamera;
    onSelect: (layerId: string, multiSelect?: boolean) => void;
    shotStartMs?: number;
}

export const ThreeLayerObject: React.FC<ThreeLayerObjectProps> = ({
    evalLayer,
    project,
    evaluatedCamera,
    onSelect,
    shotStartMs = 0,
}) => {
    const { layer } = evalLayer;
    const { invalidate, gl, size } = useThree();
    const dpr = useThree(state => state.viewport.dpr);

    const aspect =
        project.aspectRatio === '16:9'
            ? 16 / 9
            : project.aspectRatio === '4:3'
                ? 4 / 3
                : project.aspectRatio === '3:2'
                    ? 3 / 2
                    : project.aspectRatio === '21:9'
                        ? 21 / 9
                        : project.aspectRatio === '1:1'
                            ? 1
                            : project.aspectRatio === '9:16'
                                ? 9 / 16
                                : project.aspectRatio === '3:4'
                                    ? 3 / 4
                                    : project.aspectRatio === '2:3'
                                        ? 2 / 3
                                        : 4 / 5;

    const cameraZ = project.defaultCamera?.position?.z ?? 2.65;
    const focalLength = project.defaultCamera?.focalLength ?? 50;

    const { worldX, worldY, worldZ, meshW, meshH, deviceSettings: deviceFrameSettings, frameMetrics: deviceFrameMetrics, scale } = useMemo(() => getLayerRenderLayout(
        evalLayer,
        aspect,
        cameraZ,
        focalLength
    ), [evalLayer, aspect, cameraZ, focalLength]);

    const screenFit = deviceFrameSettings?.screenFit ?? 'stretch';
    const screenFill = deviceFrameSettings?.screenFillColor;
    const screenPan = deviceFrameSettings?.screenPan;
    const screenZoom = deviceFrameSettings?.screenZoom;
    const rot = evalLayer.rotation;
    const opacity = evalLayer.opacity ?? 1;
    // Authored layer blur is sampled by the material; retain animation blur here.
    const totalBlurPx = Math.max(0, Math.round(((evalLayer.totalBlurPx ?? 0) - (evalLayer.dofBlurPx ?? 0) - (layer.effects.layerBlur ?? 0) * 100) * 2) / 2);
    const authoredW = Math.max(1, evalLayer.size.width * 1920), authoredH = Math.max(1, evalLayer.size.height * 1080);
    const dofBlurPx = evalLayer.dofBlurPx ?? 0;
    const surface = getLayerSurfaceState(layer, Boolean(deviceFrameSettings), opacity, evalLayer.visible);
    const cameraPose = evaluateCameraPose(evaluatedCamera, {
        position: project.defaultCamera?.position ?? { x: 0, y: 0, z: cameraZ },
        rotation: project.defaultCamera?.rotation ?? { x: 0, y: 0, z: 0 },
        focalLength,
    }, aspect);
    const corners = getLayerProjectedCorners(evalLayer, size.width * dpr, size.height * dpr,
        aspect, cameraPose, cameraZ, focalLength, 'screen');
    const edgeLength = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
    const { width: canvasW, height: canvasH } = getMediaTextureSize(meshW, meshH);

    const { blurPadding, paddedCanvasW, paddedCanvasH, widthScale, heightScale } = getLayerBlurBleedLayout(
        canvasW,
        canvasH,
        totalBlurPx + Math.max(getBlurSettings(layer.effects, 'layerBlur').start, getBlurSettings(layer.effects, 'layerBlur').end) * canvasW / authoredW,
        dofBlurPx,
        evalLayer.motionBlur,
        Boolean(deviceFrameSettings),
        layer.effects.rgbSplit?.enabled ? layer.effects.rgbSplit.amount * Math.max(Math.abs(layer.effects.rgbSplit.red), Math.abs(layer.effects.rgbSplit.green), Math.abs(layer.effects.rgbSplit.blue)) + 2 : 0
    );

    const maxTexSize = gl.capabilities.maxTextureSize || 4096;
    const { width: targetPaddedTextureW, height: targetPaddedTextureH } = getMediaTextureSize(
        meshW * widthScale,
        meshH * heightScale,
        {
            pixelWidth: Math.max(edgeLength(corners.pNW, corners.pNE), edgeLength(corners.pSW, corners.pSE)) * widthScale,
            pixelHeight: Math.max(edgeLength(corners.pNW, corners.pSW), edgeLength(corners.pNE, corners.pSE)) * heightScale,
            maxTextureSize: maxTexSize,
        }
    );
    const paddedTextureW = Math.min(maxTexSize, Math.max(1, Math.round(targetPaddedTextureW)));
    const paddedTextureH = Math.min(maxTexSize, Math.max(1, Math.round(targetPaddedTextureH)));
    const texturePixelRatio = paddedTextureW / paddedCanvasW;
    const effectUniforms = useMemo(() => getLayerEffectUniforms(layer.effects, layer.blendMode), [layer.effects, layer.blendMode]);
    const effectUniformsRef = useRef(effectUniforms);
    useLayoutEffect(() => {
        effectUniformsRef.current = effectUniforms;
    }, [effectUniforms]);
    const sceneCopy = useRef<THREE.FramebufferTexture | null>(null);
    const surfaceMesh = useRef<THREE.Mesh>(null);
    const viewVectors = useMemo(() => ({ normal: new THREE.Vector3(), direction: new THREE.Vector3() }), []);
    useEffect(() => () => { sceneCopy.current?.dispose(); }, []);
    const captureBackdrop = (renderer: THREE.WebGLRenderer, _scene: THREE.Scene, camera: THREE.Camera) => {
        const uniforms = effectUniformsRef.current;
        uniforms.layerTime.value = Math.max(0, usePlayheadStore.getState().currentTimeMs - shotStartMs) / 1000;
        if (surfaceMesh.current && uniforms.layerScreen.value.x > 0) {
            viewVectors.normal.set(0, 0, 1).transformDirection(surfaceMesh.current.matrixWorld);
            camera.getWorldDirection(viewVectors.direction);
            uniforms.layerViewAngle.value = 1 - Math.abs(viewVectors.normal.dot(viewVectors.direction));
        }
        uniforms.layerAuthorSize.value.set(authoredW * widthScale, authoredH * heightScale);
        uniforms.layerContentScale.value.set(widthScale, heightScale);
        const profile = getBlurSettings(layer.effects, 'backdropBlur');
        uniforms.layerBackdrop.value = Math.max(profile.start, profile.end);
        if (!uniforms.layerBlend.value && !uniforms.layerBackdrop.value && !uniforms.layerGlass.value) return;
        const target = renderer.getRenderTarget();
        const dimensions = target ? new THREE.Vector2(target.width, target.height) : renderer.getDrawingBufferSize(new THREE.Vector2());
        if (!sceneCopy.current || sceneCopy.current.image.width !== dimensions.x || sceneCopy.current.image.height !== dimensions.y) {
            sceneCopy.current?.dispose();
            sceneCopy.current = new THREE.FramebufferTexture(dimensions.x, dimensions.y);
            sceneCopy.current.type = target?.texture.type ?? THREE.UnsignedByteType;
            sceneCopy.current.minFilter = THREE.LinearFilter;
            sceneCopy.current.magFilter = THREE.LinearFilter;
        }
        renderer.copyFramebufferToTexture(sceneCopy.current);
        uniforms.layerScene.value = sceneCopy.current;
        uniforms.layerResolution.value.copy(dimensions);
        uniforms.layerPixelRatio.value = dimensions.x / 1920;
    };
    const compileEffects = (shader: THREE.WebGLProgramParametersWithUniforms) => installLayerEffects(shader, effectUniformsRef.current);

    const isVideoAsset = useMemo(() => {
        if (layer.kind === 'video') return true;
        if (layer.kind === 'image') {
            const asset = project.assets[(layer as ImageLayer).assetId];
            return asset?.mimeType?.startsWith('video/') ?? false;
        }
        return false;
    }, [layer, project.assets]);

    const animatedAlpha = Boolean(layer.effects.roughen?.enabled && layer.effects.roughen.speed);
    // Only animated alpha masks and video need CPU texture updates during playback.
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

    // Keep video currentTime synchronized with shot-local timeline playhead
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

    // Generate proportional CanvasTexture with Crop, Stroke, Shimmer & DoF Blur
    const texture = useMemo(() => {
        if (!surface.visible) return null;

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
        ctx.clearRect(0, 0, paddedTextureW, paddedTextureH);
        // Keep authored layout, padding and strokes in their original coordinate space.
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
                drawMediaFrame(ctx, videoElement, videoElement.readyState >= 2 ? videoElement.videoWidth : 0, videoElement.videoHeight, canvasW, canvasH, options);
            } else if (loadedImg) {
                drawMediaFrame(ctx, loadedImg, loadedImg.naturalWidth, loadedImg.naturalHeight, canvasW, canvasH, options);
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
            ctx.font = `${textL.font.weight || 700} ${fontSize}px "${textL.font.family || 'Inter'
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
            const startY = textL.verticalAlign === 'top' ? fontSize / 2 : textL.verticalAlign === 'bottom' ? canvasH - fontSize / 2 - (lines.length - 1) * lineHeight : cy - ((lines.length - 1) * lineHeight) / 2;
            ctx.letterSpacing = ((textL.font.letterSpacing || 0) * fontSize / Math.max(.01, textL.font.size * 1080)) + 'px';

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
        applyBokehBlur(canvas, dofBlurPx * texturePixelRatio * 1.5, evalLayer.dofBokehShape);
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
        applyLayerSurfaceEffects(canvas, layer.effects, authoredW * widthScale, authoredH * heightScale);

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
        authoredW, authoredH, widthScale, heightScale, alphaTimeSeconds,
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
        dofBlurPx,
        evalLayer.dofBokehShape,
        evalLayer.motionBlur,
        evalLayer.size.height,
        screenFit,
        screenFill,
        screenPan,
        screenZoom,
        surface.visible,
    ]);

    const halo = useMemo(() => {
        if (!texture) return null;
        const result = drawLayerHalo(texture.image as HTMLCanvasElement, layer.effects, evalLayer.glowIntensityOffset, evalLayer.glowRadiusOffset, gl.capabilities.maxTextureSize, authoredW * widthScale, authoredH * heightScale);
        if (!result) return null;
        const haloTexture = new THREE.CanvasTexture(result.canvas);
        configureLayerTexture(haloTexture, gl.capabilities.getMaxAnisotropy());
        return { ...result, texture: haloTexture };
    // CanvasTexture identity stays stable while timed alpha edits change its pixels.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [texture, layer.effects, evalLayer.glowIntensityOffset, evalLayer.glowRadiusOffset, gl, authoredW, authoredH, widthScale, heightScale, alphaTimeSeconds]);
    useEffect(() => () => {
        halo?.texture.dispose();
        if (halo?.canvas) releaseCanvas(halo.canvas);
    }, [halo]);

    // Dispose persistent texture only when layer unmounts
    useEffect(() => {
        return () => {
            if (textureRef.current) {
                textureRef.current.dispose();
                textureRef.current = null;
            }
            canvasRef.current = null;
        };
    }, []);

    // Seek completion and decoded-frame events use exactly the same mapping as static media.
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
            applyBokehBlur(canvas, dofBlurPx * texturePixelRatio * 1.5, evalLayer.dofBokehShape);
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
            applyLayerSurfaceEffects(canvas, layer.effects, authoredW * widthScale, authoredH * heightScale);
            if (halo) {
                const updated = drawLayerHalo(canvas, layer.effects, evalLayer.glowIntensityOffset, evalLayer.glowRadiusOffset, gl.capabilities.maxTextureSize, authoredW * widthScale, authoredH * heightScale);
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
        return () => { for (const event of events) videoElement.removeEventListener(event, redraw); };
    }, [
        currentTimeMs,
        authoredW, authoredH, widthScale, heightScale, alphaTimeSeconds,
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
        dofBlurPx,
        evalLayer.dofBokehShape,
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

    const cornerRadiusWorld = useMemo(() => {
        if (deviceFrameMetrics) return deviceFrameMetrics.cornerRadius;
        if (layer.kind !== 'text') {
            return (layer.cornerRadius ?? 0.03) * Math.min(meshW, meshH) * 0.5;
        }
        return 0.005;
    }, [layer, meshW, meshH, deviceFrameMetrics]);

    // Rounded geometry is used for ordinary image and video layer corners.
    const normalizedScreenGeometry = useMemo(
        () => createNormalizedRoundedGeometry(meshW, meshH, cornerRadiusWorld),
        [meshW, meshH, cornerRadiusWorld]
    );
    const warp = layer.effects.warp;
    const warpedGeometry = useMemo(() => warp?.enabled && warp.mode ? createWarpGeometry(meshW * widthScale, meshH * heightScale, authoredW * widthScale, authoredH * heightScale, warp) : null,
        [warp, meshW, meshH, widthScale, heightScale, authoredW, authoredH]);
    const warpedHaloGeometry = useMemo(() => warp?.enabled && warp.mode && halo ? createWarpGeometry(meshW * widthScale * halo.widthScale, meshH * heightScale * halo.heightScale, authoredW * widthScale * halo.widthScale, authoredH * heightScale * halo.heightScale, warp, { width: authoredW * widthScale, height: authoredH * heightScale }) : null,
        [warp, halo, meshW, meshH, widthScale, heightScale, authoredW, authoredH]);
    const turbulenceFrame = useRef<{ time: number; geometry: THREE.PlaneGeometry; haloGeometry?: THREE.PlaneGeometry | null } | null>(null);
    useFrame(() => {
        if (!warp?.enabled || warp.mode !== 'turbulent' || !warpedGeometry) return;
        const time = Math.max(0, usePlayheadStore.getState().currentTimeMs - shotStartMs) / 1000;
        if (turbulenceFrame.current?.time === time && turbulenceFrame.current.geometry === warpedGeometry && turbulenceFrame.current.haloGeometry === warpedHaloGeometry) return;
        updateWarpGeometry(warpedGeometry, meshW * widthScale, meshH * heightScale, authoredW * widthScale, authoredH * heightScale, warp, time);
        if (warpedHaloGeometry && halo) updateWarpGeometry(warpedHaloGeometry, meshW * widthScale * halo.widthScale, meshH * heightScale * halo.heightScale, authoredW * widthScale * halo.widthScale, authoredH * heightScale * halo.heightScale, warp, time, { width: authoredW * widthScale, height: authoredH * heightScale });
        turbulenceFrame.current = { time, geometry: warpedGeometry, haloGeometry: warpedHaloGeometry };
    });
    useEffect(() => () => { warpedGeometry?.dispose(); warpedHaloGeometry?.dispose(); }, [warpedGeometry, warpedHaloGeometry]);

    useEffect(() => {
        return () => {
            normalizedScreenGeometry?.dispose();
        };
    }, [normalizedScreenGeometry]);

    if (!surface.visible) return null;
    const renderOpacity = surface.surfaceOpacity;
    const receivesLight = surface.receivesLight;

    const surfaceRoughness = layer.material?.roughness ?? 0.24;
    const surfaceMetalness = layer.material?.metalness ?? 0.06;

    const haloZ = deviceFrameMetrics ? SCREEN_PLANE_Z - deviceFrameMetrics.bodyDepth * 1.1 - 0.001 : SCREEN_PLANE_Z - 0.001;

    const contents = <>
            {halo && <mesh geometry={warpedHaloGeometry ?? undefined} position={[0, 0, haloZ]} renderOrder={layer.order * 2}>
                {!warpedHaloGeometry && <planeGeometry args={[meshW * widthScale * halo.widthScale, meshH * heightScale * halo.heightScale]} />}
                <meshBasicMaterial map={halo.texture} transparent opacity={renderOpacity} toneMapped={false} depthWrite={false} side={THREE.DoubleSide} />
            </mesh>}
            <mesh
                ref={surfaceMesh}
                onBeforeRender={captureBackdrop}
                renderOrder={layer.order * 2 + 1}
                // One shared screen plane: the artwork sits at SCREEN_PLANE_Z
                // with or without a frame, so toggling the frame never shifts
                // it. PhoneDeviceFrame stages the rim just in front of this
                // plane and the solid backer just behind, so the bezel
                // occludes the screen edge at every tilt instead of the
                // artwork floating over the chassis.
                position={[0, 0, SCREEN_PLANE_Z]}
                geometry={warpedGeometry ?? ((blurPadding <= 0 && (layer.kind === 'image' || layer.kind === 'video') && !deviceFrameSettings) ? normalizedScreenGeometry ?? undefined : undefined)}
                castShadow={receivesLight && (layer.kind === 'image' || layer.kind === 'video')}
                receiveShadow={receivesLight}
            >
                {!warpedGeometry && (blurPadding > 0 || (layer.kind !== 'image' && layer.kind !== 'video') || Boolean(deviceFrameSettings)) && (
                    <planeGeometry args={[meshW * widthScale, meshH * heightScale]} />
                )}
                {receivesLight ? (
                    <meshStandardMaterial key={layer.id + JSON.stringify(layer.effects) + layer.blendMode} onBeforeCompile={compileEffects} customProgramCacheKey={() => `layer-effects-${layer.id}`} map={texture || undefined} color="#ffffff" transparent opacity={renderOpacity} roughness={surfaceRoughness} metalness={surfaceMetalness} side={deviceFrameSettings ? THREE.FrontSide : THREE.DoubleSide} depthWrite={renderOpacity > 0.99 && (layer.kind === 'image' || layer.kind === 'video')} depthTest />
                ) : (
                    <meshBasicMaterial key={layer.id + JSON.stringify(layer.effects) + layer.blendMode} onBeforeCompile={compileEffects} customProgramCacheKey={() => `layer-effects-${layer.id}`} map={texture} color="#ffffff" transparent={!deviceFrameSettings} toneMapped={false} opacity={renderOpacity} side={deviceFrameSettings ? THREE.FrontSide : THREE.DoubleSide} depthWrite={renderOpacity > 0.99 && (layer.kind === 'image' || layer.kind === 'video')} depthTest />
                )}
            </mesh>
            {deviceFrameSettings && deviceFrameMetrics && (
                getDeviceSpec(deviceFrameSettings.deviceId).family === 'laptop' ? (
                    <MacBookProFrame
                        metrics={deviceFrameMetrics}
                        settings={deviceFrameSettings}
                        rotation={rot}
                    />
                ) : (
                    <PhoneDeviceFrame
                        metrics={deviceFrameMetrics}
                        settings={deviceFrameSettings}
                        rotation={rot}
                    />
                )
            )}
    </>;

    return (
        <group position={[worldX, worldY, worldZ]} rotation={[-rot.x, rot.y, -rot.z]} scale={[scale.x, scale.y, scale.z || 1]}
            onPointerDown={e => { e.stopPropagation(); }}
            onClick={e => { e.stopPropagation(); onSelect(layer.id, e.shiftKey || e.metaKey || e.ctrlKey); }}
        >
            {deviceFrameSettings ? <DeviceOpacityGroup opacity={surface.assemblyOpacity}>{contents}</DeviceOpacityGroup> : contents}
        </group>
    );
};
