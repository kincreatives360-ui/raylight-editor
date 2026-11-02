import { describe, expect, it } from 'vitest';
import {
    DEFAULT_CAMERA_Z,
    DEFAULT_FOCAL_LENGTH,
    focalLengthToFov,
    getReferencePlaneDimensions,
    type EvaluatedCameraPose,
} from './webgl/cameraMath';
import { createVirtualCamera, projectWorldToScreen } from './lightingMath';
import { projectFocusPlane } from './focusPlaneGeometry';

const frameWidth = 1920;
const frameHeight = 1080;
const targetAspect = frameWidth / frameHeight;

function makePose(
    position = { x: 0, y: 0, z: DEFAULT_CAMERA_Z },
    rotation = { x: 0, y: 0, z: 0 },
): EvaluatedCameraPose {
    return {
        position,
        rotation,
        focalLength: DEFAULT_FOCAL_LENGTH,
        fov: focalLengthToFov(DEFAULT_FOCAL_LENGTH),
    };
}

describe('projectFocusPlane', () => {
    it('projects the focus sheet to the frame bounds for a front-facing camera', () => {
        const points = projectFocusPlane(0, makePose(), frameWidth, frameHeight, targetAspect);

        expect(points).toHaveLength(4);
        expect(points[0].x).toBeCloseTo(0);
        expect(points[0].y).toBeCloseTo(0);
        expect(points[1].x).toBeCloseTo(frameWidth);
        expect(points[1].y).toBeCloseTo(0);
        expect(points[2].x).toBeCloseTo(frameWidth);
        expect(points[2].y).toBeCloseTo(frameHeight);
        expect(points[3].x).toBeCloseTo(0);
        expect(points[3].y).toBeCloseTo(frameHeight);
    });

    it('projects the focus sheet with the camera orbit and the existing plane dimensions', () => {
        const pose = makePose(
            { x: 0.25, y: -0.15, z: 3.2 },
            { x: -0.32, y: 0.48, z: 0.12 },
        );
        const { planeW, planeH } = getReferencePlaneDimensions(targetAspect);
        const camera = createVirtualCamera(pose, targetAspect);
        const expected = [
            [-planeW / 2, planeH / 2],
            [planeW / 2, planeH / 2],
            [planeW / 2, -planeH / 2],
            [-planeW / 2, -planeH / 2],
        ].map(([x, y]) => projectWorldToScreen({ x, y, z: 0.4 * 0.85 }, camera, frameWidth, frameHeight));

        expect(projectFocusPlane(0.4, pose, frameWidth, frameHeight, targetAspect)).toEqual(
            expected.map(({ x, y }) => ({ x, y })),
        );
    });

    it('returns no points when projection inputs produce non-finite coordinates', () => {
        const invalidPose = makePose({ x: Number.NaN, y: 0, z: DEFAULT_CAMERA_Z });

        expect(projectFocusPlane(0, invalidPose, frameWidth, frameHeight, targetAspect)).toEqual([]);
    });
});
