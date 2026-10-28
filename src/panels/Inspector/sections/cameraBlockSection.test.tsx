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
    it('renders the movement preset flyout trigger and keeps every movement preset available', () => {
        const shot = useProjectStore.getState().project.shots[0];
        const block = createDefaultCameraBlock('block-test', 0, 2000);

        const html = renderToStaticMarkup(
            <CameraBlockSection
                activeShotId={shot.id}
                activeCameraBlock={block}
                onDone={() => {}}
            />
        );

        // Presets are opened from the compact add control, without a redundant quick-move grid.
        expect(html).toContain('>Move</span>');
        expect(html).toContain('aria-label="Add camera movement preset"');
        expect(html).not.toContain('Quick Moves');
        expect(html).not.toContain('Select camera movement preset');

        // Physics mode radiogroup uniquely identified by role and label
        expect(html).toContain('role="radiogroup" aria-label="Camera move mode"');
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

        // The active preset can be removed from the movement settings.
        const dollyHtml = renderToStaticMarkup(
            <CameraBlockSection
                activeShotId="shot-1"
                activeCameraBlock={updatedDolly}
                onDone={() => {}}
            />
        );
        expect(dollyHtml).toContain('aria-label="Remove applied camera movement preset"');

        // 2. Select Pan Left
        const updatedPan = applyCameraMovementPreset(block, 'pan-left', {
            artboardDimensions,
            preserveDuration: true,
        });

        expect(updatedPan.label).toBe('Pan Left');
        expect(updatedPan.mode).toBe('dolly');
        expect(updatedPan.to?.orbit).toBeLessThan(updatedPan.from?.orbit ?? 0);
        expect(getMovementPresetIdByLabel(updatedPan.label)).toBe('pan-left');

        // Preset names are no longer duplicated as inspector badges.
        const panHtml = renderToStaticMarkup(
            <CameraBlockSection
                activeShotId="shot-1"
                activeCameraBlock={updatedPan}
                onDone={() => {}}
            />
        );
        expect(panHtml).not.toContain('>Pan Left</span>');

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
        expect(vertigoHtml).toContain('aria-label="Remove applied camera movement preset"');
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
        expect(html).not.toContain('>Dolly In</span>');
    });
});

// These fixtures inspect the configured option catalogs. Portal behavior is checked separately.
vi.mock('../../../ui/FigmaSelect', () => ({
    FigmaSelect: (props: SelectHTMLAttributes<HTMLSelectElement>) => <select {...props} />,
}));

describe('CameraBlockSection reference controls', () => {
    it('presents the screenshot camera endpoint and motion controls in the inspector', () => {
        const shot = useProjectStore.getState().project.shots[0];
        const block = createDefaultCameraBlock('block-reference', 362, 1000);
        const html = renderToStaticMarkup(
            <CameraBlockSection activeShotId={shot.id} activeCameraBlock={block} onDone={() => {}} />
        );

        for (const label of ['Alignment', 'Anchor', 'Zoom', 'Roll', 'Orbit &amp; tilt', 'Move', 'Shake', 'Amount', 'Timing', 'Start &amp; length', 'Easing']) {
            expect(html).toContain(label);
        }
        expect(html).toContain('aria-label="Camera move mode"');
        expect(html).toContain('aria-label="Easing settings"');
        expect(html).toContain('aria-label="Camera easing curve preview"');
        expect(html).not.toContain('>Front (Eye-Level)</span>');
        expect(html).not.toContain('>Custom</span>');
        expect(html).not.toContain('>Camera Move</span>');
        expect(html).not.toContain('Physics / Projection Mode');
    });

    it('renders all four custom cubic Bezier handles', () => {
        const shot = useProjectStore.getState().project.shots[0];
        const block = createDefaultCameraBlock('block-bezier', 0, 2000);
        block.easing = { kind: 'bezier', x1: 0.16, y1: 1, x2: 0.3, y2: 1 };
        const html = renderToStaticMarkup(
            <CameraBlockSection activeShotId={shot.id} activeCameraBlock={block} onDone={() => {}} />
        );
        for (const handle of ['X1', 'Y1', 'X2', 'Y2']) expect(html).toContain(`aria-label="${handle}"`);
    });
});
