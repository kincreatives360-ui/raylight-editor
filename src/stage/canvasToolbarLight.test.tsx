import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CanvasToolbar } from './CanvasToolbar';
import { useSelectionStore } from '../store/useSelectionStore';
import { useProjectStore } from '../store/useProjectStore';
import { createDefaultProject, createDefaultShot } from '../model/defaults';

vi.mock('../store/useProjectStore', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../store/useProjectStore')>();
    const hook = (selector?: (state: ReturnType<typeof actual.useProjectStore.getState>) => unknown) =>
        selector ? selector(actual.useProjectStore.getState()) : actual.useProjectStore.getState();
    return { ...actual, useProjectStore: Object.assign(hook, actual.useProjectStore) };
});

vi.mock('../store/useSelectionStore', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../store/useSelectionStore')>();
    const hook = (selector?: (state: ReturnType<typeof actual.useSelectionStore.getState>) => unknown) =>
        selector ? selector(actual.useSelectionStore.getState()) : actual.useSelectionStore.getState();
    return { ...actual, useSelectionStore: Object.assign(hook, actual.useSelectionStore) };
});

describe('CanvasToolbar - Lighting Tools Menu', () => {
    beforeEach(() => {
        const project = createDefaultProject();
        const shot = createDefaultShot('shot-1');
        shot.light = {
            position: { x: -0.28, y: 0.36, z: 0.9 },
            intensity: 1.2,
            temperature: 6500,
            ambience: 0.45,
            sources: [],
        };
        project.shots = [shot];
        useProjectStore.getState().loadProjectJson(project);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        useSelectionStore.getState().selectLight(null);
    });

    it('renders the lighting button and dropdown chevron in CanvasToolbar', () => {
        const html = renderToStaticMarkup(<CanvasToolbar selectedLayer={undefined} />);
        expect(html).toContain('aria-label="Lighting Rig"');
        expect(html).toContain('aria-label="Lighting options"');
    });

    it('displays light types Sun, Spot, Point, Area when menu is open', () => {
        // Test dropdown contents rendering
        const html = renderToStaticMarkup(<CanvasToolbar selectedLayer={undefined} defaultOpenMenu="light" />);
        expect(html).toContain('Sun Light');
        expect(html).toContain('Spot Light');
        expect(html).toContain('Point Light');
        expect(html).toContain('Area Light');
    });
});
