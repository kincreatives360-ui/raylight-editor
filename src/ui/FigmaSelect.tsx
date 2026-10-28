import React, { Children, isValidElement, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

type Option = { value: string; label: React.ReactNode; disabled: boolean; group?: string };
function readOptions(children: React.ReactNode, group?: string, disabled = false): Option[] {
    return Children.toArray(children).flatMap((child): Option[] => {
        if (!isValidElement<{ value?: string | number; children?: React.ReactNode; label?: string; disabled?: boolean }>(child)) return [];
        if (child.type === 'option') return [{ value: String(child.props.value ?? child.props.children ?? ''), label: child.props.children, disabled: disabled || !!child.props.disabled, group }];
        return readOptions(child.props.children, child.type === 'optgroup' ? child.props.label : group, disabled || !!child.props.disabled);
    });
}

/** Inspector select with a portal menu, keeping the existing select change-handler contract. */
export function FigmaSelect({ children, value, defaultValue, onChange, className = '', disabled, title, id, name, style, 'aria-label': ariaLabel, 'aria-labelledby': labelledBy }: React.SelectHTMLAttributes<HTMLSelectElement>) {
    const options = readOptions(children);
    const [localValue, setLocalValue] = useState(String(defaultValue ?? options[0]?.value ?? ''));
    const selectedValue = String(value ?? localValue);
    const selected = options.find((option) => option.value === selectedValue);
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    const [position, setPosition] = useState<{ left: number; top: number; width: number; maxHeight: number; transformOrigin?: string }>({ left: 0, top: 0, width: 180, maxHeight: 280, transformOrigin: 'top left' });
    const [label, setLabel] = useState('');
    const trigger = useRef<HTMLButtonElement>(null);
    const menu = useRef<HTMLDivElement>(null);
    const typeahead = useRef({ text: '', time: 0 });
    const menuId = useId();
    useEffect(() => {
        setLabel(trigger.current?.parentElement?.closest('.space-y-1\\.5, .space-y-2, label')?.querySelector('label')?.textContent ?? '');
    }, []);
    const close = (restoreFocus = true) => { setOpen(false); if (restoreFocus) trigger.current?.focus(); };
    const choose = (option: Option) => {
        if (option.disabled) return;
        setLocalValue(option.value);
        // Existing inspector handlers consume only target.value/currentTarget.value.
        const target = { value: option.value, name: name ?? '' } as HTMLSelectElement;
        onChange?.({ target, currentTarget: target } as React.ChangeEvent<HTMLSelectElement>);
        close();
    };
    const show = () => {
        if (disabled || !options.length) return;
        const rect = trigger.current!.getBoundingClientRect();
        const width = Math.min(Math.max(rect.width, 180), window.innerWidth - 16);
        const height = Math.min(280, window.innerHeight - 24);
        const below = window.innerHeight - rect.bottom - 12;
        const above = rect.top - 12;
        const placeBelow = below >= Math.min(height, options.length * 28 + 8) || below >= above;
        const maxHeight = Math.max(64, Math.min(height, placeBelow ? below : above));
        setPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)), top: placeBelow ? rect.bottom + 4 : Math.max(8, rect.top - Math.min(maxHeight, options.length * 28 + 8) - 4), width, maxHeight, transformOrigin: placeBelow ? 'top left' : 'bottom left' });
        setActive(Math.max(0, options.findIndex((option) => option.value === selectedValue && !option.disabled)));
        setOpen(true);
    };
    useEffect(() => {
        if (!open) return;
        menu.current?.focus();
        const outside = (event: PointerEvent) => {
            if (!menu.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setOpen(false);
        };
        const dismiss = () => setOpen(false);
        document.addEventListener('pointerdown', outside);
        window.addEventListener('resize', dismiss);
        const scroll = (event: Event) => { if (!menu.current?.contains(event.target as Node)) dismiss(); };
        window.addEventListener('scroll', scroll, true);
        return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', dismiss); window.removeEventListener('scroll', scroll, true); };
    }, [open]);
    useEffect(() => { if (open) document.getElementById(`${menuId}-${active}`)?.scrollIntoView({ block: 'nearest' }); }, [active, open, menuId]);
    const move = (direction: number) => {
        for (let step = 1; step <= options.length; step++) {
            const next = (active + direction * step + options.length) % options.length;
            if (!options[next].disabled) { setActive(next); return; }
        }
    };
    return <>
        <button ref={trigger} type="button" role="combobox" id={id} title={title} disabled={disabled}
            aria-label={ariaLabel ?? (label || title || name || (typeof selected?.label === 'string' ? selected.label : 'Choose option'))}
            aria-labelledby={labelledBy} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? menuId : undefined}
            className={`figma-select ${className}`} style={style} onClick={() => open ? close() : show()}
            onKeyDown={(event) => { if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) { event.preventDefault(); event.stopPropagation(); show(); } }}>
            <span className="min-w-0 flex-1 truncate text-left">{selected?.label ?? 'Choose option'}</span><ChevronDown aria-hidden="true" className="h-3 w-3 shrink-0 opacity-60" />
        </button>
        {open && createPortal(<div ref={menu} id={menuId} role="listbox" tabIndex={-1} aria-label={ariaLabel ?? (label || title || 'Options')}
            aria-activedescendant={`${menuId}-${active}`} className="figma-select-menu" style={position}
            onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === 'Escape') { event.preventDefault(); close(); }
                else if (event.key === 'Tab') close();
                else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); move(event.key === 'ArrowDown' ? 1 : -1); }
                else if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); const indices = options.map((option, index) => option.disabled ? -1 : index).filter((index) => index >= 0); setActive(event.key === 'Home' ? indices[0] : indices[indices.length - 1]); }
                else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (options[active]) choose(options[active]); }
                else if (event.key.length === 1) {
                    const now = event.timeStamp; typeahead.current = { text: (now - typeahead.current.time < 600 ? typeahead.current.text : '') + event.key.toLowerCase(), time: now };
                    const match = options.findIndex((option) => !option.disabled && String(option.label).toLowerCase().startsWith(typeahead.current.text)); if (match >= 0) setActive(match);
                }
            }}>
            {options.map((option, index) => <React.Fragment key={`${option.value}-${index}`}>
                {option.group && option.group !== options[index - 1]?.group && <div role="presentation" className="px-7 py-1.5 text-[10px] text-white/45">{option.group}</div>}
                <div id={`${menuId}-${index}`} role="option" aria-selected={option.value === selectedValue} aria-disabled={option.disabled}
                    className={`figma-select-option ${index === active ? 'is-active' : ''}`} onPointerMove={() => !option.disabled && setActive(index)} onClick={() => choose(option)}>
                    <span className="flex w-4 shrink-0 items-center">{option.value === selectedValue && <Check className="h-3 w-3" />}</span><span className="truncate">{option.label}</span>
                </div>
            </React.Fragment>)}
        </div>, document.body)}
    </>;
}
