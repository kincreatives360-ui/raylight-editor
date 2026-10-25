import React, { useMemo } from 'react';
import * as THREE from 'three';
import { roundedRect, createBodyGeometry, createBezelGeometry, createScreenGeometry } from './phoneGeometry';
import { useDisposable } from './useDisposable';
import { getPhoneLayout } from './phoneLayout';
import type { DeviceFrameSettings } from '../../model/types';
import { isFixedDeviceFrame, type DeviceFrameMetrics } from '../../model/deviceFrame';
import { DetailedIPhone15ProFrame } from './DetailedIPhone15ProFrame';
import { MacBookProFrame } from './MacBookProFrame';
import { IPadProFrame } from './IPadProFrame';
import { SamsungGalaxyFrame } from './SamsungGalaxyFrame';
import { StudioDisplayFrame } from './StudioDisplayFrame';
import { BrowserFrame } from './BrowserFrame';
import { AndroidFlagshipFrame } from './AndroidFlagshipFrame';

import { createReflectionTexture, createShadowTexture } from './deviceTextures';

export interface PhoneDeviceFrameProps {
  metrics: DeviceFrameMetrics;
  settings: DeviceFrameSettings;
  rotation?: { x: number; y: number; z: number };
}

export const PhoneDeviceFrame: React.FC<PhoneDeviceFrameProps> = props => {
  if (isFixedDeviceFrame(props.settings)) {
    const id = props.settings.deviceId || 'iphone-15-pro';
    switch (id) {
      case 'android-flagship':
        return <AndroidFlagshipFrame {...props} />;
      case 'samsung-galaxy':
        return <SamsungGalaxyFrame {...props} />;
      case 'macbook-pro':
      case 'macbook-pro-16':
        return <MacBookProFrame {...props} />;
      case 'ipad-pro':
      case 'ipad-pro-13':
        return <IPadProFrame {...props} />;
      case 'studio-display':
      case 'studio-display-27':
        return <StudioDisplayFrame {...props} />;
      case 'browser':
        return <BrowserFrame {...props} />;
      case 'iphone-15-pro':
      default:
        return <DetailedIPhone15ProFrame {...props} />;
    }
  }
  return <LegacyPhoneDeviceFrame {...props} />;
};

const LegacyPhoneDeviceFrame: React.FC<PhoneDeviceFrameProps> = ({ metrics, settings, rotation }) => {
  const facingCamera = Math.max(0, Math.cos(rotation?.x ?? 0) * Math.cos(rotation?.y ?? 0));
  const effectiveShadowOpacity = Math.max(0, Math.min(1, settings.shadowOpacity * facingCamera));
  const { fixed, safeWidth, safeHeight, depth, shortSide, proud, bezelDepth, bodyZ,
    bezelZ, glassZ, reflectionZ, cutoutZ, screenOverlap, cameraX, cameraY, cameraZ,
    lensRadius, buttonWidth, buttonHeight, buttonDepth, buttonZ } = getPhoneLayout(metrics, settings);
  const cutoutWidth = Math.min(safeWidth * settings.cutoutWidth, safeWidth * 0.9);
  const cutoutHeight = shortSide * settings.cutoutHeight;
  const cutoutY = safeHeight / 2 - shortSide * 0.095 - cutoutHeight / 2;
  const cutoutRadius = settings.cutoutStyle === 'punch-hole'
    ? cutoutHeight / 2
    : Math.min(cutoutHeight / 2, shortSide * 0.05);

  const bodyGeometry = useMemo(
    () => createBodyGeometry(metrics.bodyWidth, metrics.bodyHeight, metrics.bodyCornerRadius, depth, fixed),
    [metrics.bodyWidth, metrics.bodyHeight, metrics.bodyCornerRadius, depth, fixed]
  );
  const bezelGeometry = useMemo(
    () => createBezelGeometry(
      metrics.bodyWidth,
      metrics.bodyHeight,
      metrics.bodyCornerRadius,
      safeWidth,
      safeHeight,
      metrics.cornerRadius,
      screenOverlap,
      bezelDepth
    ),
    [metrics.bodyWidth, metrics.bodyHeight, metrics.cornerRadius, metrics.bodyCornerRadius, safeWidth, safeHeight, screenOverlap, bezelDepth]
  );
  const screenGlassGeometry = useMemo(
    () => createScreenGeometry(safeWidth, safeHeight, metrics.cornerRadius),
    [safeWidth, safeHeight, metrics.cornerRadius]
  );
  const cutoutGeometry = useMemo(() => {
    if (settings.cutoutStyle === 'none') return null;
    if (settings.cutoutStyle === 'punch-hole') {
      return new THREE.CircleGeometry(cutoutHeight * 0.46, 48);
    }
    const notchWidth = settings.cutoutStyle === 'notch' ? safeWidth * 0.78 : cutoutWidth;
    const notchHeight = settings.cutoutStyle === 'notch' ? shortSide * 0.085 : cutoutHeight;
    const radius = settings.cutoutStyle === 'notch' ? notchHeight * 0.23 : cutoutRadius;
    return new THREE.ShapeGeometry(roundedRect(notchWidth, notchHeight, radius), 32);
  }, [settings.cutoutStyle, cutoutWidth, cutoutHeight, cutoutRadius, shortSide, safeWidth]);
  const reflectionTexture = useMemo(
    () => createReflectionTexture(settings.gloss, settings.reflection, settings.glassTint),
    [settings.gloss, settings.reflection, settings.glassTint]
  );
  const shadowTexture = useMemo(() => createShadowTexture(), []);
  const shellMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: settings.frameColor,
    metalness: settings.frameMetalness,
    roughness: settings.frameRoughness,
    clearcoat: 0.82,
    clearcoatRoughness: 0.16,
    side: THREE.DoubleSide,
  }), [settings.frameColor, settings.frameMetalness, settings.frameRoughness]);
  const glassMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#000000',
    transparent: true,
    opacity: Math.min(0.2, settings.glassOpacity * 0.4),
    roughness: Math.max(0.02, settings.glassRoughness),
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: Math.max(0.02, settings.glassRoughness),
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  }), [settings.glassOpacity, settings.glassRoughness]);
  const cutoutMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#050507',
    transparent: true,
    opacity: 1,
    depthWrite: false,
    side: THREE.DoubleSide,
  }), []);
  const reflectionMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    map: reflectionTexture,
    transparent: true,
    opacity: Math.min(0.5, settings.reflection * 0.6),
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  }), [reflectionTexture, settings.reflection]);
  const shadowMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    map: shadowTexture,
    transparent: true,
    opacity: effectiveShadowOpacity,
    depthWrite: false,
    side: THREE.FrontSide,
  }), [shadowTexture, effectiveShadowOpacity]);
  const cameraBumpGeometry = useMemo(
    () => new THREE.ShapeGeometry(roundedRect(safeWidth * 0.3, safeWidth * 0.3, safeWidth * 0.055), 32),
    [safeWidth]
  );
  const lensGeometry = useMemo(() => new THREE.CircleGeometry(safeWidth * 0.033, 48), [safeWidth]);
  const lensMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#101216',
    metalness: 0.35,
    roughness: 0.13,
    clearcoat: 1,
    side: THREE.DoubleSide,
  }), []);
  const lensGlassMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#20242d',
    metalness: 0.6,
    roughness: 0.06,
    clearcoat: 1,
    side: THREE.DoubleSide,
  }), []);
  const buttonMaterial = shellMaterial;
  const shadowGeometry = useMemo(
    () => new THREE.CircleGeometry(1, 64),
    []
  );
  const buttonGeometry = useMemo(
    () => new THREE.BoxGeometry(buttonWidth, buttonHeight, buttonDepth),
    [buttonWidth, buttonHeight, buttonDepth]
  );

  useDisposable(bodyGeometry);
  useDisposable(bezelGeometry);
  useDisposable(screenGlassGeometry);
  useDisposable(cutoutGeometry);
  useDisposable(reflectionTexture);
  useDisposable(shadowTexture);
  useDisposable(shellMaterial);
  useDisposable(glassMaterial);
  useDisposable(cutoutMaterial);
  useDisposable(reflectionMaterial);
  useDisposable(shadowMaterial);
  useDisposable(cameraBumpGeometry);
  useDisposable(lensGeometry);
  useDisposable(lensMaterial);
  useDisposable(lensGlassMaterial);
  useDisposable(shadowGeometry);
  useDisposable(buttonGeometry);

  const allCameraPositions: [number, number][] = [
    [cameraX - lensRadius * 1.25, cameraY + lensRadius * 0.7],
    [cameraX + lensRadius * 1.25, cameraY + lensRadius * 0.7],
    [cameraX - lensRadius * 1.25, cameraY - lensRadius * 1.6],
  ];
  const cameraCount = isFixedDeviceFrame(settings) || settings.model === 'iphone-pro' ? 3 : settings.model === 'iphone' ? 2 : 1;
  const cameraPositions = allCameraPositions.slice(0, cameraCount);

  return (
    <group name="iphone-device-frame">
      {settings.shadowEnabled && effectiveShadowOpacity > 0.001 && (
        <mesh
          geometry={shadowGeometry}
          material={shadowMaterial}
          position={[metrics.bodyWidth * 0.025, -metrics.bodyHeight * settings.shadowOffset, bodyZ - depth * 0.08 - proud]}
          scale={[metrics.bodyWidth * (1.18 + settings.shadowBlur * 0.55), metrics.bodyHeight * (0.32 + settings.shadowBlur * 0.16), 1]}
          renderOrder={-2}
        />
      )}

      <mesh geometry={bodyGeometry} material={shellMaterial} position={[0, 0, bodyZ]} castShadow receiveShadow />
      <mesh geometry={bezelGeometry} material={shellMaterial} position={[0, 0, bezelZ]} castShadow receiveShadow />

      {settings.cutoutStyle !== 'none' && cutoutGeometry && (
        <mesh
          geometry={cutoutGeometry}
          material={cutoutMaterial}
          position={[0, cutoutY, cutoutZ]}
        />
      )}

      <mesh geometry={screenGlassGeometry} material={glassMaterial} position={[0, 0, glassZ]} />
      <mesh geometry={screenGlassGeometry} material={reflectionMaterial} position={[0, 0, reflectionZ]} />

      {settings.showSideButtons && (
        <group>
          <mesh geometry={buttonGeometry} material={buttonMaterial} position={[-metrics.bodyWidth / 2, safeHeight * 0.24, buttonZ]} />
          <mesh geometry={buttonGeometry} material={buttonMaterial} position={[-metrics.bodyWidth / 2, safeHeight * 0.13, buttonZ]} />
          <mesh geometry={buttonGeometry} material={buttonMaterial} position={[-metrics.bodyWidth / 2, safeHeight * 0.02, buttonZ]} />
          <mesh geometry={buttonGeometry} material={buttonMaterial} position={[metrics.bodyWidth / 2, safeHeight * 0.18, buttonZ]} />
        </group>
      )}

      {settings.showRearCameras && (
        <group>
          <mesh geometry={cameraBumpGeometry} material={shellMaterial} position={[cameraX, cameraY, cameraZ]} />
          {cameraPositions.map(([x, y], index) => (
            <mesh
              key={`camera-lens-${index}`}
              geometry={lensGeometry}
              material={lensMaterial}
              position={[x, y, cameraZ - depth * 0.02]}
            />
          ))}
          {cameraPositions.map(([x, y], index) => (
            <mesh
              key={`camera-glass-${index}`}
              geometry={lensGeometry}
              material={lensGlassMaterial}
              position={[x, y, cameraZ - depth * 0.025]}
              scale={[0.62, 0.62, 1]}
            />
          ))}
          <mesh
            geometry={lensGeometry}
            material={cutoutMaterial}
            position={[cameraX + lensRadius * 1.65, cameraY - lensRadius * 1.7, cameraZ - depth * 0.02]}
            scale={[0.42, 0.42, 1]}
          />
        </group>
      )}
    </group>
  );
};
