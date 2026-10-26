import { describe, expect, it } from 'vitest';
import { IncrementalGifEncoder, gifFrameDelayCentiseconds } from './gifEncoder';

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
});
