// src/ui/stageSkeletonLoader.test.tsx
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { StageSkeletonLoader } from './StageSkeletonLoader';

describe('StageSkeletonLoader Component (Detail 1)', () => {
  it('renders initial clean canvas placeholder before delay threshold', () => {
    // In static SSR rendering without timeout tick, shouldRender is false
    const html = renderToStaticMarkup(<StageSkeletonLoader delayMs={300} />);
    expect(html).toContain('bg-[var(--canvas-workspace,#080a10)]');
    expect(html).not.toContain('role="progressbar"');
  });
});
