import { describe, expect, it } from 'vitest';
import { alphaInteriorDistance, applyColorKeyPixels, roughenAlpha } from './layerAlphaEffects';

const key = { color: '#00ff00', similarity: .05, softness: .1, spill: 0, invert: false };
const rough = { border: 4, scale: 2, sharpness: .8, amount: 1, seed: 42, evolution: 0, speed: 30 };

describe('color key', () => {
    it('removes the selected background and retains original subject transparency', () => {
        const pixels = new Uint8ClampedArray([0, 255, 0, 255, 255, 0, 0, 100, 0, 255, 0, 0]);
        applyColorKeyPixels(pixels, key);
        expect([...pixels.filter((_, i) => i % 4 === 3)]).toEqual([0, 100, 0]);
    });
    it('softens threshold edges and inverts only the key mask', () => {
        const normal = new Uint8ClampedArray([0, 220, 0, 120]), inverse = normal.slice();
        applyColorKeyPixels(normal, key); applyColorKeyPixels(inverse, { ...key, invert: true });
        expect(normal[3]).toBeGreaterThan(0); expect(normal[3]).toBeLessThan(120);
        expect(Math.abs(normal[3] + inverse[3] - 120)).toBeLessThanOrEqual(1);
    });
    it('suppresses blue spill without treating blue as green', () => {
        const pixels = new Uint8ClampedArray([70, 70, 230, 255]);
        applyColorKeyPixels(pixels, { ...key, color: '#0000ff', similarity: .2, softness: .2, spill: 1 });
        expect(pixels[2] - pixels[0]).toBeLessThan(160);
        expect(pixels[0]).toBe(pixels[1]);
    });
});

describe('roughened alpha', () => {
    it('measures holes and the canvas boundary as contour edges', () => {
        const alpha = new Uint8ClampedArray(81).fill(255); alpha[40] = 0;
        const distance = alphaInteriorDistance(alpha, 9, 9);
        expect(distance[40]).toBe(0); expect(distance[39]).toBe(1); expect(distance[0]).toBe(1);
        expect(distance[20]).toBeGreaterThan(2);
    });
    it('distresses only the silhouette border, preserving the fully opaque center', () => {
        const alpha = new Uint8ClampedArray(400).fill(255);
        roughenAlpha(alpha, 20, 20, rough);
        expect(alpha[210]).toBe(255);
        expect([...alpha.slice(0, 20)].some(a => a < 255)).toBe(true);
    });
    it('is deterministic per seed and evolves continuously with playback time', () => {
        const make = (seed: number, time = 0) => { const alpha = new Uint8ClampedArray(400).fill(255); roughenAlpha(alpha, 20, 20, { ...rough, seed }, 1, 1, time); return alpha; };
        expect(make(42)).toEqual(make(42)); expect(make(42)).not.toEqual(make(17)); expect(make(42)).not.toEqual(make(42, 1));
    });
    it('retains partial transparency and leaves disabled roughening unchanged', () => {
        const alpha = new Uint8ClampedArray(400).fill(90), disabled = alpha.slice();
        roughenAlpha(alpha, 20, 20, rough);
        expect(alpha[210]).toBe(90); expect(Math.max(...alpha)).toBeLessThanOrEqual(90);
        roughenAlpha(disabled, 20, 20, { ...rough, amount: 0 }); expect(disabled.every(a => a === 90)).toBe(true);
    });
});

describe('long shadow alpha union', () => {
    it('does not darken overlapping translucent source copies', async () => {
        const { longShadowAlpha } = await import('./layerAlphaEffects');
        const alpha = new Uint8ClampedArray([0, 100, 100, 0, 0, 0]);
        expect([...longShadowAlpha(alpha, 6, 1, { length: 2, angle: 0, fade: 0 })]).toEqual([0, 100, 100, 100, 100, 0]);
    });
    it('fades toward the far end and follows the chosen angle', async () => {
        const { longShadowAlpha } = await import('./layerAlphaEffects');
        const alpha = new Uint8ClampedArray([0, 200, 0, 0, 0]);
        expect([...longShadowAlpha(alpha, 5, 1, { length: 2, angle: 0, fade: 1 })]).toEqual([0, 200, 100, 0, 0]);
        expect([...longShadowAlpha(alpha, 1, 5, { length: 2, angle: 90, fade: 0 })]).toEqual([0, 200, 200, 200, 0]);
    });
});

describe('rounded alpha dilation', () => {
    it('uses a circular boundary rather than square corners for narrow outlines', async () => {
        const { dilateAlpha } = await import('./layerAlphaEffects');
        const source = new Uint8ClampedArray(21 * 21); source[10 * 21 + 10] = 90;
        const out = dilateAlpha(source, 21, 21, 5);
        expect(out[14 * 21 + 13]).toBe(90);
        expect(out[14 * 21 + 14]).toBe(0);
        expect(out[10 * 21 + 15]).toBe(90);
        expect(Math.max(...out)).toBe(90);
    });
    it('keeps large outlines rounded and symmetric across the diagonals', async () => {
        const { dilateAlpha } = await import('./layerAlphaEffects');
        const w = 101, c = 50, source = new Uint8ClampedArray(w * w); source[c * w + c] = 255;
        const out = dilateAlpha(source, w, w, 30);
        expect(out[(c + 20) * w + c + 20]).toBe(255);
        expect(out[(c + 27) * w + c + 27]).toBe(0);
        for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
            expect(out[y * w + x]).toBe(out[x * w + y]);
            expect(out[y * w + x]).toBe(out[y * w + w - x - 1]);
        }
    });
});
