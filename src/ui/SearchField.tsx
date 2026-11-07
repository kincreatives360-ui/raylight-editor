import type { InputHTMLAttributes, ReactNode, Ref } from 'react';
import { Search, X } from 'lucide-react';
import { IconButton } from './primitives';

interface SearchFieldProps extends InputHTMLAttributes<HTMLInputElement> {
    containerClassName?: string;
    iconClassName?: string;
    inputRef?: Ref<HTMLInputElement>;
    onClear?: () => void;
    clearButtonClassName?: string;
    clearIconClassName?: string;
    clearLabel?: string;
    children?: ReactNode;
}

export function SearchField({
    containerClassName = 'relative flex items-center',
    iconClassName = 'w-3.5 h-3.5 text-muted-foreground shrink-0',
    inputRef,
    onClear,
    clearButtonClassName = 'text-muted-foreground hover:text-foreground cursor-pointer',
    clearIconClassName = 'w-3 h-3',
    clearLabel = 'Clear search',
    children,
    className = '',
    ...inputProps
}: SearchFieldProps) {
    return (
        <div data-slot="input" className={containerClassName}>
            <Search className={iconClassName} />
            <input ref={inputRef} type="text" className={className} {...inputProps} />
            {onClear && !!inputProps.value && (
                <IconButton
                    unstyled
                    tooltip={false}
                    label={clearLabel}
                    className={clearButtonClassName}
                    icon={<X className={clearIconClassName} />}
                    onClick={onClear}
                />
            )}
            {children}
        </div>
    );
}
