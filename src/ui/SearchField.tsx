import type { InputHTMLAttributes, ReactNode, Ref } from 'react';
import { Search, X } from 'lucide-react';
import { IconButton } from './primitives';

interface SearchFieldProps extends InputHTMLAttributes<HTMLInputElement> {
    containerClassName: string;
    iconClassName: string;
    inputRef?: Ref<HTMLInputElement>;
    onClear?: () => void;
    clearButtonClassName?: string;
    clearIconClassName?: string;
    clearLabel?: string;
    children?: ReactNode;
}

export function SearchField({ containerClassName, iconClassName, inputRef, onClear,
    clearButtonClassName = 'text-[#a1a1aa] hover:text-white cursor-pointer',
    clearIconClassName = 'w-3 h-3', clearLabel = 'Clear search', children, ...inputProps }: SearchFieldProps) {
    return <div className={containerClassName}>
        <Search className={iconClassName} />
        <input ref={inputRef} type="text" {...inputProps} />
        {onClear && !!inputProps.value && <IconButton unstyled tooltip={false} label={clearLabel}
            className={clearButtonClassName} icon={<X className={clearIconClassName} />} onClick={onClear} />}
        {children}
    </div>;
}
