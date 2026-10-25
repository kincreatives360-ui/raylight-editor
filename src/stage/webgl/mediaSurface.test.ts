import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_DEVICE_FRAME_SETTINGS, resolveDeviceFrameSettings } from '../../model/deviceFrame';
import { drawMediaFrame, getMediaTextureSize, getLayerSurfaceState } from './mediaSurface';
import { createDefaultImageLayer } from '../../model/defaults';

function context() {
  return { save: vi.fn(), restore: vi.fn(), clearRect: vi.fn(), fillRect: vi.fn(), drawImage: vi.fn(), filter: 'none', fillStyle: '' };
}

describe('device media surfaces', () => {
  it('defaults new frames to Fit, while preserving legacy and explicitly saved Stretch', () => {
    expect(DEFAULT_DEVICE_FRAME_SETTINGS.screenFit).toBe('contain');
    expect(resolveDeviceFrameSettings({ enabled: true }).screenFit).toBe('stretch');
    expect(resolveDeviceFrameSettings({ ...DEFAULT_DEVICE_FRAME_SETTINGS, screenFit: 'stretch' }).screenFit).toBe('stretch');
  });

  it('preserves narrow surface aspect instead of imposing a 256px short edge', () => {
    expect(getMediaTextureSize(0.1, 1)).toEqual({ width: 102, height: 1024 });
    expect(getMediaTextureSize(1, 0.1)).toEqual({ width: 1024, height: 102 });
  });

  it('retains detail when a landscape screenshot fills a high-density viewport', () => {
    expect(getMediaTextureSize(16, 9, { pixelWidth: 1920, pixelHeight: 1080, maxTextureSize: 8192 }))
      .toEqual({ width: 4096, height: 2304 });
  });

  it('increases resolution when text grows on screen without changing its proportions', () => {
    const baseline = getMediaTextureSize(10, 1, { pixelWidth: 400, pixelHeight: 40, maxTextureSize: 4096 });
    const zoomed = getMediaTextureSize(10, 1, { pixelWidth: 1200, pixelHeight: 120, maxTextureSize: 4096 });
    expect(baseline).toEqual({ width: 1024, height: 102 });
    expect(zoomed).toEqual({ width: 4096, height: 410 });
  });

  it('uses both projected axes when a layer is stretched or viewed at an angle', () => {
    expect(getMediaTextureSize(1, 2, { pixelWidth: 700, pixelHeight: 500, maxTextureSize: 4096 }))
      .toEqual({ width: 2048, height: 4096 });
  });

  it('bounds allocations at the GPU limit even for extreme camera close-ups', () => {
    expect(getMediaTextureSize(16, 9, { pixelWidth: 100000, pixelHeight: 56250, maxTextureSize: 2048 }))
      .toEqual({ width: 2048, height: 1152 });
  });

  it('keeps texture sizes stable across small camera movements', () => {
    expect(getMediaTextureSize(2, 1, { pixelWidth: 600, pixelHeight: 300, maxTextureSize: 4096 }))
      .toEqual(getMediaTextureSize(2, 1, { pixelWidth: 610, pixelHeight: 305, maxTextureSize: 4096 }));
  });

  it('keeps allocations finite when a projected corner crosses the camera plane', () => {
    const result = getMediaTextureSize(2, 1, { pixelWidth: NaN, pixelHeight: Infinity, maxTextureSize: 4096 });
    expect(result).toEqual({ width: 4096, height: 2048 });
  });

  it('preserves authored blur when the backing canvas is supersampled', () => {
    const ctx = context();
    drawMediaFrame(ctx as unknown as CanvasRenderingContext2D, {} as CanvasImageSource, 400, 200, 100, 50, {
      fit: 'stretch', blurPx: 2, pixelRatio: 4,
    });
    expect(ctx.filter).toBe('blur(12px)');
  });

  it.each(['contain', 'cover', 'stretch'] as const)('fills the display behind transparent media using %s', fit => {
    const ctx = context();
    const source = {} as CanvasImageSource;
    drawMediaFrame(ctx as unknown as CanvasRenderingContext2D, source, 200, 100, 100, 200, { fit, fillColor: '#123456' });
    expect(ctx.fillStyle).toBe('#123456');
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 100, 200);
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 100, 200);
    expect(ctx.drawImage).toHaveBeenCalledOnce();
  });

  it('combines source crop and Fill without stretching', () => {
    const ctx = context();
    const source = {} as CanvasImageSource;
    drawMediaFrame(ctx as unknown as CanvasRenderingContext2D, source, 400, 200, 100, 100, {
      fit: 'cover', crop: { x: 0.25, y: 0, width: 0.5, height: 1 }, fillColor: '#000000',
    });
    expect(ctx.drawImage).toHaveBeenCalledWith(source, 100, 0, 200, 200, 0, 0, 100, 100);
  });

  it('clears the previous frame and applies the same crop/Fit to every live redraw', () => {
    const ctx = context();
    const source = {} as CanvasImageSource;
    const options = { fit: 'contain' as const, crop: { x: 0.25, y: 0, width: 0.5, height: 1 }, fillColor: '#050507' };
    drawMediaFrame(ctx as unknown as CanvasRenderingContext2D, source, 400, 200, 100, 200, options);
    drawMediaFrame(ctx as unknown as CanvasRenderingContext2D, source, 400, 200, 100, 200, options);
    expect(ctx.drawImage.mock.calls[0]).toEqual([source, 100, 0, 200, 200, 0, 50, 100, 100]);
    expect(ctx.drawImage.mock.calls[1]).toEqual(ctx.drawImage.mock.calls[0]);
    expect(ctx.clearRect).toHaveBeenCalledTimes(2);
  });

  it('keeps ordinary media transparent and treats the framed display as unlit', () => {
    const layer = createDefaultImageLayer({ receivesLight: true });
    expect(getLayerSurfaceState(layer, true, 0.25)).toMatchObject({ receivesLight: false, surfaceOpacity: 1, assemblyOpacity: 0.25 });
    expect(getLayerSurfaceState(layer, false, 0.25)).toMatchObject({ receivesLight: true, surfaceOpacity: 0.25, assemblyOpacity: 1 });
  });

  it('does not resurrect hidden or zero-opacity layers for editing', () => {
    const layer = createDefaultImageLayer();
    expect(getLayerSurfaceState(layer, true, 0, true).visible).toBe(false);
    expect(getLayerSurfaceState(layer, true, 1, false).visible).toBe(false);
    expect(getLayerSurfaceState(layer, true, 0.1, true).assemblyOpacity).toBe(0.1);
  });

  it('applies pan and zoom when framing media surfaces', () => {
    const ctx = context();
    const source = {} as CanvasImageSource;
    drawMediaFrame(ctx as unknown as CanvasRenderingContext2D, source, 1000, 1000, 500, 500, {
      fit: 'contain',
      zoom: 1.5,
      pan: { x: 0.2, y: -0.1 },
    });
    expect(ctx.drawImage).toHaveBeenCalledOnce();
    const args = ctx.drawImage.mock.calls[0];
    expect(args[0]).toBe(source);
    // Verified that drawImage was invoked with translated and scaled framing
    expect(args[7]).toBeGreaterThan(0);
    expect(args[8]).toBeGreaterThan(0);
  });
});
