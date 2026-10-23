// src/store/shotSplitTransitions.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore } from './useProjectStore';
import type { FocusBlock } from '../model/types';

describe('Shot Splitting: Focus Blocks, Transitions, and Boundary Continuity', () => {
    beforeEach(() => {
        useProjectStore.getState().resetProject();
    });

    it('P1: correctly splits focusBlocks crossing playhead and shifts right-side focusBlocks', () => {
        const store = useProjectStore.getState();
        const initialShot = store.project.shots[0];

        const focus1: FocusBlock = {
            id: 'focus-1',
            label: 'Foreground Rack',
            startMs: 500,
            durationMs: 1000, // 500 to 1500 -> completely before split at 2000
            fromZ: -10,
            toZ: 5,
            easing: { kind: 'preset', name: 'linear' },
        };

        const focusCross: FocusBlock = {
            id: 'focus-cross',
            label: 'Cross-Split Rack',
            startMs: 1500,
            durationMs: 1000, // 1500 to 2500 -> crosses 2000 split point
            fromZ: 0,
            toZ: 20,
            easing: { kind: 'preset', name: 'linear' },
        };

        const focus2: FocusBlock = {
            id: 'focus-2',
            label: 'Background Rack',
            startMs: 2500,
            durationMs: 800, // 2500 to 3300 -> completely after split at 2000
            fromZ: 10,
            toZ: 30,
            easing: { kind: 'preset', name: 'linear' },
        };

        store.updateShot(initialShot.id, (s) => ({
            ...s,
            durationMs: 4000,
            focusBlocks: [focus1, focusCross, focus2],
            transition: {
                type: 'crossfade',
                durationMs: 600,
                easing: { kind: 'preset', name: 'ease-in-out' },
            },
        }));

        const secondShot = store.splitShotAtPlayhead(initialShot.id, 2000);
        expect(secondShot).not.toBeNull();

        const updatedShots = useProjectStore.getState().project.shots;
        const firstShot = updatedShots[0];
        const secondShotInStore = updatedShots[1];

        // 1. First shot (0 to 2000ms):
        expect(firstShot.durationMs).toBe(2000);
        // Keeps focus1 (0 to 1500) and trimmed focusCross (1500 to 2000 => duration 500)
        expect(firstShot.focusBlocks?.length).toBe(2);
        expect(firstShot.focusBlocks?.[0].id).toBe('focus-1');
        expect(firstShot.focusBlocks?.[0].durationMs).toBe(1000);
        expect(firstShot.focusBlocks?.[1].id).toBe('focus-cross');
        expect(firstShot.focusBlocks?.[1].durationMs).toBe(500); // 2000 - 1500

        // First shot keeps the original incoming transition!
        expect(firstShot.transition.type).toBe('crossfade');
        expect(firstShot.transition.durationMs).toBe(600);

        // 2. Second shot (2000 to 4000ms -> duration 2000ms):
        expect(secondShotInStore.durationMs).toBe(2000);
        expect(secondShotInStore.focusBlocks?.length).toBe(2);
        // The split part of focusCross starts at 0ms in second shot, remaining duration 500ms
        const secondCross = secondShotInStore.focusBlocks?.[0];
        expect(secondCross?.startMs).toBe(0);
        expect(secondCross?.durationMs).toBe(500);
        expect(secondCross?.id).not.toBe('focus-cross'); // Gets a new unique ID!

        // focus2 was completely in second half: shifted from 2500 -> 500ms
        const secondFocus2 = secondShotInStore.focusBlocks?.[1];
        expect(secondFocus2?.startMs).toBe(500); // 2500 - 2000
        expect(secondFocus2?.durationMs).toBe(800);
        expect(secondFocus2?.id).toBe('focus-2'); // Unsplit block preserves identity

        // CRITICAL FIX: Second shot incoming transition must be a seamless cut (not cloned crossfade)
        expect(secondShotInStore.transition.type).toBe('cut');
        expect(secondShotInStore.transition.durationMs).toBe(0);
    });
});
