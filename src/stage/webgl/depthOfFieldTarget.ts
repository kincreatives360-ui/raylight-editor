import * as THREE from 'three';
import type { Vec3 } from '../../model/types';

export function resolveDepthOfFieldWorldTarget(
    camera: THREE.Camera,
    target: Vec3,
    subjectPosition?: Vec3
): THREE.Vector3 {
    if (subjectPosition) {
        return new THREE.Vector3(subjectPosition.x, subjectPosition.y, subjectPosition.z);
    }

    camera.updateMatrixWorld(true);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(target.x, target.y), camera);
    const focusPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -target.z);
    const intersection = raycaster.ray.intersectPlane(focusPlane, new THREE.Vector3());
    if (intersection && [intersection.x, intersection.y, intersection.z].every(Number.isFinite)) {
        return intersection;
    }

    const origin = camera.getWorldPosition(new THREE.Vector3());
    const direction = camera.getWorldDirection(new THREE.Vector3());
    return origin.addScaledVector(direction, Math.max(0.1, Math.abs(target.z - origin.z)));
}

export function resolveVisibleDepthOfFieldSubjectPosition(
    focusMode: 'point' | 'subject' | undefined,
    focusTargetId: string | undefined,
    layers: ReadonlyArray<{ id: string; visible: boolean; position: Vec3 }>
): Vec3 | undefined {
    if (focusMode !== 'subject' || !focusTargetId) return undefined;
    const subject = layers.find((layer) => layer.id === focusTargetId && layer.visible);
    return subject ? { ...subject.position } : undefined;
}
