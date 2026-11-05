import type { ThreeElements } from '@react-three/fiber';
import type { BufferGeometry, Material } from 'three';

type SurfaceLayer = Pick<ThreeElements['mesh'], 'name' | 'position' | 'renderOrder'> & {
  material: Material;
};

// Geometry and materials remain owned by the caller; a fragment keeps its coordinate system.
export function DeviceScreenSurface({ geometry, glass, reflection }: {
  geometry: BufferGeometry;
  glass: SurfaceLayer;
  reflection?: SurfaceLayer;
}) {
  return <>
    <mesh geometry={geometry} {...glass} />
    {reflection && <mesh geometry={geometry} {...reflection} />}
  </>;
}
