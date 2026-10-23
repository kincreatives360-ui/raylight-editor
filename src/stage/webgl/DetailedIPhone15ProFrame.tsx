import { useMemo } from 'react';
import * as THREE from 'three';
import { SCREEN_PLANE_Z, type DeviceFrameMetrics } from '../../model/deviceFrame';
import type { DeviceFrameSettings } from '../../model/types';
import {
  createAppleMarkGeometry,
  createBezelGeometry,
  createBodyGeometry,
  createCameraBarrelGeometry,
  createRoundedPanelGeometry,
  createScreenGeometry,
} from './phoneGeometry';
import {
  BASE_UNIT_IPHONE_15_PRO_LAYOUT,
  UNIT_IPHONE_15_PRO_METRICS,
  getIPhone15ProLayout,
} from './iphone15ProLayout';
import { createDeviceShadowTexture, createIPhone15ProMaterials } from './iphone15ProMaterials';
import { useDisposable } from './useDisposable';

export function DetailedIPhone15ProFrame({ metrics, settings }: { metrics: DeviceFrameMetrics; settings: DeviceFrameSettings }) {
  const scaleFactor = Math.max(0.000001, Number.isFinite(metrics.bodyHeight) ? metrics.bodyHeight : 1);

  const { cutoutStyle, cutoutWidth, cutoutHeight } = settings;
  // Unit cutout layout only recomputes when cutout style/dimensions change
  const unitLayout = useMemo(
    () => getIPhone15ProLayout(UNIT_IPHONE_15_PRO_METRICS, { cutoutStyle, cutoutWidth, cutoutHeight } as DeviceFrameSettings),
    [cutoutStyle, cutoutWidth, cutoutHeight]
  );

  const {
    frameColor,
    frameMetalness,
    frameRoughness,
    glassTint,
    glassOpacity,
    glassRoughness,
    gloss,
    reflection,
  } = settings;
  // Materials only recompute when visual styling settings change, not on playhead ticks
  const materials = useMemo(
    () => createIPhone15ProMaterials({
      frameColor,
      frameMetalness,
      frameRoughness,
      glassTint,
      glassOpacity,
      glassRoughness,
      gloss,
      reflection,
    } as DeviceFrameSettings),
    [
      frameColor,
      frameMetalness,
      frameRoughness,
      glassTint,
      glassOpacity,
      glassRoughness,
      gloss,
      reflection,
    ]
  );

  const shadowTexture = useMemo(() => createDeviceShadowTexture(), []);

  // Fixed unit hardware geometries: instantiated once on mount and scaled via Three.js <group scale>.
  // Zero re-extrusion or GPU buffer thrashing at 60 FPS playback.
  const bodyGeometry = useMemo(
    () => createBodyGeometry(
      BASE_UNIT_IPHONE_15_PRO_LAYOUT.body.width,
      BASE_UNIT_IPHONE_15_PRO_LAYOUT.body.height,
      BASE_UNIT_IPHONE_15_PRO_LAYOUT.body.cornerRadius,
      BASE_UNIT_IPHONE_15_PRO_LAYOUT.body.depth,
      true
    ),
    []
  );

  const bezelGeometry = useMemo(
    () => createBezelGeometry(
      BASE_UNIT_IPHONE_15_PRO_LAYOUT.body.width,
      BASE_UNIT_IPHONE_15_PRO_LAYOUT.body.height,
      BASE_UNIT_IPHONE_15_PRO_LAYOUT.body.cornerRadius,
      BASE_UNIT_IPHONE_15_PRO_LAYOUT.screen.width,
      BASE_UNIT_IPHONE_15_PRO_LAYOUT.screen.height,
      BASE_UNIT_IPHONE_15_PRO_LAYOUT.screen.radius,
      BASE_UNIT_IPHONE_15_PRO_LAYOUT.front.screenOverlap,
      BASE_UNIT_IPHONE_15_PRO_LAYOUT.front.bezelDepth
    ),
    []
  );

  const screenGeometry = useMemo(
    () => createScreenGeometry(
      BASE_UNIT_IPHONE_15_PRO_LAYOUT.screen.width,
      BASE_UNIT_IPHONE_15_PRO_LAYOUT.screen.height,
      BASE_UNIT_IPHONE_15_PRO_LAYOUT.screen.radius
    ),
    []
  );

  // Dynamic island geometry re-extrudes only when cutout parameters change
  const islandGeometry = useMemo(
    () => createRoundedPanelGeometry(
      unitLayout.dynamicIsland.width,
      unitLayout.dynamicIsland.height,
      unitLayout.dynamicIsland.radius,
      unitLayout.dynamicIsland.depth
    ),
    [
      unitLayout.dynamicIsland.width,
      unitLayout.dynamicIsland.height,
      unitLayout.dynamicIsland.radius,
      unitLayout.dynamicIsland.depth,
    ]
  );

  const rearGlassGeometry = useMemo(
    () => createRoundedPanelGeometry(
      BASE_UNIT_IPHONE_15_PRO_LAYOUT.rearGlass.width,
      BASE_UNIT_IPHONE_15_PRO_LAYOUT.rearGlass.height,
      BASE_UNIT_IPHONE_15_PRO_LAYOUT.rearGlass.radius,
      BASE_UNIT_IPHONE_15_PRO_LAYOUT.rearGlass.depth
    ),
    []
  );

  const plateauGeometry = useMemo(
    () => createRoundedPanelGeometry(
      BASE_UNIT_IPHONE_15_PRO_LAYOUT.camera.plateau.width,
      BASE_UNIT_IPHONE_15_PRO_LAYOUT.camera.plateau.height,
      BASE_UNIT_IPHONE_15_PRO_LAYOUT.camera.plateau.radius,
      BASE_UNIT_IPHONE_15_PRO_LAYOUT.camera.plateau.depth
    ),
    []
  );

  const barrel = useMemo(
    () => createCameraBarrelGeometry(
      BASE_UNIT_IPHONE_15_PRO_LAYOUT.camera.lenses[0].radius,
      BASE_UNIT_IPHONE_15_PRO_LAYOUT.camera.lenses[0].depth,
      BASE_UNIT_IPHONE_15_PRO_LAYOUT.camera.lenses[0].radius * 0.73
    ),
    []
  );

  const flashGeometry = useMemo(
    () => new THREE.CylinderGeometry(
      BASE_UNIT_IPHONE_15_PRO_LAYOUT.camera.flash.radius,
      BASE_UNIT_IPHONE_15_PRO_LAYOUT.camera.flash.radius * 0.92,
      BASE_UNIT_IPHONE_15_PRO_LAYOUT.camera.flash.depth,
      24
    ),
    []
  );

  const lidarGeometry = useMemo(
    () => new THREE.CylinderGeometry(
      BASE_UNIT_IPHONE_15_PRO_LAYOUT.camera.lidar.radius,
      BASE_UNIT_IPHONE_15_PRO_LAYOUT.camera.lidar.radius * 0.92,
      BASE_UNIT_IPHONE_15_PRO_LAYOUT.camera.lidar.depth,
      24
    ),
    []
  );

  const markGeometry = useMemo(
    () => createAppleMarkGeometry(
      BASE_UNIT_IPHONE_15_PRO_LAYOUT.appleMark.width,
      BASE_UNIT_IPHONE_15_PRO_LAYOUT.appleMark.height,
      BASE_UNIT_IPHONE_15_PRO_LAYOUT.appleMark.depth
    ),
    []
  );

  const actionGeometry = useMemo(
    () => createRoundedPanelGeometry(
      BASE_UNIT_IPHONE_15_PRO_LAYOUT.buttons.action.width,
      BASE_UNIT_IPHONE_15_PRO_LAYOUT.buttons.action.height,
      BASE_UNIT_IPHONE_15_PRO_LAYOUT.buttons.action.width / 2,
      BASE_UNIT_IPHONE_15_PRO_LAYOUT.buttons.action.depth
    ),
    []
  );

  const volumeGeometry = useMemo(
    () => createRoundedPanelGeometry(
      BASE_UNIT_IPHONE_15_PRO_LAYOUT.buttons.volumeUp.width,
      BASE_UNIT_IPHONE_15_PRO_LAYOUT.buttons.volumeUp.height,
      BASE_UNIT_IPHONE_15_PRO_LAYOUT.buttons.volumeUp.width / 2,
      BASE_UNIT_IPHONE_15_PRO_LAYOUT.buttons.volumeUp.depth
    ),
    []
  );

  const sideGeometry = useMemo(
    () => createRoundedPanelGeometry(
      BASE_UNIT_IPHONE_15_PRO_LAYOUT.buttons.side.width,
      BASE_UNIT_IPHONE_15_PRO_LAYOUT.buttons.side.height,
      BASE_UNIT_IPHONE_15_PRO_LAYOUT.buttons.side.width / 2,
      BASE_UNIT_IPHONE_15_PRO_LAYOUT.buttons.side.depth
    ),
    []
  );

  const shadowGeometry = useMemo(() => new THREE.CircleGeometry(1, 48), []);
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
  useDisposable(screenGeometry);
  useDisposable(islandGeometry);
  useDisposable(rearGlassGeometry);
  useDisposable(plateauGeometry);
  useDisposable(barrel.ring);
  useDisposable(barrel.glass);
  useDisposable(flashGeometry);
  useDisposable(lidarGeometry);
  useDisposable(markGeometry);
  useDisposable(actionGeometry);
  useDisposable(volumeGeometry);
  useDisposable(sideGeometry);
  useDisposable(shadowGeometry);
  useDisposable(shadowTexture);
  useDisposable(shadowMaterial);
  useDisposable(materials.reflectionTexture);
  useDisposable(materials.titanium);
  useDisposable(materials.rearGlass);
  useDisposable(materials.screenGlass);
  useDisposable(materials.reflection);
  useDisposable(materials.island);
  useDisposable(materials.lensRing);
  useDisposable(materials.lensGlass);
  useDisposable(materials.sensor);
  useDisposable(materials.flash);
  useDisposable(materials.appleMark);

  return (
    <group
      name="iphone-15-pro-device-frame"
      position={[0, 0, SCREEN_PLANE_Z]}
      scale={[scaleFactor, scaleFactor, scaleFactor]}
    >
      {settings.shadowEnabled && (
        <mesh
          name="iphone-device-shadow"
          geometry={shadowGeometry}
          material={shadowMaterial}
          position={[
            BASE_UNIT_IPHONE_15_PRO_LAYOUT.body.width * 0.025,
            -BASE_UNIT_IPHONE_15_PRO_LAYOUT.body.height * settings.shadowOffset,
            BASE_UNIT_IPHONE_15_PRO_LAYOUT.body.z - SCREEN_PLANE_Z - BASE_UNIT_IPHONE_15_PRO_LAYOUT.body.depth * 0.08,
          ]}
          scale={[
            BASE_UNIT_IPHONE_15_PRO_LAYOUT.body.width * (1.18 + settings.shadowBlur * 0.55),
            BASE_UNIT_IPHONE_15_PRO_LAYOUT.body.height * (0.32 + settings.shadowBlur * 0.16),
            1,
          ]}
          renderOrder={-2}
        />
      )}
      <mesh
        name="iphone-titanium-chassis"
        geometry={bodyGeometry}
        material={materials.titanium}
        position={[0, 0, BASE_UNIT_IPHONE_15_PRO_LAYOUT.body.z - SCREEN_PLANE_Z]}
        castShadow
        receiveShadow
      />
      <mesh
        name="iphone-rear-glass"
        geometry={rearGlassGeometry}
        material={materials.rearGlass}
        position={[0, 0, BASE_UNIT_IPHONE_15_PRO_LAYOUT.rearGlass.z - SCREEN_PLANE_Z]}
        castShadow
        receiveShadow
        renderOrder={materials.policy.renderOrder.rear}
      />
      <mesh
        name="iphone-black-bezel"
        geometry={bezelGeometry}
        material={materials.island}
        position={[0, 0, BASE_UNIT_IPHONE_15_PRO_LAYOUT.front.bezelZ - SCREEN_PLANE_Z]}
        castShadow
        receiveShadow
      />
      <mesh
        name="iphone-screen-glass"
        geometry={screenGeometry}
        material={materials.screenGlass}
        position={[0, 0, BASE_UNIT_IPHONE_15_PRO_LAYOUT.front.glassZ - SCREEN_PLANE_Z]}
        renderOrder={materials.policy.renderOrder.screenGlass}
      />
      <mesh
        name="iphone-screen-reflection"
        geometry={screenGeometry}
        material={materials.reflection}
        position={[0, 0, BASE_UNIT_IPHONE_15_PRO_LAYOUT.front.reflectionZ - SCREEN_PLANE_Z]}
        renderOrder={materials.policy.renderOrder.reflection}
      />
      {settings.cutoutStyle !== 'none' && (
        <mesh
          name="iphone-dynamic-island"
          geometry={islandGeometry}
          material={materials.island}
          position={[
            unitLayout.dynamicIsland.center.x,
            unitLayout.dynamicIsland.center.y,
            unitLayout.dynamicIsland.z - SCREEN_PLANE_Z,
          ]}
          renderOrder={materials.policy.renderOrder.dynamicIsland}
        />
      )}

      {settings.showSideButtons && (
        <group name="iphone-side-controls">
          <mesh
            name="iphone-action-button"
            geometry={actionGeometry}
            material={materials.titanium}
            position={[
              BASE_UNIT_IPHONE_15_PRO_LAYOUT.buttons.action.center.x,
              BASE_UNIT_IPHONE_15_PRO_LAYOUT.buttons.action.center.y,
              BASE_UNIT_IPHONE_15_PRO_LAYOUT.buttons.action.z - SCREEN_PLANE_Z,
            ]}
            castShadow
          />
          <mesh
            name="iphone-volume-up"
            geometry={volumeGeometry}
            material={materials.titanium}
            position={[
              BASE_UNIT_IPHONE_15_PRO_LAYOUT.buttons.volumeUp.center.x,
              BASE_UNIT_IPHONE_15_PRO_LAYOUT.buttons.volumeUp.center.y,
              BASE_UNIT_IPHONE_15_PRO_LAYOUT.buttons.volumeUp.z - SCREEN_PLANE_Z,
            ]}
            castShadow
          />
          <mesh
            name="iphone-volume-down"
            geometry={volumeGeometry}
            material={materials.titanium}
            position={[
              BASE_UNIT_IPHONE_15_PRO_LAYOUT.buttons.volumeDown.center.x,
              BASE_UNIT_IPHONE_15_PRO_LAYOUT.buttons.volumeDown.center.y,
              BASE_UNIT_IPHONE_15_PRO_LAYOUT.buttons.volumeDown.z - SCREEN_PLANE_Z,
            ]}
            castShadow
          />
          <mesh
            name="iphone-side-button"
            geometry={sideGeometry}
            material={materials.titanium}
            position={[
              BASE_UNIT_IPHONE_15_PRO_LAYOUT.buttons.side.center.x,
              BASE_UNIT_IPHONE_15_PRO_LAYOUT.buttons.side.center.y,
              BASE_UNIT_IPHONE_15_PRO_LAYOUT.buttons.side.z - SCREEN_PLANE_Z,
            ]}
            castShadow
          />
        </group>
      )}

      {settings.showRearCameras && (
        <group name="iphone-rear-camera-system">
          <mesh
            name="iphone-camera-plateau"
            geometry={plateauGeometry}
            material={materials.rearGlass}
            position={[
              BASE_UNIT_IPHONE_15_PRO_LAYOUT.camera.plateau.center.x,
              BASE_UNIT_IPHONE_15_PRO_LAYOUT.camera.plateau.center.y,
              BASE_UNIT_IPHONE_15_PRO_LAYOUT.camera.plateau.z - SCREEN_PLANE_Z,
            ]}
            castShadow
            receiveShadow
          />
          {BASE_UNIT_IPHONE_15_PRO_LAYOUT.camera.lenses.map((lens, index) => (
            <group
              key={`iphone-lens-${index}`}
              position={[lens.center.x, lens.center.y, lens.z - SCREEN_PLANE_Z]}
            >
              <mesh
                name={`iphone-lens-ring-${index}`}
                geometry={barrel.ring}
                material={materials.lensRing}
                position={[0, 0, barrel.positionZ]}
                castShadow
              />
              <mesh
                name={`iphone-lens-glass-${index}`}
                geometry={barrel.glass}
                material={materials.lensGlass}
                position={[0, 0, barrel.glassPositionZ]}
              />
            </group>
          ))}
          <mesh
            name="iphone-camera-flash"
            geometry={flashGeometry}
            material={materials.flash}
            position={[
              BASE_UNIT_IPHONE_15_PRO_LAYOUT.camera.flash.center.x,
              BASE_UNIT_IPHONE_15_PRO_LAYOUT.camera.flash.center.y,
              BASE_UNIT_IPHONE_15_PRO_LAYOUT.camera.flash.z - SCREEN_PLANE_Z,
            ]}
            rotation={[Math.PI / 2, 0, 0]}
          />
          <mesh
            name="iphone-camera-lidar"
            geometry={lidarGeometry}
            material={materials.sensor}
            position={[
              BASE_UNIT_IPHONE_15_PRO_LAYOUT.camera.lidar.center.x,
              BASE_UNIT_IPHONE_15_PRO_LAYOUT.camera.lidar.center.y,
              BASE_UNIT_IPHONE_15_PRO_LAYOUT.camera.lidar.z - SCREEN_PLANE_Z,
            ]}
            rotation={[Math.PI / 2, 0, 0]}
          />
        </group>
      )}
      <mesh
        name="iphone-apple-mark"
        geometry={markGeometry}
        material={materials.appleMark}
        position={[
          BASE_UNIT_IPHONE_15_PRO_LAYOUT.appleMark.center.x,
          BASE_UNIT_IPHONE_15_PRO_LAYOUT.appleMark.center.y,
          BASE_UNIT_IPHONE_15_PRO_LAYOUT.appleMark.z - SCREEN_PLANE_Z,
        ]}
      />
    </group>
  );
}
