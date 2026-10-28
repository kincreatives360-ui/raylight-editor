import type { HTMLAttributes, ReactNode } from 'react';

/** Caller classes retain each dialog's dimensions and placement. */
export function ModalShell({ backdropProps, surfaceProps, children }: {
    backdropProps: HTMLAttributes<HTMLDivElement>;
    surfaceProps: HTMLAttributes<HTMLDivElement>;
    children: ReactNode;
}) {
    return <div role="dialog" aria-modal="true" {...backdropProps}>
        <div {...surfaceProps} onClick={event => {
            event.stopPropagation();
            surfaceProps.onClick?.(event);
        }}>{children}</div>
    </div>;
}
