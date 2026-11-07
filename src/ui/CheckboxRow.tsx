import type { InputHTMLAttributes, ReactNode } from 'react';

interface CheckboxRowProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'children'> {
    label: ReactNode;
    rowClassName?: string;
}

export function CheckboxRow({
    label,
    rowClassName = 'flex items-center justify-between text-[10px] text-muted-foreground hover:text-foreground cursor-pointer select-none transition-colors',
    className = '',
    ...inputProps
}: CheckboxRowProps) {
    return (
        <label className={rowClassName}>
            <span>{label}</span>
            <input
                type="checkbox"
                data-slot="checkbox"
                className={`rounded border-border text-primary accent-[var(--primary)] focus-visible:ring-1 focus-visible:ring-ring cursor-pointer ${className}`}
                {...inputProps}
            />
        </label>
    );
}
