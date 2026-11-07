import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TimelineToolbar } from './TimelineToolbar';
import { createDefaultProject, createDefaultShot } from '../../model/defaults';
import { usePlayheadStore } from '../../store/usePlayheadStore';
import { useSelectionStore } from '../../store/useSelectionStore';
import { useProjectStore } from '../../store/useProjectStore';
import { ProjectDetailsSection } from '../Inspector/ProjectDetailsSection';
import { ShotSettingsPanel } from '../Inspector/ShotSettingsPanel';

describe('Timeline & Motion Sequencer Parity', () => {
    beforeEach(() => {
        usePlayheadStore.setState({
            isPlaying: false,
            currentTimeMs: 1500,
        });
        useSelectionStore.setState({
            timelineView: 'video',
            timelineZoom: 1,
            selectedShotId: null,
            selectedLayerIds: [],
        });
    });

    it('renders view toggle button in TimelineToolbar in whole video mode', () => {
        const shot = createDefaultShot({ name: 'Opening Scene' });
        const onToggle = vi.fn();
        const html = renderToStaticMarkup(
            <TimelineToolbar
                isPlaying={false}
                onTogglePlay={() => {}}
                onSplitAtPlayhead={() => {}}
                activeShot={shot}
                hasActiveShot={true}
                onDeleteShot={() => {}}
                totalDurationMs={3500}
                timelineZoom={1}
                onTimelineZoomChange={() => {}}
                timelineView="video"
                onToggleTimelineView={onToggle}
            />
        );

        expect(html).toContain('All Shots');
        expect(html).toContain('title="All Shots · Click to view active scene tracks"');
        expect(html).toContain('title="Split Clip at Playhead (S)"');
    });

    it('renders breadcrumb in TimelineToolbar in scene tracks mode', () => {
        const shot = createDefaultShot({ name: 'Hero Transition' });
        const onToggle = vi.fn();
        const html = renderToStaticMarkup(
            <TimelineToolbar
                isPlaying={false}
                onTogglePlay={() => {}}
                onSplitAtPlayhead={() => {}}
                activeShot={shot}
                hasActiveShot={true}
                onDeleteShot={() => {}}
                totalDurationMs={3500}
                timelineZoom={1}
                onTimelineZoomChange={() => {}}
                timelineView="scene"
                onToggleTimelineView={onToggle}
            />
        );

        expect(html).toContain('Shots');
        expect(html).toContain('Hero Transition');
        expect(html).toContain('title="In Hero Transition · Click to view All Shots (Esc)"');
    });

    it('renders Tempo (BPM) input in ProjectDetailsSection', () => {
        const project = createDefaultProject({ bpm: 128 });
        const html = renderToStaticMarkup(
            <ProjectDetailsSection
                project={project}
                updateProject={() => {}}
            />
        );

        expect(html).toContain('Tempo');
        expect(html).toContain('BPM');
        expect(html).toContain('128');
    });

    it('renders interactive Duration and Transition controls in ShotSettingsPanel', () => {
        const shot = createDefaultShot({
            name: 'Scene 01',
            durationMs: 4000,
            transition: {
                type: 'crossfade',
                durationMs: 600,
                easing: { kind: 'preset', name: 'ease-in-out' },
            },
        });
        const html = renderToStaticMarkup(
            <ShotSettingsPanel
                activeShot={shot}
            />
        );

        expect(html).toContain('Duration');
        expect(html).toContain('Transition');
        expect(html).toContain('Crossfade');
        expect(html).toContain('Transition Duration');
    });

    it('splits shot at playhead with priority over non-selected background audio', () => {
        const project = createDefaultProject();
        project.shots = [
            createDefaultShot({
                id: 'shot-a',
                startMs: 0,
                durationMs: 4000,
                layers: [],
            }),
        ];
        project.audio = {
            muted: false,
            masterVolume: 1,
            clips: [
                {
                    id: 'audio-bg',
                    name: 'Background Music',
                    startMs: 0,
                    durationMs: 8000,
                    offsetMs: 0,
                    volume: 0.8,
                    muted: false,
                },
            ],
        };
        useProjectStore.setState({ project });

        // Split at 1500ms should split shot-a into 2 shots (first 1500ms, second 2500ms)
        const result = useProjectStore.getState().splitAtPlayhead(1500);
        expect(result).toBe(true);

        const updatedShots = useProjectStore.getState().project.shots;
        expect(updatedShots.length).toBe(2);
        expect(updatedShots[0].durationMs).toBe(1500);
        expect(updatedShots[1].durationMs).toBe(2500);
        expect(updatedShots[1].startMs).toBe(1500);
    });
});
