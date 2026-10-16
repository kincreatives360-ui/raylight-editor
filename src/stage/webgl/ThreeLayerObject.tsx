// src/stage/webgl/ThreeLayerObject.tsx
import React, { useMemo, useState, useEffect } from 'react';
import * as THREE from 'three';
import type { EvaluatedLayerWithEffects } from '../../engine/evaluateShot';
import type {
    Project,
    TextLayer,
    ShapeLayer,
    ImageLayer,
} from '../../model/types';
import { getLayer3DWorldTransform } from './cameraMath';

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

    const { worldX, worldY, worldZ, meshW, meshH } = getLayer3DWorldTransform(
        evalLayer,
        aspect,
        cameraZ,
        focalLength
    );

    const rot = evalLayer.rotation;
    const scale = evalLayer.scale ?? { x: 1, y: 1, z: 1 };
    const opacity = evalLayer.opacity ?? 1;
    const totalBlurPx = Math.round((evalLayer.totalBlurPx ?? 0) * 2) / 2;

    const device =
        layer.kind === 'image' ? (layer as ImageLayer).device : undefined;
    const isPhone = device?.type === 'iphone';
    const isIpad = device?.type === 'ipad';
    const isMacbook = device?.type === 'macbook';
    const isBrowser = device?.type === 'browser';

    const [loadedImg, setLoadedImg] = useState<HTMLImageElement | null>(null);

    const assetUrl = useMemo(() => {
        if (layer.kind !== 'image') return null;
        const imgL = layer as ImageLayer;
        const asset = project.assets[imgL.assetId];
        if (asset?.dataUrl) return asset.dataUrl;
        if (
            imgL.assetId?.startsWith('data:') ||
            imgL.assetId?.startsWith('http') ||
            imgL.assetId?.startsWith('blob:')
        ) {
            return imgL.assetId;
        }
        return null;
    }, [layer, project.assets]);

    useEffect(() => {
        if (!assetUrl) {
            setLoadedImg(null);
            return;
        }
        let active = true;
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            if (active) setLoadedImg(img);
        };
        img.onerror = () => {
            if (active) setLoadedImg(null);
        };
        img.src = assetUrl;
        return () => {
            active = false;
        };
    }, [assetUrl]);

    // Generate proportional CanvasTexture with Crop, Stroke, Shimmer & DoF Blur
    const texture = useMemo(() => {
        const layerAspect = Math.max(0.2, Math.min(5, meshW / Math.max(0.01, meshH)));
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

        if (layer.kind === 'image') {
            const imgL = layer as ImageLayer;
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

            if (loadedImg) {
                ctx.save();
                if (totalBlurPx > 0) {
                    ctx.filter = `blur(${Math.min(28, totalBlurPx * 1.5)}px)`;
                }
                const crop = imgL.crop || { x: 0, y: 0, width: 1, height: 1 };
                const sx = crop.x * loadedImg.naturalWidth;
                const sy = crop.y * loadedImg.naturalHeight;
                const sw = Math.max(1, crop.width * loadedImg.naturalWidth);
                const sh = Math.max(1, crop.height * loadedImg.naturalHeight);

                ctx.drawImage(
                    loadedImg,
                    sx,
                    sy,
                    sw,
                    sh,
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

            const rawContent = textL.content || 'Headline Title';
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
                const rad = (((shapeL.fill.angle ?? 135) - 90) * Math.PI) / 180;
                const cx = canvasW / 2;
                const cy = canvasH / 2;
                const len = Math.hypot(canvasW, canvasH) / 2;
                const grad = ctx.createLinearGradient(
                    cx - Math.cos(rad) * len,
                    cy - Math.sin(rad) * len,
                    cx + Math.cos(rad) * len,
                    cy + Math.sin(rad) * len
                );
                for (const st of shapeL.fill.stops || []) {
                    grad.addColorStop(Math.max(0, Math.min(1, st.at)), st.color);
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
                ctx.beginPath();
                points.forEach((pt, i) => {
                    const x = pt.x * canvasW;
                    const y = pt.y * canvasH;
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
        totalBlurPx,
        meshW,
        meshH,
        isBrowser,
        device?.color,
        evalLayer.shimmerProgress,
        evalLayer.size.height,
    ]);

    // Dispose texture on replace/unmount to prevent GPU memory leaks
    useEffect(() => {
        return () => {
            texture?.dispose();
        };
    }, [texture]);

    const cornerRadiusWorld = useMemo(() => {
        if (isPhone) return Math.min(meshW, meshH) * 0.14;
        if (isIpad) return Math.min(meshW, meshH) * 0.07;
        if (isMacbook || isBrowser) return Math.min(meshW, meshH) * 0.045;
        if (layer.kind !== 'text') {
            return (layer.cornerRadius ?? 0.03) * Math.min(meshW, meshH) * 0.5;
        }
        return 0.005;
    }, [isPhone, isIpad, isMacbook, isBrowser, layer, meshW, meshH]);

    const roundedShape = useMemo(
        () => createRoundedRectShape(meshW, meshH, cornerRadiusWorld),
        [meshW, meshH, cornerRadiusWorld]
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
            depth: 0.045,
            bevelEnabled: true,
            bevelSegments: 5,
            steps: 1,
            bevelSize: 0.014,
            bevelThickness: 0.014,
        }),
        []
    );

    if (!isSelected && (!evalLayer.visible || opacity <= 0.001)) return null;

    const renderOpacity = isSelected ? Math.max(0.65, opacity) : opacity;
    const chassisRoughness = Math.min(0.9, 0.25 + totalBlurPx * 0.02);

    return (
        <group
            position={[worldX, worldY, worldZ]}
            rotation={[-rot.x, rot.y, -rot.z]}
            scale={[scale.x, scale.y, scale.z || 1]}
            onPointerDown={(e) => {
                e.stopPropagation();
            }}
            onClick={(e) => {
                e.stopPropagation();
                onSelect(layer.id, e.shiftKey || e.metaKey || e.ctrlKey);
            }}
        >
            {/* 1. 3D IPHONE / IPAD CHASSIS */}
            {(isPhone || isIpad) && (
                <group position={[0, 0, -0.035]}>
                    <mesh castShadow receiveShadow>
                        <extrudeGeometry args={[roundedShape, phoneExtrudeSettings]} />
                        <meshStandardMaterial
                            color={device?.color === 'black' ? '#18181c' : '#2d3039'}
                            metalness={0.92}
                            roughness={chassisRoughness}
                            envMapIntensity={1.35}
                        />
                    </mesh>
                </group>
            )}

            {/* 2. 3D MACBOOK CHASSIS */}
            {isMacbook && (
                <group position={[0, -meshH * 0.48, -0.02]}>
                    <mesh
                        position={[0, 0, meshH * 0.4]}
                        rotation={[-Math.PI / 2, 0, 0]}
                        castShadow
                        receiveShadow
                    >
                        <boxGeometry args={[meshW * 1.08, meshH * 0.85, 0.022]} />
                        <meshStandardMaterial
                            color={device?.color === 'black' ? '#1f2026' : '#32353e'}
                            metalness={0.88}
                            roughness={0.3}
                        />
                    </mesh>
                </group>
            )}

            {/* 3. SCREEN / LAYER SURFACE WITH NORMALIZED ROUNDED UVs */}
            <mesh
                position={[0, 0, 0.016]}
                geometry={
                    layer.kind === 'image' ? normalizedScreenGeometry : undefined
                }
                castShadow={layer.kind === 'image'}
                receiveShadow={layer.kind === 'image'}
            >
                {layer.kind !== 'image' && <planeGeometry args={[meshW, meshH]} />}
                <meshStandardMaterial
                    map={texture || undefined}
                    color="#ffffff"
                    transparent={true}
                    opacity={renderOpacity}
                    roughness={layer.kind === 'image' ? 0.22 : 0.45}
                    metalness={layer.kind === 'image' ? 0.08 : 0.02}
                    side={THREE.DoubleSide}
                    depthWrite={layer.kind === 'image'}
                    depthTest={true}
                />
            </mesh>

            {/* 4. DYNAMIC ISLAND NOTCH (iPhone only) */}
            {isPhone && (
                <mesh
                    position={[0, meshH * 0.42, 0.019]}
                    rotation={[0, 0, Math.PI / 2]}
                >
                    <capsuleGeometry args={[meshW * 0.026, meshW * 0.15, 8, 16]} />
                    <meshBasicMaterial color="#000000" />
                </mesh>
            )}
        </group>
    );
};