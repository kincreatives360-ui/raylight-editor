import React, { useMemo, useState, useEffect } from 'react';
import * as THREE from 'three';
import type { EvaluatedLayerWithEffects } from '../../engine/evaluateShot';
import type {
    Project,
    TextLayer,
    ShapeLayer,
    ImageLayer,
    VideoLayer,
} from '../../model/types';
import { getLayer3DWorldTransform } from './cameraMath';
import { hexToRgba, getOrCreateVideoElement } from '../../engine/canvasRenderer';
import { usePlayheadStore } from '../../store/usePlayheadStore';
import { resolveDeviceColor, resolveDeviceModelSpec } from '../../model/defaults';
import { computeDeviceGeometry, drawSourceWithFit } from '../../engine/deviceFitMath';

interface ThreeLayerObjectProps {
    evalLayer: EvaluatedLayerWithEffects;
    project: Project;
    isSelected: boolean;
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
 * so CanvasTextures map cleanly across rounded screens and iPhones!
 */
function createNormalizedRoundedGeometry(
    width: number,
    height: number,
    radius: number
): THREE.ShapeGeometry {
    const shape = createRoundedRectShape(width, height, radius);
    const geom = new THREE.ShapeGeometry(shape, 16);
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

let cachedContactShadowTexture: THREE.CanvasTexture | null = null;
function getContactShadowTexture(): THREE.CanvasTexture {
    if (!cachedContactShadowTexture) {
        const sc = document.createElement('canvas');
        sc.width = 256;
        sc.height = 256;
        const sctx = sc.getContext('2d');
        if (sctx) {
            const rad = sctx.createRadialGradient(128, 128, 0, 128, 128, 128);
            rad.addColorStop(0, 'rgba(0,0,0,0.85)');
            rad.addColorStop(0.3, 'rgba(0,0,0,0.5)');
            rad.addColorStop(0.65, 'rgba(0,0,0,0.15)');
            rad.addColorStop(1, 'rgba(0,0,0,0)');
            sctx.fillStyle = rad;
            sctx.fillRect(0, 0, 256, 256);
        }
        cachedContactShadowTexture = new THREE.CanvasTexture(sc);
        cachedContactShadowTexture.colorSpace = THREE.SRGBColorSpace;
    }
    return cachedContactShadowTexture;
}

function drawStudioPlaceholder(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    layerName: string,
    blurPx: number = 0
): void {
    ctx.save();
    if (blurPx > 0) {
        ctx.filter = `blur(${Math.min(24, blurPx)}px)`;
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

export const ThreeLayerObject: React.FC<ThreeLayerObjectProps> = ({
    evalLayer,
    project,
    isSelected,
    onSelect,
}) => {
    const { layer } = evalLayer;

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

    const { worldX, worldY, worldZ, meshW: boxW, meshH: boxH } = getLayer3DWorldTransform(
        evalLayer,
        aspect,
        cameraZ,
        focalLength
    );

    const device =
        (layer.kind === 'image' || layer.kind === 'video')
            ? (layer as ImageLayer | VideoLayer).device
            : undefined;

    // Physical device geometry comes from the canonical model spec, fitted uniformly
    // inside the layer box. It never depends on the source image/video dimensions.
    const deviceGeom = device
        ? computeDeviceGeometry(resolveDeviceModelSpec(device), boxW, boxH, device.orientation)
        : null;
    // meshW/meshH = the screen surface (device) or the layer surface (no device).
    const meshW = deviceGeom ? deviceGeom.screenW : boxW;
    const meshH = deviceGeom ? deviceGeom.screenH : boxH;

    const rot = evalLayer.rotation;
    const scale = evalLayer.scale ?? { x: 1, y: 1, z: 1 };
    const opacity = evalLayer.opacity ?? 1;
    const totalBlurPx = Math.round((evalLayer.totalBlurPx ?? 0) * 2) / 2;

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

    const isPhone = device?.type === 'iphone';
    const isIpad = device?.type === 'ipad';
    const isMacbook = device?.type === 'macbook';
    const isBrowser = device?.type === 'browser';
    const isSamsung = device?.type === 'samsung-galaxy';
    const isDisplay = device?.type === 'display';

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
                // eslint-disable-next-line react-hooks/immutability
                vid.currentTime = targetSec;
            }
        }
    }, [videoElement, currentTimeMs, layer.inMs]);

    // Generate proportional CanvasTexture with Crop, Stroke, Shimmer & DoF Blur
    const texture = useMemo(() => {
        // Texture aspect always matches the surface it is mapped onto (screen or layer).
        const layerAspect = meshW / Math.max(0.01, meshH);
        const baseLong = 1024;
        const canvasW =
            layerAspect >= 1
                ? baseLong
                : Math.max(256, Math.round(baseLong * layerAspect));
        const canvasH =
            layerAspect >= 1
                ? Math.max(256, Math.round(baseLong / layerAspect))
                : baseLong;

        const canvas = document.createElement('canvas');
        canvas.width = canvasW;
        canvas.height = canvasH;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        if (layer.kind === 'image' || layer.kind === 'video') {
            const imgL = layer as ImageLayer | VideoLayer;
            const topBarH = isBrowser ? Math.round(canvasH * 0.07) : 0;

            if (isBrowser) {
                ctx.fillStyle = device?.color === 'silver' ? '#e2e8f0' : '#0f172a';
                ctx.fillRect(0, 0, canvasW, topBarH);
                ['#f43f5e', '#fbbf24', '#34d399'].forEach((dot, idx) => {
                    ctx.fillStyle = dot;
                    ctx.beginPath();
                    ctx.arc(
                        canvasW * 0.035 + idx * (canvasW * 0.025),
                        topBarH * 0.5,
                        Math.max(4, topBarH * 0.18),
                        0,
                        Math.PI * 2
                    );
                    ctx.fill();
                });
            }

            const drawFitted = (
                source: CanvasImageSource,
                naturalW: number,
                naturalH: number,
                dstX: number,
                dstY: number,
                dstW: number,
                dstH: number
            ) => {
                if (naturalW <= 0 || naturalH <= 0) return; // e.g. video before metadata
                const crop = imgL.crop || { x: 0, y: 0, width: 1, height: 1 };
                if (!device) {
                    // Non-device layers: legacy behavior, source fills the layer box.
                    ctx.drawImage(
                        source,
                        crop.x * naturalW,
                        crop.y * naturalH,
                        Math.max(1, crop.width * naturalW),
                        Math.max(1, crop.height * naturalH),
                        dstX, dstY, dstW, dstH
                    );
                    return;
                }
                const fit = device.screenFit ?? resolveDeviceModelSpec(device).defaultFit;
                drawSourceWithFit(ctx, source, naturalW, naturalH, crop, dstX, dstY, dstW, dstH, fit);
            };

            if (isVideoAsset && videoElement) {
                ctx.save();
                if (totalBlurPx > 0) {
                    ctx.filter = `blur(${Math.min(28, totalBlurPx * 1.5)}px)`;
                }
                if (device) {
                    ctx.fillStyle = '#0a0a0c';
                    ctx.fillRect(0, topBarH, canvasW, canvasH - topBarH);
                }
                drawFitted(
                    videoElement,
                    videoElement.videoWidth,
                    videoElement.videoHeight,
                    0,
                    topBarH,
                    canvasW,
                    canvasH - topBarH
                );
                ctx.restore();
            } else if (loadedImg) {
                ctx.save();
                if (totalBlurPx > 0) {
                    ctx.filter = `blur(${Math.min(28, totalBlurPx * 1.5)}px)`;
                }
                drawFitted(
                    loadedImg,
                    loadedImg.naturalWidth,
                    loadedImg.naturalHeight,
                    0,
                    topBarH,
                    canvasW,
                    canvasH - topBarH
                );
                ctx.restore();
            } else {
                drawStudioPlaceholder(
                    ctx,
                    canvasW,
                    canvasH,
                    imgL.name,
                    totalBlurPx
                );
            }

            // Draw Dynamic Island for iPhone (Samsung punch-hole is rendered via 3D mesh)
            if (isPhone) {
                const pillW = canvasW * 0.28;
                const pillH = canvasH * 0.038;
                const pillX = (canvasW - pillW) / 2;
                const pillY = canvasH * 0.024;
                ctx.fillStyle = '#000000';
                ctx.beginPath();
                ctx.roundRect(pillX, pillY, pillW, pillH, pillH / 2);
                ctx.fill();
                ctx.fillStyle = '#0f172a';
                ctx.beginPath();
                ctx.arc(pillX + pillW * 0.78, pillY + pillH * 0.5, pillH * 0.26, 0, Math.PI * 2);
                ctx.fill();
            }

            // Screen Glare & Specular Reflection
            if (device?.glare && device.glare > 0) {
                const glareVal = Math.min(1, Math.max(0, device.glare));
                const glareGrad = ctx.createLinearGradient(0, topBarH, canvasW * 1.25, canvasH);
                glareGrad.addColorStop(0, `rgba(255,255,255,${0.28 * glareVal})`);
                glareGrad.addColorStop(0.35, `rgba(255,255,255,${0.09 * glareVal})`);
                glareGrad.addColorStop(0.55, 'rgba(255,255,255,0)');
                ctx.fillStyle = glareGrad;
                ctx.fillRect(0, topBarH, canvasW, canvasH - topBarH);
            }

            if (evalLayer.shimmerProgress > 0 && evalLayer.shimmerProgress < 1) {
                const shimX = evalLayer.shimmerProgress * canvasW;
                const shimGrad = ctx.createLinearGradient(
                    shimX - canvasW * 0.25,
                    0,
                    shimX + canvasW * 0.25,
                    canvasH
                );
                shimGrad.addColorStop(0, 'rgba(255,255,255,0)');
                shimGrad.addColorStop(0.5, 'rgba(255,255,255,0.35)');
                shimGrad.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = shimGrad;
                ctx.fillRect(0, 0, canvasW, canvasH);
            }
        } else if (layer.kind === 'text') {
            const textL = layer as TextLayer;
            ctx.clearRect(0, 0, canvasW, canvasH);

            ctx.save();
            if (totalBlurPx > 0) {
                ctx.filter = `blur(${Math.min(28, totalBlurPx * 1.5)}px)`;
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
                ctx.filter = `blur(${Math.min(28, totalBlurPx * 1.5)}px)`;
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

        // Alpha-mask compositing: shape layers can mask any image, text, or shape layer.
        // The mask is evaluated in the target layer's local UV space so it stays attached
        // while the target moves/animates. Only visible shape geometry is used as alpha.
        if (layer.maskLayerId) {
            const mask = project.shots.flatMap((shot) => shot.layers).find((candidate) => candidate.id === layer.maskLayerId);
            if (mask?.kind === 'shape') {
                const maskCtx = canvas.getContext('2d');
                if (maskCtx) {
                    maskCtx.save();
                    maskCtx.globalCompositeOperation = 'destination-in';
                    maskCtx.globalAlpha = 1;
                    maskCtx.fillStyle = '#fff';
                    maskCtx.strokeStyle = '#fff';
                    maskCtx.lineWidth = Math.max(6, canvasH * 0.18);
                    maskCtx.beginPath();
                    if (mask.shape === 'ellipse') {
                        maskCtx.ellipse(canvasW / 2, canvasH / 2, canvasW / 2, canvasH / 2, 0, 0, Math.PI * 2);
                    } else if (mask.shape === 'line' || mask.shape === 'arrow') {
                        maskCtx.moveTo(0, canvasH / 2); maskCtx.lineTo(canvasW, canvasH / 2);
                        if (mask.shape === 'arrow') { maskCtx.moveTo(canvasW, canvasH / 2); maskCtx.lineTo(canvasW * 0.82, canvasH * 0.32); maskCtx.moveTo(canvasW, canvasH / 2); maskCtx.lineTo(canvasW * 0.82, canvasH * 0.68); }
                    } else if (mask.shape === 'polygon') {
                        const points = mask.points?.length ? mask.points : [{x:0.5,y:0},{x:1,y:0.5},{x:0.5,y:1},{x:0,y:0.5}];
                        points.forEach((pt, i) => { const x = pt.x * canvasW; const y = pt.y * canvasH; if (i === 0) maskCtx.moveTo(x,y); else maskCtx.lineTo(x,y); }); maskCtx.closePath();
                    } else {
                        const r = Math.max(0, (mask.cornerRadius || 0) * Math.min(canvasW, canvasH) * 0.5);
                        maskCtx.roundRect(0, 0, canvasW, canvasH, r);
                    }
                    if (mask.shape === 'line' || mask.shape === 'arrow') maskCtx.stroke(); else maskCtx.fill();
                    maskCtx.restore();
                }
            }
        }

        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.needsUpdate = true;
        return tex;
    }, [
        layer,
        project,
        loadedImg,
        isVideoAsset,
        videoElement,
        totalBlurPx,
        meshW,
        meshH,
        isBrowser,
        isPhone,
        device,
        evalLayer.shimmerProgress,
        evalLayer.textContentOverride,
        evalLayer.size.height,
    ]);

    // Dispose previous texture whenever a new one is generated or component unmounts
    useEffect(() => {
        return () => {
            if (texture) {
                texture.dispose();
            }
        };
    }, [texture]);

    // Live frame redraw for video layers as currentTimeMs updates
    useEffect(() => {
        if (!isVideoAsset || !videoElement || !texture) return;
        const image = texture.image as HTMLCanvasElement | undefined;
        if (!image) return;
        const ctx = image.getContext('2d');
        if (!ctx) return;
        const topBarH = isBrowser ? Math.round(image.height * 0.07) : 0;
        const imgL = layer as ImageLayer | VideoLayer;
        const vw = videoElement.videoWidth;
        const vh = videoElement.videoHeight;
        if (vw <= 0 || vh <= 0) return; // metadata not loaded yet
        const crop = imgL.crop || { x: 0, y: 0, width: 1, height: 1 };
        const dstH = image.height - topBarH;

        ctx.save();
        if (totalBlurPx > 0) {
            ctx.filter = `blur(${Math.min(28, totalBlurPx * 1.5)}px)`;
        }
        if (device) {
            const fit = device.screenFit ?? resolveDeviceModelSpec(device).defaultFit;
            drawSourceWithFit(ctx, videoElement, vw, vh, crop, 0, topBarH, image.width, dstH, fit);
        } else {
            ctx.drawImage(
                videoElement,
                crop.x * vw,
                crop.y * vh,
                Math.max(1, crop.width * vw),
                Math.max(1, crop.height * vh),
                0,
                topBarH,
                image.width,
                dstH
            );
        }
        ctx.restore();
        // eslint-disable-next-line react-hooks/immutability
        texture.needsUpdate = true;
    }, [currentTimeMs, isVideoAsset, videoElement, texture, isBrowser, layer, totalBlurPx, device]);

    const cornerRadiusWorld = useMemo(() => {
        if (deviceGeom) return deviceGeom.screenCornerRadius;
        if (layer.kind !== 'text') {
            return (layer.cornerRadius ?? 0.03) * Math.min(meshW, meshH) * 0.5;
        }
        return 0.005;
    }, [deviceGeom?.screenCornerRadius, layer, meshW, meshH]); // eslint-disable-line react-hooks/exhaustive-deps

    // Chassis = physical device body from the model spec (independent of the screen content).
    const chassisW = deviceGeom ? deviceGeom.deviceW : meshW * 1.05;
    const chassisH = deviceGeom ? deviceGeom.deviceH : meshH * 1.04;
    const chassisR = deviceGeom ? deviceGeom.chassisCornerRadius : Math.min(chassisW, chassisH) * 0.07;

    const chassisShape = useMemo(
        () => createRoundedRectShape(chassisW, chassisH, chassisR),
        [chassisW, chassisH, chassisR]
    );

    const normalizedScreenGeometry = useMemo(
        () => createNormalizedRoundedGeometry(meshW, meshH, cornerRadiusWorld),
        [meshW, meshH, cornerRadiusWorld]
    );

    useEffect(() => {
        return () => {
            normalizedScreenGeometry.dispose();
        };
    }, [normalizedScreenGeometry]);

    const phoneExtrudeSettings = useMemo(
        () => ({
            depth: 0.032,
            bevelEnabled: true,
            bevelSegments: 4,
            steps: 1,
            bevelSize: 0.008,
            bevelThickness: 0.008,
        }),
        []
    );

    const cameraIslandShape = useMemo(() => {
        if (!isPhone) return null;
        const islandW = chassisW * 0.44;
        const islandH = chassisW * 0.44;
        const islandR = islandW * 0.28;
        return createRoundedRectShape(islandW, islandH, islandR);
    }, [isPhone, chassisW]);

    // Browser window chrome shape (the rounded window frame)
    const browserFrameShape = useMemo(
        () => isBrowser ? createRoundedRectShape(chassisW, chassisH, chassisR) : null,
        [isBrowser, chassisW, chassisH, chassisR]
    );

    const cameraIslandExtrudeSettings = useMemo(() => ({
        depth: 0.016,
        bevelEnabled: true,
        bevelSegments: 4,
        steps: 1,
        bevelSize: 0.006,
        bevelThickness: 0.006,
    }), []);

    if (!isSelected && (!evalLayer.visible || opacity <= 0.001)) return null;

    const renderOpacity = isSelected ? Math.max(0.65, opacity) : opacity;
    const chassisRoughness = Math.min(0.9, 0.22 + totalBlurPx * 0.02);

    // Layer opt-in: text defaults to unlit (receivesLight = false) for sharp readability; images/video/devices/shapes default to lit
    const receivesLight = layer.receivesLight !== undefined
        ? layer.receivesLight
        : layer.kind !== 'text';

    // Surface material response:
    // Device screen gets glass finish (low roughness, subtle specular reflection for blooming highlights)
    const isDeviceScreen = isPhone || isIpad || isMacbook || isSamsung || isDisplay;
    const defaultRoughness = isDeviceScreen
        ? 0.08
        : (layer.kind === 'image' || layer.kind === 'video' ? 0.24 : 0.45);
    const defaultMetalness = isDeviceScreen
        ? 0.12
        : (layer.kind === 'image' || layer.kind === 'video' ? 0.06 : 0.02);

    const surfaceRoughness = layer.material?.roughness ?? defaultRoughness;
    const surfaceMetalness = layer.material?.metalness ?? defaultMetalness;

    const contactShadowTexture = getContactShadowTexture();

    const stagingTiltX = device?.staging === 'held' ? 0.08 : device?.staging === 'desk' ? 0.22 : 0;
    const stagingTiltY = device?.staging === 'held' ? -0.05 : 0;
    const stagingOffsetY = device?.staging === 'floating' ? 0.03 : device?.staging === 'held' ? -0.04 : 0;
    const stagingOffsetZ = device?.staging === 'floating' ? 0.06 : 0;

    const chassisHex = resolveDeviceColor(device?.color);

    return (
        <group
            position={[worldX, worldY + stagingOffsetY, worldZ + stagingOffsetZ]}
            rotation={[-rot.x + stagingTiltX, rot.y + stagingTiltY, -rot.z]}
            scale={[scale.x, scale.y, scale.z || 1]}
            onPointerDown={(e) => {
                e.stopPropagation();
            }}
            onClick={(e) => {
                e.stopPropagation();
                onSelect(layer.id, e.shiftKey || e.metaKey || e.ctrlKey);
            }}
        >
            {/* 1. 3D IPHONE / IPAD / SAMSUNG GALAXY CHASSIS */}
            {(isPhone || isIpad || isSamsung) && (
                <group position={[0, 0, -0.035]}>
                    <mesh castShadow receiveShadow>
                        <extrudeGeometry args={[chassisShape, phoneExtrudeSettings]} />
                        <meshStandardMaterial
                            color={chassisHex}
                            metalness={0.94}
                            roughness={chassisRoughness}
                            envMapIntensity={1.4}
                        />
                    </mesh>
                </group>
            )}

            {/* BACK CAMERA BUMP & TRIPLE LENS SYSTEM (iPhone) */}
            {isPhone && cameraIslandShape && (
                <group position={[-chassisW * 0.22, chassisH * 0.27, -0.048]}>
                    {/* Camera Island Plateau */}
                    <mesh castShadow receiveShadow>
                        <extrudeGeometry args={[cameraIslandShape, cameraIslandExtrudeSettings]} />
                        <meshStandardMaterial
                            color={chassisHex}
                            metalness={0.92}
                            roughness={0.22}
                            envMapIntensity={1.5}
                        />
                    </mesh>

                    {/* Lens 1 (Top Left): Main Camera */}
                    <group position={[-chassisW * 0.095, chassisW * 0.095, -0.014]}>
                        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
                            <cylinderGeometry args={[chassisW * 0.075, chassisW * 0.075, 0.012, 32]} />
                            <meshStandardMaterial color={chassisHex} metalness={0.96} roughness={0.18} />
                        </mesh>
                        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.0065]}>
                            <cylinderGeometry args={[chassisW * 0.062, chassisW * 0.062, 0.002, 32]} />
                            <meshStandardMaterial color="#05070d" metalness={0.3} roughness={0.05} />
                        </mesh>
                    </group>

                    {/* Lens 2 (Bottom Left): Ultra Wide Camera */}
                    <group position={[-chassisW * 0.095, -chassisW * 0.095, -0.014]}>
                        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
                            <cylinderGeometry args={[chassisW * 0.075, chassisW * 0.075, 0.012, 32]} />
                            <meshStandardMaterial color={chassisHex} metalness={0.96} roughness={0.18} />
                        </mesh>
                        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.0065]}>
                            <cylinderGeometry args={[chassisW * 0.062, chassisW * 0.062, 0.002, 32]} />
                            <meshStandardMaterial color="#05070d" metalness={0.3} roughness={0.05} />
                        </mesh>
                    </group>

                    {/* Lens 3 (Right): Telephoto Camera */}
                    <group position={[chassisW * 0.095, 0, -0.014]}>
                        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
                            <cylinderGeometry args={[chassisW * 0.075, chassisW * 0.075, 0.012, 32]} />
                            <meshStandardMaterial color={chassisHex} metalness={0.96} roughness={0.18} />
                        </mesh>
                        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.0065]}>
                            <cylinderGeometry args={[chassisW * 0.062, chassisW * 0.062, 0.002, 32]} />
                            <meshStandardMaterial color="#05070d" metalness={0.3} roughness={0.05} />
                        </mesh>
                    </group>

                    {/* TrueTone Flash LED */}
                    <mesh position={[chassisW * 0.095, chassisW * 0.11, -0.002]} rotation={[Math.PI / 2, 0, 0]}>
                        <cylinderGeometry args={[chassisW * 0.032, chassisW * 0.032, 0.003, 16]} />
                        <meshBasicMaterial color="#fff4d4" />
                    </mesh>

                    {/* LiDAR Scanner Sensor */}
                    <mesh position={[chassisW * 0.095, -chassisW * 0.11, -0.002]} rotation={[Math.PI / 2, 0, 0]}>
                        <cylinderGeometry args={[chassisW * 0.024, chassisW * 0.024, 0.003, 16]} />
                        <meshBasicMaterial color="#1a1c23" />
                    </mesh>
                </group>
            )}

            {/* SIDE BUTTONS (iPhone) */}
            {isPhone && (
                <group position={[0, 0, -0.01]}>
                    <mesh position={[-chassisW * 0.508, chassisH * 0.28, 0]}>
                        <boxGeometry args={[0.008, chassisH * 0.045, 0.014]} />
                        <meshStandardMaterial color={chassisHex} metalness={0.95} roughness={0.2} />
                    </mesh>
                    <mesh position={[-chassisW * 0.508, chassisH * 0.18, 0]}>
                        <boxGeometry args={[0.008, chassisH * 0.075, 0.014]} />
                        <meshStandardMaterial color={chassisHex} metalness={0.95} roughness={0.2} />
                    </mesh>
                    <mesh position={[-chassisW * 0.508, chassisH * 0.08, 0]}>
                        <boxGeometry args={[0.008, chassisH * 0.075, 0.014]} />
                        <meshStandardMaterial color={chassisHex} metalness={0.95} roughness={0.2} />
                    </mesh>
                    <mesh position={[chassisW * 0.508, chassisH * 0.16, 0]}>
                        <boxGeometry args={[0.008, chassisH * 0.12, 0.014]} />
                        <meshStandardMaterial color={chassisHex} metalness={0.95} roughness={0.2} />
                    </mesh>
                </group>
            )}

            {/* 2. 3D MACBOOK CHASSIS */}
            {isMacbook && (
                <>
                    {/* Display unibody lid backing */}
                    <mesh position={[0, 0, -0.006]} castShadow receiveShadow>
                        <boxGeometry args={[chassisW, chassisH, 0.012]} />
                        <meshStandardMaterial
                            color={chassisHex}
                            metalness={0.92}
                            roughness={0.26}
                            envMapIntensity={1.3}
                        />
                    </mesh>
                    {/* Lower keyboard deck */}
                    <group position={[0, -meshH * 0.49, -0.006]}>
                        <mesh
                            position={[0, 0, meshH * 0.42]}
                            rotation={[-Math.PI / 2 + ((device?.lidAngle ?? 100) - 90) * 0.008, 0, 0]}
                            castShadow
                            receiveShadow
                        >
                            <boxGeometry args={[meshW * 1.08, meshH * 0.85, 0.018]} />
                            <meshStandardMaterial
                                color={chassisHex}
                                metalness={0.9}
                                roughness={0.28}
                                envMapIntensity={1.2}
                            />
                        </mesh>
                    </group>
                </>
            )}

            {/* 2b. 3D BROWSER WINDOW CHASSIS */}
            {isBrowser && browserFrameShape && (
                <group position={[0, 0, -0.008]}>
                    {/* Window frame body */}
                    <mesh castShadow receiveShadow>
                        <boxGeometry args={[chassisW, chassisH, 0.008]} />
                        <meshStandardMaterial
                            color={chassisHex}
                            metalness={0.88}
                            roughness={0.3}
                            envMapIntensity={1.2}
                        />
                    </mesh>
                    {/* Window shadow / drop */}
                    <mesh position={[0, -chassisH * 0.004, -0.005]}>
                        <boxGeometry args={[chassisW * 1.01, chassisH * 1.01, 0.003]} />
                        <meshStandardMaterial
                            color="#0a0a0f"
                            transparent
                            opacity={0.4}
                            depthWrite={false}
                        />
                    </mesh>
                </group>
            )}

            {/* 3. 3D PRO / STUDIO DISPLAY CHASSIS & STAND */}
            {isDisplay && (
                <group position={[0, 0, -0.02]}>
                    {/* Bezel frame around display */}
                    <mesh castShadow receiveShadow>
                        <boxGeometry args={[chassisW, chassisH, 0.02]} />
                        <meshStandardMaterial
                            color={chassisHex}
                            metalness={0.92}
                            roughness={0.24}
                            envMapIntensity={1.3}
                        />
                    </mesh>
                    {/* Stand column */}
                    <mesh position={[0, -meshH * 0.45, -0.06]} rotation={[0.08, 0, 0]} castShadow>
                        <boxGeometry args={[meshW * 0.12, meshH * 0.48, 0.025]} />
                        <meshStandardMaterial
                            color={device?.color === 'silver' ? '#e2e8f0' : '#27272a'}
                            metalness={0.95}
                            roughness={0.2}
                        />
                    </mesh>
                    {/* Stand base plate foot */}
                    <mesh position={[0, -meshH * 0.68, 0.04]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
                        <boxGeometry args={[meshW * 0.36, meshH * 0.28, 0.015]} />
                        <meshStandardMaterial
                            color={device?.color === 'silver' ? '#e2e8f0' : '#27272a'}
                            metalness={0.95}
                            roughness={0.2}
                        />
                    </mesh>
                </group>
            )}

            {/* 3. SCREEN / LAYER SURFACE WITH NORMALIZED ROUNDED UVs */}
            <mesh
                position={[0, 0, 0.016]}
                geometry={
                    (layer.kind === 'image' || layer.kind === 'video') ? normalizedScreenGeometry : undefined
                }
                castShadow={receivesLight && (layer.kind === 'image' || layer.kind === 'video')}
                receiveShadow={receivesLight}
            >
                {(layer.kind !== 'image' && layer.kind !== 'video') && <planeGeometry args={[meshW, meshH]} />}
                {receivesLight ? (
                    <meshStandardMaterial
                        map={texture || undefined}
                        color="#ffffff"
                        transparent={true}
                        opacity={renderOpacity}
                        roughness={surfaceRoughness}
                        metalness={surfaceMetalness}
                        side={THREE.DoubleSide}
                        depthWrite={layer.kind === 'image' || layer.kind === 'video'}
                        depthTest={true}
                    />
                ) : (
                    <meshBasicMaterial
                        map={texture || undefined}
                        color="#ffffff"
                        transparent={true}
                        opacity={renderOpacity}
                        side={THREE.DoubleSide}
                        depthWrite={layer.kind === 'image' || layer.kind === 'video'}
                        depthTest={true}
                    />
                )}
            </mesh>

            {/* 4. GLASS SCREEN GLOSS & SPECULAR SHEEN OVERLAY (Devices) */}
            {isDeviceScreen && (
                <mesh position={[0, 0, 0.0175]} geometry={normalizedScreenGeometry}>
                    <meshPhysicalMaterial
                        color="#ffffff"
                        transparent={true}
                        opacity={Math.min(0.28, 0.06 + (device?.gloss ?? 0.5) * 0.2)}
                        roughness={Math.max(0.04, 0.16 - (device?.gloss ?? 0.5) * 0.12)}
                        metalness={0.08}
                        transmission={0.9}
                        ior={1.5}
                        reflectivity={device?.glare ?? 1.0}
                        envMapIntensity={1.6 * (device?.glare ?? 1.0)}
                        depthWrite={false}
                    />
                </mesh>
            )}

            {/* 5. DYNAMIC ISLAND NOTCH (iPhone only) */}
            {isPhone && (
                <group position={[0, meshH * 0.42, 0.019]}>
                    <mesh rotation={[0, 0, Math.PI / 2]}>
                        <capsuleGeometry args={[meshW * 0.029, meshW * 0.154, 8, 16]} />
                        <meshBasicMaterial color="#050508" />
                    </mesh>
                    <mesh rotation={[0, 0, Math.PI / 2]} position={[0, 0, 0.0005]}>
                        <capsuleGeometry args={[meshW * 0.026, meshW * 0.148, 8, 16]} />
                        <meshBasicMaterial color="#000000" />
                    </mesh>
                    <mesh position={[meshW * 0.048, 0, 0.001]}>
                        <circleGeometry args={[meshW * 0.012, 16]} />
                        <meshBasicMaterial color="#0a1220" />
                    </mesh>
                </group>
            )}

            {/* 5b. PUNCH HOLE CAMERA (Samsung Galaxy) */}
            {isSamsung && (
                <group position={[0, meshH * 0.44, 0.019]}>
                    <mesh>
                        <circleGeometry args={[meshW * 0.018, 32]} />
                        <meshBasicMaterial color="#050508" />
                    </mesh>
                    <mesh position={[0, 0, 0.0005]}>
                        <circleGeometry args={[meshW * 0.009, 32]} />
                        <meshBasicMaterial color="#0a1220" />
                    </mesh>
                </group>
            )}

            {/* 6. SOFT CONTACT GROUND SHADOW (Devices) */}
            {device && (
                <group
                    position={[
                        0,
                        -chassisH * (device.type === 'macbook' ? 0.38 : 0.53),
                        -0.05 - (device.staging === 'floating' ? 0.04 : 0)
                    ]}
                    rotation={[-Math.PI / 2, 0, 0]}
                >
                    <mesh>
                        <planeGeometry args={[chassisW * 1.5, chassisW * 0.85]} />
                        <meshBasicMaterial
                            map={contactShadowTexture}
                            transparent={true}
                            opacity={
                                device.staging === 'floating'
                                    ? 0.22
                                    : device.staging === 'held'
                                        ? 0.35
                                        : 0.65
                            }
                            depthWrite={false}
                        />
                    </mesh>
                </group>
            )}
        </group>
    );
};
