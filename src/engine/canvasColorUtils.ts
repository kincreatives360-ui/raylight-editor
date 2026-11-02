import { lerp } from './math';

/** Parse a hexadecimal color string (#RGB or #RRGGBB) into RGB byte array [r, g, b]. */
export function parseHex(hex: string): [number, number, number] {
  if (!hex) return [255, 255, 255];
  const clean = hex.trim().replace(/^#/, '');
  const expanded =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.padEnd(6, '0');
  const num = parseInt(expanded.slice(0, 6), 16);
  if (isNaN(num)) return [255, 255, 255];
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return [r, g, b];
}

/** Convert a hex color string and alpha scalar to CSS rgba() color format. */
export function hexToRgba(hex: string, alpha: number): string {
  const [r, g, b] = parseHex(hex);
  const safeAlpha = Math.max(0, Math.min(1, alpha));
  return `rgba(${r}, ${g}, ${b}, ${safeAlpha.toFixed(3)})`;
}

/** Linearly interpolate between two hex color strings. */
export function lerpHex(a: string, b: string, t: number): string {
  const amount = Math.max(0, Math.min(1, t));
  const left = parseHex(a);
  const right = parseHex(b);
  const mixed = left.map((channel, index) =>
    Math.round(lerp(channel, right[index], amount))
  );
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}
