import { describe, it, expect, vi } from 'vitest';
import { withViewTransition } from './viewTransitions';

describe('View Transitions Utility (Detail 9)', () => {
  it('calls callback directly when startViewTransition is unsupported', () => {
    const cb = vi.fn();
    withViewTransition(cb);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('uses document.startViewTransition when available', () => {
    const mockStartViewTransition = vi.fn((updateCb: () => void) => updateCb());
    Object.defineProperty(globalThis, 'document', {
      value: { startViewTransition: mockStartViewTransition },
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, 'window', {
      value: { matchMedia: () => ({ matches: false }) },
      configurable: true,
      writable: true,
    });

    const cb = vi.fn();
    withViewTransition(cb);

    expect(mockStartViewTransition).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('bypasses startViewTransition when prefers-reduced-motion is true', () => {
    const mockStartViewTransition = vi.fn((updateCb: () => void) => updateCb());
    Object.defineProperty(globalThis, 'document', {
      value: { startViewTransition: mockStartViewTransition },
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, 'window', {
      value: { matchMedia: () => ({ matches: true }) },
      configurable: true,
      writable: true,
    });

    const cb = vi.fn();
    withViewTransition(cb);

    expect(mockStartViewTransition).not.toHaveBeenCalled();
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
