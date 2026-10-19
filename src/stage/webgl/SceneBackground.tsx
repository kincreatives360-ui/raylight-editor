/* eslint-disable react-hooks/immutability */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useThree, useFrame } from '@react-three/fiber';
import type {
  Project,
  Shot,
  Background,
  AssetRecord,
  AspectRatio,
} from '../../model/types';
import { resolveShotBackground } from '../../model/types';
import type { EvaluatedProjectFrame } from '../../engine/evaluateShot';
import { usePlayheadStore } from '../../store/usePlayheadStore';
import {
  BACKGROUND_VERTEX_SHADER,
  SHADER_PRESET_FRAGMENTS,
  IMAGE_VERTEX_SHADER,
  IMAGE_FRAGMENT_SHADER,
} from './shaders/backgroundShaders';
import {
  DEFAULT_SHADER_CONFIGS,
  getShaderColors,
  type ShaderPreset,
} from '../../model/backgroundPresets';
import { createCanvasFillStyle } from '../../engine/canvasRenderer';
import {
  DEFAULT_CAMERA_Z,
  DEFAULT_FOCAL_LENGTH,
  focalLengthToFov,
} from './cameraMath';

export interface SceneBackgroundProps {
  project?: Project;
  activeShot?: Shot;
  shot?: Shot;
  frame?: EvaluatedProjectFrame;
  background?: Background;
  assets?: Record<string, AssetRecord>;
  aspectRatio?: AspectRatio;
}

const NOISE_FRAGMENT_SHADER = `
  precision highp float;
  uniform vec3 uBase;
  uniform float uIntensity;
  uniform float uTime;
  varying vec2 vUv;

  float hash21(vec2 p) {
    p = fract(p * vec2(0.3183099, 0.3678794)) + 0.1;
    p += dot(p, p + 19.19);
    return fract(p.x * p.y);
  }

  void main() {
    vec2 seed = vUv * 600.0 + fract(uTime * 0.01) * 73.1;
    float grain = (hash21(seed) - 0.5) * uIntensity;
    vec3 col = clamp(uBase + grain, 0.0, 1.0);
    gl_FragColor = vec4(col, 1.0);
  }
`;

const SOLID_FRAGMENT_SHADER = `
  precision highp float;
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    gl_FragColor = vec4(uColor, uOpacity);
  }
`;

const CANVAS_TEX_FRAGMENT_SHADER = `
  precision highp float;
  uniform sampler2D uTexture;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    vec4 tex = texture2D(uTexture, vUv);
    gl_FragColor = vec4(tex.rgb, tex.a * uOpacity);
  }
`;

// Helper to render gradient to an offscreen canvas
function createGradientTexture(bg: Extract<Background, { kind: 'gradient' }>): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = createCanvasFillStyle(ctx, bg, 1024, 1024, 1);
    ctx.fillRect(0, 0, 1024, 1024);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

interface SingleBackgroundBillboardProps {
  bg: Background;
  opacity?: number;
  slideX?: number;
  assets?: Record<string, AssetRecord>;
}

const SingleBackgroundBillboard: React.FC<SingleBackgroundBillboardProps> = ({
  bg,
  opacity = 1,
  slideX = 0,
  assets = {},
}) => {
  const { camera, invalidate } = useThree();
  const meshRef = useRef<THREE.Mesh>(null);
  const shaderMatRef = useRef<THREE.ShaderMaterial>(null);

  // Preload texture for image background
  const [loadedTextureInfo, setLoadedTextureInfo] = useState<{ url: string; texture: THREE.Texture } | null>(null);
  const dataUrl = bg.kind === 'image' ? (bg.src || (bg.assetId ? assets[bg.assetId]?.dataUrl : undefined)) : undefined;
  const imageTexture = bg.kind === 'image' && dataUrl && loadedTextureInfo?.url === dataUrl ? loadedTextureInfo.texture : null;

  useEffect(() => {
    if (!dataUrl) return;

    let active = true;
    const loader = new THREE.TextureLoader();
    loader.load(
      dataUrl,
      (tex) => {
        if (!active) {
          tex.dispose();
          return;
        }
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.generateMipmaps = true;
        setLoadedTextureInfo({ url: dataUrl, texture: tex });
      },
      undefined,
      () => {
        if (active) setLoadedTextureInfo(null);
      }
    );

    return () => {
      active = false;
    };
  }, [dataUrl]);

  // Pre-generate gradient texture if gradient
  const gradientTexture = useMemo(() => {
    if (bg.kind === 'gradient') {
      return createGradientTexture(bg);
    }
    return null;
  }, [bg]);

  useEffect(() => {
    return () => {
      gradientTexture?.dispose();
    };
  }, [gradientTexture]);

  // Uniforms definition
  const uniforms = useMemo(() => {
    if (bg.kind === 'shader') {
      const preset = bg.preset as ShaderPreset;
      const cfg = DEFAULT_SHADER_CONFIGS[preset] || DEFAULT_SHADER_CONFIGS.silk;
      const palette = getShaderColors(preset, bg.colors, bg.color, bg.backgroundColor);
      const colorObjects = Array.from({ length: 5 }, (_, i) => new THREE.Color(palette[i] || '#000000'));
      return {
        uTime: { value: 0 },
        uAspect: { value: 1 },
        uColor: { value: new THREE.Color(bg.color || cfg.color) },
        uBase: { value: new THREE.Color(bg.backgroundColor || cfg.backgroundColor) },
        uColors: { value: colorObjects },
        uColorCount: { value: palette.length },
        uWaves: { value: bg.waves ?? cfg.waves },
        uFocus: { value: bg.focus ?? cfg.focus },
        uGlow: { value: bg.glow ?? cfg.glow },
        uShine: { value: bg.shine ?? cfg.shine },
        uAngle: { value: bg.angle ?? cfg.angle },
      };
    }
    if (bg.kind === 'image') {
      return {
        uMap: { value: null as THREE.Texture | null },
        uRepeat: { value: new THREE.Vector2(1, 1) },
        uOffset: { value: new THREE.Vector2(0, 0) },
        uColor: { value: new THREE.Color(bg.color || '#000000') },
        uDim: { value: bg.dim ?? 0 },
        uBlur: { value: (bg.blur ?? 0) / 100 },
      };
    }
    if (bg.kind === 'noise') {
      return {
        uBase: { value: new THREE.Color(bg.baseColor || '#0a0a0c') },
        uIntensity: { value: bg.intensity ?? 0.2 },
        uTime: { value: 0 },
      };
    }
    if (bg.kind === 'solid') {
      return {
        uColor: { value: new THREE.Color(bg.color || '#000000') },
        uOpacity: { value: (bg.opacity ?? 1) * opacity },
      };
    }
    if (bg.kind === 'gradient') {
      return {
        uTexture: { value: gradientTexture },
        uOpacity: { value: opacity },
      };
    }
    return {};
  }, [bg, opacity, gradientTexture]);

  // Keep uniforms updated
  useEffect(() => {
    if (!uniforms) return;
    if (bg.kind === 'shader') {
      const palette = getShaderColors(bg.preset, bg.colors, bg.color, bg.backgroundColor);
      uniforms.uColor?.value.set(bg.color);
      uniforms.uBase?.value.set(bg.backgroundColor);
      if (uniforms.uWaves) uniforms.uWaves.value = bg.waves;
      if (uniforms.uFocus) uniforms.uFocus.value = bg.focus;
      if (uniforms.uGlow) uniforms.uGlow.value = bg.glow;
      if (uniforms.uShine) uniforms.uShine.value = bg.shine;
      if (uniforms.uAngle) uniforms.uAngle.value = bg.angle;
      if (uniforms.uColorCount) uniforms.uColorCount.value = palette.length;
      if (uniforms.uColors) {
        palette.forEach((c, idx) => {
          if (uniforms.uColors.value[idx]) {
            uniforms.uColors.value[idx].set(c);
          }
        });
      }
    } else if (bg.kind === 'image') {
      if (uniforms.uMap) uniforms.uMap.value = imageTexture;
      if (uniforms.uColor) uniforms.uColor.value.set(bg.color || '#000000');
      if (uniforms.uDim) uniforms.uDim.value = bg.dim ?? 0;
      if (uniforms.uBlur) uniforms.uBlur.value = (bg.blur ?? 0) / 100;
    } else if (bg.kind === 'noise') {
      if (uniforms.uBase) uniforms.uBase.value.set(bg.baseColor || '#0a0a0c');
      if (uniforms.uIntensity) uniforms.uIntensity.value = bg.intensity ?? 0.2;
    } else if (bg.kind === 'solid') {
      if (uniforms.uColor) uniforms.uColor.value.set(bg.color || '#000000');
      if (uniforms.uOpacity) uniforms.uOpacity.value = (bg.opacity ?? 1) * opacity;
    } else if (bg.kind === 'gradient') {
      if (uniforms.uTexture) uniforms.uTexture.value = gradientTexture;
      if (uniforms.uOpacity) uniforms.uOpacity.value = opacity;
    }
    invalidate();
  }, [bg, opacity, imageTexture, gradientTexture, uniforms, invalidate]);

  // Scene-space background layer transforms with the scene container
  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh || !camera) return;

    const pCam = camera as THREE.PerspectiveCamera;
    const aspect = pCam.aspect || (16 / 9);
    const distance = DEFAULT_CAMERA_Z + 0.05;
    const fovRad = ((pCam.fov ?? focalLengthToFov(DEFAULT_FOCAL_LENGTH)) * Math.PI) / 180;
    const planeH = 2 * distance * Math.tan(fovRad / 2);
    const planeW = planeH * aspect;

    const offset = new THREE.Vector3(slideX * planeW, 0, -distance);
    offset.applyQuaternion(pCam.quaternion);
    mesh.position.copy(pCam.position).add(offset);
    mesh.quaternion.copy(pCam.quaternion);
    mesh.scale.set(planeW, planeH, 1);

    const currentTimeMs = usePlayheadStore.getState().currentTimeMs;

    if (bg.kind === 'shader') {
      if (uniforms.uTime) {
        uniforms.uTime.value = (currentTimeMs / 1000) * (bg.speed ?? 1);
      }
      if (uniforms.uAspect) {
        uniforms.uAspect.value = aspect;
      }
    } else if (bg.kind === 'noise') {
      if (uniforms.uTime) {
        uniforms.uTime.value = currentTimeMs / 1000;
      }
    } else if (bg.kind === 'image' && imageTexture?.image) {
      const img = imageTexture.image as { width?: number; height?: number };
      const imgAspect = img.width && img.height ? img.width / img.height : 1;
      const camAspect = pCam.aspect;
      const rep = uniforms.uRepeat?.value;
      const off = uniforms.uOffset?.value;
      if (rep && off) {
        if (bg.fit === 'contain') {
          if (imgAspect > camAspect) {
            rep.set(1, imgAspect / camAspect);
          } else {
            rep.set(camAspect / imgAspect, 1);
          }
        } else {
          // cover
          if (imgAspect > camAspect) {
            rep.set(camAspect / imgAspect, 1);
          } else {
            rep.set(1, imgAspect / camAspect);
          }
        }
        off.set((1 - rep.x) / 2, (1 - rep.y) / 2);
      }
    }
  });

  if (bg.kind === 'transparent') {
    return null;
  }

  // Choose appropriate fragment shader
  let fragShader = SOLID_FRAGMENT_SHADER;
  let vertShader = BACKGROUND_VERTEX_SHADER;

  if (bg.kind === 'shader') {
    fragShader = SHADER_PRESET_FRAGMENTS[bg.preset] || SHADER_PRESET_FRAGMENTS.silk;
    vertShader = BACKGROUND_VERTEX_SHADER;
  } else if (bg.kind === 'image') {
    fragShader = IMAGE_FRAGMENT_SHADER;
    vertShader = IMAGE_VERTEX_SHADER;
  } else if (bg.kind === 'noise') {
    fragShader = NOISE_FRAGMENT_SHADER;
    vertShader = BACKGROUND_VERTEX_SHADER;
  } else if (bg.kind === 'gradient') {
    fragShader = CANVAS_TEX_FRAGMENT_SHADER;
    vertShader = BACKGROUND_VERTEX_SHADER;
  }

  return (
    <mesh
      ref={meshRef}
      renderOrder={-1000}
      frustumCulled={false}
      userData={{ raylightFrameBillboard: true }}
    >
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={shaderMatRef}
        key={bg.kind === 'shader' ? bg.preset : bg.kind}
        vertexShader={vertShader}
        fragmentShader={fragShader}
        uniforms={uniforms as Record<string, THREE.IUniform>}
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
        transparent={opacity < 1 || bg.kind === 'solid' || bg.kind === 'gradient'}
      />
    </mesh>
  );
};

export const SceneBackground: React.FC<SceneBackgroundProps> = ({
  project,
  activeShot,
  shot,
  frame,
  background,
  assets,
}) => {
  const { scene, invalidate } = useThree();
  const targetShot = activeShot ?? shot ?? frame?.activeShot ?? project?.shots[0];

  const incomingBg: Background = useMemo(() => {
    if (background) return background;
    if (project && targetShot) {
      return resolveShotBackground(project, targetShot);
    }
    return project?.background ?? { kind: 'solid', color: '#0c0e17' };
  }, [background, project, targetShot]);

  const outgoingBg: Background | null = useMemo(() => {
    if (!frame?.shotTransition?.isTransitioning || !frame.shotTransition.outgoingFrame || !project) {
      return null;
    }
    return resolveShotBackground(project, frame.shotTransition.outgoingFrame.activeShot);
  }, [frame, project]);

  const isTransitioning = Boolean(
    outgoingBg &&
    frame?.shotTransition?.progress !== undefined &&
    frame.shotTransition.progress < 1
  );
  const transProgress = frame?.shotTransition?.progress ?? 0;
  const transType = frame?.shotTransition?.type ?? 'crossfade';

  const effectiveAssets = assets ?? project?.assets ?? {};

  // Keep scene.background null so all backgrounds render as scene meshes that transform with the camera
  useEffect(() => {
    scene.background = null;
    invalidate();
    return () => {
      scene.background = null;
      invalidate();
    };
  }, [scene, invalidate]);

  let inOpacity = 1;
  let inSlideX = 0;
  let outOpacity = 0;
  let outSlideX = 0;

  if (isTransitioning && outgoingBg) {
    if (transType === 'crossfade') {
      outOpacity = 1 - transProgress;
      inOpacity = transProgress;
    } else if (transType === 'push') {
      outSlideX = -transProgress;
      inSlideX = 1 - transProgress;
      outOpacity = 1;
      inOpacity = 1;
    } else if (transType === 'slide') {
      outSlideX = -transProgress * 0.25;
      inSlideX = 1 - transProgress;
      outOpacity = 1;
      inOpacity = 1;
    }
  }

  return (
    <>
      {isTransitioning && outgoingBg && outOpacity > 0 && (
        <SingleBackgroundBillboard
          bg={outgoingBg}
          opacity={outOpacity}
          slideX={outSlideX}
          assets={effectiveAssets}
        />
      )}
      <SingleBackgroundBillboard
        bg={incomingBg}
        opacity={inOpacity}
        slideX={inSlideX}
        assets={effectiveAssets}
      />
    </>
  );
};