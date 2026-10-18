/* eslint-disable react-hooks/refs */
import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, RotateCcw, RotateCw, Trash2 } from 'lucide-react';
import type { GradientStop } from '../../model/types';
import { RAYLIGHT_COLOR_PALETTE } from '../../model/types';

type Hsv = { h: number; s: number; v: number };
export interface GradientValue {
    angle: number;
    stops: GradientStop[];
    gradientType?: 'linear' | 'radial';
}

function normalizeHex(value: string): string | null {
    const raw = value.trim().replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(raw)) return `#${raw.split('').map((ch) => ch + ch).join('').toLowerCase()}`;
    if (/^[0-9a-f]{6}$/i.test(raw)) return `#${raw.toLowerCase()}`;
    return null;
}

function hexToHsv(hex: string): Hsv {
    const normalized = normalizeHex(hex) ?? '#0a0a0c';
    const r = parseInt(normalized.slice(1, 3), 16) / 255;
    const g = parseInt(normalized.slice(3, 5), 16) / 255;
    const b = parseInt(normalized.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    let h = 0;
    if (delta > 0) {
        if (max === r) h = ((g - b) / delta) % 6;
        else if (max === g) h = (b - r) / delta + 2;
        else h = (r - g) / delta + 4;
        h = (h * 60 + 360) % 360;
    }
    return { h, s: max === 0 ? 0 : delta / max, v: max };
}

function hsvToHex({ h, s, v }: Hsv): string {
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    const sector = Math.floor(h / 60) % 6;
    const rgb = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][sector]
        .map((channel) => Math.round((channel + m) * 255));
    return `#${rgb.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

interface ColorPickerProps {
    color: string;
    onChange: (color: string) => void;
    label?: string;
    gradientValue?: GradientValue;
    onGradientChange?: (gradient: GradientValue) => void;
    onEnterGradient?: () => void;
    onExitGradient?: () => void;
    compact?: boolean;
    showGradientMode?: boolean;
    className?: string;
}

export const ColorPicker: React.FC<ColorPickerProps> = ({
    color,
    onChange,
    label = 'Color',
    gradientValue,
    onGradientChange,
    onEnterGradient,
    onExitGradient,
    compact = false,
    showGradientMode = true,
    className = '',
}) => {
    const anchorRef = useRef<HTMLButtonElement>(null);
    const popupRef = useRef<HTMLDivElement>(null);
    const squareRef = useRef<HTMLDivElement>(null);
    const hexInputRef = useRef<HTMLInputElement>(null);
    const pickerId = useId();
    const [open, setOpen] = useState(false);
    const [pickerMode, setPickerMode] = useState<'color' | 'gradient'>('color');
    const [hexDraft, setHexDraft] = useState(color);
    const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(color));
    const [position, setPosition] = useState({ left: 0, top: 0 });
    const [draggingSquare, setDraggingSquare] = useState(false);
    const [previousColor, setPreviousColor] = useState(color);
    const hueColor = useMemo(() => hsvToHex({ h: hsv.h, s: 1, v: 1 }), [hsv.h]);
    const gradient = gradientValue ?? {
        angle: 0,
        gradientType: 'linear' as const,
        stops: [{ at: 0, color }, { at: 1, color: '#000000' }],
    };

    const isHexInputFocused =
        typeof document !== 'undefined' &&
        hexInputRef.current !== null &&
        hexInputRef.current === document.activeElement;

    if (color !== previousColor && !draggingSquare) {
        setPreviousColor(color);
        if (!isHexInputFocused) {
            setHexDraft(color);
        }
        setHsv(hexToHsv(color));
    }

    const hsvRef = useRef<Hsv>(hsv);
    hsvRef.current = hsv;

    useEffect(() => {
        if (!open) return;
        const updatePosition = () => {
            const rect = anchorRef.current?.getBoundingClientRect();
            if (!rect) return;
            const width = 312;
            const height = pickerMode === 'gradient' ? 420 : 350;
            const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
            const below = rect.bottom + 8;
            setPosition({ left, top: below + height < window.innerHeight ? below : Math.max(8, rect.top - height - 8) });
        };
        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);
        const onPointerDown = (event: PointerEvent) => {
            const target = event.target as HTMLElement | null;
            if (!target) return;
            if (anchorRef.current?.contains(target) || popupRef.current?.contains(target)) {
                return;
            }
            if (target.closest && target.closest('[data-raylight-color-picker]')) {
                return;
            }
            setOpen(false);
            onExitGradient?.();
        };
        window.addEventListener('pointerdown', onPointerDown);
        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
            window.removeEventListener('pointerdown', onPointerDown);
        };
    }, [open, pickerMode, onExitGradient]);

    const handleSquarePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        try {
            event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
            // ignore
        }
        setDraggingSquare(true);
        const rect = event.currentTarget.getBoundingClientRect();
        const next = {
            ...hsvRef.current,
            s: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
            v: 1 - Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
        };
        setHsv(next);
        const nextColor = hsvToHex(next);
        setHexDraft(nextColor);
        onChange(nextColor);
    };

    const handleSquarePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        if (!draggingSquare) return;
        event.preventDefault();
        const rect = event.currentTarget.getBoundingClientRect();
        const next = {
            ...hsvRef.current,
            s: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
            v: 1 - Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
        };
        setHsv(next);
        const nextColor = hsvToHex(next);
        setHexDraft(nextColor);
        onChange(nextColor);
    };

    const handleSquarePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
        setDraggingSquare(false);
        try {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
            }
        } catch {
            // ignore
        }
    };

    const commitHex = (value: string) => {
        const nextColor = normalizeHex(value);
        if (!nextColor) return;
        setHexDraft(nextColor);
        setHsv(hexToHsv(nextColor));
        onChange(nextColor);
    };

    const updateGradient = (next: GradientValue) => onGradientChange?.(next);
    const updateStop = (index: number, patch: Partial<GradientStop>) => {
        const stops = gradient.stops.map((stop, stopIndex) => stopIndex === index ? { ...stop, ...patch } : stop);
        updateGradient({ ...gradient, stops });
    };
    const enterGradientMode = () => {
        setPickerMode('gradient');
        onEnterGradient?.();
    };
    const enterColorMode = () => {
        setPickerMode('color');
        onExitGradient?.();
        if (gradientValue) onChange(gradient.stops[0]?.color ?? color);
    };

    const popup = open ? createPortal(
        <div
            ref={popupRef}
            id={`raylight-color-picker-${pickerId}`}
            data-raylight-color-picker={pickerId}
            role="dialog"
            aria-label={`${label} picker`}
            style={{ left: position.left, top: position.top }}
            className="fixed z-[10000] w-[312px] rounded-2xl border border-white/10 bg-[#111113] p-2.5 shadow-[0_18px_60px_rgba(0,0,0,.7)]"
        >
            {showGradientMode && <div className="mb-2 flex items-center gap-1.5">
                <button type="button" aria-label="Solid color" aria-pressed={pickerMode === 'color'} onClick={enterColorMode} className={`grid h-7 w-7 place-items-center rounded-lg border ${pickerMode === 'color' ? 'border-white bg-[#202024]' : 'border-transparent text-[#9ca3af] hover:bg-white/5'}`}>
                    <span className="h-3.5 w-3.5 rounded border border-current" />
                </button>
                <button type="button" aria-label="Gradient" aria-pressed={pickerMode === 'gradient'} onClick={enterGradientMode} className={`grid h-7 w-7 place-items-center rounded-lg border ${pickerMode === 'gradient' ? 'border-white bg-[#202024]' : 'border-transparent text-[#9ca3af] hover:bg-white/5'}`}>
                    <span className="h-3.5 w-3.5 rounded-sm border border-current bg-[linear-gradient(135deg,#fff_0%,#777_50%,#111_100%)]" />
                </button>
            </div>}

            {pickerMode === 'color' ? (
                <>
                    <label className="mb-2 flex h-8 items-center gap-2 rounded-md px-1 text-[11px] text-[#a1a1aa]">
                        <span className="text-lg leading-none text-[#8b8b95]">♢</span>
                        <span className="h-5 w-5 rounded-full border border-white/10" style={{ backgroundColor: hexDraft }} />
                        <span className="font-medium">HEX</span>
                        <input
                            ref={hexInputRef}
                            aria-label="Hex color"
                            value={hexDraft.replace(/^#/, '').toUpperCase()}
                            onChange={(event) => {
                                const raw = event.target.value.replace(/[^0-9a-f]/gi, '').slice(0, 6);
                                setHexDraft(`#${raw}`);
                                if (raw.length === 3 || raw.length === 6) commitHex(raw);
                            }}
                            onBlur={() => {
                                commitHex(hexDraft);
                                setHexDraft(normalizeHex(hexDraft) || color);
                            }}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    commitHex(hexDraft);
                                    setHexDraft(normalizeHex(hexDraft) || color);
                                    hexInputRef.current?.blur();
                                }
                            }}
                            className="min-w-0 w-[86px] bg-transparent font-mono text-white outline-none"
                            spellCheck={false}
                        />
                    </label>
                    <div className="flex h-[205px] gap-3">
                        <div
                            ref={squareRef}
                            role="slider"
                            aria-label="Saturation and brightness"
                            aria-valuetext={hexDraft}
                            onPointerDown={handleSquarePointerDown}
                            onPointerMove={handleSquarePointerMove}
                            onPointerUp={handleSquarePointerUp}
                            onPointerCancel={handleSquarePointerUp}
                            className="relative min-w-0 flex-1 touch-none cursor-crosshair rounded-xl select-none"
                            style={{ backgroundColor: hueColor, backgroundImage: 'linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)' }}
                        >
                            <span className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_1px_5px_#000]" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }} />
                        </div>
                        <div className="relative h-full w-[17px] shrink-0 rounded-full select-none" style={{ background: 'linear-gradient(to bottom, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)' }}>
                            <input aria-label="Hue" type="range" min="0" max="359" value={Math.round(hsv.h)} onChange={(event) => {
                                const next = { ...hsv, h: Number(event.target.value) };
                                setHsv(next);
                                const nextColor = hsvToHex(next);
                                setHexDraft(nextColor);
                                onChange(nextColor);
                            }} className="absolute inset-0 h-full w-full cursor-pointer opacity-0 [writing-mode:vertical-lr] [direction:rtl]" />
                            <span className="pointer-events-none absolute left-1/2 h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow" style={{ top: `${(hsv.h / 360) * 100}%` }} />
                        </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-1.5">
                        {RAYLIGHT_COLOR_PALETTE.map((swatch) => <button key={swatch} type="button" aria-label={`Set color ${swatch}`} title={swatch} onClick={() => commitHex(swatch)} className={`h-6 w-6 shrink-0 rounded-full border transition hover:scale-110 ${hexDraft.toLowerCase() === swatch ? 'border-white ring-1 ring-white/50' : 'border-white/15'}`} style={{ backgroundColor: swatch }} />)}
                    </div>
                </>
            ) : (
                <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                        <select aria-label="Gradient type" value={gradient.gradientType ?? 'linear'} onChange={(event) => updateGradient({ ...gradient, gradientType: event.target.value as 'linear' | 'radial' })} className="h-8 flex-1 rounded-lg border border-white/[0.06] bg-[#1b1b1e] px-2 text-[11px] text-white outline-none">
                            <option value="linear">Linear</option><option value="radial">Radial</option>
                        </select>
                        <button type="button" aria-label="Reverse gradient" title="Reverse gradient" onClick={() => updateGradient({ ...gradient, stops: [...gradient.stops].reverse().map((stop) => ({ ...stop, at: 1 - stop.at })).sort((a, b) => a.at - b.at) })} className="grid h-8 w-8 place-items-center rounded-lg bg-[#1b1b1e] text-[#a1a1aa] hover:text-white"><RotateCcw className="h-4 w-4" /></button>
                        <button type="button" aria-label="Rotate gradient 90 degrees" title="Rotate gradient 90°" onClick={() => updateGradient({ ...gradient, angle: (gradient.angle + 90) % 360 })} className="grid h-8 w-8 place-items-center rounded-lg bg-[#1b1b1e] text-[#a1a1aa] hover:text-white"><RotateCw className="h-4 w-4" /></button>
                    </div>
                    <div className="relative h-9 rounded-lg border border-white/10 bg-[#0b0b0e]" style={{ background: `linear-gradient(${gradient.angle}deg, ${gradient.stops.map((stop) => `${stop.color}${Math.round((stop.opacity ?? 1) * 255).toString(16).padStart(2, '0')} ${stop.at * 100}%`).join(', ')})` }}>
                        <div className="absolute inset-0 rounded-lg bg-[linear-gradient(45deg,#333_25%,transparent_25%,transparent_75%,#333_75%),linear-gradient(45deg,#333_25%,#111_25%,#111_75%,#333_75%)] bg-[length:12px_12px] bg-[position:0_0,6px_6px] opacity-20" />
                        <div className="absolute inset-0 rounded-lg" style={{ background: gradient.gradientType === 'radial' ? `radial-gradient(circle, ${gradient.stops.map((stop) => `${stop.color} ${stop.at * 100}%`).join(', ')})` : `linear-gradient(${gradient.angle}deg, ${gradient.stops.map((stop) => `${stop.color} ${stop.at * 100}%`).join(', ')})` }} />
                        <svg className="absolute inset-0 h-full w-full touch-none" viewBox="0 0 300 36" preserveAspectRatio="none" onPointerDown={(event) => {
                            const bounds = event.currentTarget.getBoundingClientRect();
                            const at = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
                            const nearest = gradient.stops.reduce((best, stop, index) => Math.abs(stop.at - at) < Math.abs(gradient.stops[best].at - at) ? index : best, 0);
                            (event.currentTarget as SVGSVGElement).setPointerCapture(event.pointerId);
                            (event.currentTarget as SVGSVGElement).dataset.dragStop = String(nearest);
                        }} onPointerMove={(event) => {
                            const raw = event.currentTarget.dataset.dragStop;
                            if (raw === undefined || (event.buttons & 1) === 0) return;
                            const bounds = event.currentTarget.getBoundingClientRect();
                            const at = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
                            updateStop(Number(raw), { at });
                        }} onPointerUp={(event) => { delete event.currentTarget.dataset.dragStop; }} onPointerCancel={(event) => { delete event.currentTarget.dataset.dragStop; }}>
                            {gradient.stops.map((stop, index) => <circle key={`gradient-stop-${index}`} cx={stop.at * 300} cy="18" r="7" fill={stop.color} stroke="white" strokeWidth="2" className="cursor-pointer" />)}
                        </svg>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[#a1a1aa]">
                        <span>Stops</span>
                        <button type="button" aria-label="Add gradient stop" title="Add stop" onClick={() => {
                            const sorted = [...gradient.stops].sort((a, b) => a.at - b.at);
                            let at = 0.5;
                            for (let index = 0; index < sorted.length - 1; index++) {
                                const gap = sorted[index + 1].at - sorted[index].at;
                                if (gap > 0.01) { at = sorted[index].at + gap / 2; break; }
                            }
                            updateGradient({ ...gradient, stops: [...gradient.stops, { at, color: '#ffffff', opacity: 1 }].sort((a, b) => a.at - b.at) });
                        }} className="grid h-7 w-7 place-items-center rounded-md bg-[#1b1b1e] text-white hover:bg-[#29292d]"><Plus className="h-4 w-4" /></button>
                    </div>
                    <div className="max-h-[180px] space-y-1 overflow-y-auto">
                        {gradient.stops.map((stop, index) => (
                            <div key={`${index}-${stop.at}`} className="grid grid-cols-[42px_1fr_42px_26px] items-center gap-1 rounded-md border border-white/10 bg-[#1a1a1d] px-1.5 py-1">
                                <label className="flex items-center text-[10px] text-[#c4c4cc]"><input aria-label={`Stop ${index + 1} position`} type="number" min="0" max="100" value={Math.round(stop.at * 100)} onChange={(event) => updateStop(index, { at: Math.max(0, Math.min(100, Number(event.target.value))) / 100 })} className="w-7 bg-transparent text-right outline-none" /><span>%</span></label>
                                <label className="flex min-w-0 items-center gap-1 rounded bg-[#101013] px-1">
                                    <ColorField aria-label={`Stop ${index + 1} color`} value={normalizeHex(stop.color) ?? '#000000'} onChange={(event) => updateStop(index, { color: event.target.value })} className="h-5 w-5 shrink-0 cursor-pointer border-0 bg-transparent p-0" />
                                    <input aria-label={`Stop ${index + 1} hex`} value={stop.color.replace(/^#/, '').toUpperCase()} onChange={(event) => { const value = normalizeHex(event.target.value); if (value) updateStop(index, { color: value }); }} className="min-w-0 w-full bg-transparent font-mono text-[10px] text-white outline-none" />
                                </label>
                                <label className="flex items-center text-[10px] text-[#c4c4cc]"><input aria-label={`Stop ${index + 1} opacity`} type="number" min="0" max="100" value={Math.round((stop.opacity ?? 1) * 100)} onChange={(event) => updateStop(index, { opacity: Math.max(0, Math.min(100, Number(event.target.value))) / 100 })} className="w-7 bg-transparent text-right outline-none" /><span>%</span></label>
                                <button type="button" aria-label={`Remove stop ${index + 1}`} disabled={gradient.stops.length <= 2} onClick={() => updateGradient({ ...gradient, stops: gradient.stops.filter((_, stopIndex) => stopIndex !== index) })} className="grid h-6 w-6 place-items-center rounded text-[#a1a1aa] hover:text-red-300 disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" /></button>
                            </div>
                        ))}
                    </div>
                    <div className="text-right text-[10px] text-[#a1a1aa]">Angle {gradient.angle}°</div>
                </div>
            )}
        </div>,
        document.body,
    ) : null;

    const triggerLabel = gradientValue ? 'Gradient' : `${label}: ${color}`;
    return <>
        <button ref={anchorRef} type="button" aria-label={triggerLabel} aria-expanded={open} onClick={() => {
            if (open) {
                setOpen(false);
                onExitGradient?.();
            } else {
                setPickerMode(gradientValue ? 'gradient' : 'color');
                setOpen(true);
                if (gradientValue) onEnterGradient?.();
            }
        }} className={`${compact ? 'h-full w-full min-h-[18px] min-w-[18px] rounded border border-white/20' : 'flex h-8 w-full items-center gap-2 rounded-lg border border-white/[0.06] bg-[#1c1c1f] px-2 text-left hover:bg-[#232326]'} ${className}`}>
            <span className={`${compact ? 'block h-full w-full rounded-[inherit]' : 'h-5 w-5 shrink-0 rounded-md border border-white/15'}`} style={{ background: gradientValue ? `linear-gradient(${gradientValue.angle}deg, ${gradientValue.stops.map((stop) => `${stop.color} ${stop.at * 100}%`).join(', ')})` : color }} />
            {!compact && <span className="font-mono text-[11px] text-white">{gradientValue ? 'Gradient' : color.replace(/^#/, '').toUpperCase()}</span>}
        </button>
        {popup}
    </>;
};

interface ColorFieldProps {
    value: string;
    onChange: (event: { target: { value: string } }) => void;
    className?: string;
    title?: string;
    'aria-label'?: string;
}

/** Drop-in replacement for native color inputs; opens the Raylight-style picker. */
export const ColorField: React.FC<ColorFieldProps> = ({ value, onChange, className = '', title, 'aria-label': ariaLabel }) => (
    <ColorPicker
        color={value}
        label={ariaLabel ?? title ?? 'Color'}
        compact
        showGradientMode={false}
        className={className}
        onChange={(color) => onChange({ target: { value: color } })}
    />
);
