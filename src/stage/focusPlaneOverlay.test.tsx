import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { evaluateProjectAtTime } from '../engine/evaluateShot';
import { createDefaultProject, createDefaultTextLayer } from '../model/defaults';
import { DepthOfFieldFocusOverlay } from './DepthOfFieldFocusOverlay';
import { DEFAULT_CAMERA_Z, DEFAULT_FOCAL_LENGTH, evaluateCameraPose } from './webgl/cameraMath';

const frameWidth = 960;
const frameHeight = 540;
const targetAspect = frameWidth / frameHeight;

function renderOverlay(enabled: boolean): string {
    const project = createDefaultProject();
    project.defaultCamera = {
        position: { x: 0, y: 0, z: DEFAULT_CAMERA_Z },
        rotation: { x: 0, y: 0, z: 0 },
        focalLength: DEFAULT_FOCAL_LENGTH,
    };
    project.shots[0].effects.depthOfField.enabled = enabled;
    project.shots[0].effects.depthOfField.target.z = 0.4;
    const frame = evaluateProjectAtTime(project, 0);

    return renderToStaticMarkup(createElement(DepthOfFieldFocusOverlay, {
        frame,
        frameWidth,
        frameHeight,
        targetAspect,
        cameraPose: evaluateCameraPose(frame.camera, project.defaultCamera, targetAspect),
    }));
}

describe('DepthOfFieldFocusOverlay', () => {
    it('renders exactly one passive, unfilled focus-plane outline while DOF is enabled', () => {
        const html = renderOverlay(true);

        expect(html.match(/<polygon\b/g)).toHaveLength(1);
        expect(html).toContain('data-focus-plane=""');
        expect(html).toContain('fill="none"');
        expect(html).toContain('stroke="var(--accent-primary, #0088ff)"');
        expect(html).toContain('stroke-width="1.5"');
        expect(html).toContain('pointer-events="none"');
        expect(html).not.toContain('role=');
        expect(html).not.toContain('onpointer');
    });

    it('renders no focus guide or auxiliary interaction surfaces while DOF is disabled', () => {
        const html = renderOverlay(false);

        expect(html).toBe('');
        expect(html).not.toContain('focus-plane');
        expect(html).not.toContain('focus-marker');
        expect(html).not.toContain('focus-layer');
        expect(html).not.toContain('ruler');
        expect(html).not.toContain('depth-sheet');
    });

    it('tracks a visible subject depth and falls back to the authored point when it is hidden', () => {
        const project = createDefaultProject();
        project.shots[0].layers = [createDefaultTextLayer({
            id: 'focus-subject',
            position: { x: 0.1, y: 0.2, z: 0.15 },
        })];
        project.defaultCamera = {
            position: { x: 0, y: 0, z: DEFAULT_CAMERA_Z },
            rotation: { x: 0, y: 0, z: 0 },
            focalLength: DEFAULT_FOCAL_LENGTH,
        };
        const dof = project.shots[0].effects.depthOfField;
        dof.enabled = true;
        dof.focusMode = 'subject';
        dof.focusTargetId = project.shots[0].layers[0].id;
        dof.target.z = 0.4;

        const visibleFrame = evaluateProjectAtTime(project, 0);
        const visibleHtml = renderToStaticMarkup(createElement(DepthOfFieldFocusOverlay, {
            frame: visibleFrame,
            frameWidth,
            frameHeight,
            targetAspect,
            cameraPose: evaluateCameraPose(visibleFrame.camera, project.defaultCamera, targetAspect),
        }));
        expect(visibleHtml).toContain('data-focus-depth="0.150"');

        project.shots[0].layers[0].hidden = true;
        const hiddenFrame = evaluateProjectAtTime(project, 0);
        const hiddenHtml = renderToStaticMarkup(createElement(DepthOfFieldFocusOverlay, {
            frame: hiddenFrame,
            frameWidth,
            frameHeight,
            targetAspect,
            cameraPose: evaluateCameraPose(hiddenFrame.camera, project.defaultCamera, targetAspect),
        }));
        expect(hiddenHtml).toContain('data-focus-depth="0.400"');
    });
});
