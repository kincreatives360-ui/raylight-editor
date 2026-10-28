import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderProjectFrameToCanvas } from './canvasRenderer';
import { createDefaultProject } from '../model/defaults';
import type { EvaluatedProjectFrame } from './evaluateShot';
import { canvasPool } from './canvasPool';

describe('canvasRenderer true per-shot post-processing', () => {
  let origDoc: unknown;

  beforeEach(() => {
    canvasPool.clear();
    origDoc = (globalThis as unknown as { document?: unknown }).document;

    const mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      rotate: vi.fn(),
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      rect: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      resetTransform: vi.fn(),
      getImageData: vi.fn((_x: number, _y: number, w: number, h: number) => ({
        data: new Uint8ClampedArray(w * h * 4),
        width: w,
        height: h,
      })),
      putImageData: vi.fn(),
      createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    };

    (globalThis as unknown as { document?: unknown }).document = {
      createElement: vi.fn(() => ({
        width: 320,
        height: 180,
        getContext: vi.fn(() => mockCtx),
      })),
    };
  });

  afterEach(() => {
    canvasPool.clear();
    (globalThis as unknown as { document?: unknown }).document = origDoc;
  });

  it('applies per-shot post-processing independently to outgoing and incoming shots during transitions', async () => {
    const project = createDefaultProject();
    project.aspectRatio = '16:9';

    const outgoingFrame: EvaluatedProjectFrame = {
      globalTimeMs: 900,
      frameNumber: 54,
      activeShot: {
        ...project.shots[0],
        id: 'shot-1',
        name: 'Shot 1',
        startMs: 0,
        durationMs: 1000,
      },
      shotIndex: 0,
      shotLocalTimeMs: 900,
      shotProgress: 0.9,
      camera: {
        target: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        zoom: 1,
        fovDegrees: 27,
        focalLength: 50,
        activeMode: 'static',
      },
      layers: [],
      effects: {
        state: {
          ...project.shots[0].effects,
          vignette: { enabled: true, intensity: 0.8 },
        },
        orderedEnabledPasses: [
          { key: 'vignette', orderIndex: 0, summary: 'Vignette 80%' },
        ],
        deterministicSeed: 0.5,
      },
      shotTransition: {
        isTransitioning: false,
        type: 'crossfade',
        progress: 1,
      },
    };

    const incomingFrame: EvaluatedProjectFrame = {
      globalTimeMs: 1100,
      frameNumber: 66,
      activeShot: {
        ...project.shots[0],
        id: 'shot-2',
        name: 'Shot 2',
        startMs: 1000,
        durationMs: 2000,
      },
      shotIndex: 1,
      shotLocalTimeMs: 100,
      shotProgress: 0.05,
      camera: {
        target: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        zoom: 1,
        fovDegrees: 27,
        focalLength: 50,
        activeMode: 'static',
      },
      layers: [],
      effects: {
        state: {
          ...project.shots[0].effects,
          bloom: { enabled: true, intensity: 1.5, threshold: 0.2 },
        },
        orderedEnabledPasses: [
          { key: 'bloom', orderIndex: 0, summary: 'Bloom 150%' },
        ],
        deterministicSeed: 0.8,
      },
      shotTransition: {
        isTransitioning: true,
        type: 'crossfade',
        progress: 0.5,
        outgoingFrame,
      },
    };

    const targetCanvas = (globalThis as unknown as { document: { createElement: () => HTMLCanvasElement } }).document.createElement();
    targetCanvas.width = 320;
    targetCanvas.height = 180;
    const ctx = targetCanvas.getContext('2d')!;

    await renderProjectFrameToCanvas(ctx, project, incomingFrame, 320, 180);

    // Both outgoing buffer and incoming buffer should be drawn to destination ctx
    expect(ctx.drawImage).toHaveBeenCalledTimes(2);
    // Both outgoing effects and incoming effects should have called putImageData on their respective buffers
    expect(ctx.putImageData).toHaveBeenCalledTimes(2);
  });
});
