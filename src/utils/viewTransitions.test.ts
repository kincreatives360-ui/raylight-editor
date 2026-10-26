import { describe, it, expect, vi, afterEach } from 'vitest';
import { withViewTransition } from './viewTransitions';

describe('View Transitions Utility (Detail 9)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls callback directly when startViewTransition is unsupported', () => {
    const cb = vi.fn();
    withViewTransition(cb);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('uses document.startViewTransition when available', () => {
    const mockStartViewTransition = vi.fn((updateCb: () => void) => updateCb());
    vi.stubGlobal('document', { startViewTransition: mockStartViewTransition });
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });

    const cb = vi.fn();
    withViewTransition(cb);

    expect(mockStartViewTransition).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('preserves promise returned by updateFn in startViewTransition', async () => {
    let capturedCbResult: unknown;
    const mockStartViewTransition = vi.fn((updateCb: () => unknown) => {
      capturedCbResult = updateCb();
      return capturedCbResult;
    });
    vi.stubGlobal('document', { startViewTransition: mockStartViewTransition });
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });

    const promise: Promise<void> = Promise.resolve();
    withViewTransition(() => promise);

    expect(capturedCbResult).toBe(promise);
  });

  it('bypasses startViewTransition when prefers-reduced-motion is true', () => {
    const mockStartViewTransition = vi.fn((updateCb: () => void) => updateCb());
    vi.stubGlobal('document', { startViewTransition: mockStartViewTransition });
    vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) });

    const cb = vi.fn();
    withViewTransition(cb);

    expect(mockStartViewTransition).not.toHaveBeenCalled();
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
