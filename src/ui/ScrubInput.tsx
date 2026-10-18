// src/ui/ScrubInput.tsx
import React, { useState, useRef, useCallback } from 'react';
import { useProjectStore } from '../store/useProjectStore';

interface ScrubInputProps {
    label: React.ReactNode;
    value: number;
    min?: number;
    max?: number;
    step?: number;
    decimals?: number;
    unit?: string;
    onChange: (newValue: number) => void;
}

export const ScrubInput: React.FC<ScrubInputProps> = ({
    label,
    value,
    min = -Infinity,
    max = Infinity,
    step = 1,
    decimals = 0,
    unit = '',
    onChange,
}) => {
    const { beginDragTransaction, commitDragTransaction } = useProjectStore();
    const [isEditing, setIsEditing] = useState(false);
    const [inputText, setInputText] = useState('');
    const startXRef = useRef<number>(0);
    const startValRef = useRef<number>(value);
    const movedRef = useRef<boolean>(false);
    const activePointerIdRef = useRef<number | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);

    const clampAndRound = useCallback(
        (raw: number) => {
            const clamped = Math.max(min, Math.min(max, raw));
            const factor = Math.pow(10, decimals);
            return Math.round(clamped * factor) / factor;
        },
        [min, max, decimals]
    );

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (isEditing) return;
        // Only primary pointer (e.g. left click or first touch)
        if (e.button !== 0 && e.pointerType === 'mouse') return;

        startXRef.current = e.clientX;
        startValRef.current = value;
        movedRef.current = false;
        activePointerIdRef.current = e.pointerId;

        try {
            e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
            // Ignore capture failure in environments that don't support it
        }

        beginDragTransaction();
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (activePointerIdRef.current !== e.pointerId) return;

        const dx = e.clientX - startXRef.current;
        if (Math.abs(dx) > 2) {
            movedRef.current = true;
        }

        const multiplier = e.shiftKey ? 10 : e.altKey ? 0.1 : 1;
        const delta = dx * step * multiplier * 0.5;
        onChange(clampAndRound(startValRef.current + delta));
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (activePointerIdRef.current !== e.pointerId) return;
        activePointerIdRef.current = null;

        try {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                e.currentTarget.releasePointerCapture(e.pointerId);
            }
        } catch {
            // Ignore release failure
        }

        commitDragTransaction();

        if (!movedRef.current) {
            setInputText(value.toFixed(decimals));
            setIsEditing(true);
        }
    };

    const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
        if (activePointerIdRef.current !== e.pointerId) return;
        activePointerIdRef.current = null;
        try {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                e.currentTarget.releasePointerCapture(e.pointerId);
            }
        } catch {
            // Ignore
        }
        commitDragTransaction();
    };

    const commitTextInput = () => {
        setIsEditing(false);
        const parsed = parseFloat(inputText);
        if (!Number.isNaN(parsed)) {
            onChange(clampAndRound(parsed));
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (isEditing) return;

        const stepMultiplier = e.shiftKey ? 10 : e.altKey ? 0.1 : 1;
        const effectiveStep = step * stepMultiplier;

        if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
            e.preventDefault();
            beginDragTransaction();
            onChange(clampAndRound(value + effectiveStep));
            commitDragTransaction();
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
            e.preventDefault();
            beginDragTransaction();
            onChange(clampAndRound(value - effectiveStep));
            commitDragTransaction();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            setInputText(value.toFixed(decimals));
            setIsEditing(true);
        }
    };

    const labelString = typeof label === 'string' ? label : undefined;

    return (
        <div
            ref={containerRef}
            role="spinbutton"
            tabIndex={isEditing ? -1 : 0}
            aria-label={labelString}
            aria-valuenow={value}
            aria-valuemin={Number.isFinite(min) ? min : undefined}
            aria-valuemax={Number.isFinite(max) ? max : undefined}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onKeyDown={handleKeyDown}
            onDoubleClick={() => {
                setInputText(value.toFixed(decimals));
                setIsEditing(true);
            }}
            title="Drag left/right to scrub, use arrow keys, or click/press Enter to type exact value"
            style={{ touchAction: 'none' }}
            className="h-7 px-2.5 rounded-lg bg-[#1c1c1f] hover:bg-[#242429] border border-transparent focus-visible:outline-none focus-visible:border-[#0088ff] focus-visible:ring-1 focus-visible:ring-[#0088ff] flex items-center gap-2 cursor-ew-resize select-none transition"
        >
            <span className="text-[11px] text-[#a1a1aa] font-medium tracking-tight shrink-0 select-none">
                {label}
            </span>

            {isEditing ? (
                <input
                    type="text"
                    autoFocus
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onBlur={commitTextInput}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') commitTextInput();
                        if (e.key === 'Escape') setIsEditing(false);
                    }}
                    className="w-full bg-transparent text-[11px] font-mono tabular-nums text-white outline-none tracking-tight"
                />
            ) : (
                <span className="text-[11px] font-mono tabular-nums text-[#f4f4f5] truncate tracking-tight">
                    {value.toFixed(decimals)}
                    {unit}
                </span>
            )}
        </div>
    );
};