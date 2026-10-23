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
    const result = PresetEasingNameSchema.safeParse(name);
    return result.success ? { kind, name: result.data } : null;
  }
  return null;
}
