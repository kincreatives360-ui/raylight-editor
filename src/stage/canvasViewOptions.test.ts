import { describe, expect, it } from 'vitest';
import { CAMERA_ANGLE_VIEWS, CANVAS_ZOOM_LEVELS } from './cameraAngleViews';

describe('shared canvas view options', () => {
    const normalizeDegrees = (angle: number) => ((angle % 360) + 360) % 360;

    it('contains the six axis-aligned views and perspective center view', () => {
        const viewsById = new Map(CAMERA_ANGLE_VIEWS.map((view) => [view.id, view]));

        expect(viewsById.get('front')).toMatchObject({ orbit: 0, tilt: 0, roll: 0 });
        expect(viewsById.get('back')).toMatchObject({ orbit: 180, tilt: 0, roll: 0 });
        expect(viewsById.get('right')).toMatchObject({ orbit: 90, tilt: 0, roll: 0 });
        expect(viewsById.get('left')).toMatchObject({ orbit: -90, tilt: 0, roll: 0 });
        expect(viewsById.get('top')).toMatchObject({ orbit: 0, tilt: -90, roll: 0 });
        expect(viewsById.get('bottom')).toMatchObject({ orbit: 0, tilt: 90, roll: 0 });
        expect(viewsById.get('isometric')).toMatchObject({ orbit: 45, tilt: 35.26, roll: 0 });
    });

    it('has unique labels and camera poses', () => {
        const labels = CAMERA_ANGLE_VIEWS.map((view) => view.label);
        const ids = CAMERA_ANGLE_VIEWS.map((view) => view.id);
        const poses = CAMERA_ANGLE_VIEWS.map(({ orbit, tilt, roll }) =>
            [orbit, tilt, roll].map(normalizeDegrees).join(','),
        );

        expect(new Set(labels).size).toBe(CAMERA_ANGLE_VIEWS.length);
        expect(new Set(ids).size).toBe(CAMERA_ANGLE_VIEWS.length);
        expect(new Set(poses).size).toBe(CAMERA_ANGLE_VIEWS.length);
    });

    it('shares the established viewport zoom levels', () => {
        expect(CANVAS_ZOOM_LEVELS).toEqual([0.25, 0.5, 0.74, 1, 1.5, 2]);
    });
});
