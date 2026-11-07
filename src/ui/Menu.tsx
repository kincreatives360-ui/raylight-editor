import React from 'react';
import { ShortcutKey } from './ShortcutKey';
import { navigateMenu } from './menuNavigation';

export const MenuSurface = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, onKeyDown, ...props }, ref) => (
    <div
        ref={ref}
        role="menu"
        data-slot="dropdown-menu-content"
        className={className ?? 'rounded-xl bg-popover/90 backdrop-blur-xl border border-border shadow-xl p-1 text-xs text-popover-foreground z-50 max-h-[calc(100vh-16px)] overflow-y-auto'}
        {...props}
        onKeyDown={event => { onKeyDown?.(event); navigateMenu(event); }}
    />
));
MenuSurface.displayName = 'MenuSurface';

export function DropdownMenu({ children, align = 'left', className = '' }: {
    children: React.ReactNode; align?: 'left' | 'right'; className?: string;
}) {
    return <MenuSurface
        className={`absolute bottom-full mb-2 ${align === 'right' ? 'right-0 origin-bottom-right' : 'left-0 origin-bottom-left'} min-w-[10rem] rounded-xl bg-popover/90 backdrop-blur-xl saturate-180 border border-border shadow-[0_16px_36px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.08)] p-1 text-xs text-popover-foreground z-50 ${className}`}
        style={{ animation: 'figma-popover-in 140ms var(--ease-out, cubic-bezier(0.23, 1, 0.32, 1))' }}
    >{children}</MenuSurface>;
}

export interface MenuItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    label?: React.ReactNode;
    icon?: React.FC<{ className?: string }>;
    shortcut?: React.ReactNode;
    active?: boolean;
    accent?: string;
    danger?: boolean;
    rightSlot?: React.ReactNode;
    unstyled?: boolean;
    contentClassName?: string;
    iconClassName?: string;
    shortcutClassName?: string;
}

export function MenuItem({
    icon: Icon,
    label,
    shortcut,
    active,
    accent,
    danger,
    rightSlot,
    unstyled,
    children,
    className = '',
    contentClassName = 'flex items-center gap-2 truncate',
    iconClassName,
    shortcutClassName = 'text-[11px] font-mono opacity-70 ml-auto pl-2',
    disabled,
    ...props
}: MenuItemProps) {
    const interactiveClass = danger
        ? 'text-destructive hover:bg-destructive/10 hover:text-destructive focus:bg-destructive/10 focus:text-destructive'
        : 'text-foreground hover:bg-dropdown-hover hover:text-dropdown-hover-foreground focus:bg-dropdown-hover focus:text-dropdown-hover-foreground';
    const activeClass = active
        ? 'bg-primary text-primary-foreground'
        : disabled
        ? (danger ? 'text-destructive' : 'text-muted-foreground')
        : interactiveClass;
    const disabledClass = disabled ? 'opacity-40 cursor-not-allowed text-muted-foreground' : 'cursor-pointer';

    return (
        <button
            type="button"
            role="menuitem"
            data-slot="dropdown-menu-item"
            disabled={disabled}
            {...props}
            className={unstyled ? className : `w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-left transition-[color,background-color,transform] duration-150 active:scale-[0.97] ${disabledClass} ${activeClass} ${className}`}
        >
            {children ?? (
                <>
                    <div className={contentClassName}>
                        {Icon && (
                            <Icon
                                className={
                                    iconClassName ??
                                    `w-3.5 h-3.5 shrink-0 ${
                                        danger
                                            ? 'text-destructive'
                                            : accent ?? 'text-muted-foreground'
                                    }`
                                }
                            />
                        )}
                        <span className="truncate">{label}</span>
                    </div>
                    {rightSlot !== undefined ? (
                        rightSlot
                    ) : shortcut ? (
                        <ShortcutKey className={shortcutClassName}>{shortcut}</ShortcutKey>
                    ) : null}
                </>
            )}
        </button>
    );
}
