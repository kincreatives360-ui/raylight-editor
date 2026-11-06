import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { DisplaySettingsMenu } from './DisplaySettingsMenu';
import { useSelectionStore } from '../store/useSelectionStore';

describe('DisplaySettingsMenu component', () => {
    beforeEach(() => {
        useSelectionStore.setState({
            leftPanelOpen: true,
            rightSidebarOpen: true,
            timelineOpen: true,
        });
    });

    it('renders closed trigger button without notification dot when all panels are visible', () => {
        const html = renderToStaticMarkup(
            <DisplaySettingsMenu showSafeArea={false} />
        );
        expect(html).toContain('aria-label="Display settings"');
        expect(html).not.toContain('bg-brand-blue ring-2 ring-app');
    });

    it('renders notification dot when a panel is closed', () => {
        const html = renderToStaticMarkup(
            <DisplaySettingsMenu showSafeArea={false} leftPanelOpen={false} />
        );
        expect(html).toContain('bg-brand-blue ring-2 ring-app');
    });

    it('renders notification dot when timeline is closed', () => {
        const html = renderToStaticMarkup(
            <DisplaySettingsMenu showSafeArea={false} timelineOpen={false} />
        );
        expect(html).toContain('bg-brand-blue ring-2 ring-app');
    });

    it('toggles timelineOpen via useSelectionStore action', () => {
        const { toggleTimeline } = useSelectionStore.getState();
        expect(useSelectionStore.getState().timelineOpen).toBe(true);
        toggleTimeline();
        expect(useSelectionStore.getState().timelineOpen).toBe(false);
        toggleTimeline();
        expect(useSelectionStore.getState().timelineOpen).toBe(true);
    });

    it('toggles left and right panels via useSelectionStore actions', () => {
        const { toggleLeftPanel, toggleRightSidebar } = useSelectionStore.getState();
        toggleLeftPanel();
        expect(useSelectionStore.getState().leftPanelOpen).toBe(false);
        toggleRightSidebar();
        expect(useSelectionStore.getState().rightSidebarOpen).toBe(false);
    });
});
