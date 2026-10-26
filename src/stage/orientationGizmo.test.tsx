// src/stage/orientationGizmo.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { OrientationGizmo } from './OrientationGizmo';

describe('OrientationGizmo HUD & Presets UI', () => {
    it('renders 3D axis HUD, readout pill, and quick presets', () => {
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

        // Unit axis labels
        expect(html).toContain('>X<');
        expect(html).toContain('>Y<');
        expect(html).toContain('>Z<');

        // Readout pill (yaw / pitch / zoom)
        expect(html).toContain('0° / 0° • 1.25x');

        // Quick Preset buttons
        expect(html).toContain('Front');
        expect(html).toContain('Top');
        expect(html).toContain('Right');
        expect(html).toContain('Iso');
        expect(html).toContain('Reset Camera Pose to Default');
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
});
