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

interface StudioDisplayFrameProps {
  metrics: DeviceFrameMetrics;
  settings: DeviceFrameSettings;
}

export function StudioDisplayFrame({ metrics, settings }: StudioDisplayFrameProps) {
  const shortSide = Math.min(metrics.screenWidth, metrics.screenHeight);
  const proud = shortSide * 0.001;
  const bodyZ = SCREEN_PLANE_Z - proud / 2 - metrics.bodyDepth;
  const bezelDepth = Math.max(metrics.bodyDepth * 0.35, proud * 1.6);
  const screenOverlap = shortSide * 0.006;

  // Stand dimensions
  const standArmWidth = metrics.bodyWidth * 0.16;
  const standArmHeight = metrics.bodyHeight * 0.48;
  const standArmDepth = metrics.bodyDepth * 0.45;

  const standFootWidth = metrics.bodyWidth * 0.32;
  const standFootDepth = metrics.bodyWidth * 0.28;
  const standFootThickness = metrics.bodyDepth * 0.35;

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
  const webcamGeometry = useMemo(() => new THREE.CircleGeometry(shortSide * 0.015, 64), [shortSide]);

  // Apple logo on back
  const logoWidth = metrics.screenWidth * 0.12;
  const logoHeight = logoWidth * 1.22;
  const appleLogoGeometry = useMemo(
    () => createAppleMarkGeometry(logoWidth, logoHeight, proud * 0.3),
    [logoWidth, logoHeight, proud]
  );

  // Stand arm and foot
  const standArmGeometry = useMemo(
    () => createRoundedPanelGeometry(standArmWidth, standArmHeight, standArmWidth * 0.1, standArmDepth),
    [standArmWidth, standArmHeight, standArmDepth]
  );
  const standFootGeometry = useMemo(
    () => createRoundedPanelGeometry(standFootWidth, standFootDepth, standFootWidth * 0.08, standFootThickness),
    [standFootWidth, standFootDepth, standFootThickness]
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
    () => new THREE.MeshBasicMaterial({ color: '#040406' }),
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
  useDisposable(webcamGeometry);
  useDisposable(appleLogoGeometry);
  useDisposable(standArmGeometry);
  useDisposable(standFootGeometry);
  useDisposable(shadowGeometry);

  useDisposable(shadowTexture);
  useDisposable(shadowMaterial);
  useDisposable(aluminumMaterial);
  useDisposable(bezelMaterial);
  useDisposable(glassMaterial);

  const footY = -metrics.bodyHeight / 2 - standArmHeight * 0.55;
  const footZ = bodyZ - standFootDepth * 0.25;

  return (
    <group name="studio-display-frame">
      {/* Display Enclosure */}
      <mesh name="studio-chassis" geometry={bodyGeometry} material={aluminumMaterial} position={[0, 0, bodyZ]} castShadow receiveShadow />
      <mesh name="studio-bezel" geometry={bezelGeometry} material={bezelMaterial} position={[0, 0, SCREEN_PLANE_Z + proud - bezelDepth]} castShadow receiveShadow />
      <mesh name="studio-screen-glass" geometry={screenGlassGeometry} material={glassMaterial} position={[0, 0, SCREEN_PLANE_Z + proud * 0.35]} renderOrder={3} />

      {/* Top FaceTime Camera */}
      <mesh
        name="studio-webcam"
        geometry={webcamGeometry}
        material={bezelMaterial}
        position={[0, metrics.screenHeight / 2 + (metrics.bodyHeight - metrics.screenHeight) * 0.25, SCREEN_PLANE_Z + proud * 0.4]}
        renderOrder={4}
      />

      {/* Rear Apple Logo */}
      <mesh
        name="studio-apple-logo"
        geometry={appleLogoGeometry}
        material={aluminumMaterial}
        position={[0, metrics.bodyHeight * 0.08, bodyZ - proud * 0.15]}
        scale={[1, 1, 1]}
      />

      {/* Desktop Stand Arm & Foot */}
      <group name="studio-stand">
        {/* Angled Vertical Arm */}
        <mesh
          name="studio-stand-arm"
          geometry={standArmGeometry}
          material={aluminumMaterial}
          position={[0, -metrics.bodyHeight * 0.28, bodyZ - standArmDepth * 1.2]}
          rotation={[0.18, 0, 0]}
          castShadow
          receiveShadow
        />

        {/* Flat Aluminum Base Foot */}
        <mesh
          name="studio-stand-foot"
          geometry={standFootGeometry}
          material={aluminumMaterial}
          position={[0, footY, footZ]}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow
          receiveShadow
        />

        {/* Desk Contact Shadow */}
        {settings.shadowEnabled && (
          <mesh
            name="studio-desk-shadow"
            geometry={shadowGeometry}
            material={shadowMaterial}
            position={[0, footY - standFootThickness * 0.6, footZ]}
            rotation={[Math.PI / 2, 0, 0]}
            scale={[standFootWidth * 0.9, standFootDepth * 0.85, 1]}
            renderOrder={-2}
          />
        )}
      </group>
    </group>
  );
}
