import { describe, expect, it } from 'vitest';
import { FillSchema } from './schema';
import { sampleLayerGradient } from '../engine/canvasRenderer';

describe('layer gradient fill schema', () => {
  const stops = [{ at: 0, color: '#000000' }, { at: 1, color: '#ffffff' }];

  it.each(['angular', 'diamond'])('accepts %s stops', (gradientType) => {
    expect(FillSchema.parse({ kind: 'gradient', angle: 30, stops, gradientType })).toMatchObject({ gradientType });
  });

  it('round-trips a complete 3×3 mesh gradient', () => {
    const mesh = Array.from({ length: 9 }, (_, i) => ({
      x: (i % 3) / 2, y: Math.floor(i / 3) / 2, color: `#${i.toString(16).padStart(6, '0')}`, opacity: 1,
    }));
    const fill = { kind: 'gradient', angle: 0, stops, gradientType: 'mesh', mesh };
    expect(FillSchema.parse(JSON.parse(JSON.stringify(fill)))).toEqual(fill);
  });

  it('rejects incomplete or out-of-range mesh control points', () => {
    expect(FillSchema.safeParse({ kind: 'gradient', angle: 0, stops, gradientType: 'mesh', mesh: [] }).success).toBe(false);
    expect(FillSchema.safeParse({ kind: 'gradient', angle: 0, stops, gradientType: 'mesh', mesh: Array.from({ length: 9 }, () => ({ x: 2, y: 0, color: '#000', opacity: 1 })) }).success).toBe(false);
  });

  it('continues to accept legacy linear and radial gradients', () => {
    const legacy = FillSchema.parse({ kind: 'gradient', angle: 45, stops });
    const radial = FillSchema.parse({ kind: 'gradient', angle: 45, stops, gradientType: 'radial' });
    expect(legacy.kind === 'gradient' && legacy.gradientType).toBeUndefined();
    expect(radial.kind === 'gradient' && radial.gradientType).toBe('radial');
  });

  it('samples angular, diamond and mesh colors deterministically', () => {
    const angular = { kind: 'gradient' as const, angle: 0, gradientType: 'angular' as const, stops: [{ at: 0, color: '#ff0000' }, { at: 1, color: '#0000ff' }] };
    expect(sampleLayerGradient(angular, 0.5, 0.5)).toHaveLength(4);
    const diamond = { ...angular, gradientType: 'diamond' as const };
    expect(sampleLayerGradient(diamond, 0.5, 0.5).slice(0, 3)).toEqual([255, 0, 0]);
    const mesh = Array.from({ length: 9 }, (_, i) => ({ x: (i % 3) / 2, y: Math.floor(i / 3) / 2, color: i === 4 ? '#00ff00' : '#000000', opacity: 1 }));
    expect(sampleLayerGradient({ ...angular, gradientType: 'mesh', mesh }, 0.5, 0.5)).toEqual([0, 255, 0, 1]);
  });
});
