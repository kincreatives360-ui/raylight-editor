import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
    lightToWorld,
    worldToLight,
    createVirtualCamera,
    projectWorldToScreen,
    projectLightToScreen,
    unprojectScreenToWorldPlane,
    unprojectScreenDeltaToLightDelta,
    calculateSpotConeOverlay,
    calculateAreaRectOverlay,
    calculatePointReachOverlay,
} from './lightingMath';
import { DEFAULT_CAMERA_Z, DEFAULT_FOCAL_LENGTH, focalLengthToFov } from './webgl/cameraMath';

describe('lightingMath - 3D Light Coordinate Conversions', () => {
    it('converts light coordinates to world coordinates (X*6, Y*6, Z*5)', () => {
        const lightPos = { x: 1, y: -0.5, z: 2 };
        const world = lightToWorld(lightPos);
        expect(world.x).toBeCloseTo(6);
        expect(world.y).toBeCloseTo(-3);
        expect(world.z).toBeCloseTo(10);
    });

    it('converts world coordinates back to light coordinates', () => {
        const worldPos = new THREE.Vector3(6, -3, 10);
        const light = worldToLight(worldPos);
        expect(light.x).toBeCloseTo(1);
        expect(light.y).toBeCloseTo(-0.5);
        expect(light.z).toBeCloseTo(2);
    });
});

describe('lightingMath - Virtual Camera & Projection', () => {
    const frameW = 1920;
    const frameH = 1080;
    const aspect = frameW / frameH;

    it('creates a deterministic camera with matching pose', () => {
        const camera = createVirtualCamera(undefined, aspect);
        expect(camera.position.z).toBeCloseTo(DEFAULT_CAMERA_Z);
        expect(camera.fov).toBeCloseTo(focalLengthToFov(DEFAULT_FOCAL_LENGTH));
        expect(camera.aspect).toBeCloseTo(aspect);
    });

    it('projects center light to screen center', () => {
        const lightPos = { x: 0, y: 0, z: 0 };
        const screen = projectLightToScreen(lightPos, undefined, frameW, frameH, aspect);
        expect(screen.inFront).toBe(true);
        expect(screen.x).toBeCloseTo(frameW / 2);
        expect(screen.y).toBeCloseTo(frameH / 2);
    });

    it('projects rightwards light position to right of screen center', () => {
        const lightPos = { x: 0.1, y: 0, z: 0 };
        const screen = projectLightToScreen(lightPos, undefined, frameW, frameH, aspect);
        expect(screen.x).toBeGreaterThan(frameW / 2);
        expect(screen.y).toBeCloseTo(frameH / 2);
    });

    it('projects upward light position to higher on screen (smaller screen Y)', () => {
        const lightPos = { x: 0, y: 0.1, z: 0 };
        const screen = projectLightToScreen(lightPos, undefined, frameW, frameH, aspect);
        expect(screen.y).toBeLessThan(frameH / 2);
        expect(screen.x).toBeCloseTo(frameW / 2);
    });
});

describe('lightingMath - Unprojection & Delta Mapping', () => {
    const frameW = 1920;
    const frameH = 1080;
    const aspect = frameW / frameH;

    it('unprojects screen center at Z=0 to world (0, 0, 0)', () => {
        const camera = createVirtualCamera(undefined, aspect);
        const pt = unprojectScreenToWorldPlane(frameW / 2, frameH / 2, 0, camera, frameW, frameH);
        expect(pt.x).toBeCloseTo(0, 1);
        expect(pt.y).toBeCloseTo(0, 1);
        expect(pt.z).toBeCloseTo(0, 1);
    });

    it('round trips screen -> world plane -> screen', () => {
        const camera = createVirtualCamera(undefined, aspect);
        const origX = 700;
        const origY = 400;
        const planeZ = 0;
        const world = unprojectScreenToWorldPlane(origX, origY, planeZ, camera, frameW, frameH);
        const projected = projectWorldToScreen(world, camera, frameW, frameH);
        expect(projected.x).toBeCloseTo(origX, 1);
        expect(projected.y).toBeCloseTo(origY, 1);
    });

    it('maps screen drag delta to light position delta', () => {
        const currentLightPos = { x: 0, y: 0, z: 0 };
        const delta = unprojectScreenDeltaToLightDelta(100, -50, currentLightPos, undefined, frameW, frameH, aspect);
        // Dragging right (+screenX) should produce positive dx
        expect(delta.dx).toBeGreaterThan(0);
        // Dragging up (-screenY) should produce positive dy in light world space
        expect(delta.dy).toBeGreaterThan(0);
    });
});

describe('lightingMath - Light Type Overlays', () => {
    const frameW = 1920;
    const frameH = 1080;
    const aspect = frameW / frameH;

    it('calculates spot cone overlay with source, target, and rim points', () => {
        const source = { x: 0, y: 0.5, z: 1 };
        const target = { x: 0, y: 0, z: 0 };
        const angle = Math.PI / 6; // 30 deg

        const cone = calculateSpotConeOverlay(source, target, angle, undefined, frameW, frameH, aspect);
        expect(cone.sourceScreen).toBeDefined();
        expect(cone.targetScreen).toBeDefined();
        expect(cone.rimPoints.length).toBeGreaterThan(0);
        expect(cone.rimRadiusScreen).toBeGreaterThan(0);
    });

    it('calculates area light rectangle corners', () => {
        const position = { x: 0, y: 0, z: 0 };
        const target = { x: 0, y: 0, z: -1 };
        const width = 2;
        const height = 1.5;

        const area = calculateAreaRectOverlay(position, target, width, height, undefined, frameW, frameH, aspect);
        expect(area.corners.length).toBe(4);
        expect(area.centerScreen).toBeDefined();
    });

    it('calculates point light reach circle and edge handle', () => {
        const position = { x: 0, y: 0, z: 0 };
        const distance = 3;

        const point = calculatePointReachOverlay(position, distance, undefined, frameW, frameH, aspect);
        expect(point.centerScreen).toBeDefined();
        expect(point.edgeScreen).toBeDefined();
        expect(point.radiusScreen).toBeGreaterThan(0);
    });
});
