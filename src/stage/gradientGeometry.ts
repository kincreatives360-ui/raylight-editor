import { sampleStops } from '../engine/canvasRenderer';
import type { Fill, GradientStop } from '../model/types';
export type Point = {
    x: number;
    y: number;
};
export type Gradient = Extract<Fill, {
    kind: 'gradient';
}>;
export type Handles = NonNullable<Gradient['handles']>;
export const clampStop = (at: number) => Math.max(0, Math.min(1, at));
export const gradientAngle = (a: Point, b: Point) => (Math.atan2(b.x - a.x, a.y - b.y) * 180 / Math.PI + 360) % 360;
export const interpolatePoint = (a: Point, b: Point, at: number): Point => ({ x: a.x + (b.x - a.x) * at, y: a.y + (b.y - a.y) * at });
export function rotateHandles(handles: Handles, center: Point, radians: number): Handles {
    const rotate = (p: Point) => ({ x: center.x + (p.x - center.x) * Math.cos(radians) - (p.y - center.y) * Math.sin(radians), y: center.y + (p.x - center.x) * Math.sin(radians) + (p.y - center.y) * Math.cos(radians) });
    return { ...handles, start: rotate(handles.start), end: rotate(handles.end) };
}
export function mergeGradient(current: Gradient | undefined, next: Omit<Gradient, 'kind'>): Gradient {
    const fill: Gradient = { ...current, ...next, kind: 'gradient' };
    if (!current || (current.gradientType ?? 'linear') !== (next.gradientType ?? 'linear')) {
        delete fill.handles;
    } else if (current.handles && current.angle !== next.angle) {
        const center = ['radial', 'angular'].includes(next.gradientType ?? 'linear') ? current.handles.start : interpolatePoint(current.handles.start, current.handles.end, .5);
        fill.handles = rotateHandles(current.handles, center, (next.angle - current.angle) * Math.PI / 180);
    }
    return fill;
}
export function defaultHandles(fill: Gradient): Handles {
    if (fill.handles)
        return fill.handles;
    const rad = fill.angle * Math.PI / 180;
    const radial = fill.gradientType === 'radial' || fill.gradientType === 'angular';
    return { start: radial ? { x: .5, y: .5 } : { x: .5 - Math.sin(rad) / 2, y: .5 + Math.cos(rad) / 2 }, end: { x: .5 + Math.sin(rad) / 2, y: .5 - Math.cos(rad) / 2 } };
}
export function stopPosition(p: Point, a: Point, b: Point) {
    const dx = b.x - a.x, dy = b.y - a.y;
    return clampStop(((p.x - a.x) * dx + (p.y - a.y) * dy) / Math.max(.000001, dx * dx + dy * dy));
}
export function sampleStop(stops: GradientStop[], at: number): GradientStop {
    const [r, g, b, opacity] = sampleStops(stops, at);
    return { at, color: '#' + [r, g, b].map(c => Math.round(c).toString(16).padStart(2, '0')).join(''), opacity };
}
