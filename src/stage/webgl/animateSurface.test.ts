import { describe, expect, it, vi } from 'vitest';
import { drawMediaShimmer } from './mediaDecorations';
import { drawMediaFrame } from './mediaSurface';
import { evaluateProjectAtTime } from '../../engine/evaluateShot';
import { createDefaultImageLayer, createDefaultShot, DEFAULT_PROJECT } from '../../model/defaults';
const easing = { kind: 'preset', name: 'linear' } as const;
function context() { return { save: vi.fn(), restore: vi.fn(), fillRect: vi.fn(), clearRect: vi.fn(), drawImage: vi.fn(), filter: 'none', globalAlpha: 1, globalCompositeOperation: 'source-over', createLinearGradient: vi.fn(() => ({addColorStop: vi.fn()})) }; }
describe('Animated surface rendering', () => {
 it('applies color intensity width direction and preserves underlying surface alpha', () => {
  const ctx = context(); drawMediaShimmer(ctx as unknown as CanvasRenderingContext2D, 200, 100, .25, { color: '#ff0000', intensity: 2, width: .4, direction: 'up' });
  expect(ctx.createLinearGradient).toHaveBeenCalledWith(0, 65, 0, 105);
  expect(ctx.createLinearGradient.mock.results[0].value.addColorStop).toHaveBeenCalledWith(.5, '#ff0000');
  expect(ctx.globalAlpha).toBeCloseTo(.7); expect(ctx.globalCompositeOperation).toBe('source-atop'); expect(ctx.fillRect).toHaveBeenCalledWith(0,0,200,100);
 });
 it('draws nothing before and after shimmer', () => { const ctx = context(); for (const progress of [0, 1]) drawMediaShimmer(ctx as unknown as CanvasRenderingContext2D, 200, 100, progress); expect(ctx.fillRect).not.toHaveBeenCalled(); });
 it('feeds transition blur through shot evaluation into actual media canvas filtering', () => {
  const layer = createDefaultImageLayer({inMs:0,outMs:4000, entrance: {type:'blur',durationMs:1000,delayMs:0,distance:.2,easing,fade:false}, exit: {type:'none',durationMs:0,delayMs:0,distance:0,easing}});
  const frame = evaluateProjectAtTime({...DEFAULT_PROJECT,shots:[createDefaultShot({startMs:0,durationMs:4000,layers:[layer]})]},500);
  expect(frame.layers[0].totalBlurPx).toBeGreaterThanOrEqual(20);
  const ctx = context(); drawMediaFrame(ctx as unknown as CanvasRenderingContext2D,{} as CanvasImageSource,200,100,200,100,{fit:'stretch',blurPx:frame.layers[0].totalBlurPx});
  expect(ctx.filter).toMatch(/^blur\([1-9]/);
 });
});

