// src/engine/cameraEvaluation.test.ts
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { evaluateShotCameraAtTime } from './evaluateCamera';
import { evaluateCameraPose, getReferencePlaneDimensions } from '../stage/webgl/cameraMath';
import { computeFramingBox } from '../stage/CameraFramingOverlay';
import { validateProject } from '../model/schema';
import { DEFAULT_PROJECT } from '../model/defaults';
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
        const box1 = computeFramingBox({ zoom: 1.0 }, artboardW, artboardH, artboardW, artboardH);
        expect(box1.width).toBe(1920);
        expect(box1.height).toBe(1080);

        // At zoom 1.46x
        const box146 = computeFramingBox({ zoom: 1.46 }, artboardW, artboardH, artboardW, artboardH);
        expect(Math.round(box146.width)).toBe(1315);
        expect(Math.round(box146.height)).toBe(740);

        // Aspect ratio is locked to artboard's (16:9)
        expect(Number((box146.width / box146.height).toFixed(4))).toBe(Number((1920 / 1080).toFixed(4)));
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

        // Multiple rotation axes test Euler order matching Three.js default 'XYZ'
        const rotCam = {
            target: { x: 0, y: 0, z: 0 },
            rotation: { x: 0.1, y: 0.2, z: 0.3 },
            zoom: 1,
            fovDegrees: 27.0006,
            focalLength: 50,
            activeMode: 'dolly' as const,
        };
        const rotPose = evaluateCameraPose(rotCam, defaultCam, aspect);
        const expectedOffset = new THREE.Vector3(0, 0, 2.65).applyEuler(new THREE.Euler(0.1, 0.2, 0.3, 'XYZ'));
        expect(rotPose.position.x).toBeCloseTo(expectedOffset.x, 4);
        expect(rotPose.position.y).toBeCloseTo(expectedOffset.y, 4);
        expect(rotPose.position.z).toBeCloseTo(expectedOffset.z, 4);
    });

    it('4. Migrates legacy project with fractional framing targets and anchors to artboard pixels and inverted Y', () => {
        const testShot: Shot = {
            ...DEFAULT_PROJECT.shots[0],
            id: 'shot-1',
            framings: [
                { id: 'f1', name: 'F1', target: { x: 0.1, y: -0.05, z: 0 }, zoom: 1 },
            ],
            cameraBlocks: [
                {
                    id: 'cam-1',
                    startMs: 0,
                    durationMs: 4000,
                    fromFramingId: 'f1',
                    toFramingId: 'f1',
                    mode: 'dolly',
                    easing: { kind: 'preset', name: 'linear' },
                    from: { anchorX: -0.2, anchorY: 0.1, zoom: 1, roll: 0, orbit: 0, tilt: 0 },
                    to: { anchorX: 0.3, anchorY: -0.4, zoom: 1.2, roll: 0, orbit: 0, tilt: 0 },
                },
            ],
        };

        const legacyProject = {
            ...DEFAULT_PROJECT,
            id: 'proj-legacy',
            version: 1,
            schemaVersion: 1,
            shots: [testShot],
        };

        const result = validateProject(legacyProject);
        expect(result.success).toBe(true);
        if (result.success) {
            const shot = result.data.shots[0];
            expect(shot.framings[0].target.x).toBe(Math.round(0.1 * 1920)); // 192
            expect(shot.framings[0].target.y).toBe(Math.round(-(-0.05) * 1080)); // 54
            expect(shot.cameraBlocks[0].from?.anchorX).toBe(Math.round(-0.2 * 1920)); // -384
            expect(shot.cameraBlocks[0].from?.anchorY).toBe(Math.round(-0.1 * 1080)); // -108
            expect(shot.cameraBlocks[0].to?.anchorX).toBe(Math.round(0.3 * 1920)); // 576
            expect(shot.cameraBlocks[0].to?.anchorY).toBe(Math.round(-(-0.4) * 1080)); // 432
            expect(result.data.schemaVersion).toBe(2);
        }
    });
});

