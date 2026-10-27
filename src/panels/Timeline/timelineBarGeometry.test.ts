import { describe, expect, it } from 'vitest';
import { buildEasingCurvePoints, getShotTimelineWidth } from './timelineBarGeometry';

describe('timeline bar geometry', () => {
  it('ends the Add layer lane at the open shot duration', () => {
    expect(getShotTimelineWidth(4000, 0.14)).toBe(560);
  });

  it('builds an easing path with normalized endpoints and samples', () => {
    const points = buildEasingCurvePoints({ kind: 'preset', name: 'ease-in-cubic' }, 5);
    expect(points).toHaveLength(5);
    expect(points[0]).toEqual({ x: 0, y: 14 });
    expect(points[4]).toEqual({ x: 100, y: 2 });
    expect(points[2].y).toBeGreaterThan(8);
  });
});
