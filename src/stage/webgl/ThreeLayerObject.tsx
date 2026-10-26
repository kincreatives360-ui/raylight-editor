import React, { useMemo, useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
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
import { hexToRgba, getOrCreateVideoElement } from '../../engine/canvasRenderer';
import { usePlayheadStore } from '../../store/usePlayheadStore';
import { SCREEN_PLANE_Z, getDeviceSpec } from '../../model/deviceFrame';
import { PhoneDeviceFrame } from './PhoneDeviceFrame';
import { MacBookProDeviceFrame } from './MacBookProDeviceFrame';
import { applyBokehBlur, applyMotionBlur, applyLayerReveal, drawLayerHalo, getLayerEffectUniforms, installLayerEffects } from './layerEffects';

interface ThreeLayerObjectProps {
    evalLayer: EvaluatedLayerWithEffects;
    project: Project;
    evaluatedCamera: EvaluatedCamera;
    onSelect: (layerId: string, multiSelect?: boolean) => void;
}

/**
 * Creates a rounded rectangle Shape in Three.js centered at (0, 0)
 */
function createRoundedRectShape(
    width: number,
    height: number,
    radius: number
): THREE.Shape {
    const shape = new THREE.Shape();
    const x = -width / 2;
    const y = -height / 2;
    const r = Math.max(0.001, Math.min(radius, width / 2, height / 2));

    shape.moveTo(x + r, y);
    shape.lineTo(x + width - r, y);
    shape.quadraticCurveTo(x + width, y, x + width, y + r);
    shape.lineTo(x + width, y + height - r);
    shape.quadraticCurveTo(
        x + width,
        y + height,
        x + width - r,
        y + height
    );
    shape.lineTo(x + r, y + height);
    shape.quadraticCurveTo(x, y + height, x, y + height - r);
    shape.lineTo(x, y + r);
    shape.quadraticCurveTo(x, y, x + r, y);

    return shape;
}

/**
 * Creates a ShapeGeometry whose UV coordinates are normalized to [0..1]
 * so CanvasTextures map cleanly across rounded media layers.
 */
function createNormalizedRoundedGeometry(
    width: number,
    height: number,
    radius: number
): THREE.ShapeGeometry {
    const shape = createRoundedRectShape(width, height, radius);
    const geom = new THREE.ShapeGeometry(shape, 64);
    const pos = geom.attributes.position;
    const uvs = new Float32Array(pos.count * 2);

    for (let i = 0; i < pos.count; i++) {
        const vx = pos.getX(i);
        const vy = pos.getY(i);
        uvs[i * 2] = (vx + width / 2) / Math.max(0.0001, width);
        uvs[i * 2 + 1] = (vy + height / 2) / Math.max(0.0001, height);
    }
    geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    return geom;
}

function drawStudioPlaceholder(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    layerName: string,
    blurPx: number = 0,
    pixelRatio: number = 1
): void {
    ctx.save();
    if (blurPx > 0) {
        ctx.filter = `blur(${Math.min(24, blurPx) * pixelRatio}px)`;
    }

    const bgGrad = ctx.createLinearGradient(0, 0, w, h);
    bgGrad.addColorStop(0, '#0f172a');
    bgGrad.addColorStop(0.55, '#1e1b4b');
    bgGrad.addColorStop(1, '#1e293b');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    const pad = w * 0.05;
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.roundRect(pad, pad * 1.4, w * 0.56, h - pad * 2.6, 16);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${Math.max(18, Math.round(h * 0.075))}px Inter, sans-serif`;
    ctx.fillText('$148,920.00', pad * 1.6, h * 0.34);

    ctx.fillStyle = '#38bdf8';
    ctx.font = `600 ${Math.max(13, Math.round(h * 0.042))}px Inter, sans-serif`;
    ctx.fillText(layerName || 'Pasted image', pad * 1.6, h * 0.44);

    const bars = [0.35, 0.52, 0.44, 0.7, 0.62, 0.86, 0.75, 0.95];
    const chartX = pad * 1.6;
    const chartY = h * 0.54;
    const chartW = w * 0.46;
    const chartH = h * 0.26;
    const barW = chartW / (bars.length * 1.35);

    bars.forEach((b, i) => {
        const bh = chartH * b;
        const bx = chartX + i * barW * 1.35;
        const by = chartY + (chartH - bh);
        ctx.fillStyle = '#0088ff';
        ctx.beginPath();
        ctx.roundRect(bx, by, barW, bh, 4);
        ctx.fill();
    });

    ctx.restore();
}

// eslint-disable-next-line react-refresh/only-export-components
export function getLayerBlurBleedLayout(
    canvasW: number,
    canvasH: number,
    totalBlurPx: number,
    dofBlurPx: number,
    motionBlur?: { x: number; y: number },
    deviceFramed = false
) {
    const motionDistPx = motionBlur ? Math.hypot(motionBlur.x * canvasW, motionBlur.y * canvasH) : 0;
    const effectiveBlurPx = totalBlurPx + dofBlurPx * 1.5 + motionDistPx;
    const blurPadding = (!deviceFramed && effectiveBlurPx > 0.1)
        ? Math.min(256, Math.ceil(effectiveBlurPx * 3))
        : 0;
    const paddedCanvasW = canvasW + blurPadding * 2;
    const paddedCanvasH = canvasH + blurPadding * 2;
    const widthScale = paddedCanvasW / canvasW;
    const heightScale = paddedCanvasH / canvasH;
    return {
        blurPadding,
        paddedCanvasW,
        paddedCanvasH,
        widthScale,
        heightScale,
    };
}

export const ThreeLayerObject: React.FC<ThreeLayerObjectProps> = ({
    evalLayer,
    project,
    evaluatedCamera,
    onSelect,
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

    const { worldX, worldY, worldZ, meshW, meshH, deviceSettings: deviceFrameSettings, frameMetrics: deviceFrameMetrics, scale } = getLayerRenderLayout(
        evalLayer,
        aspect,
        cameraZ,
        focalLength
    );

    const screenFit = deviceFrameSettings?.screenFit ?? 'stretch';
    const screenFill = deviceFrameSettings?.screenFillColor;
    const screenPan = deviceFrameSettings?.screenPan;
    const screenZoom = deviceFrameSettings?.screenZoom;
    const rot = evalLayer.rotation;
    const opacity = evalLayer.opacity ?? 1;
    const totalBlurPx = Math.max(0, Math.round(((evalLayer.totalBlurPx ?? 0) - (evalLayer.dofBlurPx ?? 0)) * 2) / 2);
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
    const { width: textureW } = getMediaTextureSize(meshW, meshH, {
        pixelWidth: Math.max(edgeLength(corners.pNW, corners.pNE), edgeLength(corners.pSW, corners.pSE)),
        pixelHeight: Math.max(edgeLength(corners.pNW, corners.pSW), edgeLength(corners.pNE, corners.pSE)),
        maxTextureSize: gl.capabilities.maxTextureSize,
    });
    const { width: canvasW, height: canvasH } = getMediaTextureSize(meshW, meshH);
    const texturePixelRatio = textureW / canvasW;

    const { blurPadding, paddedCanvasW, paddedCanvasH, widthScale, heightScale } = getLayerBlurBleedLayout(
        canvasW,
        canvasH,
        totalBlurPx,
        dofBlurPx,
        evalLayer.motionBlur,
        Boolean(deviceFrameSettings)
    );
    const paddedTextureW = Math.round(paddedCanvasW * texturePixelRatio);
    const paddedTextureH = Math.round(paddedCanvasH * texturePixelRatio);
    const effectUniforms = useMemo(() => getLayerEffectUniforms(layer.effects, layer.blendMode), [layer.effects, layer.blendMode]);
    const sceneCopy = useRef<THREE.FramebufferTexture | null>(null);
    useEffect(() => () => { sceneCopy.current?.dispose(); }, []);
    const captureBackdrop = (renderer: THREE.WebGLRenderer) => {
        if (!effectUniforms.layerBlend.value && !effectUniforms.layerBackdrop.value && !effectUniforms.layerGlass.value) return;
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
        effectUniforms.layerScene.value = sceneCopy.current;
        effectUniforms.layerResolution.value.copy(dimensions);
        effectUniforms.layerBackdrop.value = Math.max(0, layer.effects.backdropBlur ?? 0) * 100 * dimensions.x / 960;
    };
    const compileEffects = (shader: THREE.WebGLProgramParametersWithUniforms) => installLayerEffects(shader, effectUniforms);

    const isVideoAsset = useMemo(() => {
        if (layer.kind === 'video') return true;
        if (layer.kind === 'image') {
            const asset = project.assets[(layer as ImageLayer).assetId];
            return asset?.mimeType?.startsWith('video/') ?? false;
        }
        return false;
    }, [layer, project.assets]);

    // Selective playhead subscription: Only video layers re-render on RAF ticks; static layers stay idle
    const currentTimeMs = usePlayheadStore((s) => (isVideoAsset ? s.currentTimeMs : 0));

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
        return getOrCreateVideoElement(assetUrl);
    }, [isVideoAsset, assetUrl]);

    // Keep video currentTime synchronized with timeline playhead
    useEffect(() => {
        const vid = videoElement;
        if (!vid) return;
        const targetSec = Math.max(0, (currentTimeMs - layer.inMs) / 1000);
        if (Number.isFinite(targetSec)) {
            if (Math.abs(vid.currentTime - targetSec) > 0.04) {
                vid.currentTime = targetSec;
            }
        }
    }, [videoElement, currentTimeMs, layer.inMs]);

    // Generate proportional CanvasTexture with Crop, Stroke, Shimmer & DoF Blur
    const texture = useMemo(() => {
        if (!surface.visible) return null;

        const canvas = document.createElement('canvas');
        canvas.width = paddedTextureW;
        canvas.height = paddedTextureH;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
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

            drawMediaShimmer(ctx, canvasW, canvasH, evalLayer.shimmerProgress);
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
            const lineHeight = fontSize * 1.22;
            const startY = cy - ((lines.length - 1) * lineHeight) / 2;

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
                const isRadial = shapeL.fill.gradientType === 'radial';
                const cx = canvasW / 2;
                const cy = canvasH / 2;
                const len = Math.hypot(canvasW, canvasH) / 2;
                let grad: CanvasGradient;
                if (isRadial) {
                    grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, len);
                } else {
                    const rad = (((shapeL.fill.angle ?? 135) - 90) * Math.PI) / 180;
                    grad = ctx.createLinearGradient(
                        cx - Math.cos(rad) * len,
                        cy - Math.sin(rad) * len,
                        cx + Math.cos(rad) * len,
                        cy + Math.sin(rad) * len
                    );
                }
                for (const st of shapeL.fill.stops || []) {
                    grad.addColorStop(
                        Math.max(0, Math.min(1, st.at)),
                        hexToRgba(st.color, st.opacity ?? 1)
                    );
                }
                ctx.fillStyle = grad;
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

        applyBokehBlur(canvas, dofBlurPx * texturePixelRatio * 1.5, evalLayer.dofBokehShape);
        if (evalLayer.motionBlur) {
            applyMotionBlur(
                canvas,
                evalLayer.motionBlur.x * canvasW * texturePixelRatio,
                evalLayer.motionBlur.y * canvasH * texturePixelRatio,
                evalLayer.motionBlur.samples
            );
        }

        ctx.resetTransform();
        ctx.scale(paddedTextureW / paddedCanvasW, paddedTextureH / paddedCanvasH);
        if (blurPadding > 0) ctx.translate(blurPadding, blurPadding);

        applyTextureMask(ctx, canvasW, canvasH, layer, project);
        applyLayerReveal(ctx, canvasW, canvasH, evalLayer.maskSweepProgress, evalLayer.pathRevealProgress);

        const tex = new THREE.CanvasTexture(canvas);
        const maxAniso = gl.capabilities?.getMaxAnisotropy?.() ?? 16;
        configureLayerTexture(tex, maxAniso);
        return tex;
    }, [
        layer,
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
        const result = drawLayerHalo(texture.image as HTMLCanvasElement, layer.effects, evalLayer.glowIntensityOffset, evalLayer.glowRadiusOffset, gl.capabilities.maxTextureSize);
        if (!result) return null;
        const haloTexture = new THREE.CanvasTexture(result.canvas);
        configureLayerTexture(haloTexture, gl.capabilities.getMaxAnisotropy());
        return { ...result, texture: haloTexture };
    }, [texture, layer.effects, evalLayer.glowIntensityOffset, evalLayer.glowRadiusOffset, gl]);
    useEffect(() => () => { halo?.texture.dispose(); }, [halo]);

    // Dispose previous texture whenever a new one is generated or component unmounts
    useEffect(() => {
        return () => {
            if (texture) {
                texture.dispose();
            }
        };
    }, [texture]);

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
            drawMediaShimmer(ctx, canvasW, canvasH, evalLayer.shimmerProgress);
            applyBokehBlur(canvas, dofBlurPx * texturePixelRatio * 1.5, evalLayer.dofBokehShape);
            if (evalLayer.motionBlur) {
                applyMotionBlur(
                    canvas,
                    evalLayer.motionBlur.x * canvasW * texturePixelRatio,
                    evalLayer.motionBlur.y * canvasH * texturePixelRatio,
                    evalLayer.motionBlur.samples
                );
            }
            ctx.resetTransform();
            ctx.scale(paddedTextureW / paddedCanvasW, paddedTextureH / paddedCanvasH);
            if (blurPadding > 0) ctx.translate(blurPadding, blurPadding);
            applyTextureMask(ctx, canvasW, canvasH, layer, project);
            applyLayerReveal(ctx, canvasW, canvasH, evalLayer.maskSweepProgress, evalLayer.pathRevealProgress);
            if (halo) {
                const updated = drawLayerHalo(canvas, layer.effects, evalLayer.glowIntensityOffset, evalLayer.glowRadiusOffset, gl.capabilities.maxTextureSize);
                const haloCtx = halo.canvas.getContext('2d');
                if (updated && haloCtx) {
                    haloCtx.clearRect(0, 0, halo.canvas.width, halo.canvas.height);
                    haloCtx.drawImage(updated.canvas, 0, 0);
                    markTextureUpdated(halo.texture);
                }
            }
            markTextureUpdated(texture);
            invalidate();
        };
        redraw();
        const events = ['loadeddata', 'seeked', 'timeupdate'] as const;
        for (const event of events) videoElement.addEventListener(event, redraw);
        return () => { for (const event of events) videoElement.removeEventListener(event, redraw); };
    }, [
        currentTimeMs,
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
            {halo && <mesh position={[0, 0, haloZ]} renderOrder={layer.order * 2}>
                <planeGeometry args={[meshW * widthScale * halo.widthScale, meshH * heightScale * halo.heightScale]} />
                <meshBasicMaterial map={halo.texture} transparent opacity={renderOpacity} toneMapped={false} depthWrite={false} side={THREE.DoubleSide} />
            </mesh>}
            <mesh
                onBeforeRender={captureBackdrop}
                renderOrder={layer.order * 2 + 1}
                // One shared screen plane: the artwork sits at SCREEN_PLANE_Z
                // with or without a frame, so toggling the frame never shifts
                // it. PhoneDeviceFrame stages the rim just in front of this
                // plane and the solid backer just behind, so the bezel
                // occludes the screen edge at every tilt instead of the
                // artwork floating over the chassis.
                position={[0, 0, SCREEN_PLANE_Z]}
                geometry={(blurPadding <= 0 && (layer.kind === 'image' || layer.kind === 'video') && !deviceFrameSettings) ? normalizedScreenGeometry ?? undefined : undefined}
                castShadow={receivesLight && (layer.kind === 'image' || layer.kind === 'video')}
                receiveShadow={receivesLight}
            >
                {(blurPadding > 0 || (layer.kind !== 'image' && layer.kind !== 'video') || Boolean(deviceFrameSettings)) && (
                    <planeGeometry args={[meshW * widthScale, meshH * heightScale]} />
                )}
                {receivesLight ? (
                    <meshStandardMaterial key={layer.id + JSON.stringify(layer.effects) + layer.blendMode} onBeforeCompile={compileEffects} customProgramCacheKey={() => `layer-effects-${layer.id}`} map={texture || undefined} color="#ffffff" transparent opacity={renderOpacity} roughness={surfaceRoughness} metalness={surfaceMetalness} side={deviceFrameSettings ? THREE.FrontSide : THREE.DoubleSide} depthWrite={layer.kind === 'image' || layer.kind === 'video'} depthTest />
                ) : (
                    <meshBasicMaterial key={layer.id + JSON.stringify(layer.effects) + layer.blendMode} onBeforeCompile={compileEffects} customProgramCacheKey={() => `layer-effects-${layer.id}`} map={texture} color="#ffffff" transparent={!deviceFrameSettings} toneMapped={false} opacity={renderOpacity} side={deviceFrameSettings ? THREE.FrontSide : THREE.DoubleSide} depthWrite={layer.kind === 'image' || layer.kind === 'video'} depthTest />
                )}
            </mesh>
            {deviceFrameSettings && deviceFrameMetrics && (
                getDeviceSpec(deviceFrameSettings.deviceId).family === 'laptop' ? (
                    <MacBookProDeviceFrame
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

function markTextureUpdated(texture: THREE.Texture) { texture.needsUpdate = true; }
 
// eslint-disable-next-line react-refresh/only-export-components
export function configureLayerTexture(tex: THREE.Texture, maxAnisotropy = 16): THREE.Texture {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = Math.max(1, Math.min(16, maxAnisotropy));
    tex.needsUpdate = true;
    return tex;
}
