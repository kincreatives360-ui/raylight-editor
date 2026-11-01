import { describe, expect, it } from 'vitest';
import { IncrementalGifEncoder, gifFrameDelayCentiseconds } from './gifEncoder';
import { buildPalette } from './export/quantize';

describe('IncrementalGifEncoder', () => {
    it('encodes a valid GIF89a header and trailer without storing raw frames', async () => {
        const encoder = new IncrementalGifEncoder(2, 2);
        const image = {width:2, height:2, data:new Uint8ClampedArray(16)} as ImageData;
        encoder.addFrame(image,8);
        const bytes = new Uint8Array(await encoder.finish().arrayBuffer());
        expect(new TextDecoder().decode(bytes.slice(0,6))).toBe('GIF89a');
        expect(bytes[bytes.length-1]).toBe(0x3b);
    });
    it('distributes GIF timing rounding over 12fps', () => {
        const delays = Array.from({length:12}, (_,i)=>gifFrameDelayCentiseconds(i,12));
        expect(delays.reduce((a,b)=>a+b,0)).toBe(100);
    });
    it('rejects mismatched frame dimensions', () => {
        const encoder = new IncrementalGifEncoder(3, 3);
        expect(() => encoder.addFrame({width:2,height:2,data:new Uint8ClampedArray(16)} as ImageData,8)).toThrow();
    });
    it('accepts a content-derived global color table with dithering', () => {
        // Flat red frames → palette carries that color; the palette path must
        // accept both plain and dithered frame mapping.
        const data = new Uint8ClampedArray(16);
        for (let i = 0; i < data.length; i += 4) {
            data[i] = 255;
            data[i + 3] = 255;
        }
        const red = { width: 2, height: 2, data } as ImageData;
        const palette = buildPalette([red]);
        expect(palette.colors).toContain(0xff0000);
        const encoder = new IncrementalGifEncoder(2, 2, palette);
        encoder.addFrame(red, 8);
        expect(() => encoder.addFrame(red, 8, { dither: true })).not.toThrow();
        // Both frames encoded: finish() succeeds (it throws only on zero frames).
        expect(encoder.finish().size).toBeGreaterThan(0);
    });
    it('preserves the legacy RGB332 path when no palette is supplied', () => {
        const encoder = new IncrementalGifEncoder(2, 2);
        const white = { width: 2, height: 2, data: new Uint8ClampedArray(16).fill(255) } as ImageData;
        expect(() => encoder.addFrame(white, 8, { dither: false })).not.toThrow();
    });
});
