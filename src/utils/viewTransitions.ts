// src/utils/viewTransitions.ts

/**
 * Runs a DOM state mutation wrapped in document.startViewTransition if supported
 * and if the user does not have prefers-reduced-motion enabled.
 * If unsupported or reduced motion is requested, executes the callback directly.
 */
export function withViewTransition(updateFn: () => void | Promise<void>): void {
  if (
    typeof document === 'undefined' ||
    !('startViewTransition' in document) ||
    typeof (document as unknown as { startViewTransition?: unknown }).startViewTransition !== 'function'
  ) {
    updateFn();
    return;
  }

  // Check reduced motion preference
  if (typeof window !== 'undefined' && window.matchMedia) {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      updateFn();
      return;
    }
  }

  try {
    (document as unknown as { startViewTransition: (cb: () => void | Promise<void>) => unknown }).startViewTransition(() => {
      return updateFn();
    });
  } catch {
    updateFn();
  }
}
