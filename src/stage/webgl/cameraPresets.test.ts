// src/stage/webgl/cameraPresets.test.ts
import { describe, it, expect } from 'vitest';
import {
    CAMERA_PRESETS,
    applyCameraPreset,
    calculateLayersBoundingFraming,
    calculateLayerFraming,
    detectMatchingPreset,
    LENS_PRESETS,
    focalLengthToFov,
    type FramableLayer,
} from './cameraMath';

describe('Unified Camera Presets & Framing System', () => {
    describe('CAMERA_PRESETS registry', () => {
        it('contains expected presets with no duplicate IDs', () => {
            expect(CAMERA_PRESETS.length).toBeGreaterThanOrEqual(10);
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

        it('includes axonometric and cinematic presets with correct properties', () => {
            const iso = CAMERA_PRESETS.find((p) => p.id === 'isometric')!;
            expect(iso.category).toBe('axonometric');
            expect(iso.orbit).toBe(45);
            expect(iso.tilt).toBeCloseTo(35.26, 1);

            const dutch = CAMERA_PRESETS.find((p) => p.id === 'dutch-tilt')!;
            expect(dutch.category).toBe('cinematic');
            expect(dutch.roll).toBe(-12);

            const closeUp = CAMERA_PRESETS.find((p) => p.id === 'close-up')!;
            expect(closeUp.zoom).toBe(1.8);
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
});
