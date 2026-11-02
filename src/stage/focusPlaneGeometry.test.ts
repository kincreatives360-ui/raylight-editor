import { describe, expect, it } from 'vitest';
import {
    DEFAULT_CAMERA_Z,
    DEFAULT_FOCAL_LENGTH,
    focalLengthToFov,
    getReferencePlaneDimensions,
    type EvaluatedCameraPose,
} from './webgl/cameraMath';
import { createVirtualCamera, projectWorldToScreen } from './lightingMath';
import { getFocusDepthRange, projectFocusPlane } from './focusPlaneGeometry';

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

describe('getFocusDepthRange', () => {
    it('returns a finite nonzero range with no layer depths', () => {
        const range = getFocusDepthRange([], 3, 0);

        expect(Number.isFinite(range.min)).toBe(true);
        expect(Number.isFinite(range.max)).toBe(true);
        expect(range.min).toBeLessThan(3);
        expect(range.max).toBeGreaterThan(3);
    });

    it('keeps equal-depth layers inside a finite nonzero range', () => {
        const range = getFocusDepthRange([2, 2, 2], 2, 0);

        expect(range.min).toBeLessThan(2);
        expect(range.max).toBeGreaterThan(2);
        expect(range.min).toBeLessThan(range.max);
    });

    it('encloses all layer depths and focus boundaries at the minimum range', () => {
        const range = getFocusDepthRange([-1, 0.25, 2], 0.5, 0);

        expect(range.min).toBeLessThanOrEqual(-1);
        expect(range.max).toBeGreaterThanOrEqual(2);
        expect(range.min).toBeLessThan(range.max);
    });

    it('encloses the focus boundaries at the maximum range', () => {
        const range = getFocusDepthRange([-12, 0, 12], 1, 20);

        expect(range.min).toBeLessThanOrEqual(-9);
        expect(range.max).toBeGreaterThanOrEqual(11);
        expect(range.min).toBeLessThan(range.max);
    });
});
