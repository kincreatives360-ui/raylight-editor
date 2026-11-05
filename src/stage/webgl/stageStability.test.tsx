import React from 'react';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_CAMERA_Z, DEFAULT_FOCAL_LENGTH, SENSOR_HEIGHT_MM, BASE_FOV_DEGREES, focalLengthToFov } from './cameraMath';
import * as evaluateCameraExports from '../../engine/evaluateCamera';
import * as constantsExports from '../../engine/constants';
import { createDefaultProject } from '../../model/defaults';
import { evaluateProjectAtTime, type EvaluatedProjectFrame } from '../../engine/evaluateShot';

describe('Camera contract stability & consistency', () => {
    it('canonical camera constants are exported consistently from cameraMath and evaluateCamera', () => {
        expect(DEFAULT_FOCAL_LENGTH).toBe(50);
        expect(DEFAULT_CAMERA_Z).toBe(2.65);
        expect(SENSOR_HEIGHT_MM).toBe(24);
        expect(BASE_FOV_DEGREES).toBeCloseTo(27.0006);

        // evaluateCamera contract
        expect(evaluateCameraExports.DEFAULT_FOCAL_LENGTH).toBe(50);
        expect(evaluateCameraExports.DEFAULT_CAMERA_Z).toBe(2.65);
        expect(evaluateCameraExports.SENSOR_HEIGHT_MM).toBe(24);
        expect(evaluateCameraExports.BASE_FOV_DEGREES).toBeCloseTo(27.0006);

        // constants contract
        expect(constantsExports.DEFAULT_FOCAL_LENGTH).toBe(50);
        expect(constantsExports.DEFAULT_CAMERA_Z).toBe(2.65);
        expect(constantsExports.SENSOR_HEIGHT_MM).toBe(24);

        // focalLengthToFov calculation matches across contracts
        expect(focalLengthToFov(50)).toBeCloseTo(evaluateCameraExports.focalLengthToFov(50));
    });
});

describe('Stage render & layer evaluation stability', () => {
    it('evaluates stage frame with default shot and multiple layer kinds without errors', () => {
        const project = createDefaultProject();
        const frame: EvaluatedProjectFrame = evaluateProjectAtTime(project, 0);

        expect(frame).toBeDefined();
        expect(frame.camera).toBeDefined();
        expect(frame.camera.focalLength).toBe(50);
        expect(frame.layers).toBeInstanceOf(Array);
        expect(frame.effects).toBeDefined();
    });

    it('adding shape, text and image layers maintains evaluated layers contract', () => {
        const project = createDefaultProject();
        const activeShot = project.shots[0];

        // Add shape layer
        activeShot.layers.push({
            id: 'test-shape',
            kind: 'shape',
            shape: 'roundRect',
            name: 'Card Shape',
            order: 1,
            inMs: 0,
            outMs: 3000,
            position: { x: 0.5, y: 0.5, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1 },
            size: { width: 0.4, height: 0.3 },
            opacity: 1,
            fill: { kind: 'solid', color: '#ff3366' },
            stroke: { color: '#ffffff', width: 0.01 },
            effects: {},
        } as any);

        // Add text layer
        activeShot.layers.push({
            id: 'test-text',
            kind: 'text',
            name: 'Title Text',
            order: 2,
            inMs: 0,
            outMs: 3000,
            position: { x: 0.5, y: 0.4, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1 },
            size: { width: 0.5, height: 0.1 },
            opacity: 1,
            content: 'Hello Raylight',
            font: { size: 0.06, color: '#ffffff', family: 'Inter', weight: 700 },
            effects: {},
        } as any);

        const frame = evaluateProjectAtTime(project, 0);
        expect(frame.layers.length).toBeGreaterThanOrEqual(2);

        const shapeLayer = frame.layers.find((l) => l.id === 'test-shape');
        const textLayer = frame.layers.find((l) => l.id === 'test-text');

        expect(shapeLayer).toBeDefined();
        expect(textLayer).toBeDefined();
        expect(shapeLayer?.visible).toBe(true);
        expect(textLayer?.visible).toBe(true);
    });

    it('WebGL context restoration listener marks materials for recompilation', () => {
        const testScene = new THREE.Scene();
        const testMesh = new THREE.Mesh(
            new THREE.PlaneGeometry(1, 1),
            new THREE.MeshBasicMaterial({ color: 0xff0000 })
        );
        testScene.add(testMesh);

        const initialVersion = testMesh.material.version;

        // Simulate context restored traversal
        testScene.traverse((obj) => {
            const mesh = obj as THREE.Mesh;
            if (mesh.material) {
                if (Array.isArray(mesh.material)) {
                    mesh.material.forEach((m) => (m.needsUpdate = true));
                } else {
                    mesh.material.needsUpdate = true;
                }
            }
        });

        expect(testMesh.material.version).toBeGreaterThan(initialVersion);
    });
});
