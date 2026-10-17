// src/components/EasingCurvePicker.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { Easing, PresetEasingName } from '../model/types';
import { evaluateEasing, ALL_18_EASINGS } from '../engine/easing';
import { Play, ChevronDown, Check, Sparkles } from 'lucide-react';

interface EasingCurvePickerProps {
    value: Easing;
    onChange: (easing: Easing) => void;
    compact?: boolean;
    label?: string;
}

// Curated signature bezier presets
const SIGNATURE_BEZIERS = [
    { label: 'Raylight Snap', desc: 'Punchy camera & UI snap', x1: 0.16, y1: 1.0, x2: 0.3, y2: 1.0 },
    { label: 'Smooth Out', desc: 'Gentle deceleration', x1: 0.25, y1: 1.0, x2: 0.5, y2: 1.0 },
    { label: 'Slow-Fast-Slow', desc: 'Cinematic center acceleration', x1: 0.85, y1: 0.0, x2: 0.15, y2: 1.0 },
    { label: 'Anticipate Whip', desc: 'Subtle pull-back before shoot', x1: 0.6, y1: -0.28, x2: 0.74, y2: 0.05 },
];

export const EasingCurvePicker: React.FC<EasingCurvePickerProps> = ({
    value,
    onChange,
    compact: _compact = false,
    label = 'Easing Curve',
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const activeCategory = value.kind;
    const [previewProgress, setPreviewProgress] = useState(1);
    const [isPlaying, setIsPlaying] = useState(false);
    const animRef = useRef<number | null>(null);

    // Handle interactive drag on SVG canvas for cubic-bezier handles
    const svgRef = useRef<SVGSVGElement | null>(null);
    const [draggingPoint, setDraggingPoint] = useState<'p1' | 'p2' | null>(null);

    const handlePointerDown = (point: 'p1' | 'p2', e: React.PointerEvent) => {
        e.stopPropagation();
        e.preventDefault();
        (e.target as Element).setPointerCapture(e.pointerId);
        setDraggingPoint(point);
    };

    const handlePointerMove = useCallback(
        (e: React.PointerEvent) => {
            if (!draggingPoint || !svgRef.current || value.kind !== 'bezier') return;
            const rect = svgRef.current.getBoundingClientRect();
            // Normalized 0..1 in width and 0..1 in height (where y=0 is at bottom, y=1 is at top)
            const rawX = (e.clientX - rect.left) / rect.width;
            const rawY = 1 - (e.clientY - rect.top) / rect.height;

            const x = Math.max(0, Math.min(1, Number(rawX.toFixed(2))));
            const y = Math.max(-0.5, Math.min(1.5, Number(rawY.toFixed(2))));

            if (draggingPoint === 'p1') {
                onChange({
                    kind: 'bezier',
                    x1: x,
                    y1: y,
                    x2: value.x2,
                    y2: value.y2,
                });
            } else {
                onChange({
                    kind: 'bezier',
                    x1: value.x1,
                    y1: value.y1,
                    x2: x,
                    y2: y,
                });
            }
        },
        [draggingPoint, onChange, value]
    );

    const handlePointerUp = (e: React.PointerEvent) => {
        if (draggingPoint) {
            try {
                (e.target as Element).releasePointerCapture(e.pointerId);
            } catch {
                // Ignore if not captured
            }
            setDraggingPoint(null);
        }
    };

    // Playback preview loop
    const playPreview = () => {
        if (animRef.current) cancelAnimationFrame(animRef.current);
        setIsPlaying(true);
        const startTime = performance.now();
        const duration = 1000;

        const loop = (now: number) => {
            const elapsed = now - startTime;
            const raw = Math.min(1, elapsed / duration);
            setPreviewProgress(raw);

            if (raw < 1) {
                animRef.current = requestAnimationFrame(loop);
            } else {
                setIsPlaying(false);
            }
        };

        animRef.current = requestAnimationFrame(loop);
    };

    useEffect(() => {
        return () => {
            if (animRef.current) cancelAnimationFrame(animRef.current);
        };
    }, []);

    // Helper to generate SVG polyline points for any easing
    const generateCurvePoints = (easing: Easing, width = 100, height = 50, padY = 8) => {
        const samples = 36;
        const availableH = height - padY * 2;
        const pts: string[] = [];

        for (let i = 0; i <= samples; i++) {
            const t = i / samples;
            const yVal = evaluateEasing(t, easing);
            const px = (t * width).toFixed(1);
            // Invert Y so 0 is bottom and 1 is top
            const py = (height - padY - yVal * availableH).toFixed(1);
            pts.push(`${px},${py}`);
        }
        return pts.join(' ');
    };

    // Current label display
    const getEasingLabel = () => {
        if (value.kind === 'preset') {
            const item = ALL_18_EASINGS.find(
                (e) => e.easing.kind === 'preset' && e.easing.name === value.name
            );
            return item ? item.label : `Preset: ${value.name}`;
        }
        if (value.kind === 'spring') {
            return `Spring: ${value.name.charAt(0).toUpperCase() + value.name.slice(1)}`;
        }
        // Custom Bezier
        const matchSig = SIGNATURE_BEZIERS.find(
            (b) =>
                Math.abs(b.x1 - value.x1) < 0.05 &&
                Math.abs(b.y1 - value.y1) < 0.05 &&
                Math.abs(b.x2 - value.x2) < 0.05 &&
                Math.abs(b.y2 - value.y2) < 0.05
        );
        return matchSig ? matchSig.label : `Bezier (${value.x1.toFixed(2)}, ${value.y1.toFixed(2)}, ${value.x2.toFixed(2)}, ${value.y2.toFixed(2)})`;
    };

    const currentEasedProgress = evaluateEasing(previewProgress, value);

    return (
        <div className="space-y-1.5 select-none font-sans text-xs">
            {/* COMPACT TRIGGER / SUMMARY HEADER */}
            <div className="flex items-center justify-between gap-1.5">
                {label && (
                    <span className="text-[10px] uppercase font-semibold tracking-wider text-gray-400">
                        {label}
                    </span>
                )}
                <button
                    type="button"
                    onClick={() => setIsOpen((v) => !v)}
                    className="flex-1 flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-black/50 border border-white/10 hover:border-white/25 hover:bg-white/5 transition cursor-pointer text-left group"
                >
                    <div className="flex items-center gap-2 min-w-0">
                        {/* Mini SVG Curve Preview */}
                        <div className="w-7 h-4 rounded bg-black/60 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center p-0.5">
                            <svg viewBox="0 0 100 50" className="w-full h-full overflow-visible">
                                <polyline
                                    fill="none"
                                    stroke="#38bdf8"
                                    strokeWidth="3.5"
                                    strokeLinecap="round"
                                    points={generateCurvePoints(value, 100, 50, 4)}
                                />
                            </svg>
                        </div>
                        <span className="text-white text-[11px] font-medium truncate group-hover:text-sky-300 transition">
                            {getEasingLabel()}
                        </span>
                    </div>
                    <ChevronDown
                        className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 shrink-0 ${
                            isOpen ? 'rotate-180 text-white' : ''
                        }`}
                    />
                </button>
            </div>

            {/* EXPANDABLE FULL VISUAL CURVE PICKER MODAL / DRAWER */}
            {isOpen && (
                <div className="p-3 rounded-xl bg-[#090b11] border border-sky-500/30 shadow-2xl space-y-3 mt-1.5 animate-in fade-in zoom-in-95 duration-150">
                    {/* Top Category Tabs */}
                    <div className="flex items-center p-0.5 rounded-lg bg-black/60 border border-white/10 text-[10px]">
                        <button
                            type="button"
                            onClick={() => {
                                if (value.kind !== 'bezier') {
                                    onChange({ kind: 'bezier', x1: 0.16, y1: 1.0, x2: 0.3, y2: 1.0 });
                                }
                            }}
                            className={`flex-1 py-1 rounded-md font-semibold transition cursor-pointer flex items-center justify-center gap-1 ${
                                activeCategory === 'bezier'
                                    ? 'bg-sky-500 text-white shadow-sm'
                                    : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            <Sparkles className="w-3 h-3" /> Bezier Curve
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                if (value.kind !== 'spring') {
                                    onChange({ kind: 'spring', name: 'gentle' });
                                }
                            }}
                            className={`flex-1 py-1 rounded-md font-semibold transition cursor-pointer ${
                                activeCategory === 'spring'
                                    ? 'bg-sky-500 text-white shadow-sm'
                                    : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            Spring Physics
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                if (value.kind !== 'preset') {
                                    onChange({ kind: 'preset', name: 'ease-out' });
                                }
                            }}
                            className={`flex-1 py-1 rounded-md font-semibold transition cursor-pointer ${
                                activeCategory === 'preset'
                                    ? 'bg-sky-500 text-white shadow-sm'
                                    : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            Presets (11)
                        </button>
                    </div>

                    {/* MAIN INTERACTIVE GRAPH CANVAS */}
                    <div className="relative rounded-xl bg-black/80 border border-white/10 p-2 overflow-hidden flex flex-col items-center">
                        {/* Coordinate Grid / Axis Background */}
                        <svg
                            ref={svgRef}
                            viewBox="0 0 100 60"
                            onPointerMove={handlePointerMove}
                            onPointerUp={handlePointerUp}
                            className="w-full h-32 overflow-visible touch-none cursor-crosshair select-none"
                        >
                            <defs>
                                <linearGradient id="curveGradient" x1="0" y1="0" x2="1" y2="0">
                                    <stop offset="0%" stopColor="#38bdf8" />
                                    <stop offset="100%" stopColor="#818cf8" />
                                </linearGradient>
                            </defs>

                            {/* Background Grid Lines (0.25, 0.5, 0.75) */}
                            <line x1="0" y1="52" x2="100" y2="52" stroke="rgba(255,255,255,0.12)" strokeWidth="0.8" />
                            <line x1="0" y1="8" x2="100" y2="8" stroke="rgba(255,255,255,0.12)" strokeWidth="0.8" />
                            <line x1="0" y1="30" x2="100" y2="30" stroke="rgba(255,255,255,0.06)" strokeDasharray="2,2" strokeWidth="0.5" />
                            <line x1="50" y1="8" x2="50" y2="52" stroke="rgba(255,255,255,0.06)" strokeDasharray="2,2" strokeWidth="0.5" />
                            <line x1="0" y1="52" x2="100" y2="8" stroke="rgba(255,255,255,0.04)" strokeDasharray="1,2" strokeWidth="0.5" />

                            {/* Evaluated Curve */}
                            <polyline
                                fill="none"
                                stroke="url(#curveGradient)"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                points={generateCurvePoints(value, 100, 60, 8)}
                            />

                            {/* If Cubic Bezier: Draw interactive handles */}
                            {value.kind === 'bezier' && (
                                <>
                                    {/* Handle Line 1: (0, 52) to P1 */}
                                    <line
                                        x1="0"
                                        y1="52"
                                        x2={value.x1 * 100}
                                        y2={52 - value.y1 * 44}
                                        stroke="#38bdf8"
                                        strokeWidth="1.2"
                                        strokeDasharray="2,2"
                                    />
                                    {/* Handle Line 2: (100, 8) to P2 */}
                                    <line
                                        x1="100"
                                        y1="8"
                                        x2={value.x2 * 100}
                                        y2={52 - value.y2 * 44}
                                        stroke="#818cf8"
                                        strokeWidth="1.2"
                                        strokeDasharray="2,2"
                                    />

                                    {/* Anchor Point 0 (0, 52) */}
                                    <circle cx="0" cy="52" r="2.5" fill="#38bdf8" />
                                    {/* Anchor Point 1 (100, 8) */}
                                    <circle cx="100" cy="8" r="2.5" fill="#818cf8" />

                                    {/* Draggable P1 Handle */}
                                    <g
                                        onPointerDown={(e) => handlePointerDown('p1', e)}
                                        className="cursor-grab active:cursor-grabbing"
                                    >
                                        <circle
                                            cx={value.x1 * 100}
                                            cy={52 - value.y1 * 44}
                                            r="5.5"
                                            fill="#0284c7"
                                            stroke="#38bdf8"
                                            strokeWidth="2"
                                        />
                                        <circle
                                            cx={value.x1 * 100}
                                            cy={52 - value.y1 * 44}
                                            r="1.8"
                                            fill="#ffffff"
                                        />
                                    </g>

                                    {/* Draggable P2 Handle */}
                                    <g
                                        onPointerDown={(e) => handlePointerDown('p2', e)}
                                        className="cursor-grab active:cursor-grabbing"
                                    >
                                        <circle
                                            cx={value.x2 * 100}
                                            cy={52 - value.y2 * 44}
                                            r="5.5"
                                            fill="#4f46e5"
                                            stroke="#818cf8"
                                            strokeWidth="2"
                                        />
                                        <circle
                                            cx={value.x2 * 100}
                                            cy={52 - value.y2 * 44}
                                            r="1.8"
                                            fill="#ffffff"
                                        />
                                    </g>
                                </>
                            )}
                        </svg>

                        {/* Interactive Live Motion Preview Track */}
                        <div className="w-full mt-2 pt-2 border-t border-white/10 flex items-center gap-2">
                            <button
                                type="button"
                                onClick={playPreview}
                                title="Play easing motion preview"
                                className={`p-1 rounded-md text-sky-300 border cursor-pointer transition flex items-center justify-center shrink-0 ${
                                    isPlaying
                                        ? 'bg-sky-500/40 border-sky-400 ring-1 ring-sky-400 animate-pulse'
                                        : 'bg-sky-500/20 hover:bg-sky-500/30 border-sky-500/40'
                                }`}
                            >
                                <Play className="w-3 h-3 fill-current" />
                            </button>

                            {/* Runner Track */}
                            <div className="flex-1 h-3 rounded-full bg-white/5 border border-white/10 relative overflow-hidden flex items-center px-1">
                                <div
                                    className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-sky-400 to-indigo-400 shadow-[0_0_8px_rgba(56,189,248,0.8)] transition-all ease-linear"
                                    style={{
                                        transform: `translateX(${Math.max(
                                            0,
                                            Math.min(100, currentEasedProgress * 100)
                                        )}%)`,
                                    }}
                                />
                            </div>

                            <span className="text-[10px] font-mono text-gray-400 shrink-0 w-8 text-right">
                                {(currentEasedProgress * 100).toFixed(0)}%
                            </span>
                        </div>
                    </div>

                    {/* CATEGORY 1: BEZIER PRESETS & NUMERICAL SCRUBBERS */}
                    {activeCategory === 'bezier' && value.kind === 'bezier' && (
                        <div className="space-y-2">
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                                Signature Bezier Curves
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                                {SIGNATURE_BEZIERS.map((sig) => {
                                    const isSelected =
                                        Math.abs(sig.x1 - value.x1) < 0.05 &&
                                        Math.abs(sig.y1 - value.y1) < 0.05 &&
                                        Math.abs(sig.x2 - value.x2) < 0.05 &&
                                        Math.abs(sig.y2 - value.y2) < 0.05;
                                    return (
                                        <button
                                            key={sig.label}
                                            type="button"
                                            onClick={() =>
                                                onChange({
                                                    kind: 'bezier',
                                                    x1: sig.x1,
                                                    y1: sig.y1,
                                                    x2: sig.x2,
                                                    y2: sig.y2,
                                                })
                                            }
                                            className={`p-2 rounded-lg border text-left cursor-pointer transition flex flex-col justify-between ${
                                                isSelected
                                                    ? 'bg-sky-500/20 border-sky-400 text-white'
                                                    : 'bg-black/40 border-white/10 text-gray-400 hover:text-white hover:bg-white/5'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between w-full">
                                                <span className="font-semibold text-[11px] truncate">{sig.label}</span>
                                                {isSelected && <Check className="w-3 h-3 text-sky-400 shrink-0" />}
                                            </div>
                                            <span className="text-[9px] text-gray-400 line-clamp-1">{sig.desc}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Direct Coordinate Inputs */}
                            <div className="grid grid-cols-4 gap-1 pt-1 border-t border-white/10">
                                {(['x1', 'y1', 'x2', 'y2'] as const).map((key) => (
                                    <div key={key} className="space-y-0.5">
                                        <span className="text-[9px] font-mono text-gray-400 uppercase">{key}</span>
                                        <input
                                            type="number"
                                            step={0.02}
                                            min={key.startsWith('x') ? 0 : -0.5}
                                            max={key.startsWith('x') ? 1 : 1.5}
                                            value={value[key]}
                                            onChange={(e) =>
                                                onChange({
                                                    ...value,
                                                    [key]: Number(parseFloat(e.target.value || '0').toFixed(2)),
                                                })
                                            }
                                            className="w-full px-1.5 py-1 rounded bg-black/60 border border-white/15 text-white text-[10px] font-mono outline-none focus:border-sky-400"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* CATEGORY 2: PHYSICS SPRINGS */}
                    {activeCategory === 'spring' && (
                        <div className="space-y-1.5">
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                                Natural Harmonic Springs
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                                {(
                                    [
                                        { name: 'gentle', label: 'Gentle Spring', desc: 'Smooth resting glide' },
                                        { name: 'quick', label: 'Quick Spring', desc: 'Snappy UI response' },
                                        { name: 'bouncy', label: 'Bouncy Spring', desc: 'Fun energetic overshoot' },
                                        { name: 'slow', label: 'Slow Spring', desc: 'Heavy cinematic mass' },
                                    ] as const
                                ).map((spr) => {
                                    const isSelected = value.kind === 'spring' && value.name === spr.name;
                                    return (
                                        <button
                                            key={spr.name}
                                            type="button"
                                            onClick={() => onChange({ kind: 'spring', name: spr.name })}
                                            className={`p-2 rounded-lg border text-left cursor-pointer transition flex flex-col justify-between ${
                                                isSelected
                                                    ? 'bg-sky-500/20 border-sky-400 text-white'
                                                    : 'bg-black/40 border-white/10 text-gray-400 hover:text-white hover:bg-white/5'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between w-full">
                                                <span className="font-semibold text-[11px]">{spr.label}</span>
                                                {isSelected && <Check className="w-3 h-3 text-sky-400 shrink-0" />}
                                            </div>
                                            <span className="text-[9px] text-gray-400">{spr.desc}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* CATEGORY 3: STANDARD 11 PRESETS */}
                    {activeCategory === 'preset' && (
                        <div className="space-y-1.5">
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                                Standard Timing Presets
                            </div>
                            <div className="grid grid-cols-3 gap-1 max-h-44 overflow-y-auto pr-1">
                                {(
                                    [
                                        'ease-out',
                                        'ease-in-out',
                                        'ease-in',
                                        'ease-out-back',
                                        'ease-in-back',
                                        'ease-in-out-back',
                                        'ease-out-expo',
                                        'ease-in-expo',
                                        'bounce',
                                        'linear',
                                        'hold',
                                    ] as PresetEasingName[]
                                ).map((pName) => {
                                    const isSelected = value.kind === 'preset' && value.name === pName;
                                    return (
                                        <button
                                            key={pName}
                                            type="button"
                                            onClick={() => onChange({ kind: 'preset', name: pName })}
                                            className={`p-1.5 rounded-lg border text-center cursor-pointer transition text-[10px] font-medium truncate ${
                                                isSelected
                                                    ? 'bg-sky-500/20 border-sky-400 text-white'
                                                    : 'bg-black/40 border-white/10 text-gray-400 hover:text-white hover:bg-white/5'
                                            }`}
                                        >
                                            {pName}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Quick Done Button */}
                    <div className="pt-2 border-t border-white/10 flex items-center justify-end">
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="px-3 py-1 rounded-md bg-white/10 hover:bg-white/20 text-white font-medium text-[11px] cursor-pointer transition"
                        >
                            Done
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
