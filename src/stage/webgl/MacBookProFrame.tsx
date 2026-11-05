import { useDeviceScreenMaterials } from './useDeviceScreenMaterials';
import { getDeviceShadowOpacity } from './deviceShadowOpacity';
import { DeviceScreenSurface } from './DeviceScreenSurface';
import { DeviceContactShadow } from './DeviceContactShadow';
import { useMemo } from 'react';
import * as THREE from 'three';
import { SCREEN_PLANE_Z, type DeviceFrameMetrics } from '../../model/deviceFrame';
import type { DeviceFrameSettings } from '../../model/types';
import {
  createAppleMarkGeometry,
  createBezelGeometry,
  createBodyGeometry,
  createScreenGeometry,
  roundedRect,
} from './phoneGeometry';
import { useDisposable } from './useDisposable';

export function MacBookProFrame({
  metrics,
  settings,
  rotation,
}: {
  metrics: DeviceFrameMetrics;
  settings: DeviceFrameSettings;
  rotation?: { x: number; y: number; z: number };
}) {
  const effectiveShadowOpacity = getDeviceShadowOpacity(settings.shadowOpacity, rotation);
  const { glassMaterial, reflectionMaterial } = useDeviceScreenMaterials(settings);

  const lidDepth = Math.max(0.003, metrics.bodyDepth * 0.5);
  const baseLength = metrics.bodyHeight * 0.94;
  const baseThickness = Math.max(0.006, metrics.bodyDepth * 1.1);
  const hingeY = -metrics.bodyHeight / 2;
  const hingeZ = -lidDepth * 0.6;
  const lidAngleDeg = settings.lidAngle ?? 110;
  // Lid angle between base and display: 90 deg means perpendicular, 110 deg means opened back 20 deg
  const basePivotAngleRad = ((180 - lidAngleDeg) * Math.PI) / 180;

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
        color: '#0a0a0c',
      }),
    []
  );

  const keyboardWellMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#101014',
        roughness: 0.75,
        metalness: 0.15,
      }),
    []
  );

  const trackpadMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: settings.frameColor,
        roughness: Math.max(0.12, settings.frameRoughness * 0.8),
        metalness: settings.frameMetalness * 0.85,
        clearcoat: 0.3,
      }),
    [settings.frameColor, settings.frameRoughness, settings.frameMetalness]
  );

  const hingeMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#0c0c0e',
        roughness: 0.6,
        metalness: 0.4,
      }),
    []
  );

  const appleMarkMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: settings.frameColor,
        metalness: 0.98,
        roughness: 0.08,
        clearcoat: 1,
      }),
    [settings.frameColor]
  );

  // Geometries
  const lidBodyGeometry = useMemo(
    () =>
      createBodyGeometry(
        metrics.bodyWidth,
        metrics.bodyHeight,
        metrics.bodyCornerRadius,
        lidDepth,
        true
      ),
    [metrics.bodyWidth, metrics.bodyHeight, metrics.bodyCornerRadius, lidDepth]
  );

  const lidBezelGeometry = useMemo(
    () =>
      createBezelGeometry(
        metrics.bodyWidth,
        metrics.bodyHeight,
        metrics.bodyCornerRadius,
        metrics.screenWidth,
        metrics.screenHeight,
        metrics.cornerRadius,
        metrics.bodyHeight * 0.004,
        lidDepth * 0.25
      ),
    [metrics.bodyWidth, metrics.bodyHeight, metrics.bodyCornerRadius, metrics.screenWidth, metrics.screenHeight, metrics.cornerRadius, lidDepth]
  );

  const screenGeometry = useMemo(
    () => createScreenGeometry(metrics.screenWidth, metrics.screenHeight, metrics.cornerRadius),
    [metrics.screenWidth, metrics.screenHeight, metrics.cornerRadius]
  );

  const notchGeometry = useMemo(() => {
    const notchW = metrics.screenWidth * 0.14;
    const notchH = metrics.screenHeight * 0.052;
    const notchRadius = notchH * 0.25;
    return new THREE.ShapeGeometry(roundedRect(notchW, notchH, notchRadius), 48);
  }, [metrics.screenWidth, metrics.screenHeight]);

  const baseBodyGeometry = useMemo(
    () =>
      createBodyGeometry(
        metrics.bodyWidth,
        baseLength,
        metrics.bodyCornerRadius,
        baseThickness,
        true
      ),
    [metrics.bodyWidth, baseLength, metrics.bodyCornerRadius, baseThickness]
  );

  const keyboardTrayGeometry = useMemo(
    () =>
      new THREE.BoxGeometry(
        metrics.bodyWidth * 0.78,
        baseLength * 0.46,
        baseThickness * 0.12
      ),
    [metrics.bodyWidth, baseLength, baseThickness]
  );

  const trackpadGeometry = useMemo(
    () =>
      new THREE.BoxGeometry(
        metrics.bodyWidth * 0.38,
        baseLength * 0.34,
        baseThickness * 0.08
      ),
    [metrics.bodyWidth, baseLength, baseThickness]
  );

  const hingeGeometry = useMemo(
    () =>
      new THREE.CylinderGeometry(
        baseThickness * 0.36,
        baseThickness * 0.36,
        metrics.bodyWidth * 0.62,
        48
      ),
    [baseThickness, metrics.bodyWidth]
  );

  const markGeometry = useMemo(
    () =>
      createAppleMarkGeometry(
        metrics.bodyWidth * 0.12,
        metrics.bodyWidth * 0.12 * 1.2,
        lidDepth * 0.08
      ),
    [metrics.bodyWidth, lidDepth]
  );

  useDisposable(lidBodyGeometry);
  useDisposable(lidBezelGeometry);
  useDisposable(screenGeometry);
  useDisposable(notchGeometry);
  useDisposable(baseBodyGeometry);
  useDisposable(keyboardTrayGeometry);
  useDisposable(trackpadGeometry);
  useDisposable(hingeGeometry);
  useDisposable(markGeometry);
  useDisposable(shellMaterial);
  useDisposable(bezelMaterial);
  useDisposable(keyboardWellMaterial);
  useDisposable(trackpadMaterial);
  useDisposable(hingeMaterial);
  useDisposable(appleMarkMaterial);

  return (
    <group name="macbook-pro-frame">
      {/* 1. DISPLAY LID ASSEMBLY (Anchored around screen plane at SCREEN_PLANE_Z) */}
      <group position={[0, 0, SCREEN_PLANE_Z]}>
        {/* Lid Rear Shell */}
        <mesh
          name="macbook-lid-chassis"
          geometry={lidBodyGeometry}
          material={shellMaterial}
          position={[0, 0, -lidDepth]}
          castShadow
          receiveShadow
        />

        {/* Apple Logo on Lid Rear */}
        <mesh
          name="macbook-apple-logo"
          geometry={markGeometry}
          material={appleMarkMaterial}
          position={[0, 0, -lidDepth - 0.0005]}
        />

        {/* Display Bezel Rim */}
        <mesh
          name="macbook-display-bezel"
          geometry={lidBezelGeometry}
          material={bezelMaterial}
          position={[0, 0, -lidDepth * 0.15]}
          castShadow
        />

        {/* Screen Glass & Reflection */}
        <DeviceScreenSurface
          geometry={screenGeometry}
          glass={{ name: 'macbook-screen-glass', material: glassMaterial, position: [0, 0, 0.0005] }}
          reflection={{ name: 'macbook-screen-reflection', material: reflectionMaterial, position: [0, 0, 0.001] }}
        />

        {/* Camera Notch */}
        {settings.cutoutStyle !== 'none' && (
          <mesh
            name="macbook-camera-notch"
            geometry={notchGeometry}
            material={bezelMaterial}
            position={[0, metrics.screenHeight / 2 - (metrics.screenHeight * 0.052) / 2, 0.0015]}
          />
        )}
      </group>

      {/* 2. HINGE & LOWER KEYBOARD BASE CHASSIS */}
      <group position={[0, hingeY, hingeZ]}>
        {/* Hinge Barrel */}
        <mesh
          name="macbook-hinge-barrel"
          geometry={hingeGeometry}
          material={hingeMaterial}
          rotation={[0, 0, Math.PI / 2]}
        />

        {/* Pivoting Lower Base Assembly */}
        <group rotation={[-basePivotAngleRad, 0, 0]}>
          {/* Base Unibody: Extends forward along +Y in local hinge space */}
          <mesh
            name="macbook-base-chassis"
            geometry={baseBodyGeometry}
            material={shellMaterial}
            position={[0, -baseLength / 2, -baseThickness * 0.5]}
            castShadow
            receiveShadow
          />

          {/* Recessed Keyboard Well */}
          <mesh
            name="macbook-keyboard-well"
            geometry={keyboardTrayGeometry}
            material={keyboardWellMaterial}
            position={[0, -baseLength * 0.32, 0.0005]}
          />

          {/* Smooth Trackpad */}
          <mesh
            name="macbook-trackpad"
            geometry={trackpadGeometry}
            material={trackpadMaterial}
            position={[0, -baseLength * 0.76, 0.0005]}
          />

          {/* Contact Shadow Under Base */}
          <DeviceContactShadow
            visible={settings.shadowEnabled && effectiveShadowOpacity > 0.001}
            opacity={effectiveShadowOpacity}
            name="macbook-contact-shadow"
            position={[0, -baseLength / 2, -baseThickness - 0.005]}
            scale={[metrics.bodyWidth * 0.65, baseLength * 0.65, 1]}
            rotation={[-Math.PI / 2, 0, 0]}
            renderOrder={-2}
          />
        </group>
      </group>
    </group>
  );
}
