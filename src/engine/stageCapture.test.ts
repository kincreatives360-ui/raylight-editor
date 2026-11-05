import { describe, expect, it, vi } from 'vitest';
import { captureStageFrame, registerStageCapture } from './stageCapture';

describe('stage capture', () => {
  it('forwards requested time and export dimensions to the live renderer', async () => {
    const canvas = {} as HTMLCanvasElement;
    const capture = vi.fn(async () => canvas);
    const unregister = registerStageCapture(capture);

    await expect(captureStageFrame(1250, 3840, 2160)).resolves.toBe(canvas);
    expect(capture).toHaveBeenCalledWith(1250, 3840, 2160);
    unregister();
  });

  it('returns null when no live renderer is registered instead of returning a potentially stale canvas', async () => {
    const canvas = {} as HTMLCanvasElement;
    const unregister = registerStageCapture(async () => canvas);
    unregister();
    await expect(captureStageFrame(0, 1920, 1080)).resolves.toBeNull();
  });
});
