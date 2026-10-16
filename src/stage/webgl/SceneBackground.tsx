// src/stage/webgl/SceneBackground.tsx
import React, { useMemo, useEffect, useState } from 'react';
import * as THREE from 'three';
import type { Background } from '../../model/types';
import { useProjectStore } from '../../store/useProjectStore';
import { calculateCoverCrop, hexToRgba } from '../../engine/canvasRenderer';
import { ASPECT_RATIO_CONFIG } from '../stageUtils';

interface SceneBackgroundProps {
    background: Background;
    cameraDistance?: number;
}

export const SceneBackground: React.FC<SceneBackgroundProps> = ({
    background,
    cameraDistance = 45,
}) => {
    const project = useProjectStore((s) => s.project);
    const assets = project.assets;
    const [imageTexture, setImageTexture] = useState<THREE.Texture | null>(null);
    const texRef = React.useRef<THREE.Texture | null>(null);

    const spec = ASPECT_RATIO_CONFIG[project.aspectRatio] ?? { widthRatio: 16, heightRatio: 9 };
    const targetAspect = spec.widthRatio / spec.heightRatio;

    // Load image background texture when kind === 'image'
    useEffect(() => {
        if (background.kind !== 'image' || !background.assetId) {
            texRef.current = null;
            setImageTexture(null);
            return;
        }
        const asset = assets[background.assetId];
        if (!asset?.dataUrl) {
            texRef.current = null;
            setImageTexture(null);
            return;
        }
        const loader = new THREE.TextureLoader();
        let cancelled = false;
        loader.load(
            asset.dataUrl,
            (tex) => {
                if (cancelled) {
                    tex.dispose();
                    return;
                }
                tex.colorSpace = THREE.SRGBColorSpace;
                tex.minFilter = THREE.LinearFilter;
                tex.magFilter = THREE.LinearFilter;
                const img = tex.image as HTMLImageElement | undefined;
                if (img && img.width && img.height) {
                    const crop = calculateCoverCrop(img.width, img.height, targetAspect);
                    tex.repeat.set(crop.uRepeat, crop.vRepeat);
                    tex.offset.set(crop.uOffset, crop.vOffset);
                }
                texRef.current = tex;
                setImageTexture(tex);
            },
            undefined,
            () => {
                if (!cancelled) {
                    texRef.current = null;
                    setImageTexture(null);
                }
            }
        );
        return () => {
            cancelled = true;
        };
    }, [background, assets, targetAspect]);

    // Keep crop UVs in sync if targetAspect or texture changes
    useEffect(() => {
        const tex = texRef.current;
        if (!tex || tex !== imageTexture) return;
        const img = tex.image as HTMLImageElement | undefined;
        if (img && img.width && img.height) {
            const crop = calculateCoverCrop(img.width, img.height, targetAspect);
            tex.repeat.set(crop.uRepeat, crop.vRepeat);
            tex.offset.set(crop.uOffset, crop.vOffset);
            tex.needsUpdate = true;
        }
    }, [imageTexture, targetAspect]);

    // Dispose imageTexture when it changes or on unmount
    useEffect(() => {
        return () => {
            texRef.current = null;
            imageTexture?.dispose();
        };
    }, [imageTexture]);

    // Generate solid / gradient canvas texture
    const canvasTexture = useMemo(() => {
        if (background.kind === 'image') return null;

        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        if (background.kind === 'solid') {
            ctx.fillStyle = background.color || '#070913';
            ctx.fillRect(0, 0, 512, 512);
        } else if (background.kind === 'gradient') {
            const isRadial = background.gradientType === 'radial';
            const cx = 256;
            const cy = 256;
            const len = 256;
            let grad: CanvasGradient;

            if (isRadial) {
                grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, len);
            } else {
                const angleRad = (((background.angle ?? 90) - 90) * Math.PI) / 180;
                const x0 = cx - Math.cos(angleRad) * len;
                const y0 = cy - Math.sin(angleRad) * len;
                const x1 = cx + Math.cos(angleRad) * len;
                const y1 = cy + Math.sin(angleRad) * len;
                grad = ctx.createLinearGradient(x0, y0, x1, y1);
            }

            if (background.stops && background.stops.length > 0) {
                background.stops.forEach((st) => {
                    const pos = Math.max(
                        0,
                        Math.min(1, 'at' in st ? (st as any).at : (st as any).position)
                    );
                    const color = hexToRgba(st.color, st.opacity ?? 1);
                    grad.addColorStop(pos, color);
                });
            } else {
                grad.addColorStop(0, '#070913');
                grad.addColorStop(1, '#1b1e2e');
            }
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 512, 512);
        } else {
            ctx.fillStyle = '#070913';
            ctx.fillRect(0, 0, 512, 512);
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        return texture;
    }, [background]);

    // Dispose canvas texture on change
    useEffect(() => {
        return () => {
            canvasTexture?.dispose();
        };
    }, [canvasTexture]);

    const map = background.kind === 'image' ? imageTexture : canvasTexture;
    const planeHeight = 120;
    const planeWidth = planeHeight * targetAspect;

    return (
        <mesh position={[0, 0, -cameraDistance]}>
            <planeGeometry args={[planeWidth, planeHeight]} />
            <meshBasicMaterial
                map={map ?? undefined}
                color={map ? undefined : '#070913'}
                depthWrite={false}
                toneMapped={false}
            />
        </mesh>
    );
};
