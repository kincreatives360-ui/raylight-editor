import { describe, expect, it, vi } from 'vitest';
import { createCanvasFillStyle } from './canvasRenderer';

function context() {
    const gradient = { addColorStop: vi.fn() };
    const ctx = { createLinearGradient: vi.fn(() => gradient), createRadialGradient: vi.fn(() => gradient), createConicGradient: vi.fn(() => gradient), save: vi.fn(), restore: vi.fn(), translate: vi.fn(), rotate: vi.fn(), scale: vi.fn() };
    return { ctx, canvas: ctx as unknown as CanvasRenderingContext2D };
}
const fill = { kind: 'gradient' as const, angle: 90, stops: [{ at: 0, color: '#000000' }, { at: 1, color: '#ffffff' }], handles: { start: { x: .25, y: .5 }, end: { x: .75, y: .5 }, width: .2 } };
describe('gradient handle rendering', () => {
    it('keeps angular gradients conic when the center is moved', () => {
        const { ctx, canvas } = context();
        createCanvasFillStyle(canvas, { ...fill, gradientType: 'angular' }, 200, 100);
        expect(ctx.createConicGradient).toHaveBeenCalledWith(0, 50, 50);
        expect(ctx.createLinearGradient).not.toHaveBeenCalled();
    });
    it('renders elliptical radial gradients around the custom center', () => {
        const { ctx, canvas } = context();
        createCanvasFillStyle(canvas, { ...fill, gradientType: 'radial' }, 200, 100);
        expect(ctx.translate).toHaveBeenCalledWith(50, 50);
        expect(ctx.scale).toHaveBeenCalledWith(1, .2);
        expect(ctx.createRadialGradient).toHaveBeenCalledWith(0, 0, 0, 0, 0, 100);
        expect(ctx.restore).toHaveBeenCalledOnce();
    });
});
