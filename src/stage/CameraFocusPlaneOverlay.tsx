import React, { useRef, useState } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import type { EvaluatedCameraOptics } from '../engine/evaluateCameraOptics';
import type { EvaluatedCamera } from '../engine/evaluateCamera';
import { useProjectStore } from '../store/useProjectStore';

interface CameraFocusPlaneOverlayProps {
  optics: EvaluatedCameraOptics;
  camera: EvaluatedCamera;
  shotId: string;
}

export const CameraFocusPlaneOverlay: React.FC<CameraFocusPlaneOverlayProps> = ({
  optics,
  camera,
  shotId,
}) => {
  const { updateShot } = useProjectStore();
  useThree(); // Ensures inside R3F canvas context
  const [isDragging, setIsDragging] = useState(false);
  const dragPlaneRef = useRef<THREE.Group>(null);

  if (!optics?.enabled || !optics?.showFocusPlane || !camera) {
    return null;
  }

  const posX = camera.position?.x ?? 0;
  const posY = camera.position?.y ?? 0;
  const posZ = camera.position?.z ?? 2.65;

  const rotX = camera.rotation?.x ?? 0;
  const rotY = camera.rotation?.y ?? 0;
  const rotZ = camera.rotation?.z ?? 0;

  // Calculate position along camera forward vector
  const camPos = new THREE.Vector3(posX, posY, posZ);
  const camDir = new THREE.Vector3(0, 0, -1).applyEuler(
    new THREE.Euler(
      (rotX * Math.PI) / 180,
      (rotY * Math.PI) / 180,
      (rotZ * Math.PI) / 180,
      'YXZ'
    )
  );

  const focusPlanePos = camPos.clone().add(camDir.clone().multiplyScalar(optics.resolvedFocusDistance));
  const nearPlanePos = camPos.clone().add(camDir.clone().multiplyScalar(optics.nearFocusDistance));
  const farPlanePos = camPos.clone().add(camDir.clone().multiplyScalar(optics.farFocusDistance));

  const planeRotation = new THREE.Euler(
    (rotX * Math.PI) / 180,
    (rotY * Math.PI) / 180,
    (rotZ * Math.PI) / 180,
    'YXZ'
  );

  const handlePointerDown = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    setIsDragging(true);
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  const handlePointerMove = (e: { point: THREE.Vector3 }) => {
    if (!isDragging) return;
    const dist = e.point.distanceTo(camPos);
    if (dist >= 0.1 && dist <= 20) {
      updateShot(shotId, (s) => ({
        ...s,
        cameraOptics: {
          ...s.cameraOptics!,
          focusMode: 'manual',
          focusDistance: Number(dist.toFixed(2)),
        },
      }));
    }
  };

  return (
    <group ref={dragPlaneRef}>
      {/* Primary Focus Plane */}
      <group position={focusPlanePos} rotation={planeRotation}>
        <mesh
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerMove={handlePointerMove}
        >
          <planeGeometry args={[1.8, 1.0]} />
          <meshBasicMaterial
            color="#00e5ff"
            transparent
            opacity={isDragging ? 0.25 : 0.12}
            side={THREE.DoubleSide}
            depthTest={false}
          />
        </mesh>

        {/* Outer Cyan Wireframe Border */}
        <lineSegments>
          <edgesGeometry args={[new THREE.PlaneGeometry(1.8, 1.0)]} />
          <lineBasicMaterial color="#00e5ff" linewidth={2} depthTest={false} />
        </lineSegments>

        {/* Center Target Diamond Handle */}
        <mesh position={[0, 0, 0.001]} scale={isDragging ? [0.08, 0.08, 1] : [0.06, 0.06, 1]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial color="#ffffff" side={THREE.DoubleSide} depthTest={false} />
        </mesh>
      </group>

      {/* Near Depth-of-Field Boundary Plane */}
      <group position={nearPlanePos} rotation={planeRotation}>
        <lineSegments>
          <edgesGeometry args={[new THREE.PlaneGeometry(1.6, 0.9)]} />
          <lineBasicMaterial color="#00e5ff" transparent opacity={0.35} depthTest={false} />
        </lineSegments>
      </group>

      {/* Far Depth-of-Field Boundary Plane */}
      <group position={farPlanePos} rotation={planeRotation}>
        <lineSegments>
          <edgesGeometry args={[new THREE.PlaneGeometry(1.6, 0.9)]} />
          <lineBasicMaterial color="#00e5ff" transparent opacity={0.25} depthTest={false} />
        </lineSegments>
      </group>
    </group>
  );
};
