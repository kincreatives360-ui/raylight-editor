import { useMemo } from 'react';
import * as THREE from 'three';
import type { DeviceFrameSettings } from '../../model/types';
import type { DeviceFrameMetrics } from '../../model/deviceFrame';
import { SCREEN_PLANE_Z } from '../../model/deviceFrame';
import {
  createAppleMarkGeometry,
  createBezelGeometry,
  createRoundedPanelGeometry,
  createScreenGeometry,
} from './phoneGeometry';
import { createDeviceShadowTexture } from './iphone15ProMaterials';
import { useDisposable } from './useDisposable';

interface MacBookProFrameProps {
  metrics: DeviceFrameMetrics;
  settings: DeviceFrameSettings;
}

export function MacBookProFrame({ metrics, settings }: MacBookProFrameProps) {
  const shortSide = Math.min(metrics.screenWidth, metrics.screenHeight);
  const proud = shortSide * 0.001;

  // Lid & display dimensions
  const lidThickness = metrics.bodyDepth * 0.38;
  const lidZ = SCREEN_PLANE_Z - proud / 2 - lidThickness;
  const bezelDepth = Math.max(lidThickness * 0.45, proud * 1.5);
  const screenOverlap = shortSide * 0.006;

  // Base dimensions (laptop lower chassis)
  const baseThickness = metrics.bodyDepth * 0.62;
  const baseWidth = metrics.bodyWidth;
  const baseDepth = metrics.bodyHeight * 0.98;
  const baseRadius = metrics.bodyCornerRadius * 0.8;

  // Notch at top of screen
  const notchWidth = metrics.screenWidth * 0.16;
  const notchHeight = shortSide * 0.045;
  const notchY = metrics.screenHeight / 2 - notchHeight / 2;

  // Keyboard well & trackpad
  const keyboardWellWidth = baseWidth * 0.76;
  const keyboardWellHeight = baseDepth * 0.44;
  const trackpadWidth = baseWidth * 0.36;
  const trackpadHeight = baseDepth * 0.32;

  // Apple logo on back of lid
  const logoWidth = metrics.screenWidth * 0.14;
  const logoHeight = logoWidth * 1.22;

  // Geometries
  const shadowTexture = useMemo(() => createDeviceShadowTexture(), []);
  const shadowGeometry = useMemo(() => new THREE.CircleGeometry(1, 64), []);

  const lidBackGeometry = useMemo(
    () => createRoundedPanelGeometry(metrics.bodyWidth, metrics.bodyHeight, metrics.bodyCornerRadius, lidThickness),
    [metrics, lidThickness]
  );
  const bezelGeometry = useMemo(
    () => createBezelGeometry(metrics.bodyWidth, metrics.bodyHeight, metrics.bodyCornerRadius, metrics.screenWidth, metrics.screenHeight, metrics.cornerRadius, screenOverlap, bezelDepth),
    [metrics, screenOverlap, bezelDepth]
  );
  const screenGlassGeometry = useMemo(
    () => createScreenGeometry(metrics.screenWidth, metrics.screenHeight, metrics.cornerRadius),
    [metrics]
  );
  const notchGeometry = useMemo(
    () => createRoundedPanelGeometry(notchWidth, notchHeight, notchHeight * 0.35, proud * 0.4),
    [notchWidth, notchHeight, proud]
  );
  const appleLogoGeometry = useMemo(
    () => createAppleMarkGeometry(logoWidth, logoHeight, proud * 0.3),
    [logoWidth, logoHeight, proud]
  );

  const baseGeometry = useMemo(
    () => createRoundedPanelGeometry(baseWidth, baseDepth, baseRadius, baseThickness),
    [baseWidth, baseDepth, baseRadius, baseThickness]
  );
  const keyboardWellGeometry = useMemo(
    () => createRoundedPanelGeometry(keyboardWellWidth, keyboardWellHeight, keyboardWellWidth * 0.015, baseThickness * 0.15),
    [keyboardWellWidth, keyboardWellHeight, baseThickness]
  );
  const trackpadGeometry = useMemo(
    () => createRoundedPanelGeometry(trackpadWidth, trackpadHeight, trackpadWidth * 0.02, baseThickness * 0.08),
    [trackpadWidth, trackpadHeight, baseThickness]
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

  const darkKeyboardMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: '#121316',
      metalness: 0.25,
      roughness: 0.6,
      side: THREE.DoubleSide,
    }),
    []
  );

  const trackpadMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: settings.frameColor,
      metalness: Math.max(0.1, settings.frameMetalness * 0.6),
      roughness: Math.min(0.8, settings.frameRoughness * 1.3),
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

  useDisposable(lidBackGeometry);
  useDisposable(bezelGeometry);
  useDisposable(screenGlassGeometry);
  useDisposable(notchGeometry);
  useDisposable(appleLogoGeometry);
  useDisposable(baseGeometry);
  useDisposable(keyboardWellGeometry);
  useDisposable(trackpadGeometry);
  useDisposable(shadowGeometry);

  useDisposable(shadowTexture);
  useDisposable(shadowMaterial);
  useDisposable(aluminumMaterial);
  useDisposable(darkKeyboardMaterial);
  useDisposable(trackpadMaterial);
  useDisposable(bezelMaterial);
  useDisposable(glassMaterial);

  // Position of hinge at bottom edge of screen/display lid
  const hingeY = -metrics.screenHeight / 2 - (metrics.bodyHeight - metrics.screenHeight) / 4;
  const hingeZ = lidZ;

  return (
    <group name="macbook-pro-frame">
      {/* Upper Display Lid Assembly (holding the screen aperture) */}
      <group name="macbook-lid">
        {/* Aluminum Outer Lid Shell */}
        <mesh
          name="macbook-lid-back"
          geometry={lidBackGeometry}
          material={aluminumMaterial}
          position={[0, 0, lidZ]}
          castShadow
          receiveShadow
        />

        {/* Polished Apple Logo on Rear Lid */}
        <mesh
          name="macbook-apple-logo"
          geometry={appleLogoGeometry}
          material={aluminumMaterial}
          position={[0, 0, lidZ - lidThickness / 2 - proud * 0.15]}
          scale={[1, 1, 1]}
        />

        {/* Black Display Bezel with Bottom Chin */}
        <mesh
          name="macbook-bezel"
          geometry={bezelGeometry}
          material={bezelMaterial}
          position={[0, 0, SCREEN_PLANE_Z + proud - bezelDepth]}
          castShadow
          receiveShadow
        />

        {/* Camera Notch at top */}
        <mesh
          name="macbook-notch"
          geometry={notchGeometry}
          material={bezelMaterial}
          position={[0, notchY, SCREEN_PLANE_Z + proud * 0.45]}
          renderOrder={4}
        />

        {/* Anti-Reflective Screen Glass */}
        <mesh
          name="macbook-screen-glass"
          geometry={screenGlassGeometry}
          material={glassMaterial}
          position={[0, 0, SCREEN_PLANE_Z + proud * 0.35]}
          renderOrder={3}
        />
      </group>

      {/* Lower Unibody Laptop Base (Extends forward from bottom hinge) */}
      <group
        name="macbook-base"
        position={[0, hingeY, hingeZ]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        {/* Shadow under laptop base */}
        {settings.shadowEnabled && (
          <mesh
            name="macbook-shadow"
            geometry={shadowGeometry}
            material={shadowMaterial}
            position={[0, baseDepth * 0.5, -baseThickness * 1.2]}
            scale={[baseWidth * 0.65, baseDepth * 0.7, 1]}
            renderOrder={-2}
          />
        )}

        {/* Main Base Aluminum Slab */}
        <mesh
          name="macbook-base-slab"
          geometry={baseGeometry}
          material={aluminumMaterial}
          position={[0, baseDepth * 0.48, -baseThickness / 2]}
          castShadow
          receiveShadow
        />

        {/* Recessed Keyboard Well with Dark Bed */}
        <mesh
          name="macbook-keyboard-well"
          geometry={keyboardWellGeometry}
          material={darkKeyboardMaterial}
          position={[0, baseDepth * 0.68, proud * 0.1]}
          castShadow
        />

        {/* Large Force Touch Trackpad */}
        <mesh
          name="macbook-trackpad"
          geometry={trackpadGeometry}
          material={trackpadMaterial}
          position={[0, baseDepth * 0.22, proud * 0.08]}
        />
      </group>
    </group>
  );
}
