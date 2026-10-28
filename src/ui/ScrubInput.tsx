// src/ui/ScrubInput.tsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useProjectStore } from '../store/useProjectStore';

const DRAG_THRESHOLD = 3;

interface ScrubInputProps {
    'aria-label'?: string;
    label: React.ReactNode;
    value: number;
    min?: number;
    max?: number;
    step?: number;
    decimals?: number;
    unit?: string;
    onChange: (newValue: number) => void;
    className?: string;
}

function inferStepDecimals(stepValue: number): number {
    if (!Number.isFinite(stepValue) || stepValue <= 0) return 0;
    const str = stepValue.toString().toLowerCase();
    if (str.includes('e-')) {
        const [base, exp] = str.split('e-');
        const baseDecimals = base.includes('.') ? (base.split('.')[1]?.length ?? 0) : 0;
        const exponent = parseInt(exp, 10) || 0;
        return Math.min(20, baseDecimals + exponent);
    }
    if (str.includes('.')) {
        return Math.min(20, str.split('.')[1]?.length ?? 0);
    }
    return 0;
}

// eslint-disable-next-line react-refresh/only-export-components
export function evaluateMathExpression(expr: string): number | null {
    const cleaned = expr.trim().replace(/,/g, '');
    if (!cleaned) return null;
    const direct = Number(cleaned);
    if (!Number.isNaN(direct)) return direct;

    const tokens: string[] = [];
    let i = 0;
    while (i < cleaned.length) {
        const ch = cleaned[i];
        if (/\s/.test(ch)) {
            i++;
        } else if ('+-*/()'.includes(ch)) {
            tokens.push(ch);
            i++;
        } else if (/[\d.]/.test(ch)) {
            let numStr = '';
            while (i < cleaned.length && /[\d.]/.test(cleaned[i])) {
                numStr += cleaned[i];
                i++;
            }
            tokens.push(numStr);
        } else {
            return null;
        }
    }

    let pos = 0;
    function parsePrimary(): number {
        const token = tokens[pos++];
        if (!token) throw new Error('Unexpected end');
        if (token === '(') {
            const val = parseAddSub();
            if (tokens[pos++] !== ')') throw new Error('Expected )');
            return val;
        }
        if (token === '-') {
            return -parsePrimary();
        }
        if (token === '+') {
            return parsePrimary();
        }
        const num = parseFloat(token);
        if (Number.isNaN(num)) throw new Error('Invalid number');
        return num;
    }

    function parseMulDiv(): number {
        let left = parsePrimary();
        while (pos < tokens.length && (tokens[pos] === '*' || tokens[pos] === '/')) {
            const op = tokens[pos++];
            const right = parsePrimary();
            if (op === '*') left *= right;
            else if (op === '/') {
                if (right === 0) return 0;
                left /= right;
            }
        }
        return left;
    }

    function parseAddSub(): number {
        let left = parseMulDiv();
        while (pos < tokens.length && (tokens[pos] === '+' || tokens[pos] === '-')) {
            const op = tokens[pos++];
            const right = parseMulDiv();
            if (op === '+') left += right;
            else if (op === '-') left -= right;
        }
        return left;
    }

    try {
        const res = parseAddSub();
        return pos === tokens.length && Number.isFinite(res) ? res : null;
    } catch {
        const fallback = parseFloat(cleaned);
        return Number.isFinite(fallback) ? fallback : null;
    }
}

export const ScrubInput: React.FC<ScrubInputProps> = ({
    'aria-label': ariaLabel,
    label,
    value,
    min = -Infinity,
    max = Infinity,
    step = 1,
    decimals,
    unit = '',
    onChange,
    className,
}) => {
    const { beginDragTransaction, commitDragTransaction } = useProjectStore();
    const [isEditing, setIsEditing] = useState(false);
    const [isScrubbing, setIsScrubbing] = useState(false);
    const [inputText, setInputText] = useState('');

    const startXRef = useRef<number>(0);
    const startValRef = useRef<number>(0);
    const hasDraggedRef = useRef<boolean>(false);
    const isDragTransactionActiveRef = useRef<boolean>(false);
    const activePointerIdRef = useRef<number | null>(null);
    const isCanceledRef = useRef<boolean>(false);
    const isCommittedRef = useRef<boolean>(false);

    const containerRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);

    const safeValue = Number.isFinite(value) ? value : (Number.isFinite(min) ? min : 0);

    const autoDecimals = inferStepDecimals(step);
    const effectiveDecimals = decimals !== undefined ? decimals : autoDecimals;

    const clampAndRound = useCallback(
        (raw: number) => {
            const clamped = Math.max(min, Math.min(max, raw));
            const factor = Math.pow(10, effectiveDecimals);
            return Math.round(clamped * factor) / factor;
        },
        [min, max, effectiveDecimals]
    );

    // Reset document cursor on unmount if component unmounts mid-scrub
    useEffect(() => {
        return () => {
            if (isDragTransactionActiveRef.current) {
                isDragTransactionActiveRef.current = false;
                commitDragTransaction();
            }
            if (typeof document !== 'undefined') {
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        };
    }, [commitDragTransaction]);

    // Focus & select all text when entering edit mode
    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const startEditing = () => {
        isCanceledRef.current = false;
        isCommittedRef.current = false;
        setInputText(safeValue.toFixed(effectiveDecimals));
        setIsEditing(true);
    };

    const commitTextInput = () => {
        if (isCanceledRef.current || isCommittedRef.current) return;
        isCommittedRef.current = true;
        setIsEditing(false);

        const evaluated = evaluateMathExpression(inputText);
        if (evaluated !== null && Number.isFinite(evaluated)) {
            onChange(clampAndRound(evaluated));
        }
    };

    const cancelTextInput = () => {
        isCanceledRef.current = true;
        setIsEditing(false);
        containerRef.current?.focus();
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (isEditing) return;
        if (e.button !== 0 && e.pointerType === 'mouse') return;

        startXRef.current = e.clientX;
        startValRef.current = safeValue;
        hasDraggedRef.current = false;
        activePointerIdRef.current = e.pointerId;

        try {
            e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
            // Ignore capture failure in environments that don't support it
        }
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (activePointerIdRef.current !== e.pointerId) return;

        const dx = e.clientX - startXRef.current;

        if (!hasDraggedRef.current) {
            if (Math.abs(dx) < DRAG_THRESHOLD) {
                return;
            }
            hasDraggedRef.current = true;
            setIsScrubbing(true);

            if (typeof document !== 'undefined') {
                document.body.style.cursor = 'ew-resize';
                document.body.style.userSelect = 'none';
            }

            beginDragTransaction();
            isDragTransactionActiveRef.current = true;
        }

        const multiplier = e.shiftKey ? 10 : e.altKey ? 0.1 : 1;
        const delta = (dx - Math.sign(dx) * DRAG_THRESHOLD) * step * multiplier * 0.5;
        onChange(clampAndRound(startValRef.current + delta));
    };

    const finishPointerDrag = (e: React.PointerEvent<HTMLDivElement>): boolean => {
        if (activePointerIdRef.current !== e.pointerId) return false;
        activePointerIdRef.current = null;
        setIsScrubbing(false);

        if (typeof document !== 'undefined') {
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }

        try {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                e.currentTarget.releasePointerCapture(e.pointerId);
            }
        } catch {
            // Ignore release failure
        }

        if (isDragTransactionActiveRef.current) {
            isDragTransactionActiveRef.current = false;
            commitDragTransaction();
        }

        return true;
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        const didDrag = hasDraggedRef.current;
        if (!finishPointerDrag(e)) return;

        if (!didDrag) {
            // User performed a click without dragging -> open inline editor
            startEditing();
        }
    };

    const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
        finishPointerDrag(e);
    };

    const handleLostPointerCapture = (e: React.PointerEvent<HTMLDivElement>) => {
        finishPointerDrag(e);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (isEditing) {
            e.stopPropagation();
            return;
        }

        // Escape: blur spinbutton so global shortcuts don't fire
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            (e.currentTarget as HTMLElement).blur();
            return;
        }

        // Prevent spinbutton focus from leaking hotkeys (Space, Backspace, Delete) to global stage
        if (e.code === 'Space' || e.key === 'Backspace' || e.key === 'Delete') {
            e.stopPropagation();
            e.preventDefault();
            if (e.code === 'Space') {
                startEditing();
            }
            return;
        }

        const stepMultiplier = e.shiftKey ? 10 : e.altKey ? 0.1 : 1;
        const effectiveStep = step * stepMultiplier;

        if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
            e.preventDefault();
            e.stopPropagation();
            beginDragTransaction();
            onChange(clampAndRound(safeValue + effectiveStep));
            commitDragTransaction();
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
            e.preventDefault();
            e.stopPropagation();
            beginDragTransaction();
            onChange(clampAndRound(safeValue - effectiveStep));
            commitDragTransaction();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            startEditing();
        }
    };

    const labelString = typeof label === 'string' ? label : undefined;

    return (
        <div
            ref={containerRef}
            role="spinbutton"
            tabIndex={isEditing ? -1 : 0}
            aria-label={ariaLabel ?? labelString}
            aria-valuenow={safeValue}
            aria-valuemin={Number.isFinite(min) ? min : undefined}
            aria-valuemax={Number.isFinite(max) ? max : undefined}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onLostPointerCapture={handleLostPointerCapture}
            onKeyDown={handleKeyDown}
            onDoubleClick={() => {
                if (!isEditing) startEditing();
            }}
            title="Drag left/right to scrub, use arrow keys, or click/press Enter to type exact value"
            style={{ touchAction: 'none' }}
            className={`h-7 px-2.5 rounded-md ${
                isScrubbing
                    ? 'bg-[#242428] border-[#0088ff] ring-1 ring-[#0088ff]/40 shadow-sm'
                    : 'bg-[var(--bg-subtle,#1c1c1f)] hover:bg-[var(--bg-muted,#242428)] border border-[var(--border-subtle,rgba(255,255,255,0.07))]'
            } focus-visible:outline-none focus-visible:border-[var(--border-focus,#0088ff)] focus-visible:ring-1 focus-visible:ring-[var(--border-focus,#0088ff)] flex items-center gap-2 cursor-ew-resize select-none transition-colors duration-100 ${className || ''}`}
        >
            <span className="text-[11px] text-[var(--text-muted,#a1a1aa)] font-medium tracking-tight shrink-0 select-none">
                {label}
            </span>

            {isEditing ? (
                <input
                    ref={inputRef}
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onBlur={commitTextInput}
                    onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            commitTextInput();
                            containerRef.current?.focus();
                        } else if (e.key === 'Escape') {
                            e.preventDefault();
                            cancelTextInput();
                        }
                    }}
                    className="w-full bg-transparent text-[11px] font-mono tabular-nums text-[var(--text-primary,#f4f4f5)] outline-none tracking-tight caret-[var(--accent-primary,#0088ff)]"
                />
            ) : (
                <span className="text-[11px] font-mono tabular-nums text-[var(--text-primary,#f4f4f5)] truncate tracking-tight">
                    {safeValue.toFixed(effectiveDecimals)}
                    {unit}
                </span>
            )}
        </div>
    );
};
