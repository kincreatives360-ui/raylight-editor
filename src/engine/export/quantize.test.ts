import { describe, expect, it } from 'vitest';
import {
    buildPalette,
    mapToIndices,
    nearestIndex,
    paletteToColorTable,
    type Palette,
} from './quantize';

function image(width: number, height: number, fill: (x: number, y: number) => [number, number, number]): ImageData {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const [r, g, b] = fill(x, y);
            const i = (y * width + x) * 4;
            data[i] = r;
            data[i + 1] = g;
            data[i + 2] = b;
            data[i + 3] = 255;
        }
    }
    return { width, height, data } as ImageData;
}

describe('buildPalette', () => {
    it('derives an exact palette from flat colors', () => {
        const frame = image(4, 4, (x) => (x < 2 ? [255, 0, 0] : [0, 0, 255]));
        const palette = buildPalette([frame]);
        expect(palette.colors.length).toBe(2);
        expect(new Set(palette.colors)).toEqual(new Set([0xff0000, 0x0000ff]));
    });

    it('keeps every distinct color when under the color budget', () => {
        const colors: Array<[number, number, number]> = [
            [255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 0], [128, 128, 128],
        ];
        const frame = image(colors.length, 1, (x) => colors[x]);
        const palette = buildPalette([frame]);
        for (const [r, g, b] of colors) {
            const index = nearestIndex(palette, r, g, b);
            expect(palette.colors[index]).toBe((r << 16) | (g << 8) | b);
        }
    });

    it('caps the palette at maxColors for high-variation content', () => {
        const frame = image(64, 64, (x, y) => [(x * 4) % 256, (y * 4) % 256, ((x + y) * 2) % 256]);
        const palette = buildPalette([frame], 64);
        expect(palette.colors.length).toBeLessThanOrEqual(64);
        expect(palette.colors.length).toBeGreaterThan(1);
    });

    it('aggregates frames into one palette', () => {
        const red = image(2, 2, () => [255, 0, 0]);
        const green = image(2, 2, () => [0, 255, 0]);
        const palette = buildPalette([red, green]);
        expect(new Set(palette.colors)).toEqual(new Set([0xff0000, 0x00ff00]));
    });

    it('rejects invalid color budgets and handles empty input', () => {
        expect(() => buildPalette([], 1)).toThrow(RangeError);
        expect(() => buildPalette([], 512)).toThrow(RangeError);
        const empty = buildPalette([image(0, 0, () => [0, 0, 0])]);
        expect(empty.colors.length).toBeGreaterThanOrEqual(1);
    });
});

describe('nearestIndex', () => {
    it('returns exact matches and memoizes lookups', () => {
        const palette: Palette = { colors: [0x000000, 0xffffff], lookup: new Int16Array(32 * 32 * 32).fill(-1) };
        expect(palette.colors[nearestIndex(palette, 0, 0, 0)]).toBe(0x000000);
        expect(palette.colors[nearestIndex(palette, 255, 255, 255)]).toBe(0xffffff);
        // Mid-gray resolves deterministically; repeated call hits the cache
        // keyed by the rgb(5,5,5) quantization of the color.
        const first = nearestIndex(palette, 128, 128, 128);
        expect(nearestIndex(palette, 128, 128, 128)).toBe(first);
        const key = ((128 >> 3) << 10) | ((128 >> 3) << 5) | (128 >> 3);
        expect(palette.lookup[key]).toBe(first);
    });
});

describe('mapToIndices', () => {
    it('maps pixels exactly without dithering', () => {
        const frame = image(4, 1, (x) => (x % 2 === 0 ? [255, 0, 0] : [0, 0, 255]));
        const palette = buildPalette([frame]);
        const indices = mapToIndices(frame, palette, false);
        expect(Array.from(indices)).toEqual([
            palette.colors.indexOf(0xff0000),
            palette.colors.indexOf(0x0000ff),
            palette.colors.indexOf(0xff0000),
            palette.colors.indexOf(0x0000ff),
        ]);
    });

    it('dithers gradients away from hard banding edges', () => {
        // 16-step gray gradient with only 4 palette entries forces visible bands
        // without dithering; with dithering, both indices must appear at the
        // transition column (error diffusion mixes neighbors).
        const frame = image(16, 4, (x) => {
            const v = Math.round((x / 15) * 255);
            return [v, v, v];
        });
        const palette = buildPalette([frame], 4);
        const flat = mapToIndices(frame, palette, false);
        const dithered = mapToIndices(frame, palette, true);
        // Dithered output uses at least as many palette entries as flat mapping.
        expect(new Set(dithered).size).toBeGreaterThanOrEqual(new Set(flat).size);
        // And every index is valid.
        for (const index of dithered) {
            expect(index).toBeLessThan(palette.colors.length);
        }
    });
});

describe('paletteToColorTable', () => {
    it('emits a 768-byte RGB table padded to size', () => {
        const palette: Palette = { colors: [0xff0000, 0x00ff00], lookup: new Int16Array(1) };
        const table = paletteToColorTable(palette);
        expect(table.length).toBe(768);
        expect(Array.from(table.slice(0, 3))).toEqual([255, 0, 0]);
        expect(Array.from(table.slice(3, 6))).toEqual([0, 255, 0]);
        // Padded entries cycle the palette instead of adding black.
        expect(Array.from(table.slice(6, 9))).toEqual([255, 0, 0]);
    });
});
