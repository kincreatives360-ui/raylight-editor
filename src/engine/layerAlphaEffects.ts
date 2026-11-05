import type { LayerEffects } from '../model/types';
import { acquireCanvas, releaseCanvas } from './canvasPool';
import { sampleFractalNoise } from '../model/proceduralNoise';

const clamp = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };
type KeyOptions = { color: string; similarity: number; softness: number; spill: number; invert: boolean };
type RoughOptions = { border: number; scale: number; sharpness: number; amount: number; seed: number; evolution: number; speed: number };

function rgb(color: string): number[] {
    const hex = color.replace('#', '');
    const full = hex.length === 3 ? [...hex].map(c => c + c).join('') : hex;
    return [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16) || 0);
}

/** RGB distance is normalized to the full color cube; original transparency is retained. */
export function applyColorKeyPixels(data: Uint8ClampedArray, options: KeyOptions): void {
    const key = rgb(options.color), mean = (key[0] + key[1] + key[2]) / 3;
    const chroma = key.map(c => c - mean), norm = chroma.reduce((n, c) => n + c * c, 0);
    for (let i = 0; i < data.length; i += 4) {
        const distance = Math.hypot(data[i] - key[0], data[i + 1] - key[1], data[i + 2] - key[2]) / (255 * Math.sqrt(3));
        const keep = options.softness > 0 ? smooth((distance - options.similarity) / options.softness) : Number(distance > options.similarity);
        data[i + 3] *= options.invert ? 1 - keep : keep;
        if (norm > 0 && options.spill > 0 && !options.invert) {
            const projection = Math.max(0, ((data[i] - mean) * chroma[0] + (data[i + 1] - mean) * chroma[1] + (data[i + 2] - mean) * chroma[2]) / norm);
            // Remove only the key's chromatic direction, preserving neutral luminance.
            const strength = options.spill * (1 - smooth((distance - options.similarity) / Math.max(.15, options.softness)));
            for (let c = 0; c < 3; c++) data[i + c] -= chroma[c] * projection * strength;
        }
    }
}

/** Distance to a transparent pixel, with the canvas boundary treated as transparent. */
export function alphaInteriorDistance(alpha: Uint8ClampedArray, width: number, height: number): Float32Array {
    const distance = new Float32Array(width * height);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const i = y * width + x;
        distance[i] = alpha[i] === 0 ? 0 : Math.min(x + 1, y + 1, width - x, height - y);
        if (x) distance[i] = Math.min(distance[i], distance[i - 1] + 1);
        if (y) distance[i] = Math.min(distance[i], distance[i - width] + 1);
        if (x && y) distance[i] = Math.min(distance[i], distance[i - width - 1] + Math.SQRT2);
        if (x + 1 < width && y) distance[i] = Math.min(distance[i], distance[i - width + 1] + Math.SQRT2);
    }
    for (let y = height - 1; y >= 0; y--) for (let x = width - 1; x >= 0; x--) {
        const i = y * width + x;
        if (x + 1 < width) distance[i] = Math.min(distance[i], distance[i + 1] + 1);
        if (y + 1 < height) distance[i] = Math.min(distance[i], distance[i + width] + 1);
        if (x + 1 < width && y + 1 < height) distance[i] = Math.min(distance[i], distance[i + width + 1] + Math.SQRT2);
        if (x && y + 1 < height) distance[i] = Math.min(distance[i], distance[i + width - 1] + Math.SQRT2);
    }
    return distance;
}

export function roughenAlpha(alpha: Uint8ClampedArray, width: number, height: number, options: RoughOptions, pixelsPerAuthorX = 1, pixelsPerAuthorY = 1, timeSeconds = 0): void {
    if (options.amount <= 0 || options.border <= 0) return;
    const distance = alphaInteriorDistance(alpha, width, height), border = options.border * Math.min(pixelsPerAuthorX, pixelsPerAuthorY);
    const phase = (options.evolution + options.speed * timeSeconds) * Math.PI / 180;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (!alpha[i] || distance[i] > border) continue;
        const n = sampleFractalNoise(x / pixelsPerAuthorX / Math.max(.1, options.scale) + Math.cos(phase), y / pixelsPerAuthorY / Math.max(.1, options.scale) + Math.sin(phase), 0, options.seed, 2);
        const cut = n * border * options.amount;
        const feather = Math.max(.15, (1 - options.sharpness) * border * .5);
        alpha[i] *= smooth((distance[i] - cut) / feather);
    }
}

export function applyLayerAlphaEffects(source: HTMLCanvasElement, effects: LayerEffects, authorWidth: number, authorHeight: number, timeSeconds = 0): void {
    const key = effects.colorKey, rough = effects.roughen;
    if (!key?.enabled && !rough?.enabled) return;
    // Key color edges need native pixels. Roughening is bounded, then multiplied onto the native artwork.
    const scale = key?.enabled ? 1 : Math.min(1, 1536 / Math.max(source.width, source.height));
    const work = acquireCanvas(source.width * scale, source.height * scale);
    try {
        const ctx = source.getContext('2d'), workCtx = work.getContext('2d', { willReadFrequently: true });
        if (!ctx || !workCtx) return;
        workCtx.drawImage(source, 0, 0, work.width, work.height);
        const image = workCtx.getImageData(0, 0, work.width, work.height);
        if (key?.enabled) applyColorKeyPixels(image.data, key);
        if (rough?.enabled) {
            const alpha = new Uint8ClampedArray(work.width * work.height);
            for (let i = 0; i < alpha.length; i++) alpha[i] = image.data[i * 4 + 3];
            roughenAlpha(alpha, work.width, work.height, rough, work.width / Math.max(1, authorWidth), work.height / Math.max(1, authorHeight), timeSeconds);
            for (let i = 0; i < alpha.length; i++) image.data[i * 4 + 3] = alpha[i];
        }
        if (scale < 1) {
            // Divide out the original alpha so resampling never squares translucent edges.
            const original = workCtx.getImageData(0, 0, work.width, work.height);
            for (let i = 3; i < image.data.length; i += 4) image.data[i] = original.data[i] ? image.data[i] / original.data[i] * 255 : 255;
        }
        workCtx.putImageData(image, 0, 0);
        ctx.save(); ctx.resetTransform(); ctx.globalAlpha = 1;
        if (scale === 1) { ctx.clearRect(0, 0, source.width, source.height); ctx.globalCompositeOperation = 'source-over'; }
        else ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(work, 0, 0, source.width, source.height); ctx.restore();
    } finally { releaseCanvas(work); }
}

interface MaskDrawing { x: number; y: number; width: number; height: number; color: string; opacity: number; }
export interface AlphaOutlineOptions extends MaskDrawing { radius: number; softness: number; placement: 'inside' | 'outside'; }
export interface LongShadowOptions extends MaskDrawing { length: number; angle: number; fade: number; blur?: number; spread?: number; offsetX?: number; offsetY?: number; }

function lineMaximum(input: Uint8ClampedArray, w: number, h: number, dx: number, dy: number, radius: number): Uint8ClampedArray {
    const output = new Uint8ClampedArray(input.length), indices = new Int32Array(Math.max(w, h)), queue = new Int32Array(Math.max(w, h));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const previousX = x - dx, previousY = y - dy;
        if (previousX >= 0 && previousX < w && previousY >= 0 && previousY < h) continue;
        let length = 0;
        for (let px = x, py = y; px >= 0 && px < w && py >= 0 && py < h; px += dx, py += dy) indices[length++] = py * w + px;
        let head = 0, tail = 0, next = 0;
        for (let p = 0; p < length; p++) {
            while (next <= Math.min(length - 1, p + radius)) {
                while (tail > head && input[indices[queue[tail - 1]]] <= input[indices[next]]) tail--;
                queue[tail++] = next++;
            }
            while (tail > head && queue[head] < p - radius) head++;
            output[indices[p]] = input[indices[queue[head]]];
        }
    }
    return output;
}

/** Exact small disks; larger disks use a rounded 16-sided kernel in eight O(pixels) passes. */
export function dilateAlpha(alpha: Uint8ClampedArray, w: number, h: number, radius: number): Uint8ClampedArray {
    if (radius <= 0) return alpha.slice();
    if (radius <= 8) {
        const out = new Uint8ClampedArray(alpha.length);
        for (let dy = -Math.floor(radius); dy <= Math.floor(radius); dy++) {
            const row = lineMaximum(alpha, w, h, 1, 0, Math.floor(Math.sqrt(radius * radius - dy * dy)));
            for (let y = Math.max(0, -dy); y < Math.min(h, h - dy); y++) for (let x = 0; x < w; x++) {
                const target = (y + dy) * w + x;
                out[target] = Math.max(out[target], row[y * w + x]);
            }
        }
        return out;
    }
    // These lattice directions approximate evenly spaced 22.5-degree generators.
    // Their Minkowski sum stays rounded while retaining every source alpha level.
    let out = alpha;
    for (const [dx, dy] of [[1, 0], [2, 1], [1, 1], [1, 2], [0, 1], [-1, 2], [-1, 1], [-2, 1]]) {
        const r = Math.round(radius * .1989 / Math.hypot(dx, dy));
        if (r) out = lineMaximum(out, w, h, dx, dy, r);
    }
    return out;
}

function drawMask(ctx: CanvasRenderingContext2D, source: HTMLCanvasElement, options: MaskDrawing, padding: number, limit: number, create: (alpha: Uint8ClampedArray, w: number, h: number, scale: number) => Uint8ClampedArray, blur = 0): void {
    const scale = Math.min(1, limit / Math.max(options.width + padding * 2, options.height + padding * 2));
    const pad = Math.ceil(padding * scale), w = Math.max(1, Math.round(options.width * scale) + pad * 2), h = Math.max(1, Math.round(options.height * scale) + pad * 2);
    const mask = acquireCanvas(w, h);
    try {
        const maskCtx = mask.getContext('2d', { willReadFrequently: true }); if (!maskCtx) return;
        maskCtx.drawImage(source, pad, pad, options.width * scale, options.height * scale);
        const image = maskCtx.getImageData(0, 0, w, h), alpha = new Uint8ClampedArray(w * h);
        for (let i = 0; i < alpha.length; i++) alpha[i] = image.data[i * 4 + 3];
        const result = create(alpha, w, h, scale);
        for (let i = 0; i < result.length; i++) { image.data[i * 4] = 255; image.data[i * 4 + 1] = 255; image.data[i * 4 + 2] = 255; image.data[i * 4 + 3] = result[i]; }
        maskCtx.putImageData(image, 0, 0);
        maskCtx.globalCompositeOperation = 'source-in'; maskCtx.fillStyle = options.color; maskCtx.fillRect(0, 0, w, h);
        ctx.save(); ctx.globalAlpha *= clamp(options.opacity); ctx.filter = blur > 0 ? `blur(${blur}px)` : 'none';
        ctx.drawImage(mask, options.x - pad / scale, options.y - pad / scale, w / scale, h / scale); ctx.restore();
    } finally { releaseCanvas(mask); }
}

export function drawAlphaOutline(ctx: CanvasRenderingContext2D, source: HTMLCanvasElement, options: AlphaOutlineOptions): void {
    if (options.radius <= 0 || options.opacity <= 0) return;
    drawMask(ctx, source, options, options.radius + options.softness * 3 + 2, 1536, (alpha, w, h, scale) => {
        const inverse = options.placement === 'inside';
        const input = inverse ? alpha.map(a => 255 - a) : alpha;
        const expanded = dilateAlpha(input, w, h, options.radius * scale);
        return expanded.map((a, i) => inverse ? Math.max(0, alpha[i] + a - 255) : Math.max(0, a - alpha[i]));
    }, options.softness);
}

export function drawLongShadow(ctx: CanvasRenderingContext2D, source: HTMLCanvasElement, options: LongShadowOptions): void {
    if (options.length <= 0 || options.opacity <= 0) return;
    drawMask(ctx, source, { ...options, x: options.x + (options.offsetX ?? 0), y: options.y + (options.offsetY ?? 0) }, options.length + Math.abs(options.spread ?? 0) + (options.blur ?? 0) * 3 + 2, 640, (alpha, w, h, scale) => {
        return longShadowAlpha(alpha, w, h, options, scale);
    }, options.blur);
}


export function longShadowAlpha(alpha: Uint8ClampedArray, w: number, h: number, options: Pick<LongShadowOptions, 'length' | 'angle' | 'fade' | 'spread'>, scale = 1): Uint8ClampedArray {
    const angle = options.angle * Math.PI / 180;
    const spread = (options.spread ?? 0) * scale;
    const mask = spread < 0 ? dilateAlpha(alpha.map(a => 255 - a), w, h, -spread).map(a => 255 - a) : spread > 0 ? dilateAlpha(alpha, w, h, spread) : alpha;
    const out = new Uint8ClampedArray(alpha.length), length = options.length * scale;
    let minX = w, minY = h, maxX = -1, maxY = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask[y * w + x]) {
        minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
    const steps = Math.max(1, Math.ceil(length));
    for (let step = 0; step <= steps; step++) {
        const t = step / steps, dx = Math.round(Math.cos(angle) * length * t), dy = Math.round(Math.sin(angle) * length * t), weight = 1 - clamp(options.fade) * t;
        for (let y = Math.max(minY, -dy); y <= Math.min(maxY, h - dy - 1); y++) for (let x = Math.max(minX, -dx); x <= Math.min(maxX, w - dx - 1); x++) {
            const from = y * w + x, to = (y + dy) * w + x + dx;
            out[to] = Math.max(out[to], mask[from] * weight);
        }
    }
    return out;
}
