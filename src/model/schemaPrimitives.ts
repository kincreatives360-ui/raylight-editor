import { z } from 'zod';
import { SHADER_PRESET_IDS } from './backgroundPresets';
import { resolveDeviceFrameSettings } from './deviceFrame';

export const Vec2Schema = z.object({
  x: z.number(),
  y: z.number(),
});

export const Vec3Schema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

export const Size2DSchema = z.object({
  width: z.number().min(0.01),
  height: z.number().min(0.01),
});

export const DeviceFrameSettingsSchema = z.preprocess(
  (input) => input && typeof input === 'object' && !Array.isArray(input)
    ? resolveDeviceFrameSettings(input)
    : input,
  z.object({
    geometryVersion: z.literal(1).optional(),
    deviceId: z.string().optional(),
    deviceScale: z.number().min(0.65).max(2).optional(),
    family: z.enum(['phone', 'laptop', 'tablet', 'display']).optional(),
    legacyHeightCompensation: z.number().positive().optional(),
    enabled: z.boolean(),
    model: z.enum(['iphone-pro', 'iphone', 'iphone-classic']),
    frameColor: z.string(),
    finish: z.string().optional(),
    frameRoughness: z.number().min(0.04).max(1),
    frameMetalness: z.number().min(0).max(1),
    scale: z.number().min(0.65).max(2),
    bezelWidth: z.number().min(0.01).max(0.2),
    thickness: z.number().min(0.005).max(0.16),
    cornerRadius: z.number().min(0.04).max(0.24),
    screenFit: z.enum(['stretch', 'contain', 'cover']),
    screenFillColor: z.string(),
    screenPan: z.object({ x: z.number().min(-1).max(1), y: z.number().min(-1).max(1) }).optional(),
    screenZoom: z.number().min(0.5).max(3).optional(),
    hingeAngleDeg: z.number().min(0).max(135).optional(),
    tiltAngleDeg: z.number().min(-15).max(30).optional(),
    glassTint: z.string(),
    glassOpacity: z.number().min(0).max(0.45),
    glassRoughness: z.number().min(0.02).max(1),
    gloss: z.number().min(0).max(1),
    reflection: z.number().min(0).max(1),
    cutoutStyle: z.enum(['dynamic-island', 'notch', 'punch-hole', 'none']),
    cutoutWidth: z.number().min(0.08).max(0.85),
    cutoutHeight: z.number().min(0.015).max(0.14),
    showSideButtons: z.boolean(),
    showRearCameras: z.boolean(),
    shadowEnabled: z.boolean(),
    shadowOpacity: z.number().min(0).max(1),
    shadowBlur: z.number().min(0).max(1),
    shadowOffset: z.number().min(0).max(0.5),
    lidAngle: z.number().min(0).max(180).optional(),
  })
);

export const GradientStopSchema = z.object({
  at: z.number().min(0).max(1),
  color: z.string(),
  opacity: z.number().min(0).max(1).optional(),
});

export const MeshGradientPointSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  color: z.string(),
  opacity: z.number().min(0).max(1),
});

export const FillSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('solid'),
    color: z.string(),
    opacity: z.number().min(0).max(1),
  }),
  z.object({
    kind: z.literal('gradient'),
    angle: z.number(),
    stops: z.array(GradientStopSchema).min(2),
    gradientType: z.enum(['linear', 'radial', 'angular', 'diamond', 'mesh']).optional(),
    mesh: z.array(MeshGradientPointSchema).length(9).optional(),
    handles: z.object({ start: z.object({ x: z.number(), y: z.number() }), end: z.object({ x: z.number(), y: z.number() }), width: z.number().optional() }).optional(),
  }).superRefine((fill, ctx) => {
    if (fill.gradientType === 'mesh' && fill.mesh?.length !== 9) {
      ctx.addIssue({ code: 'custom', path: ['mesh'], message: 'Mesh gradients require exactly nine control points.' });
    }
  }),
]);

export const ShaderPresetSchema = z.enum(SHADER_PRESET_IDS);

export const BackgroundSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('solid'),
    color: z.string(),
    opacity: z.number().min(0).max(1).optional(),
  }),
  z.object({
    kind: z.literal('gradient'),
    angle: z.number(),
    stops: z.array(GradientStopSchema).min(2),
    source: z.enum(['color', 'shader']).optional(),
    gradientType: z.enum(['linear', 'radial', 'angular']).optional(),
    handles: z
      .object({
        start: z.object({ x: z.number(), y: z.number() }),
        end: z.object({ x: z.number(), y: z.number() }),
        width: z.number().optional(),
      })
      .optional(),
  }),
  z.object({
    kind: z.literal('noise'),
    baseColor: z.string(),
    intensity: z.number().min(0).max(1),
  }),
  z.object({
    kind: z.literal('shader'),
    preset: ShaderPresetSchema,
    color: z.string(),
    colors: z.array(z.string()).default([]),
    backgroundColor: z.string().default('#000102'),
    speed: z.number().min(0).max(3).default(1),
    waves: z.number().min(0.25).max(2.5).default(1),
    focus: z.number().min(0.2).max(2).default(1),
    glow: z.number().min(0).max(2).default(1),
    shine: z.number().min(0).max(2).default(1),
    angle: z.number().min(-90).max(90).default(28),
    noiseScale: z.number().optional(),
    color1: z.string().optional(),
    color2: z.string().optional(),
    color3: z.string().optional(),
    color4: z.string().optional(),
  }),
  z.object({
    kind: z.literal('image'),
    assetId: z.string().optional(),
    src: z.string().optional(),
    color: z.string().optional(),
    fit: z.enum(['cover', 'contain']).optional(),
    dim: z.number().min(0).max(1).optional(),
    blur: z.number().min(0).max(100).optional(),
    opacity: z.number().min(0).max(1).optional(),
  }),
  z.object({
    kind: z.literal('transparent'),
  }),
]);

export const PresetEasingNameSchema = z.enum([
  'linear',
  'ease',
  'ease-in',
  'ease-out',
  'ease-in-out',
  'ease-in-quad',
  'ease-out-quad',
  'ease-in-out-quad',
  'ease-in-cubic',
  'ease-out-cubic',
  'ease-in-out-cubic',
  'ease-in-back',
  'ease-out-back',
  'ease-in-out-back',
  'ease-in-expo',
  'ease-out-expo',
  'bounce',
  'hold',
]);

export type PresetEasingName = z.infer<typeof PresetEasingNameSchema>;

export const SpringEasingNameSchema = z.enum([
  'gentle',
  'quick',
  'bouncy',
  'slow',
  'snappy',
  'stiff',
]);

export const SpringConfigSchema = z.object({
  stiffness: z.number().min(1).max(1000).optional(),
  damping: z.number().min(1).max(200).optional(),
  mass: z.number().min(0.1).max(50).optional(),
});

export const EasingSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('preset'),
    name: PresetEasingNameSchema,
  }),
  z.object({
    kind: z.literal('spring'),
    name: SpringEasingNameSchema,
    config: SpringConfigSchema.optional(),
  }),
  z.object({
    kind: z.literal('bezier'),
    x1: z.number().min(0).max(1),
    y1: z.number(),
    x2: z.number().min(0).max(1),
    y2: z.number(),
  }),
]);

export const TransitionTypeSchema = z.enum([
  'none',
  'fade',
  'slide-up',
  'slide-down',
  'slide-left',
  'slide-right',
  'float-out',
  'scale-out',
  'mask-sweep',
  'wipe',
  'blur',
  'focus',
  'rack-focus',
  'pop',
  'spin',
  'flip-x',
  'flip-y',
  'swing',
  'typewriter',
  'scramble',
]);

export const TransitionishSchema = z.object({
  enabled: z.boolean().optional(),
  blur: z.number().min(0).optional(),
  fade: z.boolean().optional(),
  stagger: z.enum(['none', 'letter', 'word', 'line']).optional(),
  type: TransitionTypeSchema,
  durationMs: z.number().min(0),
  delayMs: z.number().min(0),
  distance: z.number().min(0).max(2),
  easing: EasingSchema,
});

export const AnimationBlockPropertySchema = z.enum([
  'position',
  'rotation',
  'tilt',
  'scale',
  'size',
  'opacity',
  'cornerRadius',
  'layerBlur',
  'maskSweep',
  'shimmer',
  'followPath',
  'counter',
  'glow',
  'pathReveal',
  'wiggle',
  'emphasis',
  'changeText',
  'morph',
]);

export type AnimationBlockProperty = z.infer<typeof AnimationBlockPropertySchema>;

export const AnimationBlockSchema = z.object({
  enabled: z.boolean().optional(),
  settings: z.object({
    targetPosition: Vec3Schema.optional(),
    targetScale: Vec3Schema.optional(),
    targetSize: z.object({ width: z.number().min(0), height: z.number().min(0) }).optional(),
    color: z.string().optional(),
    intensity: z.number().min(0).optional(),
    width: z.number().min(0).max(1).optional(),
    direction: z.enum(['left', 'right', 'up', 'down']).optional(),
    text: z.string().optional(),
  }).optional(),
  id: z.string(),
  label: z.string(),
  property: AnimationBlockPropertySchema,
  startMs: z.number().min(0),
  durationMs: z.number().min(10),
  easing: EasingSchema,
  amount: z.union([Vec3Schema, z.number()]),
});

const DropShadowSchema = z.object({
      mode: z.enum(['drop', 'inner', 'long']).optional(),
      length: z.number().min(0).max(2000).optional(),
      angle: z.number().optional(),
      fade: z.number().min(0).max(1).optional(),
      distance: z.number().optional(), spread: z.number().min(-200).max(200).optional(),
      enabled: z.boolean(),
      color: z.string(),
      opacity: z.number().min(0).max(1),
      blur: z.number().min(0).max(1),
      offsetX: z.number().min(-1).max(1),
      offsetY: z.number().min(-1).max(1),
    });
const BlurSettingsSchema = z.object({
  type: z.enum(['gaussian', 'radial', 'zoom']).optional(),
  centerX: z.number().min(0).max(1).optional(),
  centerY: z.number().min(0).max(1).optional(),
  quality: z.union([z.literal(8), z.literal(16), z.literal(32)]).optional(),
  mode: z.enum(['uniform', 'progressive']),
  start: z.number().min(0).max(200),
  end: z.number().min(0).max(200),
  angle: z.number(),
});
export const LayerEffectsSchema = z.object({
  rgbSplit: z.object({
    enabled: z.boolean(), amount: z.number().min(0).max(200), angle: z.number(), mode: z.enum(['linear', 'radial']),
    centerX: z.number().min(0).max(1), centerY: z.number().min(0).max(1),
    red: z.number().min(-2).max(2), green: z.number().min(-2).max(2), blue: z.number().min(-2).max(2),
  }).optional(),
  outline: z.object({ enabled: z.boolean(), width: z.number().min(0).max(200), placement: z.enum(["inside","outside"]), color: z.string(), opacity: z.number().min(0).max(1), softness: z.number().min(0).max(200) }).optional(),
  colorCorrection: z.object({ enabled: z.boolean(), exposure: z.number().min(-5).max(5), contrast: z.number().min(0).max(3), saturation: z.number().min(0).max(3), temperature: z.number().min(-1).max(1), tint: z.number().min(-1).max(1), blackPoint: z.number().min(0).max(1), whitePoint: z.number().min(0).max(1), gamma: z.number().min(0.1).max(4), curveShadows: z.number().min(-1).max(1), curveMidtones: z.number().min(-1).max(1), curveHighlights: z.number().min(-1).max(1), curveR: z.tuple([z.number().min(-1).max(1), z.number().min(-1).max(1), z.number().min(-1).max(1)]).optional(), curveG: z.tuple([z.number().min(-1).max(1), z.number().min(-1).max(1), z.number().min(-1).max(1)]).optional(), curveB: z.tuple([z.number().min(-1).max(1), z.number().min(-1).max(1), z.number().min(-1).max(1)]).optional() }).optional(),
  noise: z.object({ enabled: z.boolean(), amount: z.number().min(0).max(1), scale: z.number().min(0.5).max(100), monochrome: z.boolean(), density: z.number().min(0).max(1), seed: z.number().int(), animated: z.boolean(), speed: z.number().min(0).max(20) }).optional(),
  bevel: z.object({ softness: z.number().min(0).max(200).optional(), enabled: z.boolean(), thickness: z.number().min(0).max(200), depth: z.number().min(-200).max(200), angle: z.number(), highlightColor: z.string(), shadowColor: z.string(), intensity: z.number().min(0).max(1) }).optional(),
  halftone: z.object({ offsetX: z.number().optional(), offsetY: z.number().optional(), contrast: z.number().min(.1).max(4).optional(), enabled: z.boolean(), dotSize: z.number().min(0.5).max(200), spacing: z.number().min(0.5).max(200), angle: z.number(), shape: z.enum(["circle","square","line"]), foreground: z.string(), background: z.string(), sourceColor: z.boolean(), invert: z.boolean() }).optional(),
  roughen: z.object({ enabled: z.boolean(), border: z.number().min(0).max(200), scale: z.number().min(0.5).max(100), sharpness: z.number().min(0).max(1), amount: z.number().min(0).max(1), seed: z.number().int(), evolution: z.number(), speed: z.number() }).optional(),
  colorKey: z.object({ enabled: z.boolean(), color: z.string(), similarity: z.number().min(0).max(1), softness: z.number().min(0).max(1), spill: z.number().min(0).max(1), invert: z.boolean() }).optional(),
  pixelate: z.object({ offsetX: z.number().optional(), offsetY: z.number().optional(), enabled: z.boolean(), blockSize: z.number().min(1).max(500), aspect: z.number().min(0.1).max(10), mode: z.enum(["uniform","progressive"]), start: z.number().min(1).max(500), end: z.number().min(1).max(500), angle: z.number() }).optional(),
  dropShadow: DropShadowSchema.optional(),
  shadows: z.array(DropShadowSchema).max(16).optional(),
  glow: z
    .object({
      placement: z.enum(['outer', 'inner']).optional(),
      mode: z.enum(['edge', 'fill']).optional(),
      angle: z.number().optional(),
      sheen: z.number().min(0).max(1).optional(),
      rim: z.number().min(0).max(1).optional(),
      depth: z.number().min(-200).max(200).optional(),
      blend: z.enum(['normal', 'add']).optional(),
      enabled: z.boolean(),
      color: z.string(),
      intensity: z.number().min(0),
      radius: z.number().min(0),
      innerColor: z.string().optional(),
      innerIntensity: z.number().min(0).optional(),
      innerRadius: z.number().min(0).optional(),
    })
    .optional(),
  layerBlur: z.number().min(0).max(2).optional(),
  backdropBlur: z.number().min(0).max(2).optional(),
  layerBlurSettings: BlurSettingsSchema.optional(),
  backdropBlurSettings: BlurSettingsSchema.optional(),
  liquidGlass: z
    .object({
      enabled: z.boolean(),
      refraction: z.number().optional(),
      ior: z.number().min(1).max(3).optional(),
      bevelWidth: z.number().min(0).max(500).optional(),
      doubleBevel: z.number().min(0).max(2).optional(),
      dispersion: z.number().min(0).max(2).optional(),
      chromaBoost: z.number().min(0).max(3).optional(),
      roughness: z.number().optional(),
      shine: z.number().optional(),
      fresnel: z.number().min(0).max(1).optional(),
      lightAngle: z.number().min(-360).max(360).optional(),
      tint: z.string().optional(),
      rimColor: z.string().optional(),
    })
    .optional(),
  warp: z
    .object({
      mode: z.enum(['bulge', 'ripple', 'bend', 'curl', 'turbulent']).optional(),
      complexity: z.number().min(1).max(6).optional(),
      seed: z.number().int().optional(),
      pinning: z.enum(['none', 'all', 'horizontal', 'vertical', 'left', 'right', 'top', 'bottom']).optional(),
      evolution: z.number().optional(),
      loop: z.boolean().optional(),
      loopDuration: z.number().min(.1).max(60).optional(),
      speed: z.number().optional(),
      strength: z.number().min(-2).max(2).optional(),
      size: z.number().min(1).max(2000).optional(),
      centerX: z.number().optional(),
      centerY: z.number().optional(),
      angle: z.number().optional(),
      width: z.number().min(1).max(2000).optional(),
      travel: z.number().min(0).max(1).optional(),
      enabled: z.boolean(),
      amount: z.number().optional(),
      frequency: z.number().optional(),
    })
    .optional(),
  screen: z.object({
    enabled: z.boolean(), mode: z.enum(['lcd', 'oled', 'crt', 'led']),
    pixelSize: z.number().min(.5).max(100),
    grid: z.number().min(0).max(1), moire: z.number().min(0).max(1),
    bands: z.number().min(0).max(1), focus: z.number().min(0).max(1),
    glow: z.number().min(0).max(2), flicker: z.number().min(0).max(1),
    speed: z.number().min(0).max(20), offAxis: z.number().min(0).max(1),
    snapToPixels: z.boolean(),
  }).optional(),
});

