import { useDeviceScreenMaterials } from './useDeviceScreenMaterials';
import { getDeviceShadowOpacity } from './deviceShadowOpacity';
import { DeviceScreenSurface } from './DeviceScreenSurface';
import { DeviceContactShadow } from './DeviceContactShadow';
import { useMemo } from 'react';
import * as THREE from 'three';
import { SCREEN_PLANE_Z, type DeviceFrameMetrics } from '../../model/deviceFrame';
import type { DeviceFrameSettings } from '../../model/types';
import {
  createBezelGeometry,
  createBodyGeometry,
  createScreenGeometry,
} from './phoneGeometry';
import { useDisposable } from './useDisposable';

export function SamsungGalaxyFrame({
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
  const depth = metrics.bodyDepth;

  const shellMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: settings.frameColor,
        metalness: settings.frameMetalness,
        roughness: settings.frameRoughness,
        clearcoat: 0.7,
        clearcoatRoughness: 0.15,
      }),
    [settings.frameColor, settings.frameMetalness, settings.frameRoughness]
  );

  const bezelMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#050507',
      }),
    []
  );

  const lensRingMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: settings.frameColor,
        metalness: 0.9,
        roughness: 0.2,
      }),
    [settings.frameColor]
  );

  const lensGlassMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#11141a',
        metalness: 0.5,
        roughness: 0.1,
        clearcoat: 1,
      }),
    []
  );

  const cutoutMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#020204',
      }),
    []
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
        metrics.bodyHeight * 0.003,
        depth * 0.2
      ),
    [metrics.bodyWidth, metrics.bodyHeight, metrics.bodyCornerRadius, metrics.screenWidth, metrics.screenHeight, metrics.cornerRadius, depth]
  );

  const screenGeometry = useMemo(
    () => createScreenGeometry(metrics.screenWidth, metrics.screenHeight, metrics.cornerRadius),
    [metrics.screenWidth, metrics.screenHeight, metrics.cornerRadius]
  );

  // Centered punch-hole cutout
  const punchHoleGeometry = useMemo(
    () => new THREE.CircleGeometry(metrics.bodyWidth * 0.02, 48),
    [metrics.bodyWidth]
  );

  // Galaxy vertical camera rings
  const lensRadius = metrics.bodyWidth * 0.046;
  const lensGeometry = useMemo(
    () => new THREE.CylinderGeometry(lensRadius, lensRadius, depth * 0.15, 48),
    [lensRadius, depth]
  );
  const lensGlassGeo = useMemo(
    () => new THREE.CircleGeometry(lensRadius * 0.78, 48),
    [lensRadius]
  );

  const buttonGeometry = useMemo(
    () =>
      new THREE.BoxGeometry(
        metrics.bodyWidth * 0.008,
        metrics.bodyHeight * 0.08,
        depth * 0.35
      ),
    [metrics.bodyWidth, metrics.bodyHeight, depth]
  );

  useDisposable(bodyGeometry);
  useDisposable(bezelGeometry);
  useDisposable(screenGeometry);
  useDisposable(punchHoleGeometry);
  useDisposable(lensGeometry);
  useDisposable(lensGlassGeo);
  useDisposable(buttonGeometry);
  useDisposable(shellMaterial);
  useDisposable(bezelMaterial);
  useDisposable(lensRingMaterial);
  useDisposable(lensGlassMaterial);
  useDisposable(cutoutMaterial);

  // Camera column positions on rear left
  const camX = -metrics.bodyWidth * 0.29;
  const camY = metrics.bodyHeight * 0.34;
  const camSpacing = metrics.bodyHeight * 0.09;
  const rearCameraZ = SCREEN_PLANE_Z - depth - 0.0005;

  return (
    <group name="samsung-galaxy-frame">
      {/* Contact Studio Shadow */}
      <DeviceContactShadow
        visible={settings.shadowEnabled && effectiveShadowOpacity > 0.001}
        opacity={effectiveShadowOpacity}
        name="galaxy-device-shadow"
        position={[0, -metrics.bodyHeight * settings.shadowOffset, -depth * 0.8]}
        scale={[
          metrics.bodyWidth * (1.15 + settings.shadowBlur * 0.45),
          metrics.bodyHeight * (0.32 + settings.shadowBlur * 0.16),
          1,
        ]}
        renderOrder={-2}
      />

      {/* Titanium Chassis */}
      <mesh
        name="galaxy-titanium-chassis"
        geometry={bodyGeometry}
        material={shellMaterial}
        position={[0, 0, SCREEN_PLANE_Z - depth]}
        castShadow
        receiveShadow
      />

      {/* Symmetrical Micro Bezel */}
      <mesh
        name="galaxy-micro-bezel"
        geometry={bezelGeometry}
        material={bezelMaterial}
        position={[0, 0, SCREEN_PLANE_Z - depth * 0.08]}
        castShadow
      />

      {/* Screen Glass & Reflection */}
      <DeviceScreenSurface
        geometry={screenGeometry}
        glass={{ name: 'galaxy-screen-glass', material: glassMaterial, position: [0, 0, SCREEN_PLANE_Z + 0.0005] }}
        reflection={{ name: 'galaxy-screen-reflection', material: reflectionMaterial, position: [0, 0, SCREEN_PLANE_Z + 0.001] }}
      />

      {/* Centered Punch-Hole Selfie Camera */}
      {settings.cutoutStyle !== 'none' && (
        <mesh
          name="galaxy-punch-hole-camera"
          geometry={punchHoleGeometry}
          material={cutoutMaterial}
          position={[0, metrics.screenHeight * 0.44, SCREEN_PLANE_Z + 0.0012]}
        />
      )}

      {/* Side Buttons (Power & Volume) */}
      {settings.showSideButtons && (
        <group>
          <mesh
            geometry={buttonGeometry}
            material={shellMaterial}
            position={[metrics.bodyWidth / 2 + 0.0005, metrics.bodyHeight * 0.18, SCREEN_PLANE_Z - depth * 0.5]}
          />
          <mesh
            geometry={buttonGeometry}
            material={shellMaterial}
            position={[metrics.bodyWidth / 2 + 0.0005, metrics.bodyHeight * 0.06, SCREEN_PLANE_Z - depth * 0.5]}
          />
        </group>
      )}

      {/* Rear Vertical Triple Floating Camera Lenses */}
      {settings.showRearCameras && (
        <group>
          {[0, 1, 2].map((i) => (
            <group
              key={`galaxy-camera-${i}`}
              position={[camX, camY - i * camSpacing, rearCameraZ]}
            >
              <mesh
                geometry={lensGeometry}
                material={lensRingMaterial}
                rotation={[-Math.PI / 2, 0, 0]}
                castShadow
              />
              <mesh
                geometry={lensGlassGeo}
                material={lensGlassMaterial}
                position={[0, 0, -depth * 0.08]}
              />
            </group>
          ))}
          {/* Secondary Telephoto & Flash Column */}
          <group position={[camX + lensRadius * 1.6, camY - camSpacing * 0.5, rearCameraZ]}>
            <mesh
              geometry={lensGlassGeo}
              material={lensGlassMaterial}
              scale={[0.7, 0.7, 1]}
            />
          </group>
        </group>
      )}
    </group>
  );
}
