import { createVirtualCamera, projectWorldToScreen } from './lightingMath';
import { getReferencePlaneDimensions, type EvaluatedCameraPose } from './webgl/cameraMath.ts';

export interface FocusPoint {
    x: number;
    y: number;
}

export function projectFocusPlane(
    targetZ: number,
    cameraPose: EvaluatedCameraPose,
    frameWidth: number,
    frameHeight: number,
    targetAspect: number
): FocusPoint[] {
    if (
        !Number.isFinite(targetZ) ||
        !Number.isFinite(frameWidth) ||
        !Number.isFinite(frameHeight) ||
        !Number.isFinite(targetAspect) ||
        frameWidth <= 0 ||
        frameHeight <= 0 ||
        targetAspect <= 0 ||
        !cameraPose ||
        ![
            cameraPose.position?.x,
            cameraPose.position?.y,
            cameraPose.position?.z,
            cameraPose.rotation?.x,
            cameraPose.rotation?.y,
            cameraPose.rotation?.z,
            cameraPose.fov,
        ].every(Number.isFinite)
    ) {
        return [];
    }

    const { planeW, planeH } = getReferencePlaneDimensions(targetAspect);
    const camera = createVirtualCamera(cameraPose, targetAspect);
    const worldZ = targetZ * 0.85;
    const corners = [
        { x: -planeW / 2, y: planeH / 2 },
        { x: planeW / 2, y: planeH / 2 },
        { x: planeW / 2, y: -planeH / 2 },
        { x: -planeW / 2, y: -planeH / 2 },
    ];
    const points = corners.map(({ x, y }) =>
        projectWorldToScreen({ x, y, z: worldZ }, camera, frameWidth, frameHeight)
    );

    return points.every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y))
        ? points.map(({ x, y }) => ({ x, y }))
        : [];
}
