// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRoot } from 'react-dom/client';
import { OrbitCameraFrustum, OrbitCameraControls } from './OrbitCameraOverlay';
import type { EvaluatedCamera } from '../engine/evaluateCamera';
import { CAMERA_ANGLE_VIEWS } from './cameraAngleViews';

Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true });

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

    it('keeps all angle presets reachable in a small viewport', () => {
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: 320 });
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);

        act(() => {
            root.render(
                <OrbitCameraControls
                    pinned={false}
                    zoom={1}
                    onAngle={() => {}}
                    onPin={() => {}}
                    onBack={() => {}}
                    onZoom={() => {}}
                />
            );
        });

        act(() => {
            container.querySelector('button[aria-haspopup="menu"]')!.click();
        });

        const menu = container.querySelector<HTMLElement>('[aria-label="Camera angle"]')!;
        expect(menu.className).toContain('max-h-[min(70vh,24rem)]');
        expect(menu.className).toContain('overflow-y-auto');
        expect(menu.className).toContain('overscroll-contain');
        for (const view of CAMERA_ANGLE_VIEWS) {
            expect(menu.textContent).toContain(view.label);
        }

        act(() => root.unmount());
        container.remove();
    });
});
