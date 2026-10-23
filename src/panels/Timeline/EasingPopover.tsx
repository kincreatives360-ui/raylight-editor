// src/panels/Timeline/EasingPopover.tsx
import React, { useCallback, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { Easing } from '../../model/types';
import { ScrubInput } from '../../ui/ScrubInput';

interface EasingPopoverProps {
    easing: Easing;
    onChange: (easing: Easing) => void;
    onClose: () => void;
    anchorRect?: DOMRect | null;
}

// Preset cubic-bezier control points matching Raylight
const PRESET_BEZIERS: { label: string; x1: number; y1: number; x2: number; y2: number }[] = [
    { label: 'Ease In Out', x1: 0.65, y1: 0, x2: 0.35, y2: 1 },
    { label: 'Ease In', x1: 0.42, y1: 0, x2: 1, y2: 1 },
    { label: 'Ease Out', x1: 0, y1: 0, x2: 0.58, y2: 1 },
    { label: 'Linear', x1: 0, y1: 0, x2: 1, y2: 1 },
    { label: 'Ease Back', x1: 0.34, y1: 1.56, x2: 0.64, y2: 1 },
    { label: 'Expo Out', x1: 0.16, y1: 1, x2: 0.3, y2: 1 },
];

export const EasingPopover: React.FC<EasingPopoverProps> = ({
    easing,
    onChange,
    onClose,
    anchorRect,
}) => {
    const popoverRef = useRef<HTMLDivElement | null>(null);
    const svgRef = useRef<SVGSVGElement | null>(null);
    const draggingHandleRef = useRef<'p1' | 'p2' | null>(null);

    // Extract current cubic-bezier coords, defaulting to Raylight standard ease-in-out
    const coords = React.useMemo(() => {
        if (easing.kind === 'bezier') {
            return { x1: easing.x1, y1: easing.y1, x2: easing.x2, y2: easing.y2 };
        }
        if (easing.kind === 'preset') {
            switch (easing.name) {
                case 'linear':
                    return { x1: 0, y1: 0, x2: 1, y2: 1 };
                case 'ease-in':
                    return { x1: 0.42, y1: 0, x2: 1, y2: 1 };
                case 'ease-out':
                    return { x1: 0, y1: 0, x2: 0.58, y2: 1 };
                case 'ease-in-out':
                    return { x1: 0.65, y1: 0, x2: 0.35, y2: 1 };
                case 'ease-in-back':
                    return { x1: 0.36, y1: 0, x2: 0.66, y2: -0.56 };
                case 'ease-out-back':
                    return { x1: 0.34, y1: 1.56, x2: 0.64, y2: 1 };
                case 'ease-in-expo':
                    return { x1: 0.7, y1: 0, x2: 0.84, y2: 0 };
                case 'ease-out-expo':
                    return { x1: 0.16, y1: 1, x2: 0.3, y2: 1 };
                default:
                    return { x1: 0.42, y1: 0, x2: 0.58, y2: 1 };
            }
        }
        return { x1: 0.65, y1: 0, x2: 0.35, y2: 1 };
    }, [easing]);

    const updateCoords = useCallback(
        (partial: Partial<typeof coords>) => {
            const next = { ...coords, ...partial };
            onChange({
                kind: 'bezier',
                x1: Number(Math.max(0, Math.min(1, next.x1)).toFixed(2)),
                y1: Number(Math.max(-0.6, Math.min(1.6, next.y1)).toFixed(2)),
                x2: Number(Math.max(0, Math.min(1, next.x2)).toFixed(2)),
                y2: Number(Math.max(-0.6, Math.min(1.6, next.y2)).toFixed(2)),
            });
        },
        [coords, onChange]
    );

    // Close on click outside or Escape
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                onClose();
            }
        };
        window.addEventListener('mousedown', handleClickOutside);
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);

    // Graph geometry
    const svgW = 216;
    const svgH = 176;
    const padX = 24;
    const padY = 24;
    const graphW = svgW - 2 * padX;
    const graphH = svgH - 2 * padY;

    const toSvgX = (t: number) => padX + t * graphW;
    const toSvgY = (v: number) => padY + graphH - v * graphH;

    const p0 = { x: toSvgX(0), y: toSvgY(0) };
    const p1 = { x: toSvgX(coords.x1), y: toSvgY(coords.y1) };
    const p2 = { x: toSvgX(coords.x2), y: toSvgY(coords.y2) };
    const p3 = { x: toSvgX(1), y: toSvgY(1) };

    const handlePointerDown = (which: 'p1' | 'p2', e: React.PointerEvent) => {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        e.preventDefault();
        e.stopPropagation();
        draggingHandleRef.current = which;
        const pointerId = e.pointerId;

        try {
            (e.currentTarget as Element).setPointerCapture(pointerId);
        } catch {
            // Ignore capture error
        }

        const onMove = (ev: PointerEvent) => {
            if (ev.pointerId !== pointerId || !svgRef.current) return;
            const rect = svgRef.current.getBoundingClientRect();
            const relX = ev.clientX - rect.left;
            const relY = ev.clientY - rect.top;

            const nextT = Math.max(0, Math.min(1, (relX - padX) / graphW));
            const nextV = Math.max(-0.6, Math.min(1.6, (padY + graphH - relY) / graphH));

            if (which === 'p1') {
                updateCoords({ x1: nextT, y1: nextV });
            } else {
                updateCoords({ x2: nextT, y2: nextV });
            }
        };

        const onEnd = (ev: PointerEvent) => {
            if (ev.pointerId !== pointerId) return;
            draggingHandleRef.current = null;
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onEnd);
            window.removeEventListener('pointercancel', onEnd);
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onEnd);
        window.addEventListener('pointercancel', onEnd);
    };

    // Calculate popover positioning if anchorRect is provided
    const style: React.CSSProperties = React.useMemo(() => {
        if (!anchorRect) {
            return {
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 100,
            };
        }
        const top = Math.max(16, Math.min(window.innerHeight - 380, anchorRect.top - 80));
        let left = anchorRect.left - 270;
        if (left < 16) {
            left = anchorRect.right + 12;
        }
        return {
            position: 'fixed',
            top: `${top}px`,
            left: `${left}px`,
            zIndex: 100,
        };
    }, [anchorRect]);

    return (
        <div
            ref={popoverRef}
            style={style}
            role="dialog"
            aria-label="Easing curve editor"
            className="w-[256px] rounded-2xl bg-[#141416] border border-white/10 shadow-2xl p-3 flex flex-col gap-2.5 text-white select-none backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-0.5">
                <span className="text-[12px] font-semibold text-[#f4f4f5] tracking-tight">
                    Easing curve
                </span>
                <button
                    onClick={onClose}
                    className="p-1 rounded-md text-[#a1a1aa] hover:text-white hover:bg-white/10 transition cursor-pointer"
                    title="Close"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Interactive SVG Curve Box */}
            <div className="w-full h-[176px] rounded-xl bg-[#1c1c1f] border border-white/[0.06] overflow-hidden relative flex items-center justify-center">
                <svg
                    ref={svgRef}
                    viewBox={`0 0 ${svgW} ${svgH}`}
                    className="w-full h-full overflow-visible"
                >
                    {/* Grid lines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((frac) => (
                        <g key={frac}>
                            <line
                                x1={toSvgX(0)}
                                y1={toSvgY(frac)}
                                x2={toSvgX(1)}
                                y2={toSvgY(frac)}
                                stroke="rgba(255,255,255,0.06)"
                                strokeWidth="1"
                            />
                            <line
                                x1={toSvgX(frac)}
                                y1={toSvgY(0)}
                                x2={toSvgX(frac)}
                                y2={toSvgY(1)}
                                stroke="rgba(255,255,255,0.06)"
                                strokeWidth="1"
                            />
                        </g>
                    ))}

                    {/* Diagonal Reference */}
                    <line
                        x1={p0.x}
                        y1={p0.y}
                        x2={p3.x}
                        y2={p3.y}
                        stroke="rgba(255,255,255,0.12)"
                        strokeDasharray="3 3"
                        strokeWidth="1"
                    />

                    {/* Right boundary vertical line */}
                    <line
                        x1={p3.x}
                        y1={padY - 8}
                        x2={p3.x}
                        y2={svgH - padY + 8}
                        stroke="rgba(244,63,94,0.3)"
                        strokeWidth="1"
                    />

                    {/* Tangent guide vectors */}
                    <line
                        x1={p0.x}
                        y1={p0.y}
                        x2={p1.x}
                        y2={p1.y}
                        stroke="rgba(255,255,255,0.3)"
                        strokeWidth="1"
                    />
                    <line
                        x1={p3.x}
                        y1={p3.y}
                        x2={p2.x}
                        y2={p2.y}
                        stroke="rgba(255,255,255,0.3)"
                        strokeWidth="1"
                    />

                    {/* Cubic Bezier Curve */}
                    <path
                        d={`M ${p0.x} ${p0.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${p3.x} ${p3.y}`}
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth="2"
                        strokeLinecap="round"
                    />

                    {/* Endpoints */}
                    <circle cx={p0.x} cy={p0.y} r="3" fill="#a1a1aa" />
                    <circle cx={p3.x} cy={p3.y} r="3" fill="#a1a1aa" />

                    {/* Draggable P1 Handle */}
                    <circle
                        cx={p1.x}
                        cy={p1.y}
                        r="6"
                        fill="#0088ff"
                        stroke="#ffffff"
                        strokeWidth="1.5"
                        onPointerDown={(e) => handlePointerDown('p1', e)}
                        className="cursor-pointer hover:scale-125 transition-transform"
                    />

                    {/* Draggable P2 Handle */}
                    <circle
                        cx={p2.x}
                        cy={p2.y}
                        r="6"
                        fill="#0088ff"
                        stroke="#ffffff"
                        strokeWidth="1.5"
                        onPointerDown={(e) => handlePointerDown('p2', e)}
                        className="cursor-pointer hover:scale-125 transition-transform"
                    />
                </svg>
            </div>

            {/* Quick Presets Strip */}
            <div className="grid grid-cols-3 gap-1">
                {PRESET_BEZIERS.map((preset) => {
                    const isActive =
                        Math.abs(coords.x1 - preset.x1) < 0.05 &&
                        Math.abs(coords.y1 - preset.y1) < 0.05 &&
                        Math.abs(coords.x2 - preset.x2) < 0.05 &&
                        Math.abs(coords.y2 - preset.y2) < 0.05;
                    return (
                        <button
                            key={preset.label}
                            onClick={() =>
                                onChange({
                                    kind: 'bezier',
                                    x1: preset.x1,
                                    y1: preset.y1,
                                    x2: preset.x2,
                                    y2: preset.y2,
                                })
                            }
                            className={`h-5 px-1.5 rounded text-[9.5px] font-medium truncate cursor-pointer transition ${
                                isActive
                                    ? 'bg-[#0088ff] text-white'
                                    : 'bg-[#1c1c1f] text-[#a1a1aa] hover:text-white hover:bg-[#27272c]'
                            }`}
                        >
                            {preset.label}
                        </button>
                    );
                })}
            </div>

            {/* Coordinate Inputs (X1, Y1, X2, Y2) */}
            <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                <ScrubInput
                    label="X1"
                    value={coords.x1}
                    min={0}
                    max={1}
                    step={0.01}
                    decimals={2}
                    onChange={(x1) => updateCoords({ x1 })}
                />
                <ScrubInput
                    label="Y1"
                    value={coords.y1}
                    min={-0.6}
                    max={1.6}
                    step={0.01}
                    decimals={2}
                    onChange={(y1) => updateCoords({ y1 })}
                />
                <ScrubInput
                    label="X2"
                    value={coords.x2}
                    min={0}
                    max={1}
                    step={0.01}
                    decimals={2}
                    onChange={(x2) => updateCoords({ x2 })}
                />
                <ScrubInput
                    label="Y2"
                    value={coords.y2}
                    min={-0.6}
                    max={1.6}
                    step={0.01}
                    decimals={2}
                    onChange={(y2) => updateCoords({ y2 })}
                />
            </div>
        </div>
    );
};
