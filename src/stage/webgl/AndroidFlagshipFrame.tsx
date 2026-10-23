import { useMemo } from 'react';
import * as THREE from 'three';
import type { DeviceFrameSettings } from '../../model/types';
import type { DeviceFrameMetrics, } from '../../model/deviceFrame';
import { SCREEN_PLANE_Z } from '../../model/deviceFrame';
import {
  createBezelGeometry,
  createBodyGeometry,
  createRoundedPanelGeometry,
  createScreenGeometry,
} from './phoneGeometry';
import { createDeviceShadowTexture } from './iphone15ProMaterials';
import { useDisposable } from './useDisposable';

interface AndroidFlagshipFrameProps {
  metrics: DeviceFrameMetrics;
  settings: DeviceFrameSettings;
}

export function AndroidFlagshipFrame({ metrics, settings }: AndroidFlagshipFrameProps) {
  const shortSide = Math.min(metrics.screenWidth, metrics.screenHeight);
  const proud = shortSide * 0.001;
  const bodyZ = SCREEN_PLANE_Z - proud / 2 - metrics.bodyDepth;
  const bezelDepth = Math.max(metrics.bodyDepth * 0.32, proud * 1.8);
  const screenOverlap = shortSide * 0.008;

  // Punch hole camera layout
  const punchHoleRadius = shortSide * 0.026;
  const punchHoleY = metrics.screenHeight / 2 - shortSide * 0.065;

  // Horizontal camera visor on rear
  const visorWidth = metrics.bodyWidth * 0.88;
  const visorHeight = shortSide * 0.28;
  const visorDepth = metrics.bodyDepth * 0.32;
  const visorY = metrics.bodyHeight * 0.28;
  const visorZ = bodyZ - visorDepth / 2;

  // Side buttons (right edge for Android)
  const buttonWidth = Math.max(metrics.bezel * 0.18, shortSide * 0.011);
  const buttonHeight = metrics.screenHeight * 0.12;
  const buttonDepth = metrics.bodyDepth * 0.16;
  const rightX = metrics.bodyWidth / 2;

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
  const punchHoleGeometry = useMemo(() => new THREE.CircleGeometry(punchHoleRadius, 48), [punchHoleRadius]);
  const punchHoleRingGeometry = useMemo(() => new THREE.RingGeometry(punchHoleRadius, punchHoleRadius * 1.25, 48), [punchHoleRadius]);

  const visorGeometry = useMemo(
    () => createRoundedPanelGeometry(visorWidth, visorHeight, visorHeight * 0.45, visorDepth),
    [visorWidth, visorHeight, visorDepth]
  );
  const lensGeometry = useMemo(() => new THREE.CylinderGeometry(shortSide * 0.05, shortSide * 0.05, visorDepth * 0.35, 64), [shortSide, visorDepth]);
  const flashGeometry = useMemo(() => new THREE.CylinderGeometry(shortSide * 0.022, shortSide * 0.022, visorDepth * 0.2, 48), [shortSide, visorDepth]);

  const powerButtonGeometry = useMemo(
    () => createRoundedPanelGeometry(buttonWidth, buttonHeight * 0.65, buttonWidth / 2, buttonDepth),
    [buttonWidth, buttonHeight, buttonDepth]
  );
  const volumeButtonGeometry = useMemo(
    () => createRoundedPanelGeometry(buttonWidth, buttonHeight, buttonWidth / 2, buttonDepth),
    [buttonWidth, buttonHeight, buttonDepth]
  );

  // Materials
  const metalMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: settings.frameColor,
      metalness: settings.frameMetalness,
      roughness: settings.frameRoughness,
      side: THREE.DoubleSide,
    }),
    [settings.frameColor, settings.frameMetalness, settings.frameRoughness]
  );

  const rearGlassMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: settings.frameColor,
      metalness: Math.max(0.1, settings.frameMetalness * 0.4),
      roughness: Math.max(0.15, settings.frameRoughness * 1.2),
      side: THREE.DoubleSide,
    }),
    [settings.frameColor, settings.frameMetalness, settings.frameRoughness]
  );

  const bezelMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#030305' }),
    []
  );

  const lensGlassMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: '#0a0d14',
      metalness: 0.9,
      roughness: 0.05,
    }),
    []
  );

  const lensRingMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: '#2a2d36',
      metalness: 0.95,
      roughness: 0.2,
    }),
    []
  );

  const flashMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#fffaed' }),
    []
  );

  const punchHoleMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#000000' }),
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
  useDisposable(punchHoleGeometry);
  useDisposable(punchHoleRingGeometry);
  useDisposable(visorGeometry);
  useDisposable(lensGeometry);
  useDisposable(flashGeometry);
  useDisposable(powerButtonGeometry);
  useDisposable(volumeButtonGeometry);
  useDisposable(shadowGeometry);

  useDisposable(shadowTexture);
  useDisposable(shadowMaterial);
  useDisposable(metalMaterial);
  useDisposable(rearGlassMaterial);
  useDisposable(bezelMaterial);
  useDisposable(lensGlassMaterial);
  useDisposable(lensRingMaterial);
  useDisposable(flashMaterial);
  useDisposable(punchHoleMaterial);
  useDisposable(glassMaterial);

  return (
    <group name="android-flagship-frame">
      {settings.shadowEnabled && (
        <mesh
          name="android-device-shadow"
          geometry={shadowGeometry}
          material={shadowMaterial}
          position={[metrics.bodyWidth * 0.02, -metrics.bodyHeight * settings.shadowOffset, bodyZ - metrics.bodyDepth * 0.08]}
          scale={[metrics.bodyWidth * (1.18 + settings.shadowBlur * 0.55), metrics.bodyHeight * (0.32 + settings.shadowBlur * 0.16), 1]}
          renderOrder={-2}
        />
      )}

      {/* Main Aluminum / Titanium Chassis */}
      <mesh name="android-chassis" geometry={bodyGeometry} material={metalMaterial} position={[0, 0, bodyZ]} castShadow receiveShadow />

      {/* Black Display Bezel */}
      <mesh name="android-bezel" geometry={bezelGeometry} material={bezelMaterial} position={[0, 0, SCREEN_PLANE_Z + proud - bezelDepth]} castShadow receiveShadow />

      {/* Front Screen Glass Overlay */}
      <mesh name="android-screen-glass" geometry={screenGlassGeometry} material={glassMaterial} position={[0, 0, SCREEN_PLANE_Z + proud * 0.35]} renderOrder={3} />

      {/* Centered Punch Hole Selfie Camera */}
      <mesh
        name="android-punch-hole"
        geometry={punchHoleGeometry}
        material={punchHoleMaterial}
        position={[0, punchHoleY, SCREEN_PLANE_Z + proud * 0.6]}
        renderOrder={4}
      />
      <mesh
        name="android-punch-hole-ring"
        geometry={punchHoleRingGeometry}
        material={metalMaterial}
        position={[0, punchHoleY, SCREEN_PLANE_Z + proud * 0.58]}
        renderOrder={4}
      />

      {/* Side buttons (right rail: power + volume) */}
      {settings.showSideButtons && (
        <group name="android-buttons">
          <mesh
            geometry={powerButtonGeometry}
            material={metalMaterial}
            position={[rightX, metrics.screenHeight * 0.18, bodyZ + metrics.bodyDepth * 0.5]}
            castShadow
          />
          <mesh
            geometry={volumeButtonGeometry}
            material={metalMaterial}
            position={[rightX, metrics.screenHeight * 0.02, bodyZ + metrics.bodyDepth * 0.5]}
            castShadow
          />
        </group>
      )}

      {/* Rear Horizontal Camera Visor */}
      {settings.showRearCameras && (
        <group name="android-rear-camera-visor" position={[0, visorY, visorZ]}>
          <mesh geometry={visorGeometry} material={metalMaterial} castShadow receiveShadow />
          {/* Dual/Triple lenses in visor */}
          {[-shortSide * 0.22, 0, shortSide * 0.18].map((lx, idx) => (
            <group key={`android-lens-${idx}`} position={[lx, 0, -visorDepth * 0.45]}>
              <mesh geometry={lensGeometry} material={lensRingMaterial} rotation={[Math.PI / 2, 0, 0]} castShadow />
              <mesh geometry={lensGeometry} material={lensGlassMaterial} scale={[0.82, 0.82, 1.02]} rotation={[Math.PI / 2, 0, 0]} />
            </group>
          ))}
          {/* Flash */}
          <mesh
            geometry={flashGeometry}
            material={flashMaterial}
            position={[shortSide * 0.34, 0, -visorDepth * 0.42]}
            rotation={[Math.PI / 2, 0, 0]}
          />
        </group>
      )}
    </group>
  );
}
