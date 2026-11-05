import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { canvasPool, acquireCanvas, releaseCanvas, withCanvas } from './canvasPool';

describe('Canvas Resource Pool', () => {
  let origDoc: unknown;

  beforeEach(() => {
    canvasPool.clear();
    origDoc = (globalThis as unknown as { document?: unknown }).document;

    const mockCtx = {
      resetTransform: vi.fn(),
      clearRect: vi.fn(),
      fillRect: vi.fn(),
    };

    (globalThis as unknown as { document?: unknown }).document = {
      createElement: vi.fn(() => ({
        width: 0,
        height: 0,
        getContext: vi.fn(() => mockCtx),
      })),
    };
  });

  afterEach(() => {
    canvasPool.clear();
    (globalThis as unknown as { document?: unknown }).document = origDoc;
  });

  it('acquires and resizes canvas on demand', () => {
    const c1 = acquireCanvas(320, 240);
    expect(c1).toBeDefined();
    expect(c1.width).toBe(320);
    expect(c1.height).toBe(240);

    releaseCanvas(c1);
    expect(canvasPool.size).toBe(1);

    const c2 = acquireCanvas(640, 480);
    expect(c2).toBe(c1); // Reused identical instance
    expect(c2.width).toBe(640);
    expect(c2.height).toBe(480);
  });

  it('safely handles withCanvas scope releasing', () => {
    let captured: HTMLCanvasElement | null = null;
    const res = withCanvas(100, 100, (canvas, ctx) => {
      captured = canvas;
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(0, 0, 10, 10);
      return 'success';
    });

    expect(res).toBe('success');
    expect(captured).toBeDefined();
    expect(canvasPool.size).toBe(1); // returned to pool automatically
  });

  it('limits pool size to prevent unbounded memory growth', () => {
    const canvases: HTMLCanvasElement[] = [];
    for (let i = 0; i < 40; i++) {
      canvases.push(acquireCanvas(50, 50));
    }
    for (const c of canvases) {
      releaseCanvas(c);
    }
    expect(canvasPool.size).toBeLessThanOrEqual(32);
  });
});
