import React, { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { useSelectionStore } from '../store/useSelectionStore';
import { useProjectStore } from '../store/useProjectStore';

interface CameraFocusControllerProps {
  shotId: string;
}

export const CameraFocusController: React.FC<CameraFocusControllerProps> = ({ shotId }) => {
  const { activeTool, setActiveTool } = useSelectionStore();
  const { updateShot } = useProjectStore();
  const { camera, scene, raycaster, pointer } = useThree();

  useEffect(() => {
    if (activeTool !== 'focus') return;

    const handlePointerMove = () => {
      raycaster.setFromCamera(pointer, camera);
      raycaster.intersectObjects(scene.children, true);
    };

    window.addEventListener('pointermove', handlePointerMove);
    return () => window.removeEventListener('pointermove', handlePointerMove);
  }, [activeTool, camera, pointer, raycaster, scene]);

  if (activeTool !== 'focus') return null;

  const handlePointerDown = (e: { stopPropagation: () => void; nativeEvent: MouseEvent }) => {
    e.stopPropagation();

    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);
    const validHit = intersects.find(
      (hit) => hit.object.type === 'Mesh' && hit.distance > 0.05
    );

    if (validHit) {
      const dist = Number(validHit.distance.toFixed(2));

      updateShot(shotId, (s) => ({
        ...s,
        cameraOptics: {
          enabled: true,
          focusMode: 'manual',
          focusDistance: dist,
          focalLength: s.cameraOptics?.focalLength ?? 50,
          aperture: s.cameraOptics?.aperture ?? 2.8,
          sensorFormat: s.cameraOptics?.sensorFormat ?? 'full-frame',
          bokehQuality: s.cameraOptics?.bokehQuality ?? 'medium',
          bokehShape: s.cameraOptics?.bokehShape ?? 'circular',
          showFocusPlane: true,
        },
      }));

      // Return to select tool asynchronously to prevent React root unmount collisions during event tick
      if (!e.nativeEvent.shiftKey) {
        setTimeout(() => {
          setActiveTool('select');
        }, 0);
      }
    }
  };

  return (
    <mesh position={[0, 0, -0.01]} onPointerDown={handlePointerDown}>
      <planeGeometry args={[100, 100]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  );
};
