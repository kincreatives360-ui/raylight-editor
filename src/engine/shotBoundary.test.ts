// src/engine/shotBoundary.test.ts
import { describe, it, expect } from 'vitest';
import { evaluateProjectAtTime } from './evaluateShot';
import { createDefaultProject, createDefaultShot } from '../model/defaults';

describe('Shot Boundary Evaluation: Deterministic Half-Open Intervals', () => {
    it('P2: resolves adjacent shot boundaries deterministically without earlier shot winning at boundary', () => {
        const shot0 = createDefaultShot({
            id: 'shot-0',
            name: 'Shot 0',
            startMs: 0,
            durationMs: 3000,
        });

        const shot1 = createDefaultShot({
            id: 'shot-1',
            name: 'Shot 1',
            startMs: 3000,
            durationMs: 3000,
        });

        const project = createDefaultProject({
            shots: [shot0, shot1],
        });

        // 1. At t = 0: Should resolve to shot 0
        const frame0 = evaluateProjectAtTime(project, 0);
        expect(frame0.activeShot.id).toBe('shot-0');
        expect(frame0.shotIndex).toBe(0);
        expect(frame0.shotLocalTimeMs).toBe(0);

        // 2. At t = 2999 (1ms before boundary): Should resolve to shot 0
        const frameBefore = evaluateProjectAtTime(project, 2999);
        expect(frameBefore.activeShot.id).toBe('shot-0');
        expect(frameBefore.shotIndex).toBe(0);
        expect(frameBefore.shotLocalTimeMs).toBe(2999);

        // 3. At EXACT boundary t = 3000ms:
        // Half-open interval [0, 3000) for shot 0 means t=3000 MUST resolve to shot 1 [3000, 6000]!
        const frameBoundary = evaluateProjectAtTime(project, 3000);
        expect(frameBoundary.activeShot.id).toBe('shot-1');
        expect(frameBoundary.shotIndex).toBe(1);
        expect(frameBoundary.shotLocalTimeMs).toBe(0);

        // 4. Inside shot 1: t = 4500ms
        const frameInside = evaluateProjectAtTime(project, 4500);
        expect(frameInside.activeShot.id).toBe('shot-1');
        expect(frameInside.shotIndex).toBe(1);
        expect(frameInside.shotLocalTimeMs).toBe(1500);

        // 5. At EXACT final project endpoint t = 6000ms:
        // Closed endpoint for terminal shot ensures the last frame remains evaluable
        const frameEnd = evaluateProjectAtTime(project, 6000);
        expect(frameEnd.activeShot.id).toBe('shot-1');
        expect(frameEnd.shotIndex).toBe(1);
        expect(frameEnd.shotLocalTimeMs).toBe(3000);
    });
});
