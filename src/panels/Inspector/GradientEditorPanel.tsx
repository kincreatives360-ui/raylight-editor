import React from 'react';
import { Plus, RotateCcw, RotateCw, Trash2 } from 'lucide-react';
import { FigmaSelect } from '../../ui/FigmaSelect';
import { IconButton } from '../../ui/primitives';
import type { GradientStop, MeshGradientPoint } from '../../model/types';
import type { ColorFieldProps, GradientValue } from './ColorPicker';

interface GradientEditorPanelProps {
    gradient: GradientValue;
    gradientTypes: GradientValue['gradientType'][];
    gradientPreviewRef: React.RefObject<HTMLCanvasElement | null>;
    selectedMeshPoint: number;
    setSelectedMeshPoint: React.Dispatch<React.SetStateAction<number>>;
    ensureMesh: (value: GradientValue) => MeshGradientPoint[];
    updateMeshPoint: (index: number, patch: Partial<MeshGradientPoint>) => void;
    updateGradient: (value: GradientValue) => void;
    updateStop: (index: number, patch: Partial<GradientStop>) => void;
    addGradientStop: () => void;
    getStopId: (stop: GradientStop) => string;
    normalizeHex: (value: string) => string | null;
    setOpen: React.Dispatch<React.SetStateAction<boolean>>;
    onExitGradient?: () => void;
    anchorRef: React.RefObject<HTMLButtonElement | null>;
    ColorField: React.ComponentType<ColorFieldProps>;
}

export const GradientEditorPanel: React.FC<GradientEditorPanelProps> = ({
    gradient, gradientTypes, gradientPreviewRef, selectedMeshPoint, setSelectedMeshPoint,
    ensureMesh, updateMeshPoint, updateGradient, updateStop, addGradientStop, getStopId,
    normalizeHex, setOpen, onExitGradient, anchorRef, ColorField,
}) => (<div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                        <FigmaSelect
                            aria-label="Gradient type"
                            value={gradient.gradientType ?? 'linear'}
                            onChange={(event) => {
                                const gradientType = event.target.value as GradientValue['gradientType'];
                                updateGradient({ ...gradient, gradientType, mesh: gradientType === 'mesh' ? ensureMesh(gradient) : gradient.mesh });
                            }}
                            className="h-8 flex-1 rounded-lg border border-[var(--border-subtle,rgba(255,255,255,0.07))] bg-[var(--bg-subtle,#1c1c1f)] px-2 text-[11px] text-[var(--text-primary,#f4f4f5)] outline-none"
                        >
                            {gradientTypes.map(type => type && <option key={type} value={type}>{type[0].toUpperCase() + type.slice(1)}</option>)}
                        </FigmaSelect>
                        <IconButton
                            unstyled
                            tooltip={false}
                            label="Reverse gradient"
                            icon={<>
                                <RotateCcw className="h-4 w-4" />
                            </>}
                            title="Reverse gradient"
                            onClick={() => updateGradient({ ...gradient, stops: [...gradient.stops].reverse().map((stop) => ({ ...stop, at: 1 - stop.at })).sort((a, b) => a.at - b.at) })}
                            className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--bg-subtle,#1c1c1f)] text-[var(--text-muted,#a1a1aa)] hover:text-white hover:bg-[var(--bg-hover,rgba(255,255,255,0.05))] transition-colors duration-100"
                        />
                        <IconButton
                            unstyled
                            tooltip={false}
                            label="Rotate gradient 90 degrees"
                            icon={<>
                                <RotateCw className="h-4 w-4" />
                            </>}
                            title="Rotate gradient 90°"
                            onClick={() => updateGradient({ ...gradient, angle: (gradient.angle + 90) % 360 })}
                            className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--bg-subtle,#1c1c1f)] text-[var(--text-muted,#a1a1aa)] hover:text-white hover:bg-[var(--bg-hover,rgba(255,255,255,0.05))] transition-colors duration-100"
                        />
                    </div>
                    {gradient.gradientType === 'mesh' ? <div className="grid grid-cols-3 gap-2 rounded-lg border border-white/10 bg-black/20 p-3 touch-none" onPointerDown={event => {
                        const index = Number((event.target as HTMLElement).closest('[data-mesh-point]')?.getAttribute('data-mesh-point'));
                        if (!Number.isInteger(index)) return;
                        setSelectedMeshPoint(index);
                        event.currentTarget.dataset.dragMeshPoint = String(index);
                        event.currentTarget.setPointerCapture(event.pointerId);
                    }} onPointerMove={event => {
                        const index = Number(event.currentTarget.dataset.dragMeshPoint);
                        if (!event.currentTarget.dataset.dragMeshPoint || !(event.buttons & 1)) return;
                        const rect = event.currentTarget.getBoundingClientRect();
                        updateMeshPoint(index, { x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) });
                    }} onPointerUp={event => { delete event.currentTarget.dataset.dragMeshPoint; }} onPointerCancel={event => { delete event.currentTarget.dataset.dragMeshPoint; }}>
                        {ensureMesh(gradient).map((point, index) => <button key={index} data-mesh-point={index} type="button" aria-label={`Mesh point ${index + 1}`} onClick={() => setSelectedMeshPoint(index)} className={`aspect-square rounded-md border ${selectedMeshPoint === index ? 'border-white ring-1 ring-white/50' : 'border-white/15'}`} style={{ backgroundColor: point.color, opacity: point.opacity }} />)}
                    </div> : <div
                        className="relative h-9 rounded-lg border border-[var(--border-subtle,rgba(255,255,255,0.07))] bg-[var(--bg-canvas,#07080d)] shadow-inner"
                        style={{ background: `linear-gradient(${gradient.angle}deg, ${gradient.stops.map((stop) => `${stop.color}${Math.round((stop.opacity ?? 1) * 255).toString(16).padStart(2, '0')} ${stop.at * 100}%`).join(', ')})` }}
                    >
                        <div className="absolute inset-0 rounded-lg bg-[linear-gradient(45deg,#333_25%,transparent_25%,transparent_75%,#333_75%),linear-gradient(45deg,#333_25%,#111_25%,#111_75%,#333_75%)] bg-[length:12px_12px] bg-[position:0_0,6px_6px] opacity-20 pointer-events-none overflow-hidden rounded-lg" />
                        <canvas ref={gradientPreviewRef} aria-label="Gradient preview" className="absolute inset-0 h-full w-full rounded-lg" />
                        <svg
                            className="absolute inset-0 h-full w-full touch-none overflow-visible"
                            viewBox="0 0 300 36"
                            preserveAspectRatio="none"
                            onPointerDown={(event) => {
                                const bounds = event.currentTarget.getBoundingClientRect();
                                const padPx = (12 / 300) * bounds.width;
                                const usableWidth = bounds.width - padPx * 2;
                                const at = usableWidth > 0
                                    ? Math.max(0, Math.min(1, (event.clientX - bounds.left - padPx) / usableWidth))
                                    : 0;
                                const nearest = gradient.stops.reduce((best, stop, index) => Math.abs(stop.at - at) < Math.abs(gradient.stops[best].at - at) ? index : best, 0);
                                try {
                                    (event.currentTarget as SVGSVGElement).setPointerCapture(event.pointerId);
                                } catch {
                                    // ignore
                                }
                                (event.currentTarget as SVGSVGElement).dataset.dragStop = String(nearest);
                            }}
                            onPointerMove={(event) => {
                                const raw = event.currentTarget.dataset.dragStop;
                                if (raw === undefined || (event.buttons & 1) === 0) return;
                                const bounds = event.currentTarget.getBoundingClientRect();
                                const dy = Math.abs(event.clientY - (bounds.top + bounds.height / 2));
                                if (dy > 24 && gradient.stops.length > 2) {
                                    // Vertical tear-off deletion (Figma / Raylight parity)
                                    const idx = Number(raw);
                                    updateGradient({
                                        ...gradient,
                                        stops: gradient.stops.filter((_, i) => i !== idx),
                                    });
                                    delete (event.currentTarget as SVGSVGElement).dataset.dragStop;
                                    return;
                                }
                                const padPx = (12 / 300) * bounds.width;
                                const usableWidth = bounds.width - padPx * 2;
                                const at = usableWidth > 0
                                    ? Math.max(0, Math.min(1, (event.clientX - bounds.left - padPx) / usableWidth))
                                    : 0;
                                updateStop(Number(raw), { at });
                            }}
                            onPointerUp={(event) => { delete event.currentTarget.dataset.dragStop; }}
                            onPointerCancel={(event) => { delete event.currentTarget.dataset.dragStop; }}
                            onLostPointerCapture={(event) => { delete (event.currentTarget as SVGSVGElement).dataset.dragStop; }}
                        >
                            {gradient.stops.map((stop) => {
                                const cx = 12 + stop.at * (300 - 24);
                                return (
                                    <circle
                                        key={`gradient-circle-${getStopId(stop)}`}
                                        cx={cx}
                                        cy="18"
                                        r="7.5"
                                        fill={stop.color}
                                        stroke="white"
                                        strokeWidth="2.5"
                                        className="cursor-pointer filter drop-shadow(0 1px 3px rgba(0,0,0,0.6))"
                                    />
                                );
                            })}
                        </svg>
                    </div>}
                    {gradient.gradientType === 'mesh' ? (() => {
                        const point = ensureMesh(gradient)[selectedMeshPoint];
                        return <div className="grid grid-cols-[1fr_1fr_auto] gap-2 rounded-lg border border-white/10 bg-black/20 p-2">
                            <label className="text-[10px] text-zinc-400">X<input aria-label="Mesh point X" type="number" min="0" max="100" value={Math.round(point.x * 100)} onChange={event => updateMeshPoint(selectedMeshPoint, { x: Math.max(0, Math.min(100, Number(event.target.value) || 0)) / 100 })} className="mt-1 w-full rounded bg-zinc-900 p-1 text-white" /></label>
                            <label className="text-[10px] text-zinc-400">Y<input aria-label="Mesh point Y" type="number" min="0" max="100" value={Math.round(point.y * 100)} onChange={event => updateMeshPoint(selectedMeshPoint, { y: Math.max(0, Math.min(100, Number(event.target.value) || 0)) / 100 })} className="mt-1 w-full rounded bg-zinc-900 p-1 text-white" /></label>
                            <label className="text-[10px] text-zinc-400">Color<input aria-label="Mesh point color" type="color" value={normalizeHex(point.color) ?? '#000000'} onChange={event => updateMeshPoint(selectedMeshPoint, { color: event.target.value })} className="mt-1 h-7 w-9 rounded bg-zinc-900" /></label>
                            <label className="col-span-3 text-[10px] text-zinc-400">Opacity {Math.round(point.opacity * 100)}%<input aria-label="Mesh point opacity" type="range" min="0" max="100" value={Math.round(point.opacity * 100)} onChange={event => updateMeshPoint(selectedMeshPoint, { opacity: Number(event.target.value) / 100 })} className="mt-1 w-full" /></label>
                        </div>;
                    })() : <>
                    <div className="flex items-center justify-between text-[11px] text-[var(--text-muted,#a1a1aa)]">
                        <span>Stops</span>
                        <IconButton
                            unstyled
                            tooltip={false}
                            label="Add gradient stop"
                            icon={<>
                                <Plus className="h-4 w-4" />
                            </>}
                            title="Add stop"
                            onClick={addGradientStop}
                            className="grid h-7 w-7 place-items-center rounded-md bg-[var(--bg-subtle,#1c1c1f)] text-white hover:bg-[var(--bg-muted,#242428)] transition-colors duration-100"
                        />
                    </div>
                    <div className="max-h-[180px] space-y-1 overflow-y-auto">
                        {gradient.stops.map((stop, index) => (
                            <div key={getStopId(stop)} className="grid grid-cols-[42px_1fr_42px_26px] items-center gap-1 rounded-md border border-[var(--border-subtle,rgba(255,255,255,0.07))] bg-[var(--bg-subtle,#1c1c1f)] px-1.5 py-1">
                                <label className="flex items-center text-[10px] text-[var(--text-secondary,#c4c4cc)]">
                                    <input
                                        aria-label={`Stop ${index + 1} position`}
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={Math.round(stop.at * 100)}
                                        onChange={(event) => {
                                            const val = event.target.value.trim();
                                            const num = val === '' ? 0 : Number(val);
                                            if (Number.isFinite(num)) {
                                                updateStop(index, { at: Math.max(0, Math.min(100, num)) / 100 });
                                            }
                                        }}
                                        onKeyDown={(e) => e.stopPropagation()}
                                        className="w-7 bg-transparent text-right outline-none"
                                    />
                                    <span>%</span>
                                </label>
                                <label className="flex min-w-0 items-center gap-1 rounded bg-[var(--bg-surface,#161619)] px-1">
                                    <ColorField
                                        aria-label={`Stop ${index + 1} color`}
                                        value={normalizeHex(stop.color) ?? '#000000'}
                                        onChange={(event) => updateStop(index, { color: event.target.value })}
                                        className="h-5 w-5 shrink-0 cursor-pointer border-0 bg-transparent p-0"
                                    />
                                    <input
                                        aria-label={`Stop ${index + 1} hex`}
                                        value={stop.color.replace(/^#/, '').toUpperCase()}
                                        onChange={(event) => { const value = normalizeHex(event.target.value); if (value) updateStop(index, { color: value }); }}
                                        onKeyDown={(e) => {
                                            e.stopPropagation();
                                            if (e.key === 'Escape') {
                                                e.preventDefault();
                                                setOpen(false);
                                                onExitGradient?.();
                                                anchorRef.current?.focus();
                                            }
                                        }}
                                        className="min-w-0 w-full bg-transparent font-mono text-[10px] text-[var(--text-primary,#f4f4f5)] outline-none"
                                    />
                                </label>
                                <label className="flex items-center text-[10px] text-[var(--text-secondary,#c4c4cc)]">
                                    <input
                                        aria-label={`Stop ${index + 1} opacity`}
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={Math.round((stop.opacity ?? 1) * 100)}
                                        onChange={(event) => {
                                            const val = event.target.value.trim();
                                            const num = val === '' ? 100 : Number(val);
                                            if (Number.isFinite(num)) {
                                                updateStop(index, { opacity: Math.max(0, Math.min(100, num)) / 100 });
                                            }
                                        }}
                                        onKeyDown={(e) => e.stopPropagation()}
                                        className="w-7 bg-transparent text-right outline-none"
                                    />
                                    <span>%</span>
                                </label>
                                <IconButton
                                    unstyled
                                    tooltip={false}
                                    label={`Remove stop ${index + 1}`}
                                    icon={<>
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </>}
                                    disabled={gradient.stops.length <= 2}
                                    onClick={() => updateGradient({ ...gradient, stops: gradient.stops.filter((_, stopIndex) => stopIndex !== index) })}
                                    className="grid h-6 w-6 place-items-center rounded text-[var(--text-muted,#a1a1aa)] hover:text-[var(--accent-danger,#f43f5e)] disabled:opacity-40 transition-colors duration-100"
                                />
                            </div>
                        ))}
                    </div>
                    </>}
                    <div className="text-right text-[10px] text-[var(--text-muted,#a1a1aa)]">Angle {gradient.angle}°</div>
                </div>
);
