import React, { useEffect, useRef, useState } from 'react';
import { MenuSurface, MenuItem } from './Menu';
import { ChevronRight } from 'lucide-react';

export interface ContextMenuEntry {
    type?: 'item';
    id: string;
    label: React.ReactNode;
    icon?: React.FC<{ className?: string }>;
    shortcut?: React.ReactNode;
    disabled?: boolean;
    danger?: boolean;
    onClick?: () => void;
    children?: ContextMenuEntry[];
}

export interface ContextMenuDivider {
    type: 'divider';
    id?: string;
}

export interface ContextMenuHeader {
    type: 'header';
    id?: string;
    label: React.ReactNode;
}

export type ContextMenuItemDef = ContextMenuEntry | ContextMenuDivider | ContextMenuHeader;

export interface ContextMenuProps {
    x: number;
    y: number;
    items: ContextMenuItemDef[];
    onClose: () => void;
    className?: string;
    width?: number;
}

export function ContextMenu({
    x,
    y,
    items,
    onClose,
    className = '',
    width = 224,
}: ContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);
    const [activeSubmenuId, setActiveSubmenuId] = useState<string | null>(null);

    // Dismiss on click outside or Escape
    useEffect(() => {
        const handleDown = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };

        window.addEventListener('mousedown', handleDown);
        window.addEventListener('keydown', handleKey);
        return () => {
            window.removeEventListener('mousedown', handleDown);
            window.removeEventListener('keydown', handleKey);
        };
    }, [onClose]);

    // Viewport clamping
    const winW = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const winH = typeof window !== 'undefined' ? window.innerHeight : 800;
    const estHeight = items.length * 28 + 16;
    const clampedX = Math.max(8, Math.min(x, winW - width - 8));
    const clampedY = Math.max(8, Math.min(y, winH - estHeight - 8));

    return (
        <MenuSurface
            ref={menuRef}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            style={{
                left: `${clampedX}px`,
                top: `${clampedY}px`,
                width: `${width}px`,
            }}
            className={`fixed z-50 bg-popover/95 backdrop-blur-xl border border-border shadow-[0_16px_36px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.08)] rounded-xl p-1 text-xs text-popover-foreground flex flex-col gap-0.5 select-none max-h-[calc(100vh-16px)] overflow-y-auto ${className}`}
        >
            {items.map((item, idx) => {
                if (item.type === 'divider') {
                    return (
                        <div
                            key={item.id ?? `div-${idx}`}
                            data-slot="dropdown-menu-separator"
                            className="my-1 border-t border-border"
                        />
                    );
                }

                if (item.type === 'header') {
                    return (
                        <div
                            key={item.id ?? `hdr-${idx}`}
                            data-slot="dropdown-menu-label"
                            className="px-2.5 py-1 text-[11px] font-mono text-muted-foreground uppercase tracking-wider truncate border-b border-border mb-0.5"
                        >
                            {item.label}
                        </div>
                    );
                }

                const hasSubmenu = Boolean(item.children && item.children.length > 0);
                const isSubmenuOpen = activeSubmenuId === item.id;

                return (
                    <div
                        key={item.id}
                        className="relative"
                        onMouseEnter={() => {
                            if (hasSubmenu) setActiveSubmenuId(item.id);
                            else setActiveSubmenuId(null);
                        }}
                    >
                        <MenuItem
                            disabled={item.disabled}
                            danger={item.danger}
                            icon={item.icon}
                            label={item.label}
                            shortcut={!hasSubmenu ? item.shortcut : undefined}
                            rightSlot={
                                hasSubmenu ? (
                                    <ChevronRight className="w-3 h-3 text-muted-foreground ml-auto pl-1" />
                                ) : undefined
                            }
                            onClick={() => {
                                if (item.disabled) return;
                                if (hasSubmenu) {
                                    setActiveSubmenuId(isSubmenuOpen ? null : item.id);
                                    return;
                                }
                                item.onClick?.();
                                onClose();
                            }}
                        />

                        {/* Nested Submenu */}
                        {hasSubmenu && isSubmenuOpen && item.children && (
                            <MenuSurface
                                style={{
                                    left: clampedX + width + 4 > winW - 180 ? '-184px' : '100%',
                                    top: '0px',
                                    width: '180px',
                                }}
                                className="absolute z-50 bg-popover/98 backdrop-blur-xl border border-border shadow-[0_16px_36px_rgba(0,0,0,0.65)] rounded-xl p-1 text-xs text-popover-foreground flex flex-col gap-0.5 select-none"
                            >
                                {item.children.map((sub) => (
                                    <MenuItem
                                        key={sub.id}
                                        disabled={sub.disabled}
                                        danger={sub.danger}
                                        icon={sub.icon}
                                        label={sub.label}
                                        shortcut={sub.shortcut}
                                        onClick={() => {
                                            if (sub.disabled) return;
                                            sub.onClick?.();
                                            onClose();
                                        }}
                                    />
                                ))}
                            </MenuSurface>
                        )}
                    </div>
                );
            })}
        </MenuSurface>
    );
}

