import type { AudioClip } from '../model/types';
import { generateId } from '../model/id';
import type { ProjectStoreActionCreator } from './projectStoreTypes';

export const createAudioActions: ProjectStoreActionCreator<
    | 'toggleProjectAudioMuted'
    | 'setProjectMasterVolume'
    | 'updateAudioClip'
    | 'deleteAudioClip'
    | 'toggleAudioClipMuted'
    | 'toggleAudioClipSolo'
    | 'clearAudioClipSolos'
    | 'splitAudioClipAtPlayhead'
> = (_set, get) => ({
    toggleProjectAudioMuted: () => {
        get().updateProject((project) => ({
            ...project,
            audio: {
                ...(project.audio ?? { clips: [], masterVolume: 1 }),
                muted: !project.audio?.muted,
            },
        }));
    },

    setProjectMasterVolume: (volume, options) => {
        const clampedVolume = Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : 1));
        get().updateProject(
            (project) => ({
                ...project,
                audio: {
                    ...(project.audio ?? { clips: [], muted: false }),
                    masterVolume: clampedVolume,
                },
            }),
            options
        );
    },

    updateAudioClip: (clipId, updater, options) => {
        get().updateProject(
            (project) => {
                const clips = project.audio?.clips || [];
                if (!clips.some((c) => c.id === clipId)) return project;
                return {
                    ...project,
                    audio: {
                        ...(project.audio ?? { muted: false, masterVolume: 1 }),
                        clips: clips.map((c) => (c.id === clipId ? updater(c) : c)),
                    },
                };
            },
            options
        );
    },

    deleteAudioClip: (clipId) => {
        get().updateProject((project) => ({
            ...project,
            audio: {
                ...(project.audio ?? { muted: false, masterVolume: 1 }),
                clips: (project.audio?.clips || []).filter((c) => c.id !== clipId),
            },
        }));
    },

    toggleAudioClipMuted: (clipId) => {
        get().updateAudioClip(clipId, (clip) => ({
            ...clip,
            muted: !clip.muted,
        }));
    },

    toggleAudioClipSolo: (clipId) => {
        get().updateAudioClip(clipId, (clip) => ({
            ...clip,
            solo: !clip.solo,
        }));
    },

    clearAudioClipSolos: () => {
        get().updateProject((project) => {
            const clips = project.audio?.clips || [];
            if (!clips.some((c) => c.solo)) return project;
            return {
                ...project,
                audio: {
                    ...(project.audio ?? { muted: false, masterVolume: 1 }),
                    clips: clips.map((c) => (c.solo ? { ...c, solo: false } : c)),
                },
            };
        });
    },

    splitAudioClipAtPlayhead: (clipId, globalTimeMs) => {
        const state = get();
        const clips = state.project.audio?.clips || [];
        const target = clips.find((clip) => clip.id === clipId);
        if (!target) return null;

        const splitOffsetMs = globalTimeMs - target.startMs;
        if (splitOffsetMs < 100 || splitOffsetMs > target.durationMs - 100) {
            return null;
        }

        const firstDuration = splitOffsetMs;
        const secondDuration = target.durationMs - splitOffsetMs;
        const secondClip: AudioClip = {
            ...target,
            id: generateId('audio-clip'),
            name: `${target.name} (Part 2)`,
            startMs: globalTimeMs,
            durationMs: secondDuration,
            offsetMs: (target.offsetMs || 0) + firstDuration,
            fadeInMs: 0,
            fadeOutMs: target.fadeOutMs ? Math.min(secondDuration, target.fadeOutMs) : undefined,
        };
        const updatedFirst: AudioClip = {
            ...target,
            durationMs: firstDuration,
            fadeInMs: target.fadeInMs ? Math.min(firstDuration, target.fadeInMs) : undefined,
            fadeOutMs: 0,
        };

        get().updateProject((project) => {
            const currentClips = project.audio?.clips || [];
            const index = currentClips.findIndex((clip) => clip.id === clipId);
            if (index === -1) return project;
            const nextClips = [...currentClips];
            nextClips.splice(index, 1, updatedFirst, secondClip);
            return {
                ...project,
                audio: {
                    ...(project.audio || { muted: false, masterVolume: 1 }),
                    clips: nextClips,
                },
            };
        });

        return secondClip;
    },
});
