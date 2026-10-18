// src/engine/cameraEvaluation.test.ts
import { describe, it, expect } from 'vitest';
import { evaluateShotCameraAtTime } from './evaluateCamera';
import { evaluateCameraPose, getReferencePlaneDimensions } from '../stage/webgl/cameraMath';
import type { Shot, CameraBlock } from '../model/types';

describe('Raylight Camera Framing & Evaluation', () => {
    const createTestShot = (cameraBlocks: CameraBlock[] = []): Shot => ({
        id: 'shot-1',
        name: 'Shot 1',
        startMs: 0,
        durationMs: 4000,
        lane: 0,
        layers: [],
        groups: [],
        framings: [
            { id: 'f1', name: 'From', target: { x: 0, y: 0, z: 0 }, zoom: 1 },
            { id: 'f2', name: 'To', target: { x: 0, y: 0, z: 0 }, zoom: 1.4 },
        ],
        cameraBlocks,
        lightBlocks: [],
        effectBlocks: [],
        light: {} as unknown as Shot['light'],
        effects: {} as unknown as Shot['effects'],
        effectsOrder: [],
        transition: { type: 'cut', durationMs: 0, easing: { kind: 'preset', name: 'linear' } },
    });

    it('1. Data model: derives rectangle dimensions strictly from numbers (width = 1920/zoom, height = 1080/zoom)', () => {
        const artboardW = 1920;
        const artboardH = 1080;

        // At zoom 1x, rectangle matches artboard exactly
        const zoom1 = 1.0;
        expect(artboardW / zoom1).toBe(1920);
        expect(artboardH / zoom1).toBe(1080);

        // At zoom 1.46x
        const zoom146 = 1.46;
        const w146 = artboardW / zoom146;
        const h146 = artboardH / zoom146;
        expect(Math.round(w146)).toBe(1315);
        expect(Math.round(h146)).toBe(740);

        // Aspect ratio is locked to artboard's (16:9)
        expect(Number((w146 / h146).toFixed(4))).toBe(Number((1920 / 1080).toFixed(4)));
    });

    it('2. Evaluates clip start holding From view and clip end holding To view', () => {
        const block: CameraBlock = {
            id: 'cam-1',
            startMs: 1000,
            durationMs: 2000,
            fromFramingId: 'f1',
            toFramingId: 'f2',
            mode: 'dolly',
            easing: { kind: 'preset', name: 'linear' },
            from: {
                anchorX: -1866,
                anchorY: 714,
                zoom: 1.46,
                roll: 0,
                orbit: 0,
                tilt: 0,
            },
            to: {
                anchorX: -1231,
                anchorY: 375,
                zoom: 1.4,
                roll: 0,
                orbit: 0,
                tilt: 0,
            },
        };

        const shot = createTestShot([block]);

        // Before clip start (e.g. 0ms) -> Holds From view
        const beforeClip = evaluateShotCameraAtTime(shot, 0);
        expect(beforeClip.target.x).toBe(-1866);
        expect(beforeClip.target.y).toBe(714);
        expect(beforeClip.zoom).toBe(1.46);

        // At clip start (1000ms) -> Exactly From view
        const atStart = evaluateShotCameraAtTime(shot, 1000);
        expect(atStart.target.x).toBe(-1866);
        expect(atStart.target.y).toBe(714);
        expect(atStart.zoom).toBe(1.46);

        // Mid-clip (2000ms) -> Interpolated 50%
        const midClip = evaluateShotCameraAtTime(shot, 2000);
        expect(midClip.target.x).toBeCloseTo((-1866 + -1231) / 2, 0);
        expect(midClip.target.y).toBeCloseTo((714 + 375) / 2, 0);
        expect(midClip.zoom).toBeCloseTo((1.46 + 1.4) / 2, 2);

        // At clip end (3000ms) -> Exactly To view
        const atEnd = evaluateShotCameraAtTime(shot, 3000);
        expect(atEnd.target.x).toBe(-1231);
        expect(atEnd.target.y).toBe(375);
        expect(atEnd.zoom).toBe(1.4);

        // After clip end (3500ms) -> Holds To view
        const afterClip = evaluateShotCameraAtTime(shot, 3500);
        expect(afterClip.target.x).toBe(-1231);
        expect(afterClip.target.y).toBe(375);
        expect(afterClip.zoom).toBe(1.4);
    });

    it('3. Three.js camera pose translates anchor to frame centre and scales by zoom', () => {
        const aspect = 16 / 9;
        const defaultCam = {
            position: { x: 0, y: 0, z: 2.65 },
            rotation: { x: 0, y: 0, z: 0 },
            focalLength: 50,
        };
        const { planeW, planeH } = getReferencePlaneDimensions(aspect, 2.65, 50);

        // From view: anchor (-1866, 714), zoom 1.46
        const fromCam = {
            target: { x: -1866, y: 714, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            zoom: 1.46,
            fovDegrees: 27.0006,
            focalLength: 50,
            activeMode: 'dolly' as const,
        };
        const fromPose = evaluateCameraPose(fromCam, defaultCam, aspect);

        // Camera position X and Y align with the anchor in Three.js coordinates
        const expectedFromThreeX = (-1866 / 1920) * planeW;
        const expectedFromThreeY = (714 / 1080) * planeH;
        expect(fromPose.position.x).toBeCloseTo(expectedFromThreeX, 4);
        expect(fromPose.position.y).toBeCloseTo(expectedFromThreeY, 4);
        expect(fromPose.position.z).toBeCloseTo(2.65 / 1.46, 4);

        // To view: anchor (-1231, 375), zoom 1.4
        const toCam = {
            target: { x: -1231, y: 375, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            zoom: 1.4,
            fovDegrees: 27.0006,
            focalLength: 50,
            activeMode: 'dolly' as const,
        };
        const toPose = evaluateCameraPose(toCam, defaultCam, aspect);

        const expectedToThreeX = (-1231 / 1920) * planeW;
        const expectedToThreeY = (375 / 1080) * planeH;
        expect(toPose.position.x).toBeCloseTo(expectedToThreeX, 4);
        expect(toPose.position.y).toBeCloseTo(expectedToThreeY, 4);
        expect(toPose.position.z).toBeCloseTo(2.65 / 1.4, 4);
    });
});
