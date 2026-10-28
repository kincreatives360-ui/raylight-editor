import type { InputHTMLAttributes, ReactNode } from 'react';

interface CheckboxRowProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'children'> {
    label: ReactNode;
    rowClassName?: string;
}

export function CheckboxRow({ label, rowClassName = 'flex items-center justify-between text-[10px] text-[#a1a1aa]', ...inputProps }: CheckboxRowProps) {
    return <label className={rowClassName}><span>{label}</span><input type="checkbox" {...inputProps} /></label>;
}
