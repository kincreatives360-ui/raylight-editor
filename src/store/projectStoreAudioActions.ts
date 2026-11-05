import type { AudioClip } from '../model/types';
import { generateId } from '../model/id';
import type { ProjectStoreActionCreator } from './projectStoreTypes';

export const createAudioActions: ProjectStoreActionCreator<'toggleProjectAudioMuted' | 'splitAudioClipAtPlayhead'> = (_set, get) => ({
    toggleProjectAudioMuted: () => {
        get().updateProject((project) => ({
            ...project,
            audio: {
                ...(project.audio ?? { clips: [], masterVolume: 1 }),
                muted: !project.audio?.muted,
            },
        }));
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
        };
        const updatedFirst: AudioClip = { ...target, durationMs: firstDuration };

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
