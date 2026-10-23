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
});
