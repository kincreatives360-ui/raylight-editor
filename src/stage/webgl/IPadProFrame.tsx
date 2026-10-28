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

export function IPadProFrame({
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
  const depth = Math.max(0.004, metrics.bodyDepth * 0.7);

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
    return new THREE.ShapeGeometry(roundedRect(bumpW, bumpH, bumpW * 0.25), 48);
  }, [metrics.bodyWidth, metrics.bodyHeight]);

  const lensGeometry = useMemo(
    () => new THREE.CircleGeometry(metrics.bodyWidth * 0.024, 48),
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

  useDisposable(bodyGeometry);
  useDisposable(bezelGeometry);
  useDisposable(screenGeometry);
  useDisposable(cameraSensorGeometry);
  useDisposable(cameraBumpGeometry);
  useDisposable(lensGeometry);
  useDisposable(markGeometry);
  useDisposable(shellMaterial);
  useDisposable(bezelMaterial);
  useDisposable(cameraMaterial);
  useDisposable(appleMarkMaterial);

  const cameraBumpX = -metrics.bodyWidth * 0.36;
  const cameraBumpY = metrics.bodyHeight * 0.38;

  return (
    <group name="ipad-pro-frame">
      {/* Contact Studio Shadow */}
      <DeviceContactShadow
        visible={settings.shadowEnabled && effectiveShadowOpacity > 0.001}
        opacity={effectiveShadowOpacity}
        name="ipad-device-shadow"
        position={[0, -metrics.bodyHeight * settings.shadowOffset, -depth * 0.8]}
        scale={[
          metrics.bodyWidth * (1.12 + settings.shadowBlur * 0.4),
          metrics.bodyHeight * (0.32 + settings.shadowBlur * 0.15),
          1,
        ]}
        renderOrder={-2}
      />

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
      <DeviceScreenSurface
        geometry={screenGeometry}
        glass={{ name: 'ipad-screen-glass', material: glassMaterial, position: [0, 0, SCREEN_PLANE_Z + 0.0005] }}
        reflection={{ name: 'ipad-screen-reflection', material: reflectionMaterial, position: [0, 0, SCREEN_PLANE_Z + 0.001] }}
      />
    </group>
  );
}
