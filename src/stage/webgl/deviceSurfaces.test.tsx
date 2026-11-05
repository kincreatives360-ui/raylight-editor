import React, { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_DEVICE_FRAME_SETTINGS, getDeviceFrameMetrics, SCREEN_PLANE_Z } from '../../model/deviceFrame';
import type { DeviceFrameSettings } from '../../model/types';
import { DeviceScreenSurface } from './DeviceScreenSurface';
import { DeviceContactShadow } from './DeviceContactShadow';
import { PhoneDeviceFrame } from './PhoneDeviceFrame';
import { SamsungGalaxyFrame } from './SamsungGalaxyFrame';
import { IPadProFrame } from './IPadProFrame';
import { BrowserFrame } from './BrowserFrame';
import { MacBookProFrame } from './MacBookProFrame';
import { StudioDisplayFrame } from './StudioDisplayFrame';
import { DetailedIPhone15ProFrame } from './DetailedIPhone15ProFrame';
import { AndroidFlagshipFrame } from './AndroidFlagshipFrame';
import { BASE_UNIT_IPHONE_15_PRO_LAYOUT as iphone } from './iphone15ProLayout';
import { getPhoneLayout } from './phoneLayout';
import { useDeviceScreenMaterials } from './useDeviceScreenMaterials';

const lifecycle = vi.hoisted(() => ({ cleanups: [] as (() => void)[] }));
vi.mock('react', async importOriginal => ({
  ...await importOriginal<typeof React>(),
  useMemo: (create: () => unknown) => create(),
  useEffect: (effect: () => (() => void) | void) => {
    const cleanup = effect();
    if (cleanup) lifecycle.cleanups.push(cleanup);
  },
}));

afterEach(() => {
  lifecycle.cleanups.splice(0).forEach(cleanup => cleanup());
  vi.restoreAllMocks();
});

// Expand the actual JSX into Three objects without a GPU, keeping every parent transform.
function mount(node: ReactNode, parent = new THREE.Group()): THREE.Group {
  Children.forEach(node, child => {
    if (!isValidElement(child)) return;
    const element = child as ReactElement<{
      children?: ReactNode; name?: string; geometry?: THREE.BufferGeometry; material?: THREE.Material;
      position?: [number, number, number]; scale?: [number, number, number];
      rotation?: [number, number, number]; renderOrder?: number;
    }>;
    if (element.type === React.Fragment) {
      mount(element.props.children, parent);
      return;
    }
    if (typeof element.type === 'function') {
      mount((element.type as (props: typeof element.props) => ReactNode)(element.props), parent);
      return;
    }
    const object = element.type === 'mesh'
      ? new THREE.Mesh(element.props.geometry, element.props.material)
      : new THREE.Group();
    const props = element.props;
    object.name = props.name ?? '';
    if (props.position) object.position.fromArray(props.position);
    if (props.scale) object.scale.fromArray(props.scale);
    if (props.rotation) object.rotation.set(...props.rotation);
    object.renderOrder = props.renderOrder ?? 0;
    parent.add(object);
    mount(props.children, object as THREE.Group);
  });
  parent.updateMatrixWorld(true);
  return parent;
}

const settings: DeviceFrameSettings = {
  ...DEFAULT_DEVICE_FRAME_SETTINGS, enabled: true, glassTint: '#879abc',
  glassOpacity: 0.8, glassRoughness: 0.01, reflection: 0.9,
  shadowEnabled: true, shadowOpacity: 0.6, shadowBlur: 0.4, shadowOffset: 0.2,
};
const metrics = getDeviceFrameMetrics(0.4, 0.8, settings);
const rotation = { x: Math.PI / 3, y: 0, z: 0 };
const common = { settings, metrics, rotation };
function mesh(scene: THREE.Group, name: string) {
  const result = scene.getObjectByName(name);
  expect(result).toBeInstanceOf(THREE.Mesh);
  return result as THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>;
}

describe('device surface compatibility', () => {
  it.each([
    ['Galaxy', SamsungGalaxyFrame, 'galaxy'],
    ['iPad', IPadProFrame, 'ipad'],
    ['MacBook', MacBookProFrame, 'macbook'],
    ['Studio Display', StudioDisplayFrame, 'display'],
    ['Browser', BrowserFrame, 'browser'],
  ] as const)('retains %s material settings and surface offsets', (_label, Frame, prefix) => {
    const scene = mount(<Frame {...common} />);
    const glass = mesh(scene, `${prefix}-screen-glass`);
    const reflection = mesh(scene, `${prefix}-screen-reflection`);
    const browser = prefix === 'browser';
    expect(glass.geometry).toBe(reflection.geometry);
    expect(glass.parent).toBe(reflection.parent);
    expect(glass.material.color.getHexString()).toBe('879abc');
    expect(glass.material).toMatchObject({
      opacity: browser ? 0.4 : 0.8, roughness: 0.01, metalness: 0,
      clearcoat: browser ? 0.8 : 1, clearcoatRoughness: browser ? 0 : 0.01,
      depthWrite: false, transparent: true, side: THREE.FrontSide, blending: THREE.NormalBlending,
    });
    expect(reflection.material).toMatchObject({
      opacity: settings.reflection * (browser ? 0.5 : 0.75), depthWrite: false,
      transparent: true, side: THREE.FrontSide, blending: THREE.NormalBlending,
    });
    expect(glass.getWorldPosition(new THREE.Vector3()).z).toBeCloseTo(SCREEN_PLANE_Z + 0.0005, 12);
    expect(reflection.getWorldPosition(new THREE.Vector3()).z).toBeCloseTo(SCREEN_PLANE_Z + 0.001, 12);
    expect(glass.renderOrder).toBe(0);
    expect(reflection.renderOrder).toBe(0);
  });

  it('preserves legacy additive double-sided glass and its layout offsets', () => {
    const legacy = { ...settings, geometryVersion: undefined };
    const layout = getPhoneLayout(metrics, legacy);
    const scene = mount(<PhoneDeviceFrame {...common} settings={legacy} />);
    const root = scene.children[0];
    const overlays = root.children.filter(child => child instanceof THREE.Mesh &&
      child.material.blending === THREE.AdditiveBlending) as THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>[];
    expect(overlays).toHaveLength(2);
    expect(overlays[0].geometry).toBe(overlays[1].geometry);
    expect(overlays[0].material).toMatchObject({ opacity: 0.2, roughness: 0.02, clearcoatRoughness: 0.02, side: THREE.DoubleSide });
    expect(overlays[1].material.opacity).toBe(0.5);
    expect(overlays[0].position.z).toBe(layout.glassZ);
    expect(overlays[1].position.z).toBe(layout.reflectionZ);
    const shadow = root.children.find(child => child.renderOrder === -2) as THREE.Mesh<THREE.CircleGeometry>;
    expect(shadow.geometry.parameters.segments).toBe(64);
    expect(shadow.position.toArray()).toEqual([metrics.bodyWidth * 0.025, -metrics.bodyHeight * settings.shadowOffset, layout.bodyZ - layout.depth * 0.08 - layout.proud]);
  });

  it('keeps the detailed iPhone material policy and unit-scaled parent', () => {
    const scene = mount(<DetailedIPhone15ProFrame {...common} />);
    const glass = mesh(scene, 'iphone-screen-glass');
    const reflection = mesh(scene, 'iphone-screen-reflection');
    expect(glass.renderOrder).toBe(20);
    expect(reflection.renderOrder).toBe(21);
    expect(glass.material).toMatchObject({ opacity: 0.12, roughness: 0.04, clearcoatRoughness: 0.08, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    expect(glass.parent!.scale.toArray()).toEqual([metrics.bodyHeight, metrics.bodyHeight, metrics.bodyHeight]);
    expect(glass.position.z).toBe(iphone.front.glassZ - SCREEN_PLANE_Z);
    expect(reflection.position.z).toBe(iphone.front.reflectionZ - SCREEN_PLANE_Z);
    const shadow = mesh(scene, 'iphone-device-shadow');
    expect(shadow.parent).toBe(glass.parent);
    expect(shadow.position.z).toBe(iphone.body.z - SCREEN_PLANE_Z - iphone.body.depth * 0.08);
    expect(shadow.material.opacity).toBeCloseTo(0.3);
  });

  it('keeps Android glass-only and its unattenuated double-sided shadow', () => {
    const scene = mount(<AndroidFlagshipFrame {...common} rotation={{ x: 0, y: Math.PI, z: 0 }} />);
    const glass = mesh(scene, 'android-screen-glass');
    expect(glass.material).toMatchObject({ opacity: 0.2, roughness: 0.02, clearcoatRoughness: 0.02, side: THREE.FrontSide, blending: THREE.AdditiveBlending });
    expect(glass.renderOrder).toBe(3);
    expect(scene.getObjectByName('android-screen-reflection')).toBeUndefined();
    const shadow = mesh(scene, 'android-device-shadow');
    expect(shadow.material).toMatchObject({ opacity: 0.6, side: THREE.DoubleSide });
    expect((shadow.geometry as THREE.CircleGeometry).parameters.segments).toBe(64);
  });
});

describe('device contact shadow compatibility and ownership', () => {
  it.each([
    ['Samsung Galaxy', SamsungGalaxyFrame, 'galaxy-device-shadow'], ['iPad Pro', IPadProFrame, 'ipad-device-shadow'],
    ['Browser', BrowserFrame, 'browser-window-shadow'], ['Studio Display', StudioDisplayFrame, 'display-foot-shadow'],
    ['MacBook Pro', MacBookProFrame, 'macbook-contact-shadow'], ['iPhone 15 Pro', DetailedIPhone15ProFrame, 'iphone-device-shadow'],
  ] as const)('fades and hides the %s shadow at the existing threshold', (_label, Frame, name) => {
    const front = mesh(mount(<Frame {...common} />), name);
    expect(front.material).toMatchObject({ side: THREE.FrontSide, depthWrite: false, transparent: true });
    expect(front.material.opacity).toBeCloseTo(0.3);
    expect(front.renderOrder).toBe(-2);
    expect(mount(<Frame {...common} rotation={{ x: 0, y: Math.PI, z: 0 }} />).getObjectByName(name)).toBeUndefined();
    expect(mount(<Frame {...common} settings={{ ...settings, shadowOpacity: 0.001 }} rotation={undefined} />).getObjectByName(name)).toBeUndefined();
    expect(mount(<Frame {...common} settings={{ ...settings, shadowEnabled: false }} />).getObjectByName(name)).toBeUndefined();
  });

  it('retains the MacBook shadow inside the rotating base and Display shadow under its foot', () => {
    const laptop = mesh(mount(<MacBookProFrame {...common} />), 'macbook-contact-shadow');
    expect(laptop.parent!.rotation.x).toBeCloseTo(-((180 - (settings.lidAngle ?? 110)) * Math.PI) / 180);
    expect(laptop.position.y).toBe(-metrics.bodyHeight * 0.94 / 2);
    expect(laptop.rotation.x).toBe(-Math.PI / 2);
    const display = mesh(mount(<StudioDisplayFrame {...common} />), 'display-foot-shadow');
    const depth = Math.max(0.006, metrics.bodyDepth * 0.8);
    expect(display.parent!.position.z).toBe(SCREEN_PLANE_Z - depth);
    expect(display.position.y).toBe(-metrics.bodyHeight / 2 - metrics.bodyHeight * 0.42 * 0.65 - depth * 0.35 / 2 - 0.002);
    expect(display.rotation.x).toBe(-Math.PI / 2);
  });

  it('disposes its texture, material and geometry once even when the shadow is hidden', () => {
    const texture = new THREE.Texture();
    const textureDispose = vi.spyOn(texture, 'dispose');
    const geometryDispose = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose');
    const materialDispose = vi.spyOn(THREE.Material.prototype, 'dispose');
    expect(DeviceContactShadow({ visible: false, opacity: 0, textureFactory: () => texture })).toBeNull();
    lifecycle.cleanups.splice(0).forEach(cleanup => cleanup());
    expect(textureDispose).toHaveBeenCalledOnce();
    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
  });

  it('surface meshes borrow geometry and materials without taking disposal ownership', () => {
    const geometry = new THREE.PlaneGeometry(1, 1);
    const material = new THREE.MeshBasicMaterial();
    const disposeGeometry = vi.spyOn(geometry, 'dispose');
    const disposeMaterial = vi.spyOn(material, 'dispose');
    const scene = mount(DeviceScreenSurface({ geometry, glass: { material }, reflection: { material } }));
    expect(scene.children).toHaveLength(2);
    expect(lifecycle.cleanups).toHaveLength(0);
    expect(disposeGeometry).not.toHaveBeenCalled();
    expect(disposeMaterial).not.toHaveBeenCalled();
    geometry.dispose(); material.dispose();
  });

  it('the shared screen hook owns and disposes only its two materials and reflection texture', () => {
    const { glassMaterial, reflectionMaterial } = useDeviceScreenMaterials(settings);
    const glassDispose = vi.spyOn(glassMaterial, 'dispose');
    const reflectionDispose = vi.spyOn(reflectionMaterial, 'dispose');
    const textureDispose = vi.spyOn(reflectionMaterial.map!, 'dispose');
    lifecycle.cleanups.splice(0).forEach(cleanup => cleanup());
    expect(glassDispose).toHaveBeenCalledOnce();
    expect(reflectionDispose).toHaveBeenCalledOnce();
    expect(textureDispose).toHaveBeenCalledOnce();
  });
});
