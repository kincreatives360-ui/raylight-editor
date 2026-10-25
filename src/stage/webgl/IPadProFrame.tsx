import { useMemo } from 'react';
import * as THREE from 'three';
import { SCREEN_PLANE_Z, type DeviceFrameMetrics } from '../../model/deviceFrame';
import type { DeviceFrameSettings } from '../../model/types';
import type { DeviceFrameSettings } from '../../model/types';
import type { DeviceFrameMetrics } from '../../model/deviceFrame';
import { SCREEN_PLANE_Z } from '../../model/deviceFrame';
import {
  createAppleMarkGeometry,
  createBezelGeometry,
  createBodyGeometry,
  createScreenGeometry,
  roundedRect,
} from './phoneGeometry';
import { useDisposable } from './useDisposable';
import { createReflectionTexture, createShadowTexture } from './deviceTextures';

export function IPadProFrame({
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
  const depth = Math.max(0.004, metrics.bodyDepth * 0.7);

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
        clearcoat: 0.65,
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
    () => new THREE.CircleGeometry(metrics.bodyWidth * 0.008, 16),
    [metrics.bodyWidth]
  );

  const cameraBumpGeometry = useMemo(() => {
    const bumpW = metrics.bodyWidth * 0.14;
    const bumpH = metrics.bodyHeight * 0.11;
    return new THREE.ShapeGeometry(roundedRect(bumpW, bumpH, bumpW * 0.25), 10);
  }, [metrics.bodyWidth, metrics.bodyHeight]);

  const lensGeometry = useMemo(
    () => new THREE.CircleGeometry(metrics.bodyWidth * 0.024, 24),
    [metrics.bodyWidth]
  );

  const markGeometry = useMemo(
    () =>
      createAppleMarkGeometry(
        metrics.bodyWidth * 0.14,
        metrics.bodyWidth * 0.14 * 1.2,
        depth * 0.08
      ),
    [metrics.bodyWidth, depth]
  );

  const shadowGeometry = useMemo(() => new THREE.CircleGeometry(1, 48), []);

  useDisposable(bodyGeometry);
  useDisposable(bezelGeometry);
  useDisposable(screenGeometry);
  useDisposable(cameraSensorGeometry);
  useDisposable(cameraBumpGeometry);
  useDisposable(lensGeometry);
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

  const cameraBumpX = -metrics.bodyWidth * 0.36;
  const cameraBumpY = metrics.bodyHeight * 0.38;

  return (
    <group name="ipad-pro-frame">
      {/* Contact Studio Shadow */}
      {settings.shadowEnabled && effectiveShadowOpacity > 0.001 && (
        <mesh
          name="ipad-device-shadow"
          geometry={shadowGeometry}
          material={shadowMaterial}
          position={[0, -metrics.bodyHeight * settings.shadowOffset, -depth * 0.8]}
          scale={[
            metrics.bodyWidth * (1.12 + settings.shadowBlur * 0.4),
            metrics.bodyHeight * (0.32 + settings.shadowBlur * 0.15),
            1,
          ]}
  createRoundedPanelGeometry,
  createScreenGeometry,
} from './phoneGeometry';
import { createDeviceShadowTexture } from './iphone15ProMaterials';
import { useDisposable } from './useDisposable';

interface IPadProFrameProps {
  metrics: DeviceFrameMetrics;
  settings: DeviceFrameSettings;
}

export function IPadProFrame({ metrics, settings }: IPadProFrameProps) {
  const shortSide = Math.min(metrics.screenWidth, metrics.screenHeight);
  const proud = shortSide * 0.001;
  const bodyZ = SCREEN_PLANE_Z - proud / 2 - metrics.bodyDepth;
  const bezelDepth = Math.max(metrics.bodyDepth * 0.35, proud * 1.6);
  const screenOverlap = shortSide * 0.007;

  // Rear camera plateau at top-left
  const plateauSize = shortSide * 0.16;
  const plateauDepth = metrics.bodyDepth * 0.28;
  const plateauX = -metrics.bodyWidth / 2 + plateauSize * 0.72;
  const plateauY = metrics.bodyHeight / 2 - plateauSize * 0.72;
  const plateauZ = bodyZ - plateauDepth / 2;

  // Apple logo on back
  const logoWidth = shortSide * 0.15;
  const logoHeight = logoWidth * 1.22;

  // Geometries
  const shadowTexture = useMemo(() => createDeviceShadowTexture(), []);
  const shadowGeometry = useMemo(() => new THREE.CircleGeometry(1, 64), []);

  const bodyGeometry = useMemo(
    () => createBodyGeometry(metrics.bodyWidth, metrics.bodyHeight, metrics.bodyCornerRadius, metrics.bodyDepth, true),
    [metrics]
  );
  const bezelGeometry = useMemo(
    () => createBezelGeometry(metrics.bodyWidth, metrics.bodyHeight, metrics.bodyCornerRadius, metrics.screenWidth, metrics.screenHeight, metrics.cornerRadius, screenOverlap, bezelDepth),
    [metrics, screenOverlap, bezelDepth]
  );
  const screenGlassGeometry = useMemo(
    () => createScreenGeometry(metrics.screenWidth, metrics.screenHeight, metrics.cornerRadius),
    [metrics]
  );
  const cameraPlateauGeometry = useMemo(
    () => createRoundedPanelGeometry(plateauSize, plateauSize, plateauSize * 0.28, plateauDepth),
    [plateauSize, plateauDepth]
  );
  const lensGeometry = useMemo(() => new THREE.CylinderGeometry(plateauSize * 0.2, plateauSize * 0.2, plateauDepth * 0.4, 64), [plateauSize, plateauDepth]);
  const appleLogoGeometry = useMemo(
    () => createAppleMarkGeometry(logoWidth, logoHeight, proud * 0.3),
    [logoWidth, logoHeight, proud]
  );

  // Materials
  const aluminumMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: settings.frameColor,
      metalness: settings.frameMetalness,
      roughness: settings.frameRoughness,
      side: THREE.DoubleSide,
    }),
    [settings.frameColor, settings.frameMetalness, settings.frameRoughness]
  );

  const bezelMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#050507' }),
    []
  );

  const glassMaterial = useMemo(
    () => new THREE.MeshPhysicalMaterial({
      color: '#000000',
      transparent: true,
      opacity: Math.min(0.2, settings.glassOpacity * 0.4),
      roughness: Math.max(0.02, settings.glassRoughness),
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: Math.max(0.02, settings.glassRoughness),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
    [settings.glassOpacity, settings.glassRoughness]
  );

  const lensGlassMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: '#0a0d14',
      metalness: 0.95,
      roughness: 0.05,
    }),
    []
  );

  const shadowMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({
      map: shadowTexture,
      transparent: true,
      opacity: settings.shadowOpacity,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    [settings.shadowOpacity, shadowTexture]
  );

  useDisposable(bodyGeometry);
  useDisposable(bezelGeometry);
  useDisposable(screenGlassGeometry);
  useDisposable(cameraPlateauGeometry);
  useDisposable(lensGeometry);
  useDisposable(appleLogoGeometry);
  useDisposable(shadowGeometry);

  useDisposable(shadowTexture);
  useDisposable(shadowMaterial);
  useDisposable(aluminumMaterial);
  useDisposable(bezelMaterial);
  useDisposable(glassMaterial);
  useDisposable(lensGlassMaterial);

  return (
    <group name="ipad-pro-frame">
      {settings.shadowEnabled && (
        <mesh
          name="ipad-shadow"
          geometry={shadowGeometry}
          material={shadowMaterial}
          position={[0, -metrics.bodyHeight * settings.shadowOffset, bodyZ - metrics.bodyDepth * 0.1]}
          scale={[metrics.bodyWidth * (1.12 + settings.shadowBlur * 0.5), metrics.bodyHeight * (0.35 + settings.shadowBlur * 0.18), 1]}
          renderOrder={-2}
        />
      )}

      {/* Aluminum Unibody Shell */}
      <mesh
        name="ipad-aluminum-chassis"
        geometry={bodyGeometry}
        material={shellMaterial}
        position={[0, 0, SCREEN_PLANE_Z - depth]}
        castShadow
        receiveShadow
      />

      {/* Apple Logo on Rear */}
      <mesh
        name="ipad-apple-logo"
        geometry={markGeometry}
        material={appleMarkMaterial}
        position={[0, 0, SCREEN_PLANE_Z - depth - 0.0005]}
      />

      {/* Rear Camera Bump & Lenses */}
      {settings.showRearCameras && (
        <group position={[cameraBumpX, cameraBumpY, SCREEN_PLANE_Z - depth - 0.0008]}>
          <mesh geometry={cameraBumpGeometry} material={shellMaterial} />
          <mesh
            geometry={lensGeometry}
            material={cameraMaterial}
            position={[0, 0, -0.0004]}
          />
        </group>
      )}

      {/* Symmetrical Screen Bezel Rim */}
      <mesh
        name="ipad-bezel-rim"
        geometry={bezelGeometry}
        material={bezelMaterial}
        position={[0, 0, SCREEN_PLANE_Z - depth * 0.1]}
        castShadow
      />

      {/* Front Camera Sensor Dot in Bezel */}
      <mesh
        name="ipad-front-camera"
        geometry={cameraSensorGeometry}
        material={cameraMaterial}
        position={[0, metrics.bodyHeight / 2 - metrics.bezel * 0.5, SCREEN_PLANE_Z + 0.0004]}
      />

      {/* Screen Glass & Reflection */}
      <mesh
        name="ipad-screen-glass"
        geometry={screenGeometry}
        material={screenGlassMaterial}
        position={[0, 0, SCREEN_PLANE_Z + 0.0005]}
      />
      <mesh
        name="ipad-screen-reflection"
        geometry={screenGeometry}
        material={reflectionMaterial}
        position={[0, 0, SCREEN_PLANE_Z + 0.001]}
      />
      {/* Main Flat Aluminum Unibody */}
      <mesh name="ipad-chassis" geometry={bodyGeometry} material={aluminumMaterial} position={[0, 0, bodyZ]} castShadow receiveShadow />

      {/* Symmetric Slim Display Bezel */}
      <mesh name="ipad-bezel" geometry={bezelGeometry} material={bezelMaterial} position={[0, 0, SCREEN_PLANE_Z + proud - bezelDepth]} castShadow receiveShadow />

      {/* Screen Glass Reflection Overlay */}
      <mesh name="ipad-screen-glass" geometry={screenGlassGeometry} material={glassMaterial} position={[0, 0, SCREEN_PLANE_Z + proud * 0.35]} renderOrder={3} />

      {/* Centered Apple Logo on Rear */}
      <mesh
        name="ipad-apple-logo"
        geometry={appleLogoGeometry}
        material={aluminumMaterial}
        position={[0, 0, bodyZ - proud * 0.15]}
        scale={[1, 1, 1]}
      />

      {/* Rear Camera Plateau */}
      {settings.showRearCameras && (
        <group name="ipad-rear-camera" position={[plateauX, plateauY, plateauZ]}>
          <mesh geometry={cameraPlateauGeometry} material={aluminumMaterial} castShadow />
          <mesh geometry={lensGeometry} material={lensGlassMaterial} position={[-plateauSize * 0.2, 0, -plateauDepth * 0.4]} rotation={[Math.PI / 2, 0, 0]} />
          <mesh geometry={lensGeometry} material={lensGlassMaterial} position={[plateauSize * 0.2, 0, -plateauDepth * 0.4]} rotation={[Math.PI / 2, 0, 0]} />
        </group>
      )}
    </group>
  );
}
