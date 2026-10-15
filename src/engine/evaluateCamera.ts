// src/engine/evaluateCamera.ts
import type { Shot, Project, Vec3, Framing } from '../model/types';
import { evaluateEasing } from './easing';

function clamp(val: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, val));
}

export interface EvaluatedCamera {
    position: Vec3;
    rotation: Vec3;
    target: Vec3;
    zoom: number;
    focalLength: number; // mm (e.g., 50mm standard lens)
    fovDegrees: number;  // Computed vertical Field of View for 3D stage
    mode: 'static' | 'dolly' | 'zoom' | 'dollyzoom';
    activeBlockId: string | null;
    fromFramingName: string;
    toFramingName: string;
}

// Pure Function: Shot + defaultCamera + shotTimeMs -> Exact EvaluatedCamera
export function evaluateCameraAtTime(
    shot: Shot,
    defaultCamera: Project['defaultCamera'],
    shotTimeMs: number
): EvaluatedCamera {
    const fallbackFraming: Framing = shot.framings[0] || {
        id: 'framing-default',
        name: 'Default Framing',
        target: { x: 0, y: 0, z: 0 },
        zoom: 1.0,
    };

    let target: Vec3 = { ...fallbackFraming.target };
    let zoom = fallbackFraming.zoom;
    let mode: EvaluatedCamera['mode'] = 'static';
    let activeBlockId: string | null = null;
    let fromFramingName = fallbackFraming.name;
    let toFramingName = fallbackFraming.name;

    const sortedBlocks = [...shot.cameraBlocks].sort(
        (a, b) => a.startMs - b.startMs
    );

    for (const block of sortedBlocks) {
        const fromF =
            shot.framings.find((f) => f.id === block.fromFramingId) ||
            fallbackFraming;
        const toF =
            shot.framings.find((f) => f.id === block.toFramingId) || fallbackFraming;

        const endMs = block.startMs + block.durationMs;

        if (shotTimeMs < block.startMs) {
            // Before the first camera block starts, hold its starting framing
            if (block === sortedBlocks[0]) {
                target = { ...fromF.target };
                zoom = fromF.zoom;
                fromFramingName = fromF.name;
                toFramingName = fromF.name;
            }
            break;
        }

        if (shotTimeMs >= endMs) {
            // After block finishes, hold its destination framing until a later block takes over
            target = { ...toF.target };
            zoom = toF.zoom;
            mode = block.mode;
            fromFramingName = fromF.name;
            toFramingName = toF.name;
        } else {
            // Currently inside this Camera Block
            const raw =
                block.durationMs > 0
                    ? clamp((shotTimeMs - block.startMs) / block.durationMs, 0, 1)
                    : 1;
            const eased = evaluateEasing(raw, block.easing);

            target = {
                x: fromF.target.x + (toF.target.x - fromF.target.x) * eased,
                y: fromF.target.y + (toF.target.y - fromF.target.y) * eased,
                z: fromF.target.z + (toF.target.z - fromF.target.z) * eased,
            };
            zoom = fromF.zoom + (toF.zoom - fromF.zoom) * eased;
            mode = block.mode;
            activeBlockId = block.id;
            fromFramingName = fromF.name;
            toFramingName = toF.name;
            break;
        }
    }

    // Compute physical 3D Camera Position & Focal Length based on mode:
    // - 'dolly': Physically moves camera Z closer/farther while keeping lens focalLength steady
    // - 'zoom': Keeps camera Z steady while increasing lens focalLength (telephoto compression)
    // - 'dollyzoom': Pulls camera Z back while zooming lens in (Vertigo counter-scale effect)
    const baseZ = defaultCamera.position.z;
    const baseFocal = defaultCamera.focalLength;

    let cameraZ = baseZ;
    let focalLength = baseFocal;

    const safeZoom = Math.max(0.2, zoom);

    if (mode === 'dolly' || mode === 'static') {
        cameraZ = baseZ / safeZoom;
        focalLength = baseFocal;
    } else if (mode === 'zoom') {
        cameraZ = baseZ;
        focalLength = baseFocal * safeZoom;
    } else if (mode === 'dollyzoom') {
        // Vertigo effect: foreground stays same size while background perspective warps
        cameraZ = baseZ * safeZoom;
        focalLength = baseFocal * safeZoom * safeZoom;
    }

    // Convert 35mm sensor height (24mm) + focalLength to vertical FOV in degrees
    const fovRadians = 2 * Math.atan(24 / (2 * Math.max(10, focalLength)));
    const fovDegrees = (fovRadians * 180) / Math.PI;

    return {
        position: {
            x: Number((defaultCamera.position.x + target.x).toFixed(4)),
            y: Number((defaultCamera.position.y + target.y).toFixed(4)),
            z: Number(cameraZ.toFixed(4)),
        },
        rotation: { ...defaultCamera.rotation },
        target: {
            x: Number(target.x.toFixed(4)),
            y: Number(target.y.toFixed(4)),
            z: Number(target.z.toFixed(4)),
        },
        zoom: Number(safeZoom.toFixed(4)),
        focalLength: Number(focalLength.toFixed(2)),
        fovDegrees: Number(fovDegrees.toFixed(2)),
        mode,
        activeBlockId,
        fromFramingName,
        toFramingName,
    };
}