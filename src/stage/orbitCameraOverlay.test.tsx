import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { OrbitCameraFrustum, OrbitCameraControls } from './OrbitCameraOverlay';
import type { EvaluatedCamera } from '../engine/evaluateCamera';

describe('OrbitCameraOverlay', () => {
    const defaultReference = {
        position: { x: 0, y: 0, z: 2.65 },
        rotation: { x: 0, y: 0, z: 0 },
        focalLength: 50,
    };

    const frontCamera: EvaluatedCamera = {
        target: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        zoom: 1,
        fovDegrees: 35,
        focalLength: 50,
        activeMode: 'static',
    };

    const observerCamera: EvaluatedCamera = {
        target: { x: 0, y: 0, z: 0 },
        rotation: { x: -0.3, y: -0.65, z: 0 },
        zoom: 0.45,
        fovDegrees: 35,
        focalLength: 50,
        activeMode: 'static',
    };

    it('renders OrbitCameraFrustum when frustum points are in front of observer', () => {
        const html = renderToStaticMarkup(
            <OrbitCameraFrustum
                camera={frontCamera}
                observer={observerCamera}
                reference={defaultReference}
                width={800}
                height={600}
            />
        );
        expect(html).toContain('Orbit camera frustum');
        expect(html).toContain('<polygon');
    });

    it('rejects projection and returns null when points are behind observer camera', () => {
        // Place observer far forward so the shot camera at z=0 is behind observer
        const observerFarForward: EvaluatedCamera = {
            target: { x: 0, y: 0, z: -10 },
            rotation: { x: 0, y: 0, z: 0 },
            zoom: 10,
            fovDegrees: 35,
            focalLength: 50,
            activeMode: 'static',
        };

        const html = renderToStaticMarkup(
            <OrbitCameraFrustum
                camera={frontCamera}
                observer={observerFarForward}
                reference={{
                    position: { x: 0, y: 0, z: -5 },
                    rotation: { x: 0, y: 0, z: 0 },
                    focalLength: 50,
                }}
                width={800}
                height={600}
            />
        );
        expect(html).toBe('');
    });

    it('renders OrbitCameraControls with aria-label and action buttons', () => {
        const html = renderToStaticMarkup(
            <OrbitCameraControls
                pinned={false}
                zoom={1}
                onAngle={vi.fn()}
                onPin={vi.fn()}
                onBack={vi.fn()}
                onZoom={vi.fn()}
            />
        );
        expect(html).toContain('Orbit camera controls');
        expect(html).toContain('Angle');
        expect(html).toContain('Pin');
        expect(html).toContain('Back to camera');
    });
});

