export type CameraPresetCategory = 'axial' | 'axonometric' | 'cinematic' | 'shot-type' | 'angle';

export interface CameraPreset {
    id: string;
    name: string;
    category: CameraPresetCategory;
    orbit: number; // Yaw degrees
    tilt: number;  // Pitch degrees
    roll: number;  // Roll degrees
    zoom?: number; // Optional zoom factor
    focalLength?: number; // Lens focal length in mm
    anchorX?: number; // Artboard pixels relative to center
    anchorY?: number; // Artboard pixels relative to center (+Y up)
    anchorZ?: number; // 3D depth offset
    shake?: { from: number; to: number; frequency?: number };
    description: string;
}

export const CAMERA_PRESETS: CameraPreset[] = [
    // Axial / Orthogonal Views (Front, Back, Top, Bottom, Left, Right)
    {
        id: 'front',
        name: 'Front (Eye-Level)',
        category: 'axial',
        orbit: 0,
        tilt: 0,
        roll: 0,
        focalLength: 50,
        description: 'Direct frontal eye-level projection (0°, 0°)',
    },
    {
        id: 'back',
        name: 'Back (Reverse)',
        category: 'axial',
        orbit: 180,
        tilt: 0,
        roll: 0,
        focalLength: 50,
        description: 'Reverse rear perspective (180°, 0°)',
    },
    {
        id: 'top',
        name: 'Top (Bird’s-Eye)',
        category: 'axial',
        orbit: 0,
        tilt: -89,
        roll: 0,
        focalLength: 50,
        description: 'Top-down bird’s-eye view (0°, -89°)',
    },
    {
        id: 'bottom',
        name: 'Bottom (Worm’s-Eye)',
        category: 'axial',
        orbit: 0,
        tilt: 89,
        roll: 0,
        focalLength: 50,
        description: 'Worm’s-eye perspective looking up (0°, 89°)',
    },
    {
        id: 'left',
        name: 'Left Profile',
        category: 'axial',
        orbit: -90,
        tilt: 0,
        roll: 0,
        focalLength: 50,
        description: 'Left lateral profile view (-90°, 0°)',
    },
    {
        id: 'right',
        name: 'Right Profile',
        category: 'axial',
        orbit: 90,
        tilt: 0,
        roll: 0,
        focalLength: 50,
        description: 'Right lateral profile view (90°, 0°)',
    },

    // Axonometric / Spatial Views
    {
        id: 'isometric',
        name: 'Isometric',
        category: 'axonometric',
        orbit: 45,
        tilt: 35.26,
        roll: 0,
        focalLength: 50,
        description: 'True 3D isometric projection (45°, 35.26°)',
    },
    {
        id: 'dimetric',
        name: '3/4 Studio',
        category: 'axonometric',
        orbit: 35,
        tilt: 20,
        roll: 0,
        focalLength: 50,
        description: 'Standard 3/4 showcase hero view (35°, 20°)',
    },
    {
        id: 'high-angle-iso',
        name: 'High-Angle Iso',
        category: 'axonometric',
        orbit: 45,
        tilt: 55,
        roll: 0,
        focalLength: 50,
        description: 'Elevated spatial layout view (45°, 55°)',
    },

    // Shot Types (Visual Storyboarding Framing Distances)
    {
        id: 'establishing',
        name: 'Establishing Shot',
        category: 'shot-type',
        orbit: 0,
        tilt: 0,
        roll: 0,
        zoom: 0.65,
        focalLength: 20,
        description: 'Extreme long view establishing scene context and environment (0.65x, 20mm)',
    },
    {
        id: 'wide-angle',
        name: 'Wide View',
        category: 'shot-type',
        orbit: 0,
        tilt: 0,
        roll: 0,
        zoom: 0.75,
        focalLength: 24,
        description: 'Contextual wide establishing shot (0.75x, 24mm)',
    },
    {
        id: 'full-shot',
        name: 'Full Shot',
        category: 'shot-type',
        orbit: 0,
        tilt: 0,
        roll: 0,
        zoom: 0.95,
        focalLength: 35,
        description: 'Full subject framing from head to toe (0.95x, 35mm)',
    },
    {
        id: 'two-shot',
        name: 'Two Shot',
        category: 'shot-type',
        orbit: 0,
        tilt: 0,
        roll: 0,
        zoom: 1.08,
        focalLength: 35,
        description: 'Conversational framing containing two subjects (1.08x, 35mm)',
    },
    {
        id: 'medium-shot',
        name: 'Medium Shot',
        category: 'shot-type',
        orbit: 0,
        tilt: 0,
        roll: 0,
        zoom: 1.25,
        focalLength: 50,
        description: 'Standard medium framing from waist up (1.25x, 50mm)',
    },
    {
        id: 'close-up',
        name: 'Close-Up',
        category: 'shot-type',
        orbit: 0,
        tilt: 0,
        roll: 0,
        zoom: 1.8,
        focalLength: 85,
        description: 'Focused macro close-up framing (1.8x, 85mm)',
    },
    {
        id: 'extreme-close',
        name: 'Extreme Close-Up',
        category: 'shot-type',
        orbit: 0,
        tilt: 0,
        roll: 0,
        zoom: 2.8,
        focalLength: 135,
        description: 'Macro detail focus on a specific feature or UI element (2.8x, 135mm)',
    },

    // Camera Angles & Composition Perspectives
    {
        id: 'hero-low',
        name: 'Low Angle (Hero)',
        category: 'angle',
        orbit: 18,
        tilt: -16,
        roll: 0,
        focalLength: 28,
        anchorY: -150,
        description: 'Imposing upward low-angle shot (18°, -16°, 28mm)',
    },
    {
        id: 'down-shot',
        name: 'High Angle (Down)',
        category: 'angle',
        orbit: 0,
        tilt: 25,
        roll: 0,
        focalLength: 40,
        anchorY: 180,
        description: 'Elevated perspective looking down on the subject (25° tilt, 40mm)',
    },
    {
        id: 'over-shoulder',
        name: 'Over The Shoulder',
        category: 'angle',
        orbit: 18,
        tilt: -4,
        roll: 0,
        zoom: 1.35,
        focalLength: 70,
        anchorX: -180,
        description: 'Perspective looking over the shoulder toward subject (18°, -4°, 70mm)',
    },
    {
        id: 'dutch-tilt',
        name: 'Dutch Angle',
        category: 'angle',
        orbit: 20,
        tilt: 8,
        roll: -12,
        focalLength: 35,
        description: 'Stylized canted horizon tilt (20°, 8°, -12°, 35mm)',
    },
    {
        id: 'pov',
        name: 'Point of View',
        category: 'angle',
        orbit: 0,
        tilt: 0,
        roll: 0,
        zoom: 1.05,
        focalLength: 35,
        shake: { from: 4, to: 4, frequency: 0.8 },
        description: 'First-person subjective perspective with subtle breathing motion (1.05x, 35mm)',
    },
];

export const LENS_PRESETS = [
    { mm: 24, label: '24mm Wide' },
    { mm: 35, label: '35mm Street' },
    { mm: 50, label: '50mm Standard' },
    { mm: 85, label: '85mm Portrait' },
    { mm: 135, label: '135mm Tele' },
] as const;

export function applyCameraPreset<T extends {
    orbit?: number;
    tilt?: number;
    roll?: number;
    zoom?: number;
    presetId?: string;
    focalLength?: number;
    anchorX?: number;
    anchorY?: number;
    anchorZ?: number;
    shake?: { from: number; to: number; frequency?: number };
}>(
    preset: CameraPreset,
    current: T
): T & {
    presetId: string;
    focalLength?: number;
    zoom?: number;
    anchorX?: number;
    anchorY?: number;
    anchorZ?: number;
    shake?: { from: number; to: number; frequency?: number };
} {
    return {
        ...current,
        presetId: preset.id,
        orbit: preset.orbit,
        tilt: preset.tilt,
        roll: preset.roll,
        ...(preset.zoom !== undefined ? { zoom: preset.zoom } : {}),
        ...(preset.focalLength !== undefined ? { focalLength: preset.focalLength } : {}),
        ...(preset.anchorX !== undefined ? { anchorX: preset.anchorX } : {}),
        ...(preset.anchorY !== undefined ? { anchorY: preset.anchorY } : {}),
        ...(preset.anchorZ !== undefined ? { anchorZ: preset.anchorZ } : {}),
        ...(preset.shake !== undefined ? { shake: preset.shake } : {}),
    };
}

export function detectMatchingPreset(
    endpoint: {
        presetId?: string;
        orbit?: number;
        tilt?: number;
        roll?: number;
        zoom?: number;
        focalLength?: number;
    } | null | undefined,
    tolerance: number = 0.5
): CameraPreset | null {
    if (!endpoint) return null;
    if (endpoint.presetId) {
        const found = CAMERA_PRESETS.find((p) => p.id === endpoint.presetId);
        if (found) return found;
    }
    const epOrbit = endpoint.orbit ?? 0;
    const epTilt = endpoint.tilt ?? 0;
    const epRoll = endpoint.roll ?? 0;
    const epZoom = endpoint.zoom;

    // Check zoom-specific presets first if endpoint defines a distinct zoom
    if (epZoom !== undefined) {
        const candidates = CAMERA_PRESETS.filter((preset) => {
            const dOrbit = Math.abs(preset.orbit - epOrbit);
            const dTilt = Math.abs(preset.tilt - epTilt);
            const dRoll = Math.abs(preset.roll - epRoll);
            if (dOrbit > tolerance || dTilt > tolerance || dRoll > tolerance) return false;
            const targetZoom = preset.zoom ?? 1.0;
            const dZoom = Math.abs(targetZoom - epZoom);
            return dZoom <= 0.15;
        });

        if (candidates.length > 0) {
            candidates.sort((a, b) => {
                const dZa = Math.abs((a.zoom ?? 1.0) - epZoom);
                const dZb = Math.abs((b.zoom ?? 1.0) - epZoom);
                return dZa - dZb;
            });
            return candidates[0];
        }
    }

    // Otherwise match standard orientation presets without zoom requirement
    for (const preset of CAMERA_PRESETS) {
        if (preset.zoom !== undefined) continue;
        const dOrbit = Math.abs(preset.orbit - epOrbit);
        const dTilt = Math.abs(preset.tilt - epTilt);
        const dRoll = Math.abs(preset.roll - epRoll);
        if (dOrbit <= tolerance && dTilt <= tolerance && dRoll <= tolerance) {
            return preset;
        }
    }
    return null;
}

// =============================================================================
// CAMERA MOVEMENT PRESET GENERATOR
// =============================================================================

