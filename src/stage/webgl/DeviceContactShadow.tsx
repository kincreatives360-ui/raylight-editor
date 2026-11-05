import { useMemo } from 'react';
import type { ThreeElements } from '@react-three/fiber';
import * as THREE from 'three';
import { createShadowTexture } from './deviceTextures';
import { useDisposable } from './useDisposable';

type ShadowProps = Pick<ThreeElements['mesh'], 'name' | 'position' | 'scale' | 'rotation' | 'renderOrder'> & {
  visible: boolean;
  opacity: number;
  segments?: number;
  side?: THREE.Side;
  textureFactory?: () => THREE.Texture;
};

export function DeviceContactShadow({
  visible, opacity, segments = 48, side = THREE.FrontSide,
  textureFactory = createShadowTexture, ...transform
}: ShadowProps) {
  const texture = useMemo(() => textureFactory(), [textureFactory]);
  const geometry = useMemo(() => new THREE.CircleGeometry(1, segments), [segments]);
  const material = useMemo(() => new THREE.MeshBasicMaterial({
    map: texture, transparent: true, opacity, depthWrite: false, side,
  }), [texture, opacity, side]);
  useDisposable(texture);
  useDisposable(geometry);
  useDisposable(material);
  return visible ? <mesh geometry={geometry} material={material} {...transform} /> : null;
}
