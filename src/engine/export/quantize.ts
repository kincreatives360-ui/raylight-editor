/**
 * Median-cut color quantization with optional Floyd–Steinberg dithering.
 *
 * Replaces the legacy fixed RGB332 palette (8 levels per channel, banding on
 * gradients) with a 256-color palette derived from the actual content, which
 * is what animated-GIF export needs to look acceptable.
 */

export interface Palette {
    /** Palette entries as packed 0xRRGGBB. */
    colors: number[];
    /** Nearest palette index per rgb(5,5,5) key — lazily filled cache. */
    readonly lookup: Int16Array;
}

const LOOKUP_SIZE = 32 * 32 * 32;

function rgbKey(r: number, g: number, b: number): number {
    return ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
}

function distanceSq(r1: number, g1: number, b1: number, packed: number): number {
    const r2 = (packed >> 16) & 0xff;
    const g2 = (packed >> 8) & 0xff;
    const b2 = packed & 0xff;
    const dr = r1 - r2;
    const dg = g1 - g2;
    const db = b1 - b2;
    // Luma-weighted distance prioritizes perceived error over chroma error.
    return 2 * dr * dr + 4 * dg * dg + 3 * db * db;
}

/** Nearest palette index for an RGB color, with a 32³ memoization cache. */
export function nearestIndex(palette: Palette, r: number, g: number, b: number): number {
    const key = rgbKey(r, g, b);
    const cached = palette.lookup[key];
    if (cached >= 0) return cached;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < palette.colors.length; i++) {
        const dist = distanceSq(r, g, b, palette.colors[i]);
        if (dist < bestDist) {
            bestDist = dist;
            best = i;
        }
    }
    palette.lookup[key] = best;
    return best;
}

interface RgbPixel {
    r: number;
    g: number;
    b: number;
}

interface ColorBox {
    pixels: RgbPixel[];
    rMin: number; rMax: number;
    gMin: number; gMax: number;
    bMin: number; bMax: number;
}

function boxExtent(box: ColorBox): { channel: 'r' | 'g' | 'b'; span: number } {
    const rSpan = box.rMax - box.rMin;
    const gSpan = box.gMax - box.gMin;
    const bSpan = box.bMax - box.bMin;
    if (gSpan >= rSpan && gSpan >= bSpan) return { channel: 'g', span: gSpan };
    if (rSpan >= bSpan) return { channel: 'r', span: rSpan };
    return { channel: 'b', span: bSpan };
}

function makeBox(pixels: RgbPixel[]): ColorBox {
    let rMin = 255, rMax = 0, gMin = 255, gMax = 0, bMin = 255, bMax = 0;
    for (const p of pixels) {
        if (p.r < rMin) rMin = p.r;
        if (p.r > rMax) rMax = p.r;
        if (p.g < gMin) gMin = p.g;
        if (p.g > gMax) gMax = p.g;
        if (p.b < bMin) bMin = p.b;
        if (p.b > bMax) bMax = p.b;
    }
    return { pixels, rMin, rMax, gMin, gMax, bMin, bMax };
}

function boxAverage(box: ColorBox): number {
    let r = 0, g = 0, b = 0;
    for (const p of box.pixels) {
        r += p.r;
        g += p.g;
        b += p.b;
    }
    const n = box.pixels.length || 1;
    return (
        (Math.round(r / n) << 16) |
        (Math.round(g / n) << 8) |
        Math.round(b / n)
    );
}

/**
 * Builds a palette of up to `maxColors` entries from sampled RGBA data using
 * median cut. Pixels are subsampled so a handful of frames stays cheap.
 */
export function buildPalette(
    frames: ImageData[],
    maxColors = 256,
    maxSamples = 60000
): Palette {
    if (maxColors < 2 || maxColors > 256) {
        throw new RangeError(`maxColors must be in [2, 256], got ${maxColors}`);
    }
    const totalPixels = frames.reduce((sum, f) => sum + f.width * f.height, 0);
    if (totalPixels === 0) {
        return { colors: [0x000000, 0xffffff], lookup: new Int16Array(LOOKUP_SIZE).fill(-1) };
    }
    const stride = Math.max(1, Math.floor(totalPixels / maxSamples));

    const pixels: RgbPixel[] = [];
    let seen = 0;
    for (const frame of frames) {
        const data = frame.data;
        for (let i = 0; i < data.length; i += 4) {
            if (seen++ % stride !== 0) continue;
            pixels.push({ r: data[i], g: data[i + 1], b: data[i + 2] });
        }
    }
    if (pixels.length === 0) {
        pixels.push({ r: 0, g: 0, b: 0 });
    }

    // Median-cut split loop.
    const boxes: ColorBox[] = [makeBox(pixels)];
    while (boxes.length < maxColors) {
        // Pick the box with the largest extent (weighted by pixel count to
        // prefer visibly significant regions).
        let target = -1;
        let targetScore = 0;
        for (let i = 0; i < boxes.length; i++) {
            const box = boxes[i];
            if (box.pixels.length < 2) continue;
            const { span } = boxExtent(box);
            const score = span * Math.log2(1 + box.pixels.length);
            if (score > targetScore) {
                targetScore = score;
                target = i;
            }
        }
        if (target < 0) break;

        const box = boxes[target];
        const { channel } = boxExtent(box);
        box.pixels.sort((a, b) => a[channel] - b[channel]);
        const mid = box.pixels.length >> 1;
        boxes.splice(
            target,
            1,
            makeBox(box.pixels.slice(0, mid)),
            makeBox(box.pixels.slice(mid))
        );
    }

    const colors = boxes
        .filter((box) => box.pixels.length > 0)
        .map(boxAverage);
    if (colors.length < 2) colors.push(0xffffff);

    return { colors, lookup: new Int16Array(LOOKUP_SIZE).fill(-1) };
}

/**
 * Maps RGBA pixels to palette indices. With `dither`, applies Floyd–Steinberg
 * error diffusion, which removes banding on gradients at the cost of noise.
 */
export function mapToIndices(
    frame: ImageData,
    palette: Palette,
    dither: boolean
): Uint8Array {
    const { width, height, data } = frame;
    const indices = new Uint8Array(width * height);
    const paletteLen = palette.colors.length;

    if (!dither) {
        for (let i = 0; i < indices.length; i++) {
            const j = i * 4;
            indices[i] = nearestIndex(palette, data[j], data[j + 1], data[j + 2]);
        }
        return indices;
    }

    // Error-diffusion over a float copy so rounding errors don't accumulate.
    const work = new Float32Array(width * height * 3);
    for (let i = 0; i < width * height; i++) {
        work[i * 3] = data[i * 4];
        work[i * 3 + 1] = data[i * 4 + 1];
        work[i * 3 + 2] = data[i * 4 + 2];
    }

    const spread = (
        x: number, y: number, er: number, eg: number, eb: number, weight: number
    ): void => {
        if (x < 0 || x >= width || y >= height) return;
        const k = (y * width + x) * 3;
        work[k] += er * weight;
        work[k + 1] += eg * weight;
        work[k + 2] += eb * weight;
    };

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const k = (y * width + x) * 3;
            const r = Math.max(0, Math.min(255, Math.round(work[k])));
            const g = Math.max(0, Math.min(255, Math.round(work[k + 1])));
            const b = Math.max(0, Math.min(255, Math.round(work[k + 2])));
            const index = nearestIndex(palette, r, g, b);
            indices[y * width + x] = index;
            if (index >= paletteLen) continue;
            const packed = palette.colors[index];
            const er = r - ((packed >> 16) & 0xff);
            const eg = g - ((packed >> 8) & 0xff);
            const eb = b - (packed & 0xff);
            spread(x + 1, y, er, eg, eb, 7 / 16);
            spread(x - 1, y + 1, er, eg, eb, 3 / 16);
            spread(x, y + 1, er, eg, eb, 5 / 16);
            spread(x + 1, y + 1, er, eg, eb, 1 / 16);
        }
    }

    return indices;
}

/** Palette entries as flat RGB triples for GIF color tables. */
export function paletteToColorTable(palette: Palette, size = 256): Uint8Array {
    const table = new Uint8Array(size * 3);
    for (let i = 0; i < size; i++) {
        const packed = palette.colors[i % palette.colors.length];
        table[i * 3] = (packed >> 16) & 0xff;
        table[i * 3 + 1] = (packed >> 8) & 0xff;
        table[i * 3 + 2] = packed & 0xff;
    }
    return table;
}
