// src/store/usePlayheadStore.ts
import { create } from 'zustand';

interface PlayheadStore {
    currentTimeMs: number;
    isPlaying: boolean;
    loop: boolean;
    setCurrentTimeMs: (timeMs: number | ((prev: number) => number)) => void;
    setIsPlaying: (isPlaying: boolean) => void;
    togglePlay: () => void;
    toggleLoop: () => void;
}

export const usePlayheadStore = create<PlayheadStore>((set) => ({
    currentTimeMs: 0,
    isPlaying: false,
    loop: true,

    setCurrentTimeMs: (timeMs) =>
        set((state) => ({
            currentTimeMs:
                typeof timeMs === 'function'
                    ? Math.max(0, timeMs(state.currentTimeMs))
                    : Math.max(0, timeMs),
        })),

    setIsPlaying: (isPlaying) => set({ isPlaying }),

    togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),

    toggleLoop: () => set((state) => ({ loop: !state.loop })),
}));