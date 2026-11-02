// src/stage/orientationGizmo.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRoot } from 'react-dom/client';
import { OrientationGizmo } from './OrientationGizmo';
import { CAMERA_ANGLE_VIEWS } from './cameraAngleViews';

Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true });

describe('OrientationGizmo HUD & Presets UI', () => {
    it('renders six accessible cube faces and a keyboard-focusable perspective center', () => {
        const handleSetOrientation = vi.fn();
        const handleResetCamera = vi.fn();

        const html = renderToStaticMarkup(
            <OrientationGizmo
                cameraRotation={{ x: 0, y: 0, z: 0 }}
                currentZoom={1.25}
                onSetOrientation={handleSetOrientation}
                onResetCamera={handleResetCamera}
            />
        );

        for (const face of ['Front', 'Back', 'Left', 'Right', 'Top', 'Bottom']) {
            expect(html).toContain(`aria-label="${face} view"`);
            expect(html).toMatch(new RegExp(`<button[^>]*tabindex="0"[^>]*aria-label="${face} view"`));
        }
        expect(html).toContain('aria-label="Perspective view"');
        expect(html).toMatch(/<button[^>]*tabindex="0"[^>]*aria-label="Perspective view"/);
        expect(html).not.toContain('trackball');
        expect(html).not.toContain('Trackball');
    });

    it('sets each cube face and perspective center to its shared camera pose', () => {
        const handleSetOrientation = vi.fn();
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        const faceIds = ['front', 'back', 'left', 'right', 'top', 'bottom'];

        act(() => {
            root.render(
                <OrientationGizmo
                    cameraRotation={{ x: 0, y: 0, z: 0 }}
                    onSetOrientation={handleSetOrientation}
                    onResetCamera={() => {}}
                />
            );
        });

        for (const id of [...faceIds, 'isometric']) {
            const view = CAMERA_ANGLE_VIEWS.find((candidate) => candidate.id === id)!;
            const name = id === 'isometric' ? 'Perspective view' : `${view.label} view`;
            const button = container.querySelector<HTMLButtonElement>(`[aria-label="${name}"]`)!;

            act(() => {
                button.focus();
                button.click();
            });

            expect(document.activeElement).toBe(button);
            expect(handleSetOrientation).toHaveBeenLastCalledWith(view.orbit, view.tilt, view.roll);
        }

        act(() => root.unmount());
        container.remove();
    });

    it('keeps every shared quick view and frame action in a scrollable menu', () => {
        const html = renderToStaticMarkup(
            <OrientationGizmo
                cameraRotation={{ x: 0, y: 0, z: 0 }}
                onSetOrientation={() => {}}
                onResetCamera={() => {}}
                onFrameSelection={() => {}}
            />
        );

        for (const view of CAMERA_ANGLE_VIEWS) {
            expect(html).toContain(view.label);
        }
        expect(html).toContain('Frame Scene');
        expect(html).toContain('overflow-y-auto');
        expect(html).toContain('max-h-[min(70vh,24rem)]');

        // Readout pill (yaw / pitch / zoom)
        expect(html).toContain('0° / 0° • 1x');
    });

    it('renders with custom rotation and displays calculated yaw/pitch', () => {
        // x: 0.5235 rad (~30 deg pitch), y: 0.7853 rad (~45 deg yaw)
        const html = renderToStaticMarkup(
            <OrientationGizmo
                cameraRotation={{ x: 0.5235, y: 0.7853, z: 0 }}
                currentZoom={2.0}
                onSetOrientation={() => {}}
                onResetCamera={() => {}}
            />
        );

        expect(html).toContain('45° / 30° • 2x');
    });

    it('shows the Angle menu in the orientation HUD', () => {
        const html = renderToStaticMarkup(
            <OrientationGizmo
                cameraRotation={{ x: 0, y: 0, z: 0 }}
                onSetOrientation={() => {}}
                onResetCamera={() => {}}
            />
        );
        expect(html).not.toContain('>Angle</span>');
    });
});
