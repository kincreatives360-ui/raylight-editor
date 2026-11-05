import type { InputHTMLAttributes } from 'react';

type InlineRenameInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'onBlur' | 'onKeyDown' | 'onClick'> & {
    onCommit: (value: string) => void;
    onCancel: () => void;
};

export function InlineRenameInput({ onCommit, onCancel, autoFocus = true, ...props }: InlineRenameInputProps) {
    return <input
        {...props}
        autoFocus={autoFocus}
        onBlur={event => onCommit(event.currentTarget.value)}
        onKeyDown={event => {
            event.stopPropagation();
            if (event.key === 'Enter') onCommit(event.currentTarget.value);
            if (event.key === 'Escape') {
                event.preventDefault();
                onCancel();
            }
        }}
        onClick={event => event.stopPropagation()}
    />;
}
