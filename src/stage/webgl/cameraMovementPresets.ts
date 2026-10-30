import { DEFAULT_FOCAL_LENGTH } from '../../engine/evaluateCamera';
import type { CameraBlock, CameraKeyframeEndpoint } from '../../model/types';

export type CameraMovementId =
    | 'zoom-in'
    | 'zoom-out'
    | 'pan-left'
    | 'pan-right'
    | 'tilt-up'
    | 'tilt-down'
    | 'dolly-in'
    | 'dolly-out'
    | 'truck-left'
    | 'truck-right'
    | 'pedestal-up'
    | 'pedestal-down'
    | 'dolly-zoom-in'
    | 'dolly-zoom-out'
    | 'handheld-sway';

export type CameraMovementCategory = 'zoom' | 'rotation' | 'track' | 'special';

export interface CameraMovementPreset {
    id: CameraMovementId;
    name: string;
    category: CameraMovementCategory;
    mode: CameraBlock['mode'];
    description: string;
    defaultDurationMs: number;
    recommendedEasing?: CameraBlock['easing'];
}

export const CAMERA_MOVEMENT_PRESETS: CameraMovementPreset[] = [
    // 1. Zoom Moves (Optical magnification change without physical translation)
    {
        id: 'zoom-in',
        name: 'Zoom In',
        category: 'zoom',
        mode: 'zoom',
        description: 'Optical push into subject by narrowing FOV without changing 3D position',
        defaultDurationMs: 1500,
        recommendedEasing: { kind: 'preset', name: 'ease-in-out' },
    },
    {
        id: 'zoom-out',
        name: 'Zoom Out',
        category: 'zoom',
        mode: 'zoom',
        description: 'Optical pull out by widening FOV to reveal surroundings without moving camera',
        defaultDurationMs: 1500,
        recommendedEasing: { kind: 'preset', name: 'ease-in-out' },
    },

    // 2. Pan Moves (Fixed-axis horizontal rotation)
    {
        id: 'pan-left',
        name: 'Pan Left',
        category: 'rotation',
        mode: 'dolly',
        description: 'Horizontal rotation of the camera to the left on a stationary tripod',
        defaultDurationMs: 1800,
        recommendedEasing: { kind: 'preset', name: 'ease-out' },
    },
    {
        id: 'pan-right',
        name: 'Pan Right',
        category: 'rotation',
        mode: 'dolly',
        description: 'Horizontal rotation of the camera to the right on a stationary tripod',
        defaultDurationMs: 1800,
        recommendedEasing: { kind: 'preset', name: 'ease-out' },
    },

    // 3. Tilt Moves (Fixed-axis vertical rotation)
    {
        id: 'tilt-up',
        name: 'Tilt Up',
        category: 'rotation',
        mode: 'dolly',
        description: 'Vertical rotation upward to build presence, scale, or reveal height',
        defaultDurationMs: 1800,
        recommendedEasing: { kind: 'preset', name: 'ease-out' },
    },
    {
        id: 'tilt-down',
        name: 'Tilt Down',
        category: 'rotation',
        mode: 'dolly',
        description: 'Vertical rotation downward to direct focus below or show vulnerability',
        defaultDurationMs: 1800,
        recommendedEasing: { kind: 'preset', name: 'ease-out' },
    },

    // 4. Dolly Moves (Physical forward/backward 3D translation)
    {
        id: 'dolly-in',
        name: 'Dolly In',
        category: 'track',
        mode: 'dolly',
        description: 'Physical camera movement forward into the scene creating authentic 3D depth',
        defaultDurationMs: 2000,
        recommendedEasing: { kind: 'preset', name: 'ease-in-out' },
    },
    {
        id: 'dolly-out',
        name: 'Dolly Out',
        category: 'track',
        mode: 'dolly',
        description: 'Physical camera movement backward retreating from the subject',
        defaultDurationMs: 2000,
        recommendedEasing: { kind: 'preset', name: 'ease-in-out' },
    },

    // 5. Truck Moves (Physical lateral track translation)
    {
        id: 'truck-left',
        name: 'Truck Left',
        category: 'track',
        mode: 'dolly',
        description: 'Physical lateral tracking of the camera to the left producing parallax shift',
        defaultDurationMs: 2000,
        recommendedEasing: { kind: 'preset', name: 'ease-in-out' },
    },
    {
        id: 'truck-right',
        name: 'Truck Right',
        category: 'track',
        mode: 'dolly',
        description: 'Physical lateral tracking of the camera to the right producing parallax shift',
        defaultDurationMs: 2000,
        recommendedEasing: { kind: 'preset', name: 'ease-in-out' },
    },

    // 6. Pedestal Moves (Physical vertical crane elevation)
    {
        id: 'pedestal-up',
        name: 'Pedestal Up',
        category: 'track',
        mode: 'dolly',
        description: 'Physical vertical ascent of the camera rig (jib/crane) without tilting',
        defaultDurationMs: 2000,
        recommendedEasing: { kind: 'preset', name: 'ease-in-out' },
    },
    {
        id: 'pedestal-down',
        name: 'Pedestal Down',
        category: 'track',
        mode: 'dolly',
        description: 'Physical vertical descent of the camera rig without tilting',
        defaultDurationMs: 2000,
        recommendedEasing: { kind: 'preset', name: 'ease-in-out' },
    },

    // 7. Vertigo / Dolly Zoom (Hitchcock effect)
    {
        id: 'dolly-zoom-in',
        name: 'Vertigo (Dolly In / Zoom Out)',
        category: 'special',
        mode: 'dollyzoom',
        description: 'Camera pushes forward physically while lens zooms out, warping background space',
        defaultDurationMs: 2200,
        recommendedEasing: { kind: 'preset', name: 'ease-in-out' },
    },
    {
        id: 'dolly-zoom-out',
        name: 'Vertigo (Dolly Out / Zoom In)',
        category: 'special',
        mode: 'dollyzoom',
        description: 'Camera pulls backward physically while lens zooms in, compressing background space',
        defaultDurationMs: 2200,
        recommendedEasing: { kind: 'preset', name: 'ease-in-out' },
    },

    // 8. Handheld Sway
    {
        id: 'handheld-sway',
        name: 'Handheld Organic Sway',
        category: 'special',
        mode: 'shake',
        description: 'Subtle human operator breathing and micro-movement',
        defaultDurationMs: 3000,
        recommendedEasing: { kind: 'preset', name: 'linear' },
    },
];

/**
 * Resolves a CameraMovementId from a movement label or preset name.
 * Handles exact preset name matches, prefix matching (e.g. Vertigo variants),
 * and common aliases (e.g. Handheld Sway, abbreviated button labels).
 */
export function getMovementPresetIdByLabel(label?: string): CameraMovementId | undefined {
    if (!label) return undefined;
    const exact = CAMERA_MOVEMENT_PRESETS.find((m) => m.name === label);
    if (exact) return exact.id;

    if (label.startsWith('Vertigo (Dolly Out') || label.includes('Dolly Out / Zoom In')) {
        return 'dolly-zoom-out';
    }
    if (label.startsWith('Vertigo') || label.includes('Dolly Zoom')) {
        return 'dolly-zoom-in';
    }
    if (label === 'Handheld Sway' || label === 'Handheld Organic Sway') {
        return 'handheld-sway';
    }

    const aliasMap: Record<string, CameraMovementId> = {
        'Zoom In': 'zoom-in',
        'Zoom Out': 'zoom-out',
        'Pan L': 'pan-left',
        'Pan Left': 'pan-left',
        'Pan R': 'pan-right',
        'Pan Right': 'pan-right',
        'Tilt Up': 'tilt-up',
        'Tilt Down': 'tilt-down',
        'Dolly In': 'dolly-in',
        'Dolly Out': 'dolly-out',
        'Truck L': 'truck-left',
        'Truck Left': 'truck-left',
        'Truck R': 'truck-right',
        'Truck Right': 'truck-right',
        'Ped Up': 'pedestal-up',
        'Pedestal Up': 'pedestal-up',
        'Ped Down': 'pedestal-down',
        'Pedestal Down': 'pedestal-down',
    };
    return aliasMap[label];
}

export interface ApplyCameraMovementOptions {
    artboardDimensions?: { width: number; height: number };
    preserveDuration?: boolean;
}

/**
 * Generates an updated CameraBlock with endpoints corresponding to the chosen CameraMovementId.
 * Preserves the user's initial framing anchor and orientation as the baseline `from` origin.
 */
export function applyCameraMovementPreset(
    block: CameraBlock,
    movementId: CameraMovementId,
    options?: ApplyCameraMovementOptions
): CameraBlock {
    const movement = CAMERA_MOVEMENT_PRESETS.find((m) => m.id === movementId);
    if (!movement) return block;

    const { width: artboardW, height: artboardH } = options?.artboardDimensions || {
        width: 1920,
        height: 1080,
    };

    const fromBase: CameraKeyframeEndpoint = {
        anchorX: block.from?.anchorX ?? 0,
        anchorY: block.from?.anchorY ?? 0,
        anchorZ: block.from?.anchorZ ?? 0,
        zoom: block.from?.zoom && Number.isFinite(block.from.zoom) && block.from.zoom > 0 ? block.from.zoom : 1.0,
        roll: block.from?.roll ?? 0,
        orbit: block.from?.orbit ?? 0,
        tilt: block.from?.tilt ?? 0,
        focalLength: block.from?.focalLength ?? DEFAULT_FOCAL_LENGTH,
        presetId: block.from?.presetId,
    };

    let newFrom: CameraKeyframeEndpoint = { ...fromBase };
    let newTo: CameraKeyframeEndpoint = { ...fromBase };
    let computedShake: { from: number; to: number; frequency?: number } = { from: 0, to: 0 };

    switch (movementId) {
        case 'zoom-in': {
            newFrom = { ...fromBase };
            newTo = { ...fromBase, zoom: Number((fromBase.zoom * 1.45).toFixed(2)) };
            break;
        }
        case 'zoom-out': {
            const startZoom = Math.max(1.35, fromBase.zoom);
            newFrom = { ...fromBase, zoom: startZoom };
            newTo = { ...fromBase, zoom: Number(Math.max(0.65, startZoom * 0.7).toFixed(2)) };
            break;
        }
        case 'pan-left': {
            newFrom = { ...fromBase };
            newTo = { ...fromBase, orbit: fromBase.orbit - 20 };
            break;
        }
        case 'pan-right': {
            newFrom = { ...fromBase };
            newTo = { ...fromBase, orbit: fromBase.orbit + 20 };
            break;
        }
        case 'tilt-up': {
            newFrom = { ...fromBase };
            newTo = { ...fromBase, tilt: Math.max(-85, fromBase.tilt - 18) };
            break;
        }
        case 'tilt-down': {
            newFrom = { ...fromBase };
            newTo = { ...fromBase, tilt: Math.min(85, fromBase.tilt + 18) };
            break;
        }
        case 'dolly-in': {
            const startZ = fromBase.anchorZ ?? 0;
            newFrom = { ...fromBase, anchorZ: startZ };
            newTo = { ...fromBase, anchorZ: startZ + 320 };
            break;
        }
        case 'dolly-out': {
            const startZ = fromBase.anchorZ ?? 0;
            newFrom = { ...fromBase, anchorZ: startZ + 320 };
            newTo = { ...fromBase, anchorZ: startZ };
            break;
        }
        case 'truck-left': {
            const deltaX = Math.round(artboardW * 0.18) || 300;
            newFrom = { ...fromBase };
            newTo = { ...fromBase, anchorX: fromBase.anchorX - deltaX };
            break;
        }
        case 'truck-right': {
            const deltaX = Math.round(artboardW * 0.18) || 300;
            newFrom = { ...fromBase };
            newTo = { ...fromBase, anchorX: fromBase.anchorX + deltaX };
            break;
        }
        case 'pedestal-up': {
            const deltaY = Math.round(artboardH * 0.18) || 200;
            newFrom = { ...fromBase };
            newTo = { ...fromBase, anchorY: fromBase.anchorY + deltaY };
            break;
        }
        case 'pedestal-down': {
            const deltaY = Math.round(artboardH * 0.18) || 200;
            newFrom = { ...fromBase };
            newTo = { ...fromBase, anchorY: fromBase.anchorY - deltaY };
            break;
        }
        case 'dolly-zoom-in': {
            const startZ = fromBase.anchorZ ?? 0;
            newFrom = {
                ...fromBase,
                anchorZ: startZ,
                zoom: Math.max(1.3, fromBase.zoom * 1.3),
            };
            newTo = {
                ...fromBase,
                anchorZ: startZ + 350,
                zoom: Number(Math.max(0.65, fromBase.zoom * 0.85).toFixed(2)),
            };
            break;
        }
        case 'dolly-zoom-out': {
            const startZ = fromBase.anchorZ ?? 0;
            newFrom = {
                ...fromBase,
                anchorZ: startZ + 350,
                zoom: Number(Math.max(0.65, fromBase.zoom * 0.85).toFixed(2)),
            };
            newTo = {
                ...fromBase,
                anchorZ: startZ,
                zoom: Math.max(1.3, fromBase.zoom * 1.3),
            };
            break;
        }
        case 'handheld-sway': {
            newFrom = { ...fromBase };
            newTo = { ...fromBase };
            computedShake = { from: 15, to: 25, frequency: 1.0 };
            break;
        }
    }

    const duration =
        options?.preserveDuration && block.durationMs > 0
            ? block.durationMs
            : movement.defaultDurationMs;

    return {
        ...block,
        mode: movement.mode,
        label: movement.name,
        easing: movement.recommendedEasing || block.easing,
        durationMs: duration,
        from: newFrom,
        to: newTo,
        shake: computedShake,
    };
}

