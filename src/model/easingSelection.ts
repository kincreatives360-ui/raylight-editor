import {
  PresetEasingNameSchema,
  SpringEasingNameSchema,
} from './schema';
import type { Easing } from './types';

export interface BezierDefaults {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const LEGACY_PRESET_ALIASES: Record<string, string> = {
  easeIn: 'ease-in',
  easeOut: 'ease-out',
  easeInOut: 'ease-in-out',
  easeInQuad: 'ease-in-quad',
  easeOutQuad: 'ease-out-quad',
  easeInOutQuad: 'ease-in-out-quad',
  easeInCubic: 'ease-in-cubic',
  easeOutCubic: 'ease-out-cubic',
  easeInOutCubic: 'ease-in-out-cubic',
  easeInBack: 'ease-in-back',
  easeOutBack: 'ease-out-back',
  easeInOutBack: 'ease-in-out-back',
  easeInExpo: 'ease-in-expo',
  easeOutExpo: 'ease-out-expo',
};

export const EASING_OPTION_GROUPS: ReadonlyArray<{
  label: string;
  options: ReadonlyArray<{ value: string; label: string }>;
}> = [
  {
    label: 'Physics Springs',
    options: [
      { value: 'spring:gentle', label: 'Spring — Gentle' },
      { value: 'spring:quick', label: 'Spring — Quick' },
      { value: 'spring:bouncy', label: 'Spring — Bouncy' },
      { value: 'spring:snappy', label: 'Spring — Snappy' },
      { value: 'spring:stiff', label: 'Spring — Stiff' },
      { value: 'spring:slow', label: 'Spring — Slow' },
    ],
  },
  {
    label: 'Standard Presets',
    options: [
      { value: 'preset:linear', label: 'Linear' },
      { value: 'preset:ease', label: 'Ease' },
      { value: 'preset:ease-in', label: 'Ease In' },
      { value: 'preset:ease-out', label: 'Ease Out' },
      { value: 'preset:ease-in-out', label: 'Ease In Out' },
      { value: 'preset:ease-in-quad', label: 'Ease In Quad' },
      { value: 'preset:ease-out-quad', label: 'Ease Out Quad' },
      { value: 'preset:ease-in-out-quad', label: 'Ease In Out Quad' },
      { value: 'preset:ease-in-cubic', label: 'Ease In Cubic' },
      { value: 'preset:ease-out-cubic', label: 'Ease Out Cubic' },
      { value: 'preset:ease-in-out-cubic', label: 'Ease In Out Cubic' },
      { value: 'preset:ease-in-back', label: 'Ease In Back' },
      { value: 'preset:ease-out-back', label: 'Ease Out Back' },
      { value: 'preset:ease-in-out-back', label: 'Ease In Out Back' },
      { value: 'preset:ease-in-expo', label: 'Ease In Expo' },
      { value: 'preset:ease-out-expo', label: 'Ease Out Expo' },
      { value: 'preset:bounce', label: 'Bounce' },
      { value: 'preset:hold', label: 'Step Hold' },
    ],
  },
  {
    label: 'Custom Curve',
    options: [{ value: 'bezier', label: 'Custom Cubic Bezier' }],
  },
];

export function easingSelectionValue(easing: Easing): string {
  if (easing.kind === 'bezier') return 'bezier';
  const normalizedName =
    easing.kind === 'preset'
      ? (LEGACY_PRESET_ALIASES[easing.name] ?? easing.name)
      : easing.name;
  return `${easing.kind}:${normalizedName}`;
}

export function easingFromSelection(
  selection: string,
  bezierDefaults: BezierDefaults = { x1: 0.65, y1: 0, x2: 0.35, y2: 1 }
): Easing | null {
  if (selection === 'bezier') {
    return { kind: 'bezier', ...bezierDefaults };
  }

  const separator = selection.indexOf(':');
  if (separator < 0) return null;
  const kind = selection.slice(0, separator);
  const name = selection.slice(separator + 1);

  if (kind === 'spring') {
    const result = SpringEasingNameSchema.safeParse(name);
    return result.success ? { kind, name: result.data } : null;
  }
  if (kind === 'preset') {
    const normalizedName = LEGACY_PRESET_ALIASES[name] ?? name;
    const result = PresetEasingNameSchema.safeParse(normalizedName);
    return result.success ? { kind, name: result.data } : null;
  }
  return null;
}
