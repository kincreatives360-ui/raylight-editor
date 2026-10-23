import { useMemo } from 'react';
import * as THREE from 'three';
import type { DeviceFrameSettings } from '../../model/types';
import type { DeviceFrameMetrics } from '../../model/deviceFrame';
import { createAppleMarkGeometry, createBezelGeometry, createBodyGeometry, createCameraBarrelGeometry, createRoundedPanelGeometry, createScreenGeometry } from './phoneGeometry';
import { getIPhone15ProLayout } from './iphone15ProLayout';
import { createDeviceShadowTexture, createIPhone15ProMaterials } from './iphone15ProMaterials';
import { useDisposable } from './useDisposable';

export function DetailedIPhone15ProFrame({ metrics, settings }: { metrics: DeviceFrameMetrics; settings: DeviceFrameSettings }) {
  const layout = useMemo(() => getIPhone15ProLayout(metrics, settings), [metrics, settings]);
  const materials = useMemo(() => createIPhone15ProMaterials(settings), [settings]);
  const shadowTexture = useMemo(() => createDeviceShadowTexture(), []);
  const bodyGeometry = useMemo(() => createBodyGeometry(layout.body.width, layout.body.height, layout.body.cornerRadius, layout.body.depth, true), [layout]);
  const bezelGeometry = useMemo(() => createBezelGeometry(layout.body.width, layout.body.height, layout.body.cornerRadius, layout.screen.width, layout.screen.height, layout.screen.radius, layout.front.screenOverlap, layout.front.bezelDepth), [layout]);
  const screenGeometry = useMemo(() => createScreenGeometry(layout.screen.width, layout.screen.height, layout.screen.radius), [layout]);
  const islandGeometry = useMemo(() => createRoundedPanelGeometry(layout.dynamicIsland.width, layout.dynamicIsland.height, layout.dynamicIsland.radius, layout.dynamicIsland.depth), [layout]);
  const rearGlassGeometry = useMemo(() => createRoundedPanelGeometry(layout.rearGlass.width, layout.rearGlass.height, layout.rearGlass.radius, layout.rearGlass.depth), [layout]);
  const plateauGeometry = useMemo(() => createRoundedPanelGeometry(layout.camera.plateau.width, layout.camera.plateau.height, layout.camera.plateau.radius, layout.camera.plateau.depth), [layout]);
  const barrel = useMemo(() => createCameraBarrelGeometry(layout.camera.lenses[0].radius, layout.camera.lenses[0].depth, layout.camera.lenses[0].radius * 0.73), [layout]);
  const flashGeometry = useMemo(() => new THREE.CylinderGeometry(layout.camera.flash.radius, layout.camera.flash.radius * 0.92, layout.camera.flash.depth, 24), [layout]);
  const lidarGeometry = useMemo(() => new THREE.CylinderGeometry(layout.camera.lidar.radius, layout.camera.lidar.radius * 0.92, layout.camera.lidar.depth, 24), [layout]);
  const markGeometry = useMemo(() => createAppleMarkGeometry(layout.appleMark.width, layout.appleMark.height, layout.appleMark.depth), [layout]);
  const actionGeometry = useMemo(() => createRoundedPanelGeometry(layout.buttons.action.width, layout.buttons.action.height, layout.buttons.action.width / 2, layout.buttons.action.depth), [layout]);
  const volumeGeometry = useMemo(() => createRoundedPanelGeometry(layout.buttons.volumeUp.width, layout.buttons.volumeUp.height, layout.buttons.volumeUp.width / 2, layout.buttons.volumeUp.depth), [layout]);
  const sideGeometry = useMemo(() => createRoundedPanelGeometry(layout.buttons.side.width, layout.buttons.side.height, layout.buttons.side.width / 2, layout.buttons.side.depth), [layout]);
  const shadowGeometry = useMemo(() => new THREE.CircleGeometry(1, 48), []);
  const shadowMaterial = useMemo(() => new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, opacity: settings.shadowOpacity, depthWrite: false, side: THREE.DoubleSide }), [settings.shadowOpacity, shadowTexture]);

  useDisposable(bodyGeometry); useDisposable(bezelGeometry); useDisposable(screenGeometry); useDisposable(islandGeometry); useDisposable(rearGlassGeometry); useDisposable(plateauGeometry); useDisposable(barrel.ring); useDisposable(barrel.glass); useDisposable(flashGeometry); useDisposable(lidarGeometry); useDisposable(markGeometry); useDisposable(actionGeometry); useDisposable(volumeGeometry); useDisposable(sideGeometry); useDisposable(shadowGeometry);
  useDisposable(shadowTexture); useDisposable(shadowMaterial); useDisposable(materials.reflectionTexture); useDisposable(materials.titanium); useDisposable(materials.rearGlass); useDisposable(materials.screenGlass); useDisposable(materials.reflection); useDisposable(materials.island); useDisposable(materials.lensRing); useDisposable(materials.lensGlass); useDisposable(materials.sensor); useDisposable(materials.flash); useDisposable(materials.appleMark);

  return <group name="iphone-15-pro-device-frame">
    {settings.shadowEnabled && <mesh name="iphone-device-shadow" geometry={shadowGeometry} material={shadowMaterial}
      position={[layout.body.width * 0.025, -layout.body.height * settings.shadowOffset, layout.body.z - layout.body.depth * 0.08]}
      scale={[layout.body.width * (1.18 + settings.shadowBlur * 0.55), layout.body.height * (0.32 + settings.shadowBlur * 0.16), 1]} renderOrder={-2} />}
    <mesh name="iphone-titanium-chassis" geometry={bodyGeometry} material={materials.titanium} position={[0, 0, layout.body.z]} castShadow receiveShadow />
    <mesh name="iphone-rear-glass" geometry={rearGlassGeometry} material={materials.rearGlass} position={[0, 0, layout.rearGlass.z]} castShadow receiveShadow renderOrder={materials.policy.renderOrder.rear} />
    <mesh name="iphone-black-bezel" geometry={bezelGeometry} material={materials.island} position={[0, 0, layout.front.bezelZ]} castShadow receiveShadow />
    <mesh name="iphone-screen-glass" geometry={screenGeometry} material={materials.screenGlass} position={[0, 0, layout.front.glassZ]} renderOrder={materials.policy.renderOrder.screenGlass} />
    <mesh name="iphone-screen-reflection" geometry={screenGeometry} material={materials.reflection} position={[0, 0, layout.front.reflectionZ]} renderOrder={materials.policy.renderOrder.reflection} />
    {settings.cutoutStyle === 'dynamic-island' && <mesh name="iphone-dynamic-island" geometry={islandGeometry} material={materials.island} position={[layout.dynamicIsland.center.x, layout.dynamicIsland.center.y, layout.dynamicIsland.z]} renderOrder={materials.policy.renderOrder.dynamicIsland} />}

    {settings.showSideButtons && <group name="iphone-side-controls">
      <mesh name="iphone-action-button" geometry={actionGeometry} material={materials.titanium} position={[layout.buttons.action.center.x, layout.buttons.action.center.y, layout.buttons.action.z]} castShadow />
      <mesh name="iphone-volume-up" geometry={volumeGeometry} material={materials.titanium} position={[layout.buttons.volumeUp.center.x, layout.buttons.volumeUp.center.y, layout.buttons.volumeUp.z]} castShadow />
      <mesh name="iphone-volume-down" geometry={volumeGeometry} material={materials.titanium} position={[layout.buttons.volumeDown.center.x, layout.buttons.volumeDown.center.y, layout.buttons.volumeDown.z]} castShadow />
      <mesh name="iphone-side-button" geometry={sideGeometry} material={materials.titanium} position={[layout.buttons.side.center.x, layout.buttons.side.center.y, layout.buttons.side.z]} castShadow />
    </group>}

    {settings.showRearCameras && <group name="iphone-rear-camera-system">
      <mesh name="iphone-camera-plateau" geometry={plateauGeometry} material={materials.rearGlass} position={[layout.camera.plateau.center.x, layout.camera.plateau.center.y, layout.camera.plateau.z]} castShadow receiveShadow />
      {layout.camera.lenses.map((lens, index) => <group key={`iphone-lens-${index}`} position={[lens.center.x, lens.center.y, lens.z]}>
        <mesh name={`iphone-lens-ring-${index}`} geometry={barrel.ring} material={materials.lensRing} position={[0, 0, barrel.positionZ]} castShadow />
        <mesh name={`iphone-lens-glass-${index}`} geometry={barrel.glass} material={materials.lensGlass} position={[0, 0, barrel.glassPositionZ]} />
      </group>)}
      <mesh name="iphone-camera-flash" geometry={flashGeometry} material={materials.flash} position={[layout.camera.flash.center.x, layout.camera.flash.center.y, layout.camera.flash.z]} rotation={[Math.PI / 2, 0, 0]} />
      <mesh name="iphone-camera-lidar" geometry={lidarGeometry} material={materials.sensor} position={[layout.camera.lidar.center.x, layout.camera.lidar.center.y, layout.camera.lidar.z]} rotation={[Math.PI / 2, 0, 0]} />
    </group>}
    <mesh name="iphone-apple-mark" geometry={markGeometry} material={materials.appleMark} position={[layout.appleMark.center.x, layout.appleMark.center.y, layout.appleMark.z]} />
  </group>;
}
