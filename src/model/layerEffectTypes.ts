export interface DropShadowEffect {
  mode?: 'drop' | 'inner' | 'long';
  length?: number;
  angle?: number;
  fade?: number;
  /** Spread in authoring pixels. */
  spread?: number;
  enabled: boolean;
  color: string;
  opacity: number;
  blur: number;
  offsetX: number;
  offsetY: number;
}

export interface GlowEffect {
  mode?: 'edge' | 'fill';
  angle?: number;
  sheen?: number;
  rim?: number;
  depth?: number;
  blend?: 'normal' | 'add';
  enabled: boolean;
  color: string;
  intensity: number;
  radius: number;
}

export interface LiquidGlassEffect {
  dispersion?: number;
  shine?: number;
  enabled: boolean;
  refraction?: number;
  roughness?: number;
  tint?: string;
}

export interface WarpEffect {
  mode?: 'bulge' | 'ripple' | 'bend' | 'curl' | 'turbulent';
  complexity?: number;
  seed?: number;
  pinning?: 'none' | 'all' | 'horizontal' | 'vertical' | 'left' | 'right' | 'top' | 'bottom';
  evolution?: number;
  loop?: boolean;
  loopDuration?: number;
  speed?: number;
  strength?: number;
  size?: number;
  centerX?: number;
  centerY?: number;
  angle?: number;
  width?: number;
  travel?: number;
  enabled: boolean;
  amount?: number;
  frequency?: number;
}

export interface BlurSettings {
  type?: 'gaussian' | 'radial' | 'zoom';
  centerX?: number;
  centerY?: number;
  quality?: 8 | 16 | 32;
  mode: 'uniform' | 'progressive';
  start: number;
  end: number;
  angle: number;
}

export interface ScreenEffect {
  enabled: boolean;
  mode: 'lcd' | 'oled' | 'crt' | 'led';
  pixelSize: number;
  grid: number;
  moire: number;
  bands: number;
  focus: number;
  glow: number;
  flicker: number;
  speed: number;
  offAxis: number;
  snapToPixels: boolean;
}

export interface OutlineEffect {
  enabled: boolean;
  width: number;
  placement: "inside" | "outside";
  color: string;
  opacity: number;
  softness: number;
}

export interface ColorCorrectionEffect {
  enabled: boolean;
  exposure: number;
  contrast: number;
  saturation: number;
  temperature: number;
  tint: number;
  blackPoint: number;
  whitePoint: number;
  gamma: number;
  curveShadows: number;
  curveMidtones: number;
  curveHighlights: number;
}

export interface NoiseEffect {
  enabled: boolean;
  amount: number;
  scale: number;
  monochrome: boolean;
  density: number;
  seed: number;
  animated: boolean;
  speed: number;
}

export interface BevelEffect {
  softness?: number;
  enabled: boolean;
  thickness: number;
  depth: number;
  angle: number;
  highlightColor: string;
  shadowColor: string;
  intensity: number;
}

export interface HalftoneEffect {
  offsetX?: number;
  offsetY?: number;
  contrast?: number;
  enabled: boolean;
  dotSize: number;
  spacing: number;
  angle: number;
  shape: "circle" | "square" | "line";
  foreground: string;
  background: string;
  sourceColor: boolean;
  invert: boolean;
}

export interface RoughenEffect {
  enabled: boolean;
  border: number;
  scale: number;
  sharpness: number;
  amount: number;
  seed: number;
  evolution: number;
  speed: number;
}

export interface ColorKeyEffect {
  enabled: boolean;
  color: string;
  similarity: number;
  softness: number;
  spill: number;
  invert: boolean;
}

export interface PixelateEffect {
  offsetX?: number;
  offsetY?: number;
  enabled: boolean;
  blockSize: number;
  aspect: number;
  mode: "uniform" | "progressive";
  start: number;
  end: number;
  angle: number;
}

export interface RgbSplitEffect {
  enabled: boolean;
  amount: number;
  angle: number;
  mode: 'linear' | 'radial';
  centerX: number;
  centerY: number;
  red: number;
  green: number;
  blue: number;
}

export interface LayerEffects {
  rgbSplit?: RgbSplitEffect;
  outline?: OutlineEffect;
  colorCorrection?: ColorCorrectionEffect;
  noise?: NoiseEffect;
  bevel?: BevelEffect;
  halftone?: HalftoneEffect;
  roughen?: RoughenEffect;
  colorKey?: ColorKeyEffect;
  pixelate?: PixelateEffect;
  dropShadow?: DropShadowEffect;
  shadows?: DropShadowEffect[];
  glow?: GlowEffect;
  layerBlur?: number;
  backdropBlur?: number;
  layerBlurSettings?: BlurSettings;
  backdropBlurSettings?: BlurSettings;
  liquidGlass?: LiquidGlassEffect;
  warp?: WarpEffect;
  screen?: ScreenEffect;
}
