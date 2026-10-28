import React from 'react';
import { ShortcutKey } from './ShortcutKey';
import { navigateMenu } from './menuNavigation';

export const MenuSurface = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, onKeyDown, ...props }, ref) => (
    <div ref={ref} role="menu" className={className ?? 'rounded-xl bg-[#1c1c1f]/85 backdrop-blur-xl border border-white/12 shadow-xl p-1 text-xs z-50'} {...props}
        onKeyDown={event => { onKeyDown?.(event); navigateMenu(event); }} />
));
MenuSurface.displayName = 'MenuSurface';

export function DropdownMenu({ children, align = 'left', className = '' }: {
    children: React.ReactNode; align?: 'left' | 'right'; className?: string;
}) {
    return <MenuSurface
        className={`absolute bottom-full mb-2 ${align === 'right' ? 'right-0 origin-bottom-right' : 'left-0 origin-bottom-left'} min-w-[10rem] rounded-xl bg-[#1c1c1f]/85 backdrop-blur-xl saturate-180 border border-white/12 shadow-[0_16px_36px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.08)] p-1 text-xs z-50 ${className}`}
        style={{ animation: 'figma-popover-in 140ms var(--ease-out, cubic-bezier(0.23, 1, 0.32, 1))' }}
    >{children}</MenuSurface>;
}

interface MenuItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    label?: React.ReactNode;
    icon?: React.FC<{ className?: string }>;
    shortcut?: React.ReactNode;
    active?: boolean;
    accent?: string;
    unstyled?: boolean;
    contentClassName?: string;
    iconClassName?: string;
    shortcutClassName?: string;
}

export function MenuItem({ icon: Icon, label, shortcut, active, accent, unstyled, children, className = '', contentClassName = 'flex items-center gap-2', iconClassName, shortcutClassName = 'text-[11px] font-mono opacity-70', ...props }: MenuItemProps) {
    return <button type="button" role="menuitem" {...props}
        className={unstyled ? className : `w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-left cursor-pointer transition-[color,background-color,transform] duration-150 active:scale-[0.97] ${active ? 'bg-[var(--accent-primary,#0088ff)] text-white' : 'text-[#d4d4d8] hover:bg-white/5 hover:text-white'} ${className}`}>
        {children ?? <><div className={contentClassName}>
            {Icon && <Icon className={iconClassName ?? `w-3.5 h-3.5 ${accent ?? 'opacity-80'}`} />}<span>{label}</span>
        </div>{shortcut && <ShortcutKey className={shortcutClassName}>{shortcut}</ShortcutKey>}</>}
    </button>;
}
