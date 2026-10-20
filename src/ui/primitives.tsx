import React, { useState, useRef, useEffect } from 'react';
import { ScrubInput } from './ScrubInput';
import { ColorPicker, type GradientValue } from '../panels/Inspector/ColorPicker';
import { ChevronDown, ChevronRight } from 'lucide-react';

/* -------------------------------------------------------------------------- */
/* Tooltip                                                                    */
/* -------------------------------------------------------------------------- */

export interface TooltipProps {
    content: React.ReactNode;
    children: React.ReactElement;
    position?: 'top' | 'bottom' | 'left' | 'right';
    delayMs?: number;
    className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
    content,
    children,
    position = 'top',
    delayMs = 200,
    className = '',
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleMouseEnter = () => {
        timeoutRef.current = setTimeout(() => {
            setIsVisible(true);
        }, delayMs);
    };

    const handleMouseLeave = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        setIsVisible(false);
    };

    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    const positionClasses = {
        top: 'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
        bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
        left: 'right-full top-1/2 -translate-y-1/2 mr-1.5',
        right: 'left-full top-1/2 -translate-y-1/2 ml-1.5',
    }[position];

    if (!content) return children;

    return (
        <div
            className="relative inline-flex items-center justify-center"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onFocus={handleMouseEnter}
            onBlur={handleMouseLeave}
        >
            {children}
            {isVisible && (
                <div
                    role="tooltip"
                    className={`absolute z-50 pointer-events-none whitespace-nowrap rounded-[var(--radius-xs)] border border-[var(--surface-border-strong)] bg-[var(--panel-active)] px-2 py-1 text-[10px] font-medium text-[var(--text-primary)] shadow-xl transition-opacity duration-150 ${positionClasses} ${className}`}
                >
                    {content}
                </div>
            )}
        </div>
    );
};

/* -------------------------------------------------------------------------- */
/* IconButton                                                                 */
/* -------------------------------------------------------------------------- */

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    icon: React.ReactNode;
    label: string; // Required per Section 11.9 accessible name spec
    tooltip?: string;
    active?: boolean;
    variant?: 'ghost' | 'panel' | 'subtle';
    size?: 'xs' | 'sm' | 'md';
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
    (
        {
            icon,
            label,
            tooltip,
            active = false,
            variant = 'ghost',
            size = 'sm',
            disabled = false,
            className = '',
            ...props
        },
        ref
    ) => {
        const sizeClasses = {
            xs: 'w-6 h-6 min-w-[24px] min-h-[24px] text-[11px]',
            sm: 'w-7 h-7 min-w-[28px] min-h-[28px] text-xs',
            md: 'w-8 h-8 min-w-[32px] min-h-[32px] text-sm',
        }[size];

        const variantClasses = {
            ghost: active
                ? 'bg-[var(--accent)] text-white shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--panel-hover)]',
            panel: active
                ? 'bg-[var(--accent)] text-white border border-[var(--accent-hover)]'
                : 'bg-[var(--panel-raised)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--panel-hover)] border border-[var(--surface-border)]',
            subtle: active
                ? 'bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]'
                : 'bg-[var(--panel-active)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--panel-hover)] border border-[var(--surface-border)]',
        }[variant];

        const buttonElement = (
            <button
                ref={ref}
                type="button"
                role="button"
                aria-label={label}
                disabled={disabled}
                className={`inline-flex items-center justify-center rounded-[var(--radius-sm)] transition-colors duration-150 cursor-pointer select-none disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--focus-ring)] ${sizeClasses} ${variantClasses} ${className}`}
                {...props}
            >
                {icon}
            </button>
        );

        return <Tooltip content={tooltip || label}>{buttonElement}</Tooltip>;
    }
);
IconButton.displayName = 'IconButton';

/* -------------------------------------------------------------------------- */
/* NumericField                                                               */
/* -------------------------------------------------------------------------- */

export interface NumericFieldProps {
    label: React.ReactNode;
    value: number;
    onChange: (newValue: number) => void;
    min?: number;
    max?: number;
    step?: number;
    decimals?: number;
    unit?: string;
    tooltip?: string;
    className?: string;
}

export const NumericField: React.FC<NumericFieldProps> = ({
    label,
    value,
    onChange,
    min = -Infinity,
    max = Infinity,
    step = 1,
    decimals = 0,
    unit = '',
    tooltip,
    className = '',
}) => {
    const inputContent = (
        <div className={`h-[var(--control-height)] font-mono text-[11px] tabular-nums ${className}`}>
            <ScrubInput
                label={label}
                value={value}
                min={min}
                max={max}
                step={step}
                decimals={decimals}
                unit={unit}
                onChange={onChange}
            />
        </div>
    );

    if (tooltip) {
        return <Tooltip content={tooltip}>{inputContent}</Tooltip>;
    }

    return inputContent;
};

/* -------------------------------------------------------------------------- */
/* ColorField                                                                 */
/* -------------------------------------------------------------------------- */

export interface ColorFieldProps {
    value: string;
    onChange: ((color: string) => void) | ((event: { target: { value: string } }) => void);
    label?: string;
    title?: string;
    gradientValue?: GradientValue;
    onGradientChange?: (gradient: GradientValue) => void;
    compact?: boolean;
    showGradientMode?: boolean;
    className?: string;
}

export const ColorField: React.FC<ColorFieldProps> = ({
    value,
    onChange,
    label = 'Color',
    title,
    gradientValue,
    onGradientChange,
    compact = false,
    showGradientMode = false,
    className = '',
}) => {
    const handleChange = (newColor: string) => {
        if (typeof onChange === 'function') {
            try {
                // If caller expects event object { target: { value } }
                (onChange as (event: { target: { value: string } }) => void)({
                    target: { value: newColor },
                });
            } catch {
                // Fallback for direct string callers
                (onChange as (color: string) => void)(newColor);
            }
        }
    };

    return (
        <ColorPicker
            color={value}
            label={label || title || 'Color'}
            gradientValue={gradientValue}
            onGradientChange={onGradientChange}
            compact={compact}
            showGradientMode={showGradientMode}
            className={className}
            onChange={handleChange}
        />
    );
};

/* -------------------------------------------------------------------------- */
/* SectionHeader                                                              */
/* -------------------------------------------------------------------------- */

export interface SectionHeaderProps {
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    icon?: React.ReactNode;
    actions?: React.ReactNode;
    expanded?: boolean;
    onToggle?: () => void;
    className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
    title,
    subtitle,
    icon,
    actions,
    expanded,
    onToggle,
    className = '',
}) => {
    const isCollapsible = typeof onToggle === 'function';

    return (
        <div
            className={`flex h-[var(--row-height)] items-center justify-between border-b border-[var(--surface-border)] px-3 text-[11px] font-medium text-[var(--text-primary)] select-none ${className}`}
        >
            <div
                onClick={onToggle}
                className={`flex items-center gap-1.5 ${isCollapsible ? 'cursor-pointer hover:text-white transition-colors duration-100' : ''}`}
            >
                {isCollapsible && (
                    <span className="text-[var(--text-muted)]">
                        {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    </span>
                )}
                {icon && <span className="text-[var(--text-secondary)]">{icon}</span>}
                <span className="truncate">{title}</span>
                {subtitle && <span className="text-[10px] text-[var(--text-muted)] font-mono">{subtitle}</span>}
            </div>

            {actions && <div className="flex items-center gap-1">{actions}</div>}
        </div>
    );
};

/* -------------------------------------------------------------------------- */
/* InspectorRow                                                               */
/* -------------------------------------------------------------------------- */

export interface InspectorRowProps {
    label?: React.ReactNode;
    children: React.ReactNode;
    actions?: React.ReactNode;
    tooltip?: string;
    stacked?: boolean;
    className?: string;
}

export const InspectorRow: React.FC<InspectorRowProps> = ({
    label,
    children,
    actions,
    tooltip,
    stacked = false,
    className = '',
}) => {
    if (stacked) {
        return (
            <div className={`flex flex-col gap-1 py-1 ${className}`}>
                {label && (
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] text-[var(--text-secondary)] font-medium">
                            {tooltip ? <Tooltip content={tooltip}>{<span>{label}</span>}</Tooltip> : label}
                        </span>
                        {actions && <div className="flex items-center gap-1">{actions}</div>}
                    </div>
                )}
                <div className="w-full">{children}</div>
            </div>
        );
    }

    return (
        <div className={`flex min-h-[var(--control-height)] items-center justify-between gap-2 py-1 text-[11px] ${className}`}>
            {label && (
                <div className="w-[72px] shrink-0 text-[10.5px] text-[var(--text-secondary)] font-medium truncate">
                    {tooltip ? <Tooltip content={tooltip}>{<span>{label}</span>}</Tooltip> : label}
                </div>
            )}
            <div className="flex-1 min-w-0">{children}</div>
            {actions && <div className="shrink-0 flex items-center gap-1">{actions}</div>}
        </div>
    );
};

/* -------------------------------------------------------------------------- */
/* SegmentedControl                                                           */
/* -------------------------------------------------------------------------- */

export interface SegmentedControlOption<T extends string = string> {
    value: T;
    label?: React.ReactNode;
    icon?: React.ReactNode;
    tooltip?: string;
    ariaLabel?: string;
    disabled?: boolean;
}

export interface SegmentedControlProps<T extends string = string> {
    options: SegmentedControlOption<T>[];
    value: T;
    onChange: (value: T) => void;
    size?: 'sm' | 'md';
    className?: string;
}

export function SegmentedControl<T extends string = string>({
    options,
    value,
    onChange,
    size = 'sm',
    className = '',
}: SegmentedControlProps<T>) {
    const heightClass = size === 'sm' ? 'h-[var(--control-height)]' : 'h-8';

    return (
        <div
            role="radiogroup"
            className={`inline-flex w-full items-center rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--panel-bg)] p-0.5 select-none ${heightClass} ${className}`}
        >
            {options.map((opt) => {
                const isSelected = opt.value === value;
                const buttonContent = (
                    <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        aria-label={opt.ariaLabel || (typeof opt.label === 'string' ? opt.label : undefined)}
                        disabled={opt.disabled}
                        onClick={() => !opt.disabled && onChange(opt.value)}
                        className={`flex flex-1 items-center justify-center gap-1 rounded-[var(--radius-xs)] px-2 py-1 text-[11px] font-medium transition-colors duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--focus-ring)] ${
                            isSelected
                                ? 'bg-[var(--panel-active)] text-white shadow-sm font-semibold'
                                : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--panel-hover)]'
                        }`}
                    >
                        {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                        {opt.label && <span className="truncate">{opt.label}</span>}
                    </button>
                );

                if (opt.tooltip) {
                    return (
                        <Tooltip key={opt.value} content={opt.tooltip}>
                            {buttonContent}
                        </Tooltip>
                    );
                }

                return buttonContent;
            })}
        </div>
    );
}
