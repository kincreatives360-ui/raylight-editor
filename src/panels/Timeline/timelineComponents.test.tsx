import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SnapLineOverlay } from './SnapLineOverlay';
import { TimelineEasingCurve } from './TimelineEasingCurve';
import { FramerCutMoment } from './FramerCutMoment';
import { TimelineSceneTracks } from './TimelineSceneTracks';
import type { Shot } from '../../model/types';

describe('SnapLineOverlay', () => {
    it('returns empty string when snapLineMs is null or negative', () => {
        const html1 = renderToStaticMarkup(<SnapLineOverlay snapLineMs={null} pxPerMs={0.14} />);
        expect(html1).toBe('');

        const html2 = renderToStaticMarkup(<SnapLineOverlay snapLineMs={-50} pxPerMs={0.14} />);
        expect(html2).toBe('');
    });

    it('renders a 1px vertical accent line at the exact snapped pixel position', () => {
        const html = renderToStaticMarkup(<SnapLineOverlay snapLineMs={1000} pxPerMs={0.2} />);
        expect(html).toContain('data-testid="timeline-snap-line-overlay"');
        // 1000ms * 0.2px/ms = 200px
        expect(html).toContain('translate3d(200px, 0, 0)');
        expect(html).toContain('bg-primary');
    });
});

describe('TimelineEasingCurve', () => {
    it('suppresses rendering when bar width is below 28px threshold', () => {
        const html = renderToStaticMarkup(
            <TimelineEasingCurve
                easing={{ kind: 'preset', name: 'ease-out' }}
                widthPx={24}
            />
        );
        expect(html).toBe('');
    });

    it('renders dual SVG layers for fill and stroke when bar width is sufficient', () => {
        const html = renderToStaticMarkup(
            <TimelineEasingCurve
                easing={{ kind: 'preset', name: 'ease-in-out' }}
                widthPx={150}
                tone="animation"
                label="Rotation"
            />
        );
        expect(html).toContain('data-testid="timeline-easing-curve"');

        // Check for area fill path with V300 H0 Z and fillOpacity=0.16
        expect(html).toContain('V300 H0 Z');
        expect(html).toContain('fill-opacity="0.16"');

        // Check for stroke path with non-scaling-stroke
        expect(html).toContain('vector-effect="non-scaling-stroke"');
        expect(html).toContain('linear-gradient(to right, #000');
    });
});

describe('FramerCutMoment', () => {
    it('renders non-interactive marker when onSelect is absent', () => {
        const html = renderToStaticMarkup(
            <FramerCutMoment
                id="cut-static"
                timeMs={2000}
                pxPerMs={0.1}
                label="Cut"
            />
        );
        expect(html).toContain('data-testid="camera-cut-cut-static"');
        expect(html).toContain('cursor-default');
        expect(html).not.toContain('role="button"');
        expect(html).not.toContain('tabindex');
        expect(html).not.toContain('aria-pressed');
    });

    it('renders interactive button when onSelect is provided', () => {
        const onSelect = vi.fn();
        const html = renderToStaticMarkup(
            <FramerCutMoment
                id="cut-1"
                timeMs={2500}
                pxPerMs={0.1}
                label="Cut to Wide"
                selected={true}
                onSelect={onSelect}
            />
        );
        expect(html).toContain('data-testid="camera-cut-cut-1"');
        expect(html).toContain('role="button"');
        expect(html).toContain('tabindex="0"');
        expect(html).toContain('aria-pressed="true"');
        expect(html).toContain('cursor-pointer');
        expect(html).toContain('left:250px');
        expect(html).toContain('rotate-45');
        expect(html).toContain('Cut to Wide at 2.50s');
    });

    it('renders seam vertical divider when shape is "seam"', () => {
        const html = renderToStaticMarkup(
            <FramerCutMoment
                id="cut-seam"
                timeMs={3000}
                pxPerMs={0.1}
                shape="seam"
            />
        );
        expect(html).toContain('rotate-45');
        expect(html).toContain('w-[1.5px]');
        expect(html).toContain('bg-camera-zoom');
    });
});

describe('Two-tier Lighting Track in TimelineSceneTracks', () => {
    const mockShot: Shot = {
        id: 'shot-1',
        name: 'Shot 1',
        startMs: 0,
        durationMs: 4000,
        layers: [],
        cameraBlocks: [
            {
                id: 'cam-1',
                startMs: 0,
                durationMs: 1500,
                fromFramingId: 'f1',
                toFramingId: 'f2',
                mode: 'dolly',
                easing: { kind: 'preset', name: 'ease-out' },
            },
            {
                id: 'cam-2',
                startMs: 1500,
                durationMs: 2500,
                fromFramingId: 'f2',
                toFramingId: 'f3',
                mode: 'zoom',
                easing: { kind: 'preset', name: 'ease-in' },
            },
        ],
        lightRig: {
            keyLightEnabled: true,
            intensity: 1.0,
            sources: [],
        },
        lightBlocks: [
            {
                id: 'lb-1',
                property: 'intensity',
                startMs: 500,
                durationMs: 1000,
                easing: { kind: 'preset', name: 'ease-out' },
                fromValue: 0.2,
                toValue: 0.8,
                label: 'Intensity',
            },
        ],
    };

    it('renders both main light bar and light animation blocks with diamond seam cut for abutting camera moves', () => {
        const html = renderToStaticMarkup(
            <TimelineSceneTracks
                activeShot={mockShot}
                pxPerMs={0.14}
                addLayerLaneWidth={560}
                addLayerGhostWidth={100}
                addLayerGhostLeft={0}
                addLayerHoverX={null}
                setAddLayerHoverX={vi.fn()}
                onAddLayer={vi.fn()}
                setInspectorTab={vi.fn()}
                hoverCameraTimeMs={null}
                setHoverCameraTimeMs={vi.fn()}
                clientXToLocalMs={vi.fn((x) => x)}
                addCameraBlockAtTime={vi.fn()}
                selectedCameraBlockId={null}
                selectCameraBlock={vi.fn()}
                updateShot={vi.fn()}
                setContextMenu={vi.fn()}
                setEasingPopoverTarget={vi.fn()}
                startCameraBlockDrag={vi.fn()}
                ghostDragPreview={null}
                hasLightBlocks={true}
                selectedLightBlockId={null}
                selectLightBlock={vi.fn()}
                selectedLightId={null}
                selectLight={vi.fn()}
                hoverLightTimeMs={null}
                setHoverLightTimeMs={vi.fn()}
                addLightBlockAtTime={vi.fn()}
                startLightBlockDrag={vi.fn()}
                selectedLayerSet={new Set()}
                expandedTimelineLayerSet={new Set()}
                startLayerBarDrag={vi.fn()}
                updateLayer={vi.fn()}
                selectPreset={vi.fn()}
                selectedPresetType={null}
                suppressPillClickRef={{ current: null }}
                startPresetDrag={vi.fn()}
                selectedBlockId={null}
                selectBlock={vi.fn()}
                startBlockDrag={vi.fn()}
                setTimelineView={vi.fn()}
            />
        );

        // 1. Camera seam diamond cut between abutting cam-1 and cam-2 (at 1500ms)
        expect(html).toContain('data-testid="camera-cut-seam-cam-1-cam-2"');

        // 2. Main base light bar spanning full shot duration
        expect(html).toContain('data-testid="timeline-main-light-bar"');
        expect(html).toContain('Lighting');

        // 3. Light animation block pill
        expect(html).toContain('Intensity');
        expect(html).toContain('data-light-pill="true"');
    });
});
