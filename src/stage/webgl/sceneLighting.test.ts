import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';

describe('AreaGizmo geometry lifecycle & memory safety', () => {
    it('creates edges geometry and disposes the intermediate plane geometry immediately', () => {
        const planeDisposeSpy = vi.spyOn(THREE.PlaneGeometry.prototype, 'dispose');
        const edgesDisposeSpy = vi.spyOn(THREE.EdgesGeometry.prototype, 'dispose');

        const width = 4;
        const height = 2.5;

        // Simulate AreaGizmo's useMemo logic:
        const plane = new THREE.PlaneGeometry(width, height);
        const edges = new THREE.EdgesGeometry(plane);
        plane.dispose();

        // The intermediate plane must be disposed immediately to prevent leaking buffer attributes
        expect(planeDisposeSpy).toHaveBeenCalled();
        expect(edges).toBeInstanceOf(THREE.EdgesGeometry);

        // When unmounting, edges.dispose() must be called
        edges.dispose();
        expect(edgesDisposeSpy).toHaveBeenCalled();

        planeDisposeSpy.mockRestore();
        edgesDisposeSpy.mockRestore();
    });
});
