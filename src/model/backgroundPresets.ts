// src/model/backgroundPresets.ts
// Production Raylight shader presets, knob metadata, and color models

export type ShaderPreset =
    | 'silk'
    | 'undertones'
    | 'mosaic'
    | 'meshGradient'
    | 'warp'
    | 'grainGradient'
    | 'prism'
    | 'halo'
    | 'shift'
    | 'lineScreen'
    | 'dotMatrix'
    | 'watercolor'
    | 'voxels';

export interface ShaderKnobConfig {
    label: string;
    description: string;
}

export interface ShaderPresetMeta {
    label: string;
    description: string;
    colorModel: 'accent' | 'palette';
    usesBase: boolean;
    knobs: Partial<Record<'waves' | 'focus' | 'glow' | 'shine' | 'angle', ShaderKnobConfig>>;
}

export const SHADER_PRESETS: ShaderPreset[] = [
    'silk',
    'undertones',
    'mosaic',
    'meshGradient',
    'warp',
    'grainGradient',
    'prism',
    'halo',
    'shift',
    'lineScreen',
    'dotMatrix',
    'watercolor',
    'voxels',
];

export const SHADER_PRESET_METADATA: Record<ShaderPreset, ShaderPresetMeta> = {
    silk: {
        label: 'Silk',
        description: 'dark draped satin folds lit in the accent with a thin glassy glint along each crease',
        colorModel: 'accent',
        usesBase: true,
        knobs: {
            waves: { label: 'Waves', description: 'fold frequency' },
            focus: { label: 'Focus', description: 'crease relief, crisp vs soft' },
            glow: { label: 'Glow', description: 'exposure of the lit folds' },
            shine: { label: 'Shine', description: 'glint strength along the creases' },
        },
    },
    undertones: {
        label: 'Undertones',
        description: 'frosted ribbed glass at a diagonal, backlit by drifting accent glows',
        colorModel: 'accent',
        usesBase: true,
        knobs: {
            waves: { label: 'Slats', description: 'slat density' },
            focus: { label: 'Frost', description: 'how smeared the light is through the glass' },
            glow: { label: 'Glow', description: 'backlight exposure' },
            shine: { label: 'Fringe', description: 'edge dispersion fringes' },
            angle: { label: 'Angle', description: 'slat angle in degrees' },
        },
    },
    mosaic: {
        label: 'Mosaic',
        description: 'a grid of frosted rounded glass tiles dyed by drifting accent glows over a light base',
        colorModel: 'accent',
        usesBase: true,
        knobs: {
            waves: { label: 'Tiles', description: 'tile density' },
            focus: { label: 'Frost', description: 'per-tile frost, blocky vs continuous' },
            glow: { label: 'Glow', description: 'backlight exposure' },
            shine: { label: 'Rim', description: 'light pooling along tile edges' },
        },
    },
    meshGradient: {
        label: 'Mesh Gradient',
        description: 'palette color spots orbiting and blending into one flowing gradient',
        colorModel: 'palette',
        usesBase: false,
        knobs: {
            waves: { label: 'Swirl', description: 'vortex swirl' },
            focus: { label: 'Warp', description: 'organic distortion' },
            glow: { label: 'Glow', description: 'exposure' },
            shine: { label: 'Grain', description: 'film grain' },
        },
    },
    warp: {
        label: 'Warp',
        description: 'marbled, smoky fluid remapped onto the palette',
        colorModel: 'palette',
        usesBase: false,
        knobs: {
            waves: { label: 'Swirl', description: 'swirl strength' },
            focus: { label: 'Distort', description: 'noise displacement' },
            glow: { label: 'Glow', description: 'exposure' },
            shine: { label: 'Blend', description: 'softness of the color bands' },
        },
    },
    grainGradient: {
        label: 'Grain Gradient',
        description: 'a wavy horizon of palette bands with grainy edges over the base color',
        colorModel: 'palette',
        usesBase: true,
        knobs: {
            waves: { label: 'Scale', description: 'wave zoom' },
            focus: { label: 'Blend', description: 'softness of the color steps' },
            glow: { label: 'Bleed', description: 'how hard the grain eats band edges' },
            shine: { label: 'Grain', description: 'visible grain' },
        },
    },
    prism: {
        label: 'Prism',
        description: 'shards of light fanning out of a corner and splitting into the palette like a prism',
        colorModel: 'palette',
        usesBase: true,
        knobs: {
            waves: { label: 'Rays', description: 'how many shards' },
            focus: { label: 'Spread', description: 'how wide the fan opens' },
            glow: { label: 'Glow', description: 'light intensity' },
            angle: { label: 'Angle', description: 'direction the light points in degrees' },
        },
    },
    halo: {
        label: 'Halo',
        description: 'a soft bowl of light with a palette-colored chromatic rim and film grain over a pale base',
        colorModel: 'palette',
        usesBase: true,
        knobs: {
            waves: { label: 'Size', description: 'size of the bowl' },
            focus: { label: 'Soft', description: 'rim softness' },
            glow: { label: 'Glow', description: 'rim brightness' },
            shine: { label: 'Grain', description: 'film grain' },
        },
    },
    shift: {
        label: 'Shift',
        description: 'a soft palette gradient cut into rectangular blocks that each slide out of register',
        colorModel: 'palette',
        usesBase: false,
        knobs: {
            waves: { label: 'Blocks', description: 'how many blocks' },
            focus: { label: 'Offset', description: 'how far each block shifts' },
            glow: { label: 'Glow', description: 'exposure' },
            shine: { label: 'Soft', description: 'softness of gradient inside blocks' },
        },
    },
    lineScreen: {
        label: 'Line Screen',
        description: 'bold sliding shapes in the accent over the base, printed through a fine diagonal line screen',
        colorModel: 'accent',
        usesBase: true,
        knobs: {
            waves: { label: 'Scale', description: 'shape size' },
            focus: { label: 'Lines', description: 'line density' },
            shine: { label: 'Sheen', description: 'line weight swelling' },
            angle: { label: 'Angle', description: 'line angle in degrees' },
        },
    },
    dotMatrix: {
        label: 'Dot Matrix',
        description: 'a grid of accent dots on the base, swelling as drifting beams of light pass over',
        colorModel: 'accent',
        usesBase: true,
        knobs: {
            waves: { label: 'Grid', description: 'dot density' },
            focus: { label: 'Dots', description: 'dot size' },
            glow: { label: 'Beams', description: 'how much of grid beams light up' },
            angle: { label: 'Angle', description: 'beam direction in degrees' },
        },
    },
    watercolor: {
        label: 'Watercolor',
        description: 'soft palette color field where colors bleed into each other in rising plumes with fine paper grain',
        colorModel: 'palette',
        usesBase: true,
        knobs: {
            waves: { label: 'Scale', description: 'size of color regions' },
            focus: { label: 'Bleed', description: 'how tall and feathery plumes are' },
            glow: { label: 'Pigment', description: 'color strength' },
            shine: { label: 'Paper', description: 'grain amount' },
        },
    },
    voxels: {
        label: 'Voxels',
        description: 'big soft 3D forms sliced into rows of stippled accent brick cells on the base shaded by orbiting light',
        colorModel: 'accent',
        usesBase: true,
        knobs: {
            waves: { label: 'Rows', description: 'row and cell density' },
            focus: { label: 'Scale', description: 'size of forms in frame' },
            glow: { label: 'Shading', description: 'lighting contrast' },
        },
    },
};

export const DEFAULT_SHADER_CONFIGS: Record<
    ShaderPreset,
    {
        color: string;
        backgroundColor: string;
        colors: string[];
        speed: number;
        waves: number;
        focus: number;
        glow: number;
        shine: number;
        angle: number;
    }
> = {
    silk: {
        color: '#2E6BE6',
        backgroundColor: '#000102',
        colors: [],
        speed: 1,
        waves: 1,
        focus: 1,
        glow: 1,
        shine: 1,
        angle: 28,
    },
    undertones: {
        color: '#4A7DFF',
        backgroundColor: '#050506',
        colors: [],
        speed: 1,
        waves: 1,
        focus: 1,
        glow: 1,
        shine: 1,
        angle: 28,
    },
    mosaic: {
        color: '#E8502A',
        backgroundColor: '#E9EDF9',
        colors: [],
        speed: 1,
        waves: 1,
        focus: 1,
        glow: 1,
        shine: 1,
        angle: 28,
    },
    meshGradient: {
        color: '#2F6BFF',
        backgroundColor: '#07070F',
        colors: ['#101B3B', '#2F6BFF', '#22D3C5', '#F2B366', '#07070F'],
        speed: 1,
        waves: 1,
        focus: 1,
        glow: 1,
        shine: 1,
        angle: 28,
    },
    warp: {
        color: '#7C5CE0',
        backgroundColor: '#07060F',
        colors: ['#07060F', '#2B1B5E', '#7C5CE0', '#C4B0F5'],
        speed: 1,
        waves: 1,
        focus: 1,
        glow: 1,
        shine: 1,
        angle: 28,
    },
    grainGradient: {
        color: '#8B5CF6',
        backgroundColor: '#08080E',
        colors: ['#0B0A18', '#3E2A7E', '#8B5CF6', '#F5D0A9'],
        speed: 1,
        waves: 1,
        focus: 1,
        glow: 1,
        shine: 1,
        angle: 28,
    },
    prism: {
        color: '#FFFFFF',
        backgroundColor: '#040406',
        colors: ['#FF4A3D', '#FFA62B', '#FFF1C9', '#45C8FF', '#6A4DFF'],
        speed: 1,
        waves: 1,
        focus: 1,
        glow: 1,
        shine: 1,
        angle: 28,
    },
    halo: {
        color: '#B44CFF',
        backgroundColor: '#F7F4FB',
        colors: ['#3DE0FF', '#3B5BFF', '#B44CFF', '#FF4FA3', '#FF9A3C'],
        speed: 1,
        waves: 1,
        focus: 1,
        glow: 1,
        shine: 1,
        angle: 28,
    },
    shift: {
        color: '#3B82F6',
        backgroundColor: '#1E3A8A',
        colors: ['#1D4ED8', '#3B82F6', '#38BDF8', '#5EEAD4', '#86EFAC'],
        speed: 1,
        waves: 1,
        focus: 1,
        glow: 1,
        shine: 1,
        angle: 28,
    },
    lineScreen: {
        color: '#E8336B',
        backgroundColor: '#F5B82E',
        colors: [],
        speed: 1,
        waves: 1,
        focus: 1,
        glow: 1,
        shine: 1,
        angle: 28,
    },
    dotMatrix: {
        color: '#6EE7D8',
        backgroundColor: '#0B1F24',
        colors: [],
        speed: 1,
        waves: 1,
        focus: 1,
        glow: 1,
        shine: 1,
        angle: 28,
    },
    watercolor: {
        color: '#B65CF0',
        backgroundColor: '#F4EFE6',
        colors: ['#4C6FE0', '#B65CF0', '#F29A4A', '#F5C6DA'],
        speed: 1,
        waves: 1,
        focus: 1,
        glow: 1,
        shine: 1,
        angle: 28,
    },
    voxels: {
        color: '#ECEAE3',
        backgroundColor: '#0A0A0B',
        colors: [],
        speed: 1,
        waves: 1,
        focus: 1,
        glow: 1,
        shine: 1,
        angle: 28,
    },
};

export const isPaletteShader = (preset: ShaderPreset): boolean =>
    SHADER_PRESET_METADATA[preset]?.colorModel === 'palette';

export const shaderUsesBase = (preset: ShaderPreset): boolean =>
    SHADER_PRESET_METADATA[preset]?.usesBase ?? true;

export const getShaderColors = (preset: ShaderPreset, colors?: string[], color?: string, bg?: string): string[] => {
    if (isPaletteShader(preset) && colors && colors.length > 0) {
        return colors.slice(0, 5);
    }
    return [color || DEFAULT_SHADER_CONFIGS[preset].color, bg || DEFAULT_SHADER_CONFIGS[preset].backgroundColor];
};
