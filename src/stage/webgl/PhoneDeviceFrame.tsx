import React, { useMemo } from 'react';
import * as THREE from 'three';
import { roundedRect, createBodyGeometry, createBezelGeometry, createScreenGeometry } from './phoneGeometry';
import { useDisposable } from './useDisposable';
import { getPhoneLayout } from './phoneLayout';
import type { DeviceFrameSettings } from '../../model/types';
import { isFixedDeviceFrame, type DeviceFrameMetrics } from '../../model/deviceFrame';
import { DetailedIPhone15ProFrame } from './DetailedIPhone15ProFrame';

interface PhoneDeviceFrameProps {
  metrics: DeviceFrameMetrics;
  settings: DeviceFrameSettings;
}

function createReflectionTexture(gloss: number, reflection: number, tint: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  const wash = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  wash.addColorStop(0, `${tint}${Math.round(gloss * 26).toString(16).padStart(2, '0')}`);
  wash.addColorStop(0.26, `${tint}00`);
  wash.addColorStop(0.52, `${tint}${Math.round(reflection * 23).toString(16).padStart(2, '0')}`);
  wash.addColorStop(0.7, `${tint}00`);
  wash.addColorStop(1, `${tint}${Math.round(gloss * 12).toString(16).padStart(2, '0')}`);
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const specular = ctx.createRadialGradient(42, 48, 1, 42, 48, 190);
  specular.addColorStop(0, `rgba(255,255,255,${0.38 * gloss})`);
  specular.addColorStop(0.22, `rgba(255,255,255,${0.11 * gloss})`);
  specular.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = specular;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

function createShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
    gradient.addColorStop(0, 'rgba(0,0,0,0.78)');
    gradient.addColorStop(0.35, 'rgba(0,0,0,0.38)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export const PhoneDeviceFrame: React.FC<PhoneDeviceFrameProps> = props =>
  isFixedDeviceFrame(props.settings) && props.settings.deviceId === 'iphone-15-pro'
    ? <DetailedIPhone15ProFrame {...props} />
    : <LegacyPhoneDeviceFrame {...props} />;

const LegacyPhoneDeviceFrame: React.FC<PhoneDeviceFrameProps> = ({ metrics, settings }) => {
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
      return new THREE.CircleGeometry(cutoutHeight * 0.46, 32);
    }
    const notchWidth = settings.cutoutStyle === 'notch' ? safeWidth * 0.78 : cutoutWidth;
    const notchHeight = settings.cutoutStyle === 'notch' ? shortSide * 0.085 : cutoutHeight;
    const radius = settings.cutoutStyle === 'notch' ? notchHeight * 0.23 : cutoutRadius;
    return new THREE.ShapeGeometry(roundedRect(notchWidth, notchHeight, radius), 10);
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
    color: settings.glassTint,
    transparent: true,
    opacity: settings.glassOpacity,
    roughness: settings.glassRoughness,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: settings.glassRoughness,
    depthWrite: false,
    side: THREE.DoubleSide,
  }), [settings.glassTint, settings.glassOpacity, settings.glassRoughness]);
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
    opacity: settings.reflection,
    depthWrite: false,
    side: THREE.DoubleSide,
  }), [reflectionTexture, settings.reflection]);
  const shadowMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    map: shadowTexture,
    transparent: true,
    opacity: settings.shadowOpacity,
    depthWrite: false,
    side: THREE.DoubleSide,
  }), [shadowTexture, settings.shadowOpacity]);
  const cameraBumpGeometry = useMemo(
    () => new THREE.ShapeGeometry(roundedRect(safeWidth * 0.3, safeWidth * 0.3, safeWidth * 0.055), 10),
    [safeWidth]
  );
  const lensGeometry = useMemo(() => new THREE.CircleGeometry(safeWidth * 0.033, 24), [safeWidth]);
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
    () => new THREE.CircleGeometry(1, 48),
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
      {settings.shadowEnabled && (
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
