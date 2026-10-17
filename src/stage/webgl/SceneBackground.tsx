// src/stage/webgl/SceneBackground.tsx
import React, { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import type {
  Project,
  Shot,
  Background,
  AssetRecord,
  AspectRatio,
} from '../../model/types';
import { resolveShotBackground } from '../../model/types';
import type { EvaluatedProjectFrame } from '../../engine/evaluateShot';
import {
  calculateCoverCrop,
  createCanvasFillStyle,
} from '../../engine/canvasRenderer';
import { ASPECT_RATIO_CONFIG } from '../stageUtils';

export interface SceneBackgroundProps {
  project?: Project;
  activeShot?: Shot;
  shot?: Shot;
  frame?: EvaluatedProjectFrame;
  background?: Background;
  assets?: Record<string, AssetRecord>;
  aspectRatio?: AspectRatio;
}

export const SceneBackground: React.FC<SceneBackgroundProps> = ({
  project,
  activeShot,
  shot,
  frame,
  background,
  assets,
  aspectRatio,
}) => {
  const targetShot =
    activeShot ?? shot ?? frame?.activeShot ?? project?.shots[0];

  const effectiveBg: Background = useMemo(() => {
    if (background) return background;
    if (project && targetShot) {
      return resolveShotBackground(project, targetShot);
    }
    return project?.background ?? { kind: 'solid', color: '#0a0a0c' };
  }, [background, project, targetShot]);

  const effectiveAssets = assets ?? project?.assets ?? {};
  const effectiveAspect = aspectRatio ?? project?.aspectRatio ?? '16:9';
  const ratioSpec = ASPECT_RATIO_CONFIG[effectiveAspect] ?? {
    widthRatio: 16,
    heightRatio: 9,
  };
  const targetAspect = ratioSpec.widthRatio / Math.max(1, ratioSpec.heightRatio);

  const imageDataUrl =
    effectiveBg.kind === 'image' && effectiveBg.assetId
      ? effectiveAssets[effectiveBg.assetId]?.dataUrl
      : undefined;

  const [loadedImage, setLoadedImage] = useState<{
    url: string;
    img: HTMLImageElement;
  } | null>(null);

  useEffect(() => {
    if (!imageDataUrl) return;
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (!cancelled) {
        setLoadedImage({ url: imageDataUrl, img });
      }
    };
    img.src = imageDataUrl;
    return () => {
      cancelled = true;
    };
  }, [imageDataUrl]);

  const activeHtmlImage =
    imageDataUrl && loadedImage?.url === imageDataUrl ? loadedImage.img : null;

  // Build an unlit, sRGB-accurate CanvasTexture for gradient or image backgrounds
  const bgTexture = useMemo(() => {
    if (effectiveBg.kind === 'solid') return null;

    const canvas = document.createElement('canvas');
    const cw = 1024;
    const ch = Math.max(256, Math.round(cw / targetAspect));
    canvas.width = cw;
    canvas.height = ch;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    if (effectiveBg.kind === 'gradient') {
      ctx.fillStyle = createCanvasFillStyle(ctx, effectiveBg, cw, ch, 1);
      ctx.fillRect(0, 0, cw, ch);
    } else if (effectiveBg.kind === 'image') {
      if (activeHtmlImage) {
        const imgW = activeHtmlImage.naturalWidth || activeHtmlImage.width || cw;
        const imgH = activeHtmlImage.naturalHeight || activeHtmlImage.height || ch;
        const crop = calculateCoverCrop(imgW, imgH, targetAspect);
        ctx.drawImage(
          activeHtmlImage,
          crop.sx,
          crop.sy,
          crop.sw,
          crop.sh,
          0,
          0,
          cw,
          ch
        );
      } else {
        ctx.fillStyle = '#0a0a0c';
        ctx.fillRect(0, 0, cw, ch);
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }, [effectiveBg, activeHtmlImage, targetAspect]);

  useEffect(() => {
    return () => {
      bgTexture?.dispose();
    };
  }, [bgTexture]);

  const bgColor =
    effectiveBg.kind === 'solid' ? effectiveBg.color : '#07080d';

  const planeHeight = 120;
  const planeWidth = planeHeight * targetAspect;

  return (
    <>
      <color attach="background" args={[bgColor]} />
      <mesh position={[0, 0, -45]} renderOrder={-100}>
        <planeGeometry args={[planeWidth, planeHeight]} />
        <meshBasicMaterial
          map={effectiveBg.kind !== 'solid' ? bgTexture : null}
          color={effectiveBg.kind === 'solid' ? effectiveBg.color : '#ffffff'}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
    </>
  );
};

export default SceneBackground;