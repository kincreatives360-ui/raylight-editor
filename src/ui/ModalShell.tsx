import React, { useEffect, useRef, type HTMLAttributes, type ReactNode } from 'react';

export interface ModalShellProps {
    backdropProps?: HTMLAttributes<HTMLDivElement>;
    surfaceProps?: HTMLAttributes<HTMLDivElement>;
    children: ReactNode;
    onClose?: () => void;
    initialFocusRef?: React.RefObject<HTMLElement | null>;
}

export function ModalShell({
    backdropProps = {},
    surfaceProps = {},
    children,
    onClose,
    initialFocusRef,
}: ModalShellProps) {
    const surfaceRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLElement | null>(
        typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null
    );

    useEffect(() => {
        // Initial focus
        if (initialFocusRef?.current) {
            initialFocusRef.current.focus();
        } else if (surfaceRef.current) {
            const focusables = surfaceRef.current.querySelectorAll<HTMLElement>(
                'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            );
            if (focusables.length > 0) {
                focusables[0].focus();
            } else {
                surfaceRef.current.focus();
            }
        }

        // Return focus to trigger element on unmount
        const returnTrigger = triggerRef.current;
        return () => {
            returnTrigger?.focus?.();
        };
    }, [initialFocusRef]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        surfaceProps.onKeyDown?.(e);
        if (e.defaultPrevented) return;

        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            onClose?.();
            return;
        }

        if (e.key === 'Tab' && surfaceRef.current) {
            const focusables = Array.from(
                surfaceRef.current.querySelectorAll<HTMLElement>(
                    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
                )
            );
            if (focusables.length === 0) {
                e.preventDefault();
                return;
            }

            const first = focusables[0];
            const last = focusables[focusables.length - 1];

            if (e.shiftKey) {
                if (document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                }
            } else {
                if (document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        }
    };

    return (
        <div
            role="dialog"
            aria-modal="true"
            {...backdropProps}
            onClick={(e) => {
                backdropProps.onClick?.(e);
                if (e.target === e.currentTarget) {
                    onClose?.();
                }
            }}
            onKeyDown={handleKeyDown}
        >
            <div
                ref={surfaceRef}
                tabIndex={-1}
                {...surfaceProps}
                className={`focus-visible:outline-none ${surfaceProps.className || ''}`}
                onClick={(event) => {
                    event.stopPropagation();
                    surfaceProps.onClick?.(event);
                }}
            >
                {children}
            </div>
        </div>
    );
}
