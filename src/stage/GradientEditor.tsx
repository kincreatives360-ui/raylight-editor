import React, { useEffect, useRef, useState } from 'react';
import { ColorPicker } from '../panels/Inspector/ColorPicker';
import { ScrubInput } from '../ui/ScrubInput';
import { clampStop, defaultHandles, gradientAngle, interpolatePoint, rotateHandles, sampleStop, stopPosition, type Gradient, type Handles, type Point } from './gradientGeometry';
type Mode = 'move' | 'rotate' | 'start' | 'end' | 'radius' | 'stop';
type Drag = {
    pointer: number;
    mode: Mode;
    index: number;
    origin: Point;
    client: Point;
    fill: Gradient;
    handles: Handles;
    moved: boolean;
    remove: boolean;
};
export function GradientEditor({ fill, corners, width, height, onChange, begin, commit }: {
    fill: Gradient;
    corners: Point[];
    width: number;
    height: number;
    onChange: (fill: Gradient) => void;
    begin: () => void;
    commit: () => void;
}) {
    const [selected, setSelected] = useState<number | null>(null);
    const drag = useRef<Drag | null>(null);
    const latest = useRef({ fill, onChange, commit });
    useEffect(() => { latest.current = { fill, onChange, commit }; }, [fill, onChange, commit]);
    const handles = defaultHandles(fill);
    const origin = corners[0], u = { x: corners[1].x - origin.x, y: corners[1].y - origin.y }, v = { x: corners[3].x - origin.x, y: corners[3].y - origin.y };
    const project = (p: Point) => ({ x: origin.x + u.x * p.x + v.x * p.y, y: origin.y + u.y * p.x + v.y * p.y });
    const local = (p: Point) => {
        const det = u.x * v.y - u.y * v.x;
        if (Math.abs(det) < .000001)
            return { x: .5, y: .5 };
        const x = p.x - origin.x, y = p.y - origin.y;
        return { x: (x * v.y - y * v.x) / det, y: (y * u.x - x * u.y) / det };
    };
    const radial = fill.gradientType === 'radial', angular = fill.gradientType === 'angular';
    const start = project(handles.start), end = project(handles.end);
    const point = (at: number) => angular ? project({ x: handles.start.x + Math.cos((fill.angle - 90 + at * 360) * Math.PI / 180) * Math.hypot(handles.end.x - handles.start.x, handles.end.y - handles.start.y), y: handles.start.y + Math.sin((fill.angle - 90 + at * 360) * Math.PI / 180) * Math.hypot(handles.end.x - handles.start.x, handles.end.y - handles.start.y) }) : interpolatePoint(start, end, at);
    const pointer = (e: React.PointerEvent<SVGSVGElement>) => { const matrix = e.currentTarget.getScreenCTM(); return matrix ? new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse()) : { x: 0, y: 0 }; };
    const changeHandles = (next: Handles, base = fill) => onChange({ ...base, handles: next, angle: gradientAngle(next.start, next.end) });
    const changeStop = (index: number, patch: Partial<Gradient['stops'][number]>) => onChange({ ...fill, handles, stops: fill.stops.map((s, i) => i === index ? { ...s, ...patch } : s) });
    const removeStop = (index: number) => { if (fill.stops.length <= 2)
        return; onChange({ ...fill, stops: fill.stops.filter((_, i) => i !== index) }); setSelected(null);  };
    const stopAt = (p: Point) => angular ? ((Math.atan2(local(p).y - handles.start.y, local(p).x - handles.start.x) * 180 / Math.PI - fill.angle + 90 + 720) % 360) / 360 : stopPosition(p, start, end);
    const addStop = (at: number) => { const stops = [...fill.stops, sampleStop(fill.stops, at)]; onChange({ ...fill, handles, stops }); setSelected(stops.length - 1); };
    useEffect(() => {
        const endDrag = () => { if (drag.current) {
            drag.current = null;
            latest.current.commit();
        } };
        window.addEventListener('blur', endDrag);
        return () => { window.removeEventListener('blur', endDrag); endDrag(); };
    }, []);
    const finish = (e: React.PointerEvent<SVGSVGElement>, cancelled = false) => {
        const state = drag.current;
        if (!state || state.pointer !== e.pointerId)
            return;
        drag.current = null;
        if (e.currentTarget.hasPointerCapture(e.pointerId))
            e.currentTarget.releasePointerCapture(e.pointerId);
        if (cancelled)
            onChange(state.fill);
        else if (state.remove)
            removeStop(state.index);
        else if (!state.moved && state.mode === 'stop')
            setSelected(state.index);
        else if (!state.moved && state.mode === 'move')
            addStop(stopAt(state.origin));
        commit();
    };
    const keyboard = (e: React.KeyboardEvent<SVGElement>, mode: Mode, index = -1) => {
        if (e.key === 'Escape') {
            setSelected(null);
            e.stopPropagation();

            return;
        }
        if (mode === 'stop' && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            e.stopPropagation();
            setSelected(index);
            return;
        }
        if (mode === 'stop' && ['Delete', 'Backspace'].includes(e.key)) {
            e.preventDefault();
            e.stopPropagation();
            removeStop(index);
            return;
        }
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key))
            return;
        e.preventDefault();
        e.stopPropagation();
        const direction = e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 1;
        if (mode === 'stop')
            changeStop(index, { at: clampStop(fill.stops[index].at + direction * (e.shiftKey ? .1 : .01)) });
        else if (mode === 'radius')
            changeHandles({ ...handles, width: Math.max(.01, (handles.width ?? Math.hypot(handles.end.x - handles.start.x, handles.end.y - handles.start.y)) + direction * (e.shiftKey ? .1 : .01)) });
        else if (mode === 'rotate')
            rotateTo(fill.angle + direction * (e.shiftKey ? 15 : 1));
        else {
            const step = e.shiftKey ? .1 : .01;
            const delta = { x: e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0, y: e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0 };
            const move = (p: Point) => ({ x: p.x + delta.x, y: p.y + delta.y });
            changeHandles({ ...handles, start: mode === 'end' ? handles.start : move(handles.start), end: mode === 'start' ? handles.end : move(handles.end) });
        }
    };
    const rotateTo = (angle: number) => { const c = radial || angular ? handles.start : interpolatePoint(handles.start, handles.end, .5); const rad = (angle - fill.angle) * Math.PI / 180; changeHandles(rotateHandles(handles, c, rad)); };
    const a11y = (mode: Mode, label: string, index = -1) => ({ tabIndex: 0, role: 'button' as const, 'aria-label': label, 'data-mode': mode, 'data-stop': index, onKeyDown: (e: React.KeyboardEvent<SVGElement>) => keyboard(e, mode, index), className: 'pointer-events-auto cursor-grab focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]' });
    const rotatePoint = { x: end.x + (end.x - start.x) * .18, y: end.y + (end.y - start.y) * .18 };
    return <svg data-gradient-editor="true" aria-label="Gradient editor" viewBox={`0 0 ${width} ${height}`} className="absolute inset-0 z-40 h-full w-full overflow-visible touch-none pointer-events-none" onPointerDown={e => { const target = e.target as SVGElement; const mode = target.getAttribute('data-mode') as Mode | null; if (!mode || drag.current)
        return; e.preventDefault(); e.stopPropagation();  const index = Number(target.getAttribute('data-stop')); if (mode === 'stop')
        setSelected(index); drag.current = { pointer: e.pointerId, mode, index, origin: pointer(e), client: { x: e.clientX, y: e.clientY }, fill, handles, moved: false, remove: false }; begin(); e.currentTarget.setPointerCapture(e.pointerId); }} onPointerMove={e => {
            const state = drag.current;
            if (!state || state.pointer !== e.pointerId)
                return;
            const p = pointer(e);
            if (!state.moved && Math.hypot(e.clientX - state.client.x, e.clientY - state.client.y) < 4)
                return;
            state.moved = true;
            const h = state.handles, q = local(p), original = local(state.origin);
            if (state.mode === 'stop') {
                const at = stopAt(p);
                const nearest = point(at);
                const scale = e.currentTarget.getBoundingClientRect().width / width;
                state.remove = !angular && state.fill.stops.length > 2 && Math.hypot(p.x - nearest.x, p.y - nearest.y) * scale > 48;
                onChange({ ...state.fill, handles: h, stops: state.fill.stops.map((s, i) => i === state.index ? { ...s, at } : s) });
            }
            else if (state.mode === 'move') {
                const move = (a: Point) => ({ x: a.x + q.x - original.x, y: a.y + q.y - original.y });
                changeHandles({ ...h, start: move(h.start), end: move(h.end) }, state.fill);
            }
            else if (state.mode === 'radius') {
                const radius = Math.hypot(q.x - h.start.x, q.y - h.start.y);
                changeHandles({ ...h, width: Math.max(.01, radius) }, state.fill);
            }
            else if (state.mode === 'start' || state.mode === 'end') {
                const next = { ...h, [state.mode]: q };
                if (e.shiftKey) {
                    const pivot = state.mode === 'end' ? h.start : h.end;
                    const angle = Math.round(gradientAngle(pivot, q) / 15) * 15 * Math.PI / 180;
                    const length = Math.hypot(q.x - pivot.x, q.y - pivot.y);
                    next[state.mode] = { x: pivot.x + Math.sin(angle) * length, y: pivot.y - Math.cos(angle) * length };
                }
                changeHandles(next, state.fill);
            }
            else {
                const c = radial || angular ? h.start : interpolatePoint(h.start, h.end, .5);
                let delta = Math.atan2(q.y - c.y, q.x - c.x) - Math.atan2(original.y - c.y, original.x - c.x);
                if (e.shiftKey)
                    delta = (Math.round((state.fill.angle + delta * 180 / Math.PI) / 15) * 15 - state.fill.angle) * Math.PI / 180;
                changeHandles(rotateHandles(h, c, delta), state.fill);
            }
        }} onPointerUp={e => finish(e)} onPointerCancel={e => finish(e, true)} onLostPointerCapture={e => finish(e, true)}>
        <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="transparent" strokeWidth="24" {...a11y('move', 'Move gradient; click to add color stop')}/>
        <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="#111" strokeWidth="3"/>
        <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="white" strokeWidth="1"/>
        {angular && <circle cx={start.x} cy={start.y} r={Math.hypot(end.x - start.x, end.y - start.y)} fill="none" stroke="white" strokeWidth="1" {...a11y('move', 'Move angular gradient')}/>}
        {(['start', 'end'] as const).map(mode => { const p = mode === 'start' ? start : end; return <rect key={mode} x={p.x - 13} y={p.y - 13} width="26" height="26" fill="transparent" stroke="var(--accent)" strokeWidth="2" {...a11y(mode, mode === 'start' && (radial || angular) ? 'Gradient center' : `Gradient ${mode} endpoint`)}/>; })}
        {radial && (() => { const p = project({ x: handles.start.x - (handles.end.y - handles.start.y), y: handles.start.y + (handles.width ?? Math.hypot(handles.end.x - handles.start.x, handles.end.y - handles.start.y)) }); return <circle cx={p.x} cy={p.y} r="8" fill="var(--panel-bg)" stroke="var(--accent)" {...a11y('radius', 'Ellipse radius')}/>; })()}
        <circle cx={rotatePoint.x} cy={rotatePoint.y} r="8" fill="var(--panel-bg)" stroke="var(--accent)" {...a11y('rotate', 'Rotate gradient; hold Shift for 15 degree snapping')}/>
        {fill.stops.map((stop, index) => { const p = point(stop.at); return <circle key={index} cx={p.x} cy={p.y} r="8" fill={stop.color} fillOpacity={stop.opacity ?? 1} stroke={selected === index ? 'var(--accent)' : 'white'} strokeWidth="2" {...a11y('stop', `Color stop ${index + 1}, ${Math.round(stop.at * 100)} percent, ${stop.color}`, index)}/>; })}
        {selected !== null && fill.stops[selected] && <foreignObject x={Math.max(8, Math.min(width - 228, point(fill.stops[selected].at).x + 20))} y={Math.max(8, Math.min(height - 180, point(fill.stops[selected].at).y + 20))} width="220" height="180" className="pointer-events-auto" onPointerDown={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
            <div className="rounded-lg border border-[var(--border-medium)] bg-[var(--panel-bg)] p-3 space-y-2 shadow-lg text-[var(--text-primary)]">                {selected !== null && fill.stops[selected] && <>
                    <ScrubInput label="Stop position" value={fill.stops[selected].at * 100} min={0} max={100} unit="%" onChange={value => changeStop(selected, { at: value / 100 })}/>
                    <ScrubInput label="Stop opacity" value={(fill.stops[selected].opacity ?? 1) * 100} min={0} max={100} unit="%" onChange={value => changeStop(selected, { opacity: value / 100 })}/>
                    <ColorPicker key={selected} color={fill.stops[selected].color} showGradientMode={false} onChange={color => changeStop(selected, { color })}/>
                    <button type="button" disabled={fill.stops.length <= 2} className="text-xs disabled:opacity-40" onClick={() => removeStop(selected)}>Delete stop</button>
                </>}
            </div>
        </foreignObject>}
    </svg>;
}
