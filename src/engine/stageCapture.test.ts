import { afterEach, expect, it, vi } from 'vitest';
import { captureStageFrame, getStageWebGLCanvas, registerStageCapture } from './stageCapture';

afterEach(() => vi.unstubAllGlobals());
it('selects the canvas inside the React Three Fiber wrapper', () => {
  const canvas = { tagName: 'CANVAS', width: 10, height: 10 };
  vi.stubGlobal('document', { getElementById: () => ({ tagName: 'DIV', querySelector: () => canvas }) });
  expect(getStageWebGLCanvas()).toBe(canvas);
});
it('uses the registered renderer at the exact requested time and dimensions', async () => {
  const canvas = {} as HTMLCanvasElement;
  const render = vi.fn(async () => canvas);
  const unregister = registerStageCapture(render);
  expect(await captureStageFrame(234, 3840, 2160)).toBe(canvas);
  expect(render).toHaveBeenCalledWith(234, 3840, 2160);
  unregister();
});
it('falls back to getStageWebGLCanvas when no custom capture renderer is registered', async () => {
  const canvas = { tagName: 'CANVAS', width: 1920, height: 1080 };
  vi.stubGlobal('document', { getElementById: () => ({ tagName: 'DIV', querySelector: () => canvas }) });
  expect(await captureStageFrame(100, 1920, 1080)).toBe(canvas);
});
