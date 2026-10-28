import { IconButton } from '../../ui/primitives';
import { useFloatingPanel } from '../../ui/useFloatingPanel';
import { FigmaSelect } from '../../ui/FigmaSelect';
import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pipette, Plus, RotateCcw, RotateCw, Trash2 } from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import type { GradientStop, MeshGradientPoint } from '../../model/types';
import { RAYLIGHT_COLOR_PALETTE } from '../../model/types';
import { createCanvasFillStyle } from '../../engine/canvasRenderer';

type Hsv = { h: number; s: number; v: number };
export interface GradientValue {
    angle: number;
    stops: GradientStop[];
    gradientType?: 'linear' | 'radial' | 'angular' | 'diamond' | 'mesh';
    mesh?: MeshGradientPoint[];
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
    gradientTypes?: GradientValue['gradientType'][];
    className?: string;
    children?: React.ReactNode;
    disabled?: boolean;
}

const stopIdMap = new WeakMap<GradientStop, string>();
let nextStopId = 1;

function getStopId(stop: GradientStop): string {
    let id = stopIdMap.get(stop);
    if (!id) {
        id = `stop-id-${nextStopId++}`;
        stopIdMap.set(stop, id);
    }
    return id;
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
    gradientTypes = ['linear', 'radial', 'angular', 'diamond', 'mesh'],
    className = '',
    children,
    disabled = false,
}) => {
    const anchorRef = useRef<HTMLButtonElement>(null);
    const popupRef = useRef<HTMLDivElement>(null);
    const gradientPreviewRef = useRef<HTMLCanvasElement>(null);
    const squareRef = useRef<HTMLDivElement>(null);
    const hexInputRef = useRef<HTMLInputElement>(null);
    const hueBarRef = useRef<HTMLDivElement>(null);

    const hasEyeDropper = typeof window !== 'undefined' && 'EyeDropper' in window;
    const handleEyeDropper = async () => {
        if (typeof window === 'undefined') return;
        const EyeDropperClass = (window as unknown as { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper;
        if (!EyeDropperClass) return;
        try {
            const ed = new EyeDropperClass();
            const res = await ed.open();
            if (res?.sRGBHex) {
                commitHex(res.sRGBHex);
            }
        } catch {
            // Cancelled
        }
    };

    const project = useProjectStore.getState().project;
    const documentColors = useMemo(() => {
        const colors = new Set<string>();
        if (project.background?.kind === 'solid' && project.background.color) {
            colors.add(project.background.color.toLowerCase());
        }
        for (const shot of project.shots) {
            for (const l of shot.layers) {
                if (l.kind === 'text' && l.font?.color) colors.add(l.font.color.toLowerCase());
                if (l.kind === 'shape' && l.fill?.kind === 'solid' && l.fill.color) colors.add(l.fill.color.toLowerCase());
            }
        }
        return Array.from(colors).filter((c) => /^#[0-9a-f]{6}$/i.test(c)).slice(0, 7);
    }, [project]);
    const pickerId = useId();
    const [open, setOpen] = useState(false);
    const [pickerMode, setPickerMode] = useState<'color' | 'gradient'>('color');
    const [selectedMeshPoint, setSelectedMeshPoint] = useState(4);
    const [hexDraft, setHexDraft] = useState(color);
    const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(color));
    const [position, setPosition] = useState({ left: 0, top: 0 });
    const draggingSquareRef = useRef(false);
    const draggingHueRef = useRef(false);
    const isHexFocusedRef = useRef(false);
    const hsvRef = useRef<Hsv>(hsv);
    const onExitGradientRef = useRef(onExitGradient);

    const hueColor = useMemo(() => hsvToHex({ h: hsv.h, s: 1, v: 1 }), [hsv.h]);
    const gradient = useMemo(() => gradientValue ?? {
        angle: 0,
        gradientType: 'linear' as const,
        stops: [{ at: 0, color }, { at: 1, color: '#000000' }],
    }, [gradientValue, color]);

    useEffect(() => {
        const canvas = gradientPreviewRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        canvas.width = 300;
        canvas.height = 36;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = createCanvasFillStyle(ctx, { kind: 'gradient', ...gradient }, canvas.width, canvas.height);
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }, [gradient]);

    useEffect(() => {
        hsvRef.current = hsv;
    }, [hsv]);

    useEffect(() => {
        onExitGradientRef.current = onExitGradient;
    }, [onExitGradient]);

    useEffect(() => {
        if (!draggingSquareRef.current && !draggingHueRef.current) {
            if (!isHexFocusedRef.current) {
                setHexDraft(color);
            }
            setHsv(hexToHsv(color));
        }
    }, [color]);

    useFloatingPanel({ open, surfaceRef: popupRef, anchorRef, positionKey: pickerMode,
        reposition: () => {
            const rect = anchorRef.current?.getBoundingClientRect();
            if (!rect) return;
            const width = 312;
            const height = pickerMode === 'gradient' ? 420 : 350;
            const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
            const below = rect.bottom + 8;
            setPosition({ left, top: below + height < window.innerHeight ? below : Math.max(8, rect.top - height - 8) });
        },
        onClose: () => { setOpen(false); onExitGradientRef.current?.(); }, escape: false,
        ignoreOutside: target => !!target.closest?.('[data-raylight-color-picker]'),
    });

    const handleSquarePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        try {
            event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
            // ignore
        }
        draggingSquareRef.current = true;
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
        if (!draggingSquareRef.current) return;
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
        draggingSquareRef.current = false;
        try {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
            }
        } catch {
            // ignore
        }
    };

    const handleSquareLostPointerCapture = (_event: React.PointerEvent<HTMLDivElement>) => {
        draggingSquareRef.current = false;
    };

    const handleSquareKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        let deltaS = 0;
        let deltaV = 0;
        const step = event.shiftKey ? 0.05 : 0.01;

        switch (event.key) {
            case 'ArrowLeft':
                deltaS = -step;
                break;
            case 'ArrowRight':
                deltaS = step;
                break;
            case 'ArrowUp':
                deltaV = step;
                break;
            case 'ArrowDown':
                deltaV = -step;
                break;
            case 'PageUp':
                deltaV = 0.1;
                break;
            case 'PageDown':
                deltaV = -0.1;
                break;
            case 'Home':
                deltaS = -hsvRef.current.s;
                break;
            case 'End':
                deltaS = 1 - hsvRef.current.s;
                break;
            default:
                return;
        }

        event.preventDefault();
        const nextS = Math.max(0, Math.min(1, Math.round((hsvRef.current.s + deltaS) * 100) / 100));
        const nextV = Math.max(0, Math.min(1, Math.round((hsvRef.current.v + deltaV) * 100) / 100));
        const next = { ...hsvRef.current, s: nextS, v: nextV };
        setHsv(next);
        const nextColor = hsvToHex(next);
        setHexDraft(nextColor);
        onChange(nextColor);
    };

    const handleHuePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        try {
            event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
            // ignore
        }
        draggingHueRef.current = true;
        const rect = event.currentTarget.getBoundingClientRect();
        if (!rect.height) return;
        const ratio = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
        const h = Math.round(ratio * 359);
        const next = { ...hsvRef.current, h };
        setHsv(next);
        const nextColor = hsvToHex(next);
        setHexDraft(nextColor);
        onChange(nextColor);
    };

    const handleHuePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        if (!draggingHueRef.current) return;
        event.preventDefault();
        const rect = event.currentTarget.getBoundingClientRect();
        if (!rect.height) return;
        const ratio = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
        const h = Math.round(ratio * 359);
        const next = { ...hsvRef.current, h };
        setHsv(next);
        const nextColor = hsvToHex(next);
        setHexDraft(nextColor);
        onChange(nextColor);
    };

    const handleHuePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
        draggingHueRef.current = false;
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
    const ensureMesh = (value: GradientValue): MeshGradientPoint[] => value.mesh?.length === 9 ? value.mesh : Array.from({ length: 9 }, (_, index) => ({
        x: (index % 3) / 2, y: Math.floor(index / 3) / 2,
        color: gradient.stops[Math.round(index / 8 * (gradient.stops.length - 1))]?.color ?? color,
        opacity: gradient.stops[Math.round(index / 8 * (gradient.stops.length - 1))]?.opacity ?? 1,
    }));
    const updateStop = (index: number, patch: Partial<GradientStop>) => {
        const oldStop = gradient.stops[index];
        const stableId = oldStop ? getStopId(oldStop) : `stop-id-${nextStopId++}`;
        const newStop = { ...oldStop, ...patch };
        stopIdMap.set(newStop, stableId);
        const stops = gradient.stops.map((stop, stopIndex) => (stopIndex === index ? newStop : stop));
        updateGradient({ ...gradient, stops });
    };
    const updateMeshPoint = (index: number, patch: Partial<MeshGradientPoint>) => {
        const mesh = ensureMesh(gradient).map((point, pointIndex) => pointIndex === index ? { ...point, ...patch } : point);
        updateGradient({ ...gradient, gradientType: 'mesh', mesh });
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
            onKeyDown={(event) => {
                if (event.key === 'Escape') {
                    event.preventDefault();
                    event.stopPropagation();
                    setOpen(false);
                    onExitGradient?.();
                    anchorRef.current?.focus();
                }
            }}
            className="fixed z-[10000] w-[312px] rounded-2xl border border-[var(--border-medium,rgba(255,255,255,0.12))] bg-[var(--bg-muted,#242428)] p-2.5 shadow-[0_18px_60px_rgba(0,0,0,.7)]"
        >
            {showGradientMode && <div className="mb-2 flex items-center gap-1.5">
                <button
                    type="button"
                    aria-label="Solid color"
                    aria-pressed={pickerMode === 'color'}
                    onClick={enterColorMode}
                    className={`grid h-7 w-7 place-items-center rounded-lg border transition-colors duration-100 ${
                        pickerMode === 'color'
                            ? 'border-white bg-[var(--bg-subtle,#1c1c1f)] text-white'
                            : 'border-transparent text-[var(--text-muted,#a1a1aa)] hover:bg-[var(--bg-hover,rgba(255,255,255,0.05))]'
                    }`}
                >
                    <span className="h-3.5 w-3.5 rounded border border-current" />
                </button>
                <button
                    type="button"
                    aria-label="Gradient"
                    aria-pressed={pickerMode === 'gradient'}
                    onClick={enterGradientMode}
                    className={`grid h-7 w-7 place-items-center rounded-lg border transition-colors duration-100 ${
                        pickerMode === 'gradient'
                            ? 'border-white bg-[var(--bg-subtle,#1c1c1f)] text-white'
                            : 'border-transparent text-[var(--text-muted,#a1a1aa)] hover:bg-[var(--bg-hover,rgba(255,255,255,0.05))]'
                    }`}
                >
                    <span className="h-3.5 w-3.5 rounded-sm border border-current bg-[linear-gradient(135deg,#fff_0%,#777_50%,#111_100%)]" />
                </button>
            </div>}

            {pickerMode === 'color' ? (
                <>
                    <label className="mb-2 flex h-8 items-center gap-2 rounded-md px-1 text-[11px] text-[var(--text-muted,#a1a1aa)]">
                        <span className="text-lg leading-none text-[var(--text-muted,#8b8b95)]">♢</span>
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
                            onFocus={() => {
                                isHexFocusedRef.current = true;
                            }}
                            onBlur={() => {
                                isHexFocusedRef.current = false;
                                commitHex(hexDraft);
                                setHexDraft(normalizeHex(hexDraft) || color);
                            }}
                            onKeyDown={(event) => {
                                event.stopPropagation();
                                if (event.key === 'Escape') {
                                    event.preventDefault();
                                    setOpen(false);
                                    onExitGradient?.();
                                    anchorRef.current?.focus();
                                    return;
                                }
                                if (event.key === 'Enter') {
                                    commitHex(hexDraft);
                                    setHexDraft(normalizeHex(hexDraft) || color);
                                    hexInputRef.current?.blur();
                                }
                            }}
                            className="min-w-0 w-[86px] bg-transparent font-mono text-[var(--text-primary,#f4f4f5)] outline-none"
                            spellCheck={false}
                        />
                        {hasEyeDropper && (
                            <button
                                type="button"
                                aria-label="Pick color from screen"
                                title="Pick color from screen (Eyedropper)"
                                onClick={handleEyeDropper}
                                className="ml-auto p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition cursor-pointer"
                            >
                                <Pipette className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </label>
                    <div className="flex h-[205px] gap-3">
                        <div
                            ref={squareRef}
                            role="slider"
                            aria-label="Saturation and brightness"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={Math.round(hsv.v * 100)}
                            aria-valuetext={hexDraft}
                            tabIndex={0}
                            onKeyDown={handleSquareKeyDown}
                            onPointerDown={handleSquarePointerDown}
                            onPointerMove={handleSquarePointerMove}
                            onPointerUp={handleSquarePointerUp}
                            onPointerCancel={handleSquarePointerUp}
                            onLostPointerCapture={handleSquareLostPointerCapture}
                            className="relative min-w-0 flex-1 touch-none cursor-crosshair rounded-xl select-none"
                            style={{ backgroundColor: hueColor, backgroundImage: 'linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)' }}
                        >
                            <span className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_1px_5px_rgba(0,0,0,0.6)]" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }} />
                        </div>
                        <div
                            ref={hueBarRef}
                            role="slider"
                            aria-label="Hue"
                            aria-valuenow={Math.round(hsv.h)}
                            aria-valuemin={0}
                            aria-valuemax={359}
                            tabIndex={0}
                            onKeyDown={(event) => {
                                let newH: number | null = null;
                                if (event.key === 'ArrowUp') {
                                    newH = Math.max(0, hsv.h - 1);
                                } else if (event.key === 'ArrowDown') {
                                    newH = Math.min(359, hsv.h + 1);
                                } else if (event.key === 'Home') {
                                    newH = 0;
                                } else if (event.key === 'End') {
                                    newH = 359;
                                }
                                if (newH !== null) {
                                    event.preventDefault();
                                    const next = { ...hsvRef.current, h: newH };
                                    setHsv(next);
                                    const nextColor = hsvToHex(next);
                                    setHexDraft(nextColor);
                                    onChange(nextColor);
                                }
                            }}
                            onPointerDown={handleHuePointerDown}
                            onPointerMove={handleHuePointerMove}
                            onPointerUp={handleHuePointerUp}
                            onPointerCancel={handleHuePointerUp}
                            onLostPointerCapture={() => {
                                draggingHueRef.current = false;
                            }}
                            className="relative h-full w-[17px] shrink-0 rounded-full select-none cursor-pointer touch-none shadow-inner"
                            style={{ background: 'linear-gradient(to bottom, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)' }}
                        >
                            <span
                                className="pointer-events-none absolute left-1/2 h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_1px_4px_rgba(0,0,0,0.6)]"
                                style={{ top: `${(hsv.h / 359) * 100}%` }}
                            />
                        </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-1.5">
                        {RAYLIGHT_COLOR_PALETTE.map((swatch) => <button key={swatch} type="button" aria-label={`Set color ${swatch}`} title={swatch} onClick={() => commitHex(swatch)} className={`h-6 w-6 shrink-0 rounded-full border transition hover:scale-110 ${hexDraft.toLowerCase() === swatch ? 'border-white ring-1 ring-white/50' : 'border-white/15'}`} style={{ backgroundColor: swatch }} />)}
                    </div>
                    {documentColors.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-white/[0.06] flex items-center justify-between gap-1.5">
                            <span className="text-[10px] text-zinc-500 font-mono">DOC</span>
                            <div className="flex items-center gap-1.5">
                                {documentColors.map((swatch) => (
                                    <button
                                        key={swatch}
                                        type="button"
                                        aria-label={`Set document color ${swatch}`}
                                        title={swatch}
                                        onClick={() => commitHex(swatch)}
                                        className={`h-5 w-5 shrink-0 rounded-full border transition hover:scale-110 ${hexDraft.toLowerCase() === swatch ? 'border-white ring-1 ring-white/50' : 'border-white/15'}`}
                                        style={{ backgroundColor: swatch }}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <div className="space-y-2.5">
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
                            onClick={() => {
                                const sorted = [...gradient.stops].sort((a, b) => a.at - b.at);
                                let at = 0.5;
                                for (let index = 0; index < sorted.length - 1; index++) {
                                    const gap = sorted[index + 1].at - sorted[index].at;
                                    if (gap > 0.01) { at = sorted[index].at + gap / 2; break; }
                                }
                                const newStop: GradientStop = { at, color: '#ffffff', opacity: 1 };
                                const newId = `stop-id-${nextStopId++}`;
                                stopIdMap.set(newStop, newId);
                                updateGradient({ ...gradient, stops: [...gradient.stops, newStop].sort((a, b) => a.at - b.at) });
                            }}
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
            )}
        </div>,
        document.body,
    ) : null;

    const triggerLabel = gradientValue ? 'Gradient' : `${label}: ${color}`;
    return <>
        <button ref={anchorRef} type="button" aria-label={triggerLabel} aria-expanded={open} disabled={disabled} onClick={() => {
            if (disabled) return;
            if (open) {
                setOpen(false);
                onExitGradient?.();
            } else {
                setPickerMode(gradientValue ? 'gradient' : 'color');
                setOpen(true);
                if (gradientValue) onEnterGradient?.();
            }
        }} className={children ? `${className} ${disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}` : `${compact ? 'h-full w-full min-h-[18px] min-w-[18px] rounded border border-white/20' : 'flex h-8 w-full items-center gap-2 rounded-lg border border-[var(--border-subtle,rgba(255,255,255,0.07))] bg-[var(--bg-subtle,#1c1c1f)] px-2 text-left hover:bg-[var(--bg-muted,#242428)] transition-colors duration-100'} ${disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''} ${className}`}>
            {children ? (
                children
            ) : (
                <>
                    <span className={`${compact ? 'block h-full w-full rounded-[inherit]' : 'h-5 w-5 shrink-0 rounded-md border border-white/15'}`} style={{ background: gradientValue ? `linear-gradient(${gradientValue.angle}deg, ${gradientValue.stops.map((stop) => `${stop.color} ${stop.at * 100}%`).join(', ')})` : color }} />
                    {!compact && <span className="font-mono text-[11px] text-[var(--text-primary,#f4f4f5)]">{gradientValue ? 'Gradient' : color.replace(/^#/, '').toUpperCase()}</span>}
                </>
            )}
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
