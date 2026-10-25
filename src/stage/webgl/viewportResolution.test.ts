import { describe, expect, it } from 'vitest';
import { getViewportPixelRatio } from './viewportResolution';

describe('viewport resolution', () => {
  it('matches display density at fit and adds pixels for workspace zoom', () => {
    expect(getViewportPixelRatio(800, 450, 1, 1.25, 8192)).toBe(1.25);
    expect(getViewportPixelRatio(800, 450, 2, 1.25, 8192)).toBe(2.5);
    expect(getViewportPixelRatio(800, 450, 0.5, 1.25, 8192)).toBe(1.25);
  });

  it('bounds the drawing buffer to GPU and memory limits', () => {
    const ratio = getViewportPixelRatio(1920, 1080, 3.5, 3, 2048);
    expect(ratio * 1920).toBeLessThanOrEqual(2048);
    const large = getViewportPixelRatio(3840, 2160, 3.5, 3, 16384);
    expect(large * 3840).toBeLessThanOrEqual(8192);
    expect(large * 2160).toBeLessThanOrEqual(8192);
    // Scales dynamically with zoom on high-DPI displays up to the 8K limit
    expect(getViewportPixelRatio(1920, 1080, 2, 2, 16384)).toBe(4);
    // Respects custom maxBufferDimension override
    const capped = getViewportPixelRatio(3840, 2160, 3.5, 3, 16384, 4096);
    expect(capped * 3840).toBeLessThanOrEqual(4096);
  });
});
