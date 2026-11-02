import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

async function loadResolver() {
    try {
        return (await import('./depthOfFieldTarget')).resolveDepthOfFieldWorldTarget;
    } catch (error) {
        if (error instanceof Error
            && error.message.startsWith('Cannot find module')
            && error.message.includes('depthOfFieldTarget')) {
            return null;
        }
        throw error;
    }
}

async function loadSubjectResolver() {
    try {
        return (await import('./depthOfFieldTarget')).resolveVisibleDepthOfFieldSubjectPosition;
    } catch (error) {
        if (error instanceof Error
            && error.message.startsWith('Cannot find module')
            && error.message.includes('depthOfFieldTarget')) {
            return null;
        }
        throw error;
    }
}

function createCamera() {
    const camera = new THREE.PerspectiveCamera(90, 1, 0.1, 100);
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    return camera;
}

describe('resolveDepthOfFieldWorldTarget', () => {
    it('maps the normalized center to the authored world-Z plane', async () => {
        const resolveDepthOfFieldWorldTarget = await loadResolver();
        expect(resolveDepthOfFieldWorldTarget).toBeTypeOf('function');
        if (!resolveDepthOfFieldWorldTarget) return;

        const target = resolveDepthOfFieldWorldTarget(
            createCamera(),
            { x: 0, y: 0, z: 2 },
        );

        expect(target.x).toBeCloseTo(0, 5);
        expect(target.y).toBeCloseTo(0, 5);
        expect(target.z).toBeCloseTo(2, 5);
    });

    describe('resolveVisibleDepthOfFieldSubjectPosition', () => {
        it('returns the evaluated center only for a visible selected focus subject', async () => {
            const resolveSubject = await loadSubjectResolver();
            expect(resolveSubject).toBeTypeOf('function');
            if (!resolveSubject) return;

            const position = resolveSubject('subject', 'layer-1', [
                { id: 'layer-1', visible: true, position: { x: 1, y: 2, z: 3 } },
            ]);
            expect(position).toEqual({ x: 1, y: 2, z: 3 });
        });

        it('falls back to point focus when the subject is missing or hidden', async () => {
            const resolveSubject = await loadSubjectResolver();
            expect(resolveSubject).toBeTypeOf('function');
            if (!resolveSubject) return;

            expect(resolveSubject('subject', 'missing', [])).toBeUndefined();
            expect(resolveSubject('subject', 'layer-1', [
                { id: 'layer-1', visible: false, position: { x: 1, y: 2, z: 3 } },
            ])).toBeUndefined();
            expect(resolveSubject('point', 'layer-1', [
                { id: 'layer-1', visible: true, position: { x: 1, y: 2, z: 3 } },
            ])).toBeUndefined();
        });
    });

    it('casts normalized offsets through the camera onto the same depth plane', async () => {
        const resolveDepthOfFieldWorldTarget = await loadResolver();
        expect(resolveDepthOfFieldWorldTarget).toBeTypeOf('function');
        if (!resolveDepthOfFieldWorldTarget) return;

        const target = resolveDepthOfFieldWorldTarget(
            createCamera(),
            { x: 1, y: 0, z: 0 },
        );

        expect(target.x).toBeCloseTo(10, 4);
        expect(target.y).toBeCloseTo(0, 5);
        expect(target.z).toBeCloseTo(0, 5);
    });

    it('uses a supplied subject center instead of reconstructing a point focus', async () => {
        const resolveDepthOfFieldWorldTarget = await loadResolver();
        expect(resolveDepthOfFieldWorldTarget).toBeTypeOf('function');
        if (!resolveDepthOfFieldWorldTarget) return;

        const target = resolveDepthOfFieldWorldTarget(
            createCamera(),
            { x: 0, y: 0, z: 0 },
            { x: 2, y: -3, z: 4 },
        );

        expect(target.toArray()).toEqual([2, -3, 4]);
    });

    it('returns a finite fallback when the camera ray is parallel to the depth plane', async () => {
        const resolveDepthOfFieldWorldTarget = await loadResolver();
        expect(resolveDepthOfFieldWorldTarget).toBeTypeOf('function');
        if (!resolveDepthOfFieldWorldTarget) return;

        const camera = createCamera();
        camera.lookAt(10, 0, 10);
        camera.updateMatrixWorld(true);

        const target = resolveDepthOfFieldWorldTarget(
            camera,
            { x: 0, y: 0, z: 0 },
        );

        expect([target.x, target.y, target.z].every(Number.isFinite)).toBe(true);
    });
});
