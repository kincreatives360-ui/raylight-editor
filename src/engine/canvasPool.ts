/**
 * Studio-grade Canvas & Buffer Resource Pool
 * Eliminates garbage collector spikes and transient allocations during
 * 60fps playback, multi-shot transitions, and 4K exports.
 */

class CanvasResourcePool {
  private pool: HTMLCanvasElement[] = [];
  private maxPoolSize = 32;

  /**
   * Acquire an offscreen canvas with at least the requested dimensions.
   * If a pooled canvas is available, it is reset, resized if necessary, and returned.
   */
  acquire(width: number, height: number): HTMLCanvasElement {
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));

    const canvas =
      this.pool.pop() ||
      (typeof document !== 'undefined'
        ? document.createElement('canvas')
        : ({} as HTMLCanvasElement));

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    const ctx = canvas.getContext ? canvas.getContext('2d') : null;
    if (ctx) {
      ctx.resetTransform?.();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.filter = 'none';
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.clearRect(0, 0, w, h);
    }

    return canvas;
  }

  /**
   * Release a canvas back into the pool for future reuse.
   */
  release(canvas: HTMLCanvasElement | null | undefined): void {
    if (!canvas || !canvas.getContext || this.pool.length >= this.maxPoolSize) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.resetTransform?.();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    this.pool.push(canvas);
  }

  /**
   * Execute a callback with an acquired canvas, guaranteeing release upon completion or error.
   */
  withCanvas<T>(
    width: number,
    height: number,
    fn: (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => T
  ): T {
    const canvas = this.acquire(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      this.release(canvas);
      throw new Error('Failed to acquire 2D context from pooled canvas');
    }
    try {
      return fn(canvas, ctx);
    } finally {
      this.release(canvas);
    }
  }

  /**
   * Clear all pooled canvases (used for test teardown or memory flush).
   */
  clear(): void {
    this.pool.length = 0;
  }

  get size(): number {
    return this.pool.length;
  }
}

export const canvasPool = new CanvasResourcePool();
export const acquireCanvas = (width: number, height: number): HTMLCanvasElement =>
  canvasPool.acquire(width, height);
export const releaseCanvas = (canvas: HTMLCanvasElement | null | undefined): void =>
  canvasPool.release(canvas);
export const withCanvas = <T>(
  width: number,
  height: number,
  fn: (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => T
): T => canvasPool.withCanvas(width, height, fn);
