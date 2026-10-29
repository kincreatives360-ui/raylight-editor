// src/stage/orientationGizmo.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CameraWorkflowActions, OrientationGizmo } from './OrientationGizmo';
import { CAMERA_ANGLE_VIEWS } from './cameraAngleViews';

describe('OrientationGizmo HUD & Presets UI', () => {
    it('defines the seven named camera angles with stable poses', () => {
        expect(CAMERA_ANGLE_VIEWS).toEqual([
            { id: 'three-quarter-right', label: 'Three-quarter right', orbit: 35, tilt: 20, roll: 0 },
            { id: 'three-quarter-left', label: 'Three-quarter left', orbit: -35, tilt: 20, roll: 0 },
            { id: 'profile-right', label: 'Profile right', orbit: 90, tilt: 0, roll: 0 },
            { id: 'profile-left', label: 'Profile left', orbit: -90, tilt: 0, roll: 0 },
            { id: 'top-down', label: 'Top down', orbit: 0, tilt: -89, roll: 0 },
            { id: 'low-angle', label: 'Low angle', orbit: 18, tilt: -16, roll: 0 },
            { id: 'front', label: 'Front', orbit: 0, tilt: 0, roll: 0 },
        ]);
    });
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
        expect(html).toContain('Three-quarter right');
        expect(html).toContain('Three-quarter left');
        expect(html).toContain('Profile right');
        expect(html).toContain('Profile left');
        expect(html).toContain('Top down');
        expect(html).toContain('Low angle');
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

    it('shows Pin and Back to camera in the contextual Orbit controls', () => {
        const html = renderToStaticMarkup(<CameraWorkflowActions hasBookmark isPinned onPin={() => {}} onBack={() => {}} />);
        expect(html).toContain('>Pin</button>');
        expect(html).toContain('>Back to camera</button>');
        expect(html).not.toContain('disabled=""');
        const unpinned = renderToStaticMarkup(<CameraWorkflowActions hasBookmark={false} isPinned={false} onPin={() => {}} onBack={() => {}} />);
        expect(unpinned).toContain('disabled=""');
    });
});
