// src/model/backgroundPresets.ts
// Production Raylight shader presets, knob metadata, and color models

export const SHADER_PRESET_IDS = [
    'silk',
    'silkFlow',
    'meshAurora',
    'liquidMetal',
    'sphereGradient',
    'waterPlane',
    'stripeMesh',
    'topography',
    'hyperspeed',
    'plasma',
    'dither',
    'threads',
    'chromaticWaves',
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
] as const;

export type ShaderPreset = (typeof SHADER_PRESET_IDS)[number];

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

export const SHADER_PRESETS: readonly ShaderPreset[] = SHADER_PRESET_IDS;

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
    silkFlow: {
        label: 'Silk Flow',
        description: 'fluid fabric folds with multi-octave simplex distortion and chromatic sheen',
        colorModel: 'palette',
        usesBase: false,
        knobs: {
            waves: { label: 'Waves', description: 'ripple and frequency' },
            focus: { label: 'Scale', description: 'noise pattern scale' },
            glow: { label: 'Glow', description: 'ambient exposure' },
            shine: { label: 'Sheen', description: 'chromatic highlight strength' },
        },
    },
    meshAurora: {
        label: 'Mesh Aurora',
        description: 'curved chromatic mesh waves reminiscent of polar night auroras',
        colorModel: 'palette',
        usesBase: true,
        knobs: {
            waves: { label: 'Curvature', description: 'wave amplitude and swirl' },
            focus: { label: 'Diffusion', description: 'softness of color mesh' },
            glow: { label: 'Luminance', description: 'auroral core glow' },
            shine: { label: 'Banding', description: 'spectral dispersion' },
        },
    },
    liquidMetal: {
        label: 'Liquid Metal',
        description: 'chrome-like fluid reflections with iridescent specularity',
        colorModel: 'palette',
        usesBase: false,
        knobs: {
            waves: { label: 'Viscosity', description: 'liquid ripple density' },
            focus: { label: 'Depth', description: 'bump map height and relief' },
            glow: { label: 'Reflection', description: 'ambient environment lighting' },
            shine: { label: 'Specular', description: 'chrome highlight tightness' },
        },
    },
    sphereGradient: {
        label: 'Celestial Sphere',
        description: '3D turbulent celestial sphere gradient with orbiting shading (ShaderGradient)',
        colorModel: 'palette',
        usesBase: true,
        knobs: {
            waves: { label: 'Turbulence', description: '3D noise distortion on sphere' },
            focus: { label: 'Radius', description: 'sphere scale and perspective' },
            glow: { label: 'Exposure', description: 'rim light and surface illumination' },
            shine: { label: 'Specular', description: 'glossy core highlight' },
        },
    },
    waterPlane: {
        label: 'Water Plane',
        description: 'flowing physical water caustics and refractive ripples (ShaderGradient)',
        colorModel: 'palette',
        usesBase: true,
        knobs: {
            waves: { label: 'Ripples', description: 'wave frequency and density' },
            focus: { label: 'Depth', description: 'caustic light focus and refraction' },
            glow: { label: 'Clarity', description: 'water transparency and ambient tone' },
            shine: { label: 'Crests', description: 'sun glint on water wave crests' },
        },
    },
    stripeMesh: {
        label: 'Stripe Mesh',
        description: 'authentic Stripe gradient mesh with 4-point dynamic cubic warp (Whatamesh)',
        colorModel: 'palette',
        usesBase: false,
        knobs: {
            waves: { label: 'Warp', description: 'mesh deformation and swirl' },
            focus: { label: 'Diffusion', description: 'color blend spread' },
            glow: { label: 'Luminance', description: 'saturation and exposure' },
            shine: { label: 'Grain', description: 'organic paper dither grain' },
        },
    },
    topography: {
        label: 'Topography',
        description: '3D undulating elevation contour lines and topographic map (React Bits)',
        colorModel: 'palette',
        usesBase: true,
        knobs: {
            waves: { label: 'Elevation', description: 'terrain height and frequency' },
            focus: { label: 'Contour Lines', description: 'iso-line spacing and thickness' },
            glow: { label: 'Glow', description: 'contour line neon radiance' },
            shine: { label: 'Detail', description: 'secondary fractal terrain ripples' },
        },
    },
    hyperspeed: {
        label: 'Hyperspeed',
        description: 'star-warp highway with accelerating neon light trails to horizon (React Bits)',
        colorModel: 'palette',
        usesBase: false,
        knobs: {
            waves: { label: 'Speed', description: 'warp velocity and streak length' },
            focus: { label: 'Density', description: 'light streak count' },
            glow: { label: 'Bloom', description: 'headlight and taillight exposure' },
            shine: { label: 'Perspective', description: 'vanishing point depth' },
        },
    },
    plasma: {
        label: 'Plasma',
        description: 'swirling satin plasma filaments and electric vortex folds (React Bits)',
        colorModel: 'palette',
        usesBase: false,
        knobs: {
            waves: { label: 'Turbulence', description: 'plasma ribbon swirl density' },
            focus: { label: 'Filaments', description: 'fold crispness and sharpness' },
            glow: { label: 'Energy', description: 'core electrical brightness' },
            shine: { label: 'Sheen', description: 'chromatic dispersion sheen' },
        },
    },
    dither: {
        label: 'Dither',
        description: 'retro 8x8 Bayer ordered dithering across gradient color stops (React Bits)',
        colorModel: 'palette',
        usesBase: true,
        knobs: {
            waves: { label: 'Pixel Size', description: 'dither matrix scale' },
            focus: { label: 'Cross-hatch', description: 'dither pattern threshold' },
            glow: { label: 'Luminance', description: 'overall exposure' },
            shine: { label: 'Contrast', description: 'contrast between dither steps' },
        },
    },
    threads: {
        label: 'Threads',
        description: 'delicate sinusoidal silk threads and flowing ribbons (React Bits)',
        colorModel: 'palette',
        usesBase: true,
        knobs: {
            waves: { label: 'Strands', description: 'thread count and wave frequency' },
            focus: { label: 'Wave Height', description: 'sinusoidal ribbon amplitude' },
            glow: { label: 'Radiance', description: 'thread core luminescence' },
            shine: { label: 'Finesse', description: 'delicate strand anti-aliasing' },
        },
    },
    chromaticWaves: {
        label: 'Chromatic Waves',
        description: 'flowing sinusoidal fluid gradient with chromatic color separation (dage)',
        colorModel: 'palette',
        usesBase: false,
        knobs: {
            waves: { label: 'Frequency', description: 'harmonic wave count' },
            focus: { label: 'Dispersion', description: 'chromatic RGB fringe separation' },
            glow: { label: 'Exposure', description: 'overall wave brightness' },
            shine: { label: 'Smoothness', description: 'inter-wave color blend' },
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
    silkFlow: {
        color: '#4F46E5',
        backgroundColor: '#05050A',
        colors: ['#4F46E5', '#EC4899', '#06B6D4'],
        speed: 0.8,
        waves: 1.2,
        focus: 1.0,
        glow: 0.85,
        shine: 0.6,
        angle: 30,
    },
    meshAurora: {
        color: '#10B981',
        backgroundColor: '#050814',
        colors: ['#0F172A', '#10B981', '#6366F1', '#EC4899'],
        speed: 0.6,
        waves: 1.0,
        focus: 1.1,
        glow: 1.0,
        shine: 0.5,
        angle: 45,
    },
    liquidMetal: {
        color: '#94A3B8',
        backgroundColor: '#0A0E17',
        colors: ['#1E293B', '#94A3B8', '#38BDF8', '#F8FAFC'],
        speed: 0.7,
        waves: 1.4,
        focus: 1.2,
        glow: 0.9,
        shine: 0.95,
        angle: 25,
    },
    sphereGradient: {
        color: '#6366F1',
        backgroundColor: '#090D16',
        colors: ['#090D16', '#6366F1', '#EC4899', '#38BDF8'],
        speed: 0.7,
        waves: 1.1,
        focus: 1.0,
        glow: 0.9,
        shine: 0.75,
        angle: 35,
    },
    waterPlane: {
        color: '#0EA5E9',
        backgroundColor: '#031726',
        colors: ['#031726', '#0284C7', '#38BDF8', '#E0F2FE'],
        speed: 0.8,
        waves: 1.5,
        focus: 1.2,
        glow: 0.85,
        shine: 0.9,
        angle: 45,
    },
    stripeMesh: {
        color: '#FF6B6B',
        backgroundColor: '#1A1A2E',
        colors: ['#FF6B6B', '#4ECDC4', '#FFE66D', '#1A1A2E'],
        speed: 0.6,
        waves: 1.2,
        focus: 1.0,
        glow: 0.95,
        shine: 0.35,
        angle: 45,
    },
    topography: {
        color: '#10B981',
        backgroundColor: '#06140E',
        colors: ['#06140E', '#059669', '#10B981', '#34D399'],
        speed: 0.5,
        waves: 1.3,
        focus: 1.2,
        glow: 1.1,
        shine: 0.6,
        angle: 30,
    },
    hyperspeed: {
        color: '#00F0FF',
        backgroundColor: '#020208',
        colors: ['#020208', '#00F0FF', '#7000FF', '#FF007A'],
        speed: 1.2,
        waves: 1.4,
        focus: 1.1,
        glow: 1.2,
        shine: 1.0,
        angle: 0,
    },
    plasma: {
        color: '#A855F7',
        backgroundColor: '#0A0614',
        colors: ['#0A0614', '#A855F7', '#EC4899', '#F97316'],
        speed: 0.75,
        waves: 1.3,
        focus: 1.1,
        glow: 1.0,
        shine: 0.7,
        angle: 40,
    },
    dither: {
        color: '#3B82F6',
        backgroundColor: '#050B14',
        colors: ['#050B14', '#1D4ED8', '#60A5FA', '#E2E8F0'],
        speed: 0.6,
        waves: 1.0,
        focus: 1.0,
        glow: 0.9,
        shine: 0.8,
        angle: 45,
    },
    threads: {
        color: '#F43F5E',
        backgroundColor: '#0F0407',
        colors: ['#0F0407', '#E11D48', '#FB7185', '#FECDD3'],
        speed: 0.65,
        waves: 1.2,
        focus: 1.3,
        glow: 0.95,
        shine: 0.7,
        angle: 25,
    },
    chromaticWaves: {
        color: '#38BDF8',
        backgroundColor: '#040814',
        colors: ['#040814', '#0284C7', '#38BDF8', '#C084FC'],
        speed: 0.8,
        waves: 1.2,
        focus: 1.0,
        glow: 0.9,
        shine: 0.85,
        angle: 35,
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

export const getShaderColors = (
    preset: ShaderPreset,
    colors?: string[],
    color?: string,
    bg?: string,
    color1?: string,
    color2?: string,
    color3?: string
): string[] => {
    const def = DEFAULT_SHADER_CONFIGS[preset] || DEFAULT_SHADER_CONFIGS.silk;
    if (color1 || color2 || color3) {
        return [
            color1 || colors?.[0] || color || def.colors?.[0] || def.color,
            color2 || colors?.[1] || def.colors?.[1] || def.color,
            color3 || colors?.[2] || def.colors?.[2] || def.backgroundColor,
        ];
    }
    if (isPaletteShader(preset) && colors && colors.length > 0) {
        return colors.slice(0, 5);
    }
    if (def.colors && def.colors.length > 0 && (!colors || colors.length === 0)) {
        return def.colors.slice(0, 5);
    }
    return [color || def.color, bg || def.backgroundColor];
};
