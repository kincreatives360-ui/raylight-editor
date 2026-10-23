import { useMemo } from 'react';
import * as THREE from 'three';
import type { DeviceFrameSettings } from '../../model/types';
import type { DeviceFrameMetrics } from '../../model/deviceFrame';
import { SCREEN_PLANE_Z } from '../../model/deviceFrame';
import {
  createAppleMarkGeometry,
  createBezelGeometry,
  createBodyGeometry,
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
