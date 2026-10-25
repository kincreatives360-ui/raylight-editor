import { useMemo } from 'react';
import * as THREE from 'three';
import { SCREEN_PLANE_Z, type DeviceFrameMetrics } from '../../model/deviceFrame';
import type { DeviceFrameSettings } from '../../model/types';
import {
  createBodyGeometry,
  createScreenGeometry,
  roundedRect,
} from './phoneGeometry';
import { useDisposable } from './useDisposable';
import { createReflectionTexture, createShadowTexture } from './deviceTextures';

export function BrowserFrame({
  metrics,
  settings,
  rotation,
}: {
  metrics: DeviceFrameMetrics;
  settings: DeviceFrameSettings;
  rotation?: { x: number; y: number; z: number };
}) {
  const facingCamera = Math.max(0, Math.cos(rotation?.x ?? 0) * Math.cos(rotation?.y ?? 0));
  const effectiveShadowOpacity = Math.max(0, Math.min(1, settings.shadowOpacity * facingCamera));
  const depth = Math.max(0.003, metrics.bodyDepth * 0.4);

  const reflectionTexture = useMemo(
    () => createReflectionTexture(settings.gloss, settings.reflection, settings.glassTint),
    [settings.gloss, settings.reflection, settings.glassTint]
  );
  const shadowTexture = useMemo(() => createShadowTexture(), []);

  const titlebarHeight = Math.max(0.02, metrics.bodyHeight * 0.09);

  const shellMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: settings.frameColor,
        metalness: Math.min(0.4, settings.frameMetalness),
        roughness: Math.max(0.3, settings.frameRoughness),
        clearcoat: 0.3,
      }),
    [settings.frameColor, settings.frameMetalness, settings.frameRoughness]
  );

  const titlebarMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#18181b',
        roughness: 0.5,
        metalness: 0.2,
      }),
    []
  );

  const urlBarMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#27272a',
      }),
    []
  );

  const redDotMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ff5f56' }), []);
  const yellowDotMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffbd2e' }), []);
  const greenDotMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: '#27c93f' }), []);

  const screenGlassMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: settings.glassTint,
        transparent: true,
        opacity: settings.glassOpacity * 0.5,
        roughness: settings.glassRoughness,
        metalness: 0,
        clearcoat: 0.8,
        depthWrite: false,
      }),
    [settings.glassTint, settings.glassOpacity, settings.glassRoughness]
  );

  const reflectionMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: reflectionTexture,
        transparent: true,
        opacity: settings.reflection * 0.5,
        depthWrite: false,
      }),
    [reflectionTexture, settings.reflection]
  );

  const shadowMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: shadowTexture,
        transparent: true,
        opacity: effectiveShadowOpacity,
        depthWrite: false,
        side: THREE.FrontSide,
      }),
    [shadowTexture, effectiveShadowOpacity]
  );

  // Geometries
  const bodyGeometry = useMemo(
    () =>
      createBodyGeometry(
        metrics.bodyWidth,
        metrics.bodyHeight + titlebarHeight,
        metrics.bodyCornerRadius,
        depth,
        true
      ),
    [metrics.bodyWidth, metrics.bodyHeight, titlebarHeight, metrics.bodyCornerRadius, depth]
  );

  const screenGeometry = useMemo(
    () => createScreenGeometry(metrics.screenWidth, metrics.screenHeight, 0),
    [metrics.screenWidth, metrics.screenHeight]
  );

  const dotRadius = Math.max(0.0025, titlebarHeight * 0.16);
  const dotGeometry = useMemo(() => new THREE.CircleGeometry(dotRadius, 48), [dotRadius]);

  const urlBarWidth = metrics.bodyWidth * 0.42;
  const urlBarHeight = titlebarHeight * 0.52;
  const urlBarGeometry = useMemo(
    () => new THREE.ShapeGeometry(roundedRect(urlBarWidth, urlBarHeight, urlBarHeight * 0.35), 48),
    [urlBarWidth, urlBarHeight]
  );

  const shadowGeometry = useMemo(() => new THREE.CircleGeometry(1, 48), []);

  useDisposable(bodyGeometry);
  useDisposable(screenGeometry);
  useDisposable(dotGeometry);
  useDisposable(urlBarGeometry);
  useDisposable(shadowGeometry);
  useDisposable(reflectionTexture);
  useDisposable(shadowTexture);
  useDisposable(shellMaterial);
  useDisposable(titlebarMaterial);
  useDisposable(urlBarMaterial);
  useDisposable(redDotMaterial);
  useDisposable(yellowDotMaterial);
  useDisposable(greenDotMaterial);
  useDisposable(screenGlassMaterial);
  useDisposable(reflectionMaterial);
  useDisposable(shadowMaterial);

  const titlebarCenterY = metrics.screenHeight / 2 + titlebarHeight / 2;
  const dotSpacing = dotRadius * 2.8;
  const dotStartX = -metrics.bodyWidth / 2 + titlebarHeight * 0.65;

  return (
    <group name="browser-window-frame">
      {/* Contact Studio Shadow */}
      {settings.shadowEnabled && effectiveShadowOpacity > 0.001 && (
        <mesh
          name="browser-window-shadow"
          geometry={shadowGeometry}
          material={shadowMaterial}
          position={[0, -metrics.bodyHeight * settings.shadowOffset, -depth * 0.8]}
          scale={[
            metrics.bodyWidth * (1.14 + settings.shadowBlur * 0.45),
            (metrics.bodyHeight + titlebarHeight) * (0.35 + settings.shadowBlur * 0.16),
            1,
          ]}
          renderOrder={-2}
        />
      )}

      {/* Window Chassis Backing */}
      <mesh
        name="browser-chassis-shell"
        geometry={bodyGeometry}
        material={shellMaterial}
        position={[0, titlebarHeight / 2, SCREEN_PLANE_Z - depth]}
        castShadow
        receiveShadow
      />

      {/* Screen Glass & Reflection */}
      <mesh
        name="browser-screen-glass"
        geometry={screenGeometry}
        material={screenGlassMaterial}
        position={[0, 0, SCREEN_PLANE_Z + 0.0005]}
      />
      <mesh
        name="browser-screen-reflection"
        geometry={screenGeometry}
        material={reflectionMaterial}
        position={[0, 0, SCREEN_PLANE_Z + 0.001]}
      />

      {/* Titlebar Elements */}
      <group position={[0, titlebarCenterY, SCREEN_PLANE_Z + 0.0006]}>
        {/* macOS Traffic Lights */}
        <mesh
          geometry={dotGeometry}
          material={redDotMaterial}
          position={[dotStartX, 0, 0]}
        />
        <mesh
          geometry={dotGeometry}
          material={yellowDotMaterial}
          position={[dotStartX + dotSpacing, 0, 0]}
        />
        <mesh
          geometry={dotGeometry}
          material={greenDotMaterial}
          position={[dotStartX + dotSpacing * 2, 0, 0]}
        />

        {/* Centered URL Address Bar Capsule */}
        <mesh
          geometry={urlBarGeometry}
          material={urlBarMaterial}
          position={[0, 0, 0]}
        />
      </group>
    </group>
  );
}
