import type { KeyboardEvent, MouseEvent, ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SegmentedControl, Switch } from './primitives';
import { ModalShell } from './ModalShell';
import { navigateMenu } from './menuNavigation';

describe('shared choice controls', () => {
    it('keeps switch track and checked thumb styles when appending a caller class', () => {
        const button = Switch({ checked: true, onChange: () => {}, ariaLabel: 'Test switch', className: 'custom-switch' }) as unknown as ReactElement<{
            className: string;
            children: ReactElement<{ className: string }>;
            'aria-checked': boolean;
        }>;
        const thumb = button.props.children;

        expect(button.props.className).toContain('relative');
        expect(button.props.className).toContain('custom-switch');
        expect(button.props['aria-checked']).toBe(true);
        expect(thumb.props.className).toContain('rounded-full');
        expect(thumb.props.className).toContain('translate-x-[15px]');
    });

    it('does not select a disabled option and forwards the enabled value', () => {
        const onChange = vi.fn();
        const root = SegmentedControl({ value: 'one', onChange, options: [
            { value: 'one', label: 'One' }, { value: 'two', label: 'Two', disabled: true },
        ] });
        const buttons = root.props.children as ReactElement<{ onClick: () => void }>[];
        buttons[1].props.onClick();
        expect(onChange).not.toHaveBeenCalled();
        buttons[0].props.onClick();
        expect(onChange).toHaveBeenCalledWith('one');
    });

    it('keeps clicks inside a modal from reaching backdrop dismissal', () => {
        const onClick = vi.fn(), dismiss = vi.fn();
        const root = ModalShell({ backdropProps: { onClick: dismiss }, surfaceProps: { onClick }, children: 'Content' });
        const event = { stopPropagation: vi.fn() } as unknown as MouseEvent<HTMLDivElement>;
        root.props.children.props.onClick(event);
        expect(event.stopPropagation).toHaveBeenCalledOnce();
        expect(onClick).toHaveBeenCalledWith(event);
        expect(dismiss).not.toHaveBeenCalled();
    });
});

describe('shared menu keyboard navigation', () => {
    afterEach(() => vi.unstubAllGlobals());
    it('enters from the correct edge, wraps, and honors Home/End', () => {
        let active: object | null = null;
        vi.stubGlobal('document', { get activeElement() { return active; } });
        const buttons = [0, 1, 2].map(() => { const button = { focus: vi.fn(() => { active = button; }) }; return button; });
        const press = (key: string) => {
            const event = { key, currentTarget: { querySelectorAll: () => buttons }, preventDefault: vi.fn(), stopPropagation: vi.fn() };
            navigateMenu(event as unknown as KeyboardEvent<HTMLElement>);
            return event;
        };
        press('ArrowUp'); expect(active).toBe(buttons[2]);
        press('ArrowDown'); expect(active).toBe(buttons[0]);
        press('End'); expect(active).toBe(buttons[2]);
        press('Home'); expect(active).toBe(buttons[0]);
        expect(press('Tab').preventDefault).not.toHaveBeenCalled();
    });
});
