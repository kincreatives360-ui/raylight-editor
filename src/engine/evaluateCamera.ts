// src/engine/evaluateCamera.ts
import type { Shot } from '../model/types';
import { degToRad } from '../model/defaults';
import { evaluateEasing } from './easing';

export interface EvaluatedCamera {
    target: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    zoom: number;
    fovDegrees: number;
    focalLength: number;
    activeMode: 'static' | 'dolly' | 'zoom' | 'dollyzoom' | 'shake';
}

const BASE_FOV_DEGREES = 27.0006;

function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

export function evaluateShotCameraAtTime(
    shot: Shot,
    shotLocalTimeMs: number
): EvaluatedCamera {
    const framings = shot.framings || [];
    const defaultFraming = framings[0] || {
        id: 'default',
        name: 'Default',
        target: { x: 0, y: 0, z: 0 },
        zoom: 1,
        roll: 0,
        orbit: 0,
        tilt: 0,
    };

    let targetX = defaultFraming.target.x;
    let targetY = defaultFraming.target.y;
    let targetZ = defaultFraming.target.z;
    let zoom = defaultFraming.zoom;
    let rotX = degToRad(defaultFraming.tilt ?? 0);
    let rotY = degToRad(defaultFraming.orbit ?? 0);
    let rotZ = degToRad(defaultFraming.roll ?? 0);
    let fovDegrees = BASE_FOV_DEGREES;
    let focalLength = 50;
    let activeMode: EvaluatedCamera['activeMode'] = 'static';

    const sortedBlocks = [...(shot.cameraBlocks || [])].sort(
        (a, b) => a.startMs - b.startMs
    );

    const framingMap = new Map(framings.map((f) => [f.id, f]));

    for (let i = 0; i < sortedBlocks.length; i++) {
        const block = sortedBlocks[i];
        const fromFraming =
            (block.fromFramingId ? framingMap.get(block.fromFramingId) : undefined) || defaultFraming;
        const toFraming =
            (block.toFramingId ? framingMap.get(block.toFramingId) : undefined) || fromFraming;

        const fromEndpoint = block.from || {
            anchorX: fromFraming.target.x,
            anchorY: fromFraming.target.y,
            zoom: fromFraming.zoom,
            roll: fromFraming.roll ?? 0,
            orbit: fromFraming.orbit ?? 0,
            tilt: fromFraming.tilt ?? 0,
        };

        const toEndpoint = block.to || {
            anchorX: toFraming.target.x,
            anchorY: toFraming.target.y,
            zoom: toFraming.zoom,
            roll: toFraming.roll ?? 0,
            orbit: toFraming.orbit ?? 0,
            tilt: toFraming.tilt ?? 0,
        };

        if (shotLocalTimeMs < block.startMs) {
            if (i === 0) {
                targetX = fromEndpoint.anchorX;
                targetY = fromEndpoint.anchorY;
                targetZ = fromFraming.target.z;
                const safeFromZoom = Number.isFinite(fromEndpoint.zoom) && fromEndpoint.zoom > 0 ? fromEndpoint.zoom : 1;
                zoom = Math.max(0.15, safeFromZoom);
                rotX = degToRad(fromEndpoint.tilt);
                rotY = degToRad(fromEndpoint.orbit);
                rotZ = degToRad(fromEndpoint.roll);
                activeMode = block.mode;
                if (block.mode === 'zoom') {
                    fovDegrees = BASE_FOV_DEGREES / zoom;
                    focalLength = 50 * zoom;
                } else if (block.mode === 'dollyzoom') {
                    const fromBaseZoom = Math.max(0.2, safeFromZoom);
                    fovDegrees = Math.max(
                        10,
                        Math.min(95, BASE_FOV_DEGREES * (zoom / fromBaseZoom))
                    );
                    focalLength = (24 / (2 * Math.tan((fovDegrees * Math.PI) / 360)));
                } else {
                    fovDegrees = BASE_FOV_DEGREES;
                    focalLength = 50;
                }
            }
            break;
        }

        const rawProgress =
            block.durationMs > 0
                ? Math.max(
                    0,
                    Math.min(1, (shotLocalTimeMs - block.startMs) / block.durationMs)
                )
                : 1;

        const eased = evaluateEasing(rawProgress, block.easing);

        targetX = lerp(fromEndpoint.anchorX, toEndpoint.anchorX, eased);
        targetY = lerp(fromEndpoint.anchorY, toEndpoint.anchorY, eased);
        targetZ = lerp(fromFraming.target.z, toFraming.target.z, eased);
        const safeFromZoom = Number.isFinite(fromEndpoint.zoom) && fromEndpoint.zoom > 0 ? fromEndpoint.zoom : 1;
        const safeToZoom = Number.isFinite(toEndpoint.zoom) && toEndpoint.zoom > 0 ? toEndpoint.zoom : safeFromZoom;
        const targetZoom = lerp(safeFromZoom, safeToZoom, eased);
        zoom = Math.max(0.15, targetZoom);

        rotX = degToRad(lerp(fromEndpoint.tilt, toEndpoint.tilt, eased));
        rotY = degToRad(lerp(fromEndpoint.orbit, toEndpoint.orbit, eased));
        rotZ = degToRad(lerp(fromEndpoint.roll, toEndpoint.roll, eased));
        activeMode = block.mode;

        if (block.mode === 'zoom') {
            // Lens Zoom: changes focal length without 3D parallax shift
            fovDegrees = BASE_FOV_DEGREES / zoom;
            focalLength = 50 * zoom;
        } else if (block.mode === 'dollyzoom') {
            // Warp (Dolly-Zoom / Vertigo Effect): counter-scales FOV against physical Z push
            const fromBaseZoom = Math.max(0.2, Number.isFinite(fromEndpoint.zoom) && fromEndpoint.zoom > 0 ? fromEndpoint.zoom : 1);
            fovDegrees = Math.max(
                10,
                Math.min(95, BASE_FOV_DEGREES * (zoom / fromBaseZoom))
            );
            focalLength = (24 / (2 * Math.tan((fovDegrees * Math.PI) / 360)));
        } else {
            // Dolly: physical 3D camera push with constant 50mm lens
            fovDegrees = BASE_FOV_DEGREES;
            focalLength = 50;
        }

        // Apply deterministic handheld Camera Shake if configured on the block
        const shakeFrom = block.shake?.from ?? 0;
        const shakeTo = block.shake?.to ?? 0;
        const currentShakePct = lerp(shakeFrom, shakeTo, eased);
        if (currentShakePct > 0) {
            const amp = (currentShakePct / 100) * 0.045;
            const tSec = shotLocalTimeMs * 0.001;
            targetX +=
                (Math.sin(tSec * 17.3) * 0.6 + Math.cos(tSec * 31.7) * 0.4) * amp;
            targetY +=
                (Math.cos(tSec * 19.1) * 0.6 + Math.sin(tSec * 27.5) * 0.4) * amp;
            rotZ += Math.sin(tSec * 14.2) * amp * 0.35;
        }
    }

    return {
        target: { x: targetX, y: targetY, z: targetZ },
        rotation: { x: rotX, y: rotY, z: rotZ },
        zoom,
        fovDegrees,
        focalLength,
        activeMode,
    };
}