import { describe, expect, it } from 'vitest';
import {
  buildEasingCurvePoints,
  buildEasingCurveSvgPaths,
  buildLabelMaskImage,
  getEasingCurveSampleCount,
  getShotTimelineWidth,
} from './timelineBarGeometry';

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

  it('selects multi-resolution sample count matching Raylight e$t', () => {
    expect(getEasingCurveSampleCount(50)).toBe(24);
    expect(getEasingCurveSampleCount(72)).toBe(24);
    expect(getEasingCurveSampleCount(120)).toBe(48);
    expect(getEasingCurveSampleCount(200)).toBe(48);
    expect(getEasingCurveSampleCount(350)).toBe(96);
  });

  it('generates SVG stroke and translucent fill path closed with V300 H0 Z', () => {
    const { stroke, fill } = buildEasingCurveSvgPaths({ kind: 'preset', name: 'ease-out' }, 100);
    expect(stroke.startsWith('M0,')).toBe(true);
    expect(stroke).toContain(' L100,');
    expect(fill).toBe(`${stroke} V300 H0 Z`);

    // Normalized sample count handles fractional or non-finite counts
    const pathsFrac = buildEasingCurveSvgPaths({ kind: 'preset', name: 'ease-out' }, 100, 10.7);
    expect(pathsFrac.stroke.startsWith('M0,')).toBe(true);
    expect(pathsFrac.stroke.split(' ').length).toBe(10);

    const pathsNaN = buildEasingCurveSvgPaths({ kind: 'preset', name: 'ease-out' }, 100, Number.NaN);
    expect(pathsNaN.stroke.startsWith('M0,')).toBe(true);
  });

  it('generates label mask image gradient for legibility', () => {
    expect(buildLabelMaskImage(null, 100)).toBeUndefined();
    expect(buildLabelMaskImage('Rotation', 30)).toBeUndefined();

    const mask = buildLabelMaskImage('Rotation', 120);
    expect(mask).toBeDefined();
    expect(mask).toContain('linear-gradient(to right, #000');
    expect(mask).toContain('transparent');
  });
});
