import type { SelectHTMLAttributes } from 'react';
// src/panels/Inspector/sections/cameraBlockSection.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CameraBlockSection } from './CameraBlockSection';
import { createDefaultCameraBlock } from '../../../model/defaults';
import { useProjectStore } from '../../../store/useProjectStore';
import {
    applyCameraMovementPreset,
    getMovementPresetIdByLabel,
} from '../../../stage/webgl/cameraMath';

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

        // Physics mode radiogroup uniquely identified by role and label
        expect(html).toContain('Physics / Projection Mode');
        expect(html).toContain('role="radiogroup" aria-label="Camera move mode"');
        expect(html).toContain('role="radio" aria-checked="true"');
        expect(html).toMatch(/role="radio"[^>]*>Dolly<\/button>/);
        expect(html).toMatch(/role="radio"[^>]*>Zoom<\/button>/);
        expect(html).toMatch(/role="radio"[^>]*>Warp<\/button>/);
    });

    it('applies movement preset via applyCameraMovementPreset updating block framing, mode, and label', () => {
        const block = createDefaultCameraBlock('block-interactive', 0, 2000);
        const artboardDimensions = { width: 1920, height: 1080 };

        // 1. Select Dolly In (physical forward translation)
        const updatedDolly = applyCameraMovementPreset(block, 'dolly-in', {
            artboardDimensions,
            preserveDuration: true,
        });

        expect(updatedDolly.label).toBe('Dolly In');
        expect(updatedDolly.mode).toBe('dolly');
        expect(updatedDolly.to?.anchorZ).toBeGreaterThan(updatedDolly.from?.anchorZ ?? 0);
        expect(getMovementPresetIdByLabel(updatedDolly.label)).toBe('dolly-in');

        // 2. Select Zoom In (optical FOV zoom)
        const updatedZoom = applyCameraMovementPreset(block, 'zoom-in', {
            artboardDimensions,
            preserveDuration: true,
        });
        expect(updatedZoom.label).toBe('Zoom In');
        expect(updatedZoom.mode).toBe('zoom');
        expect(updatedZoom.to?.zoom).toBeGreaterThan(updatedZoom.from?.zoom ?? 1);
        expect(getMovementPresetIdByLabel(updatedZoom.label)).toBe('zoom-in');

        // Render Inspector with the updated Dolly In block and verify it highlights the Dolly In quick button
        const dollyHtml = renderToStaticMarkup(
            <CameraBlockSection
                activeShotId="shot-1"
                activeCameraBlock={updatedDolly}
                onDone={() => {}}
            />
        );
        expect(dollyHtml).toContain('bg-sky-500 text-black font-semibold shadow-xs" title="Dolly In">Dolly In</button>');

        // 2. Select Pan Left
        const updatedPan = applyCameraMovementPreset(block, 'pan-left', {
            artboardDimensions,
            preserveDuration: true,
        });

        expect(updatedPan.label).toBe('Pan Left');
        expect(updatedPan.mode).toBe('dolly');
        expect(updatedPan.to?.orbit).toBeLessThan(updatedPan.from?.orbit ?? 0);
        expect(getMovementPresetIdByLabel(updatedPan.label)).toBe('pan-left');

        // Render Inspector with Pan Left block and verify it highlights the Pan L quick button
        const panHtml = renderToStaticMarkup(
            <CameraBlockSection
                activeShotId="shot-1"
                activeCameraBlock={updatedPan}
                onDone={() => {}}
            />
        );
        expect(panHtml).toContain('bg-sky-500 text-black font-semibold shadow-xs" title="Pan L">Pan L</button>');

        // 3. Select Vertigo (Dolly Zoom In)
        const updatedVertigo = applyCameraMovementPreset(block, 'dolly-zoom-in', {
            artboardDimensions,
            preserveDuration: true,
        });

        expect(updatedVertigo.label).toBe('Vertigo (Dolly In / Zoom Out)');
        expect(updatedVertigo.mode).toBe('dollyzoom');
        expect(getMovementPresetIdByLabel(updatedVertigo.label)).toBe('dolly-zoom-in');

        const vertigoHtml = renderToStaticMarkup(
            <CameraBlockSection
                activeShotId="shot-1"
                activeCameraBlock={updatedVertigo}
                onDone={() => {}}
            />
        );
        expect(vertigoHtml).toContain('bg-sky-500 text-black font-semibold shadow-xs" title="Vertigo (Dolly Zoom)">Vertigo (Dolly Zoom)</button>');
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

// These fixtures inspect the configured option catalogs. Portal behavior is checked separately.
vi.mock('../../../ui/FigmaSelect', () => ({
    FigmaSelect: (props: SelectHTMLAttributes<HTMLSelectElement>) => <select {...props} />,
}));
