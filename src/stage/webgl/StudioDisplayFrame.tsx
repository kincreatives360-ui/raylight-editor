import { useMemo } from 'react';
import * as THREE from 'three';
import { SCREEN_PLANE_Z, type DeviceFrameMetrics } from '../../model/deviceFrame';
import type { DeviceFrameSettings } from '../../model/types';
import {
  createAppleMarkGeometry,
  createBezelGeometry,
  createBodyGeometry,
  createScreenGeometry,
} from './phoneGeometry';
import { useDisposable } from './useDisposable';
import { createReflectionTexture, createShadowTexture } from './deviceTextures';

export function StudioDisplayFrame({
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
  const depth = Math.max(0.006, metrics.bodyDepth * 0.8);

  const reflectionTexture = useMemo(
    () => createReflectionTexture(settings.gloss, settings.reflection, settings.glassTint),
    [settings.gloss, settings.reflection, settings.glassTint]
  );
  const shadowTexture = useMemo(() => createShadowTexture(), []);

  const shellMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: settings.frameColor,
        metalness: settings.frameMetalness,
        roughness: settings.frameRoughness,
        clearcoat: 0.6,
        clearcoatRoughness: 0.2,
      }),
    [settings.frameColor, settings.frameMetalness, settings.frameRoughness]
  );

  const bezelMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#08080a',
      }),
    []
  );

  const screenGlassMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: settings.glassTint,
        transparent: true,
        opacity: settings.glassOpacity,
        roughness: settings.glassRoughness,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: settings.glassRoughness,
        depthWrite: false,
      }),
    [settings.glassTint, settings.glassOpacity, settings.glassRoughness]
  );

  const reflectionMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: reflectionTexture,
        transparent: true,
        opacity: settings.reflection * 0.75,
        depthWrite: false,
      }),
    [reflectionTexture, settings.reflection]
  );

  const cameraMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#15171c',
        metalness: 0.5,
        roughness: 0.2,
        clearcoat: 1,
      }),
    []
  );

  const appleMarkMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: settings.frameColor,
        metalness: 0.95,
        roughness: 0.1,
        clearcoat: 1,
      }),
    [settings.frameColor]
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

  // Stand dimensions
  const standArmW = metrics.bodyWidth * 0.08;
  const standArmH = metrics.bodyHeight * 0.42;
  const standArmDepth = depth * 0.8;
  const footW = metrics.bodyWidth * 0.32;
  const footH = metrics.bodyWidth * 0.26;
  const footDepth = depth * 0.35;
  const standBottomY = -metrics.bodyHeight / 2 - standArmH * 0.65;

  // Geometries
  const bodyGeometry = useMemo(
    () =>
      createBodyGeometry(
        metrics.bodyWidth,
        metrics.bodyHeight,
        metrics.bodyCornerRadius,
        depth,
        true
      ),
    [metrics.bodyWidth, metrics.bodyHeight, metrics.bodyCornerRadius, depth]
  );

  const bezelGeometry = useMemo(
    () =>
      createBezelGeometry(
        metrics.bodyWidth,
        metrics.bodyHeight,
        metrics.bodyCornerRadius,
        metrics.screenWidth,
        metrics.screenHeight,
        metrics.cornerRadius,
        metrics.bodyHeight * 0.005,
        depth * 0.25
      ),
    [metrics.bodyWidth, metrics.bodyHeight, metrics.bodyCornerRadius, metrics.screenWidth, metrics.screenHeight, metrics.cornerRadius, depth]
  );

  const screenGeometry = useMemo(
    () => createScreenGeometry(metrics.screenWidth, metrics.screenHeight, metrics.cornerRadius),
    [metrics.screenWidth, metrics.screenHeight, metrics.cornerRadius]
  );

  const cameraSensorGeometry = useMemo(
    () => new THREE.CircleGeometry(metrics.bodyWidth * 0.006, 48),
    [metrics.bodyWidth]
  );

  const standArmGeometry = useMemo(
    () => new THREE.BoxGeometry(standArmW, standArmH, standArmDepth),
    [standArmW, standArmH, standArmDepth]
  );

  const footGeometry = useMemo(
    () => new THREE.BoxGeometry(footW, footDepth, footH),
    [footW, footDepth, footH]
  );

  const markGeometry = useMemo(
    () =>
      createAppleMarkGeometry(
        metrics.bodyWidth * 0.12,
        metrics.bodyWidth * 0.12 * 1.2,
        depth * 0.08
      ),
    [metrics.bodyWidth, depth]
  );

  const shadowGeometry = useMemo(() => new THREE.CircleGeometry(1, 48), []);

  useDisposable(bodyGeometry);
  useDisposable(bezelGeometry);
  useDisposable(screenGeometry);
  useDisposable(cameraSensorGeometry);
  useDisposable(standArmGeometry);
  useDisposable(footGeometry);
  useDisposable(markGeometry);
  useDisposable(shadowGeometry);
  useDisposable(reflectionTexture);
  useDisposable(shadowTexture);
  useDisposable(shellMaterial);
  useDisposable(bezelMaterial);
  useDisposable(screenGlassMaterial);
  useDisposable(reflectionMaterial);
  useDisposable(cameraMaterial);
  useDisposable(appleMarkMaterial);
  useDisposable(shadowMaterial);

  return (
    <group name="studio-display-frame">
      {/* 1. MONITOR DISPLAY ENCLOSURE */}
      <group position={[0, 0, SCREEN_PLANE_Z]}>
        {/* Aluminum Rear Shell */}
        <mesh
          name="display-rear-shell"
          geometry={bodyGeometry}
          material={shellMaterial}
          position={[0, 0, -depth]}
          castShadow
          receiveShadow
        />

        {/* Apple Logo on Rear */}
        <mesh
          name="display-apple-logo"
          geometry={markGeometry}
          material={appleMarkMaterial}
          position={[0, 0, -depth - 0.0005]}
        />

        {/* Display Front Bezel Rim */}
        <mesh
          name="display-bezel-rim"
          geometry={bezelGeometry}
          material={bezelMaterial}
          position={[0, 0, -depth * 0.1]}
          castShadow
        />

        {/* Top Center Webcam Dot */}
        <mesh
          name="display-webcam"
          geometry={cameraSensorGeometry}
          material={cameraMaterial}
          position={[0, metrics.bodyHeight / 2 - metrics.bezel * 0.5, 0.0004]}
        />

        {/* Screen Glass & Reflection */}
        <mesh
          name="display-screen-glass"
          geometry={screenGeometry}
          material={screenGlassMaterial}
          position={[0, 0, 0.0005]}
        />
        <mesh
          name="display-screen-reflection"
          geometry={screenGeometry}
          material={reflectionMaterial}
          position={[0, 0, 0.001]}
        />
      </group>

      {/* 2. ALUMINUM TILT STAND & BASE FOOT */}
      <group position={[0, 0, SCREEN_PLANE_Z - depth]}>
        {/* Angled Neck Column */}
        <mesh
          name="display-stand-neck"
          geometry={standArmGeometry}
          material={shellMaterial}
          position={[0, -metrics.bodyHeight * 0.35, -depth * 0.8]}
          rotation={[-0.2, 0, 0]}
          castShadow
          receiveShadow
        />

        {/* Horizontal Flat Aluminum Foot */}
        <mesh
          name="display-stand-foot"
          geometry={footGeometry}
          material={shellMaterial}
          position={[0, standBottomY, -depth * 0.4]}
          castShadow
          receiveShadow
        />

        {/* Contact Shadow Under Stand Foot */}
        {settings.shadowEnabled && effectiveShadowOpacity > 0.001 && (
          <mesh
            name="display-foot-shadow"
            geometry={shadowGeometry}
            material={shadowMaterial}
            position={[0, standBottomY - footDepth / 2 - 0.002, -depth * 0.4]}
            scale={[footW * 0.75, footH * 0.75, 1]}
            rotation={[-Math.PI / 2, 0, 0]}
            renderOrder={-2}
          />
        )}
      </group>
    </group>
  );
}
