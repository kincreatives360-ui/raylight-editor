// src/ui/ScrubInput.tsx
import React, { useState, useRef } from 'react';
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

    const clampAndRound = (raw: number) => {
        const clamped = Math.max(min, Math.min(max, raw));
        const factor = Math.pow(10, decimals);
        return Math.round(clamped * factor) / factor;
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (isEditing) return;
        e.preventDefault();
        startXRef.current = e.clientX;
        startValRef.current = value;
        let moved = false;

        beginDragTransaction();

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const dx = moveEvent.clientX - startXRef.current;
            if (Math.abs(dx) > 2) moved = true;
            const multiplier = moveEvent.shiftKey
                ? 10
                : moveEvent.altKey
                    ? 0.1
                    : 1;
            const delta = dx * step * multiplier * 0.5;
            onChange(clampAndRound(startValRef.current + delta));
        };

        const handleMouseUp = () => {
            commitDragTransaction();
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            if (!moved) {
                setInputText(value.toFixed(decimals));
                setIsEditing(true);
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    const commitTextInput = () => {
        setIsEditing(false);
        const parsed = parseFloat(inputText);
        if (!Number.isNaN(parsed)) {
            onChange(clampAndRound(parsed));
        }
    };

    return (
        <div
            onMouseDown={handleMouseDown}
            onDoubleClick={() => {
                setInputText(value.toFixed(decimals));
                setIsEditing(true);
            }}
            title="Drag left/right to scrub, or click to type exact value"
            className="h-7 px-2.5 rounded-lg bg-[#1c1c1f] hover:bg-[#242429] border border-transparent focus-within:border-[#0088ff] flex items-center gap-2 cursor-ew-resize select-none transition"
        >
            <span className="text-[11px] text-[#71717a] font-medium shrink-0">
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
                    className="w-full bg-transparent text-[11px] font-mono text-white outline-none"
                />
            ) : (
                <span className="text-[11px] font-mono text-[#e4e4e7] truncate">
                    {value.toFixed(decimals)}
                    {unit}
                </span>
            )}
        </div>
    );
};