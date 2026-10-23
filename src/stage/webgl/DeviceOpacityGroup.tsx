import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { createDeviceFadeMaterial, renderDeviceToTarget } from './deviceFadePass';

export function DeviceOpacityGroup({ opacity, children }: { opacity: number; children: ReactNode }) {
  const source = useRef<THREE.Group>(null);
  const { gl, scene, camera } = useThree();
  const fading = opacity > 0 && opacity < 1;
  const target = useMemo(() => {
    if (!fading) return null;
    return new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      depthTexture: new THREE.DepthTexture(1, 1, THREE.UnsignedIntType),
      samples: Math.min(4, gl.capabilities.maxSamples),
    });
  }, [fading, gl]);
  const material = useMemo(() => target ? createDeviceFadeMaterial(target) : null, [target]);
  const geometry = useMemo(() => new THREE.PlaneGeometry(2, 2), []);
  const bufferSize = useMemo(() => new THREE.Vector2(), []);

  useEffect(() => () => { target?.dispose(); }, [target]);
  useEffect(() => () => { material?.dispose(); }, [material]);
  useEffect(() => () => { geometry.dispose(); }, [geometry]);

  const capture = () => {
    if (!target || !material || !source.current) return;
    updateDeviceCapture(gl, scene, camera, source.current, target, material, bufferSize, opacity);
  };

  return <>
    <group ref={source} visible={!fading} userData={{ deviceOpacityFading: fading, capture }} name="device-opacity-source">{children}</group>
    {material && <mesh geometry={geometry} material={material} frustumCulled={false} raycast={() => {}} />}
  </>;
}

function updateDeviceCapture(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera,
  source: THREE.Group, target: THREE.WebGLRenderTarget, material: THREE.ShaderMaterial,
  bufferSize: THREE.Vector2, opacity: number) {
  gl.getDrawingBufferSize(bufferSize);
  if (target.width !== bufferSize.x || target.height !== bufferSize.y) target.setSize(bufferSize.x, bufferSize.y);
  material.uniforms.layerOpacity.value = opacity;
  renderDeviceToTarget(gl, scene, camera, source, target);
}
