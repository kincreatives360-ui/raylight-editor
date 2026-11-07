import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProjectDetailsSection } from './ProjectDetailsSection';
import { InspectorModeTabs } from '../../ui/primitives';
import { DEFAULT_PROJECT } from '../../model/defaults';
import type { Project } from '../../model/types';

describe('Right Inspector & Settings Parity', () => {
    describe('ProjectDetailsSection', () => {
        it('renders Frame Rate options (24, 30, 60 fps) and optical lens preset buttons', () => {
            const project: Project = {
                ...DEFAULT_PROJECT,
                name: 'Cinematic Test',
                aspectRatio: '16:9',
                fps: 24,
                defaultCamera: {
                    position: { x: 0, y: 0, z: 2.65 },
                    rotation: { x: 0, y: 0, z: 0 },
                    focalLength: 50,
                },
            };

            const html = renderToStaticMarkup(
                <ProjectDetailsSection project={project} updateProject={vi.fn()} />
            );

            // Frame Rate
            expect(html).toContain('Frame Rate');
            expect(html).toContain('24 fps (Cinema)');

            // Optical lens snap points
            expect(html).toContain('24mm');
            expect(html).toContain('35mm');
            expect(html).toContain('50mm');
            expect(html).toContain('85mm');
            expect(html).toContain('135mm');
        });
    });

    describe('InspectorModeTabs', () => {
        it('renders "automate" label when animateLabel is provided', () => {
            const html = renderToStaticMarkup(
                <InspectorModeTabs
                    mode="animate"
                    onChange={vi.fn()}
                    animateLabel="automate"
                />
            );

            expect(html).toContain('automate');
            expect(html).toContain('design');
        });
    });
});
