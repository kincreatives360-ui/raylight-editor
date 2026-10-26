// src/panels/Inspector/sections/cameraBlockSection.test.tsx
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CameraBlockSection } from './CameraBlockSection';
import { createDefaultCameraBlock } from '../../../model/defaults';
import { useProjectStore } from '../../../store/useProjectStore';

describe('CameraBlockSection Inspector UI', () => {
    it('renders Movement Preset section with dropdown categories and quick moves', () => {
        const shot = useProjectStore.getState().project.shots[0];
        const block = createDefaultCameraBlock('block-test', 0, 2000);

        const html = renderToStaticMarkup(
            <CameraBlockSection
                activeShotId={shot.id}
                activeCameraBlock={block}
                onDone={() => {}}
            />
        );

        // Movement Preset header and dropdown
        expect(html).toContain('Movement Preset');
        expect(html).toContain('Zoom Moves (Lens Magnification)');
        expect(html).toContain('Pan &amp; Tilt (Fixed Tripod Rotation)');
        expect(html).toContain('Dolly, Truck &amp; Pedestal (3D Space Tracks)');
        expect(html).toContain('Special FX (Vertigo &amp; Organic Sway)');

        // Quick Move buttons
        expect(html).toContain('Zoom In');
        expect(html).toContain('Zoom Out');
        expect(html).toContain('Pan L');
        expect(html).toContain('Pan R');
        expect(html).toContain('Tilt Up');
        expect(html).toContain('Tilt Down');
        expect(html).toContain('Dolly In');
        expect(html).toContain('Dolly Out');
        expect(html).toContain('Truck L');
        expect(html).toContain('Truck R');
        expect(html).toContain('Ped Up');
        expect(html).toContain('Ped Down');
        expect(html).toContain('Vertigo (Dolly Zoom)');
        expect(html).toContain('Handheld Sway');

        // Physics mode
        expect(html).toContain('Physics / Projection Mode');
        expect(html).toContain('Dolly');
        expect(html).toContain('Zoom');
        expect(html).toContain('Warp');
    });

    it('renders all 4 visual preset optgroups in From and To endpoint selectors', () => {
        const shot = useProjectStore.getState().project.shots[0];
        const block = createDefaultCameraBlock('block-test', 0, 2000);

        const html = renderToStaticMarkup(
            <CameraBlockSection
                activeShotId={shot.id}
                activeCameraBlock={block}
                onDone={() => {}}
            />
        );

        expect(html).toContain('Shot Types');
        expect(html).toContain('Camera Angles');
        expect(html).toContain('Axonometric');
        expect(html).toContain('Axial Views');

        // Check key presets appear in options
        expect(html).toContain('Establishing Shot');
        expect(html).toContain('Full Shot');
        expect(html).toContain('Two Shot');
        expect(html).toContain('Low Angle (Hero)');
        expect(html).toContain('High Angle (Down)');
        expect(html).toContain('Over The Shoulder');
        expect(html).toContain('Dutch Angle');
        expect(html).toContain('Point of View');
    });

    it('renders spring physics tuning controls when easing is a physics spring', () => {
        const shot = useProjectStore.getState().project.shots[0];
        const block = createDefaultCameraBlock('block-spring', 0, 2500, 'f1', 'f2', 'Dolly In');
        block.easing = {
            kind: 'spring',
            name: 'bouncy',
            config: { stiffness: 220, damping: 14, mass: 1 },
        };

        const html = renderToStaticMarkup(
            <CameraBlockSection
                activeShotId={shot.id}
                activeCameraBlock={block}
                onDone={() => {}}
            />
        );

        expect(html).toContain('Spring Physics Tuning');
        expect(html).toContain('bouncy');
        expect(html).toContain('Stiff');
        expect(html).toContain('Damp');
        expect(html).toContain('Mass');
        expect(html).toContain('Dolly In');
    });
});
