// src/stage/webgl/cameraPresets.test.ts
import { describe, it, expect } from 'vitest';
import {
    CAMERA_PRESETS,
    CAMERA_MOVEMENT_PRESETS,
    applyCameraPreset,
    applyCameraMovementPreset,
    getMovementPresetIdByLabel,
    calculateLayersBoundingFraming,
    calculateLayerFraming,
    detectMatchingPreset,
    LENS_PRESETS,
    focalLengthToFov,
    computeLogarithmicDolly,
    type FramableLayer,
} from './cameraMath';
import type { CameraBlock } from '../../model/types';

describe('Unified Camera Presets & Framing System', () => {
    describe('CAMERA_PRESETS registry', () => {
        it('contains expected presets with no duplicate IDs', () => {
            expect(CAMERA_PRESETS.length).toBeGreaterThanOrEqual(16);
            const ids = CAMERA_PRESETS.map((p) => p.id);
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(ids.length);
        });

        it('includes all axial orthogonal presets', () => {
            const axial = CAMERA_PRESETS.filter((p) => p.category === 'axial');
            const axialIds = axial.map((p) => p.id);
            expect(axialIds).toContain('front');
            expect(axialIds).toContain('back');
            expect(axialIds).toContain('top');
            expect(axialIds).toContain('bottom');
            expect(axialIds).toContain('left');
            expect(axialIds).toContain('right');

            const front = CAMERA_PRESETS.find((p) => p.id === 'front')!;
            expect(front.orbit).toBe(0);
            expect(front.tilt).toBe(0);
            expect(front.roll).toBe(0);

            const top = CAMERA_PRESETS.find((p) => p.id === 'top')!;
            expect(top.tilt).toBe(-89);

            const right = CAMERA_PRESETS.find((p) => p.id === 'right')!;
            expect(right.orbit).toBe(90);
        });

        it('includes axonometric, shot-types and angle presets with correct properties', () => {
            const iso = CAMERA_PRESETS.find((p) => p.id === 'isometric')!;
            expect(iso.category).toBe('axonometric');
            expect(iso.orbit).toBe(45);
            expect(iso.tilt).toBeCloseTo(35.26, 1);

            const dutch = CAMERA_PRESETS.find((p) => p.id === 'dutch-tilt')!;
            expect(dutch.category).toBe('angle');
            expect(dutch.roll).toBe(-12);

            const closeUp = CAMERA_PRESETS.find((p) => p.id === 'close-up')!;
            expect(closeUp.category).toBe('shot-type');
            expect(closeUp.zoom).toBe(1.8);
            expect(closeUp.focalLength).toBe(85);

            const establishing = CAMERA_PRESETS.find((p) => p.id === 'establishing')!;
            expect(establishing.category).toBe('shot-type');
            expect(establishing.zoom).toBe(0.65);
            expect(establishing.focalLength).toBe(20);

            const fullShot = CAMERA_PRESETS.find((p) => p.id === 'full-shot')!;
            expect(fullShot.category).toBe('shot-type');
            expect(fullShot.zoom).toBe(0.95);

            const twoShot = CAMERA_PRESETS.find((p) => p.id === 'two-shot')!;
            expect(twoShot.category).toBe('shot-type');
            expect(twoShot.zoom).toBe(1.08);

            const downShot = CAMERA_PRESETS.find((p) => p.id === 'down-shot')!;
            expect(downShot.category).toBe('angle');
            expect(downShot.tilt).toBe(25);
            expect(downShot.anchorY).toBe(180);

            const ots = CAMERA_PRESETS.find((p) => p.id === 'over-shoulder')!;
            expect(ots.category).toBe('angle');
            expect(ots.anchorX).toBe(-180);

            const pov = CAMERA_PRESETS.find((p) => p.id === 'pov')!;
            expect(pov.category).toBe('angle');
            expect(pov.shake?.from).toBe(4);
        });
    });

    describe('applyCameraPreset', () => {
        it('applies orientation without overwriting zoom when preset has no zoom', () => {
            const current = { anchorX: 100, anchorY: -50, zoom: 1.5, orbit: 10, tilt: 5, roll: 0 };
            const front = CAMERA_PRESETS.find((p) => p.id === 'front')!;
            const updated = applyCameraPreset(front, current);

            expect(updated.orbit).toBe(0);
            expect(updated.tilt).toBe(0);
            expect(updated.roll).toBe(0);
            expect(updated.zoom).toBe(1.5);
            expect(updated.anchorX).toBe(100);
            expect(updated.anchorY).toBe(-50);
        });

        it('applies zoom when preset specifies zoom', () => {
            const current = { zoom: 1.0, orbit: 0, tilt: 0, roll: 0 };
            const closeUp = CAMERA_PRESETS.find((p) => p.id === 'close-up')!;
            const updated = applyCameraPreset(closeUp, current);

            expect(updated.zoom).toBe(1.8);
        });
    });

    describe('calculateLayersBoundingFraming', () => {
        const artboard = { width: 1920, height: 1080 };

        it('returns default centering for empty layer list', () => {
            const framing = calculateLayersBoundingFraming([], artboard);
            expect(framing).toEqual({ anchorX: 0, anchorY: 0, zoom: 1 });
        });

        it('frames a single centered layer with correct zoom and padding', () => {
            const layer: FramableLayer = {
                position: { x: 0, y: 0, z: 0 },
                size: { width: 0.5, height: 0.5 },
                scale: { x: 1, y: 1, z: 1 },
            };
            const framing = calculateLayersBoundingFraming([layer], artboard, 1.25);

            expect(framing.anchorX).toBe(0);
            expect(framing.anchorY).toBe(0);
            // 1 / (0.5 * 1.25) = 1.6
            expect(framing.zoom).toBeCloseTo(1.6, 2);
        });

        it('accurately offsets anchor for positioned layers', () => {
            // Layer placed at 20% to right, 10% down in model space
            const layer: FramableLayer = {
                position: { x: 0.2, y: 0.1, z: 0 },
                size: { width: 0.2, height: 0.2 },
                scale: { x: 1, y: 1, z: 1 },
            };
            const framing = calculateLayersBoundingFraming([layer], artboard, 1.25);

            expect(framing.anchorX).toBe(Math.round(0.2 * 1920)); // 384
            expect(framing.anchorY).toBe(Math.round(-0.1 * 1080)); // -108
            expect(framing.zoom).toBeGreaterThan(1);
        });

        it('computes combined bounding box for multiple layers', () => {
            const layer1: FramableLayer = {
                position: { x: -0.2, y: 0, z: 0 },
                size: { width: 0.2, height: 0.2 },
            };
            const layer2: FramableLayer = {
                position: { x: 0.2, y: 0, z: 0 },
                size: { width: 0.2, height: 0.2 },
            };
            const framing = calculateLayersBoundingFraming([layer1, layer2], artboard, 1.25);

            // Centroid is at x=0
            expect(framing.anchorX).toBe(0);
            expect(framing.anchorY).toBe(0);
            // Total width span = 0.2 - (-0.2) + 0.2 = 0.6
            // Required zoom = 1 / (0.6 * 1.25) = 1.33
            expect(framing.zoom).toBeCloseTo(1.33, 2);
        });

        it('clamps zoom within valid bounds [0.2, 5.0]', () => {
            const hugeLayer: FramableLayer = {
                position: { x: 0, y: 0, z: 0 },
                size: { width: 10, height: 10 },
            };
            const tinyLayer: FramableLayer = {
                position: { x: 0, y: 0, z: 0 },
                size: { width: 0.001, height: 0.001 },
            };

            const minFraming = calculateLayersBoundingFraming([hugeLayer], artboard);
            const maxFraming = calculateLayersBoundingFraming([tinyLayer], artboard);

            expect(minFraming.zoom).toBe(0.2);
            expect(maxFraming.zoom).toBe(5.0);
        });

        it('calculateLayerFraming single layer convenience method', () => {
            const layer: FramableLayer = {
                position: { x: 0.1, y: -0.1, z: 0 },
                size: { width: 0.4, height: 0.4 },
            };
            const single = calculateLayerFraming(layer, artboard);
            const multi = calculateLayersBoundingFraming([layer], artboard);

            expect(single).toEqual(multi);
        });
    });

    describe('detectMatchingPreset', () => {
        it('matches preset by explicit presetId', () => {
            const ep = { presetId: 'isometric', orbit: 12, tilt: 34, roll: 0, zoom: 1 };
            const detected = detectMatchingPreset(ep);
            expect(detected).not.toBeNull();
            expect(detected?.id).toBe('isometric');
        });

        it('detects orthogonal axial presets by orientation angles', () => {
            const front = detectMatchingPreset({ orbit: 0, tilt: 0, roll: 0 });
            expect(front?.id).toBe('front');

            const back = detectMatchingPreset({ orbit: 180, tilt: 0, roll: 0 });
            expect(back?.id).toBe('back');

            const top = detectMatchingPreset({ orbit: 0, tilt: -89, roll: 0 });
            expect(top?.id).toBe('top');

            const right = detectMatchingPreset({ orbit: 90, tilt: 0, roll: 0 });
            expect(right?.id).toBe('right');
        });

        it('detects axonometric presets with angle tolerance', () => {
            const iso = detectMatchingPreset({ orbit: 45.1, tilt: 35.3, roll: 0 });
            expect(iso?.id).toBe('isometric');

            const studio = detectMatchingPreset({ orbit: 35, tilt: 20, roll: 0 });
            expect(studio?.id).toBe('dimetric');
        });

        it('detects cinematic angle presets including Dutch angle', () => {
            const dutch = detectMatchingPreset({ orbit: 20, tilt: 8, roll: -12 });
            expect(dutch?.id).toBe('dutch-tilt');

            const hero = detectMatchingPreset({ orbit: 18, tilt: -16, roll: 0 });
            expect(hero?.id).toBe('hero-low');
        });

        it('differentiates zoom-based cinematic presets (close-up vs front)', () => {
            const closeUp = detectMatchingPreset({ orbit: 0, tilt: 0, roll: 0, zoom: 1.8 });
            expect(closeUp?.id).toBe('close-up');

            const wide = detectMatchingPreset({ orbit: 0, tilt: 0, roll: 0, zoom: 0.75 });
            expect(wide?.id).toBe('wide-angle');

            const standardFront = detectMatchingPreset({ orbit: 0, tilt: 0, roll: 0, zoom: 1.0 });
            expect(standardFront?.id).toBe('front');
        });

        it('returns null for arbitrary custom angles outside tolerance', () => {
            const custom = detectMatchingPreset({ orbit: 123.4, tilt: 42.1, roll: 17.5 });
            expect(custom).toBeNull();
        });

        it('handles null/undefined safely', () => {
            expect(detectMatchingPreset(null)).toBeNull();
            expect(detectMatchingPreset(undefined)).toBeNull();
        });
    });

    describe('applyCameraPreset with focalLength & presetId', () => {
        it('attaches presetId and focalLength when applying preset', () => {
            const heroPreset = CAMERA_PRESETS.find((p) => p.id === 'hero-low')!;
            const ep = { anchorX: 0, anchorY: 0, zoom: 1.0, orbit: 0, tilt: 0, roll: 0 };
            const applied = applyCameraPreset(heroPreset, ep);

            expect(applied.presetId).toBe('hero-low');
            expect(applied.orbit).toBe(18);
            expect(applied.tilt).toBe(-16);
            expect(applied.focalLength).toBe(28);
        });

        it('applies wide-angle preset with 24mm lens and 0.75x zoom', () => {
            const widePreset = CAMERA_PRESETS.find((p) => p.id === 'wide-angle')!;
            const ep = { anchorX: 10, anchorY: 20, zoom: 1.0, orbit: 0, tilt: 0, roll: 0 };
            const applied = applyCameraPreset(widePreset, ep);

            expect(applied.presetId).toBe('wide-angle');
            expect(applied.zoom).toBe(0.75);
            expect(applied.focalLength).toBe(24);
        });
    });

    describe('Lens Presets & focalLengthToFov', () => {
        it('provides standard cinema/photo lens options in LENS_PRESETS', () => {
            expect(LENS_PRESETS.map((l) => l.mm)).toEqual([24, 35, 50, 85, 135]);
        });

        it('converts 50mm lens on 24mm sensor to ~27° FOV', () => {
            const fov50 = focalLengthToFov(50);
            expect(fov50).toBeCloseTo(27.0, 1);
        });

        it('converts wide-angle and telephoto lenses correctly', () => {
            const fov24 = focalLengthToFov(24);
            expect(fov24).toBeGreaterThan(50); // ~53.1° wide FOV

            const fov85 = focalLengthToFov(85);
            expect(fov85).toBeLessThan(20); // ~16.1° telephoto FOV
        });
    });

    describe('CAMERA_MOVEMENT_PRESETS registry', () => {
        it('contains all 15 cinematic camera movements with no duplicate IDs', () => {
            expect(CAMERA_MOVEMENT_PRESETS.length).toBe(15);
            const ids = CAMERA_MOVEMENT_PRESETS.map((m) => m.id);
            const unique = new Set(ids);
            expect(unique.size).toBe(ids.length);
        });

        it('includes the 6 basic camera moves plus vertigo and handheld sway', () => {
            const ids = CAMERA_MOVEMENT_PRESETS.map((m) => m.id);
            expect(ids).toContain('zoom-in');
            expect(ids).toContain('zoom-out');
            expect(ids).toContain('pan-left');
            expect(ids).toContain('pan-right');
            expect(ids).toContain('tilt-up');
            expect(ids).toContain('tilt-down');
            expect(ids).toContain('dolly-in');
            expect(ids).toContain('dolly-out');
            expect(ids).toContain('truck-left');
            expect(ids).toContain('truck-right');
            expect(ids).toContain('pedestal-up');
            expect(ids).toContain('pedestal-down');
            expect(ids).toContain('dolly-zoom-in');
            expect(ids).toContain('dolly-zoom-out');
            expect(ids).toContain('handheld-sway');
        });
    });

    describe('applyCameraMovementPreset generator', () => {
        const createTestBlock = (): CameraBlock => ({
            id: 'block-test-1',
            label: 'Test Move',
            startMs: 0,
            durationMs: 2000,
            fromFramingId: 'f1',
            toFramingId: 'f2',
            mode: 'dolly',
            easing: { kind: 'preset', name: 'linear' },
            from: {
                anchorX: 120,
                anchorY: -60,
                anchorZ: 0,
                zoom: 1.0,
                roll: 0,
                orbit: 10,
                tilt: 5,
                focalLength: 50,
            },
            to: {
                anchorX: 120,
                anchorY: -60,
                anchorZ: 0,
                zoom: 1.0,
                roll: 0,
                orbit: 10,
                tilt: 5,
                focalLength: 50,
            },
        });

        it('generates Zoom In movement with mode zoom and increased magnification', () => {
            const block = createTestBlock();
            const updated = applyCameraMovementPreset(block, 'zoom-in');

            expect(updated.mode).toBe('zoom');
            expect(updated.label).toBe('Zoom In');
            expect(updated.from?.zoom).toBe(1.0);
            expect(updated.to?.zoom).toBeGreaterThan(1.4);
            expect(updated.from?.anchorX).toBe(120); // Preserves initial anchor
            expect(updated.from?.anchorY).toBe(-60);
        });

        it('generates Zoom Out movement with mode zoom and reduced magnification', () => {
            const block = createTestBlock();
            const updated = applyCameraMovementPreset(block, 'zoom-out');

            expect(updated.mode).toBe('zoom');
            expect(updated.label).toBe('Zoom Out');
            expect(updated.to?.zoom).toBeLessThan(updated.from?.zoom ?? 1);
        });

        it('generates Pan Left and Pan Right rotating orbit yaw on stationary tripod', () => {
            const block = createTestBlock();
            const panL = applyCameraMovementPreset(block, 'pan-left');
            expect(panL.mode).toBe('dolly');
            expect(panL.to?.orbit).toBe(block.from!.orbit - 20);

            const panR = applyCameraMovementPreset(block, 'pan-right');
            expect(panR.to?.orbit).toBe(block.from!.orbit + 20);
        });

        it('generates Tilt Up and Tilt Down rotating tilt pitch on stationary tripod', () => {
            const block = createTestBlock();
            const tiltU = applyCameraMovementPreset(block, 'tilt-up');
            expect(tiltU.mode).toBe('dolly');
            expect(tiltU.to?.tilt).toBe(block.from!.tilt - 18);

            const tiltD = applyCameraMovementPreset(block, 'tilt-down');
            expect(tiltD.to?.tilt).toBe(block.from!.tilt + 18);
        });

        it('generates Dolly In and Dolly Out translating 3D depth anchorZ', () => {
            const block = createTestBlock();
            const dollyIn = applyCameraMovementPreset(block, 'dolly-in');
            expect(dollyIn.mode).toBe('dolly');
            expect(dollyIn.to?.anchorZ).toBeGreaterThan(dollyIn.from?.anchorZ ?? 0);

            const dollyOut = applyCameraMovementPreset(block, 'dolly-out');
            expect(dollyOut.mode).toBe('dolly');
            expect(dollyOut.from?.anchorZ).toBeGreaterThan(dollyOut.to?.anchorZ ?? 0);
        });

        it('generates Truck Left and Truck Right lateral track translations', () => {
            const block = createTestBlock();
            const artboard = { width: 1920, height: 1080 };
            const truckL = applyCameraMovementPreset(block, 'truck-left', { artboardDimensions: artboard });
            expect(truckL.mode).toBe('dolly');
            expect(truckL.to?.anchorX).toBeLessThan(block.from!.anchorX);

            const truckR = applyCameraMovementPreset(block, 'truck-right', { artboardDimensions: artboard });
            expect(truckR.to?.anchorX).toBeGreaterThan(block.from!.anchorX);
        });

        it('generates Pedestal Up and Pedestal Down physical crane height translations', () => {
            const block = createTestBlock();
            const artboard = { width: 1920, height: 1080 };
            const pedUp = applyCameraMovementPreset(block, 'pedestal-up', { artboardDimensions: artboard });
            expect(pedUp.mode).toBe('dolly');
            expect(pedUp.to?.anchorY).toBeGreaterThan(block.from!.anchorY);

            const pedDown = applyCameraMovementPreset(block, 'pedestal-down', { artboardDimensions: artboard });
            expect(pedDown.to?.anchorY).toBeLessThan(block.from!.anchorY);
        });

        it('generates Vertigo Dolly Zoom with mode dollyzoom and counterbalancing push/pull', () => {
            const block = createTestBlock();
            const vertigoIn = applyCameraMovementPreset(block, 'dolly-zoom-in');
            expect(vertigoIn.mode).toBe('dollyzoom');
            expect(vertigoIn.to?.anchorZ).toBeGreaterThan(vertigoIn.from?.anchorZ ?? 0);
            expect(vertigoIn.to?.zoom).toBeLessThan(vertigoIn.from?.zoom ?? 1);

            const vertigoOut = applyCameraMovementPreset(block, 'dolly-zoom-out');
            expect(vertigoOut.mode).toBe('dollyzoom');
            expect(vertigoOut.from?.anchorZ).toBeGreaterThan(vertigoOut.to?.anchorZ ?? 0);
            expect(vertigoOut.to?.zoom).toBeGreaterThan(vertigoOut.from?.zoom ?? 1);
        });

        it('generates Handheld Organic Sway with mode shake and realistic amplitude', () => {
            const block = createTestBlock();
            const sway = applyCameraMovementPreset(block, 'handheld-sway');
            expect(sway.mode).toBe('shake');
            expect(sway.shake?.from).toBe(15);
            expect(sway.shake?.to).toBe(25);
            expect(sway.shake?.frequency).toBe(1.0);
        });

        it('respects preserveDuration option when requested', () => {
            const block = createTestBlock();
            block.durationMs = 4500;
            const preserved = applyCameraMovementPreset(block, 'pan-right', { preserveDuration: true });
            expect(preserved.durationMs).toBe(4500);

            const defaultDur = applyCameraMovementPreset(block, 'pan-right', { preserveDuration: false });
            expect(defaultDur.durationMs).toBe(1800);
        });

        it('resolves preset IDs from labels and aliases with getMovementPresetIdByLabel', () => {
            // Exact preset names
            expect(getMovementPresetIdByLabel('Zoom In')).toBe('zoom-in');
            expect(getMovementPresetIdByLabel('Zoom Out')).toBe('zoom-out');
            expect(getMovementPresetIdByLabel('Pan Left')).toBe('pan-left');
            expect(getMovementPresetIdByLabel('Pan Right')).toBe('pan-right');
            expect(getMovementPresetIdByLabel('Tilt Up')).toBe('tilt-up');
            expect(getMovementPresetIdByLabel('Tilt Down')).toBe('tilt-down');
            expect(getMovementPresetIdByLabel('Dolly In')).toBe('dolly-in');
            expect(getMovementPresetIdByLabel('Dolly Out')).toBe('dolly-out');
            expect(getMovementPresetIdByLabel('Truck Left')).toBe('truck-left');
            expect(getMovementPresetIdByLabel('Truck Right')).toBe('truck-right');
            expect(getMovementPresetIdByLabel('Pedestal Up')).toBe('pedestal-up');
            expect(getMovementPresetIdByLabel('Pedestal Down')).toBe('pedestal-down');
            expect(getMovementPresetIdByLabel('Vertigo (Dolly In / Zoom Out)')).toBe('dolly-zoom-in');
            expect(getMovementPresetIdByLabel('Vertigo (Dolly Out / Zoom In)')).toBe('dolly-zoom-out');
            expect(getMovementPresetIdByLabel('Handheld Organic Sway')).toBe('handheld-sway');

            // Quick button labels & aliases
            expect(getMovementPresetIdByLabel('Pan L')).toBe('pan-left');
            expect(getMovementPresetIdByLabel('Pan R')).toBe('pan-right');
            expect(getMovementPresetIdByLabel('Truck L')).toBe('truck-left');
            expect(getMovementPresetIdByLabel('Truck R')).toBe('truck-right');
            expect(getMovementPresetIdByLabel('Ped Up')).toBe('pedestal-up');
            expect(getMovementPresetIdByLabel('Ped Down')).toBe('pedestal-down');
            expect(getMovementPresetIdByLabel('Vertigo (Dolly Zoom)')).toBe('dolly-zoom-in');
            expect(getMovementPresetIdByLabel('Handheld Sway')).toBe('handheld-sway');

            // Unknown or undefined
            expect(getMovementPresetIdByLabel(undefined)).toBeUndefined();
            expect(getMovementPresetIdByLabel('')).toBeUndefined();
            expect(getMovementPresetIdByLabel('Custom Camera Move')).toBeUndefined();
        });

        it('computes logarithmic dolly zoom with smoothstep interpolation', () => {
            // t = 0 -> start distance
            expect(computeLogarithmicDolly(1.0, 4.0, 0)).toBeCloseTo(1.0, 4);
            // t = 1 -> end distance
            expect(computeLogarithmicDolly(1.0, 4.0, 1)).toBeCloseTo(4.0, 4);
            // t = 0.5 -> geometric mean midpoint 2.0
            expect(computeLogarithmicDolly(1.0, 4.0, 0.5)).toBeCloseTo(2.0, 4);
            // clamped t bounds
            expect(computeLogarithmicDolly(1.0, 4.0, -1)).toBeCloseTo(1.0, 4);
            expect(computeLogarithmicDolly(1.0, 4.0, 2)).toBeCloseTo(4.0, 4);
        });
    });
});
