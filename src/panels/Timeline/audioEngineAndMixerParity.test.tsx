import { describe, expect, it, beforeEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AudioMixer } from './AudioMixer';
import { RightSidebar } from '../Inspector/RightSidebar';
import { ProjectDetailsSection } from '../Inspector/ProjectDetailsSection';
import { buildAudioMixPlan, type MixPlanClipInput } from '../../engine/export/audioSchedule';
import { useProjectStore } from '../../store/useProjectStore';
import { useSelectionStore } from '../../store/useSelectionStore';
import { createDefaultProject } from '../../model/defaults';
import type { AudioClip } from '../../model/types';

vi.mock('../../store/useProjectStore', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../store/useProjectStore')>();
    const hook = (selector?: (state: ReturnType<typeof actual.useProjectStore.getState>) => unknown) =>
        selector ? selector(actual.useProjectStore.getState()) : actual.useProjectStore.getState();
    return { ...actual, useProjectStore: Object.assign(hook, actual.useProjectStore) };
});

vi.mock('../../store/useSelectionStore', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../store/useSelectionStore')>();
    const hook = (selector?: (state: ReturnType<typeof actual.useSelectionStore.getState>) => unknown) =>
        selector ? selector(actual.useSelectionStore.getState()) : actual.useSelectionStore.getState();
    return { ...actual, useSelectionStore: Object.assign(hook, actual.useSelectionStore) };
});

describe('Audio Engine, Mixer Rack & Audio Inspector Parity', () => {
    const sampleClips: AudioClip[] = [
        {
            id: 'audio-1',
            name: 'Synth Bass.mp3',
            dataUrl: 'data:audio/mp3;base64,AAAA',
            startMs: 0,
            durationMs: 4000,
            offsetMs: 0,
            volume: 0.8,
            muted: false,
            solo: false,
            fadeInMs: 500,
            fadeOutMs: 1000,
        },
        {
            id: 'audio-2',
            name: 'Drum Loop.wav',
            dataUrl: 'data:audio/wav;base64,BBBB',
            startMs: 1000,
            durationMs: 3000,
            offsetMs: 500,
            volume: 1.0,
            muted: false,
            solo: true,
        },
    ];

    beforeEach(() => {
        const base = createDefaultProject();
        useProjectStore.setState({
            project: {
                ...base,
                audio: {
                    clips: sampleClips,
                    muted: false,
                    masterVolume: 0.9,
                },
            },
        });
        useSelectionStore.setState({
            selectedAudioClipId: null,
            selectedLightId: null,
            selectedCameraBlockId: null,
            selectedLightBlockId: null,
            selectedLayerIds: [],
            inspectorTab: 'project',
            mixerOpen: false,
            mixerHeightPx: 140,
        });
    });

    it('renders AudioMixer with Master strip, Clear Solo button when solo is active, and track strips', () => {
        const state = useProjectStore.getState();
        const html = renderToStaticMarkup(
            <AudioMixer
                clips={state.project.audio?.clips ?? []}
                masterVolume={state.project.audio?.masterVolume ?? 1}
                masterMuted={state.project.audio?.muted ?? false}
                mixerHeightPx={140}
                selectedAudioClipId={null}
                onResizeMixerHeight={() => {}}
                onSetMasterVolume={state.setProjectMasterVolume}
                onToggleMasterMute={state.toggleProjectAudioMuted}
                onClearSolos={state.clearAudioClipSolos}
                onSelectClip={(id) => useSelectionStore.getState().selectAudioClip(id)}
                onSetClipVolume={(id, vol) => state.updateAudioClip(id, (c) => ({ ...c, volume: vol }))}
                onToggleClipMute={state.toggleAudioClipMuted}
                onToggleClipSolo={state.toggleAudioClipSolo}
            />
        );

        expect(html).toContain('data-testid="audio-mixer-rack"');
        expect(html).toContain('Master');
        expect(html).toContain('90%');
        expect(html).toContain('Clear Solo');
        expect(html).toContain('Synth Bass.mp3');
        expect(html).toContain('Drum Loop.wav');

        // Verify store actions for solo/mute/volume work as expected
        useProjectStore.getState().clearAudioClipSolos();
        const afterClear = useProjectStore.getState().project.audio?.clips ?? [];
        expect(afterClear.every((c) => !c.solo)).toBe(true);

        useProjectStore.getState().toggleAudioClipSolo('audio-1');
        expect(useProjectStore.getState().project.audio?.clips[0]?.solo).toBe(true);

        useProjectStore.getState().toggleAudioClipMuted('audio-2');
        expect(useProjectStore.getState().project.audio?.clips[1]?.muted).toBe(true);
    });

    it('renders empty state in AudioMixer when no audio clips exist', () => {
        const html = renderToStaticMarkup(
            <AudioMixer
                clips={[]}
                masterVolume={1}
                masterMuted={false}
                mixerHeightPx={140}
                selectedAudioClipId={null}
                onResizeMixerHeight={() => {}}
                onSetMasterVolume={() => {}}
                onToggleMasterMute={() => {}}
                onClearSolos={() => {}}
                onSelectClip={() => {}}
                onSetClipVolume={() => {}}
                onToggleClipMute={() => {}}
                onToggleClipSolo={() => {}}
            />
        );
        expect(html).toContain('Add audio to the playlist to mix it here.');
    });

    it('filters non-soloed clips and preserves fadeInMs / fadeOutMs in buildAudioMixPlan', () => {
        const toMixInput = (clips: AudioClip[]): MixPlanClipInput[] =>
            clips.map((c) => ({
                id: c.id,
                name: c.name,
                startMs: c.startMs,
                durationMs: c.durationMs,
                offsetMs: c.offsetMs,
                volume: c.volume,
                muted: c.muted,
                solo: c.solo,
                fadeInMs: c.fadeInMs,
                fadeOutMs: c.fadeOutMs,
                bufferDurationSec: 10,
            }));

        const audio = useProjectStore.getState().project.audio!;
        const plan = buildAudioMixPlan(toMixInput(audio.clips), audio, 0, 5000);

        // Only audio-2 has solo: true
        expect(plan?.entries).toHaveLength(1);
        expect(plan?.entries[0]?.id).toBe('audio-2');

        // Clear solo so audio-1 is included and check fade preservation
        useProjectStore.getState().clearAudioClipSolos();
        const updatedAudio = useProjectStore.getState().project.audio!;
        const planAll = buildAudioMixPlan(toMixInput(updatedAudio.clips), updatedAudio, 0, 5000);

        expect(planAll?.entries).toHaveLength(2);
        const clip1 = planAll?.entries.find((c) => c.id === 'audio-1');
        expect(clip1?.fadeInSec).toBeCloseTo(0.5);
        expect(clip1?.fadeOutSec).toBeCloseTo(1.0);
        expect(clip1?.gain).toBeCloseTo(0.8 * 0.9);
    });

    it('renders AudioClipInspector in RightSidebar when an audio clip is selected', () => {
        useSelectionStore.getState().selectAudioClip('audio-1');
        const project = useProjectStore.getState().project;

        const html = renderToStaticMarkup(
            <RightSidebar
                activeShot={project.shots[0]}
                selectedLayer={undefined}
                selectedLayerIds={[]}
                onSwapImageClick={() => {}}
                onOpenExportModal={() => {}}
            />
        );

        expect(html).toContain('data-testid="audio-clip-inspector"');
        expect(html).toContain('Synth Bass.mp3');
        expect(html).toContain('Fade Envelope');
        expect(html).toContain('Delete Audio Clip');
    });

    it('renders Master Volume and Mute controls in ProjectDetailsSection', () => {
        const { project, updateProject } = useProjectStore.getState();
        const html = renderToStaticMarkup(
            <ProjectDetailsSection project={project} updateProject={updateProject} />
        );

        expect(html).toContain('Master Volume');
        expect(html).toContain('Mute project audio');
    });
});
