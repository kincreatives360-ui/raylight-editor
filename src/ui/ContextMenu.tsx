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
            className={`fixed z-50 bg-[oklch(20%_0_0/95%)] backdrop-blur-xl border border-white/12 shadow-[0_16px_36px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.08)] rounded-xl p-1 text-xs text-[#d4d4d8] flex flex-col gap-0.5 select-none ${className}`}
        >
            {items.map((item, idx) => {
                if (item.type === 'divider') {
                    return (
                        <div
                            key={item.id ?? `div-${idx}`}
                            className="my-1 border-t border-white/10"
                        />
                    );
                }

                if (item.type === 'header') {
                    return (
                        <div
                            key={item.id ?? `hdr-${idx}`}
                            className="px-2.5 py-1 text-[11px] font-mono text-gray-400 uppercase tracking-wider truncate border-b border-white/10 mb-0.5"
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
                            unstyled
                            disabled={item.disabled}
                            onClick={() => {
                                if (item.disabled) return;
                                if (hasSubmenu) {
                                    setActiveSubmenuId(isSubmenuOpen ? null : item.id);
                                    return;
                                }
                                item.onClick?.();
                                onClose();
                            }}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg transition text-left cursor-pointer group ${
                                item.disabled
                                    ? 'opacity-40 cursor-not-allowed text-gray-500'
                                    : item.danger
                                    ? 'hover:bg-rose-500/20 text-rose-300 hover:text-rose-200'
                                    : 'hover:bg-white/10 text-gray-300 hover:text-white'
                            }`}
                            icon={item.icon}
                            iconClassName={`w-3.5 h-3.5 ${
                                item.disabled
                                    ? 'text-gray-500'
                                    : item.danger
                                    ? 'text-rose-400'
                                    : 'text-gray-400 group-hover:text-sky-300'
                            }`}
                            contentClassName="flex items-center gap-2 truncate"
                            label={item.label}
                            shortcut={
                                hasSubmenu ? (
                                    <ChevronRight className="w-3 h-3 text-gray-500 group-hover:text-gray-300" />
                                ) : (
                                    item.shortcut
                                )
                            }
                            shortcutClassName="text-[11px] font-mono text-gray-500 group-hover:text-gray-300 ml-auto pl-2"
                        />

                        {/* Nested Submenu */}
                        {hasSubmenu && isSubmenuOpen && item.children && (
                            <MenuSurface
                                style={{
                                    left: clampedX + width + 4 > winW - 180 ? '-184px' : '100%',
                                    top: '0px',
                                    width: '180px',
                                }}
                                className="absolute z-50 bg-[oklch(20%_0_0/98%)] backdrop-blur-xl border border-white/12 shadow-[0_16px_36px_rgba(0,0,0,0.65)] rounded-xl p-1 text-xs text-[#d4d4d8] flex flex-col gap-0.5 select-none"
                            >
                                {item.children.map((sub) => (
                                    <MenuItem
                                        key={sub.id}
                                        unstyled
                                        disabled={sub.disabled}
                                        onClick={() => {
                                            if (sub.disabled) return;
                                            sub.onClick?.();
                                            onClose();
                                        }}
                                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg transition text-left cursor-pointer group ${
                                            sub.disabled
                                                ? 'opacity-40 cursor-not-allowed text-gray-500'
                                                : 'hover:bg-white/10 text-gray-300 hover:text-white'
                                        }`}
                                        icon={sub.icon}
                                        iconClassName="w-3.5 h-3.5 text-gray-400 group-hover:text-sky-300"
                                        contentClassName="flex items-center gap-2 truncate"
                                        label={sub.label}
                                        shortcut={sub.shortcut}
                                        shortcutClassName="text-[11px] font-mono text-gray-500 group-hover:text-gray-300 ml-auto pl-2"
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

